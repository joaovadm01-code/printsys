const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function loadEnv() {
  const envFile = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envFile)) return;
  fs.readFileSync(envFile, "utf8").split(/\r?\n/).forEach(line => {
    const clean = line.trim();
    if (!clean || clean.startsWith("#") || !clean.includes("=")) return;
    const [key, ...rest] = clean.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function fullPermissions() {
  return {
    cash: true,
    quickSale: true,
    blindClose: true,
    financialSummary: true,
    production: true,
    quote: true,
    settings: true,
    operationalExpenses: true,
    expenseApproval: true,
    administration: true,
    commercial: true,
    customerPortal: true,
    bi: true,
    integrations: true,
    orders: true,
    supplies: true,
    technicalVisits: true
  };
}

loadEnv();

const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");
const dataFile = path.join(dataDir, "printsys-data.json");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const email = process.env.ADMIN_EMAIL || "admin@printsys.local";
const password = process.env.ADMIN_PASSWORD;
if (!password || password.trim().length < 6) {
  console.error("Defina ADMIN_PASSWORD com pelo menos 6 caracteres antes de executar o seed.");
  process.exit(1);
}

const data = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, "utf8")) : {};
data.users = Array.isArray(data.users) ? data.users : [];
let admin = data.users.find(user => user.email === email || user.role === "Admin Geral");
if (!admin) {
  admin = {
    id: "u1",
    name: "Joao Victor",
    email,
    username: "joao",
    role: "Admin Geral",
    profile: "Admin/Gestor",
    sector: "Administrativo",
    permissions: fullPermissions(),
    active: true,
    createdAt: new Date().toISOString()
  };
  data.users.push(admin);
}
admin.passwordHash = hashPassword(password);
admin.permissions = fullPermissions();
admin.companyIds = Array.isArray(admin.companyIds) && admin.companyIds.length ? admin.companyIds : ["all"];
admin.companyRoles = admin.companyRoles || { all: "Admin/Gestor" };
admin.defaultCompanyId = admin.defaultCompanyId || "all";
admin.storeAccess = (data.companies || []).map(company => ({ storeId: company.id, role: "Admin/Gestor", permissions: fullPermissions() }));
admin.active = true;
data.accountsReceivable = Array.isArray(data.accountsReceivable) ? data.accountsReceivable : [];
data.accountsPayable = Array.isArray(data.accountsPayable) ? data.accountsPayable : [];
data.technicalVisits = Array.isArray(data.technicalVisits) ? data.technicalVisits : [];
data.productionEvents = Array.isArray(data.productionEvents) ? data.productionEvents : [];
data.productionChecklists = Array.isArray(data.productionChecklists) ? data.productionChecklists : [];
data.sessions = [];
data.seededAt = new Date().toISOString();

fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
console.log(`Admin inicial criado/atualizado: ${email}`);
