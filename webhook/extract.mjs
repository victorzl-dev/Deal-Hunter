
// Deal Hunter v2.2
// Extração conservadora: prioriza preço principal e evita valores soltos
// encontrados no texto de anúncios.

export function extractInPage() {
  const clean = value =>
    String(value || "").replace(/\s+/g, " ").trim();

  const validPrice = value => {
    const price = Number(value);
    return Number.isFinite(price) && price >= 5 && price <= 1000000
      ? price
      : null;
  };

  // Só aceita valores monetários explícitos em reais.
  const parseBRL = value => {
    const text = clean(value);
    const match = text.match(/R\$\s*([\d.]+,\d{2})/i);
    if (!match) return null;

    return validPrice(
      match[1].replace(/\./g, "").replace(",", ".")
    );
  };

  const normalizeUrl = href => {
    try {
      const url = new URL(href, location.href);
      url.hash = "";

      // Remove parâmetros de rastreamento, mantendo o caminho do produto.
      const keep = ["sku", "variant", "variation", "id"];
      for (const key of [...url.searchParams.keys()]) {
        if (!keep.includes(key.toLowerCase())) {
          url.searchParams.delete(key);
        }
      }

      return url.href;
    } catch {
      return "";
    }
  };

  const makeItem = (title, price, href, variant = "") => {
    title = clean(title).slice(0, 180);
    const url = normalizeUrl(href);

    if (!title || title.length < 8 || !url || !price) return null;

    const genericTitles = [
      "ofertas de produtos novos e usados",
      "ver todos os resultados",
      "resultado da pesquisa",
      "produtos relacionados",
      "mais vendidos"
    ];

    if (genericTitles.some(x => title.toLowerCase().includes(x))) {
      return null;
    }

    return {
      title,
      price,
      href: url,
      variant: clean(variant).slice(0, 100)
    };
  };

  const results = [];
  const seen = new Set();

  const add = item => {
    if (!item) return;

    const key = `${item.href}|${item.title}|${item.variant}`;
    if (seen.has(key)) return;

    seen.add(key);
    results.push(item);
  };

  // AMAZON: seletor específico para os resultados de produtos.
  if (location.hostname.includes("amazon.com.br")) {
    const cards = document.querySelectorAll(
      '[data-component-type="s-search-result"]'
    );

    for (const card of cards) {
      const titleNode = card.querySelector("h2 a span, h2 span");
      const linkNode = card.querySelector("h2 a[href]");

      if (!titleNode || !linkNode) continue;

      const title = clean(titleNode.innerText);
      const href = linkNode.href;

      // Não aceitar páginas genéricas de listagem de ofertas.
      if (!/\/(dp|gp\/product)\//i.test(href)) continue;

      const priceNodes = [
        ...card.querySelectorAll(".a-price:not(.a-text-price) .a-offscreen")
      ];

      let price = null;

      for (const node of priceNodes) {
        const candidate = parseBRL(node.innerText || node.textContent);
        if (candidate) {
          price = candidate;
          break;
        }
      }

      if (!price) continue;

      const variantNode = card.querySelector(
        '[aria-label*="tamanho"], [aria-label*="cor"], [class*="variation"]'
      );

      add(makeItem(
        title,
        price,
        href,
        variantNode?.innerText || ""
      ));
    }

    return results.slice(0, 30);
  }

  // DEMAIS LOJAS: primeiro tenta dados estruturados de produto.
  // Não tenta adivinhar preço a partir do texto inteiro do anúncio.
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );

  const visitStructuredData = data => {
    if (!data || typeof data !== "object") return;

    if (Array.isArray(data)) {
      for (const item of data) visitStructuredData(item);
      return;
    }

    const type = data["@type"];
    const isProduct =
      type === "Product" ||
      (Array.isArray(type) && type.includes("Product"));

    if (isProduct) {
      const offers = Array.isArray(data.offers)
        ? data.offers
        : data.offers
          ? [data.offers]
          : [];

      for (const offer of offers) {
        if (!offer || typeof offer !== "object") continue;

        const currency = String(
          offer.priceCurrency || offer.currency || ""
        ).toUpperCase();

        if (currency !== "BRL") continue;

        const price = validPrice(offer.price);
        const title = clean(data.name);
        const href = data.url || location.href;

        add(makeItem(title, price, href));
      }
    }

    for (const value of Object.values(data)) {
      if (value && typeof value === "object") {
        visitStructuredData(value);
      }
    }
  };

  for (const script of scripts) {
    try {
      visitStructuredData(JSON.parse(script.textContent));
    } catch {
      // Ignora JSON inválido.
    }
  }

  // Limite conservador para evitar duplicações e resultados ruins.
  return results.slice(0, 30);
}
