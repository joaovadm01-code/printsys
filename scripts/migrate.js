const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");
const schemaFile = path.join(dataDir, "schema.sql");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const tables = [
  "users",
  "roles",
  "permissions",
  "sessions",
  "customers",
  "quotes",
  "orders",
  "products",
  "compositions",
  "materials",
  "stock_movements",
  "cash_registers",
  "cash_movements",
  "payments",
  "financial_entries",
  "accounts_receivable",
  "accounts_payable",
  "technical_visits",
  "employees",
  "sectors",
  "production_sectors",
  "product_technical_questions",
  "product_production_routes",
  "production_steps",
  "production_events",
  "production_checklists",
  "production_files",
  "audit_logs"
];

const schema = tables.map(table => `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT, updated_at TEXT);`).join("\n");
fs.writeFileSync(schemaFile, `${schema}\n`);

const dataFile = path.join(dataDir, "printsys-data.json");
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify({ migratedAt: new Date().toISOString(), users: [], sessions: [] }, null, 2));
}

console.log("Migracao concluida.");
console.log(`Schema de referencia: ${schemaFile}`);
console.log(`Banco persistente: ${dataFile}`);
