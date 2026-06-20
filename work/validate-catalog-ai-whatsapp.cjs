const fs = require("fs");

const env = fs.existsSync(".env")
  ? Object.fromEntries(
      fs.readFileSync(".env", "utf8")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith("#") && line.includes("="))
        .map(line => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1)];
        })
    )
  : {};

const baseUrl = `http://localhost:${env.PORT || 3000}`;
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
  const evidence = { generatedAt: new Date().toISOString(), baseUrl, steps: [] };
  const step = (name, data = {}) => evidence.steps.push({ name, ...data });

  await request("/api/auth/login", {
    method: "POST",
    body: { login: env.ADMIN_EMAIL || "admin@printsys.local", password: env.ADMIN_PASSWORD || "AdminTeste123" }
  });
  step("login_admin", { status: "ok" });

  const catalog = await request("/api/product-catalog");
  assert(Array.isArray(catalog.categories) && catalog.categories.length, "Catalogo nao retornou categorias");
  assert(Array.isArray(catalog.products) && catalog.products.length, "Catalogo nao retornou produtos");
  const product = catalog.products.find(item => item.active !== false) || catalog.products[0];
  assert(product.models && product.models.length, "Produto do catalogo nao retornou modelos");
  step("catalog_loaded", { categories: catalog.categories.length, products: catalog.products.length, productId: product.id });

  const updatedProduct = await request(`/api/products/${product.id}/catalog`, {
    method: "PATCH",
    body: {
      imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'%3E%3Crect width='320' height='180' fill='%237b179f'/%3E%3Ctext x='160' y='96' text-anchor='middle' font-family='Arial' font-size='22' fill='white'%3Eprintsys-produto%3C/text%3E%3C/svg%3E",
      favorite: true,
      attachments: ["mockup-validacao.png", "briefing-validacao.pdf"]
    }
  });
  assert(updatedProduct.imageUrl.includes("printsys-produto"), "Imagem do produto nao persistiu");
  assert(updatedProduct.favorite === true, "Favorito do produto nao persistiu");
  assert(updatedProduct.attachments.length >= 2, "Anexos do produto nao persistiram");
  await request(`/api/products/${product.id}/use`, { method: "POST", body: { user: "Validador" } });
  step("product_catalog_saved", { imageUrl: updatedProduct.imageUrl, attachments: updatedProduct.attachments.length });

  const recognition = await request("/api/project-recognition/analyze", {
    method: "POST",
    body: {
      fileName: "fachada-acm-10x1-com-led.pdf",
      customerRequest: "Fachada ACM 10x1,20 com LED e instalacao",
      extractedText: "Fachada em ACM com led interno, instalacao externa, medida 10x1.20",
      notes: "Cliente pediu prazo rapido",
      user: "Validador"
    }
  });
  assert(recognition.analysis.id, "Analise de projeto nao retornou ID");
  assert(recognition.analysis.suggestions.length, "Analise de projeto nao sugeriu produtos reais");
  assert(recognition.analysis.message.includes("Automatic recognition") || recognition.analysis.aiProviderConfigured, "Fallback de IA nao foi informado corretamente");
  step("project_recognition", { analysisId: recognition.analysis.id, suggestions: recognition.analysis.suggestions.length, mode: recognition.analysis.analysisMode });

  const draft = await request(`/api/project-recognition/${recognition.analysis.id}/quote-draft`, {
    method: "POST",
    body: {
      jobName: "Rascunho por projeto validacao",
      items: recognition.analysis.suggestions.slice(0, 2),
      user: "Validador"
    }
  });
  assert(draft.items.length, "Rascunho de orcamento nao retornou itens");
  assert(draft.pricing.finalPrice >= 0, "Rascunho nao retornou precificacao");
  assert(draft.projectFiles.includes(recognition.analysis.fileName), "Arquivo do projeto nao entrou no rascunho");
  step("quote_draft_ready", { items: draft.items.length, total: draft.pricing.finalPrice });

  const communication = await request("/api/communication-settings", {
    method: "POST",
    body: {
      enabled: true,
      whatsappMode: "manual_whatsapp_link",
      companyWhatsApp: "5585999990000",
      defaultSender: "Atendimento",
      footer: "Mensagem validada pelo PrintSys.",
      events: { quote: true, order: true, production: true, payment: true, tracking: true },
      provider: { name: "", baseUrl: "", token: "", webhookSecret: "" }
    }
  });
  assert(communication.whatsappMode === "manual_whatsapp_link", "Configuracao de comunicacao nao persistiu modo manual");
  const test = await request("/api/communication-settings/test", { method: "POST", body: {} });
  assert(test.status === "manual" && test.whatsappLink, "Teste de comunicacao manual nao retornou link");
  step("communication_settings", { mode: communication.whatsappMode, testStatus: test.status });

  const customers = await request("/api/customers");
  const customer = customers[0];
  assert(customer, "Cliente base nao encontrado para notificacao");
  const createdNotification = await request("/api/notifications", {
    method: "POST",
    body: { event: "quote.created", customerId: customer.id, channel: "WhatsApp", user: "Validador" }
  });
  const notification = createdNotification.created[0];
  assert(notification.status === "prepared" || notification.status === "pending", "Notificacao nao respeitou fila manual/API");
  await request(`/api/notifications/${notification.id}/manual-confirmed`, { method: "POST", body: { user: "Validador" } });
  const queue = await request("/api/notifications");
  const confirmed = queue.queue.find(item => item.id === notification.id);
  assert(confirmed.status === "manual_confirmed", "Confirmacao manual nao persistiu");
  step("notification_manual_flow", { notificationId: notification.id, status: confirmed.status });

  fs.writeFileSync("work/validate-catalog-ai-whatsapp.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ ok: true, evidence: "work/validate-catalog-ai-whatsapp.json", steps: evidence.steps.length }, null, 2));
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
