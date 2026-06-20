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

(async () => {
  const base = `http://localhost:${env.PORT || 3000}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on("console", message => {
    if (["error"].includes(message.type())) consoleErrors.push(message.text());
  });
  page.on("pageerror", error => consoleErrors.push(error.message));

  await page.goto(`${base}/#stock-products`, { waitUntil: "domcontentloaded" });
  if (await page.locator("#login-screen.active").count()) {
    await page.fill("#login-user", env.ADMIN_EMAIL || "admin@printsys.local");
    await page.fill("#login-password", env.ADMIN_PASSWORD || "AdminTeste123");
    await page.click("#login-form button.primary");
  }
  await page.waitForSelector(".app:not(.auth-blocked)", { timeout: 10000 });
  await page.goto(`${base}/#stock-products`, { waitUntil: "networkidle" });
  await page.waitForSelector("#stock-products.active", { timeout: 10000 });
  await page.waitForSelector("#product-list .product-group-row", { timeout: 10000 });

  const preparationText = await page.locator("text=Funcionalidade em preparação").count();
  if (preparationText) throw new Error("Tela de Produtos ainda exibe funcionalidade em preparação.");

  await page.locator("#product-list .product-group-row").first().click();
  await page.waitForSelector("#product-list .product-group.expanded .product-model-table", { timeout: 10000 });
  const headers = await page.locator(".product-model-table thead").first().innerText();
  const required = ["MODELO", "ACABAMENTO", "UNIDADE", "VARIACAO", "VALOR DE VENDA", "ACOES"];
  const normalizedHeaders = headers.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const missing = required.filter(item => !normalizedHeaders.includes(item));
  if (missing.length) throw new Error(`Tabela de modelos sem colunas: ${missing.join(", ")} | lido: ${JSON.stringify(headers)}`);

  const activeBg = await page.locator(".product-group-row.active").first().evaluate(el => getComputedStyle(el).backgroundImage || getComputedStyle(el).backgroundColor);
  if (!/rgb|linear-gradient/i.test(activeBg)) throw new Error("Produto expandido nao recebeu destaque visual.");

  const screenshot = "work/product-module-validation.png";
  await page.screenshot({ path: screenshot, fullPage: true });
  const productRows = await page.locator("#product-list .product-group-row").count();
  await browser.close();

  console.log(JSON.stringify({
    ok: true,
    url: `${base}/#stock-products`,
    productRows,
    screenshot,
    consoleErrors
  }, null, 2));
  if (consoleErrors.length) process.exitCode = 2;
})().catch(async error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
