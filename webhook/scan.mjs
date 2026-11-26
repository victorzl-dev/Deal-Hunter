
import { chromium } from "playwright";
import fs from "node:fs/promises";

import { STORES } from "./stores.mjs";
import { evaluate, money } from "./detect.mjs";
import { extractInPage } from "./extract.mjs";
import { validateProductUrl } from "./url-guard.mjs";

const args = new Set(process.argv.slice(2));

const CONFIG_URL = new URL("./config.json", import.meta.url);
const STATE_URL = new URL("./state.json", import.meta.url);
const TEMP_STATE_URL = new URL("./state.json.tmp", import.meta.url);

const config = JSON.parse(await fs.readFile(CONFIG_URL, "utf8"));
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL || "";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const log = (...values) => {
  console.log(new Date().toLocaleTimeString("pt-BR"), ...values);
};

// Valida o formato básico da configuração.
function validateConfig() {
  if (!config || typeof config !== "object") {
    throw new Error("config.json inválido.");
  }

  if (!Array.isArray(config.keywords)) {
    throw new Error("config.json: keywords precisa ser uma lista.");
  }

  if (!Array.isArray(config.enabledStores)) {
    throw new Error("config.json: enabledStores precisa ser uma lista.");
  }

  if (config.keywords.length === 0) {
    throw new Error("Adicione pelo menos uma palavra-chave.");
  }

  if (config.enabledStores.length === 0) {
    throw new Error("Ative pelo menos uma loja.");
  }

  if (
    config.intervalMinutes !== undefined &&
    (!Number.isFinite(config.intervalMinutes) ||
      config.intervalMinutes < 1)
  ) {
    throw new Error("intervalMinutes precisa ser pelo menos 1.");
  }
}

// Valida o endereço do webhook sem exibir seu conteúdo.
function validateWebhook() {
  let url;

  try {
    url = new URL(WEBHOOK);
  } catch {
    throw new Error(
      "Webhook inválido. Confira DISCORD_WEBHOOK_URL no arquivo .env."
    );
  }

  const allowedHosts = new Set([
    "discord.com",
    "discordapp.com",
  ]);

  if (
    url.protocol !== "https:" ||
    !allowedHosts.has(url.hostname) ||
    !url.pathname.startsWith("/api/webhooks/") ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "Webhook inválido. Use um endereço HTTPS oficial do Discord."
    );
  }
}

// Envia uma mensagem e tenta novamente em caso de falha temporária.
async function post(body) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response;

    try {
      response = await fetch(WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "Deal Hunter",
          ...body,
        }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      if (attempt === maxAttempts) {
        throw new Error(
          `Falha de conexão com Discord: ${error.message}`
        );
      }

      log(`Falha de conexão; tentativa ${attempt}/${maxAttempts}.`);
      await sleep(attempt * 2000);
      continue;
    }

    if (response.status === 429) {
      const data = await response.json().catch(() => ({}));
      const retryAfter = Number(data.retry_after);

      const waitMs = Number.isFinite(retryAfter)
        ? Math.max(1000, retryAfter * 1000 + 500)
        : attempt * 2000;

      if (attempt === maxAttempts) {
        throw new Error("Discord limitou o envio (HTTP 429).");
      }

      log("Discord limitou o envio; aguardando para tentar novamente.");
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Discord respondeu HTTP ${response.status}.`);
    }

    return true;
  }

  throw new Error("Não foi possível enviar a mensagem ao Discord.");
}

async function sendDeals(deals) {
  const configuredSize = Number(config.maxAlertsPerMessage) || 10;
  const batchSize = Math.max(1, Math.min(10, configuredSize));

  for (let i = 0; i < deals.length; i += batchSize) {
    const batch = deals.slice(i, i + batchSize);

    const embeds = batch.map(deal => ({
      title: (
        (deal.suspicious ? "⚠️ Possível bug: " : "🔥 ") +
        deal.title
      ).slice(0, 250),

      url: deal.url,

      description:
        `**${money(deal.price)}** — ${deal.store}\n` +
        `${deal.reason}` +
        (
          deal.discount != null
            ? ` · ${deal.discount}% abaixo do menor observado (${money(deal.priorMin)})`
            : ""
        ),

      color: deal.suspicious ? 0xf1c40f : 0xff6b35,

      footer: {
        text: `Busca: ${deal.keyword} · confira vendedor, frete e preço final`,
      },

      timestamp: new Date().toISOString(),
    }));

    await post({ embeds });
    log(`Lote ${Math.floor(i / batchSize) + 1} enviado ao Discord.`);

    if (i + batchSize < deals.length) {
      await sleep(1000);
    }
  }
}

async function loadState() {
  try {
    const raw = await fs.readFile(STATE_URL, "utf8");
    const state = JSON.parse(raw);

    if (!state || typeof state !== "object") {
      throw new Error("Formato inválido.");
    }

    if (!state.history || typeof state.history !== "object") {
      state.history = {};
    }

    return state;
  } catch (error) {
    if (error.code !== "ENOENT") {
      log("Não foi possível ler state.json; iniciando estado novo.");
    }

    return { history: {} };
  }
}

async function saveState(state) {
  const content = JSON.stringify(state, null, 2);

  await fs.writeFile(TEMP_STATE_URL, content, "utf8");
  await fs.rename(TEMP_STATE_URL, STATE_URL);
}

function getEnabledStores() {
  const enabledIds = new Set(config.enabledStores);

  return STORES.filter(store => enabledIds.has(store.id));
}

function getKeywords() {
  return config.keywords
    .filter(keyword => typeof keyword === "string")
    .map(keyword => keyword.trim())
    .filter(Boolean)
    .slice(0, 12);
}

// Valida os links extraídos antes de usar ou enviar os produtos.
function validateItems(extractedItems, store, searchUrl) {
  if (!Array.isArray(extractedItems)) {
    log(`[${store.id}] extração não retornou uma lista.`);
    return [];
  }

  return extractedItems.flatMap(item => {
    if (!item || typeof item.href !== "string") {
      return [];
    }

    const check = validateProductUrl(
      item.href,
      store.id,
      searchUrl
    );

    if (!check.ok) {
      log(`[${store.id}] item descartado: ${check.reason}`);
      return [];
    }

    return [{
      ...item,
      href: check.url,
    }];
  });
}

async function runOnce(browser) {
  const state = await loadState();
  const stores = getEnabledStores();
  const keywords = getKeywords();

  if (stores.length === 0 || keywords.length === 0) {
    log("Nenhuma loja ou palavra-chave válida para pesquisar.");
    return;
  }

  const context = await browser.newContext({
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: {
      width: 1366,
      height: 900,
    },
  });

  const alerts = [];

  try {
    for (const keyword of keywords) {
      for (const store of stores) {
        const page = await context.newPage();

        try {
          log(`Pesquisando ${store.name} · "${keyword}"`);

          await page.goto(store.url(keyword), {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });

          await page.waitForLoadState("networkidle", {
            timeout: 10000,
          }).catch(() => {});

          await page.waitForTimeout(2500);

          const extractedItems = await page.evaluate(extractInPage);
          const searchUrl = page.url();

          const items = validateItems(
            extractedItems,
            store,
            searchUrl
          );

          log(`${store.name} · "${keyword}" → ${items.length} itens`);

          if (items.length === 0) {
            log("  Nenhum produto válido encontrado.");
          }

          const foundAlerts = evaluate(
            items,
            store,
            keyword,
            state.history,
            Date.now(),
            config.aggressive !== false
          );

          alerts.push(...foundAlerts);
        } catch (error) {
          const message = String(error?.message || error)
            .split("\n")[0];

          log(`${store.name} · "${keyword}" falhou: ${message}`);
        } finally {
          await page.close().catch(() => {});
        }

        await sleep(1500);
      }
    }
  } finally {
    await context.close().catch(() => {});
  }

  // Envia antes de salvar o histórico. Se o Discord falhar,
  // o histórico desta rodada não será gravado e os alertas
  // poderão ser reavaliados na próxima execução.
  if (alerts.length > 0) {
    log(`${alerts.length} alerta(s) encontrado(s). Enviando ao Discord...`);
    await sendDeals(alerts);
  } else {
    log("Nenhum alerta nesta rodada.");
  }

  await saveState(state);
  log("Histórico salvo.");
}

validateConfig();
validateWebhook();

if (args.has("--test")) {
  await post({
    content: "✅ Deal Hunter conectado ao webhook.",
  });

  log("Mensagem de teste enviada.");
  process.exit(0);
}

const browser = await chromium.launch({
  headless: true,
});

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;

  shuttingDown = true;
  log("Encerrando Deal Hunter...");

  await browser.close().catch(() => {});
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

do {
  try {
    await runOnce(browser);
  } catch (error) {
    log("Erro na rodada:", error.message);
  }

  if (args.has("--once") || shuttingDown) {
    break;
  }

  const intervalMinutes = Math.max(
    1,
    Number(config.intervalMinutes) || 15
  );

  await sleep(intervalMinutes * 60000);
} while (!shuttingDown);

await browser.close().catch(() => {});
