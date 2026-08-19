(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BTGInvestmentCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const INDEXERS = {
    CDI: "CDI",
    IPCA: "IPCA+",
    PREFIXADO: "PREFIXADO",
    DESCONHECIDO: "DESCONHECIDO"
  };

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function parseBrazilianNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    let normalized = String(value).replace(/[^\d,.-]/g, "");
    if (!normalized) return null;
    if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", ".");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function parseCurrency(text) {
    const source = normalizeText(text);
    const match = source.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/i);
    return match ? parseBrazilianNumber(match[1]) : null;
  }

  function parseRate(text) {
    const source = normalizeText(text);
    let match = source.match(/IPCA\s*\+\s*(\d+(?:[.,]\d+)?)\s*%?/i);
    if (match) return { value: parseBrazilianNumber(match[1]), indexer: INDEXERS.IPCA, label: match[0] };

    match = source.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:do\s*)?CDI/i);
    if (match) return { value: parseBrazilianNumber(match[1]), indexer: INDEXERS.CDI, label: match[0] };

    match = source.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:a\.?\s*a\.?|ao ano)/i);
    if (match) return { value: parseBrazilianNumber(match[1]), indexer: INDEXERS.PREFIXADO, label: match[0] };

    match = source.match(/(\d+(?:[.,]\d+)?)\s*%/i);
    if (match) return { value: parseBrazilianNumber(match[1]), indexer: INDEXERS.DESCONHECIDO, label: match[0] };
    return { value: null, indexer: INDEXERS.DESCONHECIDO, label: "Taxa não identificada" };
  }

  function parseMaturityDays(text, now) {
    const source = normalizeText(text);
    const direct = source.match(/(?:vencimento[^\d]{0,15})?(\d+)\s*dias?/i);
    if (direct) return Number(direct[1]);

    const date = source.match(/(?:vencimento|vence(?:\s+em)?)[^\d]{0,15}(\d{2})\/(\d{2})\/(\d{4})/i);
    if (!date) return null;
    const end = new Date(Date.UTC(Number(date[3]), Number(date[2]) - 1, Number(date[1])));
    const startValue = now ? new Date(now) : new Date();
    const start = new Date(Date.UTC(startValue.getUTCFullYear(), startValue.getUTCMonth(), startValue.getUTCDate()));
    return Math.max(0, Math.ceil((end - start) / 86400000));
  }

  function identifyType(text) {
    const source = normalizeText(text).toUpperCase();
    return ["CDB", "LCI", "LCA", "CRI", "CRA", "DEBÊNTURE", "TESOURO", "FUNDO", "ETF"].find((type) => source.includes(type)) || "OUTRO";
  }

  function identifyLiquidity(text) {
    const source = normalizeText(text);
    if (/liquidez\s+di[aá]ria|resgate\s+di[aá]rio/i.test(source)) return "DIARIA";
    if (/no\s+vencimento|liquidez[^.]{0,20}vencimento/i.test(source)) return "VENCIMENTO";
    return "NAO_INFORMADA";
  }

  function evaluateProduct(product, preferences) {
    const prefs = preferences || {};
    const reasons = [];
    const excludedIssuers = String(prefs.excludedIssuers || "")
      .split(",")
      .map((item) => item.trim().toLocaleLowerCase("pt-BR"))
      .filter(Boolean);

    if (!product.available) reasons.push("Produto indisponível");
    if (Number(prefs.amount) > 0 && product.minimumInvestment !== null && product.minimumInvestment > Number(prefs.amount)) {
      reasons.push("Investimento mínimo acima do valor disponível");
    }
    if (Number(prefs.maxMaturityDays) > 0 && product.maturityDays !== null && product.maturityDays > Number(prefs.maxMaturityDays)) {
      reasons.push("Vencimento acima do limite");
    }
    if (Number(prefs.minRate) > 0 && product.rate.value !== null && product.rate.value < Number(prefs.minRate)) {
      reasons.push("Taxa abaixo do mínimo");
    }
    if (prefs.indexer && prefs.indexer !== "QUALQUER" && product.rate.indexer !== prefs.indexer) {
      reasons.push("Indexador diferente do selecionado");
    }
    if (prefs.liquidity === "DIARIA" && product.liquidity !== "DIARIA") {
      reasons.push("Sem liquidez diária identificada");
    }
    if (prefs.productType && prefs.productType !== "QUALQUER" && product.type !== prefs.productType) {
      reasons.push("Tipo de produto diferente do selecionado");
    }
    if (excludedIssuers.some((issuer) => product.issuer.toLocaleLowerCase("pt-BR").includes(issuer))) {
      reasons.push("Emissor excluído");
    }

    const rateScore = product.rate.value === null ? -100000 : product.rate.value * 1000;
    const liquidityScore = product.liquidity === "DIARIA" ? 100 : 0;
    const maturityScore = product.maturityDays === null ? 0 : Math.max(0, 50 - product.maturityDays / 365);
    return {
      ...product,
      eligible: reasons.length === 0,
      exclusionReasons: reasons,
      score: rateScore + liquidityScore + maturityScore
    };
  }

  function rankProducts(products, preferences) {
    return products
      .map((product) => evaluateProduct(product, preferences))
      .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.title.localeCompare(b.title));
  }

  return {
    INDEXERS,
    normalizeText,
    parseBrazilianNumber,
    parseCurrency,
    parseRate,
    parseMaturityDays,
    identifyType,
    identifyLiquidity,
    evaluateProduct,
    rankProducts
  };
});
