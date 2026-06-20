const fs = require("fs");
const { chromium } = require("C:/Users/piaui/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright");

function readEnv() {
  if (!fs.existsSync(".env")) return {};
  return Object.fromEntries(
    fs.readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#") && line.includes("="))
      .map(line => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const env = readEnv();
const baseUrl = `http://localhost:${env.PORT || 3000}`;
let cookieHeader = "";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookieHeader = setCookie.split(",").map(part => part.split(";")[0]).join("; ");
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path} -> ${response.status}: ${data.error || text}`);
  return data;
}

async function loginApi() {
  await request("/api/auth/login", {
    method: "POST",
    body: {
      login: env.ADMIN_EMAIL || "admin@printsys.local",
      password: env.ADMIN_PASSWORD || "AdminTeste123"
    }
  });
}

async function validateStock() {
  const materials = await request("/api/materials");
  if (!materials.length) throw new Error("Nenhum material cadastrado para validar estoque");
  const material = materials[0];
  const original = Number(material.stock || 0);
  const entry = await request("/api/stock-movements", {
    method: "POST",
    body: {
      materialId: material.id,
      type: "entry",
      quantity: 3,
      reason: "Validacao operacional de entrada",
      responsible: "QA PrintSys"
    }
  });
  if (Number(entry.material.stock) !== original + 3) throw new Error("Entrada de estoque nao atualizou saldo corretamente");
  const output = await request("/api/stock-movements", {
    method: "POST",
    body: {
      materialId: material.id,
      type: "output",
      quantity: 1,
      reason: "Validacao operacional de saida",
      responsible: "QA PrintSys"
    }
  });
  if (Number(output.material.stock) !== original + 2) throw new Error("Saida de estoque nao atualizou saldo corretamente");
  const adjustment = await request("/api/stock-movements", {
    method: "POST",
    body: {
      materialId: material.id,
      type: "adjustment",
      newBalance: original,
      reason: "Validacao operacional de ajuste",
      responsible: "QA PrintSys"
    }
  });
  if (Number(adjustment.material.stock) !== original) throw new Error("Ajuste de estoque nao retornou saldo esperado");
  const movements = await request(`/api/stock-movements?materialId=${encodeURIComponent(material.id)}`);
  const found = ["Validacao operacional de entrada", "Validacao operacional de saida", "Validacao operacional de ajuste"].every(reason => movements.some(item => item.reason === reason));
  if (!found) throw new Error("Historico de estoque nao registrou todos os movimentos de validacao");
  return {
    materialId: material.id,
    materialName: material.name,
    original,
    finalBalance: adjustment.material.stock,
    movementIds: [entry.movement.id, output.movement.id, adjustment.movement.id]
  };
}

async function validateVisits() {
  const customers = await request("/api/customers");
  if (!customers.length) throw new Error("Nenhum cliente cadastrado para validar visitas tecnicas");
  const employees = await request("/api/employees");
  const customer = customers[0];
  const employee = employees[0] || {};
  const created = await request("/api/technical-visits", {
    method: "POST",
    body: {
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone || customer.mobile || "",
      address: customer.address || "Endereco de validacao",
      city: customer.city || "Fortaleza",
      neighborhood: customer.neighborhood || "Centro",
      requestedDate: new Date().toISOString().slice(0, 10),
      scheduledDate: "2026-06-22T09:00",
      responsibleEmployeeId: employee.id || "",
      responsibleEmployeeName: employee.name || "QA PrintSys",
      visitType: "measurement",
      notes: "Criada pela validacao operacional"
    }
  });
  const edited = await request(`/api/technical-visits/${created.id}`, {
    method: "PATCH",
    body: {
      scheduledDate: "2026-06-23T10:30",
      status: "scheduled",
      measurementNotes: "Medidas preliminares: 2,00 x 1,00m",
      notes: "Reagendada pela validacao operacional"
    }
  });
  if (edited.status !== "scheduled") throw new Error("Reagendamento da visita nao salvou status agendado");
  const completed = await request(`/api/technical-visits/${created.id}/complete`, {
    method: "POST",
    body: {
      measurementNotes: "Medidas finais: 2,00 x 1,00m. Parede lisa.",
      photos: ["validacao-visita.jpg"]
    }
  });
  if (completed.status !== "completed") throw new Error("Conclusao da visita tecnica nao alterou status");
  return {
    visitId: completed.id,
    customerName: completed.customerName,
    responsible: completed.responsibleEmployeeName,
    status: completed.status,
    measurementNotes: completed.measurementNotes
  };
}

async function loginIfNeeded(page) {
  if (!(await page.locator("#login-screen.active").count())) return;
  await page.fill("#login-user", env.ADMIN_EMAIL || "admin@printsys.local");
  await page.fill("#login-password", env.ADMIN_PASSWORD || "AdminTeste123");
  await page.click("#login-form button.primary");
  await page.waitForSelector(".app:not(.auth-blocked)", { timeout: 15000 });
}

async function validateUi() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", error => consoleErrors.push(error.message));
  page.on("requestfailed", request => {
    const url = request.url();
    if (url.startsWith(baseUrl)) failedRequests.push(`${request.method()} ${url}: ${request.failure()?.errorText || "failed"}`);
  });
  await page.goto(`${baseUrl}/#stock-movements`, { waitUntil: "domcontentloaded" });
  await loginIfNeeded(page);
  await page.goto(`${baseUrl}/#stock-movements`, { waitUntil: "networkidle" });
  await page.waitForSelector("#stock-movements.active #stock-movement-form", { timeout: 15000 });
  const stockMetrics = await page.evaluate(() => ({
    hasForm: Boolean(document.querySelector("#stock-movement-form")),
    hasHistory: Boolean(document.querySelector("#stock-movements-tools .focused-data-table")),
    buttonCount: document.querySelectorAll("#stock-movements-tools button").length,
    oversizedCards: [...document.querySelectorAll("#stock-movements-tools .panel")].filter(panel => panel.getBoundingClientRect().height > 760).length
  }));
  await page.screenshot({ path: "work/stock-operational.png", fullPage: true });
  await page.goto(`${baseUrl}/#visits-new`, { waitUntil: "networkidle" });
  await page.waitForSelector("#visits-new.active #technical-visit-form", { timeout: 15000 });
  const visitMetrics = await page.evaluate(() => ({
    hasForm: Boolean(document.querySelector("#technical-visit-form")),
    hasCustomerSelect: Boolean(document.querySelector("#visit-customer")),
    hasResponsibleSelect: Boolean(document.querySelector("#visit-employee")),
    formHeight: Math.round(document.querySelector("#technical-visit-form")?.getBoundingClientRect().height || 0)
  }));
  await page.screenshot({ path: "work/technical-visits-operational.png", fullPage: true });
  await browser.close();
  if (consoleErrors.length) throw new Error(`Console com erros: ${consoleErrors.join(" | ")}`);
  if (failedRequests.length) throw new Error(`Requisicoes falharam: ${failedRequests.join(" | ")}`);
  return { stockMetrics, visitMetrics, consoleErrors, failedRequests };
}

(async () => {
  await loginApi();
  const evidence = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    stock: await validateStock(),
    visits: await validateVisits(),
    ui: await validateUi()
  };
  fs.writeFileSync("work/validate-stock-visits-operational.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
