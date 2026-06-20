# PrintSys ERP/PDV para Grafica

Sistema base para gestao de grafica, comunicacao visual e producao sob demanda.

Esta primeira entrega contem:

- Arquitetura modular do sistema
- Modelagem relacional em SQL
- Backend REST inicial em Node.js sem dependencias externas
- Frontend responsivo para operar os fluxos principais
- Dados de exemplo em memoria
- Fluxos iniciais de orcamento, O.S., producao, financeiro e caixa cego

## Como Rodar

Requisitos:

- Node.js 18 ou superior

Comando:

```bash
node server.js
```

Depois abra:

```text
http://localhost:3000
```

No Windows, tambem pode iniciar com dois cliques:

```text
iniciar-printsys.bat
```

E abrir o navegador com:

```text
abrir-sistema.bat
```

## Estrutura

```text
printsys-erp/
  README.md
  server.js
  public/
    index.html
    app.js
    styles.css
  docs/
    arquitetura.md
    schema.sql
```

## Modulos Do MVP

- Dashboard
- Clientes
- Produtos
- Questionario configuravel
- Precificacao automatica
- Orcamentos
- Ordem de servico
- Producao/PCP
- Financeiro
- Caixa/PDV com conferencia cega
- Usuarios e perfis planejados na modelagem

## Proximos Passos Tecnicos

1. Trocar armazenamento em memoria por PostgreSQL usando o schema em `docs/schema.sql`.
2. Adicionar autenticacao JWT ou sessao segura.
3. Implementar upload real para anexos de O.S.
4. Criar controle granular de permissoes por perfil.
5. Adicionar testes automatizados para motor de precificacao e caixa cego.
