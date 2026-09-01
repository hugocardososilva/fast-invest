# POC — Assistente de investimentos

Extensão Chromium Manifest V3 que funciona como um booster de oportunidades: monitora os produtos exibidos, aplica critérios previamente definidos, seleciona a melhor alternativa, preenche o valor e avança automaticamente até a confirmação humana. A extensão **não digita token nem confirma operações**.

## O que a POC demonstra

- monitoramento contínuo dos cards de CDB, LCI, LCA e produtos semelhantes;
- normalização de taxa, indexador, emissor, vencimento, investimento mínimo e liquidez;
- filtros por valor, produto, indexador, taxa, prazo, liquidez e emissores;
- classificação com justificativas para itens excluídos;
- seleção automática da oportunidade mais bem classificada;
- destaque e preenchimento automático do valor;
- navegação automática até a tela de confirmação no simulador;
- revalidação de produto, emissor, taxa e valor na revisão;
- tolerância configurável para eventual queda da taxa;
- interrupção em caso de mudança, indisponibilidade ou falha de navegação;
- alerta visual quando a confirmação humana for necessária;
- preferências salvas localmente pelo navegador;
- interrupção antes de qualquer confirmação financeira.

## Executar a demonstração completa

1. Abra `chrome://extensions` (Chrome, Chromium, Brave ou Edge).
2. Ative o **Modo do desenvolvedor**.
3. Escolha **Carregar sem compactação** e selecione esta pasta.
4. No terminal, nesta pasta, execute:

   ```sh
   python3 -m http.server 8080
   ```

5. Abra `http://localhost:8080/demo/investments.html`.
6. Entre no ambiente fictício e abra **Investimentos**.
7. Selecione o cenário que deseja validar.
8. Abra a extensão, ajuste os critérios e clique em **Ativar booster**.
9. Feche o popup e acompanhe o painel lateral: a seleção, o preenchimento e a revisão serão automáticos.
10. Quando o booster parar na confirmação, digite manualmente o código `123456` nos seis campos.
11. Confirme a operação fictícia para gerar o comprovante.

### Etapas reproduzidas

1. acesso a uma conta inteiramente fictícia;
2. dashboard e saldo simulado;
3. vitrine de investimentos;
4. monitoramento, classificação e seleção automática pela extensão;
5. validação de valor mínimo, saldo e disponibilidade;
6. revisão de produto, taxa, prazo, liquidez e valor;
7. revalidação e avanço automático dos aceites exclusivamente fictícios do simulador;
8. parada em desafio de segurança humano, com token fictício de seis dígitos;
9. processamento protegido contra envio repetido;
10. comprovante e protocolo simulados.

### Cenários disponíveis

- fluxo concluído com sucesso;
- mudança de taxa antes da revisão, bloqueando o avanço;
- produto indisponível;
- saldo insuficiente;
- falha durante o processamento, sem gerar comprovante.

### Token de demonstração

A etapa de segurança simula o envio para um dispositivo mascarado, código com seis posições, validade de 60 segundos, reenvio e contagem de tentativas. Depois de três códigos inválidos, a validação fica bloqueada por 15 segundos. O único token válido é `123456`; ele existe apenas no navegador e nunca é enviado para um serviço externo.

O servidor local é usado porque navegadores restringem extensões em páginas `file://` por padrão.

## Testes

Não há dependências para instalar. Com Node.js 14 ou superior:

```sh
npm test
npm run check
```

O teste manual do navegador cobre a jornada completa. O arquivo `tests/simulator_smoke.rb` também pode validar o fluxo via Chrome DevTools quando um Chrome headless estiver iniciado com depuração remota na porta `9223`.

O arquivo `tests/booster_smoke.rb` valida especificamente a seleção da melhor oportunidade, preenchimento, avanço automático, parada no token, confirmação manual, queda de taxa e escolha da próxima opção quando um produto fica indisponível.

## Segurança e limites deliberados

- Somente a aba em que o usuário aciona a extensão fica acessível (`activeTab`).
- Não há permissão permanente para os domínios do BTG.
- Não há backend, telemetria ou envio de dados.
- Senhas, cookies, tokens e dados de sessão não são lidos nem armazenados.
- No simulador, a extensão aciona os botões preparatórios e os aceites fictícios até chegar ao token.
- Fora do simulador, qualquer aceite contratual ou etapa não reconhecida interrompe a automação e exige ação humana.
- Token, biometria, CAPTCHA e botão de confirmação final nunca são automatizados.
- O booster possui botão de interrupção e para se os dados da revisão não coincidirem com a oportunidade selecionada.
- Taxas CDI, IPCA+ e prefixadas são filtradas separadamente por padrão.
- A extração heurística ainda precisa ser calibrada usando uma amostra autorizada do DOM real.

## Próxima validação no portal

Para adaptar a POC sem compartilhar credenciais, capture uma versão sanitizada do HTML de um card de cada tipo de produto. Remova nomes, saldos, conta, CPF, tokens e demais dados pessoais. Com essas amostras será possível criar um adaptador específico e testes de regressão para o portal.
