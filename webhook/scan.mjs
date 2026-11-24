import { chromium } from "playwright";
import fs from "node:fs/promises";
import { STORES } from "./stores.mjs";
import { evaluate, money } from "./detect.mjs";
import { extractInPage } from "./extract.mjs";

const args = new Set(process.argv.slice(2));
const config = JSON.parse(await fs.readFile(new URL("./config.json", import.meta.url), "utf8"));
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL || "";
const STATE = new URL("./state.json", import.meta.url);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toLocaleTimeString("pt-BR"), ...a);

if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(WEBHOOK)) {
  console.error("Defina DISCORD_WEBHOOK_URL no .env (veja .env.example).");
  process.exit(1);
}

async function post(body) {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "Deal Hunter", ...body }) });
    if (res.status === 429) { const j = await res.json().catch(() => ({})); await sleep(((j.retry_after ?? 2) + 0.5) * 1000); continue; }
    if (!res.ok) log("Discord respondeu", res.status);
    return;
  }
}

async function sendDeals(deals) {
  const size = Math.min(10, config.maxAlertsPerMessage || 10);
  for (let i = 0; i < deals.length; i += size) {
    const embeds = deals.slice(i, i + size).map(d => ({
      title: ((d.suspicious ? "⚠️ Possível bug: " : "🔥 ") + d.title).slice(0, 250),
      url: d.url,
      description: `**${money(d.price)}** — ${d.store}\n${d.reason}${d.discount != null ? ` · ${d.discount}% abaixo do menor observado (${money(d.priorMin)})` : ""}`,
      color: d.suspicious ? 0xf1c40f : 0xff6b35,
      footer: { text: `Busca: ${d.keyword} · confira vendedor, frete e preço final` },
      timestamp: new Date().toISOString()
    }));
    await post({ embeds });
    await sleep(1000);
  }
}

async function loadState() { try { return JSON.parse(await fs.readFile(STATE, "utf8")); } catch { return { history: {} }; } }
async function saveState(s) { const tmp = new URL("./state.json.tmp", import.meta.url); await fs.writeFile(tmp, JSON.stringify(s)); await fs.rename(tmp, STATE); }

async function runOnce(browser) {
  const state = await loadState();
  const stores = STORES.filter(s => config.enabledStores.includes(s.id));
  const keywords = config.keywords.filter(Boolean).slice(0, 12);
  const context = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo", viewport: { width: 1366, height: 900 } });
  const alerts = [];
  for (const keyword of keywords) for (const store of stores) {
    const page = await context.newPage();
    try {
      await page.goto(store.url(keyword), { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const items = await page.evaluate(extractInPage);
      log(`${store.name} · "${keyword}" → ${items.length} itens`);
      if (!items.length) log("  (0 itens: layout mudou, bloqueio ou busca sem resultado)");
      alerts.push(...evaluate(items, store, keyword, state.history, Date.now(), config.aggressive !== false));
    } catch (e) { log(`${store.name} · "${keyword}" falhou: ${e.message.split("\n")[0]}`); }
    finally { await page.close().catch(() => {}); }
    await sleep(1500);
  }
  await context.close();
  await saveState(state);
  if (alerts.length) { log(`${alerts.length} alerta(s) → Discord`); await sendDeals(alerts); }
  else log("Nenhum alerta nesta rodada.");
}

if (args.has("--test")) {
  await post({ content: "✅ Deal Hunter conectado ao webhook." });
  log("Mensagem de teste enviada."); process.exit(0);
}

const browser = await chromium.launch({ headless: true });
process.on("SIGINT", async () => { await browser.close(); process.exit(0); });
do {
  try { await runOnce(browser); } catch (e) { log("Erro na rodada:", e.message); }
  if (args.has("--once")) break;
  await sleep(Math.max(5, config.intervalMinutes || 15) * 60000);
} while (true);
await browser.close();
