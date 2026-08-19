(function () {
  "use strict";
  if (globalThis.__btgAssistantLoaded) return;
  globalThis.__btgAssistantLoaded = true;

  const core = globalThis.BTGInvestmentCore;
  const elementByProductId = new Map();
  const PANEL_ID = "btg-assistant-panel";

  function valueFrom(element, names) {
    for (const name of names) {
      const value = element.dataset && element.dataset[name];
      if (value !== undefined && value !== "") return value;
    }
    return null;
  }

  function parseProduct(element, index) {
    const text = core.normalizeText(element.innerText || element.textContent);
    const rate = core.parseRate(valueFrom(element, ["rate"]) || text);
    const minimumText = valueFrom(element, ["minimum", "minimumInvestment"]);
    const maturityText = valueFrom(element, ["maturityDays", "maturity"]);
    const titleNode = element.querySelector("[data-product-title], h1, h2, h3, h4, strong");
    const issuerMatch = text.match(/(?:emissor|institui(?:ç|c)[aã]o)\s*:?\s*([^|•]+?)(?=\s+(?:taxa|rentabilidade|vencimento|liquidez|investimento)|$)/i);
    const title = valueFrom(element, ["title", "productName"]) || core.normalizeText(titleNode && titleNode.textContent) || `Produto ${index + 1}`;
    const issuer = valueFrom(element, ["issuer"]) || (issuerMatch && core.normalizeText(issuerMatch[1])) || "Não identificado";
    const unavailable = /indispon[ií]vel|esgotado|encerrado/i.test(text) || valueFrom(element, ["available"]) === "false";

    return {
      id: `btg-product-${index}`,
      title,
      issuer,
      type: valueFrom(element, ["type"]) || core.identifyType(`${title} ${text}`),
      rate,
      maturityDays: maturityText ? Number(maturityText) : core.parseMaturityDays(text),
      minimumInvestment: minimumText ? core.parseBrazilianNumber(minimumText) : core.parseCurrency(text.match(/(?:mínim[oa]|a partir de)[^R]{0,20}R\$\s*[\d.,]+/i)?.[0] || ""),
      liquidity: valueFrom(element, ["liquidity"]) || core.identifyLiquidity(text),
      available: !unavailable
    };
  }

  function findProductElements() {
    const explicitSelectors = [
      "[data-investment-product]",
      "[data-product-card]",
      "[data-testid*='investment']",
      "[data-testid*='product-card']",
      ".investment-card",
      ".product-card"
    ];
    let candidates = Array.from(document.querySelectorAll(explicitSelectors.join(",")));

    if (!candidates.length) {
      candidates = Array.from(document.querySelectorAll("article, li, section, [role='listitem']")).filter((element) => {
        const text = core.normalizeText(element.innerText);
        return text.length < 1800 && /\b(CDB|LCI|LCA|CRI|CRA|deb[eê]nture|tesouro|fundo|ETF)\b/i.test(text) && /\d+(?:[.,]\d+)?\s*%/i.test(text);
      });
    }

    return candidates.filter((candidate, index, all) => !all.some((other, otherIndex) => otherIndex !== index && other.contains(candidate)));
  }

  function createNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatMoney(value) {
    if (value === null) return "Não identificado";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  function highlightProduct(productId) {
    document.querySelectorAll(".btg-assistant-highlight").forEach((element) => element.classList.remove("btg-assistant-highlight"));
    const target = elementByProductId.get(productId);
    if (!target) return;
    target.classList.add("btg-assistant-highlight");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function prepareProduct(product, amount) {
    highlightProduct(product.id);
    const target = elementByProductId.get(product.id);
    if (!target) return { filled: false, message: "O card do produto não está mais disponível." };
    const input = target.querySelector("input:not([type='hidden']):not([type='checkbox']):not([type='radio'])") ||
      Array.from(document.querySelectorAll("input:not([type='hidden'])")).find((candidate) => /valor|amount|invest/i.test(`${candidate.name} ${candidate.id} ${candidate.placeholder} ${candidate.getAttribute("aria-label")}`));
    if (!input) return { filled: false, message: "Produto destacado. O campo de valor não foi identificado; preencha-o manualmente." };

    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    const formatted = Number(amount || 0).toFixed(2).replace(".", ",");
    if (nativeSetter) nativeSetter.call(input, formatted); else input.value = formatted;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.focus();
    return { filled: true, message: "Valor preenchido. Revise todos os dados e confirme manualmente no portal." };
  }

  function renderPanel(products, preferences) {
    document.getElementById(PANEL_ID)?.remove();
    const panel = createNode("aside", "btg-assistant", undefined);
    panel.id = PANEL_ID;

    const header = createNode("header", "btg-assistant__header");
    const heading = createNode("div");
    heading.append(createNode("strong", "", "Assistente de investimentos"), createNode("small", "", "POC — confirmação sempre manual"));
    const close = createNode("button", "btg-assistant__close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Fechar painel");
    close.addEventListener("click", () => panel.remove());
    header.append(heading, close);
    panel.append(header);

    const eligible = products.filter((product) => product.eligible).length;
    panel.append(createNode("p", "btg-assistant__summary", `${products.length} produto(s) encontrado(s), ${eligible} elegível(is).`));

    if (!products.length) {
      panel.append(createNode("p", "btg-assistant__empty", "Nenhum card de investimento foi reconhecido nesta página. Será necessário calibrar os seletores com uma amostra do portal."));
    }

    const list = createNode("div", "btg-assistant__list");
    products.forEach((product, index) => {
      const item = createNode("article", `btg-assistant__item ${product.eligible ? "is-eligible" : "is-ineligible"}`);
      const title = createNode("div", "btg-assistant__title");
      title.append(createNode("span", "btg-assistant__rank", String(index + 1)), createNode("strong", "", product.title));
      item.append(title);
      item.append(createNode("p", "", `${product.rate.label} · ${product.type} · ${product.issuer}`));
      item.append(createNode("p", "btg-assistant__meta", `Mínimo: ${formatMoney(product.minimumInvestment)} · Vencimento: ${product.maturityDays === null ? "não identificado" : `${product.maturityDays} dias`} · Liquidez: ${product.liquidity}`));
      if (!product.eligible) item.append(createNode("p", "btg-assistant__reason", product.exclusionReasons.join("; ")));

      const actions = createNode("div", "btg-assistant__actions");
      const highlight = createNode("button", "", "Destacar");
      highlight.type = "button";
      highlight.addEventListener("click", () => highlightProduct(product.id));
      actions.append(highlight);
      if (product.eligible) {
        const prepare = createNode("button", "btg-assistant__primary", "Preparar aplicação");
        prepare.type = "button";
        prepare.addEventListener("click", () => {
          const result = prepareProduct(product, preferences.amount);
          const notice = panel.querySelector(".btg-assistant__notice");
          notice.textContent = result.message;
          notice.dataset.state = result.filled ? "success" : "warning";
        });
        actions.append(prepare);
      }
      item.append(actions);
      list.append(item);
    });
    panel.append(list, createNode("p", "btg-assistant__notice", "A extensão não clica em investir, confirmar ou aceitar."));
    document.documentElement.append(panel);
  }

  function analyze(preferences) {
    elementByProductId.clear();
    const elements = findProductElements();
    const parsed = elements.map(parseProduct);
    parsed.forEach((product, index) => elementByProductId.set(product.id, elements[index]));
    const ranked = core.rankProducts(parsed, preferences);
    renderPanel(ranked, preferences);
    return { total: ranked.length, eligible: ranked.filter((product) => product.eligible).length };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "BTG_ANALYZE") return;
    try {
      sendResponse({ ok: true, ...analyze(message.preferences || {}) });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
  });
})();
