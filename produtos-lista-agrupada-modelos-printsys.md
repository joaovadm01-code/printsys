# Produtos - Lista Agrupada e Modelos

## Status

PRINTSYS ERP - MODULO DE PRODUTOS RECONSTRUIDO COM LISTA AGRUPADA

## Arquivos alterados

- `server.js`
- `public/app.js`
- `public/styles.css`
- `work/validate-product-module.cjs`
- `work/validate-product-ui.cjs`
- `work/cleanup-product-validation.cjs`

## APIs criadas/ajustadas

- `GET /api/products`
- `GET /api/products/grouped`
- `POST /api/products/:id/duplicate`
- `POST /api/products/:id/models`
- `PUT /api/products/:id/models/:modelId`
- `DELETE /api/products/:id/models/:modelId`
- `POST /api/products/:id/models/:modelId/duplicate`
- `GET /api/products/:id/models/:modelId/questions`
- `PUT /api/products/:id/models/:modelId/questions`
- `POST /api/quote/calculate`
- `POST /api/quotes`
- `POST /api/quotes/:id/approve`
- `POST /api/orders/:id/items`

## Estruturas ajustadas

- Produto principal agora possui `models` normalizados.
- Cada modelo possui nome, acabamento, unidade, variacao, custo material/terceiro, custo mao de obra, custo total, valor de venda, perguntas, rota produtiva e vinculos de estoque.
- Orcamento envia e salva `productModelId`.
- Item do orcamento salva `productModelSnapshot`.
- Snapshot do orcamento salva modelo, perguntas, custos e rota produtiva.
- O.S. gerada por orcamento aprovado herda modelo, itens, custos previstos e rota produtiva.
- Perguntas do modelo entram no calculo e aparecem no fluxo de orcamento/O.S.

## Permissoes e auditoria

- Acoes de criar, editar, duplicar e inativar produtos/modelos ficam restritas a permissao de configuracao/Admin.
- Usuario sem permissao nao recebe acoes de edicao na lista.
- Auditoria registra produto/modelo criado, editado, duplicado, inativado e perguntas alteradas, com valor anterior e novo.
- Multiempresa segue usando `scoped`, `scopedFind` e `withCompany`.

## Melhorias visuais

- Produtos em lista agrupada.
- Produto expandido destacado em roxo.
- Modelos exibidos em tabela interna compacta.
- Acoes por produto e por modelo visiveis e funcionais.
- Modais de modelo e perguntas com layout padronizado.
- Tela responsiva com tabela rolavel em telas menores.

## Testes executados

- `npm.cmd run check` - passou.
- `node --check server.js` - passou.
- `node --check public/app.js` - passou.
- `node work\validate-product-module.cjs` - passou.
- `node work\validate-product-ui.cjs` - passou.
- `node work\cleanup-product-validation.cjs` - removeu apenas os dados gerados por esta validacao.
- `node work\validate-product-ui.cjs` apos limpeza - passou.

## Evidencias

- Validacao de API criou produto, criou modelo, editou custo/preco, salvou pergunta, duplicou/inativou modelo, duplicou/inativou produto, calculou orcamento pelo modelo, salvou snapshot, gerou O.S. com rota produtiva e validou auditoria.
- Validacao visual abriu `http://localhost:3000/#stock-products`, fez login admin, expandiu produto, confirmou tabela de modelos e console sem erros.
- A validacao final, apos limpeza dos artefatos de teste, encontrou 37 produtos na lista agrupada.
- Screenshot: `work/product-module-validation.png`.
- Servidor: `PrintSys ERP rodando em http://localhost:3000`.

## Pendencias reais

- O ambiente nao possui `git` disponivel no PATH, entao nao foi possivel gerar diff por comando Git.
- Existem produtos antigos de homologacao/inativos na base atual anteriores a esta etapa; eles foram preservados para nao apagar dados historicos.
