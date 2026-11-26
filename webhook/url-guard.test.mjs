// webhook/url-guard.test.mjs  â†’  node --test
import test from "node:test";
import assert from "node:assert/strict";
import { validateProductUrl as v } from "./url-guard.mjs";

const S = "https://www.kabum.com.br/busca/ssd-1tb";

test("spoof de domÃ­nio", () => {
  assert.equal(v("https://kabum.com.br.evil.com/produto/1/x", "kabum", S).ok, false);
  assert.equal(v("https://evilkabum.com.br/produto/1/x", "kabum", S).ok, false);
});
test("subdomÃ­nio legÃ­timo passa", () => {
  assert.equal(v("https://produto.mercadolivre.com.br/MLB-123-x", "ml", S).ok, true);
});
test("relativa resolve contra a busca", () => {
  const r = v("/produto/123/ssd-x", "kabum", S);
  assert.equal(r.ok, true);
  assert.match(r.url, /^https:\/\/www\.kabum\.com\.br\/produto\/123/);
});
test("remove rastreio, mantÃ©m variante", () => {
  const r = v("https://www.kabum.com.br/produto/1/x?utm_source=a&cor=preto&gclid=z", "kabum", S);
  assert.equal(r.url.includes("cor=preto"), true);
  assert.equal(r.url.includes("utm_source"), false);
});
test("vazio/undefined/home", () => {
  assert.equal(v(undefined, "kabum", S).ok, false);
  assert.equal(v("https://www.kabum.com.br/", "kabum", S).ok, false);
});
