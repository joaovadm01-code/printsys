# Deep Product / Production Config Refactor

## Status

**APROVADO**

A configuracao do produto agora participa do calculo real do orcamento, e congelada no snapshot da O.S. e controla o roteamento operacional do PCP.

## Arquivos alterados

- `server.js`
- `public/app.js`
- `public/styles.css`
- `scripts/migrate.js`
- `data/schema.sql`
- `docs/schema.sql`
- `data/printsys-data.json` (migracao aditiva e dados da homologacao)

Scripts de homologacao criados fora do produto:

- `work/validate-deep-product-config.cjs`
- `work/verify-deep-config-persistence.cjs`
- `work/verify-concurrent-company-isolation.cjs`
- `work/visual-check-deep-config.cjs`

## Modelo de dados

### Produto

Foram adicionados e normalizados:

- `pricingMode`: `unit`, `square_meter` ou `linear_meter`
- `defaultProductionDays`
- `technicalQuestions[]`
- `productionRoute[]`

Cada pergunta tecnica armazena tipo de resposta, visibilidade, obrigatoriedade e regra de custo:

- `affectsCost`
- `costType`
- `costValue`
- `costApplication`

Cada etapa da rota armazena:

- setor e ordem
- responsavel padrao
- duracao padrao
- exigencia de arquivo
- exigencia de checklist

### Orcamento e O.S.

O snapshot do orcamento e da O.S. passou a guardar:

- configuracao do produto
- respostas tecnicas
- custos gerados pelas respostas
- rota produtiva ordenada
- versao dos custos
- prazo sugerido
- observacoes exclusivas da producao

A O.S. usa sua propria `productionRouteSnapshot`, sem depender da configuracao atual do produto.

### Estruturas de referencia

Os schemas de migracao passaram a incluir:

- `production_sectors`
- `product_technical_questions`
- `product_production_routes`
- `production_files`
- `product_production_configs`
- `order_production_snapshots`

## APIs adicionadas ou ampliadas

- `GET /api/production-sectors`
- `POST /api/production-sectors`
- `PUT/PATCH /api/production-sectors/:id`
- `DELETE /api/production-sectors/:id` (inativa, sem exclusao fisica)
- `PUT /api/products/:id/production-config`
- `PUT /api/products/:id/technical-questions`
- `PUT /api/products/:id/production-route`
- `PUT /api/orders/:id/production-notes`
- `POST /api/orders/:id/production-events`
- `POST /api/orders/:id/files`
- `GET /api/orders/:id/files/:fileId/download`

Endpoints existentes de produtos, calculo, orcamentos, aprovacao, O.S. e PCP foram ampliados sem remover contratos anteriores.

## Telas alteradas

### Cadastro de produto

Agora permite configurar:

- forma de calculo
- prazo padrao
- perguntas tecnicas com custo
- visibilidade das perguntas
- rota produtiva ordenada
- arquivo/checklist obrigatorio por etapa

### Orcamento

- carrega perguntas e configuracao do produto
- sugere prazo
- recalcula custos das respostas
- mostra custos das perguntas no detalhamento
- salva respostas e rota no snapshot

### O.S.

- mostra rota congelada e setor atual
- mostra respostas e custos tecnicos
- separa observacoes, alertas, instrucoes de arquivo e instalacao
- mostra eventos reais da producao

### PCP

- setores dinamicos com icone, cor, abertas e atrasadas
- filtro pelo setor atual
- aviso de arquivo obrigatorio
- inicio, pausa e finalizacao por setor
- avanco automatico pela rota congelada
- anexo/download e historico de arquivos
- indicador de observacoes de producao

## Homologacao executada

Cenario criado:

- Produto: **Adesivo - Validacao Integrada**
- Forma de calculo: `square_meter`
- Prazo inicial: 2 dias
- Pergunta: **Com laminacao?**
- Regra: R$ 12,00 por m2 adicionados ao custo
- Medida: 2 m x 1 m x 1 unidade
- Rota: Arte > Impressao > Laminacao > Acabamento
- O.S. final da homologacao: `OS-1053`

Resultados:

- custo direto da pergunta: **R$ 24,00**
- impacto no custo total com encargos: **R$ 26,20**
- pergunta e custo gravados no snapshot do orcamento
- pergunta e custo gravados no snapshot da O.S.
- rota gravada no snapshot da O.S.
- observacoes de producao gravadas separadamente
- O.S. enviada ao primeiro setor: Arte
- finalizacao de Arte moveu automaticamente para Impressao
- anexo e download registrados
- timeline registrou inicio, finalizacao, movimento, anexo, download e observacao
- alteracao posterior do produto passou a afetar novos calculos
- O.S. antiga manteve custo de R$ 24,00 e rota original

## Persistencia e isolamento

Depois de reiniciar o servidor:

- produto persistiu
- orcamento persistiu
- O.S. persistiu
- snapshot persistiu
- posicao no PCP persistiu

Isolamento multiempresa:

- orcamento e O.S. nao apareceram em outra empresa
- politica existente de produtos compartilhados foi respeitada
- 40 requisicoes simultaneas entre duas empresas foram validadas sem vazamento da O.S.

O contexto de empresa passou a ser isolado por requisicao para evitar troca acidental de escopo em acessos simultaneos.

## Validacoes

- `npm run check`: passou
- `node --check server.js`: passou
- `node --check public/app.js`: passou
- `node --check scripts/migrate.js`: passou
- `npm run migrate`: passou
- servidor ativo em `http://localhost:3000`
- console da validacao visual: sem erros
- cadastro de produto: campos e construtores visiveis
- PCP: tela e setores dinamicos renderizados; Laminacao e a O.S. do cenario foram confirmadas via API no escopo correto

A ultima captura visual do PCP foi feita na Loja Principal. Como o setor de homologacao pertence ao escopo do cenario, ele nao deve aparecer nessa captura; esse comportamento confirma o isolamento entre lojas.

Evidencias:

- `logs/deep-product-config-validation.json`
- `logs/deep-product-config-persistence.json`
- `logs/deep-product-config-concurrent-isolation.json`
- `logs/deep-product-config-visual.json`
- `logs/deep-product-config-product.png`
- `logs/deep-product-config-pcp.png`

## Compatibilidade preservada

- nenhum recurso existente foi removido
- perguntas e impactos antigos continuam normalizados
- fluxos antigos continuam convertidos em rota produtiva
- O.S. antigas recebem migracao aditiva
- autenticacao e permissoes continuam obrigatorias
- produtos compartilhados e dados operacionais isolados seguem a configuracao multiempresa

## Pendencia real

O armazenamento atual mantem arquivos de producao como metadados, nome e URL. O endpoint registra anexo e download, mas armazenamento binario interno depende de um provedor de arquivos externo ou camada futura de upload.
