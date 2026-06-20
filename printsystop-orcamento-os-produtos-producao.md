# PrintSysTop - Orcamento, O.S., Produtos e Producao

Data: 06/06/2026

Status: PRINTSYS OPERACIONAL, ORGANIZADO E APROVADO POR CHECK/API

## Objetivo da etapa

Elevar os fluxos principais do PrintSys sem alterar o motor de precificacao homologado, login, sessao, multiempresa, persistencia ou regras financeiras existentes.

O foco aplicado foi:

- facilitar cadastro de cliente;
- melhorar cadastro e consulta de produtos;
- tornar o item do orcamento simples de montar;
- preservar orcamentos multiproduto na O.S.;
- deixar a producao mais operacional;
- manter separacao por loja e permissao real.

## Arquivos alterados

- `public/app.js`
- `public/styles.css`
- `server.js`
- `printsystop-orcamento-os-produtos-producao.md`

## Clientes

O cadastro de clientes foi ampliado com:

- nome / razao social;
- telefone;
- e-mail;
- celular / WhatsApp;
- CPF/CNPJ;
- empresa / nome fantasia;
- classificacao;
- origem;
- endereco;
- contato principal;
- limite de fiado;
- observacoes.

Melhorias operacionais:

- busca por nome, telefone, CPF/CNPJ, e-mail ou empresa;
- edicao real;
- consulta rapida de historico;
- inativacao com preservacao de orcamentos, O.S. e financeiro;
- cadastro rapido dentro do orcamento;
- clientes inativos deixam de aparecer para novos orcamentos.

## Produtos e servicos

O cadastro de produtos foi ampliado com:

- codigo;
- nome;
- descricao;
- categoria;
- unidade de medida;
- preco base;
- custo base;
- margem minima;
- margem sugerida;
- materiais usados;
- acabamentos;
- tempo medio de producao;
- setores envolvidos;
- exige instalacao;
- exige arte;
- exige aprovacao;
- gera producao;
- movimenta estoque;
- gera financeiro;
- ativo/inativo.

Melhorias operacionais:

- busca por nome, codigo e categoria;
- filtro por categoria;
- edicao real;
- inativacao com historico preservado;
- acao direta para iniciar um orcamento pelo produto;
- produtos inativos nao aparecem em venda rapida ou novo orcamento.

## Orcamento

O orcamento continua usando o motor homologado.

Foi adicionado um painel lateral guiado para montar itens:

1. Produto / servico.
2. Medidas e quantidade.
3. Personalizacao.
4. Preco.
5. Observacoes e arquivos.

O painel permite:

- buscar produto;
- selecionar composicao;
- calcular area;
- definir material;
- definir acabamento;
- selecionar laminacao;
- selecionar recorte;
- selecionar aplicacao;
- informar instalacao;
- informar arte;
- informar prazo;
- informar deslocamento;
- simular preco;
- ver margem, lucro, preco minimo e saude da venda;
- anexar imagens e arquivos;
- registrar observacoes separadas.

Campos tecnicos continuam disponiveis, mas o fluxo principal ficou mais simples.

## Adicionar item

O botao `Adicionar item` agora abre o painel guiado.

Cada item preserva:

- produto;
- composicao;
- descricao;
- medidas;
- quantidade;
- material;
- acabamento;
- respostas;
- checklist;
- arquivos;
- observacoes;
- snapshot de preco;
- margem;
- subtotal.

Os itens aparecem em cards limpos e tambem permanecem na tabela.

Acoes reais:

- adicionar;
- editar;
- duplicar;
- excluir;
- ver calculo;
- anexar arquivo.

## Checklists e questionarios

Foram adicionados checklists leves e recolhiveis por tipo de produto.

Exemplos:

- Fachada / ACM: medida, foto do local, estrutura, eletrica e montagem.
- Adesivo: local, superficie, medida, arte e instalacao externa.
- Lona / faixa: medidas, acabamento, ilhos, bainha/bastao e arquivo.
- Letreiro luminoso: pontos de luz, fonte, eletrica, instalacao e arte.

Os questionarios existentes continuam alimentando o calculo.

## Gestao, margem e ponto de equilibrio

O painel de item apresenta somente informacoes gerenciais importantes:

- preco sugerido;
- preco final;
- preco minimo;
- margem;
- lucro previsto;
- saude da venda.

Classificacao visual:

- Saudavel;
- Atencao;
- Risco.

A memoria completa do calculo continua recolhida em `Ver memoria do calculo`.

## Ordem de Servico

Foi corrigida a preservacao multiproduto.

Antes:

- o frontend guardava varios itens;
- o backend montava sempre um unico item ao salvar o orcamento.

Agora:

- o orcamento salva todos os itens;
- a conversao em O.S. preserva todos os itens;
- vendedor, atendente, contato, campanha, logistica, endereco, pagamento e prazo seguem para a O.S.;
- arquivos, checklists e observacoes permanecem vinculados aos itens.

## Producao

O painel operacional passou a possuir acoes diretas reais:

- Iniciar;
- Pausar;
- Finalizar etapa;
- Detalhes;
- Arquivos;
- Proximo setor.

As acoes Iniciar, Pausar e Finalizar registram eventos reais na API de producao e atualizam:

- status;
- responsavel;
- data/hora;
- observacao;
- timeline.

## Permissoes

Regra revisada:

- `Admin Geral`, `Admin/Gestor` e `Administrador`: acesso total.
- `Gestor`: respeita modulos e permissoes liberados.
- usuarios comuns: acessam somente modulos permitidos.
- acesso direto por API continua protegido.

## Multiempresa

A estrutura multiempresa foi preservada e validada.

Teste:

- O.S. `OS-1049` criada na Loja A;
- visivel na Loja A;
- oculta na Loja B;
- usuario limitado a Loja A recebeu bloqueio ao tentar acessar Loja B.

Resultado:

```text
Separacao por loja: PASSOU
Usuario limitado: PASSOU
```

## APIs adicionadas

Clientes:

- `PUT /api/customers/:id`
- `DELETE /api/customers/:id`

Produtos:

- `PUT /api/products/:id`
- `DELETE /api/products/:id`

As exclusoes sao inativacoes para preservar historicos.

## Teste operacional executado

Fluxo homologado na Loja A:

1. Login Admin Geral.
2. Selecionar Loja A.
3. Criar cliente completo.
4. Editar cliente.
5. Criar produto completo.
6. Editar produto.
7. Calcular preco com `p1` + `cmp2` Faixa / Lona.
8. Criar orcamento multiproduto.
9. Salvar dois itens.
10. Aprovar orcamento.
11. Gerar O.S.
12. Confirmar dois itens na O.S.
13. Iniciar producao.
14. Consultar Financeiro.
15. Consultar DRE.
16. Inativar cadastros auxiliares.
17. Reiniciar servidor.
18. Confirmar persistencia.

Evidencia:

```text
Orcamento: ORC-1005
Itens do orcamento: 2
O.S.: OS-1049
Itens da O.S.: 2
Status da producao: Em producao
Persistencia apos reinicio: PASSOU
```

## Validacoes tecnicas

```text
npm run check: PASSOU
node --check server.js: PASSOU
node --check public/app.js: PASSOU
http://127.0.0.1:3000/: 200
Servidor ativo: PASSOU
Login admin: PASSOU
Financeiro: PASSOU
DRE: PASSOU
Separacao por loja: PASSOU
Usuario limitado: PASSOU
Persistencia: PASSOU
```

Nao foram encontrados textos de `Funcionalidade em preparacao` nas telas publicas.

## Bugs corrigidos

- cliente sem edicao;
- produto sem edicao;
- inativacao sem preservacao explicita;
- produto inativo aparecendo para nova venda;
- cadastro rapido de cliente sem fluxo integrado;
- risco de formulario aninhado no cadastro rapido;
- botao Adicionar item sem painel guiado;
- dados de material/acabamento sendo reaproveitados entre itens;
- multiproduto perdido ao salvar/converter;
- producao sem acoes rapidas reais;
- Gestor simples tratado como administrador total.

## Validacao visual automatizada

A tentativa de controlar o navegador embutido foi bloqueada pelo ambiente Windows antes da leitura da pagina.

Isso nao foi erro do PrintSys:

- servidor respondeu HTTP 200;
- checks JavaScript passaram;
- APIs e fluxos operacionais passaram.

Pendente:

- passagem visual manual no navegador aberto para conferir pequenos alinhamentos e responsividade do novo painel lateral.

## Pendencias reais

- Validar visualmente o painel de item em celular real.
- Evoluir upload de arquivos por nome para upload binario quando houver armazenamento de arquivos configurado.
- Criar confirmacao visual mais detalhada antes de inativar produtos/clientes, caso desejado.
- Revisar a codificacao antiga de alguns textos legados que aparecem com caracteres incorretos.

## Resultado final

O PrintSys agora permite, com fluxo organizado:

- cadastrar cliente;
- cadastrar produto;
- editar cliente e produto;
- criar orcamento;
- adicionar e editar varios itens;
- simular preco;
- converter em O.S.;
- preservar itens e dados comerciais;
- iniciar, pausar e finalizar producao;
- consultar Financeiro e DRE;
- trabalhar separado por loja.

Status:

```text
PRINTSYS ERP APROVADO PARA CONTINUAR O PILOTO OPERACIONAL
```
