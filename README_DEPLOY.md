# Deploy do PrintSys ERP

## Requisitos

- Node.js 18 ou superior
- Variaveis de ambiente configuradas
- Porta liberada no servidor

## Instalar

```bash
npm install
```

O projeto nao depende de pacotes externos nesta primeira versao executavel.

## Configurar ambiente

Copie `.env.example` para `.env` e ajuste:

```env
PORT=3000
DATABASE_URL=./data/printsys-data.json
SESSION_SECRET=troque-por-uma-chave-grande-e-segura
SESSION_MAX_AGE_MS=28800000
ADMIN_EMAIL=admin@printsys.local
ADMIN_PASSWORD=troque-esta-senha
NODE_ENV=production
```

## Migrar e criar admin

```bash
npm run migrate
npm run seed
```

O `ADMIN_PASSWORD` deve estar definido antes do seed. Nao use senha fraca em producao.

## Iniciar

```bash
npm start
```

Acesse:

```text
http://localhost:3000/
```

## Banco persistente

A primeira versao online usa persistencia local em arquivo definido por `DATABASE_URL`.

Tambem e gerado `data/schema.sql` com a estrutura de referencia para evoluir para SQLite/PostgreSQL:

- users
- roles
- permissions
- sessions
- customers
- quotes
- orders
- products
- compositions
- materials
- stock_movements
- cash_registers
- cash_movements
- payments
- financial_entries
- employees
- sectors
- production_steps
- audit_logs

## Seguranca

- Login obrigatorio para APIs internas
- Sessao por cookie HTTP-only
- Logout seguro
- Bloqueio de APIs sem sessao
- Bloqueio de APIs sem permissao
- Senha armazenada com hash seguro `scrypt`
- Admin inicial criado por variavel de ambiente

## Deploy online

Em servidor/VPS:

```bash
npm install
npm run migrate
npm run seed
npm start
```

Em hospedagem Node:

- configure as variaveis de ambiente
- defina o comando de start como `npm start`
- exponha a porta indicada por `PORT`

## Observacao sobre SQLite/PostgreSQL

O ambiente atual nao possui driver SQLite instalado. Por isso, a versao executavel foi preparada com persistencia local em arquivo, sem depender de pacotes externos. A estrutura foi organizada para migrar para SQLite/PostgreSQL na proxima etapa de infraestrutura.

