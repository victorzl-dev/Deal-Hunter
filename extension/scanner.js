
(() => {
  const clean = value =>
    String(value || "").replace(/\s+/g, " ").trim();

  // Não tenta extrair preços da Amazon enquanto ela estiver
  // apresentando respostas inconsistentes ou bloqueios.
  if (location.hostname.includes("amazon.com.br")) {
    chrome.runtime.sendMessage({
      type: "DEAL_SCAN_RESULT",
      payload: {
        url: location.href,
        items: [],
        scannedAt: Date.now()
      }
    });
    return;
  }

  const parseBRL = value => {
    const text = clean(value);

    // Exige R$ explícito e centavos.
    const matches = [...text.matchAll(
      /R\$\s*((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})/gi
    )];

    const values = matches
      .map(match =>
        Number(match[1].replace(/\./g, "").replace(",", "."))
      )
      .filter(price =>
        Number.isFinite(price) &&
        price >= 5 &&
        price <= 1000000
      );

    const unique = [...new Set(values)];

    // Se houver mais de um preço diferente, não adivinha.
    return unique.length === 1 ? unique[0] : null;
  };

  const normalizeUrl = href => {
    try {
      const url = new URL(href, location.href);
      url.hash = "";
      url.search = "";
      return url.href;
    } catch {
      return "";
    }
  };

  const getVariant = title => {
    const text = clean(title).toLowerCase();
    const patterns = [
      /\b\d+\s?(?:gb|tb|mb)\b/g,
      /\b(?:ddr3|ddr4|ddr5)\b/g,
      /\b\d{2,4}\s?hz\b/g,
      /\b(?:rtx|gtx)\s?\d{3,4}\b/g
    ];

    const found = [];

    for (const pattern of patterns) {
      found.push(...(text.match(pattern) || []));
    }

    return [...new Set(found)].sort().join(" ");
  };

  const priceSelectors = [
    '[data-testid*="price"]',
    '[class*="price"]',
    '[class*="Price"]',
    '[itemprop="price"]',
    ".price",
    ".product-price"
  ];

  const links = [...document.querySelectorAll("a[href]")].filter(a => {
    const rect = a.getBoundingClientRect();

    return (
      rect.width > 80 &&
      rect.height > 30 &&
      a.href.startsWith("http") &&
      !a.href.startsWith("javascript:")
    );
  });

  const seen = new Set();
  const items = [];

  for (const link of links) {
    const card = link.closest(
      "article, li, [data-testid*='product'], [class*='product-card'], [class*='ProductCard'], .product-item"
    ) || link.parentElement?.parentElement;

    if (!card) continue;

    const heading = card.querySelector("h2, h3");
    const title = clean(
      heading?.innerText ||
      link.getAttribute("title") ||
      link.innerText
    ).slice(0, 180);

    if (title.length < 8) continue;

    const href = normalizeUrl(link.href);
    if (!href || seen.has(href)) continue;

    const priceElements = [];

    for (const selector of priceSelectors) {
      for (const element of card.querySelectorAll(selector)) {
        const style = getComputedStyle(element);

        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.textDecorationLine.includes("line-through")
        ) {
          continue;
        }

        const text = clean(element.innerText || element.textContent);

        if (!text || text.length > 100) continue;

        // Não aceitar parcelas como preço principal.
        if (/\b\d+\s*x\b/i.test(text)) continue;
        if (/por mês|mensais|parcelas|a partir de/i.test(text)) continue;

        const price = parseBRL(text);

        if (price !== null) {
          priceElements.push(price);
        }
      }
    }

    const uniquePrices = [...new Set(priceElements)];

    // Zero ou vários preços diferentes: anúncio ambíguo.
    if (uniquePrices.length !== 1) continue;

    const price = uniquePrices[0];

    seen.add(href);

    items.push({
      title,
      price,
      href,
      variant: getVariant(title),
      priceVerified: true,
      priceSource: "dedicated-price-element"
    });

    if (items.length >= 30) break;
  }

  chrome.runtime.sendMessage({
    type: "DEAL_SCAN_RESULT",
    payload: {
      url: location.href,
      items,
      scannedAt: Date.now()
    }
  });
})();
