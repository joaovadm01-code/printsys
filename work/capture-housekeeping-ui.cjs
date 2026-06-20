const fs = require("fs");
const { chromium } = require("C:/Users/piaui/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright");

function env() {
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

const config = env();
const baseUrl = process.env.PRINTSYS_URL || `http://localhost:${config.PORT || 3000}`;
const adminLogin = process.env.ADMIN_EMAIL || config.ADMIN_EMAIL || "admin@printsys.local";
const adminPassword = process.env.ADMIN_PASSWORD || config.ADMIN_PASSWORD || "AdminTeste123";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", request => failedRequests.push(request.url()));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.fill("#login-user", adminLogin);
  await page.fill("#login-password", adminPassword);
  await page.click("#login-form .primary");
  await page.waitForSelector("nav.erp-nav-hierarchical [data-view]", { timeout: 15000 });
  const views = ["orders-rework", "orders-courtesy", "orders-cancelled", "production-move"];
  const screenshots = [];
  for (const view of views) {
    await page.locator(`[data-view="${view}"]`).evaluate(button => {
      button.closest(".nav-section")?.classList.add("open");
      button.click();
    });
    await page.waitForSelector(`#${view}.active`, { timeout: 10000 });
    const path = `work/${view}-housekeeping.png`;
    await page.screenshot({ path, fullPage: true });
    screenshots.push(path);
  }
  const result = { generatedAt: new Date().toISOString(), screenshots, consoleErrors, failedRequests };
  fs.writeFileSync("work/capture-housekeeping-ui.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  if (consoleErrors.length || failedRequests.length) process.exit(1);
})().catch(async error => {
  console.error(error);
  process.exit(1);
});
