const fs = require("fs");
const { chromium } = require("C:/Users/piaui/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright");

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#") && line.includes("="))
    .map(line => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const baseUrl = `http://localhost:${env.PORT || 3000}`;
let cookie = "";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      cookie,
      ...(options.headers || {})
    },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path} -> ${response.status}: ${data.error || text}`);
  return data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const evidence = { generatedAt: new Date().toISOString(), baseUrl, steps: [] };
  const step = (name, data = {}) => evidence.steps.push({ name, ...data });

  await request("/api/auth/login", { method: "POST", body: { login: env.ADMIN_EMAIL || "admin@printsys.local", password: env.ADMIN_PASSWORD || "AdminTeste123" } });
  step("login_admin", { status: "ok" });

  const settings = await request("/api/print-settings");
  assert(settings.primaryColor, "Configuracao de impressao nao retornou cor principal");
  const updatedSettings = await request("/api/print-settings", {
    method: "POST",
    body: {
      ...settings,
      primaryColor: "#2563eb",
      secondaryColor: "#f4e8fa",
      textColor: "#202124",
      footerText: "Documento validado pelo PrintSys ERP.",
      showAddress: true,
      showCnpj: true,
      showPhone: true,
      showSeller: true,
      showEmployeeContact: true,
      showCustomerDocument: true,
      showSignature: true,
      showQrCode: false
    }
  });
  assert(updatedSettings.footerText.includes("PrintSys"), "Configuracao de impressao nao persistiu rodape");
  step("print_settings_saved", { companyId: updatedSettings.companyId, primaryColor: updatedSettings.primaryColor });

  const customersBefore = await request("/api/customers");
  const products = await request("/api/products");
  const product = products.find(item => item.active !== false) || products[0];
  assert(product, "Produto base nao encontrado");
  const unique = Date.now().toString().slice(-8);
  const documentNumber = `12345678${unique.slice(-3)}`;
  const whatsapp = `8599${unique}`;
  const customer = await request("/api/customers", {
    method: "POST",
    body: {
      name: `Cliente Comunicacao ${unique}`,
      document: documentNumber,
      phone: whatsapp,
      whatsapp,
      email: `cliente${unique}@example.com`,
      address: "Rua de Teste",
      contactPerson: "Responsavel teste",
      communicationPreference: "both",
      origin: "Homologacao"
    }
  });
  assert(customer.whatsapp, "Cliente nao salvou WhatsApp");
  assert(customer.communicationPreference === "both", "Cliente nao salvou preferencia de comunicacao");
  step("customer_contact_saved", { customerId: customer.id, previousCount: customersBefore.length });

  const quote = await request("/api/quotes", {
    method: "POST",
    body: {
      customerId: customer.id,
      productId: product.id,
      jobName: "Validacao impressao e comunicacao",
      answers: { width: 1, height: 1, quantity: 1, seller: "Validador", deadline: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
      user: "Validador"
    }
  });
  const order = await request(`/api/quotes/${quote.id}/approve`, { method: "POST", body: { approvedBy: "Validador" } });
  step("quote_order_notifications_triggered", { quoteId: quote.id, orderId: order.id });

  const notifications = await request("/api/notifications");
  const customerNotifications = notifications.queue.filter(item => item.customerId === customer.id);
  assert(customerNotifications.some(item => item.event === "quote.created"), "Fila nao registrou notificacao de orcamento criado");
  assert(customerNotifications.some(item => item.event === "service_order.created"), "Fila nao registrou notificacao de O.S. criada");
  assert(customerNotifications.some(item => item.whatsappLink || item.channel === "Email"), "Notificacao nao possui canal/link de envio");
  const pending = customerNotifications.find(item => item.status === "pending");
  if (pending) await request(`/api/notifications/${pending.id}/mark-sent`, { method: "POST", body: { user: "Validador" } });
  step("notification_queue_validated", { generated: customerNotifications.length, markedSent: pending?.id || "" });

  const tracking = await request(`/api/customer-tracking?document=${encodeURIComponent(documentNumber)}&whatsapp=${encodeURIComponent(whatsapp)}`);
  assert(tracking.orders.some(item => item.id === order.id), "Rastreio do cliente nao retornou a O.S. criada");
  const trackingJson = JSON.stringify(tracking).toLowerCase();
  assert(!trackingJson.includes("predictedcost") && !trackingJson.includes("profit") && !trackingJson.includes("margem"), "Rastreio expos campo interno de custo/lucro");
  step("customer_tracking_safe", { orders: tracking.orders.length, quotes: tracking.quotes.length });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => consoleErrors.push(error.message));
  await page.goto(`${baseUrl}/#settings-printing`, { waitUntil: "domcontentloaded" });
  if (await page.locator("#login-screen.active").count()) {
    await page.fill("#login-user", env.ADMIN_EMAIL || "admin@printsys.local");
    await page.fill("#login-password", env.ADMIN_PASSWORD || "AdminTeste123");
    await page.click("#login-form button.primary");
  }
  await page.waitForSelector("#settings-printing.active", { timeout: 15000 });
  await page.waitForSelector("#print-settings-form", { timeout: 15000 });
  const printSettingsScreenshot = "work/print-settings-validation.png";
  await page.screenshot({ path: printSettingsScreenshot, fullPage: true });
  await page.goto(`${baseUrl}/#notifications-center`, { waitUntil: "networkidle" });
  await page.waitForSelector("#notifications-center.active", { timeout: 15000 });
  await page.waitForSelector("#notifications-queue-table", { timeout: 15000 });
  await page.goto(`${baseUrl}/customer-tracking.html`, { waitUntil: "networkidle" });
  await page.fill("#tracking-document", documentNumber);
  await page.fill("#tracking-whatsapp", whatsapp);
  await page.click("#tracking-form button.primary");
  await page.waitForSelector(".tracking-order-card", { timeout: 15000 });
  const screenshot = "work/print-communication-validation.png";
  await page.screenshot({ path: screenshot, fullPage: true });
  await browser.close();
  step("browser_validation", { screenshot, printSettingsScreenshot, consoleErrors });

  fs.writeFileSync("work/validate-print-communication.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ ok: true, evidence: "work/validate-print-communication.json", screenshot, printSettingsScreenshot, consoleErrors }, null, 2));
  if (consoleErrors.length) process.exitCode = 2;
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
