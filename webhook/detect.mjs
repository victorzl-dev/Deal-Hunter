
// Deal Hunter v2.2
// Histórico separado por loja, produto, URL e variante.

export const norm = value =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const money = value =>
  Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

const DAY = 86400000;

function normalizeProductUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";

    for (const key of [...url.searchParams.keys()]) {
      if (!["sku", "variant", "variation", "id"].includes(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }

    return `${url.hostname}${url.pathname}${url.search}`;
  } catch {
    return String(value || "").slice(0, 180);
  }
}

function getVariant(item) {
  const explicit = norm(item.variant);
  if (explicit) return explicit;

  // Identifica características que costumam diferenciar variantes.
  const text = norm(item.title);
  const patterns = [
    /\b\d+\s?(?:gb|tb|mb)\b/g,
    /\b(?:ddr3|ddr4|ddr5)\b/g,
    /\b(?:128|256|512)\s?gb\b/g,
    /\b(?:1|2|4|8)\s?tb\b/g,
    /\b\d{2,4}\s?hz\b/g
  ];

  const matches = [];

  for (const pattern of patterns) {
    matches.push(...(text.match(pattern) || []));
  }

  return [...new Set(matches)].sort().join(" ");
}

function median(values) {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function evaluate(
  items,
  store,
  keyword,
  history,
  now = Date.now(),
  aggressive = true
) {
  const found = [];

  for (const item of items) {
    const title = norm(item.title).slice(0, 110);
    const price = Number(item.price);

    if (
      title.length < 8 ||
      !Number.isFinite(price) ||
      price < 5 ||
      price > 1000000 ||
      !item.href
    ) {
      continue;
    }

    const urlKey = normalizeProductUrl(item.href);
    const variant = getVariant(item);

    const key = [
      store.id,
      urlKey,
      title,
      variant
    ].join("|");

    const prior = (history[key] || [])
      .filter(x =>
        Number.isFinite(x.p) &&
        x.p >= 5 &&
        x.p <= 1000000 &&
        now - x.t < 90 * DAY
      );

    const previous = prior.length
      ? prior[prior.length - 1].p
      : null;

    const priorPrices = prior.map(x => x.p);
    const lowest = priorPrices.length
      ? Math.min(...priorPrices)
      : null;

    const typical = median(priorPrices);

    const suddenDrop = previous
      ? (previous - price) / previous
      : 0;

    const belowLowest = lowest
      ? (lowest - price) / lowest
      : 0;

    // Uma possível falha de preço exige várias medições anteriores.
    const suspicious =
      prior.length >= 3 &&
      typical !== null &&
      price < typical * 0.55;

    const normalDrop =
      prior.length >= 2 &&
      lowest !== null &&
      belowLowest >= 0.12;

    const aggressiveDrop =
      aggressive &&
      previous !== null &&
      suddenDrop >= 0.10;

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
      title: item.title,
      price,
      url: item.href,
      store: store.name,
      keyword,
      priorMin: lowest,
      priorMedian: typical,
      discount: lowest
        ? Math.max(0, Math.round(belowLowest * 100))
        : null,
      suspicious,
      reason: suspicious
        ? "Preço muito abaixo do histórico — verificar variante e anúncio"
        : normalDrop
          ? "Preço abaixo do menor valor observado"
          : "Queda recente detectada"
    });
  }

  return found;
}
