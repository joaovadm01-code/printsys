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
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const error = new Error(data?.error || `${method} ${path} retornou ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return { data, setCookie: response.headers.get("set-cookie") || "", status: response.status };
}

async function api(base, cookie, method, path, body) {
  return (await request(base, method, path, cookie, body)).data;
}

function pickProductionProduct(products, compositions) {
  const composition = compositions.find(item => /lona|faixa/i.test(item.name || ""))
    || compositions.find(item => (item.productionFlow || []).length)
    || compositions[0];
  const product = products.find(item => item.id === composition?.productId) || products.find(item => item.active !== false) || products[0];
  return { product, composition };
}

async function createProductionOrder(base, cookie, suffix) {
  const [customers, products, compositions] = await Promise.all([
    api(base, cookie, "GET", "/api/customers"),
    api(base, cookie, "GET", "/api/products"),
    api(base, cookie, "GET", "/api/compositions")
  ]);
  const customer = customers[0];
  const { product, composition } = pickProductionProduct(products, compositions);
  if (!customer) throw new Error("Nao existe cliente real para criar orcamento de homologacao.");
  if (!product) throw new Error("Nao existe produto real para criar orcamento de homologacao.");
  const quote = await api(base, cookie, "POST", "/api/quotes", {
    customerId: customer.id,
    productId: product.id,
    compositionId: composition?.id || "",
    jobName: `Homologacao PCP ${suffix}`,
    files: [`arte-homologacao-${suffix}.pdf`],
    answers: {
      width: 2,
      height: 1,
      quantity: 1,
      compositionId: composition?.id || "",
      seller: "Auditoria PCP",
      attendant: "Auditoria PCP",
      deadline: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      clientNote: `Observacao comercial da homologacao ${suffix}`,
      productionNote: `Observacao tecnica da homologacao ${suffix}`,
      internalProductionWarnings: "Conferir arquivo aprovado antes de iniciar.",
      fileInstructions: "Usar somente arquivo anexado no teste.",
      installationNotes: "Instalacao somente se rota exigir."
    },
    user: "Auditoria PCP"
  });
  const order = await api(base, cookie, "POST", `/api/quotes/${quote.id}/approve`, {
    approvedBy: "Auditoria PCP",
    user: "Auditoria PCP"
  });
  await api(base, cookie, "POST", `/api/orders/${order.id}/send-pcp`, {
    authorizedBy: "Auditoria PCP",
    user: "Auditoria PCP"
  });
  await api(base, cookie, "POST", `/api/orders/${order.id}/files`, {
    fileName: `producao-homologacao-${suffix}.pdf`,
    type: "production",
    user: "Auditoria PCP",
    observation: "Arquivo anexado pela homologacao de PCP."
  });
  await api(base, cookie, "GET", `/api/orders/${order.id}/files/${encodeURIComponent(`producao-homologacao-${suffix}.pdf`)}/download`);
  await api(base, cookie, "POST", `/api/orders/${order.id}/production-events`, {
    action: "observacao",
    observation: `Observacao de producao ${suffix}`,
    user: "Auditoria PCP"
  });
  await api(base, cookie, "POST", `/api/orders/${order.id}/production-events`, {
    action: "observacao",
    observation: `Duvida da producao: validar acabamento ${suffix}`,
    user: "Auditoria PCP"
  });
  return { quote, order };
}

async function runUntilHomologation(base, cookie, orderId) {
  const statuses = [];
  let pausedOnce = false;
  for (let index = 0; index < 10; index += 1) {
    let orders = await api(base, cookie, "GET", "/api/orders");
    let order = orders.find(item => item.id === orderId);
    statuses.push(order.productionStatus);
    if (/homologacao/i.test(order.productionStatus || "")) return statuses;
    if (/finalizada|entregue|cancelada|liberada/i.test(order.productionStatus || "")) return statuses;
    await api(base, cookie, "POST", `/api/orders/${orderId}/production-events`, {
      action: "iniciar",
      user: "Auditoria PCP",
      observation: "Inicio validado pela homologacao automatizada."
    });
    if (!pausedOnce) {
      await api(base, cookie, "POST", `/api/orders/${orderId}/production-events`, {
        action: "pausar",
        pauseReason: "Pausa obrigatoria para validar regra de motivo.",
        observation: "Pausa obrigatoria para validar regra de motivo.",
        user: "Auditoria PCP"
      });
      await api(base, cookie, "POST", `/api/orders/${orderId}/production-events`, {
        action: "retomar",
        observation: "Retomada validada pela homologacao automatizada.",
        user: "Auditoria PCP"
      });
      pausedOnce = true;
    }
    await api(base, cookie, "POST", `/api/orders/${orderId}/production-checklist`, {
      requiredItems: ["Conferencia da etapa", "Qualidade validada"],
      items: ["Conferencia da etapa", "Qualidade validada"],
      observation: "Checklist minimo validado pela homologacao automatizada.",
      responsible: "Auditoria PCP"
    });
    await api(base, cookie, "POST", `/api/orders/${orderId}/production-events`, {
      action: "finalizar",
      observation: "Etapa finalizada pela homologacao automatizada.",
      user: "Auditoria PCP"
    });
  }
  throw new Error(`O.S. ${orderId} nao chegou a homologacao dentro do limite de etapas.`);
}

(async () => {
  const config = env();
  const base = `http://localhost:${config.PORT || 3000}`;
  const login = await request(base, "POST", "/api/auth/login", "", {
    login: config.ADMIN_EMAIL || "admin@printsys.local",
    password: config.ADMIN_PASSWORD || "AdminTeste123"
  });
  const cookie = login.setCookie.split(";")[0];
  if (!cookie) throw new Error("Login nao retornou cookie de sessao.");

  const approvedFlow = await createProductionOrder(base, cookie, "aprovada");
  const approvedStatuses = await runUntilHomologation(base, cookie, approvedFlow.order.id);
  await api(base, cookie, "POST", `/api/orders/${approvedFlow.order.id}/production-events`, {
    action: "homologar",
    observation: "Homologacao aprovada e liberada para entrega.",
    user: "Auditoria PCP"
  });

  const reworkFlow = await createProductionOrder(base, cookie, "retrabalho");
  const reworkStatuses = await runUntilHomologation(base, cookie, reworkFlow.order.id);
  await api(base, cookie, "POST", `/api/orders/${reworkFlow.order.id}/production-events`, {
    action: "reprovar",
    reworkReason: "Reprovada na conferencia para validar retorno ao retrabalho.",
    observation: "Reprovada na conferencia para validar retorno ao retrabalho.",
    user: "Auditoria PCP"
  });

  const [orders, production, attachments] = await Promise.all([
    api(base, cookie, "GET", "/api/orders"),
    api(base, cookie, "GET", "/api/production/pcp?scope=all&view=all"),
    api(base, cookie, "GET", "/api/production/attachments?scope=all")
  ]);
  const approvedOrder = orders.find(item => item.id === approvedFlow.order.id);
  const reworkOrder = orders.find(item => item.id === reworkFlow.order.id);
  const criticalChecks = [
    ["O.S. aprovada liberada", approvedOrder?.productionStatus === "Liberada para entrega"],
    ["O.S. reprovada em retrabalho", reworkOrder?.productionStatus === "Retrabalho"],
    ["Historico aprovado possui eventos", (approvedOrder?.events || []).length >= 6],
    ["Historico retrabalho possui eventos", (reworkOrder?.events || []).length >= 6],
    ["Anexos consultaveis", Array.isArray(attachments.rows || attachments.query?.rows || attachments.orders)],
    ["PCP respondeu com linhas", Number(production.total || production.query?.total || 0) > 0]
  ];
  const failed = criticalChecks.filter(([, ok]) => !ok).map(([name]) => name);
  const report = {
    generatedAt: new Date().toISOString(),
    base,
    approvedOrderId: approvedFlow.order.id,
    approvedStatuses,
    approvedFinalStatus: approvedOrder?.productionStatus,
    reworkOrderId: reworkFlow.order.id,
    reworkStatuses,
    reworkFinalStatus: reworkOrder?.productionStatus,
    checks: Object.fromEntries(criticalChecks),
    failed
  };
  fs.writeFileSync("work/validate-production-pcp-flow.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    approvedOrderId: report.approvedOrderId,
    approvedFinalStatus: report.approvedFinalStatus,
    reworkOrderId: report.reworkOrderId,
    reworkFinalStatus: report.reworkFinalStatus,
    failures: failed.length,
    output: "work/validate-production-pcp-flow.json"
  }, null, 2));
  if (failed.length) process.exitCode = 1;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
