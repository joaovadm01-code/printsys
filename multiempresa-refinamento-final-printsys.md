# Multiempresa + Refinamento Final do PrintSys

Data: 05/06/2026

Status final: PRINTSYS ERP - MULTIEMPRESA E REFINAMENTO FINAL OPERANTES POR CHECK/API

## Objetivo

Consolidar o PrintSys para uso com mais de uma empresa/loja, corrigindo bloqueios de menu/permissao e mantendo os modulos homologados sem alteracao de regra de negocio, precificacao, caixa, financeiro, estoque, PCP ou producao.

## Arquivos alterados

- `server.js`
- `public/app.js`
- `public/styles.css`
- `multiempresa-refinamento-final-printsys.md`

## Erro principal encontrado

### Menu e telas bloqueadas para Admin

Causa raiz:

- Parte do frontend validava acesso por nome exato de perfil, principalmente `Admin Geral`.
- O backend tambem misturava permissoes rapidas com permissoes do usuario ativo.
- Em alguns fluxos, o usuario admin recebia permissoes no cadastro, mas a validacao efetiva de rota/tela nao reconhecia todos os perfis administrativos.
- Quando a URL abria direto em uma tela sem permissao resolvida, a interface podia ficar sem fallback claro para o dashboard.

Correcao aplicada:

- Criada validacao efetiva de permissoes no backend.
- Admin/Gestor, Admin Geral, Administrador e Gestor passam a receber permissao total de forma centralizada.
- `publicUser()`, login e status de autenticacao retornam permissoes efetivas.
- O frontend passou a usar `isAdminUser()` em vez de comparar apenas texto exato.
- A navegacao agora cai no dashboard quando a rota inicial nao pode ser aberta.
- Rotas diretas continuam protegidas por permissao real no backend.

## Estrutura multiempresa criada

### Cadastro de empresas/lojas

Foi adicionada a estrutura:

- `companies`
- `activeCompanyId`
- `companySettings`
- `defaultCompanyId`
- `shareCustomers`
- `shareProducts`

Cada empresa/loja possui:

- nome
- nome fantasia
- CNPJ
- cidade
- UF
- telefone
- endereco
- status ativo/inativo

### Escopo por loja

Os principais registros operacionais agora recebem `companyId`, incluindo:

- orcamentos
- O.S.
- caixa
- movimentacoes do caixa
- financeiro
- DRE
- producao
- estoque
- despesas
- funcionarios
- setores
- veiculos
- alertas
- auditoria
- simulacoes de precificacao
- centros de custo

Clientes, produtos, materiais e composicoes podem ser compartilhados ou separados conforme configuracao da empresa.

## APIs adicionadas

- `GET /api/companies`
- `POST /api/company-context`
- `POST /api/companies`
- `PUT /api/companies/:id`
- `POST /api/company-settings`

Regras:

- Usuario autenticado consulta apenas empresas permitidas.
- Usuario limitado nao consegue trocar para loja sem permissao.
- Escrita em empresas/configuracoes exige permissao de sistema.

## Telas ajustadas

### Header

- Adicionado seletor de empresa/loja no topo.
- O nome da unidade ativa aparece no cabecalho.
- A troca de loja recarrega os dados da tela atual sem alterar regras homologadas.

### Sistema / Configuracoes

- Criado painel "Empresas / Lojas".
- Admin pode cadastrar e revisar lojas.
- Admin pode definir empresa padrao.
- Admin pode configurar compartilhamento de clientes e produtos.

### Menus e permissoes

- Admin/Gestor ve todas as areas liberadas.
- Usuario limitado enxerga apenas lojas autorizadas.
- Acesso direto por API a outra loja retorna bloqueio.
- O menu respeita permissao, mas o backend tambem valida a rota.

## Protecao por empresa aplicada

Foram criados helpers de escopo no backend:

- `effectivePermissions()`
- `companiesForUser()`
- `canAccessCompany()`
- `requestedCompanyId()`
- `setActiveCompany()`
- `scoped()`
- `scopedFind()`
- `withCompany()`
- `scopeMeta()`

Esses helpers evitam que as telas leiam dados de outra loja por engano.

## Testes executados

### Checks sintaticos

Comando:

```bash
npm run check
```

Resultado:

```text
PASSOU
node --check server.js
node --check public/app.js
```

Comandos adicionais:

```bash
node --check server.js
node --check public/app.js
```

Resultado: passaram sem erro.

### Servidor local

Validacao HTTP:

```text
http://127.0.0.1:3000/ -> 200
```

Porta configurada:

```text
PORT=3000
```

`server.js` usa:

```text
process.env.PORT || 3000
```

### Login admin

Validado via API:

- login retornou usuario admin
- perfil: Admin Geral
- permissao de configuracoes: true
- empresas disponiveis: 4
- dashboard retornou dados com escopo de empresa

### Separacao por loja

Lojas de homologacao testadas:

- Loja A Homologacao: `company-70226`
- Loja B Homologacao: `company-97009`

Resultado:

```text
Loja A -> O.S. OS-1047 -> companyId company-70226
Loja B -> O.S. OS-1048 -> companyId company-97009
Separacao: true
```

### Usuario limitado

Usuario testado:

```text
vendedor.loja.a@printsys.local
```

Resultado:

```text
empresas permitidas: 1
empresa permitida: company-70226
tentativa de acessar company-97009: bloqueada com 403
```

### Persistencia

Validacao ja executada apos reinicio:

```text
Loja A preservada: true
Loja B preservada: true
O.S. da Loja A preservada: true
O.S. da Loja B preservada: true
Separacao apos reinicio: true
```

## Bugs corrigidos

### Falha de inicializacao do servidor

Erro encontrado:

```text
ReferenceError: Cannot access 'companyScopedCollections' before initialization
```

Causa:

- A migracao/suporte multiempresa era chamada antes da inicializacao de constantes usadas pelo helper.

Correcao:

- Chamadas de inicializacao foram movidas para depois da definicao dos helpers necessarios.
- O servidor voltou a iniciar normalmente.

### Admin bloqueado em telas administrativas

Causa:

- Validacao de perfil administrativa incompleta.

Correcao:

- Centralizacao da funcao de admin no frontend e backend.

### Dados sem `companyId`

Causa:

- Registros antigos foram criados antes da camada multiempresa.

Correcao:

- Migracao em runtime atribui empresa padrao aos registros existentes.
- Novos registros passam por `withCompany()`.

### Acoes de preparacao na interface

Validacao:

- Nao foram encontrados textos publicos de "Funcionalidade em preparacao" nos arquivos da interface.

## Modulos preservados

Nao foram alteradas as regras homologadas de:

- motor de precificacao
- orcamentos
- O.S.
- PCP/producao
- caixa
- financeiro
- DRE
- estoque
- auditoria

A camada multiempresa atua como filtro, contexto e protecao de leitura/gravação.

## Validacao visual automatizada

Tentativa realizada no navegador embutido do Codex:

```text
Falhou antes de controlar a aba por bloqueio do ambiente Windows:
windows sandbox failed: spawn setup refresh
```

Impacto:

- Nao foi falha HTTP, API ou JavaScript do PrintSys.
- A aplicacao respondeu normalmente em `http://127.0.0.1:3000/`.
- A validacao visual automatizada ficou pendente por limitacao da ferramenta de navegador neste ambiente.

## Pendencias reais

- Fazer uma passagem visual manual no navegador aberto para conferir responsividade e pequenos alinhamentos apos o seletor de loja.
- Em producao real, trocar `SESSION_SECRET` e senha inicial do admin por valores fortes.
- Para ambiente com muitas lojas e grande volume de registros, avaliar PostgreSQL no lugar do JSON persistente.

## Resultado final

PRINTSYS ERP - MULTIEMPRESA OPERANTE

O sistema esta com:

- servidor ativo na porta 3000
- login admin funcional
- permissoes administrativas corrigidas
- usuarios limitados bloqueados fora da loja permitida
- dados separados por empresa/loja
- painel de empresas em Sistema / Configuracoes
- seletor de empresa no cabecalho
- caixa, O.S., orcamentos, producao, financeiro, DRE e estoque filtrados por loja
- checks sintaticos aprovados
- API respondendo corretamente

Status para uso piloto multiempresa:

```text
APROVADO COM PENDENCIA VISUAL MANUAL
```
