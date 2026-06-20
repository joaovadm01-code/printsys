# Correcao UX - PrintSys sem menu suspenso

## Arquivos alterados

- `public/app.js`
- `public/styles.css`

## Orçamento

- Reorganizado em tela única, sem wizard e sem barra flutuante.
- Criado cabeçalho compacto com cliente, status, vendedor, prazo, total, saldo, margem e ações principais.
- Criados três cards superiores: Cliente, Serviço e Resumo financeiro.
- A tabela central de itens agora usa as colunas: Item, Descrição, Medida, Qtd, Unitário, Total e Ações.
- As ações de linha ficaram visíveis e objetivas: editar, duplicar e excluir.
- Os detalhes foram reorganizados em abas horizontais simples: Detalhes técnicos, Observações, Arquivos e Aprovação.
- O rodapé do orçamento virou barra interna do card, não flutuante, com Salvar, Aprovar, Gerar O.S., Imprimir e Cancelar.
- Botões finais foram conectados a ações reais: salvar orçamento, aprovar, gerar O.S., imprimir e voltar ao dashboard.

## Ordem de Serviço

- Reorganizada em tela única, sem wizard, sem menu flutuante e sem helper antigo.
- Criado cabeçalho compacto com número, cliente, prazo, status de produção, status financeiro, total e saldo.
- Criados cards de resumo: Cliente, Trabalho, Produção e Financeiro.
- A tabela central da O.S. agora usa as colunas: Item, Descrição, Medida, Qtd, Setor, Status e Ações.
- A linha de ações fica visível no cabeçalho: Abrir, Imprimir, Enviar produção, Receber, Anexar, Observação e Histórico.
- Blocos inferiores reorganizados em Produção detalhada, Financeiro resumido, Anexos e Histórico.
- O botão Observação registra evento real na timeline da O.S.

## Melhorias visuais

- Fundo cinza claro, cards brancos, sombras suaves e bordas arredondadas.
- Tabelas mais compactas, alinhadas e com ações próximas da linha.
- Botões menores, consistentes e com destaque apenas na ação principal.
- Status mantidos em pills coloridas.
- Campos alinhados em cards e seções, reduzindo poluição visual.
- Removidos visualmente os fluxos antigos de wizard/helper em Orçamento e O.S.

## Validações executadas

- `npm run check`: passou.
- `node --check server.js`: passou.
- `node --check public/app.js`: passou.
- Servidor local em `http://localhost:3000`: respondeu HTTP 200.
- Login admin via API: passou.
- Cálculo de orçamento via API: passou.
- Criação de orçamento real: passou (`ORC-1006`).
- Aprovação e geração de O.S.: passou (`OS-1050`).
- Envio ao PCP com autorização e arquivo: passou.
- Registro de observação na timeline: passou.
- Persistência da O.S. criada: confirmada.
- Conferência multiempresa por loja: sem vazamento entre lojas específicas.

## Limitação de validação visual

O navegador embutido do ambiente falhou ao abrir por limitação do sandbox (`spawn setup refresh`). Por isso, a validação visual foi feita por código, HTML/CSS e APIs locais, mas sem captura de tela nesta rodada.

## Status

PRINTSYS ERP - ORÇAMENTO E O.S. REORGANIZADOS EM TELA ÚNICA, SEM MENU SUSPENSO E COM AÇÕES PRINCIPAIS VISÍVEIS.
