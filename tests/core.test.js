"use strict";

const assert = require("assert").strict;
const core = require("../src/core.js");

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test("interpreta números e moedas brasileiras", () => {
  assert.equal(core.parseBrazilianNumber("1.234,56"), 1234.56);
  assert.equal(core.parseCurrency("Investimento mínimo R$ 20.000,00"), 20000);
});

test("identifica taxas CDI, IPCA+ e prefixada", () => {
  assert.deepEqual(core.parseRate("Rentabilidade 118% do CDI"), { value: 118, indexer: "CDI", label: "118% do CDI" });
  assert.equal(core.parseRate("IPCA + 6,45%").indexer, "IPCA+");
  assert.equal(core.parseRate("14,2% a.a.").indexer, "PREFIXADO");
});

test("calcula dias até uma data de vencimento", () => {
  assert.equal(core.parseMaturityDays("Vencimento 29/08/2026", "2026-08-19T12:00:00Z"), 10);
  assert.equal(core.parseMaturityDays("Vencimento em 720 dias"), 720);
});

test("exclui produtos incompatíveis e ordena elegíveis pela taxa", () => {
  const base = { issuer: "Banco A", type: "CDB", maturityDays: 365, minimumInvestment: 1000, liquidity: "VENCIMENTO", available: true };
  const products = [
    { ...base, id: "low", title: "CDB 105", rate: { value: 105, indexer: "CDI", label: "105% do CDI" } },
    { ...base, id: "high", title: "CDB 118", rate: { value: 118, indexer: "CDI", label: "118% do CDI" } },
    { ...base, id: "other", title: "Prefixado", rate: { value: 15, indexer: "PREFIXADO", label: "15% a.a." } }
  ];
  const ranked = core.rankProducts(products, { amount: 10000, indexer: "CDI" });
  assert.deepEqual(ranked.map((item) => item.id), ["high", "low", "other"]);
  assert.equal(ranked[2].eligible, false);
  assert.match(ranked[2].exclusionReasons.join(" "), /Indexador/);
});

test("respeita valor, prazo, liquidez e emissores excluídos", () => {
  const product = {
    id: "one", title: "CDB", issuer: "Banco Bloqueado", type: "CDB",
    rate: { value: 110, indexer: "CDI", label: "110% do CDI" },
    maturityDays: 900, minimumInvestment: 20000, liquidity: "VENCIMENTO", available: true
  };
  const result = core.evaluateProduct(product, { amount: 10000, maxMaturityDays: 365, liquidity: "DIARIA", excludedIssuers: "Banco Bloqueado" });
  assert.equal(result.eligible, false);
  assert.equal(result.exclusionReasons.length, 4);
});

let failures = 0;
for (const item of tests) {
  try {
    item.run();
    console.log(`✓ ${item.name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${item.name}`);
    console.error(error.stack || error);
  }
}
if (failures) process.exitCode = 1;
