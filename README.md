# POC — Assistente de investimentos

Extensão Chromium Manifest V3 para demonstrar um fluxo de automação assistida: ler produtos exibidos em uma página, aplicar critérios determinísticos, explicar o ranking, destacar uma opção e preencher o valor. A extensão **não confirma operações**.

## O que a POC demonstra

- leitura de cards de CDB, LCI, LCA e produtos semelhantes;
- normalização de taxa, indexador, emissor, vencimento, investimento mínimo e liquidez;
- filtros por valor, produto, indexador, taxa, prazo, liquidez e emissores;
- classificação com justificativas para itens excluídos;
- destaque visual do produto selecionado;
- tentativa conservadora de preenchimento do campo de valor;
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
8. Abra a extensão, ajuste os critérios e clique em **Analisar página atual**.
9. No painel lateral, use **Destacar** ou **Preparar aplicação**.
10. Clique manualmente em **Continuar**, revise os dados e aceite os termos fictícios.
11. Na confirmação humana, use o código de demonstração `123456`.

### Etapas reproduzidas

1. acesso a uma conta inteiramente fictícia;
2. dashboard e saldo simulado;
3. vitrine de investimentos;
4. análise, classificação e preenchimento pela extensão;
5. validação de valor mínimo, saldo e disponibilidade;
6. revisão de produto, taxa, prazo, liquidez e valor;
7. aceite explícito de termos e riscos;
8. parada em desafio de segurança humano;
9. processamento protegido contra envio repetido;
10. comprovante e protocolo simulados.

### Cenários disponíveis

- fluxo concluído com sucesso;
- mudança de taxa antes da revisão, bloqueando o avanço;
- produto indisponível;
- saldo insuficiente;
- falha durante o processamento, sem gerar comprovante.

O servidor local é usado porque navegadores restringem extensões em páginas `file://` por padrão.

## Testes

Não há dependências para instalar. Com Node.js 14 ou superior:

```sh
npm test
npm run check
```

O teste manual do navegador cobre a jornada completa. O arquivo `tests/simulator_smoke.rb` também pode validar o fluxo via Chrome DevTools quando um Chrome headless estiver iniciado com depuração remota na porta `9223`.

## Segurança e limites deliberados

- Somente a aba em que o usuário aciona a extensão fica acessível (`activeTab`).
- Não há permissão permanente para os domínios do BTG.
- Não há backend, telemetria ou envio de dados.
- Senhas, cookies, tokens e dados de sessão não são lidos nem armazenados.
- A extensão não procura nem aciona botões de continuar, investir ou confirmar; essas ações são manuais até mesmo no simulador.
- Taxas CDI, IPCA+ e prefixadas são filtradas separadamente por padrão.
- A extração heurística ainda precisa ser calibrada usando uma amostra autorizada do DOM real.

## Próxima validação no portal

Para adaptar a POC sem compartilhar credenciais, capture uma versão sanitizada do HTML de um card de cada tipo de produto. Remova nomes, saldos, conta, CPF, tokens e demais dados pessoais. Com essas amostras será possível criar um adaptador específico e testes de regressão para o portal.
