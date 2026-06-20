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

(async () => {
  const config = env();
  const base = `http://localhost:${config.PORT || 3000}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", error => consoleErrors.push(error.message));
  page.on("response", response => {
    const status = response.status();
    if (status >= 400 && !response.url().includes("/favicon")) failedRequests.push({ status, url: response.url() });
  });

  await page.goto(base, { waitUntil: "domcontentloaded" });
  if (await page.locator("#login-screen.active").count()) {
    await page.fill("#login-user", config.ADMIN_EMAIL || "admin@printsys.local");
    await page.fill("#login-password", config.ADMIN_PASSWORD || "AdminTeste123");
    await page.click("#login-form button.primary");
  }
  await page.waitForSelector(".app:not(.auth-blocked)", { timeout: 10000 });
  await page.waitForSelector("nav.erp-nav-hierarchical [data-view]", { timeout: 10000 });
  await page.waitForTimeout(300);

  const menu = await page.evaluate(() => [...document.querySelectorAll("nav [data-view]")].map(button => ({
    view: button.dataset.view,
    label: button.textContent.trim().replace(/\s+/g, " "),
    permission: button.dataset.requiredPermission || "",
    group: button.dataset.menuGroup || button.closest(".nav-section")?.querySelector(".nav-parent")?.textContent?.trim().replace(/\s+/g, " ") || "Direto"
  })));

  const uniqueViews = [...new Map(menu.map(item => [item.view, item])).values()];
  const screens = [];
  for (const item of uniqueViews) {
    await page.evaluate(viewName => {
      const button = [...document.querySelectorAll("nav [data-view]")].find(item => item.dataset.view === viewName);
      button?.click();
    }, item.view);
    await page.waitForTimeout(120);
    const info = await page.evaluate(expected => {
      const active = document.querySelector(".view.active");
      const visibleText = active?.innerText || "";
      const forbidden = /Funcionalidade em prepara|em prepara[cç][aã]o|em breve/i.test(visibleText);
      return {
        expected,
        activeId: active?.id || "",
        title: active?.querySelector("h1,h2,.title strong,.focused-page-head h1")?.textContent?.trim() || "",
        textLength: visibleText.trim().length,
        forbidden,
        blank: visibleText.trim().length < 20
      };
    }, item.view);
    screens.push({ ...item, ...info, ok: info.activeId === item.view && !info.forbidden && !info.blank });
  }

  const navGroups = await page.evaluate(() => [...document.querySelectorAll("nav .nav-section")].map(section => ({
    label: section.querySelector(".nav-parent")?.textContent?.trim().replace(/\s+/g, " ") || "",
    items: [...section.querySelectorAll(".nav-children [data-view]")].map(button => button.textContent.trim().replace(/\s+/g, " "))
  })));

  await page.screenshot({ path: "work/audit-operational-ui.png", fullPage: true });
  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    base,
    menuItems: uniqueViews.length,
    navGroups,
    screens,
    failures: screens.filter(item => !item.ok),
    consoleErrors,
    failedRequests
  };
  fs.writeFileSync("work/audit-operational-ui.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    menuItems: report.menuItems,
    failures: report.failures.length,
    consoleErrors: consoleErrors.length,
    failedRequests: failedRequests.length,
    output: "work/audit-operational-ui.json",
    screenshot: "work/audit-operational-ui.png"
  }, null, 2));
  if (report.failures.length || consoleErrors.length || failedRequests.length) process.exitCode = 1;
})();
