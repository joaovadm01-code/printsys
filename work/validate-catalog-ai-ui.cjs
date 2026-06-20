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

async function loginIfNeeded(page) {
  if (!(await page.locator("#login-screen.active").count())) return;
  await page.fill("#login-user", env.ADMIN_EMAIL || "admin@printsys.local");
  await page.fill("#login-password", env.ADMIN_PASSWORD || "AdminTeste123");
  await page.click("#login-form button.primary");
  await page.waitForSelector(".app:not(.auth-blocked)", { timeout: 15000 });
}

async function go(page, view) {
  await page.goto(`${baseUrl}/#${view}`, { waitUntil: "domcontentloaded" });
  await loginIfNeeded(page);
  await page.goto(`${baseUrl}/#${view}`, { waitUntil: "networkidle" });
  await page.waitForSelector(`#${view}.active`, { timeout: 15000 });
}

(async () => {
  const evidence = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    screenshots: {},
    checks: []
  };
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const consoleErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", error => consoleErrors.push(error.message));

  await go(page, "stock-products");
  await page.waitForSelector(".product-catalog-shell", { timeout: 15000 });
  await page.waitForSelector(".catalog-product-card, .product-group-row", { timeout: 15000 });
  const productCards = await page.locator(".catalog-product-card").count();
  const productRows = await page.locator(".product-group-row").count();
  if (!productCards && !productRows) throw new Error("Catalogo de produtos nao renderizou cards nem linhas.");
  const firstProductRow = page.locator(".product-group-row").first();
  if (await firstProductRow.count()) {
    await firstProductRow.click();
    await page.waitForSelector(".product-group.expanded", { timeout: 10000 });
  }
  evidence.screenshots.products = "work/catalog-ai-products.png";
  await page.screenshot({ path: evidence.screenshots.products, fullPage: true });
  evidence.checks.push({ name: "products_catalog", productCards, productRows, status: "ok" });

  await go(page, "quote");
  await page.waitForSelector("#quote-project-recognition-panel", { timeout: 15000 });
  await page.fill("#quote-project-request", "Fachada ACM 10x1,20 com LED e instalacao");
  await page.fill("#quote-project-text", "Cliente pediu fachada ACM 10 metros por 1,20 metros, LED interno e instalacao no local.");
  await page.click('[data-project-action="analyze"]');
  await page.waitForSelector(".project-suggestion-card", { timeout: 15000 });
  const suggestions = await page.locator(".project-suggestion-card").count();
  if (!suggestions) throw new Error("Reconhecimento de projeto nao retornou sugestoes.");
  evidence.screenshots.quote = "work/catalog-ai-quote.png";
  await page.screenshot({ path: evidence.screenshots.quote, fullPage: true });
  evidence.checks.push({ name: "quote_project_recognition", suggestions, status: "ok" });

  await go(page, "settings-communication");
  await page.waitForSelector("#communication-settings-form", { timeout: 15000 });
  const modeText = await page.locator("#comm-whatsapp-mode").inputValue();
  evidence.screenshots.communication = "work/catalog-ai-communication.png";
  await page.screenshot({ path: evidence.screenshots.communication, fullPage: true });
  evidence.checks.push({ name: "communication_settings_screen", mode: modeText, status: "ok" });

  await browser.close();
  evidence.consoleErrors = consoleErrors;
  fs.writeFileSync("work/validate-catalog-ai-ui.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ ok: true, evidence: "work/validate-catalog-ai-ui.json", screenshots: evidence.screenshots, consoleErrors }, null, 2));
  if (consoleErrors.length) process.exitCode = 2;
})().catch(async error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
