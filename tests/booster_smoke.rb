# frozen_string_literal: true

require "eventmachine"
require "faye/websocket"
require "json"
require "net/http"

debug_port = Integer(ENV.fetch("BTG_CHROME_DEBUG_PORT", "9223"))
targets = JSON.parse(Net::HTTP.get(URI("http://127.0.0.1:#{debug_port}/json")))
page = targets.find { |target| target["url"].include?("/demo/investments.html") }
abort "Página do simulador não encontrada no Chrome" unless page

core_source = File.read(File.expand_path("../src/core.js", __dir__))
content_source = File.read(File.expand_path("../src/content.js", __dir__))

script = <<~JAVASCRIPT
  (async () => {
    const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const click = async (selector) => {
      const element = document.querySelector(selector);
      assert(element, `Elemento ausente: ${selector}`);
      element.click();
      await wait();
    };
    const waitFor = async (check, message, timeout = 3000) => {
      const started = Date.now();
      while (!check()) {
        if (Date.now() - started > timeout) throw new Error(message);
        await wait();
      }
    };

    if (!document.querySelector('[data-form="login"]')) {
      document.querySelector('[data-action="logout"]')?.click();
      await wait();
    }
    await click('[data-form="login"] button');
    await click('[data-action="open-investments"]');

    (0, eval)(#{JSON.generate(core_source)});
    (0, eval)(#{JSON.generate(content_source)});
    assert(window.BTGBoosterPOC, 'API do booster não foi carregada');

    const preferences = {
      amount: '10000', productType: 'CDB', indexer: 'CDI', minRate: '110',
      maxMaturityDays: '800', maxRateDrop: '0', scanInterval: '50',
      liquidity: 'QUALQUER', excludedIssuers: ''
    };
    window.BTGBoosterPOC.start(preferences);
    await waitFor(() => document.querySelectorAll('.token-digit').length === 6 && window.BTGBoosterPOC.status().phase === 'waiting_confirmation', 'Booster não chegou automaticamente ao token');
    const status = window.BTGBoosterPOC.status();
    assert(status.phase === 'waiting_confirmation', 'Booster não parou na confirmação humana');
    assert(status.lockedProduct === 'CDB Banco Horizonte', 'Booster não escolheu a melhor oportunidade');
    assert(document.title.includes('CONFIRME A OPORTUNIDADE'), 'Alerta no título não foi acionado');

    document.querySelectorAll('.token-digit').forEach((input, index) => { input.value = '123456'[index]; });
    document.querySelector('[data-form="challenge"]').requestSubmit();
    await waitFor(() => document.body.innerText.includes('Simulação concluída'), 'Confirmação manual não concluiu o fluxo');

    await click('[data-action="new-simulation"]');
    const scenario = document.querySelector('#scenario');
    scenario.value = 'rate-change';
    scenario.dispatchEvent(new Event('change', { bubbles: true }));
    await wait();
    window.BTGBoosterPOC.start(preferences);
    await waitFor(() => window.BTGBoosterPOC.status().phase === 'review_blocked', 'Queda da taxa não interrompeu o booster');
    assert(document.body.innerText.includes('A taxa mudou'), 'Portal não exibiu a mudança da taxa');

    await click('[data-action="back-products"]');
    const unavailableScenario = document.querySelector('#scenario');
    unavailableScenario.value = 'unavailable';
    unavailableScenario.dispatchEvent(new Event('change', { bubbles: true }));
    await wait();
    window.BTGBoosterPOC.start(preferences);
    await waitFor(() => window.BTGBoosterPOC.status().phase === 'waiting_confirmation', 'Booster não contornou o produto indisponível');
    assert(window.BTGBoosterPOC.status().lockedProduct === 'CDB Banco Aurora', 'Booster não escolheu a próxima oportunidade disponível');

    return {
      ok: true, selectedBest: true, filled: true, autoAdvanced: true,
      stoppedAtToken: true, manualConfirmation: true,
      rateDropBlocked: true, unavailableSkipped: true
    };
  })()
JAVASCRIPT

exit_code = 1
EM.run do
  socket = Faye::WebSocket::Client.new(page.fetch("webSocketDebuggerUrl"))
  timer = EM.add_timer(10) do
    warn "Tempo limite excedido no teste do booster"
    socket.close
    EM.stop
  end
  socket.on(:open) do
    socket.send(JSON.generate(id: 1, method: "Runtime.evaluate", params: { expression: script, awaitPromise: true, returnByValue: true }))
  end
  socket.on(:message) do |event|
    message = JSON.parse(event.data)
    next unless message["id"] == 1

    EM.cancel_timer(timer)
    result = message.dig("result", "result") || {}
    if message.dig("result", "exceptionDetails")
      warn message.dig("result", "exceptionDetails", "exception", "description") || "Erro no navegador"
    else
      puts JSON.generate(result["value"])
      exit_code = result.dig("value", "ok") ? 0 : 1
    end
    socket.close
    EM.stop
  end
end

exit exit_code
