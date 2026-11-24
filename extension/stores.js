const STORES = [
 {id:"amazon",name:"Amazon Brasil",host:"www.amazon.com.br",url:q=>`https://www.amazon.com.br/s?k=${encodeURIComponent(q)}`},
 {id:"ml",name:"Mercado Livre",host:"lista.mercadolivre.com.br",url:q=>`https://lista.mercadolivre.com.br/${encodeURIComponent(q).replace(/%20/g,"-")}`},
 {id:"magalu",name:"Magazine Luiza",host:"www.magazineluiza.com.br",url:q=>`https://www.magazineluiza.com.br/busca/${encodeURIComponent(q)}/`},
 {id:"kabum",name:"KaBuM!",host:"www.kabum.com.br",url:q=>`https://www.kabum.com.br/busca/${encodeURIComponent(q)}`},
 {id:"carrefour",name:"Carrefour",host:"www.carrefour.com.br",url:q=>`https://www.carrefour.com.br/busca/${encodeURIComponent(q)}`},
 {id:"casasbahia",name:"Casas Bahia",host:"www.casasbahia.com.br",url:q=>`https://www.casasbahia.com.br/${encodeURIComponent(q).replace(/%20/g,"-")}/b`},
 {id:"pichau",name:"Pichau",host:"www.pichau.com.br",url:q=>`https://www.pichau.com.br/search?q=${encodeURIComponent(q)}`},
 {id:"terabyte",name:"TerabyteShop",host:"www.terabyteshop.com.br",url:q=>`https://www.terabyteshop.com.br/busca?str=${encodeURIComponent(q)}`}
];