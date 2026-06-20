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
const views = [
  ["dashboard", "#dashboard-cards", "work/premium-dashboard.png"],
  ["production-pcp", "#pcp-dashboard-cards, .production-list-panel, #production-detail-table", "work/premium-production.png"],
  ["quote", "#quote-root-shell, #quote-form", "work/premium-quote.png"],
  ["orders-search", ".orders-list-panel, #orders-search-content", "work/premium-orders.png"],
  ["finance-receivables", "#finance-receivables-content, #receivables-table", "work/premium-finance.png"],
  ["cash-receive", "#cash-receive-content, #payment-order-info", "work/premium-cash.png"],
  ["stock-products", ".product-catalog-shell, #product-list", "work/premium-products.png"]
];

async function loginIfNeeded(page) {
  if (!(await page.locator("#login-screen.active").count())) return;
  await page.fill("#login-user", env.ADMIN_EMAIL || "admin@printsys.local");
  await page.fill("#login-password", env.ADMIN_PASSWORD || "AdminTeste123");
  await page.click("#login-form button.primary");
  await page.waitForSelector(".app:not(.auth-blocked)", { timeout: 15000 });
}

async function openView(page, viewId, selector) {
  await page.goto(`${baseUrl}/#${viewId}`, { waitUntil: "domcontentloaded" });
  await loginIfNeeded(page);
  await page.goto(`${baseUrl}/#${viewId}`, { waitUntil: "networkidle" });
  await page.waitForSelector(`#${viewId}.active`, { timeout: 15000 });
  await page.waitForSelector(selector, { timeout: 15000 });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 930 } });
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

  const evidence = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    views: [],
    consoleErrors,
    failedRequests
  };

  for (const [viewId, selector, screenshot] of views) {
    await openView(page, viewId, selector);
    const metrics = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      const header = document.querySelector(".premium-topbar");
      const active = document.querySelector("nav .active");
      const card = document.querySelector(".panel, .card, .manager-card");
      return {
        bodyPremium: document.body.classList.contains("premium-stable-ui"),
        sidebarBackground: aside ? getComputedStyle(aside).backgroundColor : "",
        headerHeight: header ? getComputedStyle(header).height : "",
        activeMenuBackground: active ? getComputedStyle(active).backgroundImage || getComputedStyle(active).backgroundColor : "",
        cardRadius: card ? getComputedStyle(card).borderRadius : ""
      };
    });
    await page.screenshot({ path: screenshot, fullPage: true });
    evidence.views.push({ viewId, screenshot, selector, metrics });
  }

  await browser.close();
  fs.writeFileSync("work/validate-premium-ui.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ ok: true, evidence: "work/validate-premium-ui.json", views: evidence.views.length, consoleErrors, failedRequests }, null, 2));
  if (consoleErrors.length || failedRequests.length) process.exitCode = 2;
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
