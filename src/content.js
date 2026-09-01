(function () {
  "use strict";
  if (globalThis.__btgAssistantLoaded) return;
  globalThis.__btgAssistantLoaded = true;

  const core = globalThis.BTGInvestmentCore;
  const elementByProductId = new Map();
  const PANEL_ID = "btg-assistant-panel";
  const isSimulator = document.documentElement.dataset.btgSimulator === "true";
  const booster = {
    active: false,
    phase: "inactive",
    preferences: {},
    lockedProduct: null,
    message: "Booster inativo.",
    observer: null,
    scanTimer: null,
    watchdog: null,
    originalTitle: document.title
  };

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
      id: valueFrom(element, ["productId", "id"]) || `btg-product-${index}`,
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
      "[data-investment-product]", "[data-product-card]", "[data-testid*='investment']",
      "[data-testid*='product-card']", ".investment-card", ".product-card"
    ];
    let candidates = Array.from(document.querySelectorAll(explicitSelectors.join(",")));
    if (!candidates.length) {
      candidates = Array.from(document.querySelectorAll("article, li, section, [role='listitem']")).filter((element) => {
        if (element.closest(`#${PANEL_ID}`)) return false;
        const text = core.normalizeText(element.innerText);
        return text.length < 1800 && /\b(CDB|LCI|LCA|CRI|CRA|deb[eê]nture|tesouro|fundo|ETF)\b/i.test(text) && /\d+(?:[.,]\d+)?\s*%/i.test(text);
      });
    }
    return candidates.filter((candidate, index, all) => !all.some((other, otherIndex) => otherIndex !== index && other.contains(candidate)));
  }

  function readProducts(preferences) {
    elementByProductId.clear();
    const elements = findProductElements();
    const parsed = elements.map(parseProduct);
    parsed.forEach((product, index) => elementByProductId.set(product.id, elements[index]));
    return core.rankProducts(parsed, preferences || {});
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

  function setNativeValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value); else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function prepareProduct(product, amount) {
    highlightProduct(product.id);
    const target = elementByProductId.get(product.id);
    if (!target || !target.isConnected) return { filled: false, message: "O card do produto não está mais disponível." };
    const input = target.querySelector("input:not([type='hidden']):not([type='checkbox']):not([type='radio'])") ||
      Array.from(document.querySelectorAll("input:not([type='hidden'])")).find((candidate) => /valor|amount|invest/i.test(`${candidate.name} ${candidate.id} ${candidate.placeholder} ${candidate.getAttribute("aria-label")}`));
    if (!input) return { filled: false, message: "O campo de valor não foi identificado." };
    setNativeValue(input, Number(amount || 0).toFixed(2).replace(".", ","));
    return { filled: true, message: "Valor preenchido e pronto para avançar.", target };
  }

  function findAdvanceButton(target) {
    const explicit = target.querySelector("[data-action='select-product'], [data-btg-action='apply'], [data-btg-action='continue']");
    if (explicit) return explicit;
    return Array.from(target.querySelectorAll("button, [role='button'], a")).find((candidate) => {
      const label = core.normalizeText(candidate.innerText || candidate.getAttribute("aria-label"));
      return /^(continuar|aplicar|investir|ver oferta|selecionar)$/i.test(label) && !candidate.disabled;
    });
  }

  function termValue(label) {
    const terms = Array.from(document.querySelectorAll("dt"));
    const term = terms.find((element) => core.normalizeText(element.textContent).toLocaleLowerCase("pt-BR").includes(label));
    return core.normalizeText(term?.parentElement?.querySelector("dd")?.textContent);
  }

  function reviewSnapshot() {
    const text = core.normalizeText(document.body.innerText);
    const rateText = termValue("rentabilidade") || text;
    return {
      text,
      rate: core.parseRate(rateText),
      title: termValue("produto"),
      issuer: termValue("emissor"),
      amount: core.parseCurrency(termValue("valor"))
    };
  }

  function validateReview() {
    const locked = booster.lockedProduct;
    if (!locked) return { ok: false, reason: "Não existe oportunidade bloqueada para revalidar." };
    const snapshot = reviewSnapshot();
    if (snapshot.title && !snapshot.title.includes(locked.title)) return { ok: false, reason: "O produto exibido na revisão é diferente do selecionado." };
    if (snapshot.issuer && locked.issuer !== "Não identificado" && !snapshot.issuer.includes(locked.issuer)) return { ok: false, reason: "O emissor mudou antes da confirmação." };
    if (snapshot.amount !== null && Math.abs(snapshot.amount - Number(booster.preferences.amount)) > 0.009) return { ok: false, reason: "O valor da revisão é diferente do configurado." };
    if (snapshot.rate.value === null || snapshot.rate.indexer !== locked.rate.indexer) return { ok: false, reason: "Não foi possível confirmar a taxa e o indexador na revisão." };
    const tolerance = Number(booster.preferences.maxRateDrop || 0);
    if (snapshot.rate.value < locked.rate.value - tolerance) return { ok: false, reason: `A taxa caiu de ${locked.rate.label} para ${snapshot.rate.label}.` };
    return { ok: true, snapshot };
  }

  function hasConfirmationChallenge() {
    return Boolean(document.querySelector(".token-digit, #challenge-code, input[autocomplete='one-time-code'], [data-security-token]"));
  }

  function hasReviewPage() {
    return Boolean(document.querySelector("[data-action='go-challenge'], [data-btg-step='review']")) || /revise sua aplica[cç][aã]o/i.test(document.body.innerText);
  }

  function setBoosterStatus(phase, message, state) {
    booster.phase = phase;
    booster.message = message;
    renderBoosterPanel(state);
  }

  function renderBoosterPanel(state) {
    document.getElementById(PANEL_ID)?.remove();
    const panel = createNode("aside", "btg-assistant btg-assistant--booster");
    panel.id = PANEL_ID;
    const header = createNode("header", "btg-assistant__header");
    const heading = createNode("div");
    heading.append(createNode("strong", "", "Booster de oportunidades"), createNode("small", "", booster.active ? "MONITORAMENTO ATIVO" : booster.phase === "waiting_confirmation" ? "AÇÃO HUMANA NECESSÁRIA" : "MONITORAMENTO INTERROMPIDO"));
    const indicator = createNode("span", `btg-assistant__pulse ${booster.active ? "is-active" : ""}`);
    header.append(heading, indicator);
    panel.append(header);

    const status = createNode("div", "btg-assistant__booster-status");
    status.dataset.state = state || (booster.active ? "active" : "warning");
    status.append(createNode("strong", "", booster.phase.replaceAll("_", " ")), createNode("p", "", booster.message));
    panel.append(status);
    if (booster.lockedProduct) {
      panel.append(createNode("p", "btg-assistant__locked", `${booster.lockedProduct.title} · ${booster.lockedProduct.rate.label} · ${formatMoney(Number(booster.preferences.amount))}`));
    }
    if (booster.active) {
      const stop = createNode("button", "btg-assistant__stop", "Interromper booster");
      stop.type = "button";
      stop.addEventListener("click", () => stopBooster("Booster interrompido pelo usuário."));
      panel.append(stop);
    }
    document.documentElement.append(panel);
  }

  function renderAnalysisPanel(products, preferences) {
    document.getElementById(PANEL_ID)?.remove();
    const panel = createNode("aside", "btg-assistant");
    panel.id = PANEL_ID;
    const header = createNode("header", "btg-assistant__header");
    const heading = createNode("div");
    heading.append(createNode("strong", "", "Análise de investimentos"), createNode("small", "", "Modo manual"));
    const close = createNode("button", "btg-assistant__close", "×");
    close.type = "button";
    close.addEventListener("click", () => panel.remove());
    header.append(heading, close);
    panel.append(header);
    panel.append(createNode("p", "btg-assistant__summary", `${products.length} produto(s), ${products.filter((product) => product.eligible).length} elegível(is).`));
    const list = createNode("div", "btg-assistant__list");
    products.forEach((product, index) => {
      const item = createNode("article", `btg-assistant__item ${product.eligible ? "is-eligible" : "is-ineligible"}`);
      const title = createNode("div", "btg-assistant__title");
      title.append(createNode("span", "btg-assistant__rank", String(index + 1)), createNode("strong", "", product.title));
      item.append(title, createNode("p", "", `${product.rate.label} · ${product.type} · ${product.issuer}`));
      if (!product.eligible) item.append(createNode("p", "btg-assistant__reason", product.exclusionReasons.join("; ")));
      if (product.eligible) {
        const prepare = createNode("button", "btg-assistant__primary", "Somente preencher");
        prepare.type = "button";
        prepare.addEventListener("click", () => prepareProduct(product, preferences.amount));
        item.append(prepare);
      }
      list.append(item);
    });
    panel.append(list);
    document.documentElement.append(panel);
  }

  function scheduleScan(delay) {
    if (!booster.active) return;
    window.clearTimeout(booster.scanTimer);
    booster.scanTimer = window.setTimeout(processBooster, delay ?? Number(booster.preferences.scanInterval || 250));
  }

  function stopBooster(message, phase, state) {
    booster.active = false;
    window.clearTimeout(booster.scanTimer);
    window.clearTimeout(booster.watchdog);
    booster.observer?.disconnect();
    booster.observer = null;
    if (phase !== "waiting_confirmation") document.title = booster.originalTitle;
    setBoosterStatus(phase || "stopped", message || "Booster interrompido.", state || "warning");
  }

  function notifyConfirmation() {
    booster.active = false;
    booster.observer?.disconnect();
    booster.observer = null;
    document.title = "⚡ CONFIRME A OPORTUNIDADE — " + booster.originalTitle;
    navigator.vibrate?.([180, 80, 180]);
    setBoosterStatus("waiting_confirmation", "Oportunidade preparada. Digite o token e confirme manualmente.", "success");
  }

  function handleReview() {
    setBoosterStatus("revalidating", "Revalidando produto, emissor, taxa e valor…");
    const validation = validateReview();
    if (!validation.ok) {
      stopBooster(validation.reason, "review_blocked", "error");
      return;
    }

    const advance = document.querySelector("[data-action='go-challenge'], [data-btg-action='continue-review']");
    if (!advance || advance.disabled) {
      stopBooster("A revisão exige uma ação que não foi reconhecida ou está bloqueada.", "manual_review", "warning");
      return;
    }
    if (!isSimulator) {
      stopBooster("Dados revalidados. Revise eventuais aceites e avance manualmente.", "manual_review", "warning");
      return;
    }

    document.querySelectorAll("#terms, #risk, [data-demo-consent]").forEach((checkbox) => {
      if (!checkbox.checked) checkbox.click();
    });
    setBoosterStatus("advancing_review", "Dados revalidados. Avançando até o token fictício…");
    advance.click();
    scheduleScan(20);
  }

  function selectOpportunity(products) {
    const best = products.find((product) => product.eligible);
    if (!best) {
      setBoosterStatus("monitoring", products.length ? "Nenhuma oportunidade atende aos critérios. Aguardando atualização…" : "Aguardando produtos aparecerem na página…");
      return;
    }
    booster.lockedProduct = { ...best, rate: { ...best.rate } };
    setBoosterStatus("opportunity_found", `${best.title} atende aos critérios. Preparando aplicação…`, "success");
    const result = prepareProduct(best, booster.preferences.amount);
    if (!result.filled) {
      stopBooster(result.message, "preparation_failed", "error");
      return;
    }

    const refreshed = parseProduct(result.target, 0);
    const stillEligible = core.evaluateProduct(refreshed, booster.preferences);
    if (!stillEligible.eligible || refreshed.title !== best.title || refreshed.rate.value !== best.rate.value) {
      stopBooster("A oportunidade mudou durante o preenchimento e foi bloqueada.", "opportunity_changed", "error");
      return;
    }
    const advance = findAdvanceButton(result.target);
    if (!advance || advance.disabled) {
      stopBooster("Valor preenchido, mas o botão para avançar não foi reconhecido.", "manual_advance", "warning");
      return;
    }
    setBoosterStatus("advancing", "Produto selecionado e valor preenchido. Avançando para revisão…", "success");
    advance.click();
    window.clearTimeout(booster.watchdog);
    booster.watchdog = window.setTimeout(() => {
      if (!booster.active) return;
      if (hasConfirmationChallenge() || hasReviewPage()) scheduleScan(0);
      else if (findProductElements().length) stopBooster("O portal não avançou. Verifique saldo, estoque ou mensagens exibidas.", "advance_failed", "error");
    }, 1400);
  }

  function processBooster() {
    if (!booster.active) return;
    try {
      if (hasConfirmationChallenge()) { notifyConfirmation(); return; }
      if (hasReviewPage()) { handleReview(); return; }
      if (booster.phase === "advancing" || booster.phase === "advancing_review") return;
      selectOpportunity(readProducts(booster.preferences));
    } catch (error) {
      stopBooster(error.message || "Falha inesperada no booster.", "error", "error");
    }
  }

  function startBooster(preferences) {
    if (booster.active) stopBooster("Reiniciando o monitoramento.");
    Object.assign(booster, {
      active: true,
      phase: "monitoring",
      preferences: { ...preferences },
      lockedProduct: null,
      message: "Monitorando oportunidades compatíveis…",
      originalTitle: document.title.replace(/^⚡ CONFIRME A OPORTUNIDADE — /, "")
    });
    document.title = booster.originalTitle;
    booster.observer = new MutationObserver(() => scheduleScan());
    booster.observer.observe(document.documentElement, { childList: true, subtree: true });
    renderBoosterPanel("active");
    scheduleScan(0);
    return boosterStatus();
  }

  function boosterStatus() {
    return {
      active: booster.active,
      phase: booster.phase,
      message: booster.message,
      lockedProduct: booster.lockedProduct?.title || null
    };
  }

  function analyze(preferences) {
    const ranked = readProducts(preferences);
    renderAnalysisPanel(ranked, preferences);
    return { total: ranked.length, eligible: ranked.filter((product) => product.eligible).length };
  }

  function handleMessage(message, sendResponse) {
    try {
      if (message?.type === "BTG_ANALYZE") sendResponse({ ok: true, ...analyze(message.preferences || {}) });
      if (message?.type === "BTG_BOOSTER_START") sendResponse({ ok: true, ...startBooster(message.preferences || {}) });
      if (message?.type === "BTG_BOOSTER_STOP") { stopBooster("Booster interrompido pelo usuário."); sendResponse({ ok: true, ...boosterStatus() }); }
      if (message?.type === "BTG_BOOSTER_STATUS") sendResponse({ ok: true, ...boosterStatus() });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
  }

  if (globalThis.chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => handleMessage(message, sendResponse));
  }
  globalThis.BTGBoosterPOC = { start: startBooster, stop: stopBooster, status: boosterStatus, analyze };
})();
