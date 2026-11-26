// Deal Hunter - validação de URL de produto

const STORE_DOMAINS = {
  kabum: ["kabum.com.br"],
  pichau: ["pichau.com.br"],
  terabyte: ["terabyteshop.com.br"],
  magalu: ["magazineluiza.com.br", "magalu.com"],
  ml: ["mercadolivre.com.br"],
  carrefour: ["carrefour.com.br"],
  casasbahia: ["casasbahia.com.br"],
  shopee: ["shopee.com.br"],
  aliexpress: ["aliexpress.com"],
  shein: ["shein.com.br", "shein.com"],
};

const TRACKING_PARAMS = [
  /^utm_/i,
  /^gclid$/i,
  /^fbclid$/i,
  /^msclkid$/i,
  /^gbraid$/i,
  /^wbraid$/i,
  /^ref$/i,
  /^ref_$/i,
  /^tag$/i,
  /^src$/i,
  /^sid$/i,
  /^cid$/i,
  /^_gl$/i,
];

function hostBelongsTo(hostname, domains) {
  const host = hostname.toLowerCase();

  return domains.some(
    domain => host === domain || host.endsWith("." + domain)
  );
}

export function validateProductUrl(rawUrl, storeId, searchUrl) {
  const domains = STORE_DOMAINS[storeId];

  if (!domains) {
    return {
      ok: false,
      reason: `loja desconhecida: ${storeId}`,
    };
  }

  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return {
      ok: false,
      reason: "url vazia",
    };
  }

  let url;

  try {
    url = new URL(rawUrl, searchUrl);
  } catch {
    return {
      ok: false,
      reason: "url inválida",
    };
  }

  if (url.protocol !== "https:") {
    return {
      ok: false,
      reason: "não é HTTPS",
    };
  }

  if (url.username || url.password) {
    return {
      ok: false,
      reason: "url contém credenciais",
    };
  }

  if (!hostBelongsTo(url.hostname, domains)) {
    return {
      ok: false,
      reason: `domínio não pertence à loja: ${url.hostname}`,
    };
  }

  if (searchUrl) {
    try {
      const search = new URL(searchUrl);

      if (
        url.hostname === search.hostname &&
        url.pathname === search.pathname
      ) {
        return {
          ok: false,
          reason: "é a página de busca, não um produto",
        };
      }
    } catch {
      // A validação principal da URL continua sendo aplicada.
    }
  }

  if (url.pathname === "/" || !url.pathname) {
    return {
      ok: false,
      reason: "é a página inicial, não um produto",
    };
  }

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.some(regex => regex.test(key))) {
      url.searchParams.delete(key);
    }
  }

  url.hash = "";
  url.searchParams.sort();

  return {
    ok: true,
    url: url.toString(),
  };
}