# frozen_string_literal: true

require "eventmachine"
require "faye/websocket"
require "json"
require "net/http"

debug_port = Integer(ENV.fetch("BTG_CHROME_DEBUG_PORT", "9223"))
targets = JSON.parse(Net::HTTP.get(URI("http://127.0.0.1:#{debug_port}/json")))
page = targets.find { |target| target["url"].include?("/demo/investments.html") }
abort "Página do simulador não encontrada no Chrome" unless page

script = <<~JAVASCRIPT
  (async () => {
    const wait = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const click = async (selector) => {
      const element = document.querySelector(selector);
      assert(element, `Elemento ausente: ${selector}`);
      element.click();
      await wait();
    };
    const fillToken = (value) => {
      document.querySelectorAll('.token-digit').forEach((input, index) => { input.value = value[index] || ''; });
    };

    if (!document.querySelector('[data-form="login"]')) {
      const logout = document.querySelector('[data-action="logout"]');
      assert(logout, 'Não foi possível restaurar o início do simulador');
      logout.click();
      await wait();
    }
    await click('[data-form="login"] button');
    assert(document.body.innerText.includes('Cliente Demonstração'), 'Dashboard não abriu');
    await click('[data-action="open-investments"]');
    assert(document.querySelectorAll('[data-investment-product]').length === 4, 'A vitrine não exibiu quatro produtos');

    const card = document.querySelector('[data-product-id="horizonte"]');
    card.querySelector('input[name="investmentAmount"]').value = '10000,00';
    card.querySelector('[data-action="select-product"]').click();
    await wait();
    assert(document.body.innerText.includes('Revise sua aplicação'), 'Revisão não abriu');

    document.querySelector('#terms').click();
    document.querySelector('#risk').click();
    await click('[data-action="go-challenge"]');
    assert(document.body.innerText.includes('Confirme com o token'), 'Limite humano não foi apresentado');

    assert(document.querySelectorAll('.token-digit').length === 6, 'Entrada de token não possui seis posições');
    assert(document.querySelector('#token-status').innerText.includes('expira em'), 'Expiração do token não foi exibida');
    fillToken('000000');
    document.querySelector('[data-form="challenge"]').requestSubmit();
    await wait();
    assert(document.body.innerText.includes('Token inválido'), 'Token inválido não foi rejeitado');
    assert(document.body.innerText.includes('2 tentativa'), 'Tentativas restantes não foram informadas');
    await click('[data-action="resend-token"]');
    assert(document.body.innerText.includes('Novo token fictício enviado'), 'Reenvio do token não foi informado');
    fillToken('123456');
    document.querySelector('[data-form="challenge"]').requestSubmit();
    await wait(1200);
    assert(document.body.innerText.includes('Simulação concluída'), 'Conclusão não foi apresentada');
    assert(document.body.innerText.includes('Protocolo: SIM-'), 'Protocolo simulado não foi gerado');

    await click('[data-action="new-simulation"]');
    const chooseScenario = async (value) => {
      const selector = document.querySelector('#scenario');
      selector.value = value;
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      await wait();
    };
    const prepareFirstProduct = async () => {
      const first = document.querySelector('[data-product-id="horizonte"]');
      first.querySelector('input[name="investmentAmount"]').value = '10000,00';
      first.querySelector('[data-action="select-product"]').click();
      await wait();
    };

    await chooseScenario('rate-change');
    await prepareFirstProduct();
    assert(document.body.innerText.includes('A taxa mudou'), 'Mudança de taxa não foi sinalizada');
    assert(document.querySelector('[data-action="go-challenge"]').disabled, 'Mudança de taxa não bloqueou o avanço');
    await click('[data-action="back-products"]');

    await chooseScenario('unavailable');
    const unavailable = document.querySelector('[data-product-id="horizonte"]');
    assert(unavailable.classList.contains('is-unavailable'), 'Produto indisponível não foi marcado');
    assert(unavailable.querySelector('[data-action="select-product"]').disabled, 'Produto indisponível ainda permite avançar');

    await chooseScenario('insufficient');
    await prepareFirstProduct();
    assert(document.body.innerText.includes('Saldo fictício insuficiente'), 'Saldo insuficiente não foi bloqueado');
    assert(document.body.innerText.includes('Renda fixa'), 'Saldo insuficiente saiu da vitrine');

    await chooseScenario('failure');
    await prepareFirstProduct();
    document.querySelector('#terms').click();
    document.querySelector('#risk').click();
    await click('[data-action="go-challenge"]');
    fillToken('123456');
    document.querySelector('[data-form="challenge"]').requestSubmit();
    await wait(1200);
    assert(document.body.innerText.includes('processamento simulado falhou'), 'Falha de processamento não foi exibida');
    assert(!document.body.innerText.includes('Protocolo: SIM-'), 'Falha gerou um protocolo indevido');

    return {
      ok: true, cards: 4, humanConfirmation: true, receipt: true,
      rateChangeBlocked: true, unavailableBlocked: true,
      insufficientBalanceBlocked: true, processingFailureHandled: true
    };
  })()
JAVASCRIPT

exit_code = 1
EM.run do
  socket = Faye::WebSocket::Client.new(page.fetch("webSocketDebuggerUrl"))
  timer = EM.add_timer(10) do
    warn "Tempo limite excedido no teste do navegador"
    socket.close
    EM.stop
  end

  socket.on(:open) do
    socket.send(JSON.generate(
      id: 1,
      method: "Runtime.evaluate",
      params: { expression: script, awaitPromise: true, returnByValue: true }
    ))
  end

  socket.on(:message) do |event|
    message = JSON.parse(event.data)
    next unless message["id"] == 1

    EM.cancel_timer(timer)
    result = message.dig("result", "result") || {}
    if result["subtype"] == "error"
      warn result["description"]
    else
      puts JSON.generate(result["value"])
      exit_code = result.dig("value", "ok") ? 0 : 1
      warn JSON.pretty_generate(message) unless exit_code.zero?
    end
    socket.close
    EM.stop
  end

  socket.on(:error) do |event|
    warn "Erro no DevTools: #{event.message}"
  end
end

exit exit_code
