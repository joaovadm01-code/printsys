const fs = require("fs");

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

const base = `http://localhost:${env.PORT || 3000}`;
let cookie = "";

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "cookie": cookie,
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} -> ${response.status}: ${data?.error || text}`);
  }
  return data;
}

(async () => {
  const result = { passed: [], details: {} };
  await request("/api/auth/login", {
    method: "POST",
    body: { login: env.ADMIN_EMAIL || "admin@printsys.local", password: env.ADMIN_PASSWORD || "AdminTeste123" }
  });
  result.passed.push("login admin");

  const groupedBefore = await request("/api/products/grouped");
  result.details.initialProducts = groupedBefore.length;
  result.passed.push("listar produtos agrupados");

  const product = await request("/api/products", {
    method: "POST",
    body: {
      code: `QA-${Date.now()}`,
      name: "Produto Homologacao Codex",
      description: "Produto criado para validar lista agrupada, modelos, perguntas, orçamento e O.S.",
      category: "Homologacao",
      unit: "m2",
      pricingMode: "square_meter",
      defaultProductionDays: 2,
      salePrice: 180,
      minPrice: 180,
      baseCostM2: 45,
      marginPercent: 50,
      minMarginPercent: 25,
      maxDiscountPercent: 10,
      productionCost: 20,
      materialsUsed: ["Lona teste"],
      finishes: ["Bainha"],
      flow: ["Impressao", "Acabamento"],
      productionRoute: [
        { sectorName: "Impressao", orderIndex: 0, defaultDurationHours: 1, requiredFile: true },
        { sectorName: "Acabamento", orderIndex: 1, defaultDurationHours: 0.5 }
      ],
      technicalQuestions: [
        { label: "Acabamento reforcado?", key: "acabamento_reforcado", type: "boolean", answerType: "yes_no", affectsCost: true, costType: "fixed", costValue: 20, active: true }
      ]
    }
  });
  result.passed.push("criar produto");

  const withModel = await request(`/api/products/${product.id}/models`, {
    method: "POST",
    body: {
      name: "Modelo premium homologacao",
      finish: "Bainha e reforco",
      unit: "m2",
      variation: "square_meter",
      materialCost: 55,
      laborCost: 25,
      salePrice: 230,
      productionRoute: [
        { sectorName: "Impressao", orderIndex: 0, defaultDurationHours: 1, requiredFile: true },
        { sectorName: "Acabamento", orderIndex: 1, defaultDurationHours: 0.8 }
      ],
      stockLinks: ["Lona teste"]
    }
  });
  const model = withModel.models.find(item => item.name === "Modelo premium homologacao");
  if (!model) throw new Error("Modelo criado nao retornou na lista agrupada.");
  result.passed.push("criar modelo");

  const edited = await request(`/api/products/${product.id}/models/${model.id}`, {
    method: "PUT",
    body: { ...model, salePrice: 245, materialCost: 60, laborCost: 28, unit: "m2", finish: "Bainha premium" }
  });
  const editedModel = edited.models.find(item => item.id === model.id);
  if (Number(editedModel.salePrice) !== 245 || Number(editedModel.materialCost) !== 60) throw new Error("Edicao de custo/preco do modelo nao persistiu.");
  result.passed.push("editar custo e valor do modelo");

  await request(`/api/products/${product.id}/models/${model.id}/questions`, {
    method: "PUT",
    body: {
      technicalQuestions: [
        { label: "Precisa de reforco extra?", key: "reforco_extra", type: "boolean", answerType: "yes_no", required: true, orderIndex: 1, affectsCost: true, costType: "fixed", costValue: 35, costApplication: "add_to_cost", deadlineImpactDays: 1, productionImpact: "Adicionar conferencia de reforco", active: true, visibleInQuote: true, visibleInOrder: true, visibleInProduction: true }
      ]
    }
  });
  result.passed.push("salvar perguntas do modelo");

  const afterQuestions = await request("/api/products/grouped");
  const savedProduct = afterQuestions.find(item => item.id === product.id);
  const savedModel = savedProduct.models.find(item => item.id === model.id);
  if (!savedModel.technicalQuestions?.some(question => question.key === "reforco_extra")) throw new Error("Pergunta do modelo nao persistiu.");
  result.passed.push("validar pergunta em produto agrupado");

  const duplicatedModelProduct = await request(`/api/products/${product.id}/models/${model.id}/duplicate`, { method: "POST", body: {} });
  const duplicatedModel = duplicatedModelProduct.models.find(item => item.id !== model.id && String(item.name || "").includes("copia"));
  if (!duplicatedModel) throw new Error("Duplicacao de modelo nao retornou copia.");
  await request(`/api/products/${product.id}/models/${duplicatedModel.id}`, { method: "DELETE" });
  result.passed.push("duplicar e inativar modelo");

  const duplicatedProduct = await request(`/api/products/${product.id}/duplicate`, { method: "POST", body: { name: "Produto Homologacao Codex Copia" } });
  await request(`/api/products/${duplicatedProduct.id}`, { method: "DELETE" });
  result.passed.push("duplicar e inativar produto");

  const pricing = await request("/api/quote/calculate", {
    method: "POST",
    body: {
      productId: product.id,
      productModelId: model.id,
      answers: { productModelId: model.id, width: 2, height: 1, quantity: 2, reforco_extra: "true" }
    }
  });
  if (pricing.productModelId !== model.id || !pricing.questionCosts?.some(line => line.questionKey === "reforco_extra")) throw new Error("Calculo nao usou pergunta/modelo selecionado.");
  result.passed.push("calcular orcamento pelo modelo");

  const customers = await request("/api/customers");
  const quote = await request("/api/quotes", {
    method: "POST",
    body: {
      customerId: customers[0]?.id,
      productId: product.id,
      productModelId: model.id,
      jobName: "Orcamento homologacao modelo",
      answers: { productModelId: model.id, width: 2, height: 1, quantity: 2, reforco_extra: "true" },
      files: ["arte-homologacao.pdf"]
    }
  });
  if (quote.productModelId !== model.id || quote.itemSnapshots?.[0]?.productModelId !== model.id || quote.costSnapshot?.productModel?.id !== model.id) throw new Error("Snapshot do orcamento nao guardou modelo.");
  result.passed.push("salvar orcamento com snapshot do modelo");

  const order = await request(`/api/quotes/${quote.id}/approve`, { method: "POST", body: { approvedBy: "Homologacao" } });
  if (order.productModelId !== model.id || order.itemProductionSnapshots?.[0]?.productModelId !== model.id || !order.productionRouteSnapshot?.length) throw new Error("O.S. nao herdou modelo ou rota produtiva.");
  result.passed.push("gerar O.S. com modelo e rota produtiva");

  const audits = await request("/api/audit");
  const expectedAudit = audits.some(item => item.entity === "product" && item.entityId === product.id && String(item.action || "").includes("Modelo"));
  if (!expectedAudit) throw new Error("Auditoria de modelo nao encontrada.");
  result.passed.push("auditoria de produto/modelo registrada");

  await request(`/api/products/${product.id}`, { method: "DELETE" });
  result.passed.push("inativar produto de homologacao");

  result.details.createdProductId = product.id;
  result.details.createdModelId = model.id;
  result.details.quoteId = quote.id;
  result.details.orderId = order.id;
  console.log(JSON.stringify(result, null, 2));
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
