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
  const flowReport = fs.existsSync("work/validate-production-pcp-flow.json")
    ? JSON.parse(fs.readFileSync("work/validate-production-pcp-flow.json", "utf8"))
    : {};
  const orderId = flowReport.approvedOrderId || "";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", error => consoleErrors.push(error.message));
  page.on("response", response => {
    if (response.status() >= 400 && !response.url().includes("/favicon")) failedRequests.push({ status: response.status(), url: response.url() });
  });

  await page.goto(base, { waitUntil: "domcontentloaded" });
  if (await page.locator("#login-screen.active").count()) {
    await page.fill("#login-user", config.ADMIN_EMAIL || "admin@printsys.local");
    await page.fill("#login-password", config.ADMIN_PASSWORD || "AdminTeste123");
    await page.click("#login-form button.primary");
  }
  await page.waitForSelector("nav.erp-nav-hierarchical [data-view]", { timeout: 10000 });
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("nav [data-view]")].find(item => item.dataset.view === "production-pcp");
    button?.click();
  });
  await page.waitForSelector("#production-order-detail-panel", { timeout: 10000 });
  await page.click('[data-production-scope="all"]');
  await page.waitForTimeout(500);
  if (orderId && await page.locator(`[data-production-action="ver-detalhes"][data-order="${orderId}"]`).count()) {
    await page.click(`[data-production-action="ver-detalhes"][data-order="${orderId}"]`);
  } else if (await page.locator('[data-production-action="ver-detalhes"]').count()) {
    await page.locator('[data-production-action="ver-detalhes"]').first().click();
  }
  if (orderId) {
    await page.evaluate(id => {
      if (typeof renderProductionOrderDetailPanel === "function") renderProductionOrderDetailPanel(id);
    }, orderId);
  }
  await page.waitForTimeout(300);
  const validation = await page.evaluate(expectedOrderId => {
    const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const panel = document.querySelector("#production-order-detail-panel");
    const text = panel?.innerText || "";
    const normalizedText = normalize(text);
    const buttons = [...panel.querySelectorAll("button")].map(button => button.textContent.trim());
    const normalizedButtons = buttons.map(normalize);
    return {
      expectedOrderId,
      hasPanel: Boolean(panel),
      hasOrder: !expectedOrderId || text.includes(expectedOrderId),
      hasTechnical: normalizedText.includes("detalhes tecnicos"),
      hasFiles: normalizedText.includes("arquivos / anexos"),
      hasNotes: normalizedText.includes("comercial / vendedor") && normalizedText.includes("producao"),
      hasHistory: normalizedText.includes("historico da o.s."),
      hasRealActions: ["adicionar observacao", "registrar duvida", "ver arquivos", "abrir o.s.", "imprimir o.s."].every(label => normalizedButtons.includes(label)),
      buttons,
      textLength: text.length
    };
  }, orderId);
  await page.screenshot({ path: "work/validate-production-pcp-ui.png", fullPage: true });
  await browser.close();

  const failed = Object.entries(validation).filter(([key, value]) => key.startsWith("has") && !value).map(([key]) => key);
  const report = {
    generatedAt: new Date().toISOString(),
    base,
    orderId,
    validation,
    consoleErrors,
    failedRequests,
    failed
  };
  fs.writeFileSync("work/validate-production-pcp-ui.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    orderId,
    failures: failed.length,
    consoleErrors: consoleErrors.length,
    failedRequests: failedRequests.length,
    output: "work/validate-production-pcp-ui.json",
    screenshot: "work/validate-production-pcp-ui.png"
  }, null, 2));
  if (failed.length || consoleErrors.length || failedRequests.length) process.exitCode = 1;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
