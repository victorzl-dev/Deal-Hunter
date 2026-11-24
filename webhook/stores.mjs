
const enc = encodeURIComponent;

export const STORES = [
  {
    id: "amazon",
    name: "Amazon Brasil",
    url: q => `https://www.amazon.com.br/s?k=${enc(q)}`
  },
  {
    id: "ml",
    name: "Mercado Livre",
    url: q => `https://lista.mercadolivre.com.br/${enc(q).replace(/%20/g, "-")}`
  },
  {
    id: "magalu",
    name: "Magazine Luiza",
    url: q => `https://www.magazineluiza.com.br/busca/${enc(q)}/`
  },
  {
    id: "kabum",
    name: "KaBuM!",
    url: q => `https://www.kabum.com.br/busca/${enc(q)}`
  },
  {
    id: "carrefour",
    name: "Carrefour",
    url: q => `https://www.carrefour.com.br/busca/${enc(q)}`
  },
  {
    id: "casasbahia",
    name: "Casas Bahia",
    url: q => `https://www.casasbahia.com.br/${enc(q).replace(/%20/g, "-")}/b`
  },
  {
    id: "pichau",
    name: "Pichau",
    url: q => `https://www.pichau.com.br/search?q=${enc(q)}`
  },
  {
    id: "terabyte",
    name: "TerabyteShop",
    url: q => `https://www.terabyteshop.com.br/busca?str=${enc(q)}`
  },
  {
    id: "shopee",
    name: "Shopee Brasil",
    url: q => `https://shopee.com.br/search?keyword=${enc(q)}`
  },
  {
    id: "aliexpress",
    name: "AliExpress",
    url: q => `https://pt.aliexpress.com/w/wholesale-${enc(q)}.html`
  },
  {
    id: "shein",
    name: "SHEIN",
    url: q => `https://br.shein.com/pdsearch/${enc(q)}/`
  }
];
