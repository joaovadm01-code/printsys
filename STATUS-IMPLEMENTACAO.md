# Status De Implementacao Do PrintSys ERP/PDV

Este arquivo mapeia o briefing principal contra o que ja foi implementado no MVP atual.

## Ja Implementado No MVP

- Dashboard com painel rapido
- Clientes
- Produtos e servicos com codigo interno
- Questionario configuravel por produto
- Precificacao automatica por respostas
- Simulacao de preco antes de salvar orcamento
- Orcamentos
- Conversao de orcamento aprovado em O.S.
- O.S. com status produtivo e financeiro
- Aprovacao do cliente
- Historico/timeline de O.S.
- Ficha tecnica do produto
- Producao / PCP
- Equipe de instalacao vinculada a O.S.
- Registro de etapas de producao
- Estoque de materiais
- Baixa de estoque por O.S.
- Pos-calculo previsto x real
- Etiqueta/ficha de producao para impressao/PDF pelo navegador
- Caixa / PDV
- Venda rapida sem O.S.
- Fechamento de caixa por conferencia cega
- Clientes fiado/prazo em painel financeiro
- Alertas automaticos
- Auditoria de acoes importantes
- Motor de precificacao por composicao tecnica
- Banco de composicoes tecnicas
- Centros de custo por setor
- Rentabilidade previsto x real por O.S.
- Modelagem relacional em `docs/schema.sql`
- Servidor REST em Node.js
- Frontend responsivo
- Scripts `.bat` para iniciar e abrir o sistema

## Produtos/Servicos Ja Criados

- `LON-001` Faixa em lona
- `ADE-001` Adesivo vinyl recortado
- `ADE-002` Adesivacao / aplicacao
- `TOL-001` Toldo personalizado
- `ACM-001` ACM / fachada / placa
- `PVC-001` PVC adesivado
- `MET-001` Placa de metalon
- `IMP-001` Impressao rapida

## Recursos Parcialmente Implementados

- Upload de arquivos: hoje o MVP registra nome/URL do arquivo; falta armazenamento real.
- Permissoes: schema planejado; falta autenticação e bloqueio de telas por perfil.
- Relatorios: indicadores existem; falta tela completa de relatórios filtráveis.
- Financeiro: resumo e caixa existem; falta contas a pagar/receber completo com vencimentos e parcelas.
- Compras/fornecedores: schema previsto; falta tela operacional.
- Faturamento: previsto no fluxo; falta modulo separado com NFSe/boletos/parcelas.
- Fiado: clientes com saldo aparecem; falta régua completa de cobrança, bloqueio automático e pagamentos parciais.

## Proximos Passos Recomendados

1. Persistência real com PostgreSQL usando `docs/schema.sql`.
2. Evoluir o banco de composicoes para edição detalhada de materiais, produção e instalação.
3. Login, autenticação e permissões por perfil.
4. Upload real de arquivos e fotos da O.S.
5. Tela completa de faturamento, contas a pagar e contas a receber.
6. Relatórios gerenciais com filtros por período, vendedor, produto, cliente e setor.
7. Rotina de backup.
8. Testes automatizados para motor de preço, caixa cego e baixa de estoque.
9. Ajuste visual fino após uso real no período de teste.

## Fase 1 Consolidada

O núcleo atual prioriza:

- Motor de precificação baseado em composição, materiais, hora homem, hora máquina, instalação, despesas, comissão, impostos e margem.
- Banco de composições com exemplos para Fachada ACM, Faixa/Lona, Adesivo Aplicado e PVC Adesivado.
- Centro de custos por Comercial, Administrativo, Impressão, Produção, Instalação, Almoxarifado e Financeiro.
- Rentabilidade da O.S. comparando previsto x real em material, produção, instalação e lucro.

## Como Testar Agora

1. Execute `iniciar-printsys.bat`.
2. Abra `http://localhost:3000`.
3. Siga o roteiro em `TESTE-E-MODIFICACOES.md`.
4. Registre ajustes desejados no próprio roteiro.

## Observacao Importante

Esta versão é um MVP funcional em memória. Ela serve para validar fluxo, tela, regra de preço e operação. Para uso real em produção, o próximo salto é ligar o backend ao banco relacional e adicionar autenticação/permissões.
