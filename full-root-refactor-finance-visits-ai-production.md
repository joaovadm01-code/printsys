# Full Root Refactor - Financeiro, Visitas, IA e Produção

Data da homologação: 13/06/2026

## Resultado

**APROVADO funcionalmente.**

As alterações foram implementadas no código, estado, APIs e persistência. A homologação confirmou que os fluxos continuam disponíveis após reiniciar o servidor e que os registros são isolados por loja.

O auditor interno apresenta:

- 0 falhas críticas;
- 0 inconsistências financeiras;
- 0 inconsistências de snapshot;
- 0 inconsistências de permissão;
- status `Atenção` apenas porque ainda não existe movimento histórico real de sangria ou suprimento.

Não foram criados movimentos financeiros fictícios para ocultar esses dois avisos operacionais.

## Arquivos alterados

- `server.js`
- `public/app.js`
- `public/styles.css`
- `public/index.html`
- `scripts/migrate.js`
- `scripts/seed.js`
- `work/validate-finance-visits-ai-root.cjs`
- `work/visual-check-root-code-refactor.cjs`

## Estruturas e persistência

### Contas a receber

Registros possuem origem única por `storeId + sourceType + sourceId` e são atualizados sem duplicação.

Campos principais:

- origem: O.S. ou venda rápida;
- cliente;
- valor total;
- valor pago;
- saldo;
- vencimento;
- situação;
- forma de pagamento;
- loja;
- datas de criação e atualização.

### Contas a pagar

Despesas operacionais geram ou atualizam uma única conta a pagar vinculada à despesa original.

### Visitas técnicas

Nova coleção persistente `technicalVisits`, com:

- cliente, contato e endereço;
- data solicitada e agendada;
- responsável;
- tipo e situação;
- observações e medições;
- fotos;
- vínculos com orçamento e O.S.;
- loja, criação, atualização e conclusão.

### Acesso por loja

Usuários possuem `storeAccess`, contendo loja, perfil e permissões. Visitas, produção, caixa, financeiro, orçamentos e O.S. respeitam a loja ativa.

## APIs implementadas e ajustadas

### Financeiro

- pagamento de O.S. atualiza a conta a receber da O.S.;
- venda rápida faturada ou pendente atualiza conta a receber;
- despesa operacional atualiza conta a pagar;
- fechamento e movimentos do caixa continuam persistentes;
- movimentos históricos recebem categoria, responsável e centro de custo normalizados.

### Visitas técnicas

- `GET /api/technical-visits`
- `POST /api/technical-visits`
- `PATCH /api/technical-visits/:id`
- `POST /api/technical-visits/:id/complete`
- `GET /api/technical-visits/reports`

As rotas validam permissão, loja ativa e registram auditoria.

## Orçamento

- cabeçalho compacto com cliente, situação, vendedor, prazo, quantidade de itens e total;
- seleção de produto carrega configuração, perguntas, custos e rota produtiva;
- itens mantêm snapshot real;
- ações de editar, duplicar e excluir funcionam no estado real;
- custos vêm do motor existente e são consolidados no orçamento;
- o layout antigo conflitante não é renderizado.

## Ordem de Serviço

- itens podem ser adicionados a partir de produtos cadastrados;
- editar, duplicar e remover persistem e recalculam a O.S.;
- perguntas, configuração e rota são congeladas no snapshot;
- histórico e rota produtiva permanecem consistentes.

## PCP e produção

- cards de setor usam O.S. reais;
- contadores são recalculados pelos dados atuais;
- backend impede pular etapas da rota;
- iniciar, finalizar e avançar setor registram evento;
- último setor conclui a produção;
- timeline registra movimentos originados pelos cards do PCP.

## Integração financeira

- O.S. paga ou parcialmente paga atualiza uma única conta a receber;
- venda rápida `bill_now` registra caixa e conta a receber quitada;
- venda rápida `pending_cash` cria pendência sem movimentar caixa;
- venda rápida `already_billed` não duplica caixa;
- despesa cria movimento e uma única conta a pagar;
- dashboard financeiro não soma duas vezes saldos originados de O.S.

## Visitas técnicas

O menu contém:

- Nova visita;
- Agenda;
- Em aberto;
- Concluídas;
- Relatórios.

Foram validados cadastro, agendamento, atribuição, medições, fotos, conclusão, relatórios e isolamento por loja.

## IA Assistente

A IA local está visível no menu e lê o estado real do sistema.

Diagnósticos incluem:

- O.S. pendentes, atrasadas, sem arquivo e sem pagamento;
- vendas rápidas aguardando caixa;
- visitas técnicas pendentes;
- contas a receber e a pagar vencidas;
- gargalos e apoio operacional.

Também orienta o usuário e navega para a tela relacionada.

## Correções visuais e de navegação

- alinhamento do cabeçalho global e dos cabeçalhos internos;
- cabeçalho do orçamento corrigido e compacto;
- ações reais no lugar do botão incorreto dentro da tabela;
- estados vazios legíveis;
- O.S. e produção com ações operacionais claras;
- sidebar móvel fecha após navegação;
- documento móvel sem estouro horizontal;
- tabelas largas mantêm rolagem interna;
- console do navegador sem erros.

## Testes executados

### Sintaxe

- `npm run check`: aprovado;
- `node --check server.js`: aprovado;
- `node --check public/app.js`: aprovado.

### Homologação funcional

- `validate-finance-visits-ai-root.cjs`: **APROVADO**;
- `validate-structural-quotes-orders-pcp.cjs`: **APROVADO**, 18/18;
- `validate-general-root-homologation.cjs`: **APROVADO**;
- `verify-structural-refactor-persistence.cjs`: **APROVADO**;
- `visual-check-root-code-refactor.cjs`: **APROVADO**.

### Evidências validadas

- login Admin/Gestor;
- seleção e isolamento por loja;
- produto altera custo por perguntas;
- orçamento e O.S. mantêm snapshots;
- duplicação e remoção de itens persistem;
- PCP movimenta O.S. real e bloqueia salto de setor;
- conta a receber e conta a pagar são atualizadas sem duplicação;
- visitas persistem e geram relatório;
- IA responde com dados reais;
- dados permanecem após reinício;
- nenhuma tela principal ficou em branco;
- console sem erros visíveis.

## Evidências visuais

Imagens geradas em `logs/`:

- `root-code-refactor-dashboard.png`
- `root-code-refactor-quote.png`
- `root-code-refactor-order.png`
- `root-code-refactor-product.png`
- `root-code-refactor-pcp.png`
- `root-code-refactor-cash.png`
- `root-code-refactor-visits.png`
- `root-code-refactor-intelligence.png`
- `root-code-refactor-mobile-quote.png`

## Riscos e pendências reais

- Sangria e suprimento estão implementados, mas o banco atual ainda não possui exemplos históricos reais dessas operações. O auditor mostra esses dois avisos até que a operação os utilize.
- O ambiente segue como aplicação local em `http://localhost:3000`; publicação externa não fez parte desta etapa.

## Conclusão

O refactor é funcional e persistente. Financeiro, visitas técnicas, IA, orçamento, O.S. e PCP estão conectados ao estado real e à persistência, sem mascaramento exclusivamente visual.
