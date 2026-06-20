const fs = require("fs");

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

async function request(base, method, path, cookie, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return {
      path,
      method,
      status: response.status,
      ok: response.ok,
      setCookie: response.headers.get("set-cookie") || "",
      data,
      empty: data == null || (Array.isArray(data) && data.length === 0) || (typeof data === "object" && !Array.isArray(data) && Object.keys(data).length === 0)
    };
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  const config = env();
  const base = `http://localhost:${config.PORT || 3000}`;
  const login = await request(base, "POST", "/api/auth/login", "", {
    login: config.ADMIN_EMAIL || "admin@printsys.local",
    password: config.ADMIN_PASSWORD || "AdminTeste123"
  });

  const cookie = login.setCookie.split(";")[0];
  const checks = [
    ["/api/auth/status", false],
    ["/api/me", false],
    ["/api/dashboard", false],
    ["/api/customers", true],
    ["/api/products", false],
    ["/api/products/grouped", false],
    ["/api/compositions", false],
    ["/api/quotes", false],
    ["/api/reports/quoted-approved", true],
    ["/api/orders", false],
    ["/api/production/orders", false],
    ["/api/production/pcp", false],
    ["/api/production/reports", false],
    ["/api/materials", false],
    ["/api/finance", false],
    ["/api/finance/receivables", true],
    ["/api/finance/payables", true],
    ["/api/dre", false],
    ["/api/cash/report", false],
    ["/api/cash/daily-summary", false],
    ["/api/operational-expenses", true],
    ["/api/vehicles", false],
    ["/api/cost-centers", false],
    ["/api/employees", false],
    ["/api/sectors", false],
    ["/api/technical-visits", true],
    ["/api/intelligence", false],
    ["/api/search/global?q=OS", false],
    ["/api/alerts", true],
    ["/api/audit", true]
  ];

  const results = [];
  if (!login.ok || !cookie) {
    results.push({ ...login, category: "auth", problem: "Login admin falhou ou nao retornou cookie de sessao." });
  } else {
    results.push({ path: "/api/auth/login", method: "POST", status: login.status, ok: true, empty: false });
    for (const [path, allowEmpty] of checks) {
      const result = await request(base, "GET", path, cookie);
      results.push({
        path,
        method: "GET",
        status: result.status,
        ok: result.ok && ![401, 403, 500].includes(result.status) && (allowEmpty || !result.empty),
        empty: result.empty,
        allowEmpty
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    base,
    total: results.length,
    passed: results.filter(item => item.ok).length,
    failed: results.filter(item => !item.ok),
    results
  };
  fs.writeFileSync("work/audit-api-smoke.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    total: report.total,
    passed: report.passed,
    failures: report.failed.length,
    output: "work/audit-api-smoke.json"
  }, null, 2));
  if (report.failed.length) process.exitCode = 1;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
