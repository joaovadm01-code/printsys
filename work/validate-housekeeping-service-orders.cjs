const fs = require("fs");

const baseUrl = process.env.PRINTSYS_URL || "http://localhost:3000";
const adminLogin = process.env.ADMIN_EMAIL || "admin@printsys.local";
const adminPassword = process.env.ADMIN_PASSWORD || "AdminTeste123";
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
  const evidence = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    steps: []
  };
  const step = (name, data = {}) => evidence.steps.push({ name, ...data });

  await request("/api/auth/login", { method: "POST", body: { login: adminLogin, password: adminPassword } });
  step("login_admin", { status: "ok" });

  const customers = await request("/api/customers");
  const products = await request("/api/products");
  const sectors = await request("/api/sectors");
  const employees = await request("/api/employees");
  assert(customers.length, "Cliente base nao encontrado");
  assert(products.length, "Produto base nao encontrado");
  assert(sectors.length, "Setor base nao encontrado");
  assert(employees.length, "Funcionario base nao encontrado");
  const product = products.find(item => item.active !== false) || products[0];
  step("base_data", { customerId: customers[0].id, productId: product.id, sector: sectors[0].name, employee: employees[0].name });

  const quote = await request("/api/quotes", {
    method: "POST",
    body: {
      customerId: customers[0].id,
      productId: product.id,
      jobName: "O.S. temporaria validacao housekeeping",
      answers: { width: 1, height: 1, quantity: 1, seller: "Validador", deadline: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
      user: "Validador"
    }
  });
  const sourceOrder = await request(`/api/quotes/${quote.id}/approve`, { method: "POST", body: { approvedBy: "Validador" } });
  assert(sourceOrder && sourceOrder.id, "O.S. temporaria nao foi gerada a partir do orcamento");
  step("create_source_order", { quoteId: quote.id, orderId: sourceOrder.id });

  const sourceItems = sourceOrder.itemProductionSnapshots || sourceOrder.items || [];
  const rework = await request(`/api/orders/${sourceOrder.id}/rework`, {
    method: "POST",
    body: {
      itemIds: [sourceItems[0].id],
      responsible: employees[0].name,
      sector: sectors[0].name,
      reason: "Teste automatizado de retrabalho operacional",
      displacementCost: 12.5,
      miscCost: 7.5,
      user: "Validador"
    }
  });
  assert(rework.order.serviceOrderType === "rework", "Retrabalho nao recebeu tipo correto");
  assert(rework.order.nonBillable === true, "Retrabalho deveria ser nao faturavel");
  assert(Number(rework.order.total || 0) === 0, "Retrabalho nao pode gerar valor vendido");
  step("create_rework", { orderId: rework.order.id, originalOrderId: rework.order.originalOrderId, total: rework.order.total, financialStatus: rework.order.financialStatus });

  const courtesy = await request("/api/orders/courtesy", {
    method: "POST",
    body: {
      customerId: customers[0].id,
      sector: sectors[0].name,
      description: "Cortesia de validacao operacional",
      quantity: 1,
      authorizedBy: "Admin Teste",
      reason: "Teste automatizado de cortesia sem financeiro",
      user: "Validador"
    }
  });
  assert(courtesy.order.serviceOrderType === "courtesy", "Cortesia nao recebeu tipo correto");
  assert(courtesy.order.nonBillable === true, "Cortesia deveria ser nao faturavel");
  assert(Number(courtesy.order.total || 0) === 0, "Cortesia nao pode gerar valor vendido");
  step("create_courtesy", { orderId: courtesy.order.id, total: courtesy.order.total, financialStatus: courtesy.order.financialStatus });

  let paymentBlocked = false;
  try {
    await request("/api/cash/order-payment", {
      method: "POST",
      body: { orderId: courtesy.order.id, payments: [{ method: "Pix", amount: 10 }], paymentStatus: "Faturamento total" }
    });
  } catch (error) {
    paymentBlocked = /nao gera financeiro|não gera financeiro|cancelada/i.test(error.message);
  }
  assert(paymentBlocked, "Pagamento de cortesia deveria ser bloqueado");
  step("block_non_billable_payment", { status: "ok" });

  const cancel = await request(`/api/orders/${sourceOrder.id}/cancel`, {
    method: "POST",
    body: {
      reason: "Teste automatizado de cancelamento auditavel",
      financialDecision: Number(sourceOrder.paidAmount || 0) > 0 ? "analise_gestor" : "sem_recebimento",
      user: "Validador"
    }
  });
  assert(cancel.order.lifecycleStatus === "cancelled", "O.S. cancelada nao recebeu lifecycleStatus");
  assert(cancel.order.productionStatus === "Cancelada", "O.S. cancelada nao recebeu status de producao");
  step("cancel_order", { orderId: cancel.order.id, lifecycleStatus: cancel.order.lifecycleStatus, productionStatus: cancel.order.productionStatus });

  const movements = await request("/api/production/movements");
  const movementActions = movements.rows.map(row => row.action);
  assert(movementActions.includes("rework_order_created"), "Movimentacao de retrabalho nao apareceu no historico");
  assert(movementActions.includes("courtesy_order_created"), "Movimentacao de cortesia nao apareceu no historico");
  assert(movementActions.includes("order_cancelled"), "Movimentacao de cancelamento nao apareceu no historico");
  step("production_movements", { total: movements.total, summary: movements.summary });

  const finance = await request("/api/finance");
  step("finance_loaded", { billed: finance.billed, receivable: finance.receivable, paid: finance.paid });

  fs.writeFileSync("work/validate-housekeeping-service-orders.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
})().catch(error => {
  const failure = { generatedAt: new Date().toISOString(), error: error.message };
  fs.writeFileSync("work/validate-housekeeping-service-orders.json", JSON.stringify(failure, null, 2));
  console.error(error);
  process.exit(1);
});
