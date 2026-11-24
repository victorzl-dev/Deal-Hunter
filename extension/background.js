
importScripts("stores.js");

const DATA_VERSION = 2;

const DEFAULTS = {
  keywords: [
    "PlayStation 5",
    "notebook gamer",
    "SSD 1TB",
    "memória RAM DDR4",
    "monitor 144Hz",
    "smartphone"
  ],
  intervalMinutes: 15,
  enabledStores: STORES.map(s => s.id),
  discordWebhook: "",
  enabled: true,
  aggressive: true,
  bugHunter: true
};

const norm = value =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const money = value =>
  Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

const WEBHOOK_RE =
  /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//;

async function ensureDataVersion() {
  const data = await chrome.storage.local.get({
    dataVersion: 0
  });

  if (data.dataVersion !== DATA_VERSION) {
    await chrome.storage.local.set({
      dataVersion: DATA_VERSION,
      priceHistory: {},
      deals: []
    });
  }
}

async function getSettings() {
  const data = await chrome.storage.local.get({
    settings: DEFAULTS
  });

  return {
    ...DEFAULTS,
    ...data.settings
  };
}

async function setup() {
  await ensureDataVersion();

  const settings = await getSettings();

  await chrome.storage.local.set({
    settings
  });

  chrome.alarms.create("dh_scan", {
    periodInMinutes: Math.max(
      5,
      Number(settings.intervalMinutes) || 15
    )
  });
}

chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "dh_scan") {
    runScan();
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "START_SCAN") {
    runScan();
  }

  if (message?.type === "DEAL_SCAN_RESULT") {
    processResult(message.payload, sender?.tab?.id);
  }

  if (message?.type === "SAVE_SETTINGS") {
    saveSettings(message.settings);
  }
});

async function saveSettings(settings) {
  const current = await getSettings();

  const updated = {
    ...current,
    ...settings
  };

  await chrome.storage.local.set({
    settings: updated
  });

  chrome.alarms.create("dh_scan", {
    periodInMinutes: Math.max(
      5,
      Number(updated.intervalMinutes) || 15
    )
  });
}

let running = false;

async function runScan() {
  if (running) return;

  running = true;

  try {
    const settings = await getSettings();

    if (!settings.enabled) return;

    const stores = STORES.filter(store =>
      settings.enabledStores.includes(store.id) &&
      store.id !== "amazon"
    );

    const jobs = [];

    for (const keyword of (settings.keywords || [])
      .filter(Boolean)
      .slice(0, 12)) {
      for (const store of stores) {
        jobs.push({ keyword, store });
      }
    }

    for (const job of jobs) {
      let tab;

      try {
        tab = await chrome.tabs.create({
          url: job.store.url(job.keyword),
          active: false
        });

        await chrome.storage.local.set({
          ["job_" + tab.id]: {
            keyword: job.keyword,
            store: job.store.id
          }
        });

        await new Promise(resolve => {
          let done = false;

          const finish = () => {
            if (done) return;

            done = true;
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          };

          const timer = setTimeout(finish, 20000);

          const listener = (id, info) => {
            if (id === tab.id && info.status === "complete") {
              clearTimeout(timer);
              finish();
            }
          };

          chrome.tabs.onUpdated.addListener(listener);
        });

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["scanner.js"]
        });

        await new Promise(resolve => setTimeout(resolve, 4500));

      } catch (error) {
        console.warn("Falha na busca:", error.message);

      } finally {
        if (tab?.id) {
          chrome.tabs.remove(tab.id).catch(() => {});
          chrome.storage.local.remove("job_" + tab.id);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    await chrome.storage.local.set({
      lastScan: Date.now()
    });

  } finally {
    running = false;
  }
}

function normalizeProductUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";

    return url.hostname + url.pathname;
  } catch {
    return String(value || "").slice(0, 250);
  }
}

function median(values) {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function processResult(payload, tabId) {
  await ensureDataVersion();

  const settings = await getSettings();

  const jobKey = "job_" + tabId;

  const job = tabId != null
    ? (await chrome.storage.local.get(jobKey))[jobKey]
    : null;

  let store = job && STORES.find(
    item => item.id === job.store
  );

  if (!store) {
    let host;

    try {
      host = new URL(payload.url).hostname;
    } catch {
      return;
    }

    store = STORES.find(item => item.host === host);
  }

  if (!store || store.id === "amazon") return;

  const keyword = job?.keyword || "";

  const data = await chrome.storage.local.get({
    priceHistory: {},
    deals: []
  });

  const history = data.priceHistory;
  const now = Date.now();
  const found = [];

  for (const item of payload.items || []) {
    const price = Number(item.price);

    // Só aceita preços identificados e validados pelo scanner.
    if (
      item.priceVerified !== true ||
      item.priceSource !== "dedicated-price-element" ||
      !Number.isFinite(price) ||
      price < 5 ||
      price > 1000000 ||
      !item.href
    ) {
      continue;
    }

    const title = norm(item.title).slice(0, 150);

    if (title.length < 8) continue;

    const productUrl = normalizeProductUrl(item.href);
    const variant = norm(item.variant || "");

    const key = [
      store.id,
      productUrl,
      title,
      variant
    ].join("|");

    const prior = (history[key] || []).filter(record =>
      Number.isFinite(record.p) &&
      record.p >= 5 &&
      record.p <= 1000000 &&
      now - record.t < 90 * 86400000
    );

    const previous = prior.length
      ? prior[prior.length - 1].p
      : null;

    const prices = prior.map(record => record.p);
    const lowest = prices.length
      ? Math.min(...prices)
      : null;

    const typical = median(prices);

    // Exige pelo menos três medições anteriores.
    const enoughHistory = prior.length >= 3;

    const drop = lowest
      ? (lowest - price) / lowest
      : 0;

    const sudden = previous
      ? (previous - price) / previous
      : 0;

    const suspicious =
      enoughHistory &&
      typical !== null &&
      price < typical * 0.55;

    const normalDrop =
      enoughHistory &&
      lowest !== null &&
      drop >= 0.12;

    const aggressiveDrop =
      enoughHistory &&
      settings.aggressive &&
      sudden >= 0.10;

    const trigger =
      suspicious ||
      normalDrop ||
      aggressiveDrop;

    history[key] = [
      ...prior,
      { p: price, t: now }
    ].slice(-60);

    if (!trigger) continue;

    found.push({
      id: key + "_" + Math.floor(now / 60000),
      title: item.title,
      price,
      store: store.name,
      url: item.href,
      keyword,
      priorMin: lowest,
      discount: lowest !== null
        ? Math.max(0, Math.round(drop * 100))
        : null,
      suspicious,
      reason: suspicious
        ? "Preço muito abaixo do histórico: conferir anúncio e variante"
        : normalDrop
          ? "Abaixo do menor preço observado"
          : "Queda recente detectada",
      observedAt: now
    });
  }

  const deals = [
    ...found,
    ...data.deals
  ].slice(0, 250);

  await chrome.storage.local.set({
    priceHistory: history,
    deals
  });

  if (tabId != null) {
    chrome.storage.local.remove(jobKey);
  }

  if (found.length) {
    await notify(found.slice(0, 10), settings);
  }
}

async function notify(items, settings) {
  const first = items[0];
  const extra = items.length > 1
    ? ` (+${items.length - 1})`
    : "";

  chrome.notifications.create(
    "dh_" + Date.now(),
    {
      type: "basic",
      iconUrl: "icon128.png",
      title: (
        first.suspicious
          ? "Possível preço atípico"
          : "Oferta detectada"
      ) + extra,
      message:
        `${first.title.slice(0, 75)} — ` +
        `${money(first.price)} (${first.store})`,
      priority: 2
    }
  );

  if (
    !settings.discordWebhook ||
    !WEBHOOK_RE.test(settings.discordWebhook)
  ) {
    return;
  }

  const embeds = items.map(deal => ({
    title: (
      deal.suspicious
        ? "⚠️ Possível preço atípico: "
        : "🔥 "
    ) + deal.title.slice(0, 230),

    url: deal.url,

    description:
      `**${money(deal.price)}** — ${deal.store}\n` +
      `${deal.reason}` +
      (
        deal.discount !== null
          ? ` · ${deal.discount}% abaixo do menor observado (${money(deal.priorMin)})`
          : ""
      ),

    color: deal.suspicious
      ? 0xf1c40f
      : 0xff6b35,

    footer: {
      text: `Busca: ${deal.keyword || "-"} · Confira vendedor, frete e preço final`
    },

    timestamp: new Date(deal.observedAt).toISOString()
  }));

  try {
    await fetch(settings.discordWebhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: "Deal Hunter",
        embeds
      })
    });
  } catch (error) {
    console.warn("Falha ao enviar webhook:", error.message);
  }
}
