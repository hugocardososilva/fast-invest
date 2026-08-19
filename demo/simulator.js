(function () {
  "use strict";

  const PRODUCTS = [
    { id: "horizonte", title: "CDB Banco Horizonte", issuer: "Banco Horizonte", type: "CDB", rate: 118, rateLabel: "118% do CDI", maturityDays: 720, minimum: 1000, liquidity: "VENCIMENTO", available: true },
    { id: "aurora", title: "CDB Banco Aurora", issuer: "Banco Aurora", type: "CDB", rate: 112.5, rateLabel: "112,5% do CDI", maturityDays: 365, minimum: 500, liquidity: "DIARIA", available: true },
    { id: "litoral", title: "LCI Banco Litoral", issuer: "Banco Litoral", type: "LCI", rate: 96, rateLabel: "96% do CDI", maturityDays: 270, minimum: 20000, liquidity: "VENCIMENTO", available: true },
    { id: "atlantico", title: "CDB Prefixado Atlântico", issuer: "Banco Atlântico", type: "CDB", rate: 14.2, rateLabel: "14,2% a.a.", maturityDays: 540, minimum: 1000, liquidity: "VENCIMENTO", available: true }
  ];

  const state = {
    route: "login", balance: 50000, scenario: "success", selectedId: null,
    amount: 0, acceptedTerms: false, acceptedRisk: false, error: "",
    processing: false, receipt: null
  };
  const app = document.getElementById("app");

  function money(value) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  function escapeHtml(value) {
    const characters = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };
    return String(value).replace(/[&<>'"]/g, (character) => characters[character]);
  }

  function selectedProduct() {
    return PRODUCTS.find((item) => item.id === state.selectedId);
  }

  function shell(content) {
    return `
      <header class="shell-header">
        <div class="brand"><span class="brand-mark">POC</span><span>Portal de Investimentos</span><span class="sim-badge">Simulação</span></div>
        <div class="shell-user"><span>Cliente Demonstração · Conta fictícia 0001</span><button type="button" data-action="logout">Sair</button></div>
      </header>
      <main class="container">${content}</main>`;
  }

  function steps(active) {
    const labels = ["Escolha", "Revisão", "Segurança", "Conclusão"];
    return `<ol class="steps">${labels.map((label, index) => `<li class="${index < active ? "done" : index === active ? "active" : ""}">${label}</li>`).join("")}</ol>`;
  }

  function loginView() {
    return `
      <main class="login-page">
        <section class="login-hero">
          <span class="sim-badge">Ambiente totalmente fictício</span>
          <h1>Valide o conceito sem movimentar dinheiro.</h1>
          <p>Este portal reproduz as etapas de uma aplicação para testar a extensão, regras, mensagens e limites de segurança.</p>
        </section>
        <section class="login-panel">
          <form class="login-card" data-form="login">
            <h2>Acesso ao simulador</h2><p>Nenhuma credencial real deve ser informada.</p>
            <label class="field">Usuário fictício<input value="cliente.demo" readonly></label>
            <label class="field">Ambiente<select><option>Conta individual simulada</option></select></label>
            <button class="button primary full" type="submit">Entrar no ambiente fictício</button>
            <div class="disclaimer">Não use senha, CPF, conta ou qualquer dado real nesta demonstração.</div>
          </form>
        </section>
      </main>`;
  }

  function dashboardView() {
    return shell(`
      <div class="page-heading">
        <div><h1>Olá, Cliente Demonstração</h1><p>Escolha uma área para iniciar.</p></div>
        <div class="balance-card"><small>Saldo fictício disponível</small><strong>${money(state.balance)}</strong></div>
      </div>
      <section class="dashboard-grid">
        <article class="dashboard-card"><h2>Investimentos</h2><p>Consulte produtos de renda fixa e realize uma aplicação simulada.</p><button class="button primary" data-action="open-investments">Ver oportunidades</button></article>
        <article class="dashboard-card"><h2>Carteira</h2><p>Posições ilustrativas para uma futura etapa da POC.</p><button class="button" disabled>Em breve</button></article>
        <article class="dashboard-card"><h2>Histórico</h2><p>Comprovantes e eventos gerados apenas durante a simulação.</p><button class="button" disabled>Em breve</button></article>
      </section>`);
  }

  function effectiveProduct(item) {
    if (state.scenario === "unavailable" && item.id === "horizonte") return { ...item, available: false };
    return item;
  }

  function productCard(item) {
    const current = effectiveProduct(item);
    return `
      <article class="product-card ${current.available ? "" : "is-unavailable"}"
        data-investment-product data-product-id="${current.id}" data-title="${escapeHtml(current.title)}"
        data-issuer="${escapeHtml(current.issuer)}" data-type="${current.type}" data-rate="${current.rateLabel}"
        data-maturity-days="${current.maturityDays}" data-minimum="${current.minimum}"
        data-liquidity="${current.liquidity}" data-available="${current.available}">
        <span class="product-tag">${current.type}</span>
        <h2 data-product-title>${escapeHtml(current.title)}</h2><p class="issuer">Emissor: ${escapeHtml(current.issuer)}</p>
        <dl>
          <div><dt>Rentabilidade</dt><dd>${current.rateLabel}</dd></div><div><dt>Vencimento</dt><dd>${current.maturityDays} dias</dd></div>
          <div><dt>Investimento mínimo</dt><dd>${money(current.minimum)}</dd></div><div><dt>Liquidez</dt><dd>${current.liquidity === "DIARIA" ? "Liquidez diária" : "No vencimento"}</dd></div>
        </dl>
        <label class="field">Valor da aplicação<input name="investmentAmount" inputmode="decimal" placeholder="R$ 0,00" ${current.available ? "" : "disabled"}></label>
        <button class="button primary" type="button" data-action="select-product" data-product-id="${current.id}" ${current.available ? "" : "disabled"}>Continuar</button>
      </article>`;
  }

  function investmentsView() {
    return shell(`
      ${steps(0)}
      <div class="page-heading">
        <div><h1>Renda fixa</h1><p>Use a extensão para ler, filtrar e preparar uma aplicação.</p></div>
        <div class="balance-card"><small>Saldo fictício disponível</small><strong>${money(state.balance)}</strong></div>
      </div>
      <section class="toolbar">
        <label class="field">Cenário de teste<select id="scenario">
          <option value="success" ${state.scenario === "success" ? "selected" : ""}>Fluxo concluído com sucesso</option>
          <option value="rate-change" ${state.scenario === "rate-change" ? "selected" : ""}>Taxa muda antes da revisão</option>
          <option value="unavailable" ${state.scenario === "unavailable" ? "selected" : ""}>Produto fica indisponível</option>
          <option value="insufficient" ${state.scenario === "insufficient" ? "selected" : ""}>Saldo insuficiente</option>
          <option value="failure" ${state.scenario === "failure" ? "selected" : ""}>Falha no processamento</option>
        </select></label>
        <p class="toolbar-note">O cenário é aplicado ao avançar. Para testar indisponibilidade, use o primeiro produto.</p>
        <button class="button" data-action="dashboard">Voltar</button>
      </section>
      <section class="products">${PRODUCTS.map(productCard).join("")}</section>`);
  }

  function reviewView() {
    const selected = selectedProduct();
    const changedRate = state.scenario === "rate-change" ? selected.rate - 3 : selected.rate;
    const changedRateLabel = state.scenario === "rate-change" ? `${String(changedRate).replace(".", ",")}% do CDI` : selected.rateLabel;
    return shell(`
      ${steps(1)}
      <section class="flow-card">
        <h1>Revise sua aplicação</h1><p>Nenhum valor foi movimentado. Confira cada informação antes de prosseguir.</p>
        ${state.scenario === "rate-change" ? `<div class="alert error"><strong>A taxa mudou.</strong> A oportunidade passou de ${selected.rateLabel} para ${changedRateLabel}. Volte e reavalie o produto.</div>` : ""}
        ${state.error ? `<div class="alert error">${escapeHtml(state.error)}</div>` : ""}
        <dl class="summary-list">
          <div><dt>Produto</dt><dd>${escapeHtml(selected.title)}</dd></div><div><dt>Emissor</dt><dd>${escapeHtml(selected.issuer)}</dd></div>
          <div><dt>Rentabilidade atual</dt><dd>${changedRateLabel}</dd></div><div><dt>Valor</dt><dd>${money(state.amount)}</dd></div>
          <div><dt>Vencimento</dt><dd>${selected.maturityDays} dias</dd></div><div><dt>Liquidez</dt><dd>${selected.liquidity === "DIARIA" ? "Diária" : "No vencimento"}</dd></div>
        </dl>
        <label class="checkbox"><input id="terms" type="checkbox" ${state.acceptedTerms ? "checked" : ""}> <span>Li e aceito os termos fictícios desta simulação.</span></label>
        <label class="checkbox"><input id="risk" type="checkbox" ${state.acceptedRisk ? "checked" : ""}> <span>Estou ciente do risco, prazo e condições de liquidez apresentados.</span></label>
        <div class="button-row"><button class="button" data-action="back-products">Voltar aos produtos</button><button class="button primary" data-action="go-challenge" ${state.scenario === "rate-change" ? "disabled" : ""}>Prosseguir para segurança</button></div>
      </section>`);
  }

  function challengeView() {
    const selected = selectedProduct();
    return shell(`
      ${steps(2)}
      <section class="flow-card">
        <h1>Confirmação humana obrigatória</h1><p>A extensão deve parar antes desta etapa. Neste simulador, o código representa token, biometria ou outro desafio antifraude.</p>
        ${state.error ? `<div class="alert error">${escapeHtml(state.error)}</div>` : ""}
        <div class="alert"><strong>Aplicação fictícia:</strong> ${money(state.amount)} em ${escapeHtml(selected.title)}.</div>
        <form class="challenge" data-form="challenge">
          <label class="field">Código de demonstração<input id="challenge-code" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="000000"></label>
          <p class="challenge-hint">Para testar, utilize <strong>123456</strong>.</p>
          <button class="button primary full" type="submit" ${state.processing ? "disabled" : ""}>${state.processing ? "Processando…" : "Confirmar aplicação simulada"}</button>
        </form>
        <div class="button-row"><button class="button" data-action="back-review">Voltar à revisão</button></div>
      </section>`);
  }

  function successView() {
    const selected = selectedProduct();
    return shell(`
      ${steps(3)}
      <section class="flow-card receipt">
        <div class="success-icon">✓</div><h1>Simulação concluída</h1><p>A jornada foi finalizada sem movimentar dinheiro nem acessar qualquer serviço externo.</p>
        <div class="alert success">A proteção contra duplo envio permaneceu ativa durante o processamento.</div>
        <dl class="summary-list">
          <div><dt>Produto</dt><dd>${escapeHtml(selected.title)}</dd></div><div><dt>Valor fictício</dt><dd>${money(state.amount)}</dd></div>
          <div><dt>Data</dt><dd>${escapeHtml(state.receipt.date)}</dd></div><div><dt>Status</dt><dd>Simulado com sucesso</dd></div>
        </dl>
        <p class="receipt-code">Protocolo: ${escapeHtml(state.receipt.code)}</p>
        <div class="button-row"><button class="button primary" data-action="new-simulation">Iniciar nova simulação</button></div>
      </section>`);
  }

  function render() {
    const views = { login: loginView, dashboard: dashboardView, investments: investmentsView, review: reviewView, challenge: challengeView, success: successView };
    app.innerHTML = views[state.route]();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function toast(message) {
    document.querySelector(".toast")?.remove();
    const element = document.createElement("div");
    element.className = "toast";
    element.textContent = message;
    document.body.append(element);
    window.setTimeout(() => element.remove(), 3500);
  }

  function parseAmount(raw) {
    let normalized = String(raw || "").replace(/[^\d,.-]/g, "");
    if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : 0;
  }

  app.addEventListener("change", (event) => {
    if (event.target.id === "scenario") { state.scenario = event.target.value; render(); }
    if (event.target.id === "terms") state.acceptedTerms = event.target.checked;
    if (event.target.id === "risk") state.acceptedRisk = event.target.checked;
  });

  app.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.target.dataset.form === "login") { state.route = "dashboard"; render(); return; }
    if (event.target.dataset.form !== "challenge" || state.processing) return;

    const code = document.getElementById("challenge-code").value;
    if (code !== "123456") {
      state.error = "Código inválido. Use 123456 para concluir a demonstração.";
      render();
      return;
    }
    state.processing = true;
    state.error = "";
    render();
    window.setTimeout(() => {
      state.processing = false;
      if (state.scenario === "failure") {
        state.error = "O processamento simulado falhou. Nenhuma aplicação foi registrada; tente novamente.";
        render();
        return;
      }
      state.receipt = {
        code: `SIM-${Date.now().toString().slice(-8)}`,
        date: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date())
      };
      state.route = "success";
      render();
    }, 900);
  });

  app.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === "logout") { state.route = "login"; render(); }
    if (action === "open-investments") { state.route = "investments"; render(); }
    if (action === "dashboard") { state.route = "dashboard"; render(); }
    if (action === "back-products") { state.error = ""; state.route = "investments"; render(); }
    if (action === "back-review") { state.error = ""; state.route = "review"; render(); }
    if (action === "new-simulation") {
      Object.assign(state, { route: "investments", selectedId: null, amount: 0, acceptedTerms: false, acceptedRisk: false, error: "", receipt: null, processing: false });
      render();
    }
    if (action === "select-product") {
      const selected = effectiveProduct(PRODUCTS.find((item) => item.id === button.dataset.productId));
      const card = button.closest("[data-investment-product]");
      const amount = parseAmount(card.querySelector("input[name='investmentAmount']").value);
      if (!selected.available) { toast("O produto ficou indisponível. Atualize sua seleção."); return; }
      if (!amount || amount < selected.minimum) { toast(`Informe pelo menos ${money(selected.minimum)}.`); return; }
      if (state.scenario === "insufficient" || amount > state.balance) { toast("Saldo fictício insuficiente para esta aplicação."); return; }
      Object.assign(state, { selectedId: selected.id, amount, error: "", route: "review" });
      render();
    }
    if (action === "go-challenge") {
      state.acceptedTerms = document.getElementById("terms").checked;
      state.acceptedRisk = document.getElementById("risk").checked;
      if (!state.acceptedTerms || !state.acceptedRisk) { state.error = "Aceite os dois itens para prosseguir."; render(); return; }
      state.error = "";
      state.route = "challenge";
      render();
    }
  });

  render();
})();
