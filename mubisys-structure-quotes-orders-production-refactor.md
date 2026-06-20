# Refatoracao estrutural de Orcamentos, O.S. e PCP

## Resultado

**APROVADO. A integracao foi estrutural, nao apenas visual.**

O produto cadastrado agora determina o custo do item, as perguntas tecnicas, a rota produtiva, os snapshots do orcamento e da O.S. e o movimento real da ordem no PCP.

## Arquivos alterados

- `server.js`
- `public/app.js`
- `public/styles.css`
- `work/validate-structural-quotes-orders-pcp.cjs`
- `work/verify-structural-refactor-persistence.cjs`
- `work/visual-check-structural-refactor.cjs`

## Modelo de dados

### Orcamento

- `itemSnapshots`: snapshot individual de cada produto do orcamento.
- Cada item guarda produto, respostas tecnicas, custos das perguntas, preco, arquivos e rota produtiva.
- `costSnapshot.items`: composicao congelada dos itens.
- `costSnapshot.productionRoute`: rota consolidada e ordenada de todos os produtos.

### Ordem de Servico

- `itemProductionSnapshots`: itens produtivos congelados.
- `productConfigSnapshots`: configuracoes dos produtos usadas na aprovacao.
- `technicalAnswersByItem`: respostas tecnicas separadas por item.
- `questionCostsSnapshot`: custos gerados pelas respostas.
- `productionRouteSnapshot`: rota consolidada congelada da O.S.

Alteracoes futuras no produto nao modificam orcamentos ou O.S. antigos.

## Funcoes principais adicionadas ou ajustadas

- `buildQuoteItemSnapshot()`: recalcula o item no servidor a partir do produto cadastrado.
- `consolidateProductionRoutes()`: combina rotas multiproduto preservando a ordem obrigatoria.
- `aggregateItemPricing()`: agrega custos e precos reais dos itens.
- `approveQuoteToOrder()`: cria a O.S. com snapshots completos por item.
- `renderOrderProductionRoute()`: exibe a rota congelada e o estado de cada setor.
- `focusedOrderSnapshotItems()`: exibe produtos, medidas, custos de perguntas e setores na consulta da O.S.
- `prepareProductionQuickFilters()`: transforma os cards de setor em filtro ou movimento real, conforme a selecao.

## APIs e regras corrigidas

### `POST /api/quotes`

- O servidor nao confia no custo ou na rota enviados pelo navegador.
- Cada item e recalculado com o produto cadastrado.
- Orcamentos multiproduto recebem custo e rota consolidados.

### `POST /api/quotes/:id/approve`

- Gera O.S. com snapshots individuais dos produtos e rota produtiva congelada.

### `POST /api/orders/:id/move-sector`

- Aceita somente o proximo setor da rota congelada.
- Bloqueia pulo de setor.
- Bloqueia setor fora da rota.
- Registra origem, usuario, setor anterior, proximo setor e horario.
- Permite override apenas para Admin.

## Telas ajustadas

### Orcamentos

- Produto selecionado carrega configuracao, perguntas e setores reais.
- Perguntas tecnicas aparecem no formulario.
- Tabela de itens possui coluna de setores.

### Consulta de O.S.

- Exibe os produtos congelados na O.S.
- Exibe medida, quantidade e custos das perguntas por item.
- Exibe os setores de cada produto.
- Exibe a rota consolidada congelada com estado de cada etapa.

### PCP / Producao

- Cards mostram setor e contagem real.
- Sem O.S. selecionada, clicar no card filtra a lista.
- Com O.S. selecionada, somente o card do proximo setor fica habilitado para movimento.
- O clique movimenta a O.S. de verdade, atualiza a tabela e registra timeline.
- A selecao e limpa apos o movimento.

## Defeito real encontrado e corrigido

Os cards de setor eram exibidos, mas o clique nao movimentava a O.S. na subpagina operacional.

**Causa raiz:** o listener ainda procurava os cards dentro do contêiner antigo `#pcp`, removido durante a reorganizacao da navegacao.

**Correcao:** o listener passou a usar o elemento real `#pcp-sector-strip`, mantendo o comportamento de filtro e adicionando movimento seguro pela rota.

## Testes executados

### Validacao estrutural automatizada

Arquivo: `logs/structural-quotes-orders-pcp-validation.json`

- 18 de 18 verificacoes aprovadas.
- Snapshot adulterado pelo frontend foi ignorado.
- Dois produtos alteraram custo por respostas tecnicas.
- Orcamento multiproduto consolidou a rota:
  `Arte > Impressao > Laminacao > Acabamento`.
- O.S. recebeu dois snapshots de item e dois snapshots de produto.
- Pulo de setor retornou HTTP 400.
- Movimento pelo card registrou origem `pcp_sector_icon`.
- Timeline registrou todos os movimentos.

### Persistencia e multiempresa

Arquivo: `logs/structural-refactor-persistence.json`

- Produtos persistiram apos reinicio.
- Orcamento e O.S. persistiram.
- Snapshots por item persistiram.
- Rota congelada persistiu.
- Eventos do PCP persistiram.
- O.S. e orcamento permaneceram isolados da outra empresa.

### Validacao visual e operacional

Arquivo: `logs/structural-refactor-visual.json`

- Orçamento abriu com produto, perguntas e coluna de setores.
- Consulta da O.S. mostrou dois produtos congelados e quatro etapas.
- O card destacado movimentou a O.S. de Impressao para Acabamento.
- A selecao foi limpa depois do movimento.
- O card Acabamento filtrou a lista para somente O.S. do setor.
- Nenhum erro foi registrado no console.

Capturas:

- `logs/structural-refactor-quote.png`
- `logs/structural-refactor-order.png`
- `logs/structural-refactor-pcp-before-move.png`
- `logs/structural-refactor-pcp-after-move.png`
- `logs/structural-refactor-pcp-filter.png`

### Verificacoes de codigo

- `npm run check`: aprovado.
- `node --check server.js`: aprovado.
- `node --check public/app.js`: aprovado.
- `node --check scripts/migrate.js`: aprovado.
- Servidor ativo em `http://localhost:3000`.
- `server.err.log`: sem erros.

## Pendencias

Nenhuma pendencia critica para o fluxo produto → orçamento → O.S. → PCP.

A densidade visual do formulario completo de orçamento ainda pode receber uma etapa futura de simplificacao, sem alterar a integracao estrutural homologada nesta entrega.
