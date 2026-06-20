const state = { user: null, users: [], permissions: {}, sectorPermissions: {}, companies: [], currentCompanyId: localStorage.getItem("printsys_company_id") || "", currentCompanyName: "", companySettings: {}, printSettings: {}, communicationSettings: {}, notifications: { queue: [], templates: [] }, productCatalog: { categories: [], products: [], favorites: [], recentlyUsed: [], summary: {} }, productCategories: [], projectRecognition: { analyses: [], active: null, draft: null }, activeMenu: null, costConfig: {}, costCenters: [], sectors: [], compositions: [], pricingSimulations: [], activeSimulation: null, activeQuotePricing: null, quoteItems: [], quoteItemDraftAnswers: {}, selectedProductionOrderId: null, productionScope: "today", productionView: "mine", productionQuery: { rows: [], summary: {}, filters: {} }, productionMovements: { rows: [], summary: {}, filters: {} }, activeOrderDetailTab: "items", activeOrderProductDraftId: null, expandedProductId: "", productConfigDraft: { technicalQuestions: [], productionRoute: [] }, productModelQuestionDraft: [], quotedApprovedReport: [], validationReport: null, cashReport: {}, financeData: {}, crm: { leads: [], followUps: [], sellerGoals: [], report: {}, alerts: [], funnelStages: [] }, intelligence: {}, analytics: {}, preferences: {}, biData: {}, integrations: {}, portalData: null, portalToken: "portal-c1-demo", employees: [], expenses: [], operationalExpenses: [], expenseCategories: [], expenseReports: {}, advances: [], dre: {}, vehicles: [], technicalVisits: [], technicalVisitReports: {}, customers: [], products: [], quotes: [], orders: [], quickSales: [], materials: [], stockMovements: [], alerts: [], audit: [], dailySummary: {}, dashboard: null };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("pt-BR");
}

function safeSetHTML(elementId, html, required = false) {
  const element = document.getElementById(elementId);
  if (!element) {
    const message = `Elemento ${elementId} não encontrado durante a renderização.`;
    if (required) console.error(message);
    else console.warn(message);
    return false;
  }
  element.innerHTML = html;
  return true;
}

function getRequiredElement(elementId) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Estrutura obrigatória ausente: ${elementId}`);
  return element;
}

function renderCompactActionBar(actions = [], summary = "") {
  return `<div class="compact-action-bar">${summary ? `<span>${summary}</span>` : ""}<div>${actions.map(action => `<button type="${action.type || "button"}" ${action.primary ? 'class="primary"' : ""} ${action.data || ""}>${action.label}</button>`).join("")}</div></div>`;
}

async function api(path, options = {}) {
  const companyId = state.currentCompanyId || localStorage.getItem("printsys_company_id") || "";
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (companyId) headers["x-company-id"] = companyId;
  const response = await fetch(path, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (response.status === 401) {
    showLogin();
    throw new Error("Login necessario");
  }
  if (!response.ok) throw new Error((await response.json()).error || "Erro ao acessar o sistema");
  return response.json();
}

async function apiOptional(path, fallback) {
  try {
    return await api(path);
  } catch (error) {
    if (error.message && error.message.includes("Acesso bloqueado")) return fallback;
    throw error;
  }
}

function ensureLoginScreen() {
  if (document.getElementById("login-screen")) return;
  document.body.insertAdjacentHTML("afterbegin", `
    <section id="login-screen" class="login-screen">
      <form id="login-form" class="login-card">
        <div class="brand login-brand"><strong>print</strong><span>sys</span></div>
        <h1>Entrar no ERP</h1>
        <p>Acesse com seu usuario e permissao operacional.</p>
        <label>E-mail ou usuario<input id="login-user" autocomplete="username" required></label>
        <label>Senha<input id="login-password" type="password" autocomplete="current-password" required></label>
        <label class="login-remember"><input id="login-remember" type="checkbox"> Lembrar acesso</label>
        <button class="primary">Entrar</button>
        <button type="button" id="forgot-password">Esqueci minha senha</button>
        <div id="login-message" class="login-message"></div>
      </form>
    </section>
  `);
  document.getElementById("login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const message = document.getElementById("login-message");
    message.textContent = "Validando acesso...";
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login: document.getElementById("login-user").value, password: document.getElementById("login-password").value, remember: document.getElementById("login-remember").checked })
      }).then(async response => {
        if (!response.ok) throw new Error((await response.json()).error || "Login invalido");
        return response.json();
      });
      hideLogin();
      await loadAll();
      const target = location.hash.replace("#", "") || "dashboard";
      view(document.getElementById(target) && canOpenView(target) ? target : "dashboard");
    } catch (error) {
      message.textContent = error.message;
    }
  });
  document.getElementById("forgot-password").addEventListener("click", () => {
    document.getElementById("login-message").textContent = "Solicite redefinicao ao Admin/Gestor.";
  });
}

function showLogin() {
  ensureLoginScreen();
  document.getElementById("login-screen").classList.add("active");
  document.querySelector(".app")?.classList.add("auth-blocked");
}

function hideLogin() {
  document.getElementById("login-screen")?.classList.remove("active");
  document.querySelector(".app")?.classList.remove("auth-blocked");
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  showLogin();
}

function view(name, sourceButton = null) {
  const aliases = {
    cash: "cash-receive",
    orders: "orders-search",
    pcp: "production-pcp",
    "production-stages": "production-move",
    "production-files": "orders-no-file",
    finance: "finance-receivables",
    products: "stock-products",
    bi: "reports-orders",
    settings: "settings-users"
  };
  name = aliases[name] || name;
  if (!document.getElementById(name)) name = "dashboard";
  if (!canOpenView(name)) {
    showToast("Seu perfil nao possui acesso a esta area.", "warning");
    name = "dashboard";
  }
  document.querySelectorAll(".view").forEach(item => item.classList.remove("active"));
  document.querySelectorAll("nav button").forEach(item => item.classList.remove("active"));
  document.getElementById(name).classList.add("active");
  document.querySelectorAll("nav .nav-section").forEach(item => item.classList.remove("open"));
  const activeButton = sourceButton || document.querySelector(`nav button[data-view="${name}"]`);
  activeButton?.classList.add("active");
  activeButton?.closest(".nav-section")?.classList.add("open");
  if (activeButton) {
    state.activeMenu = {
      view: name,
      label: activeButton.dataset.menuLabel || activeButton.textContent.trim(),
      group: activeButton.dataset.menuGroup || activeButton.closest(".nav-section")?.querySelector(".nav-parent .nav-label")?.textContent?.trim() || ""
    };
  }
  renderMenuContext(name);
  renderFocusedOperationalSubpages(name);
  if (location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
}

function canOpenView(name) {
  if (name === "dashboard") return true;
  if (isAdminUser()) return true;
  const map = {
    quote: "quote",
    intelligence: "bi",
    commercial: "commercial",
    portal: "customerPortal",
    "pricing-simulator": "quote",
    admin: "settings",
    orders: "orders",
    "orders-new": "orders",
    "orders-search": "orders",
    "orders-followup": "orders",
    "orders-late": "orders",
    "orders-no-file": "orders",
    "orders-no-payment": "orders",
    "orders-print": "orders",
    "orders-costs": "orders",
    "orders-rework": "orders",
    "orders-courtesy": "orders",
    "orders-cancelled": "orders",
    pcp: "production",
    "production-pcp": "production",
    "production-stages": "production",
    "production-move": "production",
    "production-installation": "production",
    "production-checklist": "production",
    "production-files": "production",
    cash: "cash",
    "cash-receive": "cash",
    "cash-quick-sale": "cash",
    "cash-expense": "cash",
    "cash-withdrawal": "cash",
    "cash-closing": "blindClose",
    finance: "financialSummary",
    "finance-receivables": "financialSummary",
    "finance-payables": "financialSummary",
    "finance-cashflow": "financialSummary",
    "finance-dre": "financialSummary",
    "finance-expenses": "financialSummary",
    bi: "bi",
    "notifications-center": ["integrations", "orders", "commercial", "customerPortal"],
    customers: "administration",
    products: ["supplies", "settings"],
    "stock-products": ["supplies", "settings"],
    "stock-product-new": ["supplies", "settings"],
    "stock-materials": ["supplies", "settings"],
    "stock-movements": ["supplies", "settings"],
    "reports-production": "bi",
    "reports-finance": "bi",
    "reports-orders": "bi",
    "reports-stock": "bi",
    control: "settings",
    integrations: "settings",
    settings: "settings"
    ,"settings-users": "settings"
    ,"settings-employees": "settings"
    ,"settings-sectors": "settings"
    ,"settings-permissions": "settings"
    ,"settings-stores": "settings"
    ,"settings-printing": "settings"
    ,"settings-communication": "settings"
    ,"settings-compositions": "settings"
    ,"settings-cost-centers": "settings"
    ,"visits-new": "technicalVisits"
    ,"visits-agenda": "technicalVisits"
    ,"visits-open": "technicalVisits"
    ,"visits-completed": "technicalVisits"
    ,"visits-reports": "technicalVisits"
  };
  const permission = map[name];
  if (!permission) return true;
  if (Array.isArray(permission)) return permission.some(item => item === "settings" ? isAdminUser() && state.permissions?.settings : state.permissions?.[item]);
  if (permission === "settings" && !isAdminUser()) return false;
  return Boolean(state.permissions?.[permission]);
}

function isAdminUser() {
  const role = normalizeUxText(state.user?.role || "");
  return ["admin geral", "admin/gestor", "administrador"].includes(role);
}

function canUsePermission(permission) {
  if (!permission) return true;
  if (permission === "settings") return isAdminUser() && Boolean(state.permissions?.settings);
  if (isAdminUser()) return true;
  return Boolean(state.permissions?.[permission]);
}

async function loadAll() {
  const [session, users, dashboard, customers, products, productCatalog, quotes, orders, productionMovements, quickSales, materials, stockMovements, alerts, audit, dailySummary, cashReport, financeData, crm, intelligence, analytics, preferences, biData, integrations, printSettings, communicationSettings, notifications, portalData, costConfig, costCenters, sectors, compositions, pricingSimulations, quotedApprovedReport, validationReport, employees, expenses, operationalExpenses, expenseCategories, expenseReports, advances, dre, vehicles, technicalVisits, technicalVisitReports] = await Promise.all([
    api("/api/me"),
    apiOptional("/api/users", []),
    apiOptional("/api/dashboard", {}),
    apiOptional("/api/customers", []),
    apiOptional("/api/products", []),
    apiOptional("/api/product-catalog", { categories: [], products: [], favorites: [], recentlyUsed: [], summary: {} }),
    apiOptional("/api/quotes", []),
    apiOptional("/api/orders", []),
    apiOptional("/api/production/movements", { rows: [], summary: {}, filters: {} }),
    apiOptional("/api/quick-sales", []),
    apiOptional("/api/materials", []),
    apiOptional("/api/stock-movements", []),
    apiOptional("/api/alerts", []),
    apiOptional("/api/audit", []),
    apiOptional("/api/cash/daily-summary", {}),
    apiOptional("/api/cash/report", {}),
    apiOptional("/api/finance", {}),
    apiOptional("/api/crm", { leads: [], followUps: [], sellerGoals: [], report: {}, alerts: [], funnelStages: [] }),
    apiOptional("/api/intelligence", {}),
    apiOptional("/api/analytics", {}),
    apiOptional("/api/preferences", {}),
    apiOptional("/api/bi/executive", {}),
    apiOptional("/api/integrations", {}),
    apiOptional("/api/print-settings", {}),
    apiOptional("/api/communication-settings", {}),
    apiOptional("/api/notifications", { queue: [], templates: [] }),
    apiOptional(`/api/portal/${state.portalToken}`, null),
    apiOptional("/api/cost-config", {}),
    apiOptional("/api/cost-centers", []),
    apiOptional("/api/sectors", []),
    apiOptional("/api/compositions", []),
    apiOptional("/api/pricing-simulator/history", []),
    apiOptional("/api/reports/quoted-approved", []),
    apiOptional("/api/audit/validation-erp", null),
    apiOptional("/api/employees", []),
    apiOptional("/api/expenses", []),
    apiOptional("/api/operational-expenses", []),
    apiOptional("/api/operational-expenses/categories", []),
    apiOptional("/api/operational-expenses/reports", {}),
    apiOptional("/api/expense-advances", []),
    apiOptional("/api/dre", {}),
    apiOptional("/api/vehicles", []),
    apiOptional("/api/technical-visits", []),
    apiOptional("/api/technical-visits/reports", {})
  ]);
  state.user = session.user;
  state.users = users;
  state.permissions = session.permissions;
  state.sectorPermissions = session.sectorPermissions || {};
  state.companies = session.companies || [];
  state.currentCompanyId = session.currentCompanyId || state.currentCompanyId || "all";
  state.currentCompanyName = session.currentCompanyName || "";
  state.companySettings = session.settings || {};
  if (state.currentCompanyId) localStorage.setItem("printsys_company_id", state.currentCompanyId);
  state.dashboard = dashboard;
  state.customers = customers;
  state.products = products;
  state.productCatalog = productCatalog || { categories: [], products: [], favorites: [], recentlyUsed: [], summary: {} };
  state.productCategories = state.productCatalog.categories || [];
  state.quotes = quotes;
  state.orders = orders;
  state.productionMovements = productionMovements || { rows: [], summary: {}, filters: {} };
  state.quickSales = quickSales;
  state.materials = materials;
  state.stockMovements = stockMovements;
  state.alerts = alerts;
  state.audit = audit;
  state.dailySummary = dailySummary;
  state.cashReport = cashReport;
  state.financeData = financeData;
  state.crm = crm;
  state.intelligence = intelligence;
  state.analytics = analytics;
  state.preferences = preferences;
  state.biData = biData;
  state.integrations = integrations;
  state.printSettings = printSettings || {};
  state.communicationSettings = communicationSettings || {};
  state.notifications = notifications || { queue: [], templates: [] };
  state.portalData = portalData;
  state.costConfig = costConfig;
  state.costCenters = costCenters;
  state.sectors = sectors;
  state.compositions = compositions;
  state.pricingSimulations = pricingSimulations;
  state.quotedApprovedReport = quotedApprovedReport;
  state.validationReport = validationReport;
  state.employees = employees;
  state.expenses = expenses;
  state.operationalExpenses = operationalExpenses;
  state.expenseCategories = expenseCategories;
  state.expenseReports = expenseReports;
  state.advances = advances;
  state.dre = dre;
  state.vehicles = vehicles;
  state.technicalVisits = technicalVisits;
  state.technicalVisitReports = technicalVisitReports;
  render();
}

function render() {
  const steps = [
    ["subpaginas operacionais", prepareRootOperationalSubpages],
    ["menu", buildOperationalNavigation],
    ["dashboard", renderDashboard],
    ["orcamento", renderQuoteForm],
    ["central de gestao", renderAIAssistantPanel],
    ["comercial", renderCommercial],
    ["indicadores", renderBI],
    ["integracoes", renderIntegrations],
    ["portal", renderPortal],
    ["simulador", renderPricingSimulator],
    ["consulta de orcamentos", renderQuotes],
    ["ordem de servico", renderOrders],
    ["clientes", renderCustomers],
    ["produtos e estoque", renderProducts],
    ["questionarios", renderAdminQuestions],
    ["seletores operacionais", renderOperationalSelects],
    ["visitas tecnicas", renderTechnicalVisits],
    ["venda rapida", renderQuickSales],
    ["controle", renderControl],
    ["ficha tecnica", renderTechnicalSheet],
    ["sistema", renderSettings],
    ["validacao ERP", renderValidationReport],
    ["permissoes", renderPermissions],
    ["despesas operacionais", renderOperationalExpenses],
    ["pcp", renderPcp],
    ["financeiro", renderFinance],
    ["subpaginas focadas", renderFocusedOperationalSubpages],
    ["layout global", applyGlobalLayout],
    ["perfil inicial", openProfileHome]
  ];
  steps.forEach(([name, fn]) => runRenderStep(name, fn));
  window.setTimeout(repairVisibleLanguage, 0);
}

function runRenderStep(name, fn) {
  try {
    const result = fn();
    if (result?.catch) result.catch(error => reportRenderError(name, error));
  } catch (error) {
    reportRenderError(name, error);
  }
}

function reportRenderError(name, error) {
  console.error(`Erro ao renderizar ${name}:`, error);
  const dashboard = document.getElementById("important-alerts");
  dashboard?.insertAdjacentHTML("afterbegin", `<div class="alert red"><b>Falha ao carregar ${name}</b><span>${error.message || "Erro inesperado no modulo."}</span></div>`);
}

function buildOperationalNavigationLegacyGrouped() {
  const nav = document.querySelector("nav");
  if (!nav) return;
  nav.dataset.erpNavReady = "true";
  nav.className = "erp-nav";
  nav.innerHTML = [
    navDirect("dashboard", "Início", "IN"),
    navSection("Comercial", "CO", [["commercial", "Atendimento e CRM", "commercial"], ["customers", "Clientes", "administration"], ["quote", "Orçamentos", "quote"], ["pricing-simulator", "Simular preço", "quote"], ["orders", "Ordens de serviço", "orders"]]),
    navSection("Operação", "OP", [["pcp", "Produção / PCP", "production"], ["products", "Produtos e estoque", "supplies"]]),
    navSection("Financeiro", "FI", [["cash", "Caixa / PDV", "cash"], ["finance", "Financeiro / DRE", "financialSummary"]]),
    navSection("Gestão", "GE", [["intelligence", "IA / Assistente", "bi"], ["bi", "Indicadores gerenciais", "bi"]]),
    navSection("Sistema", "SI", [["control", "Controle e acessos", "settings"], ["admin", "Questionários", "settings"], ["settings", "Configurações", "settings"], ["integrations", "Integrações e logs", "settings"]])
  ].join("");
  nav.querySelectorAll(".nav-parent").forEach(button => {
    button.addEventListener("click", () => {
      const section = button.closest(".nav-section");
      const willOpen = !section?.classList.contains("open");
      nav.querySelectorAll(".nav-section").forEach(item => item.classList.remove("open"));
      if (willOpen) section?.classList.add("open");
    });
  });
  nav.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => view(button.dataset.view, button));
  });
  const currentView = document.querySelector(".view.active")?.id || "dashboard";
  const currentButton = nav.querySelector(`[data-view="${currentView}"]`);
  currentButton?.classList.add("active");
  currentButton?.closest(".nav-section")?.classList.add("open");
}

function navDirect(viewName, label, icon, permission = "") {
  return `<button type="button" class="nav-direct" data-view="${viewName}" data-menu-group="Inicio" data-menu-label="${label}"${permission ? ` data-required-permission="${permission}"` : ""}><span class="nav-ico" data-icon="${icon}"></span><span class="nav-label">${label}</span></button>`;
}

function navSection(label, icon, items, open = false) {
  return `
    <div class="nav-section ${open ? "open" : ""}">
      <button type="button" class="nav-parent"><span class="nav-ico" data-icon="${icon}"></span><span class="nav-label">${label}</span></button>
      <div class="nav-children">
        ${items.map(([viewName, itemLabel, permission]) => `<button data-view="${viewName}" data-menu-group="${label}" data-menu-label="${itemLabel}"${permission ? ` data-required-permission="${permission}"` : ""}><span class="nav-label">${itemLabel}</span></button>`).join("")}
      </div>
    </div>
  `;
}

function sidebarNav(items) {
  return items.map(([viewName, label, icon, permission]) => `
    <button type="button" class="nav-direct" data-view="${viewName}" data-menu-group="PrintSys" data-menu-label="${label}"${permission ? ` data-required-permission="${permission}"` : ""}>
      <span class="nav-ico" data-icon="${icon}"></span>
      <span class="nav-label">${label}</span>
    </button>
  `).join("");
}

function horizontalTabs(id, tabs) {
  return `<section id="${id}" class="premium-work-tabs">${tabs.map((tab, index) => `<button type="button" class="${index === 0 ? "active" : ""}" ${tab.data || ""}>${tab.label}</button>`).join("")}</section>`;
}

function buildOperationalNavigationLegacyFlat() {
  const nav = document.querySelector("nav");
  if (!nav) return;
  nav.dataset.erpNavReady = "true";
  nav.className = "erp-nav erp-nav-flat";
  const items = [
    ["dashboard", "Dashboard", "⌂", ""],
    ["commercial", "Atendimento", "☎", "commercial"],
    ["customers", "Clientes", "◎", "administration"],
    ["quote", "Orçamentos", "□", "quote"],
    ["orders", "Ordens de Serviço", "▤", "orders"],
    ["pcp", "Produção / PCP", "▧", "production"],
    ["cash", "Caixa / PDV", "$", "cash"],
    ["finance", "Financeiro", "◫", "financialSummary"],
    ["products", "Estoque", "▦", "supplies"],
    ["bi", "Relatórios", "◈", "bi"],
    ["settings", "Configurações", "⚙", "settings"]
  ];
  nav.innerHTML = sidebarNav(items);
  nav.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => view(button.dataset.view, button));
  });
  const currentView = document.querySelector(".view.active")?.id || "dashboard";
  nav.querySelector(`[data-view="${currentView}"]`)?.classList.add("active");
}

function openProfileHome() {
  if (location.hash && document.getElementById(location.hash.replace("#", ""))) return;
  if (document.body.dataset.profileHomeReady === "true") return;
  document.body.dataset.profileHomeReady = "true";
  const role = normalizeUxText(state.user?.role || "");
  const target = role.includes("vendedor") ? "commercial"
    : role.includes("caixa") ? "cash"
    : role.includes("financeiro") ? "finance"
    : role.includes("pcp") || role.includes("produc") ? "pcp"
    : "dashboard";
  if (target !== "dashboard" && canOpenView(target)) view(target);
}

function renderDashboard() {
  const dashboard = state.dashboard || {};
  const topSales = document.getElementById("top-sales");
  const topQuotes = document.getElementById("top-quotes");
  const topAlerts = document.getElementById("top-alerts");
  if (topSales) topSales.textContent = dashboard.okOrders || 0;
  if (topQuotes) topQuotes.textContent = dashboard.attentionOrders || dashboard.openOrders || 0;
  if (topAlerts) topAlerts.textContent = dashboard.lateOrders || 0;
  safeSetHTML("dashboard-cards", [
    managerCard("Receita no caixa", money.format(dashboard.revenue || 0), revenueStatus(dashboard.revenue), "Valor que entrou no caixa e já pode ser conferido."),
    managerCard("O.S. abertas", dashboard.openOrders || 0, countStatus(dashboard.openOrders, 8, 15), "Pedidos em andamento que ainda precisam de acompanhamento."),
    managerCard("O.S. atrasadas", dashboard.lateOrders || 0, countStatus(dashboard.lateOrders, 1, 3), "Pedidos fora do prazo combinado."),
    managerCard("Valores a receber", money.format(dashboard.pendingReceivables || 0), countStatus(dashboard.pendingReceivables, 1, 5000), "Recebimentos pendentes no financeiro.")
  ].join(""), true);
  safeSetHTML("quick-panel", [
    managerCard("Orçamentos do dia", dashboard.todayQuotes || 0, "ok", "Propostas criadas hoje pela equipe comercial."),
    managerCard("O.S. para hoje", dashboard.todayOrders || 0, countStatus(dashboard.todayOrders, 6, 10), "Pedidos com prazo ou entrega marcada para hoje."),
    managerCard("Produção em andamento", dashboard.productionRunning || 0, countStatus(dashboard.productionRunning, 8, 15), "Trabalhos atualmente em produção."),
    managerCard("Faturamento pendente", money.format(dashboard.pendingReceivables || 0), countStatus(dashboard.pendingReceivables, 1, 5000), "Valores que precisam ser cobrados ou conferidos."),
    managerCard("Fiado vencido", dashboard.overdueFiado || 0, countStatus(dashboard.overdueFiado, 1, 3), "Clientes com prazo de pagamento vencido."),
    managerCard("Caixa aberto", dashboard.cashOpen ? "Sim" : "Não", dashboard.cashOpen ? "ok" : "warning", "Indica se há caixa operacional para receber vendas."),
    managerCard("Alertas importantes", dashboard.importantAlerts?.length || 0, countStatus(dashboard.importantAlerts?.length, 1, 3), "Situações que precisam de decisão.")
  ].join(""), true);
  safeSetHTML("important-alerts", (dashboard.importantAlerts || []).map(alert => `
    <button type="button" class="alert ${alert.severity} dashboard-alert-link" data-view="${dashboardAlertView(alert)}">
      <b>${businessLabel(alert.type)}</b>
      <span>${alert.message || "Verifique este ponto antes de avancar no fluxo."}</span>
      <small>Abrir modulo relacionado</small>
    </button>
  `).join(""), true);
  document.querySelectorAll("#important-alerts [data-view]").forEach(button => button.addEventListener("click", () => view(button.dataset.view)));
  safeSetHTML("tasks", `
    <div class="job"><b>Instalações e entregas externas</b><p>${dashboard.openOrders || 0} O.S. em aberto para acompanhar.</p></div>
    <div class="job"><b>Conferência financeira</b><p>${money.format(dashboard.pendingReceivables || 0)} ainda precisa ser recebido ou baixado.</p></div>
  `, true);
  renderDashboardBusinessView();
}

function applyGlobalLayout() {
  const app = document.querySelector(".app");
  if (window.innerWidth <= 980 && app && document.body.dataset.mobileSidebarInitialized !== "true") {
    app.classList.add("sidebar-collapsed");
    document.body.dataset.mobileSidebarInitialized = "true";
  }
  document.querySelectorAll(".view").forEach(section => section.classList.add("page-shell"));
  document.querySelectorAll(".title").forEach(section => section.classList.add("page-header"));
  document.querySelectorAll(".title > div:last-child").forEach(section => section.classList.add("page-actions"));
  document.querySelectorAll(".module-tabs").forEach(section => section.classList.add("page-tabs"));
  document.querySelectorAll(".panel").forEach(section => section.classList.add("section-card"));
  document.querySelectorAll(".panel > h2, .panel > .title h2").forEach(title => title.classList.add("section-title"));
  document.querySelectorAll(".grid").forEach(section => section.classList.add("section-grid"));
  document.querySelectorAll(".shortcuts, .tabs-inline, .row-actions").forEach(section => section.classList.add("action-bar"));
  document.querySelectorAll(".cards").forEach(section => section.classList.add("summary-bar"));
  document.querySelectorAll("table").forEach(table => table.classList.add("data-table"));
  document.querySelectorAll(".status-pill").forEach(chip => chip.classList.add("status-chip"));
  document.querySelectorAll("form").forEach(form => form.classList.add("form-grid"));
  document.querySelectorAll("details").forEach(detail => detail.classList.add("details-panel"));
  improvePageHeaders();
  improveOperationalLayout();
  prepareMenuContextContainers();
  prepareQuoteWorkspace();
  prepareOrdersWorkspace();
  preparePcpWorkspace();
  prepareProductionDrawer();
  prepareAccessReleases();
  applyFinalUxSprint();
  prepareTopBar();
  prepareHeaderSearch();
  prepareActionClarity();
  organizeExtendedOperationalPanels();
  renderFocusedOperationalSubpages();
  renderMenuContext(document.querySelector(".view.active")?.id || "dashboard");
}

function prepareMenuContextContainers() {
  document.querySelectorAll(".menu-context-panel").forEach(panel => panel.remove());
}

function renderMenuContext(viewName) {
  const active = state.activeMenu || { view: viewName, label: businessLabel(viewName), group: "PrintSys" };
  if (active.view !== viewName) active.view = viewName;
  applyWorkspaceFocus(viewName, active);
}

function runMenuPrimaryAction(viewName, data, button) {
  if (data.actionView && data.actionView !== viewName) {
    view(data.actionView, button);
    return;
  }
  const section = document.getElementById(viewName);
  const target = section?.querySelector(".workspace-primary form input, .workspace-primary form select, .workspace-primary form textarea, form input, form select, form textarea, .workspace-primary button.primary");
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
  target?.focus?.();
}

function contextTable(data) {
  if (!data.columns?.length) return "";
  if (!data.rows?.length) return `<div class="empty-state">Nenhum registro encontrado. Use a acao principal para cadastrar ou consultar.</div>`;
  return `
    <table class="menu-context-table">
      <thead><tr>${data.columns.map(column => `<th>${column}</th>`).join("")}</tr></thead>
      <tbody>${data.rows.slice(0, 8).map(row => `<tr>${row.map(cell => `<td>${cell ?? "-"}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
}

function exportMenuContext(target) {
  const data = target._contextData || {};
  if (!data.columns?.length) return;
  const rows = [data.columns, ...(data.rows || [])];
  const csv = rows.map(row => row.map(cell => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${normalizeUxText(data.title || "printsys").replaceAll(" ", "-")}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function toggleContextDetails(target) {
  const view = target.closest(".view");
  view?.classList.toggle("show-workspace-details");
  const button = target.querySelector(".menu-action-details");
  if (button) button.textContent = view?.classList.contains("show-workspace-details") ? "Ocultar detalhes" : "Ver detalhes";
}

function applyWorkspaceFocus(viewName, active) {
  const section = document.getElementById(viewName);
  if (!section) return;
  section.dataset.workspaceGroup = normalizeUxText(active.group || "");
  section.dataset.workspaceLabel = normalizeUxText(active.label || "");
  section.querySelectorAll(".workspace-primary, .workspace-secondary").forEach(node => node.classList.remove("workspace-primary", "workspace-secondary"));
}

function directWorkspaceChild(section, node) {
  let current = node;
  while (current && current.parentElement !== section) current = current.parentElement;
  return current;
}

function workspacePrimarySelectors(viewName, active) {
  const label = normalizeUxText(active.label || "");
  if (viewName === "quote") return [".quote-form-pro", ".quote-footer", ".quote-workspace", "#quote-bottom-summary"];
  if (viewName === "orders") return ["#order-page", ".os-bottom-bar", "#orders-summary"];
  if (viewName === "pcp") return [".pcp-toolbar", "#pcp-dashboard-cards", "#production-detail-table", ".kanban", ".pcp-sector-strip"];
  if (viewName === "cash") {
    if (label.includes("venda")) return ["#quick-sale-form", "#quick-sales-list", "#cash-report", "#cash-status"];
    if (label.includes("despesa")) return ["#operational-expense-form", "#cash-report", "#cash-status"];
    if (label.includes("fechamento")) return ["#blind-close-form", "#cash-report", "#cash-status"];
    return ["#cash-open-form", "#cash-sale-form", "#cash-report", "#cash-status"];
  }
  if (viewName === "finance") {
    if (label.includes("dre")) return ["#dre-panel", "#finance-dashboard", "#finance-tables"];
    if (label.includes("pagar")) return ["#payable-form", "#finance-tables", "#finance-dashboard"];
    if (label.includes("receber") || label.includes("fiado")) return ["#finance-tables", "#finance-dashboard"];
    return ["#finance-dashboard", "#finance-tables"];
  }
  if (viewName === "products") return ["#products-table", "#product-form", "#materials-table", "#technical-sheet"];
  if (viewName === "settings") return ["#settings-grid", "#employees-panel", "#sectors-panel", "#cost-centers-panel", "#cost-config-form"];
  if (viewName === "commercial") return ["#crm-panel", "#commercial-board", "#commercial-table"];
  if (viewName === "customers") return ["#customer-form", "#customers-table"];
  return [];
}

function menuContextData(menu) {
  const group = normalizeUxText(menu.group);
  const label = normalizeUxText(menu.label);
  const title = `${menu.group ? `${menu.group} - ` : ""}${menu.label}`;
  const base = { title, summary: "Area operacional pronta para uso, com dados reais do PrintSys.", actionLabel: "Acessar", actionView: menu.view, cards: [] };
  if (menu.view === "dashboard") return { ...base, title: "Dashboard", summary: "Visao rapida da grafica para decidir o proximo passo.", cards: [["Vendas do dia", money.format(state.dashboard?.revenue || 0), "ok", "Entradas registradas."], ["O.S. atrasadas", state.dashboard?.lateOrders || 0, countStatus(state.dashboard?.lateOrders, 1, 3), "Pedidos fora do prazo."], ["Caixa", state.dashboard?.cashOpen ? "Aberto" : "Fechado", state.dashboard?.cashOpen ? "ok" : "warning", "Situacao do caixa."]] };
  if (label.includes("cliente")) return tableData(base, state.customers, ["Cliente", "Telefone", "E-mail", "Limite"], item => [item.name, item.phone || "-", item.email || "-", money.format(item.creditLimit || 0)], "Clientes cadastrados para atendimento, orcamento e fiado.");
  if (label.includes("lead") || label.includes("atendimento")) return tableData(base, state.crm?.leads || [], ["Atendimento", "Origem", "Vendedor", "Status"], item => [item.name || item.company, item.origin || "-", item.seller || "-", item.status || "-"], "Atendimentos e oportunidades comerciais em aberto.");
  if (label.includes("follow")) return tableData(base, state.crm?.followUps || [], ["Lead", "Data", "Canal", "Responsavel"], item => [item.leadName || item.leadId, item.date || "-", item.channel || "-", item.seller || "-"], "Retornos comerciais agendados.");
  if (label.includes("meta")) return tableData(base, state.crm?.sellerGoals || [], ["Vendedor", "Meta", "Realizado", "Status"], item => [item.seller, money.format(item.target || 0), money.format(item.done || item.current || 0), item.status || "-"], "Metas comerciais por vendedor.");
  if (group.includes("comercial") && (label.includes("crm") || label.includes("funil"))) return tableData(base, state.crm?.leads || [], ["Cliente", "Interesse", "Etapa", "Proxima acao"], item => [item.name || item.company, item.interest || "-", item.status || "-", item.nextContact || "-"], "Funil comercial com proximas acoes.");
  if (group.includes("orcamento") || label.includes("orcamento") || label.includes("aprova")) {
    if (label.includes("simular")) return tableData(base, state.pricingSimulations || [], ["Simulacao", "Composicao", "Preco", "Margem"], item => [item.id || "Simulacao", item.compositionName || item.compositionId || "-", money.format(item.finalPrice || item.suggestedPrice || 0), `${item.marginPercent || item.validation?.marginAtManualPrice || 0}%`], "Simulacoes recentes do motor de precificacao.");
    if (label.includes("banco") || label.includes("compos")) return compositionContext(base);
    return tableData(base, state.quotes || [], ["Orcamento", "Cliente", "Trabalho", "Status"], item => [item.quoteNumber || item.id, customerName(item.customerId), item.jobName, item.status], "Orcamentos reais cadastrados no sistema.");
  }
  if (group.includes("ordens") || label.includes("ordens de servico")) return ordersContext(base, label);
  if (group.includes("producao")) return productionContext(base, label);
  if (group.includes("caixa")) return cashContext(base, label);
  if (group.includes("financeiro")) return label.includes("caixa") ? cashContext(base, label) : financeContext(base, label);
  if (group.includes("estoque")) return stockContext(base, label);
  if (group.includes("produtos") || label.includes("produto") || label.includes("question")) return productContext(base, label);
  if (group.includes("gestao")) return managementContext(base, label);
  if (group.includes("sistema") || group.includes("administracao") || group.includes("configuracoes")) return systemContext(base, label);
  return base;
}

function tableData(base, rows, columns, mapper, summary) {
  return { ...base, summary, columns, rows: (rows || []).map(mapper), cards: [["Registros", rows?.length || 0, rows?.length ? "ok" : "warning", summary]] };
}

function ordersContext(base, label) {
  let rows = state.orders || [];
  if (label.includes("aberta")) rows = rows.filter(order => !String(order.productionStatus || "").toLowerCase().includes("entreg"));
  if (label.includes("pagamento")) rows = rows.filter(order => String(order.financialStatus || "").toLowerCase().includes("aguard") || String(order.financialStatus || "").toLowerCase().includes("pendente"));
  if (label.includes("arquivo")) rows = rows.filter(order => !(order.files || []).length);
  if (label.includes("producao")) rows = rows.filter(order => String(order.productionStatus || "").toLowerCase().includes("produ"));
  if (label.includes("entreg")) rows = rows.filter(order => String(order.productionStatus || "").toLowerCase().includes("entreg"));
  return tableData(base, rows, ["O.S.", "Cliente", "Trabalho", "Financeiro", "Producao", "Prazo"], order => [order.id, order.customerName, order.jobName, order.financialStatus, order.productionStatus, order.dueDate || "-"], "Ordens de servico filtradas conforme o submenu.");
}

function productionContext(base, label) {
  if (label.includes("veiculo")) return tableData(base, state.vehicles || [], ["Veiculo", "Placa", "Motorista", "Custo"], item => [item.vehicle, item.plate, item.driver, money.format((item.fuelCost || 0) + (item.maintenanceCost || 0))], "Veiculos usados em instalacao e deslocamento.");
  if (label.includes("capacidade")) return tableData(base, state.sectors || [], ["Setor", "Responsavel", "Capacidade", "Horario"], item => [item.name, item.responsible || "-", item.capacity || "-", item.schedule || "-"], "Capacidade produtiva por setor.");
  const rows = (state.orders || []).filter(order => label.includes("retrabalho") ? (order.events || []).some(event => event.rework) : true);
  return tableData(base, rows, ["O.S.", "Cliente", "Setor atual", "Prazo", "Status"], order => [order.id, order.customerName, order.productionStatus, order.dueDate || "-", productionVisualStatus(order).replace("_", " ")], "Fila operacional de producao, PCP e instalacao.");
}

function cashContext(base, label) {
  if (label.includes("venda")) return tableData(base, state.quickSales || [], ["Descricao", "Qtd.", "Total", "Pagamento"], item => [item.description, item.quantity, money.format(item.total || 0), item.paymentMethod], "Vendas rapidas registradas no PDV.");
  if (label.includes("despesa")) return tableData(base, state.operationalExpenses || [], ["Data", "Responsavel", "Categoria", "Valor"], item => [item.date || "-", item.responsible || item.operator || "-", item.category, money.format(item.value || 0)], "Retiradas e despesas vinculadas ao caixa.");
  return { ...base, summary: "Operacao de caixa com recebimentos, fechamento cego, sangria e suprimento.", cards: Object.entries(state.cashReport || {}).slice(0, 6).map(([key, value]) => [businessLabel(key), readableValue(key, value), "ok", "Resumo do caixa."]) };
}

function financeContext(base, label) {
  const data = state.financeData || {};
  if (label.includes("receber")) return tableData(base, data.receivables || [], ["Origem", "Cliente", "Vencimento", "Saldo"], item => [item.origin, item.customerName, item.dueDate, money.format(item.balance || item.amount || 0)], "Contas a receber e saldos pendentes.");
  if (label.includes("pagar")) return tableData(base, data.payables || [], ["Categoria", "Fornecedor", "Vencimento", "Saldo"], item => [item.category, item.supplier, item.dueDate, money.format(item.balance || item.amount || 0)], "Contas a pagar cadastradas.");
  if (label.includes("fiado")) return tableData(base, data.fiadoCustomers || [], ["Cliente", "Limite", "Saldo"], item => [item.name, money.format(item.creditLimit || 0), money.format(item.balance || 0)], "Clientes com fiado ou prazo.");
  if (label.includes("centro")) return tableData(base, state.costCenters || [], ["Centro", "Tipo", "Orcamento", "Status"], item => [item.name, item.type, money.format(item.monthlyBudget || 0), item.active ? "Ativo" : "Inativo"], "Centros de custo vinculados aos lancamentos.");
  return { ...base, summary: "Resumo financeiro, fluxo, DRE e inadimplencia.", cards: Object.entries(data.dashboard || data.cashFlow || {}).slice(0, 6).map(([key, value]) => [businessLabel(key), readableValue(key, value), "ok", businessDescription(key)]) };
}

function stockContext(base, label) {
  let rows = state.materials || [];
  if (label.includes("critico")) rows = rows.filter(item => Number(item.stock || 0) <= Number(item.minStock || 0));
  return tableData(base, rows, ["Material", "Unidade", "Estoque", "Minimo", "Custo"], item => [item.name, item.unit, item.stock, item.minStock, money.format(item.cost || 0)], "Materiais e movimentacoes de estoque.");
}

function productContext(base, label) {
  if (label.includes("compos")) return compositionContext(base);
  if (label.includes("question")) return tableData(base, state.products || [], ["Produto", "Categoria", "Perguntas"], item => [item.name, item.category, (item.questions || []).length], "Questionarios configurados por produto.");
  return tableData(base, state.products || [], ["Codigo", "Produto", "Categoria", "Preco minimo"], item => [item.code || "-", item.name, item.category, money.format(item.minPrice || 0)], "Produtos, processos e precificacao cadastrados.");
}

function compositionContext(base) {
  return tableData(base, state.compositions || [], ["Composicao", "Categoria", "Margem", "Prazo"], item => [item.name, item.category, `${item.marginPercent || 0}%`, `${item.deadlineDays || 0} dias`], "Banco tecnico de composicoes para orcamentos.");
}

function managementContext(base, label) {
  if (label.includes("alert")) return tableData(base, state.alerts || [], ["Alerta", "Gravidade", "Origem", "Status"], item => [businessLabel(item.type), item.severity, item.origin || "-", item.status || "aberto"], "Alertas importantes para o gestor.");
  return { ...base, summary: "Central de gestao com indicadores, relatorios e inteligencia.", cards: [["Receita", money.format(state.dashboard?.revenue || 0), "ok", "Receita do periodo."], ["Alertas", state.alerts?.length || 0, countStatus(state.alerts?.length, 1, 3), "Alertas ativos."], ["O.S. abertas", state.dashboard?.openOrders || 0, "ok", "Pedidos em andamento."]] };
}

function systemContext(base, label) {
  if (label.includes("usuario")) return tableData(base, state.users || [], ["Nome", "E-mail", "Perfil", "Setor", "Status"], item => [item.name, item.email, item.profile || item.role, item.sector || "-", item.active === false ? "Inativo" : "Ativo"], "Usuarios com login e permissao de acesso.");
  if (label.includes("funcionario")) return tableData(base, state.employees || [], ["Nome", "Setor", "Funcao", "Valor hora", "Status"], item => [item.name, item.sector, item.role, money.format(item.hourValue || 0), item.active ? "Ativo" : "Inativo"], "Funcionarios usados em hora homem, producao, instalacao e comissao.");
  if (label.includes("setor")) return tableData(base, state.sectors || [], ["Setor", "Responsavel", "Capacidade", "Permissoes"], item => [item.name, item.responsible || "-", item.capacity || "-", Object.values(item.permissions || {}).filter(Boolean).length], "Setores com permissoes herdadas.");
  if (label.includes("permiss") || label.includes("liber")) return tableData(base, Object.entries(state.permissions || {}), ["Permissao", "Status"], item => [businessLabel(item[0]), item[1] ? "Liberado" : "Bloqueado"], "Permissoes rapidas e liberacoes de acesso.");
  if (label.includes("log")) return tableData(base, state.audit || [], ["Acao", "Usuario", "Data", "Detalhe"], item => [businessLabel(item.action), item.user, item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : "-", item.details || "-"], "Logs e auditoria do sistema.");
  return tableData(base, state.sectors || [], ["Configuracao", "Responsavel", "Status"], item => [item.name, item.responsible || "-", item.active ? "Ativo" : "Inativo"], "Configuracoes iniciais, usuarios, formas de pagamento e backup.");
}

function improvePageHeaders() {
  const subtitles = {
    dashboard: "Visao rapida do caixa, vendas, producao, pendencias e alertas criticos.",
    orders: "Acompanhe cliente, valor, financeiro, producao, prazo, arquivos e historico de cada O.S.",
    pcp: "Controle o fluxo da producao, setores, instalacao, capacidade, retrabalho e previsto x real.",
    finance: "Resumo gerencial de contas, fiados, fluxo de caixa, DRE, despesas e inadimplencia.",
    cash: "Operacao diaria do PDV: abrir caixa, receber O.S., venda rapida, despesas e fechamento cego.",
    customers: "Cadastro, historico, credito, arquivos e acesso ao portal do cliente.",
    products: "Produtos, materiais, ficha tecnica e configuracoes de precificacao.",
    admin: "Perguntas por produto e regras de impacto no orcamento.",
    control: "Permissoes rapidas, caixa, pagamentos, resumo diario e auditoria operacional.",
    settings: "Configuracoes avancadas acessiveis apenas para Admin Geral."
  };
  Object.entries(subtitles).forEach(([id, subtitle]) => {
    const section = document.getElementById(id);
    if (!section) return;
    if (!section.querySelector(":scope > .title")) {
      section.insertAdjacentHTML("afterbegin", `<div class="title page-header"><div><h1>${businessLabel(id)}</h1><p>${subtitle}</p></div></div>`);
      return;
    }
    const header = section.querySelector(":scope > .title");
    if (header.querySelector("p")) return;
    const title = header.querySelector("h1");
    title?.insertAdjacentHTML("afterend", `<p>${subtitle}</p>`);
  });
}

function improveOperationalLayout() {
  document.querySelectorAll(".module-tabs").forEach(tabs => {
    if (tabs.querySelectorAll("button").length > 6) tabs.classList.add("page-tabs-scroll");
  });
  document.querySelectorAll(".panel table").forEach(table => {
    table.closest(".panel")?.classList.add("table-panel");
  });
  document.querySelectorAll(".price-box").forEach(box => {
    if (box.textContent.trim().startsWith("{") || box.textContent.includes("chaveInterna")) {
      box.classList.add("details-panel");
    }
  });
}

function prepareQuoteWorkspace() {
  const quote = document.getElementById("quote");
  if (!quote || quote.dataset.workspaceReady) return;
  quote.dataset.workspaceReady = "true";
  quote.classList.add("quote-single-screen");
  quote.querySelector(":scope > .grid.two")?.classList.add("quote-workspace");
  const footer = quote.querySelector(".quote-footer");
  if (footer && !document.getElementById("quote-bottom-summary")) {
    footer.insertAdjacentHTML("afterbegin", `<span id="quote-bottom-summary">Total: R$ 0,00 | Sinal: R$ 0,00 | Saldo: R$ 0,00 | Margem: 0%</span>`);
  }
  if (footer && !document.getElementById("add-quote-item")) {
    footer.insertAdjacentHTML("afterbegin", `<button type="button" id="add-quote-item">Adicionar item</button>`);
  }
  const side = quote.querySelector(".quote-side-panel");
  const sideTitle = side?.querySelector("h2");
  if (sideTitle) sideTitle.textContent = "Resumo final";
  if (side && !document.getElementById("quote-detail-toggle")) {
    side.insertAdjacentHTML("afterbegin", `<button type="button" id="quote-detail-toggle">Ver detalhes do calculo</button>`);
  }
  const itemsTable = document.getElementById("quote-items-preview")?.closest("table");
  if (itemsTable) {
    itemsTable.querySelector("thead").innerHTML = `<tr><th>Item</th><th>Produto / servico</th><th>Medida</th><th>Qtd</th><th>Unitario</th><th>Total</th><th>Setores</th><th>Acoes</th></tr>`;
  }
  document.getElementById("add-quote-item")?.addEventListener("click", () => openQuoteItemPanel());
  document.getElementById("quote-detail-toggle")?.addEventListener("click", () => side?.classList.toggle("show-details"));
  document.getElementById("quote-items-preview")?.addEventListener("click", handleQuoteItemAction);
  const itemsPanel = document.getElementById("quote-items-preview")?.closest(".panel");
  if (itemsPanel && !document.getElementById("quote-item-cards")) {
    itemsPanel.querySelector("h2")?.insertAdjacentHTML("afterend", `<div id="quote-item-cards" class="quote-item-cards"></div>`);
    document.getElementById("quote-item-cards")?.addEventListener("click", handleQuoteItemAction);
  }
  renderQuoteItemCards(state.activeQuotePricing ? buildQuoteItem(state.activeQuotePricing, "Previa") : null);
  prepareQuoteSingleScreenLayout();
}

function prepareFinalQuoteFooterActions(quote) {
  if (!quote) return;
  prepareQuoteSingleScreenLayout();
}

function findFieldBlock(id) {
  const element = document.getElementById(id);
  if (!element) return null;
  return element.closest("label") || element;
}

function appendFieldBlock(target, id) {
  const block = findFieldBlock(id) || document.getElementById(id);
  if (target && block && !target.contains(block)) target.appendChild(block);
}

function renderPageShell({ id, header = "", tabs = "", body = "", footer = "" }) {
  return `<section id="${id}" class="root-page-shell">${header}${tabs}<div class="root-page-body">${body}</div>${footer}</section>`;
}

function renderPageHeader({ eyebrow, title, subtitle, metrics = [], actions = [] }) {
  return `<header class="root-page-header"><div class="root-page-heading"><span>${eyebrow}</span><h1>${title}</h1><p>${subtitle}</p></div><div class="root-page-metrics">${metrics.map(item => `<div><span>${item.label}</span><b id="${item.id || ""}">${item.value}</b></div>`).join("")}</div><div class="root-page-actions">${actions.map(action => `<button type="${action.type || "button"}" ${action.id ? `id="${action.id}"` : ""} ${action.data || ""} class="${action.primary ? "primary" : ""}">${action.label}</button>`).join("")}</div></header>`;
}

function renderCompactTabs(id, tabs, active = tabs[0]?.id) {
  return `<nav id="${id}" class="root-compact-tabs" aria-label="Seções">${tabs.map(tab => `<button type="button" data-root-tab="${tab.id}" class="${tab.id === active ? "active" : ""}">${tab.label}</button>`).join("")}</nav>`;
}

function renderSummaryCards(cards) {
  return `<div class="root-summary-cards">${cards.map(card => `<article><span>${card.label}</span><b>${card.value}</b>${card.description ? `<small>${card.description}</small>` : ""}</article>`).join("")}</div>`;
}

function renderCompactFormGrid(id, title, columns = 4) {
  return `<section class="root-compact-block"><div class="root-block-heading"><h2>${title}</h2></div><div id="${id}" class="root-form-grid" style="--root-columns:${columns}"></div></section>`;
}

function renderProductQuestionGrid(product, questions) {
  const mode = product?.pricingMode || "unit";
  const hint = mode === "square_meter" ? "Cálculo por m²" : mode === "linear_meter" ? "Cálculo por metro linear" : "Cálculo por unidade";
  return `<div class="root-question-heading"><span>${hint}</span><small>${questions.length} pergunta(s) configurada(s)</small></div>`;
}

function calculateProductMeasure(product, answers = {}) {
  const mode = product?.pricingMode || "unit";
  const quantity = Math.max(Number(answers.quantity || 1), 1);
  if (mode === "square_meter") return { label: `${Number(answers.width || 0)} x ${Number(answers.height || 0)} m`, value: Number(answers.width || 0) * Number(answers.height || 0) * quantity, unit: "m²" };
  if (mode === "linear_meter") return { label: `${Number(answers.linearMeasure || answers.linear_measure || 0)} m`, value: Number(answers.linearMeasure || answers.linear_measure || 0) * quantity, unit: "m" };
  return { label: `${quantity} un.`, value: quantity, unit: "un." };
}

function calculateQuestionCost(pricing = state.activeQuotePricing) {
  return (pricing?.questionCosts || []).reduce((sum, line) => sum + Number(line.amount || 0), 0);
}

function calculateQuoteTotals(pricing = state.activeQuotePricing) {
  const totals = quoteGrandTotal();
  const downPayment = Number(document.getElementById("quote-down-payment")?.value || 0);
  return { ...totals, downPayment, balance: Math.max(totals.finalValue - downPayment, 0), questionCost: calculateQuestionCost(pricing) };
}

function activateRootTab(shellId, tabId) {
  const shell = document.getElementById(shellId);
  if (!shell) return;
  shell.querySelectorAll("[data-root-tab]").forEach(button => button.classList.toggle("active", button.dataset.rootTab === tabId));
  shell.querySelectorAll(":scope > .root-page-body > .root-tab-pane, :scope > .root-tab-pane").forEach(pane => pane.classList.toggle("active", pane.dataset.rootPane === tabId));
  shell.dataset.activeTab = tabId;
}

function updateQuoteMeasurementVisibility() {
  const product = productForQuoteConfiguration();
  const mode = product?.pricingMode || "unit";
  document.querySelectorAll("#quote-measure-grid [data-measure-mode]").forEach(block => {
    block.hidden = !block.dataset.measureMode.split(" ").includes(mode);
  });
  const summary = document.getElementById("quote-measure-summary");
  if (summary) {
    const measure = calculateProductMeasure(product, collectAnswers());
    summary.textContent = `${measure.label} | ${measure.value.toFixed(2)} ${measure.unit}`;
  }
}

function prepareQuoteSingleScreenLayout() {
  const quote = document.getElementById("quote");
  const form = document.getElementById("quote-form");
  const workspace = quote?.querySelector(".quote-workspace");
  if (!quote || !form || !workspace) return;
  if (form.dataset.rootShellReady === "true") {
    updateQuoteMeasurementVisibility();
    return;
  }
  form.dataset.rootShellReady = "true";
  quote.classList.add("quote-root-refactor");
  quote.querySelector(":scope > .title")?.remove();
  quote.querySelector(":scope > .module-tabs")?.remove();
  quote.querySelectorAll(":scope > .ux-flow-strip, :scope > .simple-helper-bar, #quote-guided-wizard").forEach(node => node.remove());

  const nodes = {};
  ["quote-customer", "quote-contact", "quote-seller", "quote-attendant", "quote-campaign", "quote-delivery-address", "quote-logistics", "quote-deadline", "quote-validity", "quote-product", "quote-product-model", "quote-composition", "quote-job", "quote-payment-method", "quote-payment-terms", "quote-billing", "quote-down-payment", "quote-bill-to", "quote-purchase-order", "quote-purchase-file", "quote-human-hours", "quote-commission", "quote-extra-costs", "quote-extra-costs-final", "quote-manual-price", "quote-price-reason", "quote-discount", "quote-client-note", "quote-production-note", "quote-finance-note", "quote-preview-files", "quote-production-files"].forEach(id => {
    nodes[id] = findFieldBlock(id);
  });
  nodes.customerCard = document.getElementById("quote-customer-card");
  nodes.compositionInfo = document.getElementById("quote-composition-info");
  nodes.questionFields = document.getElementById("question-fields");
  nodes.priceSide = quote.querySelector(".quote-side-panel");
  nodes.footer = form.querySelector(".quote-footer");
  const measureInputs = {
    width: document.querySelector("#quote [data-answer='width']")?.closest("label"),
    height: document.querySelector("#quote [data-answer='height']")?.closest("label"),
    thickness: document.querySelector("#quote [data-answer='thickness']")?.closest("label"),
    quantity: document.querySelector("#quote [data-answer='quantity']")?.closest("label")
  };
  if (!document.querySelector("#quote [data-answer='linearMeasure']")) {
    const linear = document.createElement("label");
    linear.innerHTML = `Metro linear<input data-answer="linearMeasure" type="number" step="0.01" placeholder="0,00">`;
    measureInputs.linearMeasure = linear;
  } else {
    measureInputs.linearMeasure = document.querySelector("#quote [data-answer='linearMeasure']").closest("label");
  }
  const itemsTable = document.getElementById("quote-items-preview")?.closest("table");
  const quoteListPanel = document.getElementById("quote-table")?.closest(".panel");
  const oldItemsPanel = itemsTable?.closest(".panel");

  form.innerHTML = renderPageShell({
    id: "quote-root-shell",
    header: renderPageHeader({
      eyebrow: "Comercial",
      title: "Orçamento",
      subtitle: "Produto cadastrado, cálculo real e rota produtiva em um fluxo compacto.",
      metrics: [
        { label: "Cliente", id: "quote-root-customer", value: "-" },
        { label: "Status", id: "quote-root-status", value: "Rascunho" },
        { label: "Vendedor", id: "quote-root-seller", value: "-" },
        { label: "Prazo", id: "quote-root-deadline", value: "-" },
        { label: "Itens", id: "quote-root-items", value: "0" },
        { label: "Total", id: "quote-root-total", value: money.format(0) }
      ],
      actions: [
        { id: "quote-header-new", label: "Novo" },
        { id: "quote-header-save", label: "Salvar", primary: true },
        { label: "Aprovar", data: 'data-quote-final-action="approve"' },
        { label: "Gerar O.S.", data: 'data-quote-final-action="order"' },
        { label: "Imprimir", data: 'data-quote-final-action="print"' }
      ]
    }),
    tabs: renderCompactTabs("quote-root-tabs", [
      { id: "data", label: "Dados" },
      { id: "items", label: "Itens" },
      { id: "costs", label: "Custos" },
      { id: "review", label: "Revisão" }
    ], "items"),
    body: `
      <section class="root-tab-pane" data-root-pane="data">
        ${renderCompactFormGrid("quote-data-grid", "Cliente e dados comerciais", 4)}
        ${renderCompactFormGrid("quote-delivery-grid", "Entrega e prazo", 4)}
        <div id="quote-root-customer-card"></div>
      </section>
      <section class="root-tab-pane active" data-root-pane="items">
        <div id="quote-project-recognition-slot"></div>
        ${renderCompactFormGrid("quote-product-grid", "Produto e composição", 3)}
        <section class="root-compact-block"><div class="root-block-heading"><h2>Medidas</h2><small id="quote-measure-summary"></small></div><div id="quote-measure-grid" class="root-measure-grid"></div></section>
        <section class="root-compact-block"><div class="root-block-heading"><h2>Perguntas do produto</h2><div id="quote-question-summary"></div></div><div id="quote-root-questions" class="root-question-grid"></div></section>
        <div class="root-inline-actions"><button type="button" id="simulate-price">Calcular item</button><button type="button" class="primary" id="add-quote-item">Adicionar item</button></div>
        <section class="root-compact-block root-table-block"><div class="root-block-heading"><h2>Itens do orçamento</h2></div><div id="quote-root-items-table"></div></section>
      </section>
      <section class="root-tab-pane" data-root-pane="costs">
        <div class="root-cost-layout"><div>${renderCompactFormGrid("quote-cost-grid", "Ajustes comerciais", 4)}</div><aside id="quote-root-price"></aside></div>
      </section>
      <section class="root-tab-pane" data-root-pane="review">
        ${renderCompactFormGrid("quote-payment-grid", "Pagamento e faturamento", 4)}
        ${renderCompactFormGrid("quote-note-grid", "Observações", 3)}
        ${renderCompactFormGrid("quote-file-grid", "Arquivos", 4)}
        <section class="root-compact-block root-table-block"><div class="root-block-heading"><h2>Orçamentos salvos</h2></div><div id="quote-root-list"></div></section>
      </section>
    `,
    footer: `<footer class="root-page-footer"><span id="quote-bottom-summary">Total: ${money.format(0)} | Saldo: ${money.format(0)}</span><button type="button" id="quote-root-print" data-quote-final-action="print">Imprimir</button><button type="submit" class="primary">Salvar orçamento</button></footer>`
  });

  const appendCaptured = (targetId, ids) => {
    const target = document.getElementById(targetId);
    ids.forEach(id => {
      const block = nodes[id];
      if (target && block) target.appendChild(block);
    });
  };
  appendCaptured("quote-data-grid", ["quote-customer", "quote-contact", "quote-seller", "quote-attendant", "quote-campaign"]);
  appendCaptured("quote-delivery-grid", ["quote-delivery-address", "quote-logistics", "quote-deadline", "quote-validity"]);
  if (nodes.customerCard) document.getElementById("quote-root-customer-card").appendChild(nodes.customerCard);
  appendCaptured("quote-product-grid", ["quote-product", "quote-product-model", "quote-composition", "quote-job"]);
  if (nodes.compositionInfo) document.getElementById("quote-product-grid").appendChild(nodes.compositionInfo);
  Object.entries(measureInputs).forEach(([mode, block]) => {
    if (!block) return;
    const accepted = mode === "quantity" ? "unit square_meter linear_meter" : mode === "linearMeasure" ? "linear_meter" : mode === "thickness" ? "square_meter" : "square_meter";
    block.dataset.measureMode = accepted;
    document.getElementById("quote-measure-grid").appendChild(block);
  });
  if (nodes.questionFields) document.getElementById("quote-root-questions").appendChild(nodes.questionFields);
  appendCaptured("quote-cost-grid", ["quote-human-hours", "quote-commission", "quote-extra-costs", "quote-extra-costs-final", "quote-manual-price", "quote-price-reason", "quote-discount"]);
  if (nodes.priceSide) document.getElementById("quote-root-price").appendChild(nodes.priceSide);
  appendCaptured("quote-payment-grid", ["quote-payment-method", "quote-payment-terms", "quote-billing", "quote-down-payment", "quote-bill-to"]);
  appendCaptured("quote-note-grid", ["quote-client-note", "quote-production-note", "quote-finance-note"]);
  appendCaptured("quote-file-grid", ["quote-preview-files", "quote-production-files", "quote-purchase-order", "quote-purchase-file"]);
  if (itemsTable) document.getElementById("quote-root-items-table").appendChild(itemsTable);
  if (quoteListPanel) document.getElementById("quote-root-list").appendChild(quoteListPanel);
  if (oldItemsPanel && oldItemsPanel !== quoteListPanel) oldItemsPanel.remove();
  nodes.footer?.remove();
  workspace.querySelector(".panel")?.classList.add("root-form-host");
  quote.querySelectorAll(":scope > .panel").forEach(panel => {
    if (!panel.contains(form) && !document.getElementById("quote-root-shell")?.contains(panel)) panel.remove();
  });

  document.getElementById("quote-root-tabs")?.addEventListener("click", event => {
    const button = event.target.closest("[data-root-tab]");
    if (button) activateRootTab("quote-root-shell", button.dataset.rootTab);
  });
  document.getElementById("quote-header-save")?.addEventListener("click", () => form.requestSubmit());
  document.getElementById("quote-header-new")?.addEventListener("click", () => {
    state.quoteItems = [];
    state.lastSavedQuoteId = null;
    resetQuoteProductFields();
    renderQuoteItemPreview(null);
    renderQuoteTotals(null);
    activateRootTab("quote-root-shell", "items");
  });
  document.getElementById("simulate-price")?.addEventListener("click", async () => {
    const result = await api("/api/quote/calculate", { method: "POST", body: quoteRequestBody() });
    renderQuotePricingResult(result);
    renderQuoteItemPreview(result);
    renderQuoteTotals(result);
  });
  document.getElementById("add-quote-item")?.addEventListener("click", addCurrentQuoteItem);
  form.addEventListener("input", updateQuoteMeasurementVisibility);
  form.addEventListener("change", updateQuoteMeasurementVisibility);
  prepareQuoteProjectRecognitionPanel();
  renderQuoteProductModels();
  updateQuoteMeasurementVisibility();
  updateQuoteSingleScreenSummary();
}

function setQuoteDetailTab(tab) {
  document.querySelectorAll("#quote-single-details [data-quote-detail-tab]").forEach(button => {
    button.classList.toggle("active", button.dataset.quoteDetailTab === tab);
  });
  document.querySelectorAll("#quote-single-details .single-tab-pane").forEach(pane => pane.classList.remove("active"));
  document.getElementById(`quote-detail-${tab}`)?.classList.add("active");
}

function configureQuoteSingleFooter() {
  const footer = document.querySelector("#quote .quote-footer");
  if (!footer || footer.dataset.singleFooterReady === "true") return;
  footer.dataset.singleFooterReady = "true";
  footer.innerHTML = `
    <span id="quote-bottom-summary">Total: R$ 0,00 | Sinal: R$ 0,00 | Saldo: R$ 0,00 | Margem: 0%</span>
    <button type="button" id="add-quote-item">Adicionar item</button>
    <button type="button" id="simulate-price">Simular preco</button>
    <button type="submit" class="primary">Salvar</button>
    <button type="button" data-quote-final-action="approve">Aprovar</button>
    <button type="button" data-quote-final-action="order">Gerar O.S.</button>
    <button type="button" data-quote-final-action="print">Imprimir</button>
    <button type="button" data-quote-final-action="cancel">Cancelar</button>
  `;
  document.getElementById("add-quote-item")?.addEventListener("click", () => openQuoteItemPanel());
  document.getElementById("simulate-price")?.addEventListener("click", async () => {
    const result = await api("/api/quote/calculate", { method: "POST", body: quoteRequestBody() });
    renderQuotePricingResult(result);
    renderQuoteItemPreview(result);
    renderQuoteTotals(result);
  });
}

function updateQuoteSingleScreenSummary(pricing = state.activeQuotePricing) {
  const rootShell = document.getElementById("quote-root-shell");
  if (rootShell) {
    const totals = calculateQuoteTotals(pricing);
    const customer = document.getElementById("quote-customer")?.selectedOptions?.[0]?.textContent || "Não selecionado";
    const deadline = document.getElementById("quote-deadline")?.value || "Sem prazo";
    const seller = document.getElementById("quote-seller")?.value || state.user?.name || "A definir";
    const values = {
      "quote-root-customer": customer,
      "quote-root-status": state.lastSavedQuoteId ? "Salvo" : "Rascunho",
      "quote-root-seller": seller,
      "quote-root-deadline": deadline,
      "quote-root-items": String(state.quoteItems.length),
      "quote-root-total": money.format(totals.finalValue)
    };
    Object.entries(values).forEach(([id, value]) => {
      const target = document.getElementById(id);
      if (target) target.textContent = value;
    });
    const footer = document.getElementById("quote-bottom-summary");
    if (footer) footer.textContent = `Total: ${money.format(totals.finalValue)} | Sinal: ${money.format(totals.downPayment)} | Saldo: ${money.format(totals.balance)} | Custos das perguntas: ${money.format(totals.questionCost)}`;
    return;
  }
  const header = document.getElementById("quote-single-header");
  if (!header) return;
  const totals = quoteGrandTotal();
  const downPayment = Number(document.getElementById("quote-down-payment")?.value || 0);
  const margin = state.quoteItems.length ? averageQuoteMargin() : (pricing?.validation?.marginAtManualPrice ?? pricing?.marginPercent ?? 0);
  const customerSelect = document.getElementById("quote-customer");
  const customer = customerSelect?.selectedOptions?.[0]?.textContent || "Cliente nao selecionado";
  const seller = document.getElementById("quote-seller")?.value || "Vendedor";
  const deadline = document.getElementById("quote-deadline")?.value || "Sem prazo";
  const status = state.lastSavedQuoteId ? "Salvo" : "Em edicao";
  header.innerHTML = `
    <div class="single-header-title premium-module-title">
      <span>Comercial</span>
      <strong>Orçamentos</strong>
      <small>Monte propostas com composição técnica, custo real, margem e aprovação.</small>
    </div>
    <div class="single-header-kpis">
      <div><span>Cliente</span><b>${customer}</b></div>
      <div><span>Status</span><b><span class="status-pill">${status}</span></b></div>
      <div><span>Vendedor</span><b>${seller}</b></div>
      <div><span>Prazo</span><b>${deadline}</b></div>
      <div><span>Total</span><strong>${money.format(totals.finalValue)}</strong></div>
      <div><span>Saldo</span><b>${money.format(Math.max(totals.finalValue - downPayment, 0))}</b></div>
    </div>
    <div class="single-header-actions">
      <button type="button" id="quote-header-new">Novo orçamento</button>
      <button type="button" id="quote-header-save">Salvar</button>
      <button type="button" data-quote-final-action="approve">Aprovar</button>
      <button type="button" class="primary" data-quote-final-action="order">Gerar O.S.</button>
      <button type="button" data-quote-final-action="print">Imprimir</button>
    </div>
    <div class="premium-horizontal-tabs">
      <button type="button" data-scroll-target="quote-top-cards" class="active">Dados</button>
      <button type="button" data-scroll-target="quote-items-preview">Itens</button>
      <button type="button" data-scroll-target="quote-card-finance">Custos</button>
      <button type="button" data-scroll-target="quote-single-details">Revisão</button>
    </div>
  `;
  document.getElementById("quote-header-save")?.addEventListener("click", () => document.getElementById("quote-form")?.requestSubmit());
  document.getElementById("quote-header-new")?.addEventListener("click", () => {
    state.quoteItems = [];
    state.lastSavedQuoteId = null;
    resetQuoteProductFields();
    renderQuoteItemPreview(null);
    renderQuoteTotals(null);
    updateQuoteSingleScreenSummary(null);
  });
  header.querySelectorAll("[data-scroll-target]").forEach(button => {
    button.addEventListener("click", () => document.getElementById(button.dataset.scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  });
}

function prepareOrdersWorkspace() {
  const orders = document.getElementById("orders");
  if (!orders || orders.dataset.workspaceReady) return;
  orders.dataset.workspaceReady = "true";
  const title = orders.querySelector(":scope > .title");
  if (title && !document.getElementById("orders-header-actions")) {
    title.innerHTML = `
      <div><h1>Ordens de Serviço</h1><p>Controle prazo, produção, financeiro, arquivos e histórico em uma única tela.</p></div>
      <div id="orders-header-actions" class="page-actions">
        <button type="button" data-view="quote">Nova O.S.</button>
        <button type="button" data-action="print-order">Imprimir</button>
        <button type="button" class="primary" data-action="send-pcp">Enviar produção</button>
        <button type="button" data-action="bill-order">Receber</button>
        <button type="button" data-action="attach-order">Anexar</button>
        <button type="button" data-action="history-order">Histórico</button>
      </div>
    `;
    title.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => view(button.dataset.view, button)));
  }
  const tabs = orders.querySelector(":scope > .module-tabs");
  if (tabs && !document.getElementById("orders-work-tabs")) {
    tabs.insertAdjacentHTML("afterend", horizontalTabs("orders-work-tabs", [
      { label: "Todas", data: 'data-order-tab-filter=""' },
      { label: "Hoje", data: 'data-order-tab-filter="hoje"' },
      { label: "Atrasadas", data: 'data-order-tab-filter="atras"' },
      { label: "Em produção", data: 'data-order-tab-filter="producao"' },
      { label: "Finalizadas", data: 'data-order-tab-filter="final"' },
      { label: "Sem arquivo", data: 'data-order-tab-filter="sem arquivo"' },
      { label: "Sem pagamento", data: 'data-order-tab-filter="sem pagamento"' }
    ]));
    document.getElementById("orders-work-tabs")?.addEventListener("click", event => {
      const button = event.target.closest("[data-order-tab-filter]");
      if (!button) return;
      document.querySelectorAll("#orders-work-tabs button").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      const filter = document.getElementById("order-filter");
      if (filter) filter.value = button.dataset.orderTabFilter || "";
      renderOrders();
    });
  }
  if (tabs && !document.getElementById("order-page")) {
    tabs.insertAdjacentHTML("afterend", `
      <div id="order-page" class="order-page quote-form-pro">
        <div id="order-header-sticky" class="order-header-sticky"></div>

        <div class="order-section">
          <div class="quote-section-title"><span>1</span><h3>Dados do cliente</h3></div>
          <div id="order-client-card" class="client-summary compact"></div>
        </div>

        <div class="order-section">
          <div class="quote-section-title"><span>2</span><h3>Dados comerciais</h3></div>
          <div id="order-commercial-grid" class="mini-grid"></div>
        </div>

        <div class="order-section">
          <div class="quote-section-title"><span>3</span><h3>Dados do trabalho</h3></div>
          <div id="order-work-grid" class="mini-grid"></div>
        </div>

        <div class="order-section">
          <div class="quote-section-title"><span>4</span><h3>Itens da O.S.</h3></div>
          <table class="order-items-table"><thead><tr><th>Item</th><th>Produto</th><th>Composicao</th><th>Descricao</th><th>Medidas</th><th>Qtd.</th><th>Unitario</th><th>Subtotal</th><th>Financeiro</th><th>Producao</th><th>Acoes</th></tr></thead><tbody id="orders-items-table"></tbody></table>
        </div>

        <div class="order-section">
          <div class="quote-section-title"><span>5</span><h3>Arquivos da O.S.</h3></div>
          <div id="order-files-grid" class="mini-grid"></div>
        </div>

        <div class="order-section">
          <div class="quote-section-title"><span>6</span><h3>Observacoes</h3></div>
          <div id="order-notes-grid" class="mini-grid"></div>
        </div>

        <div class="order-section">
          <div class="quote-section-title"><span>7</span><h3>Financeiro da O.S.</h3></div>
          <div id="order-finance-grid" class="mini-grid"></div>
          <div class="action-bar order-section-actions">
            <button data-action="bill-order">Receber pagamento</button>
            <button data-action="bill-order">Receber sinal</button>
            <button data-action="bill-order">Faturar</button>
            <button data-action="bill-order">Lancar fiado</button>
            <button data-action="history-order">Historico financeiro</button>
          </div>
        </div>

        <div class="order-section">
          <div class="quote-section-title"><span>8</span><h3>Producao / PCP</h3></div>
          <div id="order-production-grid" class="mini-grid"></div>
          <div class="action-bar order-section-actions">
            <button data-action="send-pcp">Enviar para PCP</button>
            <button data-view="pcp">Abrir no PCP</button>
            <button data-production-action="iniciar">Iniciar producao</button>
            <button data-production-action="pausar">Pausar</button>
            <button data-production-action="finalizar">Finalizar etapa</button>
            <button data-production-action="problema">Registrar problema</button>
            <button data-production-action="retrabalho">Registrar retrabalho</button>
          </div>
        </div>

        <div class="order-section">
          <div class="quote-section-title"><span>9</span><h3>Instalacao</h3></div>
          <div id="order-installation-grid" class="mini-grid"></div>
          <div class="action-bar order-section-actions">
            <button data-view="pcp">Montar equipe</button>
            <button data-view="pcp">Iniciar instalacao</button>
            <button data-view="pcp">Finalizar instalacao</button>
            <button data-action="attach-order">Anexar fotos</button>
            <button data-view="finance">Registrar despesa</button>
          </div>
        </div>

        <div class="order-section">
          <div class="quote-section-title"><span>10</span><h3>Timeline da O.S.</h3></div>
          <div id="order-timeline-full" class="timeline order-timeline-full"></div>
        </div>
      </div>
    `);
  }
  if (!document.getElementById("orders-bottom-summary")) {
    orders.insertAdjacentHTML("beforeend", `
      <div class="os-bottom-bar">
        <span id="orders-bottom-summary">Valor: R$ 0,00 | Sinal: R$ 0,00 | Saldo: R$ 0,00 | Financeiro: - | Producao: -</span>
        <button type="button" data-action="attach-order">Anexar arquivo</button>
        <button type="button" data-action="print-order">Imprimir O.S.</button>
        <button type="button" data-action="bill-order">Faturar</button>
        <button type="button" data-action="send-pcp">Enviar PCP</button>
        <button type="button" data-view="pcp">Ver producao</button>
        <button type="button" data-action="history-order">Ver historico</button>
        <button type="button" data-view="dashboard">Fechar</button>
      </div>
    `);
  }
  prepareOrderSingleScreenShell();
  orders.querySelectorAll(":scope > .grid.two").forEach(node => node.classList.add("orders-legacy-layout"));
  document.getElementById("orders-summary")?.classList.add("orders-visible-summary");
  const ordersListPanel = document.getElementById("orders-table")?.closest(".panel");
  ordersListPanel?.classList.add("orders-list-panel");
  ordersListPanel?.querySelector("thead") && (ordersListPanel.querySelector("thead").innerHTML = `<tr><th>O.S.</th><th>Cliente</th><th>Serviço</th><th>Prazo</th><th>Produção</th><th>Financeiro</th><th>Setor</th><th>Responsável</th><th>Ações</th></tr>`);
  const orderPage = document.getElementById("order-page");
  if (ordersListPanel && orderPage && ordersListPanel.nextElementSibling !== orderPage) ordersListPanel.after(orderPage);
  document.getElementById("order-current-select")?.addEventListener("change", event => {
    state.activeOrderId = event.target.value;
    renderOrders();
  });
  if (state.orders?.length) renderOrders();
}

function prepareOrderSingleScreenShell() {
  const page = document.getElementById("order-page");
  if (!page || page.dataset.singleShellReady === "true") return;
  page.dataset.singleShellReady = "true";
  page.classList.add("order-single-screen");
  page.innerHTML = `
    <div id="order-header-sticky" class="order-header-sticky"></div>
    <div id="order-summary-cards" class="order-single-cards"></div>
    <div class="order-section order-items-section">
      <div class="quote-section-title"><span>1</span><h3>Itens da O.S.</h3></div>
      <table class="order-items-table"><thead><tr><th>Item</th><th>Descricao</th><th>Medida</th><th>Qtd</th><th>Setor</th><th>Status</th><th>Acoes</th></tr></thead><tbody id="orders-items-table"></tbody></table>
    </div>
    <div class="order-lower-grid">
      <section class="order-section">
        <div class="quote-section-title"><span>2</span><h3>Producao detalhada</h3></div>
        <div id="order-production-grid" class="mini-grid"></div>
      </section>
      <section class="order-section">
        <div class="quote-section-title"><span>3</span><h3>Financeiro resumido</h3></div>
        <div id="order-finance-grid" class="mini-grid"></div>
      </section>
      <section class="order-section">
        <div class="quote-section-title"><span>4</span><h3>Anexos</h3></div>
        <div id="order-files-grid" class="mini-grid"></div>
      </section>
      <section class="order-section">
        <div class="quote-section-title"><span>5</span><h3>Historico</h3></div>
        <div id="order-timeline-full" class="timeline order-timeline-full"></div>
      </section>
    </div>
  `;
  const bottom = document.querySelector("#orders .os-bottom-bar");
  if (bottom) {
    bottom.classList.add("os-inline-footer");
    bottom.innerHTML = `<span id="orders-bottom-summary">Valor: R$ 0,00 | Sinal: R$ 0,00 | Saldo: R$ 0,00 | Financeiro: - | Producao: -</span>`;
  }
}

function preparePcpWorkspace() {
  const pcp = document.getElementById("pcp");
  if (!pcp || pcp.dataset.workspaceReady) return;
  pcp.dataset.workspaceReady = "true";
  const cards = document.getElementById("pcp-dashboard-cards");
  cards?.insertAdjacentHTML("beforebegin", `
    <div class="pcp-toolbar panel">
      <div class="production-operator-tabs" role="tablist" aria-label="Fila operacional">
        <button type="button" data-production-view="mine" class="active">Minhas O.S.</button>
        <button type="button" data-production-view="sector">O.S. do setor</button>
        <button type="button" data-production-view="upcoming">Proximos trabalhos</button>
        <button type="button" data-production-view="running">Em andamento</button>
        <button type="button" data-production-view="paused">Pausadas</button>
        <button type="button" data-production-view="finished">Finalizadas</button>
        <button type="button" data-production-view="installation">Instalacao</button>
        <button type="button" data-production-view="checklist">Checklist</button>
        <button type="button" data-production-view="files">Arquivos / anexos</button>
      </div>
      <div class="production-scope-tabs" role="tablist" aria-label="Periodo da producao">
        <button type="button" data-production-scope="today" class="active">Hoje</button>
        <button type="button" data-production-scope="next3">Proximos 3 dias</button>
        <button type="button" data-production-scope="all">Geral da producao</button>
      </div>
      <div class="pcp-filter-summary">
        <div><b id="pcp-filter-summary-text">Hoje | Todos os setores | Todos os status</b><small id="pcp-filter-count">Nenhum filtro avancado ativo</small></div>
        <div class="row-actions"><button type="button" id="pcp-open-filters">Filtros avancados</button><button type="button" id="pcp-clear-filters-compact">Limpar filtros</button></div>
      </div>
      <section id="pcp-advanced-filters" class="pcp-advanced-filters" hidden>
      <div class="form-row">
        <label>Data inicial<input id="pcp-filter-date-from" type="date"></label>
        <label>Data final<input id="pcp-filter-date-to" type="date"></label>
        <label>Setor<select id="pcp-filter-sector"><option>Todas as O.S.</option><option>Impressao</option><option>Acabamento</option><option>Plotter</option><option>Sublimacao</option><option>Corte</option><option>Instalacao</option></select></label>
        <label>Responsavel<input id="pcp-filter-owner" placeholder="Todos"></label>
        <label>Status<select id="pcp-filter-status"><option>Todos</option><option>em dia</option><option>atencao</option><option>atrasado</option><option>em producao</option><option>aguardando</option></select></label>
        <label>Cliente<input id="pcp-filter-customer" placeholder="Todos"></label>
        <label>Buscar O.S.<input id="pcp-filter-order" placeholder="OS-0000"></label>
        <label>Prioridade<select id="pcp-filter-priority"><option value="">Todas</option><option>urgente</option><option>alta</option><option>normal</option><option>baixa</option></select></label>
        <label>Tipo de servico<input id="pcp-filter-service" placeholder="Todos"></label>
        <label>Financeiro<select id="pcp-filter-financial"><option value="">Todos</option><option>pendente</option><option>pagamento parcial</option><option>quitada</option><option>fiado</option></select></label>
        <label>Logistica<select id="pcp-filter-logistics"><option value="">Todas</option><option>Retirada no balcão</option><option>Entrega local</option><option>Instalação externa</option><option>A combinar</option></select></label>
        <label>Relatorio<select id="pcp-filter-report"><option value="">Lista operacional</option><option value="late">Atrasadas</option><option value="finished">Finalizadas</option><option value="pending">Pendencias</option><option value="installation">Instalacao / logistica</option></select></label>
        <label>Loja atual<input id="pcp-filter-company" value="${escapeHtml(state.currentCompanyName || "Todas as lojas")}" readonly></label>
      </div>
      <div class="action-bar"><button type="button" class="primary" id="pcp-apply-filters">Aplicar filtros</button><button type="button" id="pcp-clear-filters">Limpar filtros</button><button type="button" id="pcp-close-filters">Fechar</button></div>
      </section>
      <div class="pcp-sector-strip" id="pcp-sector-strip"></div>
      <div class="action-bar pcp-report-actions"><button type="button" class="primary" id="pcp-refresh">Atualizar</button><button type="button" id="pcp-generate-report">Gerar relatório</button><button type="button" id="pcp-print-report">Imprimir produção</button><button type="button" id="pcp-export-pdf">Exportar PDF</button><button type="button" id="pcp-export-csv">Exportar CSV</button></div>
    </div>
  `);
  const detailTable = document.getElementById("production-detail-table")?.closest("table");
  if (detailTable) {
    detailTable.querySelector("thead").innerHTML = `<tr><th>O.S.</th><th>Cliente / loja</th><th>Servico</th><th>Setor atual</th><th>Responsavel</th><th>Prazo</th><th>Status</th><th>Proxima acao</th><th>Acoes</th></tr>`;
  }
  document.querySelectorAll("[data-production-scope]").forEach(button => button.addEventListener("click", () => {
    state.productionScope = button.dataset.productionScope;
    document.querySelectorAll("[data-production-scope]").forEach(item => item.classList.toggle("active", item === button));
    renderPcp();
  }));
  document.querySelectorAll("[data-production-view]").forEach(button => button.addEventListener("click", () => {
    state.productionView = button.dataset.productionView;
    if (state.productionView === "upcoming") state.productionScope = "all";
    document.querySelectorAll("[data-production-view]").forEach(item => item.classList.toggle("active", item === button));
    renderPcp();
  }));
  const filterPanel = document.getElementById("pcp-advanced-filters");
  const setFiltersOpen = open => { if (filterPanel) filterPanel.hidden = !open; };
  const clearPcpFilters = () => {
    ["pcp-filter-date-from", "pcp-filter-date-to", "pcp-filter-owner", "pcp-filter-customer", "pcp-filter-order", "pcp-filter-priority", "pcp-filter-service", "pcp-filter-financial", "pcp-filter-logistics", "pcp-filter-report"].forEach(id => {
      const field = document.getElementById(id);
      if (field) field.value = "";
    });
    ["pcp-filter-sector", "pcp-filter-status"].forEach(id => {
      const field = document.getElementById(id);
      if (field) field.selectedIndex = 0;
    });
    renderPcp();
  };
  document.getElementById("pcp-open-filters")?.addEventListener("click", () => setFiltersOpen(true));
  document.getElementById("pcp-close-filters")?.addEventListener("click", () => setFiltersOpen(false));
  document.getElementById("pcp-apply-filters")?.addEventListener("click", () => { renderPcp(); setFiltersOpen(false); });
  document.getElementById("pcp-clear-filters")?.addEventListener("click", clearPcpFilters);
  document.getElementById("pcp-clear-filters-compact")?.addEventListener("click", clearPcpFilters);
  document.getElementById("pcp-filter-date-from")?.addEventListener("change", renderPcp);
  document.getElementById("pcp-filter-date-to")?.addEventListener("change", renderPcp);
  document.getElementById("pcp-filter-sector")?.addEventListener("change", renderPcp);
  document.getElementById("pcp-filter-owner")?.addEventListener("input", renderPcp);
  document.getElementById("pcp-filter-status")?.addEventListener("change", renderPcp);
  document.getElementById("pcp-filter-customer")?.addEventListener("input", renderPcp);
  document.getElementById("pcp-filter-order")?.addEventListener("input", renderPcp);
  document.getElementById("pcp-filter-priority")?.addEventListener("change", renderPcp);
  document.getElementById("pcp-filter-service")?.addEventListener("input", renderPcp);
  document.getElementById("pcp-filter-financial")?.addEventListener("change", renderPcp);
  document.getElementById("pcp-filter-logistics")?.addEventListener("change", renderPcp);
  document.getElementById("pcp-filter-report")?.addEventListener("change", renderPcp);
  document.getElementById("pcp-refresh")?.addEventListener("click", () => loadAll());
  document.getElementById("pcp-generate-report")?.addEventListener("click", () => openProductionReport(false));
  document.getElementById("pcp-print-report")?.addEventListener("click", () => openProductionReport(true));
  document.getElementById("pcp-export-pdf")?.addEventListener("click", () => openProductionReport(true, true));
  document.getElementById("pcp-export-csv")?.addEventListener("click", exportProductionCsv);
}

function prepareProductionDrawer() {
  if (document.querySelector("main")?.dataset.rootOperationalSplit === "true") {
    document.getElementById("production-detail-drawer")?.remove();
    return;
  }
  if (document.getElementById("production-detail-drawer")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <aside id="production-detail-drawer" class="detail-drawer" aria-hidden="true">
      <div class="detail-drawer-head">
        <div><span>Producao</span><h2 id="drawer-order-title">Detalhes da O.S.</h2></div>
        <button type="button" id="close-production-drawer">Fechar</button>
      </div>
      <div id="production-drawer-content" class="detail-drawer-body"></div>
    </aside>
  `);
  document.getElementById("close-production-drawer")?.addEventListener("click", closeProductionDrawer);
}

function preparePrintSurfaces() {
  if (!document.getElementById("document-preview-modal")) {
    document.body.insertAdjacentHTML("beforeend", `
      <section id="document-preview-modal" class="document-preview-modal" aria-hidden="true">
        <div class="document-preview-toolbar">
          <div>
            <b id="document-preview-title">Visualizar documento</b>
            <span>Confira as informacoes antes de imprimir ou salvar em PDF.</span>
          </div>
          <div class="action-bar">
            <button type="button" id="document-preview-close">Fechar</button>
            <button type="button" id="document-preview-pdf">Salvar em PDF</button>
            <button type="button" class="primary" id="document-preview-print">Imprimir</button>
          </div>
        </div>
        <div id="document-preview-content" class="document-preview-content"></div>
      </section>
    `);
    document.getElementById("document-preview-close")?.addEventListener("click", closeDocumentPreview);
    document.getElementById("document-preview-print")?.addEventListener("click", () => window.print());
    document.getElementById("document-preview-pdf")?.addEventListener("click", () => {
      showToast("Na janela de impressao, escolha Salvar como PDF.", "info");
      window.print();
    });
  }

  const labelButton = document.getElementById("load-label");
  if (labelButton && labelButton.dataset.printReady !== "true") {
    labelButton.dataset.printReady = "true";
    labelButton.textContent = "Visualizar impressao da O.S.";
    labelButton.insertAdjacentHTML("afterend", `
      <button type="button" id="print-label-order">Imprimir O.S.</button>
      <button type="button" id="pdf-label-order">Gerar PDF da O.S.</button>
    `);
    document.getElementById("print-label-order")?.addEventListener("click", () => openOrderPrint(document.getElementById("label-order")?.value, true));
    document.getElementById("pdf-label-order")?.addEventListener("click", () => openOrderPrint(document.getElementById("label-order")?.value, true, true));
  }
}

function closeDocumentPreview() {
  document.getElementById("document-preview-modal")?.classList.remove("open");
  document.getElementById("document-preview-modal")?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("document-print-open");
}

function openDocumentPreview(title, html, autoPrint = false, pdfHint = false) {
  preparePrintSurfaces();
  const modal = document.getElementById("document-preview-modal");
  document.getElementById("document-preview-title").textContent = title;
  document.getElementById("document-preview-content").innerHTML = html;
  modal?.classList.add("open");
  modal?.setAttribute("aria-hidden", "false");
  document.body.classList.add("document-print-open");
  if (pdfHint) showToast("Na janela de impressao, escolha Salvar como PDF.", "info");
  if (autoPrint) window.setTimeout(() => window.print(), 120);
}

function currentCompanyForDocument() {
  return (state.companies || []).find(company => company.id === state.currentCompanyId)
    || (state.companies || []).find(company => company.id !== "all")
    || {};
}

function currentPrintSettings() {
  return {
    primaryColor: "#2563eb",
    secondaryColor: "#f4e8fa",
    textColor: "#202124",
    footerText: "Documento gerado pelo PrintSys ERP.",
    showAddress: true,
    showCnpj: true,
    showPhone: true,
    showSeller: true,
    showEmployeeContact: true,
    showCustomerDocument: true,
    showSignature: true,
    showQrCode: false,
    ...(state.printSettings || {})
  };
}

function buildPrintHeader(documentType = "Documento", reference = "", settings = currentPrintSettings(), company = currentCompanyForDocument()) {
  return `
    <header class="print-document-header refined-print-header" style="--print-primary:${escapeHtml(settings.primaryColor)};--print-secondary:${escapeHtml(settings.secondaryColor)};--print-text:${escapeHtml(settings.textColor)}">
      ${settings.headerImageUrl ? `<div class="print-header-banner"><img src="${escapeHtml(settings.headerImageUrl)}" alt="Cabecalho"></div>` : ""}
      <div class="print-header-main">
        <div class="print-brand refined-print-brand">
          ${settings.logoUrl ? `<img class="print-logo-image" src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(company.tradeName || company.name || "Empresa")}">` : `<div class="print-logo">${escapeHtml((company.tradeName || company.name || "P").slice(0, 1).toUpperCase())}</div>`}
          <div><strong>${escapeHtml(company.tradeName || company.name || "PrintSys")}</strong><span>${escapeHtml(documentType)}</span></div>
        </div>
        <div class="print-document-number refined-print-number"><span>${escapeHtml(documentType)}</span><strong>${escapeHtml(reference || "-")}</strong><small>${new Date().toLocaleString("pt-BR")}</small></div>
      </div>
    </header>
  `;
}

function buildCompanyBlock(company = currentCompanyForDocument(), settings = currentPrintSettings()) {
  const rows = [
    ["Empresa", company.name || company.tradeName || "Empresa"],
    settings.showCnpj !== false ? ["CNPJ", company.cnpj || "Nao informado"] : null,
    settings.showAddress !== false ? ["Endereco", company.address || "Nao informado"] : null,
    settings.showPhone !== false ? ["Contato", [company.phone, company.email].filter(Boolean).join(" | ") || "Nao informado"] : null
  ].filter(Boolean);
  return `<section class="print-info-block refined-print-block"><h3>Dados da empresa</h3>${printDefinitionRows(rows)}</section>`;
}

function buildCustomerBlock(customer = {}, orderOrQuote = {}, settings = currentPrintSettings()) {
  const rows = [
    ["Cliente", orderOrQuote.customerName || customer.name || "Cliente"],
    ["Contato", orderOrQuote.contact || customer.contactPerson || customer.contact || customer.whatsapp || customer.phone || "-"],
    ["Telefone", customer.whatsapp || customer.mobile || customer.phone || "-"],
    settings.showCustomerDocument !== false ? ["CPF/CNPJ", customer.document || "-"] : null,
    ["Endereco", customer.address || orderOrQuote.deliveryAddress || "-"]
  ].filter(Boolean);
  return `<section class="print-info-block refined-print-block"><h3>Dados do cliente</h3>${printDefinitionRows(rows)}</section>`;
}

function buildServiceOrderBlock(order = {}, settings = currentPrintSettings()) {
  const rows = [
    ["Trabalho", order.jobName || order.productName || "Servico grafico"],
    ["Prazo", order.dueDate || "A combinar"],
    settings.showSeller !== false ? ["Vendedor", order.seller || order.answers?.seller || "-"] : null,
    ["Status producao", order.productionStatus || "-"],
    ["Status financeiro", order.financialStatus || "-"],
    ["Logistica", order.logistics || order.answers?.logistics || "A combinar"]
  ].filter(Boolean);
  return `<section class="print-info-block refined-print-block"><h3>Dados da O.S.</h3>${printDefinitionRows(rows)}</section>`;
}

function printDefinitionRows(rows = []) {
  return `<dl>${rows.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? "-")}</dd>`).join("")}</dl>`;
}

function buildItemsTable(items = [], total = 0, options = {}) {
  const rows = items.map((item, index) => {
    const quantity = Number(item.quantity || item.answers?.quantity || 1);
    const subtotal = Number(item.subtotal || item.pricingSnapshot?.finalPrice || item.pricingSnapshot?.suggestedPrice || 0);
    const unit = quantity ? subtotal / quantity : subtotal;
    const measure = item.size || item.measures || (item.answers?.width && item.answers?.height ? `${item.answers.width} x ${item.answers.height}` : "A confirmar");
    const imageUrl = item.productImageUrl || item.productConfigSnapshot?.imageUrl || state.products.find(product => product.id === item.productId)?.imageUrl || "";
    return `<tr>
      <td>${index + 1}</td>
      ${options.showImages ? `<td>${imageUrl ? `<img class="print-product-thumb" src="${escapeHtml(imageUrl)}" alt="">` : `<span class="print-product-placeholder">Produto</span>`}</td>` : ""}
      <td><b>${escapeHtml(item.productName || item.product || item.description || "Servico")}</b><small>${escapeHtml(item.description || item.compositionName || "")}</small></td>
      <td>${escapeHtml(measure)}</td>
      <td>${quantity}</td>
      <td>${money.format(unit)}</td>
      <td>${money.format(subtotal)}</td>
    </tr>`;
  }).join("");
  return `
    <section class="print-items-section refined-print-table">
      <h3>Itens</h3>
      <table>
        <thead><tr><th>Item</th>${options.showImages ? "<th>Imagem</th>" : ""}<th>Descricao</th><th>Medida</th><th>Qtd.</th><th>Unitario</th><th>Total</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="${options.showImages ? 7 : 6}">Nenhum item informado.</td></tr>`}</tbody>
        <tfoot><tr><td colspan="${options.showImages ? 6 : 5}">Total</td><td>${money.format(total)}</td></tr></tfoot>
      </table>
    </section>
  `;
}

function buildObservationsBlock(notes = "", files = []) {
  return `
    <section class="print-info-block refined-print-block print-observations-block">
      <h3>Observacoes e arquivos</h3>
      <p>${escapeHtml(notes || "Sem observacoes registradas.")}</p>
      ${files.length ? `<div class="print-file-list">${files.map((file, index) => `<span>${index + 1}. ${escapeHtml(typeof file === "string" ? file : file.name || "Arquivo")}</span>`).join("")}</div>` : `<small>Nenhum arquivo vinculado para impressao.</small>`}
    </section>
  `;
}

function buildSignatureBlock(settings = currentPrintSettings()) {
  if (settings.showSignature === false) return "";
  return `
    <section class="print-signature-grid">
      <div><span>Assinatura do cliente</span></div>
      <div><span>Responsavel pela empresa</span></div>
    </section>
  `;
}

function buildPrintFooter(settings = currentPrintSettings(), company = currentCompanyForDocument()) {
  return `
    <footer class="print-document-footer refined-print-footer">
      <p>${escapeHtml(settings.footerText || "Documento gerado pelo PrintSys ERP.")}</p>
      <div><span>${escapeHtml(company.tradeName || company.name || "PrintSys")}</span><span>${new Date().toLocaleDateString("pt-BR")}</span></div>
    </footer>
  `;
}

function printServiceOrder(order = {}, options = {}) {
  const settings = currentPrintSettings();
  const company = currentCompanyForDocument();
  const customer = state.customers.find(item => item.id === order.customerId) || {};
  const items = orderItems(order);
  const total = Number(order.total || 0);
  const paid = Number(order.paidAmount || order.receivedAmount || order.downPayment || 0);
  const files = [...(order.files || []), ...(settings.showProjectAttachmentPreview !== false ? (order.projectFiles || []) : []), ...items.flatMap(item => item.files || [])];
  const qrBlock = settings.showQrCode ? `<div class="print-qr-placeholder"><b>QR</b><span>Consulta do cliente</span></div>` : "";
  return `
    <article class="print-document refined-print-document ${options.compact ? "compact-preview" : ""}" style="--print-primary:${escapeHtml(settings.primaryColor)};--print-secondary:${escapeHtml(settings.secondaryColor)};--print-text:${escapeHtml(settings.textColor)}">
      <section class="print-page refined-print-page">
        ${buildPrintHeader("Ordem de Servico", order.id || "-", settings, company)}
        <div class="print-reference refined-print-reference"><span>Referencia do trabalho</span><b>${escapeHtml(order.jobName || order.productName || "Servico grafico")}</b>${qrBlock}</div>
        <div class="print-two-columns refined-print-columns">
          ${buildCompanyBlock(company, settings)}
          ${buildCustomerBlock(customer, order, settings)}
        </div>
        ${buildServiceOrderBlock(order, settings)}
        ${buildItemsTable(items, total, { showImages: settings.showProductImagesOrder !== false })}
        <div class="print-summary-grid refined-print-summary">
          <section class="print-info-block refined-print-block">
            <h3>Pagamento</h3>
            ${printDefinitionRows([["Forma", order.paymentMethod || order.answers?.paymentMethod || "A combinar"], ["Recebido", money.format(paid)], ["Saldo", money.format(Math.max(total - paid, 0))]])}
          </section>
          <section class="print-total-block refined-print-total"><span>Valor total</span><strong>${money.format(total)}</strong><small>${items.length} item(ns)</small></section>
        </div>
        ${buildObservationsBlock(order.observation || order.answers?.clientNote || order.productionNotes || "", files)}
        ${buildSignatureBlock(settings)}
        ${buildPrintFooter(settings, company)}
      </section>
    </article>
  `;
}

function printQuote(quote = {}) {
  const settings = currentPrintSettings();
  const company = currentCompanyForDocument();
  const customer = state.customers.find(item => item.id === quote.customerId) || {};
  const items = quote.itemSnapshots?.length ? quote.itemSnapshots : quote.items || [];
  const total = Number(quote.approvedPrice || quote.pricing?.finalPrice || quote.pricing?.suggestedPrice || 0);
  const files = [...(quote.files || []), ...(settings.showProjectAttachmentPreview !== false ? (quote.projectFiles || []) : [])];
  return `
    <article class="print-document refined-print-document" style="--print-primary:${escapeHtml(settings.primaryColor)};--print-secondary:${escapeHtml(settings.secondaryColor)};--print-text:${escapeHtml(settings.textColor)}">
      <section class="print-page refined-print-page">
        ${buildPrintHeader("Orcamento", quote.quoteNumber || quote.id || "-", settings, company)}
        <div class="print-two-columns refined-print-columns">${buildCompanyBlock(company, settings)}${buildCustomerBlock(customer, quote, settings)}</div>
        ${buildItemsTable(items, total, { showImages: settings.showProductImagesQuote !== false })}
        ${buildObservationsBlock(quote.answers?.clientNote || quote.observation || "", files)}
        ${buildSignatureBlock(settings)}
        ${buildPrintFooter(settings, company)}
      </section>
    </article>
  `;
}

function printReport({ title = "Relatorio", subtitle = "", rows = [], headers = [], rowRenderer = null } = {}) {
  const settings = currentPrintSettings();
  const company = currentCompanyForDocument();
  const body = rowRenderer ? rows.map(rowRenderer).join("") : rows.map(row => `<tr>${headers.map(header => `<td>${escapeHtml(row[header] ?? row[String(header).toLowerCase()] ?? "")}</td>`).join("")}</tr>`).join("");
  return `
    <article class="print-document refined-print-document report-print-document" style="--print-primary:${escapeHtml(settings.primaryColor)};--print-secondary:${escapeHtml(settings.secondaryColor)};--print-text:${escapeHtml(settings.textColor)}">
      <section class="print-page refined-print-page">
        ${buildPrintHeader(title, subtitle || state.currentCompanyName || company.tradeName || company.name || "Loja atual", settings, company)}
        <section class="print-items-section refined-print-table">
          <table><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length || 1}">Nenhum registro encontrado.</td></tr>`}</tbody></table>
        </section>
        ${buildPrintFooter(settings, company)}
      </section>
    </article>
  `;
}

function orderPrintDocument(order) {
  return printServiceOrder(order);
  const company = currentCompanyForDocument();
  const customer = state.customers.find(item => item.id === order.customerId) || {};
  const items = orderItems(order);
  const total = Number(order.total || 0);
  const paid = Number(order.paidAmount || order.receivedAmount || order.downPayment || 0);
  const files = [...(order.files || []), ...items.flatMap(item => item.files || [])];
  const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString("pt-BR") : new Date().toLocaleString("pt-BR");
  const itemRows = items.map((item, index) => {
    const quantity = Number(item.quantity || 1);
    const subtotal = Number(item.subtotal || total || 0);
    const unit = quantity ? subtotal / quantity : subtotal;
    return `
      <tr>
        <td>${index + 1}</td>
        <td><span class="print-image-marker">${(item.files || []).length ? "Imagem vinculada" : "Sem imagem"}</span></td>
        <td><b>${escapeHtml(item.productName || item.product || order.jobName || "Servico grafico")}</b><small>${escapeHtml(item.description || order.observation || "")}</small></td>
        <td>${escapeHtml(item.compositionName || item.composition || "Composicao tecnica")}</td>
        <td>${escapeHtml(item.variation || item.material || materialSummaryForOrder(order, [item]) || "-")}</td>
        <td>${escapeHtml(item.size || item.measures || "A confirmar")}</td>
        <td>${quantity}</td>
        <td>${money.format(unit)}</td>
        <td>${money.format(subtotal)}</td>
      </tr>
    `;
  }).join("");
  const attachmentPage = files.length ? `
    <section class="print-page print-attachment-page">
      <div class="print-section-heading"><span>Anexos</span><b>Arquivos vinculados ao trabalho</b></div>
      <div class="print-attachment-grid">
        ${files.map((file, index) => `<div><span>${index + 1}</span><b>${escapeHtml(file)}</b><small>Arquivo vinculado a O.S. ${escapeHtml(order.id)}</small></div>`).join("")}
      </div>
    </section>
  ` : "";
  return `
    <article class="print-document order-print-document">
      <section class="print-page">
        <header class="print-document-header">
          <div class="print-brand">
            <div class="print-logo">P</div>
            <div><strong>${escapeHtml(company.tradeName || company.name || "PrintSys")}</strong><span>Ordem de Servico</span></div>
          </div>
          <div class="print-company-data">
            <b>${escapeHtml(company.name || company.tradeName || "Empresa")}</b>
            <span>CNPJ: ${escapeHtml(company.cnpj || "Nao informado")}</span>
            <span>${escapeHtml(company.address || "Endereco nao informado")}</span>
            <span>${escapeHtml(company.phone || "Telefone nao informado")} | ${escapeHtml(company.email || "E-mail nao informado")}</span>
          </div>
          <div class="print-document-number"><span>O.S.</span><strong>${escapeHtml(order.id)}</strong><small>${createdAt}</small></div>
        </header>

        <div class="print-reference"><span>Referencia do trabalho</span><b>${escapeHtml(order.jobName || order.productName || "Servico grafico")}</b></div>

        <div class="print-two-columns">
          <section class="print-info-block">
            <h3>Dados do cliente</h3>
            <dl>
              <dt>Cliente</dt><dd>${escapeHtml(order.customerName || customer.name || "Cliente")}</dd>
              <dt>Contato</dt><dd>${escapeHtml(order.contact || customer.contact || customer.phone || "-")}</dd>
              <dt>Telefone</dt><dd>${escapeHtml(customer.phone || customer.mobile || "-")}</dd>
              <dt>CPF/CNPJ</dt><dd>${escapeHtml(customer.document || "-")}</dd>
              <dt>Endereco</dt><dd>${escapeHtml(customer.address || order.deliveryAddress || "-")}</dd>
            </dl>
          </section>
          <section class="print-info-block">
            <h3>Dados comerciais</h3>
            <dl>
              <dt>Entrega</dt><dd>${escapeHtml(order.dueDate || "A combinar")}</dd>
              <dt>Aprovacao</dt><dd>${escapeHtml(order.approvalStatus || order.approvedAt || "Aguardando")}</dd>
              <dt>Vendedor</dt><dd>${escapeHtml(order.seller || "Nao informado")}</dd>
              <dt>Logistica</dt><dd>${escapeHtml(order.logistics || order.answers?.logistics || "A combinar")}</dd>
              <dt>Setor atual</dt><dd>${escapeHtml(order.currentSector || order.productionStatus || "Aguardando")}</dd>
            </dl>
          </section>
        </div>

        <section class="print-items-section">
          <h3>Itens da ordem de servico</h3>
          <table>
            <thead><tr><th>Item</th><th>Imagem</th><th>Descricao</th><th>Modelo</th><th>Variacao</th><th>Medidas</th><th>Qtd.</th><th>Unitario</th><th>Subtotal</th></tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
        </section>

        <div class="print-summary-grid">
          <section class="print-info-block">
            <h3>Pagamento e observacoes</h3>
            <dl>
              <dt>Forma</dt><dd>${escapeHtml(order.paymentMethod || order.answers?.paymentMethod || "A combinar")}</dd>
              <dt>Condicao</dt><dd>${escapeHtml(order.paymentTerms || order.answers?.paymentTerms || "-")}</dd>
              <dt>Recebido</dt><dd>${money.format(paid)}</dd>
              <dt>Saldo</dt><dd>${money.format(Math.max(total - paid, 0))}</dd>
              <dt>Observacoes</dt><dd>${escapeHtml(order.observation || order.answers?.clientNote || "Sem observacoes comerciais.")}</dd>
            </dl>
          </section>
          <section class="print-total-block">
            <span>Total de itens</span><b>${items.length}</b>
            <span>Valor total</span><strong>${money.format(total)}</strong>
          </section>
        </div>

        <footer class="print-document-footer">
          <p>A producao sera autorizada conforme a condicao comercial aprovada e o pagamento ou sinal registrado.</p>
          <div><span>Autorizacao do cliente</span><span>Responsavel pela O.S.</span></div>
        </footer>
      </section>
      ${attachmentPage}
    </article>
  `;
}

function openOrderPrint(orderId, autoPrint = false, pdfHint = false) {
  const order = (state.orders || []).find(item => item.id === orderId) || (state.orders || [])[0];
  if (!order) {
    showToast("Selecione uma O.S. para visualizar a impressao.", "warning");
    return;
  }
  openDocumentPreview(`Ordem de Servico ${order.id}`, orderPrintDocument(order), autoPrint, pdfHint);
}

function productionReportDocument(rows) {
  const company = currentCompanyForDocument();
  const sector = document.getElementById("pcp-filter-sector")?.value || "Todas as O.S.";
  const owner = document.getElementById("pcp-filter-owner")?.value || "Todos os responsaveis";
  const status = document.getElementById("pcp-filter-status")?.value || "Todos";
  const tableRows = rows.map(order => `
    <tr>
      <td><b>${escapeHtml(order.id)}</b></td>
      <td>${escapeHtml(order.customerName || customerName(order.customerId))}</td>
      <td>${escapeHtml(order.jobName || order.productName || "-")}</td>
      <td>${escapeHtml(order.logistics || order.answers?.logistics || "A combinar")}</td>
      <td>${escapeHtml(order.approvalStatus || order.approvedAt || "-")}</td>
      <td>${escapeHtml(order.seller || "-")}</td>
      <td>${escapeHtml(order.dueDate || "-")}</td>
      <td>${escapeHtml(order.productionStatus || "-")}</td>
      <td>${escapeHtml(order.currentSector || order.productionStatus || "-")}</td>
      <td>${escapeHtml(order.responsible || order.currentResponsible || order.events?.[0]?.startedBy || "-")}</td>
    </tr>
  `).join("");
  return `
    <article class="print-document production-report-document">
      <section class="print-page">
        <header class="report-document-header">
          <div><span>PrintSys | ${escapeHtml(company.tradeName || company.name || "Empresa")}</span><h1>PRODUCAO ${escapeHtml(sector.toUpperCase())} - ${escapeHtml(owner.toUpperCase())}</h1></div>
          <div><b>${rows.length} O.S.</b><small>Gerado em ${new Date().toLocaleString("pt-BR")}</small></div>
        </header>
        <div class="report-filter-summary"><span>Status: ${escapeHtml(status)}</span><span>Loja: ${escapeHtml(state.currentCompanyName || company.tradeName || company.name || "Atual")}</span><span>Somente dados filtrados</span></div>
        <table class="production-report-table">
          <thead><tr><th>O.S.</th><th>Cliente</th><th>Trabalho</th><th>Logistica</th><th>Aprovacao</th><th>Vendedor</th><th>Entrega</th><th>Status</th><th>Setor</th><th>Responsavel</th></tr></thead>
          <tbody>${tableRows || `<tr><td colspan="10">Nenhuma O.S. encontrada para os filtros selecionados.</td></tr>`}</tbody>
        </table>
        <footer class="report-document-footer"><b>Total: ${rows.length} O.S.</b><span>Relatorio operacional por loja, setor e responsavel.</span></footer>
      </section>
    </article>
  `;
}

function openProductionReport(autoPrint = false, pdfHint = false) {
  const rows = state.filteredProductionOrders || state.orders || [];
  openDocumentPreview("Relatorio de producao", productionReportDocument(rows), autoPrint, pdfHint);
}

function exportCsvFile(filename, headers, rows) {
  const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(row => row.map(quote).join(";")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function exportProductionCsv() {
  const query = productionQueryParams();
  const headers = {};
  if (state.currentCompanyId) headers["x-company-id"] = state.currentCompanyId;
  const response = await fetch(`/api/production/reports/csv?${query.toString()}`, { headers });
  if (!response.ok) throw new Error((await response.json()).error || "Nao foi possivel exportar o relatorio");
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `relatorio-producao-${state.productionScope || "geral"}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Relatorio real de producao exportado em CSV.", "success");
}

function prepareReportsWorkspace() {
  const reports = document.getElementById("bi");
  if (!reports || document.getElementById("operational-reports-workspace")) return;
  const tabs = reports.querySelector(":scope > .module-tabs");
  tabs?.insertAdjacentHTML("afterend", `
    <section id="operational-reports-workspace" class="panel operational-reports-workspace">
      <div class="section-heading">
        <div><span>Relatorios operacionais</span><h2>Encontre desvios e tome acao</h2><p>Atalhos conectados aos dados atuais da loja selecionada.</p></div>
      </div>
      <div class="report-shortcuts">
        <button type="button" data-report-shortcut="production">Producao por setor<small>Filtre, imprima ou exporte a lista operacional.</small></button>
        <button type="button" data-report-shortcut="late">O.S. atrasadas<small>Veja ordens com prazo vencido.</small></button>
        <button type="button" data-report-shortcut="files">O.S. sem arquivo<small>Localize trabalhos que ainda precisam de anexos.</small></button>
        <button type="button" data-report-shortcut="finance">Faturamento e DRE<small>Acompanhe recebimentos, despesas e resultado.</small></button>
        <button type="button" data-report-shortcut="stock">Estoque baixo<small>Confira materiais que precisam de reposicao.</small></button>
      </div>
    </section>
  `);
  document.getElementById("operational-reports-workspace")?.addEventListener("click", event => {
    const shortcut = event.target.closest("[data-report-shortcut]")?.dataset.reportShortcut;
    if (!shortcut) return;
    if (shortcut === "production") view("pcp");
    if (shortcut === "late") {
      view("pcp");
      const status = document.getElementById("pcp-filter-status");
      if (status) status.value = "atrasado";
      renderPcp();
    }
    if (shortcut === "files") {
      view("orders");
      const filter = document.getElementById("order-filter");
      if (filter) filter.value = "sem arquivo";
      renderOrders();
    }
    if (shortcut === "finance") view("finance");
    if (shortcut === "stock") view("products");
  });
}

function openProductionDrawer(orderId) {
  const order = (state.orders || []).find(item => item.id === orderId) || state.orders?.[0];
  if (!order) return alert("Nenhuma O.S. encontrada para detalhar.");
  const drawer = document.getElementById("production-detail-drawer");
  const items = orderItems(order);
  const files = [...(order.files || []), ...items.flatMap(item => item.files || [])];
  const currentSector = order.currentSector || order.productionStatus || "Aguardando";
  const responsible = order.responsible || order.currentResponsible || order.events?.[0]?.startedBy || "Definir responsavel";
  const product = state.products.find(item => item.id === order.productId)?.name || order.jobName || order.productName || "Servico grafico";
  document.getElementById("drawer-order-title").textContent = `${order.id} - ${order.customerName || "Cliente"}`;
  document.getElementById("production-drawer-content").innerHTML = `
    <div class="drawer-os-cover">
      <span>Ordem de servico</span>
      <strong>${escapeHtml(order.id)}</strong>
      <p>${escapeHtml(product)}</p>
      <small>${escapeHtml(order.customerName || customerName(order.customerId))}</small>
    </div>
    <div class="drawer-kpi-grid">
      <div><span>Setor atual</span><b>${escapeHtml(currentSector)}</b></div>
      <div><span>Responsavel</span><b>${escapeHtml(responsible)}</b></div>
      <div><span>Prazo</span><b>${escapeHtml(order.dueDate || "A combinar")}</b></div>
      <div><span>Financeiro</span><b>${escapeHtml(order.financialStatus || "Aguardando")}</b></div>
    </div>
    <div class="detail-card next-action-card"><b>Proxima acao recomendada</b><strong>${escapeHtml(productionNextAction(order))}</strong><small>Use as acoes abaixo para movimentar a O.S. sem sair da Producao.</small></div>
    <section class="drawer-section">
      <h3>Arquivos e anexos</h3>
      ${drawerList(files, file => `${escapeHtml(file)}`)}
    </section>
    <section class="drawer-section">
      <h3>Itens do trabalho</h3>
      ${drawerList(items, item => `${escapeHtml(item.productName || item.product || product)} - ${escapeHtml(item.size || item.measures || "medidas a confirmar")} - Qtd. ${item.quantity || 1}`)}
    </section>
    <section class="drawer-section">
      <h3>Historico de producao</h3>
      ${drawerList(order.timeline || order.events || [], item => `${escapeHtml(item.createdAt || item.date || "-")} - ${escapeHtml(productionEventLabel(item.action || item.type) || item.description || item.status || "Movimentacao registrada")}`)}
    </section>
    <section class="drawer-section">
      <h3>Observacoes</h3>
      <p>${escapeHtml(order.observation || order.notes || order.answers?.productionNote || "Sem observacoes cadastradas.")}</p>
    </section>
    <div class="detail-actions">
      <button type="button" class="primary" data-production-action="iniciar" data-order="${order.id}">Iniciar</button>
      <button type="button" data-production-action="pausar" data-order="${order.id}">Pausar</button>
      <button type="button" data-production-action="finalizar" data-order="${order.id}">Finalizar etapa</button>
      <button type="button" data-action="move-next-sector" data-order="${order.id}">Enviar para proximo setor</button>
      <button type="button" data-action="attach-order" data-order="${order.id}">Anexar arquivo</button>
      <button type="button" data-production-action="observar" data-order="${order.id}">Observacao</button>
      <button type="button" data-action="open-order" data-order="${order.id}">Abrir O.S.</button>
      <button type="button" data-action="print-order" data-order="${order.id}">Imprimir O.S.</button>
    </div>
  `;
  drawer?.classList.add("open");
  drawer?.setAttribute("aria-hidden", "false");
}

function productionFileEntries(order, items = orderItems(order)) {
  const base = [
    ...(order.files || []).map(file => typeof file === "string" ? { name: file, type: "Arquivo da O.S.", origin: "O.S.", createdAt: order.updatedAt || order.createdAt || "" } : file),
    ...(order.productionFiles || []).map(file => typeof file === "string" ? { name: file, type: "Arquivo de producao", origin: "Producao", createdAt: order.updatedAt || order.createdAt || "" } : file),
    ...items.flatMap(item => (item.files || []).map(file => typeof file === "string" ? { name: file, type: "Arquivo do item", origin: item.productName || item.product || "Item", createdAt: order.updatedAt || order.createdAt || "" } : file))
  ];
  const seen = new Set();
  return base.filter(file => {
    const key = `${file.id || ""}-${file.name || file.fileName || file.url || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return file.name || file.fileName || file.url || file.id;
  });
}

function productionFileName(file) {
  if (typeof file === "string") return file;
  return file.name || file.fileName || file.url || file.id || "Arquivo";
}

function productionActionButtons(order) {
  const status = normalizeUxText(order.productionStatus || "");
  const files = productionFileEntries(order);
  const closed = status.match(/entreg|cancel|liberada/);
  const waitingHomologation = status.includes("homologacao") || status.includes("finalizada");
  const homologated = status.includes("homologada");
  const running = status.includes("produc");
  const paused = status.includes("paus");
  const buttons = [];
  if (!closed && !waitingHomologation && !homologated) {
    if (paused) buttons.push(`<button type="button" class="primary" data-production-action="retomar" data-order="${order.id}">Retomar</button>`);
    else if (running) buttons.push(`<button type="button" class="primary" data-production-action="finalizar" data-order="${order.id}">Finalizar etapa</button><button type="button" data-production-action="pausar" data-order="${order.id}">Pausar</button>`);
    else buttons.push(`<button type="button" class="primary" data-production-action="iniciar" data-order="${order.id}">Iniciar producao</button>`);
    buttons.push(`<button type="button" data-action="move-next-sector" data-order="${order.id}">Proximo setor</button>`);
  }
  if (waitingHomologation) {
    buttons.push(`<button type="button" class="primary" data-production-action="homologar" data-order="${order.id}">Homologar</button>`);
    buttons.push(`<button type="button" class="danger-action" data-production-action="reprovar" data-order="${order.id}">Reprovar / retrabalho</button>`);
  }
  if (homologated) buttons.push(`<button type="button" class="primary" data-production-action="liberar" data-order="${order.id}">Liberar entrega</button>`);
  buttons.push(`<button type="button" data-production-action="adicionar-observacao" data-order="${order.id}">Adicionar observacao</button>`);
  buttons.push(`<button type="button" data-production-action="registrar-duvida" data-order="${order.id}">Registrar duvida</button>`);
  buttons.push(`<button type="button" data-production-action="ver-arquivos" data-order="${order.id}">Ver arquivos</button>`);
  if (files.length) buttons.push(`<button type="button" data-production-action="download-file" data-order="${order.id}">Baixar arquivo</button>`);
  buttons.push(`<button type="button" data-action="open-order" data-order="${order.id}">Abrir O.S.</button>`);
  buttons.push(`<button type="button" data-action="print-order" data-order="${order.id}">Imprimir O.S.</button>`);
  return buttons.join("");
}

function renderProductionOrderDetailPanel(orderId = state.selectedProductionOrderId || state.activeOrderId) {
  const target = document.getElementById("production-order-detail-panel");
  if (!target) return;
  const rows = state.filteredProductionOrders || state.productionQuery?.rows || state.orders || [];
  const order = rows.find(item => item.id === orderId) || state.orders.find(item => item.id === orderId) || rows[0];
  if (!order) {
    target.innerHTML = `<div class="premium-empty-state"><b>Nenhuma O.S. selecionada.</b><span>Selecione uma linha da producao para visualizar detalhes, arquivos, observacoes e historico.</span></div>`;
    return;
  }
  state.activeOrderId = order.id;
  const customer = state.customers.find(item => item.id === order.customerId) || {};
  const items = orderItems(order);
  const files = productionFileEntries(order, items);
  const events = order.events || order.timeline || [];
  const problems = order.problems || [];
  const currentSector = order.currentSectorName || order.currentSector || order.productionStatus || "Aguardando";
  const materialSummary = materialSummaryForOrder(order, items);
  const finishes = items.map(item => item.finish || item.acabamento || item.variation || item.compositionName).filter(Boolean).join(", ") || order.answers?.finish || "-";
  const measures = items.map(item => item.size || item.measures || [item.answers?.width, item.answers?.height].filter(Boolean).join(" x ")).filter(Boolean).join(" | ") || "A confirmar";
  const quantity = items.reduce((sum, item) => sum + Number(item.quantity || item.answers?.quantity || 1), 0) || 1;
  const commercialNote = order.observation || order.answers?.clientNote || "Sem observacao comercial.";
  const technicalNote = order.technicalDescription || order.answers?.productionNote || items.map(item => item.description).filter(Boolean).join(" | ") || "Sem detalhe tecnico adicional.";
  const internalNote = order.internalProductionWarnings || "Sem observacao interna.";
  const productionNote = order.productionNotes || "Sem observacao da producao.";
  const installationNote = order.installationNotes || "Sem observacao de instalacao.";
  const doubts = events.filter(event => /duvida/i.test(`${event.observation || ""} ${event.action || ""}`));
  target.innerHTML = `
    <div class="production-detail-header">
      <div>
        <span>O.S. em producao</span>
        <h2>${escapeHtml(order.id)} - ${escapeHtml(order.customerName || customer.name || "Cliente")}</h2>
        <p>${escapeHtml(order.productName || order.jobName || "Servico grafico")}</p>
      </div>
      <div class="production-detail-status">
        <span class="status-pill production">${escapeHtml(order.productionStatus || "Aguardando")}</span>
        <b>${escapeHtml(order.priority || "normal")}</b>
      </div>
    </div>
    <div class="production-detail-actions">${productionActionButtons(order)}</div>
    <div class="production-detail-grid">
      <article><span>Cliente</span><b>${escapeHtml(order.customerName || customer.name || "-")}</b><small>Telefone: ${escapeHtml(customer.phone || customer.mobile || order.phone || "-")}</small><small>Loja: ${escapeHtml(order.companyName || state.currentCompanyName || "-")}</small></article>
      <article><span>Prazo</span><b>${escapeHtml(order.dueDate || "A combinar")}</b><small>${escapeHtml(order.timeRemainingLabel || "")}</small><small>Status financeiro: ${escapeHtml(order.financialStatus || "-")}</small></article>
      <article><span>Setor atual</span><b>${escapeHtml(currentSector)}</b><small>Responsavel: ${escapeHtml(order.currentResponsible || order.responsible || "Definir")}</small><small>Proximo: ${escapeHtml(order.nextSectorName || nextOrderSector(order))}</small></article>
      <article><span>Trabalho</span><b>${escapeHtml(order.productName || order.jobName || "-")}</b><small>Medidas: ${escapeHtml(measures)}</small><small>Quantidade: ${quantity}</small></article>
    </div>
    <div class="production-detail-columns">
      <section>
        <h3>Detalhes tecnicos</h3>
        <dl class="production-detail-list">
          <dt>Descricao tecnica</dt><dd>${escapeHtml(technicalNote)}</dd>
          <dt>Materiais</dt><dd>${escapeHtml(materialSummary)}</dd>
          <dt>Acabamentos</dt><dd>${escapeHtml(finishes)}</dd>
          <dt>Checklist producao</dt><dd>${order.checklistCompleted ? "Concluido" : order.checklistRequired ? "Pendente" : "Nao obrigatorio"}</dd>
          <dt>Checklist instalacao</dt><dd>${order.installationChecklist?.completed ? "Concluido" : order.needsInstallation ? "Pendente" : "Nao se aplica"}</dd>
        </dl>
      </section>
      <section id="production-detail-files">
        <h3>Arquivos / anexos</h3>
        ${files.length ? `<div class="production-file-list">${files.map(file => `<div><b>${escapeHtml(productionFileName(file))}</b><span>${escapeHtml(file.type || "Arquivo")}</span><small>${escapeHtml(file.createdAt ? new Date(file.createdAt).toLocaleString("pt-BR") : "Data nao informada")} | Origem: ${escapeHtml(file.origin || file.uploadedBy || "O.S.")}</small><button type="button" data-production-action="download-file" data-order="${order.id}" data-file="${escapeHtml(file.id || productionFileName(file))}">Baixar</button></div>`).join("")}</div>` : `<div class="premium-empty-state compact"><b>Nenhum arquivo anexado.</b><span>Anexe arte, PDF ou arquivo de producao antes de finalizar setores obrigatorios.</span><button type="button" data-action="attach-order" data-order="${order.id}">Anexar arquivo</button></div>`}
      </section>
    </div>
    <div class="production-notes-grid">
      <article><span>Comercial / vendedor</span><p>${escapeHtml(commercialNote)}</p></article>
      <article><span>Tecnica</span><p>${escapeHtml(technicalNote)}</p></article>
      <article><span>Interna</span><p>${escapeHtml(internalNote)}</p></article>
      <article><span>Producao</span><p>${escapeHtml(productionNote)}</p></article>
      <article><span>Instalacao</span><p>${escapeHtml(installationNote)}</p></article>
      <article><span>Duvidas da producao</span><p>${doubts.length ? doubts.map(item => escapeHtml(item.observation || "Duvida registrada")).join("<br>") : "Nenhuma duvida registrada."}</p></article>
    </div>
    <div class="production-detail-columns">
      <section>
        <h3>Itens da O.S.</h3>
        <div class="focused-table-scroll"><table class="focused-data-table"><thead><tr><th>Item</th><th>Descricao</th><th>Medida</th><th>Qtd</th><th>Status</th></tr></thead><tbody>${items.map((item, index) => `<tr><td>${index + 1}</td><td><b>${escapeHtml(item.productName || item.product || order.jobName || "-")}</b><small>${escapeHtml(item.description || "")}</small></td><td>${escapeHtml(item.size || item.measures || measures)}</td><td>${Number(item.quantity || item.answers?.quantity || 1)}</td><td><span class="status-pill production">${escapeHtml(item.status || order.productionStatus || "-")}</span></td></tr>`).join("")}</tbody></table></div>
      </section>
      <section>
        <h3>Historico da O.S.</h3>
        <div class="production-history-list">${events.length ? events.slice(0, 12).map(event => `<div><b>${escapeHtml(productionEventLabel(event.action || event.type))}</b><span>${escapeHtml(event.createdAt ? new Date(event.createdAt).toLocaleString("pt-BR") : event.date || "-")}</span><p>${escapeHtml(event.observation || event.pauseReason || event.problem || "Movimentacao registrada.")}</p></div>`).join("") : "<p>Sem historico produtivo registrado.</p>"}</div>
        ${problems.length ? `<h3>Problemas / retrabalhos</h3><div class="production-history-list">${problems.map(problem => `<div><b>${escapeHtml(problem.type || "Problema")}</b><span>${escapeHtml(problem.createdAt ? new Date(problem.createdAt).toLocaleString("pt-BR") : "-")}</span><p>${escapeHtml(problem.description || "Sem descricao.")}</p></div>`).join("")}</div>` : ""}
      </section>
    </div>
  `;
}

function productionNextAction(order) {
  const status = normalizeUxText(order?.productionStatus || "");
  if (status.includes("aguard")) return "Receber e iniciar a producao";
  if (status.includes("homologacao")) return "Homologar ou reprovar para retrabalho";
  if (status.includes("homologada")) return "Liberar para entrega";
  if (status.includes("retrabalho")) return "Corrigir e iniciar novamente";
  if (status.includes("paus")) return "Retomar ou registrar motivo";
  if (status.includes("problema")) return "Resolver problema antes de avancar";
  if (status.includes("produ")) return "Finalizar etapa ou enviar ao proximo setor";
  if (status.includes("liberada")) return "Separar entrega ou instalacao";
  if (status.includes("cancel")) return "Consultar motivo e historico do cancelamento";
  if (status.includes("final") || status.includes("entreg")) return "Conferir historico e arquivos";
  return "Abrir detalhes e definir responsavel";
}

function productionCardStatus(order) {
  const status = productionVisualStatus(order);
  if (status === "atrasado" || status === "atencao") return "critical";
  if (status === "aguardando" || status === "em_producao") return "warning";
  return "ok";
}

function financialCardStatus(order) {
  const status = normalizeUxText(order?.financialStatus || "");
  if (status.includes("quit") || status.includes("fatur")) return "ok";
  if (status.includes("parcial") || status.includes("sinal") || status.includes("fiado")) return "warning";
  return "critical";
}

function closeProductionDrawer() {
  const drawer = document.getElementById("production-detail-drawer");
  drawer?.classList.remove("open");
  drawer?.setAttribute("aria-hidden", "true");
}

function drawerList(rows, mapper) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return `<div class="empty-state">Nenhum registro encontrado.</div>`;
  return `<div class="drawer-list">${list.slice(0, 8).map(item => `<div>${mapper(item)}</div>`).join("")}</div>`;
}

function prepareAccessReleases() {
  const control = document.getElementById("control");
  if (!control || control.dataset.releasesReady) return;
  control.dataset.releasesReady = "true";
  const permissionsPanel = document.getElementById("permissions-form")?.closest(".panel");
  permissionsPanel?.classList.add("access-release-panel");
  permissionsPanel?.insertAdjacentHTML("beforebegin", `<div class="panel access-profile-summary"><h2>Sistema &gt; Liberacoes de Acesso</h2><div id="access-profile-cards" class="mini-grid"></div></div>`);
}

function prepareTopBar() {
  const header = document.querySelector("header");
  if (!header) return;
  const menuToggle = document.getElementById("menu-toggle");
  if (menuToggle) {
    menuToggle.textContent = "☰";
    menuToggle.title = "Recolher ou expandir menu";
  }
  const sidebarUser = document.querySelector(".user b");
  if (sidebarUser) sidebarUser.textContent = state.user?.name || "Usuario";
  const sidebarAvatar = document.querySelector(".user .avatar");
  if (sidebarAvatar) sidebarAvatar.textContent = (state.user?.name || "Usuario").split(" ").slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const company = header.querySelector("div");
  if (company && !company.classList.contains("top-company")) {
    company.classList.add("top-company");
    company.innerHTML = `<b>PrintSys</b><span id="company-scope-label">ERP para grafica</span>`;
  }
  if (!header.querySelector(".top-quick-actions")) {
    const status = header.querySelector(".top-status");
    status?.insertAdjacentHTML("beforebegin", `
      <div class="company-switcher-wrap">
        <label for="company-switcher">Loja:</label>
        <select id="company-switcher"></select>
      </div>
      <div class="top-quick-actions">
        <button type="button" data-view="quote">Orcamento</button>
        <button type="button" data-view="cash">Receber</button>
        <button type="button" data-view="pcp">PCP</button>
      </div>
      <div class="top-user">
        <span class="top-notification" title="Notificacoes">${state.alerts?.length || 0}</span>
        <b>${state.user?.name || "Usuario"}</b>
        <button type="button" id="logout-button">Sair</button>
      </div>
    `);
    header.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => view(button.dataset.view)));
    document.getElementById("logout-button")?.addEventListener("click", logout);
    document.getElementById("company-switcher")?.addEventListener("change", changeCompanyContext);
  }
  renderCompanySwitcher();
  const notification = header.querySelector(".top-notification");
  if (notification) notification.textContent = state.alerts?.length || 0;
  const user = header.querySelector(".top-user b");
  if (user) user.textContent = state.user?.name || "Usuario";
}

function renderCompanySwitcher() {
  const select = document.getElementById("company-switcher");
  const label = document.getElementById("company-scope-label");
  const companies = state.companies || [];
  if (label) label.textContent = state.currentCompanyName ? `${state.currentCompanyName}` : "ERP para grafica";
  if (!select) return;
  select.innerHTML = companies.map(company => `<option value="${company.id}">${company.id === "all" || company.consolidated ? "Todas" : company.tradeName || company.name}</option>`).join("");
  select.value = state.currentCompanyId || companies[0]?.id || "";
  select.disabled = companies.length <= 1;
  select.title = companies.length > 1 ? "Trocar loja visualizada" : "Usuario possui acesso a uma loja";
}

async function changeCompanyContext(event) {
  const companyId = event.target.value;
  if (!companyId || companyId === state.currentCompanyId) return;
  try {
    const context = await api("/api/company-context", { method: "POST", body: { companyId } });
    state.currentCompanyId = context.currentCompanyId || companyId;
    state.currentCompanyName = context.currentCompanyName || "";
    state.companies = context.companies || state.companies;
    state.companySettings = context.settings || state.companySettings;
    localStorage.setItem("printsys_company_id", state.currentCompanyId);
    await loadAll();
    showToast(`Voce esta visualizando ${state.currentCompanyName || "a loja selecionada"}.`, "success");
    view(document.querySelector(".view.active")?.id || "dashboard");
  } catch (error) {
    showToast(error.message || "Nao foi possivel trocar a loja.", "error");
    renderCompanySwitcher();
  }
}

function prepareTopBar() {
  const header = document.querySelector("header");
  if (!header) return;
  if (header.dataset.premiumTopbarReady !== "true") {
    header.dataset.premiumTopbarReady = "true";
    header.className = "premium-topbar";
    header.innerHTML = `
      <button id="menu-toggle" class="topbar-menu-toggle" title="Recolher menu">☰</button>
      <label class="topbar-search" aria-label="Busca global">
        <span>Buscar</span>
        <input id="search" placeholder="Cliente, O.S., orçamento, produto">
      </label>
      <label class="company-switcher-wrap topbar-store">
        <span>Loja atual</span>
        <select id="company-switcher"></select>
      </label>
      <div class="top-status" aria-label="Indicadores de O.S.">
        <span id="top-sales" title="O.S. totais">0</span>
        <span id="top-quotes" title="O.S. para hoje">0</span>
        <span id="top-alerts" title="O.S. atrasadas">0</span>
      </div>
      <div class="top-user">
        <b>${state.user?.name || "Usuario"}</b>
        <button type="button" id="logout-button">Sair</button>
      </div>
    `;
    document.getElementById("menu-toggle")?.addEventListener("click", () => {
      document.querySelector(".app")?.classList.toggle("sidebar-collapsed");
    });
    document.getElementById("logout-button")?.addEventListener("click", logout);
    document.getElementById("company-switcher")?.addEventListener("change", changeCompanyContext);
    prepareHeaderSearch();
  }
  const sidebarUser = document.querySelector(".user b");
  if (sidebarUser) sidebarUser.textContent = state.user?.name || "Usuario";
  const sidebarAvatar = document.querySelector(".user .avatar");
  if (sidebarAvatar) sidebarAvatar.textContent = (state.user?.name || "Usuario").split(" ").slice(0, 2).map(part => part[0]).join("").toUpperCase();
  renderCompanySwitcher();
  const user = header.querySelector(".top-user b");
  if (user) user.textContent = state.user?.name || "Usuario";
}

function prepareHeaderSearch() {
  const search = document.getElementById("search");
  if (!search || search.dataset.ready === "true") return;
  search.dataset.ready = "true";
  search.placeholder = "Buscar cliente, O.S., orçamento, produto...";
  search.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const term = search.value.trim();
    if (!term) return;
    view("intelligence");
    const global = document.getElementById("global-search");
    const form = document.getElementById("global-search-form");
    if (global) global.value = term;
    form?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  });
}

function prepareActionClarity() {
  const tips = {
    "bill-order": "Abre o recebimento da O.S. no controle/caixa.",
    "send-pcp": "Envia a O.S. para o fluxo de producao/PCP.",
    "attach-order": "Abre a area de anexos e aprovacao da O.S.",
    "history-order": "Mostra detalhes e historico da O.S.",
    "open-order": "Abre a O.S. completa para consulta.",
    "order-note": "Registra uma observacao na timeline da O.S.",
    "print-order": "Abre a visualizacao profissional para impressao.",
    "pdf-order": "Abre a O.S. para salvar em PDF.",
    "move-next-sector": "Envia a O.S. para o proximo setor do fluxo."
  };
  document.querySelectorAll("[data-action]").forEach(button => {
    const action = button.dataset.action;
    if (tips[action] && !button.title) button.title = tips[action];
    button.classList.add("operational-action");
    if (!button.dataset.order && ["bill-order", "send-pcp", "attach-order", "history-order", "open-order", "order-note", "print-order", "pdf-order", "move-next-sector"].includes(action)) {
      button.dataset.needsSelection = "true";
    }
  });
}

function applyFinalUxSprint() {
  document.body.classList.add("ux-final-sprint");
  simplifyDashboardUx();
  simplifyQuoteUx();
  simplifyOrdersUx();
  simplifyProductionUx();
  simplifyCashUx();
  simplifyFinanceUx();
  simplifySystemUx();
  prepareSystemOperations();
  prepareProductOperations();
  applyPremiumStabilityPolish();
}

function applyPremiumStabilityPolish() {
  document.body.classList.add("premium-stable-ui");
  document.body.classList.toggle("is-admin-user", isAdminUser());
  prepareToastSurface();
  preparePrintSurfaces();
  prepareReportsWorkspace();
  prepareModuleTabFeedback();
  prepareEmptyStates();
  prepareCustomerOperations();
  prepareProductCatalogTools();
  prepareProductRootLayout();
  prepareOperationalChecklists();
  prepareProductionQuickFilters();
  prepareButtonFallbacks();
  syncSelectionActionState();
  markRequiredFields();
  prepareLanguagePolish();
}

function prepareLanguagePolish() {
  repairVisibleLanguage();
  if (document.body.dataset.languagePolishReady === "true") return;
  document.body.dataset.languagePolishReady = "true";
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(() => {
      scheduled = false;
      repairVisibleLanguage();
    }, 20);
  });
  observer.observe(document.querySelector(".app") || document.body, { childList: true, subtree: true });
}

function repairVisibleLanguage() {
  const root = document.querySelector(".app");
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach(node => {
    const fixed = polishPortugueseText(node.nodeValue);
    if (fixed !== node.nodeValue) node.nodeValue = fixed;
  });
  root.querySelectorAll("[placeholder], [title], [aria-label]").forEach(element => {
    ["placeholder", "title", "aria-label"].forEach(attribute => {
      if (!element.hasAttribute(attribute)) return;
      const value = element.getAttribute(attribute);
      const fixed = polishPortugueseText(value);
      if (fixed !== value) element.setAttribute(attribute, fixed);
    });
  });
}

function polishPortugueseText(value) {
  let text = String(value || "");
  if (/[ÃÂâ]/.test(text)) {
    try {
      text = decodeURIComponent(escape(text));
    } catch {}
  }
  const replacements = [
    [/\bOrcamentos\b/g, "Orçamentos"], [/\bOrcamento\b/g, "Orçamento"], [/\borcamentos\b/g, "orçamentos"], [/\borcamento\b/g, "orçamento"],
    [/\bProducao\b/g, "Produção"], [/\bproducao\b/g, "produção"], [/\bOperacao\b/g, "Operação"], [/\boperacao\b/g, "operação"],
    [/\bGestao\b/g, "Gestão"], [/\bgestao\b/g, "gestão"], [/\bConfiguracoes\b/g, "Configurações"], [/\bconfiguracoes\b/g, "configurações"],
    [/\bIntegracoes\b/g, "Integrações"], [/\bintegracoes\b/g, "integrações"], [/\bQuestionarios\b/g, "Questionários"], [/\bquestionarios\b/g, "questionários"],
    [/\bServico\b/g, "Serviço"], [/\bservico\b/g, "serviço"], [/\bServicos\b/g, "Serviços"], [/\bservicos\b/g, "serviços"],
    [/\bPreco\b/g, "Preço"], [/\bpreco\b/g, "preço"], [/\bSimulacao\b/g, "Simulação"], [/\bsimulacao\b/g, "simulação"],
    [/\bAprovacao\b/g, "Aprovação"], [/\baprovacao\b/g, "aprovação"], [/\bInstalacao\b/g, "Instalação"], [/\binstalacao\b/g, "instalação"],
    [/\bObservacao\b/g, "Observação"], [/\bobservacao\b/g, "observação"], [/\bAcao\b/g, "Ação"], [/\bacao\b/g, "ação"],
    [/\bAcoes\b/g, "Ações"], [/\bacoes\b/g, "ações"], [/\bHistorico\b/g, "Histórico"], [/\bhistorico\b/g, "histórico"],
    [/\bResponsavel\b/g, "Responsável"], [/\bresponsavel\b/g, "responsável"], [/\bCredito\b/g, "Crédito"], [/\bDebito\b/g, "Débito"],
    [/\bTecnica\b/g, "Técnica"], [/\btecnica\b/g, "técnica"], [/\bTecnico\b/g, "Técnico"], [/\btecnico\b/g, "técnico"],
    [/\bMinimo\b/g, "Mínimo"], [/\bminimo\b/g, "mínimo"], [/\bCritica\b/g, "Crítica"], [/\bcritica\b/g, "crítica"],
    [/\bComissao\b/g, "Comissão"], [/\bcomissao\b/g, "comissão"], [/\bConfiguracao\b/g, "Configuração"], [/\bconfiguracao\b/g, "configuração"],
    [/\bJoao\b/g, "João"], [/\bNao\b/g, "Não"], [/\bnao\b/g, "não"], [/\bMes\b/g, "Mês"], [/\bmes\b/g, "mês"]
  ];
  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return text;
}

function prepareToastSurface() {
  if (document.getElementById("app-toast")) return;
  document.body.insertAdjacentHTML("beforeend", `<div id="app-toast" class="app-toast" role="status" aria-live="polite"></div>`);
}

function showToast(message, type = "info") {
  prepareToastSurface();
  const toast = document.getElementById("app-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add("show");
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

async function copyTextToClipboard(text = "") {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
  return true;
}

function prepareModuleTabFeedback() {
  document.querySelectorAll(".module-tabs").forEach(tabs => {
    if (tabs.dataset.premiumTabsReady === "true") return;
    tabs.dataset.premiumTabsReady = "true";
    tabs.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button || button.classList.contains("ux-hidden-tab")) return;
      tabs.querySelectorAll("button").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      const section = tabs.closest(".view");
      const index = [...tabs.querySelectorAll("button:not(.ux-hidden-tab)")].indexOf(button);
      if (section?.id === "quote") {
        section.dataset.simpleStep = String(index);
        goToSimpleStep("quote", 0);
      }
      if (section?.id === "orders") {
        section.dataset.simpleStep = String(index);
        goToSimpleStep("orders", 0);
      }
      if (section?.id === "pcp") {
        section.classList.toggle("production-list-mode", index === 0);
        section.classList.toggle("production-kanban-mode", index === 1);
      }
    });
  });
}

function prepareEmptyStates() {
  document.querySelectorAll("tbody").forEach(body => {
    if (body.children.length) return;
    const table = body.closest("table");
    const columns = table?.querySelectorAll("thead th").length || 1;
    const title = table?.closest(".panel, .order-section")?.querySelector("h2, h3")?.textContent || "registros";
    body.innerHTML = `<tr class="empty-table-row"><td colspan="${columns}">${emptyStateMarkup(`Nenhum registro encontrado em ${title}.`, "Use o botao principal desta tela para cadastrar ou atualizar os dados.")}</td></tr>`;
  });
  document.querySelectorAll(".mini-grid, .alert-list, .timeline, .kanban").forEach(container => {
    if (container.children.length || container.textContent.trim()) return;
    const title = container.closest(".panel, .order-section")?.querySelector("h2, h3")?.textContent || "esta area";
    container.innerHTML = emptyStateMarkup(`Nenhum dado para ${title}.`, "Quando houver movimentacao, os registros aparecerao aqui.");
  });
}

function emptyStateMarkup(title, message) {
  return `<div class="premium-empty-state"><span class="empty-state-icon">+</span><b>${title}</b><small>${message}</small></div>`;
}

function prepareButtonFallbacks() {
  document.querySelectorAll("button").forEach(button => {
    if (button.disabled && !button.title) button.title = "Acao indisponivel para esta tela ou permissao.";
    if (button.closest("form") && button.type !== "button") return;
    if (button.closest("nav")) return;
    if (button.closest(".module-tabs")) return;
    if (button.closest(".pcp-sector-strip")) return;
    // Declarative data attributes are used throughout the ERP to connect real actions.
    // Treat every configured data-* button as operational instead of disabling it as fallback.
    if (Object.keys(button.dataset).some(key => key !== "prepReady")) return;
    if (button.id || button.getAttribute("onclick")) return;
    if (button.dataset.prepReady === "true") return;
    button.dataset.prepReady = "true";
    button.classList.add("inactive-action");
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
    button.title = button.title || "Acao indisponivel nesta visao.";
  });
}

function prepareProductionQuickFilters() {
  document.querySelectorAll("#pcp-sector-strip button").forEach(button => {
    if (button.dataset.filterReady === "true") return;
    button.dataset.filterReady = "true";
    button.addEventListener("click", async () => {
      const selectedOrder = state.orders.find(order => order.id === state.selectedProductionOrderId);
      const sectorName = button.dataset.sectorFilter || button.textContent.trim();
      const nextSector = selectedOrder ? nextOrderSector(selectedOrder) : "";
      if (selectedOrder && nextSector === sectorName) {
        if (!window.confirm(`Mover ${selectedOrder.id} de ${selectedOrder.currentSectorName || selectedOrder.productionStatus} para ${sectorName}?`)) return;
        try {
          await api(`/api/orders/${selectedOrder.id}/move-sector`, {
            method: "POST",
            body: {
              nextSector: sectorName,
              source: "pcp_sector_icon",
              user: state.user?.name || "PCP",
              observation: `Movimentacao comandada pelo card do setor ${sectorName}.`
            }
          });
          state.selectedProductionOrderId = null;
          await loadAll();
          showToast(`${selectedOrder.id} movida para ${sectorName}.`, "success");
          await renderPcp();
        } catch (error) {
          showToast(error.message, "error");
        }
        return;
      }
      const select = document.getElementById("pcp-filter-sector");
      if (!select) return;
      select.value = sectorName;
      await renderPcp();
      button.closest(".pcp-sector-strip")?.querySelectorAll("button").forEach(item => item.classList.remove("active-filter"));
      button.classList.add("active-filter");
    });
  });
}

function markRequiredFields() {
  document.querySelectorAll("input[required], select[required], textarea[required]").forEach(field => {
    field.closest("label")?.classList.add("required-field");
  });
}

function prepareCustomerOperations() {
  const form = document.getElementById("customer-form");
  if (form && form.dataset.completeReady !== "true") {
    form.dataset.completeReady = "true";
    form.innerHTML = `
      <div class="form-row"><label>Nome / razao social<input id="customer-name" required></label><label>Telefone<input id="customer-phone" required></label></div>
      <div class="form-row"><label>E-mail<input id="customer-email" type="email"></label><label>Celular / WhatsApp<input id="customer-mobile"></label></div>
      <div class="form-row"><label>CPF/CNPJ<input id="customer-document"></label><label>Empresa / fantasia<input id="customer-company"></label></div>
      <div class="form-row"><label>Classificacao<select id="customer-classification"><option>Essencial</option><option>Recorrente</option><option>VIP</option><option>Fiado autorizado</option><option>Atencao</option></select></label><label>Origem<select id="customer-origin"><option>Balcao</option><option>WhatsApp</option><option>Instagram</option><option>Indicacao</option><option>Google</option><option>Cliente antigo</option><option>Outro</option></select></label></div>
      <label>Endereco<input id="customer-address" placeholder="Rua, numero, bairro, cidade"></label>
      <div class="form-row"><label>Contato principal<input id="customer-contact"></label><label>Limite de fiado<input id="customer-credit" type="number" value="0"></label></div>
      <label>Observacoes<textarea id="customer-notes" placeholder="Preferencias, historico rapido ou cuidados no atendimento"></textarea></label>
      <button class="primary">Cadastrar cliente</button>
    `;
  }
  const table = document.getElementById("customer-table")?.closest("table");
  const panel = table?.closest(".panel");
  if (panel && !document.getElementById("customer-search")) {
    panel.insertAdjacentHTML("afterbegin", `
      <div class="table-filters customer-filters">
        <label>Buscar cliente<input id="customer-search" placeholder="Nome, telefone, CPF/CNPJ ou empresa"></label>
        <button type="button" id="customer-clear-search">Limpar busca</button>
      </div>
    `);
    document.getElementById("customer-search")?.addEventListener("input", renderCustomers);
    document.getElementById("customer-clear-search")?.addEventListener("click", () => {
      document.getElementById("customer-search").value = "";
      renderCustomers();
    });
    document.getElementById("customer-table")?.addEventListener("click", handleCustomerTableAction);
  }
  prepareQuoteQuickCustomer();
}

function prepareQuoteQuickCustomer() {
  const customerSelect = document.getElementById("quote-customer");
  const label = customerSelect?.closest("label");
  if (!label || document.getElementById("quote-quick-customer")) return;
  label.insertAdjacentHTML("afterend", `
    <div id="quote-quick-customer" class="quick-customer-box">
      <button type="button" id="quote-show-quick-customer">Cadastrar cliente rapido</button>
      <div id="quote-quick-customer-form" class="quick-customer-form" hidden>
        <div class="form-row"><label>Nome<input id="quote-new-customer-name" required></label><label>Telefone<input id="quote-new-customer-phone" required></label></div>
        <div class="form-row"><label>E-mail<input id="quote-new-customer-email" type="email"></label><label>Origem<select id="quote-new-customer-origin"><option>WhatsApp</option><option>Balcao</option><option>Instagram</option><option>Indicacao</option><option>Google</option></select></label></div>
        <div class="action-bar"><button type="button" class="primary" id="quote-save-quick-customer">Salvar e usar no orcamento</button><button type="button" id="quote-cancel-quick-customer">Cancelar</button></div>
      </div>
    </div>
  `);
  document.getElementById("quote-show-quick-customer")?.addEventListener("click", () => {
    document.getElementById("quote-quick-customer-form").hidden = false;
    document.getElementById("quote-new-customer-name")?.focus();
  });
  document.getElementById("quote-cancel-quick-customer")?.addEventListener("click", () => {
    document.getElementById("quote-quick-customer-form").hidden = true;
  });
  document.getElementById("quote-save-quick-customer")?.addEventListener("click", async () => {
    const name = document.getElementById("quote-new-customer-name").value.trim();
    const phone = document.getElementById("quote-new-customer-phone").value.trim();
    if (!name || !phone) {
      showToast("Informe nome e telefone do cliente.", "warning");
      return;
    }
    const customer = await api("/api/customers", {
      method: "POST",
      body: {
        name,
        phone,
        whatsapp: phone,
        email: document.getElementById("quote-new-customer-email").value,
        origin: document.getElementById("quote-new-customer-origin").value,
        communicationPreference: "both",
        type: "Cliente rapido"
      }
    });
    await loadAll();
    document.getElementById("quote-customer").value = customer.id;
    renderQuoteCustomerCard();
    ["quote-new-customer-name", "quote-new-customer-phone", "quote-new-customer-email"].forEach(id => { document.getElementById(id).value = ""; });
    document.getElementById("quote-quick-customer-form").hidden = true;
    showToast("Cliente cadastrado e selecionado no orcamento.", "success");
  });
}

function handleCustomerTableAction(event) {
  const button = event.target.closest("[data-customer-action]");
  if (!button) return;
  const customer = state.customers.find(item => item.id === button.dataset.customer);
  if (!customer) return;
  if (button.dataset.customerAction === "edit") {
    document.getElementById("customer-name").value = customer.name || "";
    document.getElementById("customer-phone").value = customer.phone || "";
    document.getElementById("customer-email").value = customer.email || "";
    document.getElementById("customer-mobile").value = customer.mobile || customer.whatsapp || "";
    if (document.getElementById("customer-whatsapp")) document.getElementById("customer-whatsapp").value = customer.whatsapp || customer.mobile || customer.phone || "";
    document.getElementById("customer-document").value = customer.document || "";
    document.getElementById("customer-company").value = customer.companyName || "";
    document.getElementById("customer-classification").value = customer.classification || "Essencial";
    document.getElementById("customer-origin").value = customer.origin || "Balcao";
    document.getElementById("customer-address").value = customer.address || "";
    document.getElementById("customer-contact").value = customer.contact || "";
    if (document.getElementById("customer-contact-person")) document.getElementById("customer-contact-person").value = customer.contactPerson || customer.contact || "";
    if (document.getElementById("customer-communication-preference")) document.getElementById("customer-communication-preference").value = customer.communicationPreference || "both";
    document.getElementById("customer-credit").value = customer.creditLimit || 0;
    document.getElementById("customer-notes").value = customer.notes || "";
    document.getElementById("customer-form").dataset.editingId = customer.id;
    document.getElementById("customer-name")?.focus();
  }
  if (button.dataset.customerAction === "history") {
    showToast(`Historico: ${customer.name} tem ${state.quotes.filter(quote => quote.customerId === customer.id).length} orcamento(s) e ${state.orders.filter(order => order.customerId === customer.id).length} O.S.`, "info");
  }
  if (button.dataset.customerAction === "delete") {
    softDeleteCustomer(customer.id);
  }
}

async function softDeleteCustomer(id) {
  if (!confirm("Inativar este cliente? Historicos serao preservados.")) return;
  await api(`/api/customers/${id}`, { method: "DELETE" });
  await loadAll();
  showToast("Cliente inativado com historico preservado.", "success");
}

function prepareProductCatalogTools() {
  const form = document.getElementById("product-form");
  if (form && form.dataset.completeReady !== "true") {
    form.dataset.completeReady = "true";
    form.innerHTML = `
      <div class="form-row"><label>Codigo interno<input id="product-code" value="PRS-001" required></label><label>Nome<input id="product-name" value="Servico personalizado" required></label></div>
      <label>Descricao<textarea id="product-description" placeholder="Explique o que o vendedor e a producao precisam saber"></textarea></label>
      <div class="form-row"><label>Imagem do produto<input id="product-image-url" placeholder="URL ou caminho da imagem"></label><label>Anexos/exemplos<input id="product-attachments" placeholder="mockup.jpg, exemplo.pdf"></label></div>
      <div class="form-row"><label>Categoria<select id="product-category"><option>Copia / impressao</option><option>Adesivo</option><option>Lona / banner</option><option>Placas / ACM</option><option>Letreiro / luminoso</option><option>Brindes</option><option>Revenda</option><option>Personalizado</option></select></label><label>Unidade de medida<select id="product-unit"><option value="m2">m2</option><option value="unidade">unidade</option><option value="metro_linear">metro linear</option><option value="hora">hora</option><option value="pacote">pacote</option></select></label></div>
      <div class="form-row"><label>Forma de calculo<select id="product-pricing-mode"><option value="unit">Por unidade</option><option value="square_meter">Por metro quadrado</option><option value="linear_meter">Por metro linear</option></select></label><label>Prazo padrao de producao (dias)<input id="product-default-days" type="number" min="0" value="3"></label></div>
      <div class="form-row"><label>Valor de venda<input id="product-base" type="number" min="0" step="0.01" value="80" required></label><label>Valor de custo<input id="product-cost" type="number" min="0" step="0.01" value="0" required></label></div>
      <div class="form-row"><label>Margem minima (%)<input id="product-min-margin" type="number" min="0" step="0.01" value="25" required></label><label>Margem sugerida (%)<input id="product-margin" type="number" min="0" step="0.01" value="50" required></label><label>Desconto permitido (%)<input id="product-max-discount" type="number" min="0" max="100" step="0.01" value="10" required></label></div>
      <div class="form-row"><label>Comissao (%)<input id="product-commission" type="number" min="0" max="100" step="0.01" value="0"></label><label>Impostos (%)<input id="product-tax" type="number" min="0" max="100" step="0.01" value="6"></label><label>Custo de producao<input id="product-production-cost" type="number" min="0" step="0.01" value="0"></label></div>
      <div class="form-row"><label>Custo de instalacao<input id="product-installation-cost" type="number" min="0" step="0.01" value="0"></label><label>Preco sugerido<input id="product-suggested-price" type="number" min="0" step="0.01" value="0"></label><label>Preco final manual<input id="product-manual-final-price" type="number" min="0" step="0.01" value="0"></label></div>
      <label>Observacao do preco<textarea id="product-price-note" placeholder="Motivo, referencia de tabela ou condicao comercial"></textarea></label>
      <label>Materiais usados<input id="product-materials" placeholder="Lona 440g, ACM, Adesivo, Tinta"></label>
      <label>Acabamentos disponiveis<input id="product-finishes" placeholder="Ilhos, bainha, verniz, recorte, instalacao"></label>
      <div class="form-row"><label>Tempo medio de producao (min)<input id="product-production-minutes" type="number" value="60"></label><label>Setores envolvidos<input id="product-sectors" placeholder="Arte, Impressao, Acabamento"></label></div>
      <section class="product-config-builder">
        <div class="product-config-title"><div><b>Perguntas tecnicas e custos</b><small>As respostas configuradas aqui entram no calculo e no snapshot da O.S.</small></div></div>
        <div class="form-row"><label>Pergunta<input id="product-question-label" placeholder="Ex.: Tem laminacao?"></label><label>Tipo de resposta<select id="product-question-type"><option value="text">Texto</option><option value="number">Numero</option><option value="currency">Moeda</option><option value="yes_no">Sim / Nao</option><option value="select">Selecao unica</option><option value="multi_select">Multipla escolha</option><option value="date">Data</option><option value="measure">Medida</option></select></label></div>
        <label>Opcoes, separadas por virgula<input id="product-question-options" placeholder="Brilho, Fosca, Sem laminacao"></label>
        <div class="form-row"><label>Ordem<input id="product-question-order-index" type="number" step="1" value="0"></label><label>Valor padrao<input id="product-question-default" placeholder="Resposta sugerida"></label><label>Status<select id="product-question-active"><option value="true">Ativa</option><option value="false">Inativa</option></select></label></div>
        <div class="form-row"><label>Tipo de custo<select id="product-question-cost-type"><option value="fixed">Valor fixo</option><option value="unit">Por unidade</option><option value="square_meter">Por m2</option><option value="linear_meter">Por metro linear</option><option value="percentage">Percentual</option></select></label><label>Valor do custo<input id="product-question-cost-value" type="number" step="0.01" value="0"></label><label>Aplicacao<select id="product-question-application"><option value="add_to_cost">Adicionar ao custo</option><option value="add_to_price">Adicionar ao preco</option><option value="margin_adjustment">Ajustar margem</option></select></label></div>
        <div class="form-row"><label>Impacto na producao<input id="product-question-production-impact" placeholder="Ex.: adicionar etapa de laminacao"></label><label>Impacto no prazo (dias)<input id="product-question-deadline-impact" type="number" step="1" value="0"></label></div>
        <div class="check-grid compact-check-grid"><label><input id="product-question-required" type="checkbox"> Obrigatoria</label><label><input id="product-question-quote" type="checkbox" checked> Visivel no orcamento</label><label><input id="product-question-order" type="checkbox" checked> Visivel na O.S.</label><label><input id="product-question-production" type="checkbox" checked> Visivel na producao</label><label><input id="product-question-affects-cost" type="checkbox" checked> Afeta custo</label></div>
        <button type="button" id="product-add-question">Adicionar pergunta</button>
        <div id="product-question-draft-list" class="config-draft-list"></div>
      </section>
      <section class="product-config-builder">
        <div class="product-config-title"><div><b>Fluxo de producao</b><small>A ordem definida sera congelada no orcamento e na O.S.</small></div></div>
        <div class="form-row"><label>Setor<select id="product-route-sector"></select></label><label>Responsavel padrao<input id="product-route-responsible"></label><label>Duracao padrao (h)<input id="product-route-duration" type="number" step="0.1" value="0"></label></div>
        <div class="check-grid compact-check-grid"><label><input id="product-route-file" type="checkbox"> Exige arquivo</label><label><input id="product-route-checklist" type="checkbox"> Exige checklist</label></div>
        <button type="button" id="product-add-route">Adicionar etapa</button>
        <div id="product-route-draft-list" class="config-draft-list"></div>
      </section>
      <div class="check-grid product-rules-grid">
        <label><input id="product-requires-installation" type="checkbox"> Exige instalacao</label>
        <label><input id="product-requires-art" type="checkbox"> Exige arte</label>
        <label><input id="product-requires-approval" type="checkbox"> Exige aprovacao</label>
        <label><input id="product-generates-production" type="checkbox" checked> Gera producao</label>
        <label><input id="product-moves-stock" type="checkbox" checked> Movimenta estoque</label>
        <label><input id="product-generates-financial" type="checkbox" checked> Gera financeiro</label>
      </div>
      <label>Status<select id="product-active"><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
      <div class="action-bar"><button class="primary">Salvar produto</button><button type="button" id="product-form-clear">Limpar</button></div>
    `;
    document.getElementById("product-form-clear")?.addEventListener("click", clearProductForm);
    document.getElementById("product-add-question")?.addEventListener("click", addProductQuestionDraft);
    document.getElementById("product-add-route")?.addEventListener("click", addProductRouteDraft);
    document.getElementById("product-question-draft-list")?.addEventListener("click", handleProductConfigDraftAction);
    document.getElementById("product-route-draft-list")?.addEventListener("click", handleProductConfigDraftAction);
  }
  renderProductConfigDraft();
  const list = document.getElementById("product-list");
  const panel = list?.closest(".panel");
  if (panel && !document.getElementById("product-search")) {
    panel.insertAdjacentHTML("afterbegin", `
      <div class="table-filters product-filters">
        <label>Buscar produto<input id="product-search" placeholder="Nome, codigo ou categoria"></label>
        <label>Categoria<select id="product-category-filter"><option value="">Todas</option></select></label>
        <label>Status<select id="product-status-filter"><option value="">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></label>
        <label>Tipo de calculo<select id="product-type-filter"><option value="">Todos</option><option value="unit">Unidade</option><option value="square_meter">Metro quadrado</option><option value="linear_meter">Metro linear</option></select></label>
      </div>
    `);
    document.getElementById("product-search")?.addEventListener("input", renderProducts);
    document.getElementById("product-category-filter")?.addEventListener("change", renderProducts);
    document.getElementById("product-status-filter")?.addEventListener("change", renderProducts);
    document.getElementById("product-type-filter")?.addEventListener("change", renderProducts);
    list.addEventListener("click", handleProductListAction);
  }
}

function prepareProductRootLayout() {
  const form = document.getElementById("product-form");
  if (!form || form.dataset.rootProductReady === "true") return;
  form.dataset.rootProductReady = "true";
  const fields = {};
  ["product-code", "product-name", "product-description", "product-category", "product-unit", "product-pricing-mode", "product-default-days", "product-base", "product-cost", "product-min-margin", "product-margin", "product-max-discount", "product-commission", "product-tax", "product-production-cost", "product-installation-cost", "product-suggested-price", "product-manual-final-price", "product-price-note", "product-materials", "product-finishes", "product-production-minutes", "product-sectors", "product-active"].forEach(id => {
    fields[id] = document.getElementById(id)?.closest("label");
  });
  const builders = [...form.querySelectorAll(".product-config-builder")];
  const rules = form.querySelector(".product-rules-grid");
  const actions = form.querySelector(":scope > .action-bar");
  form.innerHTML = `
    ${renderCompactTabs("product-root-tabs", [{ id: "basic", label: "Dados" }, { id: "pricing", label: "Precificacao" }, { id: "questions", label: "Perguntas" }, { id: "production", label: "Producao" }, { id: "stock", label: "Estoque" }, { id: "finance", label: "Financeiro" }, { id: "audit", label: "Auditoria" }], "basic")}
    <section class="root-tab-pane active" data-root-pane="basic"><div id="product-root-basic" class="root-form-grid" style="--root-columns:4"></div><div id="product-root-rules"></div></section>
    <section class="root-tab-pane" data-root-pane="pricing"><div id="product-root-pricing" class="root-form-grid" style="--root-columns:4"></div></section>
    <section class="root-tab-pane" data-root-pane="questions"><div id="product-root-questions"></div></section>
    <section class="root-tab-pane" data-root-pane="production"><div id="product-root-production" class="root-form-grid" style="--root-columns:3"></div><div id="product-root-route"></div></section>
    <section class="root-tab-pane" data-root-pane="stock"><div id="product-root-stock" class="focused-empty-note"><b>Estoque vinculado</b><span>Materiais usados e baixas ficam conectados ao consumo da O.S.</span></div></section>
    <section class="root-tab-pane" data-root-pane="finance"><div id="product-root-finance" class="root-form-grid" style="--root-columns:3"></div></section>
    <section class="root-tab-pane" data-root-pane="audit"><div id="product-root-audit" class="focused-empty-note"><b>Historico do produto</b><span>Alteracoes de preco, perguntas e rota sao registradas em auditoria.</span></div></section>
    <div id="product-root-actions"></div>
  `;
  const append = (targetId, ids) => ids.forEach(id => fields[id] && document.getElementById(targetId)?.appendChild(fields[id]));
  append("product-root-basic", ["product-code", "product-name", "product-description", "product-category", "product-unit", "product-pricing-mode", "product-default-days", "product-active"]);
  append("product-root-pricing", ["product-base", "product-cost", "product-min-margin", "product-margin", "product-max-discount", "product-suggested-price", "product-manual-final-price", "product-price-note"]);
  append("product-root-production", ["product-materials", "product-finishes", "product-production-minutes", "product-sectors"]);
  append("product-root-finance", ["product-commission", "product-tax", "product-production-cost", "product-installation-cost"]);
  if (rules) document.getElementById("product-root-rules").appendChild(rules);
  if (builders[0]) document.getElementById("product-root-questions").appendChild(builders[0]);
  if (builders[1]) document.getElementById("product-root-route").appendChild(builders[1]);
  if (actions) document.getElementById("product-root-actions").appendChild(actions);
  document.getElementById("product-root-tabs")?.addEventListener("click", event => {
    const button = event.target.closest("[data-root-tab]");
    if (button) activateRootTab("product-form", button.dataset.rootTab);
  });
}

function productQuestionKey(label) {
  return normalizeUxText(label || "pergunta").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `question_${Date.now()}`;
}

function renderProductConfigDraft() {
  const sectorSelect = document.getElementById("product-route-sector");
  if (sectorSelect) {
    const current = sectorSelect.value;
    sectorSelect.innerHTML = (state.sectors || []).filter(sector => sector.active !== false).sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0)).map(sector => `<option value="${sector.id}">${sector.name}</option>`).join("");
    if ([...sectorSelect.options].some(option => option.value === current)) sectorSelect.value = current;
  }
  const questions = document.getElementById("product-question-draft-list");
  if (questions) questions.innerHTML = (state.productConfigDraft.technicalQuestions || []).map((question, index) => `
    <div class="config-draft-row">
      <div><b>${index + 1}. ${question.label}</b><small>${businessLabel(question.answerType)} | Ordem ${question.orderIndex ?? index} | ${question.required ? "Obrigatoria" : "Opcional"} | ${question.active === false ? "Inativa" : "Ativa"} | ${question.affectsCost ? `${businessLabel(question.costType)} ${money.format(question.costValue || 0)} - ${businessLabel(question.costApplication)}` : "Nao afeta custo"}</small></div>
      <button type="button" data-config-action="remove-question" data-index="${index}">Remover</button>
    </div>
  `).join("") || `<div class="focused-empty-note"><b>Nenhuma pergunta configurada.</b><span>Adicione perguntas que alimentam o calculo e a producao.</span></div>`;
  const route = document.getElementById("product-route-draft-list");
  if (route) route.innerHTML = (state.productConfigDraft.productionRoute || []).map((step, index, items) => `
    <div class="config-draft-row">
      <div><b>${index + 1}. ${step.sectorName}</b><small>${step.defaultResponsible || "Responsavel a definir"} | ${step.defaultDurationHours || 0}h${step.requiredFile ? " | exige arquivo" : ""}${step.checklistRequired ? " | exige checklist" : ""}</small></div>
      <div class="row-actions"><button type="button" data-config-action="route-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>Subir</button><button type="button" data-config-action="route-down" data-index="${index}" ${index === items.length - 1 ? "disabled" : ""}>Descer</button><button type="button" data-config-action="remove-route" data-index="${index}">Remover</button></div>
    </div>
  `).join("") || `<div class="focused-empty-note"><b>Nenhuma etapa configurada.</b><span>Adicione a rota que o PCP deve seguir automaticamente.</span></div>`;
}

function addProductQuestionDraft() {
  const label = document.getElementById("product-question-label")?.value.trim();
  if (!label) return showToast("Informe a pergunta tecnica.", "warning");
  const answerType = document.getElementById("product-question-type").value;
  const options = String(document.getElementById("product-question-options").value || "").split(",").map(item => item.trim()).filter(Boolean).map(item => ({ label: item, value: productQuestionKey(item) }));
  state.productConfigDraft.technicalQuestions.push({
    id: `question-${Date.now()}`,
    key: productQuestionKey(label),
    label,
    answerType,
    type: answerType === "yes_no" ? "boolean" : answerType === "multi_select" ? "multiselect" : answerType,
    options,
    required: document.getElementById("product-question-required").checked,
    orderIndex: Number(document.getElementById("product-question-order-index")?.value || state.productConfigDraft.technicalQuestions.length),
    defaultValue: document.getElementById("product-question-default")?.value || "",
    productionImpact: document.getElementById("product-question-production-impact")?.value || "",
    deadlineImpactDays: Number(document.getElementById("product-question-deadline-impact")?.value || 0),
    active: document.getElementById("product-question-active")?.value !== "false",
    visibleInQuote: document.getElementById("product-question-quote").checked,
    visibleInOrder: document.getElementById("product-question-order").checked,
    visibleInProduction: document.getElementById("product-question-production").checked,
    affectsCost: document.getElementById("product-question-affects-cost").checked,
    costType: document.getElementById("product-question-cost-type").value,
    costValue: Number(document.getElementById("product-question-cost-value").value || 0),
    costApplication: document.getElementById("product-question-application").value
  });
  document.getElementById("product-question-label").value = "";
  document.getElementById("product-question-options").value = "";
  document.getElementById("product-question-cost-value").value = "0";
  if (document.getElementById("product-question-order-index")) document.getElementById("product-question-order-index").value = String(state.productConfigDraft.technicalQuestions.length);
  if (document.getElementById("product-question-default")) document.getElementById("product-question-default").value = "";
  if (document.getElementById("product-question-production-impact")) document.getElementById("product-question-production-impact").value = "";
  if (document.getElementById("product-question-deadline-impact")) document.getElementById("product-question-deadline-impact").value = "0";
  renderProductConfigDraft();
}

function addProductRouteDraft() {
  const sectorId = document.getElementById("product-route-sector")?.value;
  const sector = state.sectors.find(item => item.id === sectorId);
  if (!sector) return showToast("Selecione um setor de producao.", "warning");
  if (state.productConfigDraft.productionRoute.some(step => step.sectorId === sector.id)) return showToast("Este setor ja esta na rota.", "warning");
  state.productConfigDraft.productionRoute.push({
    sectorId: sector.id,
    sectorName: sector.name,
    orderIndex: state.productConfigDraft.productionRoute.length,
    defaultResponsible: document.getElementById("product-route-responsible").value || sector.responsible || "",
    defaultDurationHours: Number(document.getElementById("product-route-duration").value || 0),
    requiredFile: document.getElementById("product-route-file").checked,
    checklistRequired: document.getElementById("product-route-checklist").checked
  });
  renderProductConfigDraft();
}

function handleProductConfigDraftAction(event) {
  const button = event.target.closest("[data-config-action]");
  if (!button) return;
  const index = Number(button.dataset.index);
  const action = button.dataset.configAction;
  if (action === "remove-question") state.productConfigDraft.technicalQuestions.splice(index, 1);
  if (action === "remove-route") state.productConfigDraft.productionRoute.splice(index, 1);
  if (action === "route-up" && index > 0) [state.productConfigDraft.productionRoute[index - 1], state.productConfigDraft.productionRoute[index]] = [state.productConfigDraft.productionRoute[index], state.productConfigDraft.productionRoute[index - 1]];
  if (action === "route-down" && index < state.productConfigDraft.productionRoute.length - 1) [state.productConfigDraft.productionRoute[index + 1], state.productConfigDraft.productionRoute[index]] = [state.productConfigDraft.productionRoute[index], state.productConfigDraft.productionRoute[index + 1]];
  state.productConfigDraft.productionRoute = state.productConfigDraft.productionRoute.map((step, orderIndex) => ({ ...step, orderIndex }));
  renderProductConfigDraft();
}

function clearProductForm() {
  const form = document.getElementById("product-form");
  form?.reset();
  if (form) delete form.dataset.editingId;
  state.productConfigDraft = { technicalQuestions: [], productionRoute: [] };
  renderProductConfigDraft();
  document.getElementById("product-code").value = `PRS-${String((state.products?.length || 0) + 1).padStart(3, "0")}`;
  document.getElementById("product-name")?.focus();
}

async function handleProductListAction(event) {
  const categoryButton = event.target.closest("[data-product-category-select]");
  if (categoryButton) {
    const filter = document.getElementById("product-category-filter");
    if (filter) filter.value = categoryButton.dataset.productCategorySelect || "";
    renderProducts();
    return;
  }
  const button = event.target.closest("[data-product-action]");
  const row = event.target.closest("[data-product-row]");
  if (!button && row) {
    state.expandedProductId = state.expandedProductId === row.dataset.productRow ? "" : row.dataset.productRow;
    renderProducts();
    return;
  }
  if (!button) return;
  event.stopPropagation();
  const product = state.products.find(item => item.id === button.dataset.product);
  if (!product) return;
  const action = button.dataset.productAction;
  if (action === "edit") fillProductForm(product);
  if (action === "delete") softDeleteProduct(product.id);
  if (action === "duplicate") duplicateProduct(product.id);
  if (action === "model-add") openProductModelEditor(product.id);
  if (action === "model-edit") openProductModelEditor(product.id, button.dataset.model);
  if (action === "model-duplicate") duplicateProductModel(product.id, button.dataset.model);
  if (action === "model-delete") softDeleteProductModel(product.id, button.dataset.model);
  if (action === "model-questions") openProductModelQuestions(product.id, button.dataset.model);
  if (action === "catalog-preview") openProductCatalogPreview(product);
  if (action === "catalog-favorite") {
    await api(`/api/products/${product.id}/favorite`, { method: "POST", body: { favorite: !product.favorite } });
    await loadAll();
    showToast(product.favorite ? "Produto removido dos favoritos." : "Produto favoritado.", "success");
  }
  if (action === "catalog-image") {
    const imageUrl = prompt("URL ou caminho da imagem do produto:", product.imageUrl || "");
    if (imageUrl === null) return;
    await api(`/api/products/${product.id}/catalog`, { method: "PATCH", body: { imageUrl } });
    await loadAll();
    showToast("Imagem do produto atualizada.", "success");
  }
  if (action === "catalog-category") {
    const categoryName = prompt("Categoria do produto:", product.category || "");
    if (categoryName === null) return;
    const category = state.productCategories.find(item => normalizeUxText(item.name) === normalizeUxText(categoryName) || item.id === categoryName);
    await api(`/api/products/${product.id}/catalog`, { method: "PATCH", body: { category: category?.name || categoryName, categoryId: category?.id || product.categoryId || "" } });
    await loadAll();
    showToast("Categoria do produto atualizada.", "success");
  }
  if (action === "quote") {
    await api(`/api/products/${product.id}/use`, { method: "POST", body: { user: state.user?.name || "Vendedor" } });
    view("quote");
    document.getElementById("quote-product").value = product.id;
    renderQuoteProductModels();
    applyProductConfigurationToQuote();
    activateRootTab("quote-root-shell", "items");
  }
}

function openProductCatalogPreview(product = {}) {
  const models = productModels(product);
  const html = `
    <article class="product-preview-document">
      <header>
        ${product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="">` : `<span>${escapeHtml(product.categoryIcon || "PR")}</span>`}
        <div><small>${escapeHtml(product.code || "Sem codigo")} | ${escapeHtml(product.category || "Sem categoria")}</small><h2>${escapeHtml(product.name || "Produto")}</h2><p>${escapeHtml(product.description || "Produto cadastrado no catalogo PrintSys.")}</p></div>
      </header>
      <section class="focused-summary-grid">
        <div class="focused-summary-item"><span>Modelos</span><b>${models.length}</b></div>
        <div class="focused-summary-item"><span>Venda</span><b>${money.format(product.salePrice || product.minPrice || 0)}</b></div>
        <div class="focused-summary-item"><span>Prazo</span><b>${product.defaultProductionDays || 0} dia(s)</b></div>
        <div class="focused-summary-item"><span>Status</span><b>${product.active === false ? "Inativo" : "Ativo"}</b></div>
      </section>
      <section class="refined-print-table">
        <table><thead><tr><th>Modelo</th><th>Acabamento</th><th>Unidade</th><th>Custo</th><th>Venda</th></tr></thead><tbody>
          ${models.map(model => `<tr><td>${escapeHtml(model.name)}</td><td>${escapeHtml(model.finish || "-")}</td><td>${escapeHtml(model.unit || "-")}</td><td>${money.format((model.materialCost || 0) + (model.laborCost || 0))}</td><td>${money.format(model.salePrice || 0)}</td></tr>`).join("")}
        </tbody></table>
      </section>
    </article>
  `;
  openDocumentPreview(`Produto ${product.name || ""}`, html, false);
}

async function duplicateProduct(id) {
  if (!canUsePermission("settings")) return showToast("Seu perfil nao pode duplicar produto.", "warning");
  const product = state.products.find(item => item.id === id);
  const nextName = prompt("Nome do produto duplicado", `${product?.name || "Produto"} (copia)`);
  if (nextName === null) return;
  await api(`/api/products/${id}/duplicate`, { method: "POST", body: { name: nextName } });
  state.expandedProductId = "";
  await loadAll();
  showToast("Produto duplicado com modelos, perguntas e rota.", "success");
}

function ensureProductModelModal() {
  if (document.getElementById("product-model-modal")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div id="product-model-modal" class="product-modal" hidden>
      <form id="product-model-form" class="product-modal-card">
        <header><div><span>Modelo do produto</span><h2 id="product-model-title">Novo modelo</h2></div><button type="button" id="product-model-close">Fechar</button></header>
        <div class="root-form-grid" style="--root-columns:3">
          <label>Modelo<input id="model-name" required></label>
          <label>Acabamento<input id="model-finish" placeholder="Ex.: Ilhos, verniz, recorte"></label>
          <label>Unidade<select id="model-unit"><option value="unidade">unidade</option><option value="m2">m2</option><option value="metro_linear">metro linear</option><option value="hora">hora</option><option value="pacote">pacote</option></select></label>
          <label>Variacao<select id="model-variation"><option value="unit">Por unidade</option><option value="square_meter">Por m2</option><option value="linear_meter">Por metro linear</option></select></label>
          <label>Custo material/terceiro<input id="model-material-cost" type="number" step="0.01" min="0"></label>
          <label>Custo mao de obra<input id="model-labor-cost" type="number" step="0.01" min="0"></label>
          <label>Valor de venda<input id="model-sale-price" type="number" step="0.01" min="0"></label>
          <label>Estoque vinculado<input id="model-stock-links" placeholder="IDs ou nomes separados por virgula"></label>
          <label>Status<select id="model-active"><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
        </div>
        <footer><button type="button" id="product-model-cancel">Cancelar</button><button class="primary">Salvar modelo</button></footer>
      </form>
    </div>
  `);
  document.getElementById("product-model-close")?.addEventListener("click", closeProductModelModal);
  document.getElementById("product-model-cancel")?.addEventListener("click", closeProductModelModal);
  document.getElementById("product-model-form")?.addEventListener("submit", saveProductModelForm);
}

function openProductModelEditor(productId, modelId = "") {
  if (!canUsePermission("settings")) return showToast("Seu perfil nao pode alterar modelos.", "warning");
  ensureProductModelModal();
  const product = state.products.find(item => item.id === productId);
  const model = productModels(product).find(item => item.id === modelId);
  const form = document.getElementById("product-model-form");
  form.dataset.productId = productId;
  form.dataset.modelId = modelId || "";
  document.getElementById("product-model-title").textContent = model ? `Editar ${model.name}` : `Novo modelo de ${product?.name || "produto"}`;
  document.getElementById("model-name").value = model?.name || "";
  document.getElementById("model-finish").value = model?.finish || "";
  document.getElementById("model-unit").value = model?.unit || product?.unit || "unidade";
  document.getElementById("model-variation").value = model?.variation || product?.pricingMode || "unit";
  document.getElementById("model-material-cost").value = model?.materialCost || 0;
  document.getElementById("model-labor-cost").value = model?.laborCost || 0;
  document.getElementById("model-sale-price").value = model?.salePrice || product?.salePrice || product?.minPrice || 0;
  document.getElementById("model-stock-links").value = (model?.stockLinks || []).join(", ");
  document.getElementById("model-active").value = model?.active === false ? "false" : "true";
  document.getElementById("product-model-modal").hidden = false;
  document.getElementById("model-name")?.focus();
}

function closeProductModelModal() {
  const modal = document.getElementById("product-model-modal");
  if (modal) modal.hidden = true;
}

async function saveProductModelForm(event) {
  event.preventDefault();
  const form = event.target;
  const productId = form.dataset.productId;
  const modelId = form.dataset.modelId;
  const split = value => String(value || "").split(",").map(item => item.trim()).filter(Boolean);
  const body = {
    name: document.getElementById("model-name").value,
    finish: document.getElementById("model-finish").value,
    unit: document.getElementById("model-unit").value,
    variation: document.getElementById("model-variation").value,
    materialCost: Number(document.getElementById("model-material-cost").value || 0),
    laborCost: Number(document.getElementById("model-labor-cost").value || 0),
    salePrice: Number(document.getElementById("model-sale-price").value || 0),
    stockLinks: split(document.getElementById("model-stock-links").value),
    active: document.getElementById("model-active").value === "true",
    syncMainProduct: !modelId
  };
  await api(modelId ? `/api/products/${productId}/models/${modelId}` : `/api/products/${productId}/models`, { method: modelId ? "PUT" : "POST", body });
  state.expandedProductId = productId;
  closeProductModelModal();
  await loadAll();
  showToast(modelId ? "Modelo atualizado." : "Modelo criado.", "success");
}

async function duplicateProductModel(productId, modelId) {
  if (!canUsePermission("settings")) return showToast("Seu perfil nao pode duplicar modelo.", "warning");
  await api(`/api/products/${productId}/models/${modelId}/duplicate`, { method: "POST", body: {} });
  state.expandedProductId = productId;
  await loadAll();
  showToast("Modelo duplicado.", "success");
}

async function softDeleteProductModel(productId, modelId) {
  if (!canUsePermission("settings")) return showToast("Seu perfil nao pode inativar modelo.", "warning");
  if (!confirm("Inativar este modelo? Orcamentos e O.S. antigos continuam preservados.")) return;
  await api(`/api/products/${productId}/models/${modelId}`, { method: "DELETE" });
  state.expandedProductId = productId;
  await loadAll();
  showToast("Modelo inativado com historico preservado.", "success");
}

async function openProductModelQuestions(productId, modelId) {
  if (!canUsePermission("settings")) return showToast("Seu perfil nao pode alterar perguntas.", "warning");
  ensureProductQuestionModal();
  const product = state.products.find(item => item.id === productId);
  const model = productModels(product).find(item => item.id === modelId);
  state.productModelQuestionDraft = structuredClone(model?.technicalQuestions || model?.questions || []);
  const form = document.getElementById("product-model-question-form");
  form.dataset.productId = productId;
  form.dataset.modelId = modelId;
  document.getElementById("product-question-modal-title").textContent = `Perguntas de ${model?.name || "modelo"}`;
  renderProductModelQuestionDraft();
  document.getElementById("product-question-modal").hidden = false;
}

function ensureProductQuestionModal() {
  if (document.getElementById("product-question-modal")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div id="product-question-modal" class="product-modal" hidden>
      <form id="product-model-question-form" class="product-modal-card">
        <header><div><span>Perguntas do modelo</span><h2 id="product-question-modal-title">Perguntas</h2></div><button type="button" id="product-question-close">Fechar</button></header>
        <div class="root-form-grid" style="--root-columns:4">
          <label>Pergunta<input id="model-question-label" placeholder="Ex.: Possui instalacao?"></label>
          <label>Tipo<select id="model-question-type"><option value="text">Texto</option><option value="number">Numero</option><option value="currency">Moeda</option><option value="yes_no">Sim / Nao</option><option value="select">Selecao unica</option><option value="multi_select">Multipla escolha</option><option value="measure">Medida</option><option value="upload">Arquivo</option></select></label>
          <label>Ordem<input id="model-question-order" type="number" step="1" value="0"></label>
          <label>Status<select id="model-question-active"><option value="true">Ativa</option><option value="false">Inativa</option></select></label>
          <label>Valor padrao<input id="model-question-default"></label>
          <label>Impacto no preco<input id="model-question-cost" type="number" step="0.01" value="0"></label>
          <label>Tipo de impacto<select id="model-question-cost-type"><option value="fixed">Valor fixo</option><option value="square_meter">Por m2</option><option value="linear_meter">Por metro linear</option><option value="unit">Por unidade</option><option value="percentage">Percentual</option></select></label>
          <label>Impacto no prazo<input id="model-question-deadline" type="number" step="1" value="0"></label>
          <label class="wide-field">Impacto na producao<input id="model-question-production-impact" placeholder="Ex.: adicionar acabamento"></label>
          <label class="wide-field">Opcoes separadas por virgula<input id="model-question-options" placeholder="Sim, Nao, Brilho, Fosco"></label>
        </div>
        <div class="check-grid compact-check-grid">
          <label><input id="model-question-required" type="checkbox"> Obrigatoria</label>
          <label><input id="model-question-quote" type="checkbox" checked> Orcamento</label>
          <label><input id="model-question-order-visible" type="checkbox" checked> O.S.</label>
          <label><input id="model-question-production-visible" type="checkbox" checked> Producao</label>
        </div>
        <div class="root-inline-actions"><button type="button" id="model-question-add">Adicionar pergunta</button></div>
        <div id="product-model-question-list" class="config-draft-list"></div>
        <footer><button type="button" id="product-question-cancel">Cancelar</button><button class="primary">Salvar perguntas</button></footer>
      </form>
    </div>
  `);
  document.getElementById("product-question-close")?.addEventListener("click", closeProductQuestionModal);
  document.getElementById("product-question-cancel")?.addEventListener("click", closeProductQuestionModal);
  document.getElementById("model-question-add")?.addEventListener("click", addProductModelQuestionDraft);
  document.getElementById("product-model-question-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-model-question-action]");
    if (!button) return;
    const index = Number(button.dataset.index || 0);
    if (button.dataset.modelQuestionAction === "remove") state.productModelQuestionDraft.splice(index, 1);
    renderProductModelQuestionDraft();
  });
  document.getElementById("product-model-question-form")?.addEventListener("submit", saveProductModelQuestions);
}

function closeProductQuestionModal() {
  const modal = document.getElementById("product-question-modal");
  if (modal) modal.hidden = true;
}

function addProductModelQuestionDraft() {
  const label = document.getElementById("model-question-label")?.value.trim();
  if (!label) return showToast("Informe a pergunta.", "warning");
  const answerType = document.getElementById("model-question-type").value;
  const options = String(document.getElementById("model-question-options").value || "").split(",").map(item => item.trim()).filter(Boolean).map(item => ({ label: item, value: productQuestionKey(item) }));
  state.productModelQuestionDraft.push({
    id: `question-${Date.now()}`,
    key: productQuestionKey(label),
    label,
    answerType,
    type: answerType === "yes_no" ? "boolean" : answerType === "multi_select" ? "multiselect" : answerType === "currency" ? "money" : answerType,
    options,
    required: document.getElementById("model-question-required").checked,
    orderIndex: Number(document.getElementById("model-question-order").value || state.productModelQuestionDraft.length),
    defaultValue: document.getElementById("model-question-default").value || "",
    productionImpact: document.getElementById("model-question-production-impact").value || "",
    deadlineImpactDays: Number(document.getElementById("model-question-deadline").value || 0),
    active: document.getElementById("model-question-active").value !== "false",
    visibleInQuote: document.getElementById("model-question-quote").checked,
    visibleInOrder: document.getElementById("model-question-order-visible").checked,
    visibleInProduction: document.getElementById("model-question-production-visible").checked,
    affectsCost: Number(document.getElementById("model-question-cost").value || 0) > 0,
    costType: document.getElementById("model-question-cost-type").value,
    costValue: Number(document.getElementById("model-question-cost").value || 0),
    costApplication: "add_to_cost"
  });
  ["model-question-label", "model-question-default", "model-question-production-impact", "model-question-options"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("model-question-cost").value = "0";
  document.getElementById("model-question-deadline").value = "0";
  document.getElementById("model-question-order").value = String(state.productModelQuestionDraft.length);
  renderProductModelQuestionDraft();
}

function renderProductModelQuestionDraft() {
  const target = document.getElementById("product-model-question-list");
  if (!target) return;
  target.innerHTML = state.productModelQuestionDraft.map((question, index) => `
    <div class="config-draft-row">
      <div><b>${index + 1}. ${escapeHtml(question.label)}</b><small>${businessLabel(question.answerType || question.type)} | Ordem ${question.orderIndex ?? index} | ${question.required ? "Obrigatoria" : "Opcional"} | ${question.active === false ? "Inativa" : "Ativa"} | ${question.affectsCost ? `${money.format(question.costValue || 0)} (${businessLabel(question.costType)})` : "Sem impacto financeiro"}</small></div>
      <button type="button" data-model-question-action="remove" data-index="${index}">Remover</button>
    </div>
  `).join("") || `<div class="focused-empty-note"><b>Nenhuma pergunta vinculada.</b><span>Adicione perguntas para aparecerem no orçamento e na O.S. quando este modelo for selecionado.</span></div>`;
}

async function saveProductModelQuestions(event) {
  event.preventDefault();
  const form = event.target;
  await api(`/api/products/${form.dataset.productId}/models/${form.dataset.modelId}/questions`, {
    method: "PUT",
    body: { technicalQuestions: state.productModelQuestionDraft }
  });
  state.expandedProductId = form.dataset.productId;
  closeProductQuestionModal();
  await loadAll();
  showToast("Perguntas do modelo salvas.", "success");
}

function fillProductForm(product) {
  document.getElementById("product-code").value = product.code || "";
  document.getElementById("product-name").value = product.name || "";
  document.getElementById("product-description").value = product.description || "";
  if (document.getElementById("product-image-url")) document.getElementById("product-image-url").value = product.imageUrl || "";
  if (document.getElementById("product-attachments")) document.getElementById("product-attachments").value = (product.attachments || product.examples || []).map(item => typeof item === "string" ? item : item.name || item.url || "").filter(Boolean).join(", ");
  document.getElementById("product-category").value = product.category || "Personalizado";
  document.getElementById("product-unit").value = product.unit || "unidade";
  document.getElementById("product-pricing-mode").value = product.pricingMode || (product.unit === "m2" ? "square_meter" : product.unit === "metro_linear" ? "linear_meter" : "unit");
  document.getElementById("product-default-days").value = product.defaultProductionDays || 3;
  document.getElementById("product-base").value = product.minPrice || product.baseValue || 0;
  document.getElementById("product-cost").value = product.baseCostM2 || product.costBase || 0;
  document.getElementById("product-min-margin").value = product.minMarginPercent || 25;
  document.getElementById("product-margin").value = product.marginPercent || 50;
  document.getElementById("product-max-discount").value = product.maxDiscountPercent ?? 10;
  if (document.getElementById("product-commission")) document.getElementById("product-commission").value = product.commissionPercent || 0;
  if (document.getElementById("product-tax")) document.getElementById("product-tax").value = product.taxPercent ?? 6;
  if (document.getElementById("product-production-cost")) document.getElementById("product-production-cost").value = product.productionCost || 0;
  if (document.getElementById("product-installation-cost")) document.getElementById("product-installation-cost").value = product.installationCost || 0;
  if (document.getElementById("product-suggested-price")) document.getElementById("product-suggested-price").value = product.suggestedPrice || product.salePrice || product.minPrice || 0;
  if (document.getElementById("product-manual-final-price")) document.getElementById("product-manual-final-price").value = product.manualFinalPrice || product.salePrice || product.minPrice || 0;
  document.getElementById("product-price-note").value = product.priceNote || "";
  document.getElementById("product-materials").value = (product.materialsUsed || []).join(", ");
  document.getElementById("product-finishes").value = (product.finishes || []).join(", ");
  document.getElementById("product-production-minutes").value = product.averageProductionMinutes || product.technicalSheet?.averageProductionMinutes || 60;
  document.getElementById("product-sectors").value = (product.sectors || product.flow || []).join(", ");
  document.getElementById("product-requires-installation").checked = Boolean(product.requiresInstallation);
  document.getElementById("product-requires-art").checked = Boolean(product.requiresArt);
  document.getElementById("product-requires-approval").checked = Boolean(product.requiresApproval);
  document.getElementById("product-generates-production").checked = product.generatesProduction !== false;
  document.getElementById("product-moves-stock").checked = product.movesStock !== false;
  document.getElementById("product-generates-financial").checked = product.generatesFinancial !== false;
  document.getElementById("product-active").value = product.active === false ? "false" : "true";
  state.productConfigDraft = {
    technicalQuestions: structuredClone(product.technicalQuestions || product.questions || []),
    productionRoute: structuredClone(product.productionRoute || (product.flow || []).map((sectorName, orderIndex) => ({ sectorName, orderIndex })))
  };
  renderProductConfigDraft();
  document.getElementById("product-form").dataset.editingId = product.id;
  document.getElementById("product-name")?.focus();
}

async function softDeleteProduct(id) {
  if (!confirm("Inativar este produto? Orcamentos e O.S. antigos continuam preservados.")) return;
  await api(`/api/products/${id}`, { method: "DELETE" });
  await loadAll();
  showToast("Produto inativado com historico preservado.", "success");
}

function prepareQuoteItemPanel() {
  if (!document.getElementById("quote-item-panel")) {
    document.body.insertAdjacentHTML("beforeend", `
      <aside id="quote-item-panel" class="quote-item-panel" aria-hidden="true">
        <div class="quote-item-panel-head">
          <div><span>Item do orcamento</span><h2>Adicionar produto ou servico</h2><p>Fluxo guiado para medir, personalizar, simular e anexar o item.</p></div>
          <button type="button" id="quote-item-close" title="Fechar">Fechar</button>
        </div>
        <div class="quote-item-panel-body">
          <div class="item-step"><b>1</b><h3>Produto / servico</h3><div class="form-row"><label>Buscar produto<input id="panel-product-search" placeholder="Digite nome, codigo ou categoria"></label><label>Produto<select id="panel-product"></select></label></div><label>Composicao tecnica<select id="panel-composition"></select></label><button type="button" id="panel-new-product" data-view="products">Cadastrar novo produto</button></div>
          <div class="item-step"><b>2</b><h3>Medidas e quantidade</h3><div class="form-row"><label>Quantidade<input id="panel-quantity" type="number" step="1" value="1"></label><label>Unidade<select id="panel-unit"><option>m2</option><option>unidade</option><option>metro linear</option><option>pacote</option></select></label></div><div class="form-row"><label>Largura<input id="panel-width" type="number" step="0.01"></label><label>Altura<input id="panel-height" type="number" step="0.01"></label><label>Espessura<input id="panel-thickness" type="number" step="0.01"></label></div><div id="panel-area" class="small-card">Area calculada: 0 m2</div></div>
          <div class="item-step"><b>3</b><h3>Personalizacao</h3><div class="form-row"><label>Material<input id="panel-material" placeholder="Ex.: Lona 440g"></label><label>Acabamento<input id="panel-finish" placeholder="Ex.: Ilhos e bainha"></label></div><div class="form-row"><label>Laminacao<select id="panel-lamination"><option value="">Nao</option><option>Brilho</option><option>Fosca</option></select></label><label>Recorte<select id="panel-cut"><option value="">Sem recorte</option><option>Recorte eletronico</option><option>Corte laser</option></select></label></div><div class="form-row"><label>Aplicacao<select id="panel-application"><option value="">Somente material</option><option>Aplicado</option><option>Aplicacao externa</option></select></label><label>Instalacao<select id="panel-installation"><option value="false">Nao</option><option value="true">Sim</option></select></label></div><div class="form-row"><label>Arte<select id="panel-art"><option value="">Nao informado</option><option>Cliente envia</option><option>Criar arte</option><option>Arte aprovada</option></select></label><label>Prazo<input id="panel-deadline" type="date"></label><label>Deslocamento (km)<input id="panel-distance" type="number" step="0.1" value="0"></label></div></div>
          <details class="business-details item-checklist" open><summary>Checklist do produto</summary><div id="panel-checklist" class="check-grid"></div></details>
          <div class="item-step"><b>4</b><h3>Preco</h3><div class="form-row"><label>Preco final manual<input id="panel-manual-price" type="number" step="0.01"></label><label>Desconto (%)<input id="panel-discount" type="number" value="0"></label></div><label>Motivo da alteracao<input id="panel-price-reason" placeholder="Explique caso altere o preco sugerido"></label><div id="panel-price-preview" class="price-box">Clique em simular para ver o preco.</div></div>
          <div class="item-step"><b>5</b><h3>Observacoes e arquivos</h3><label>Descricao do trabalho<input id="panel-description" value="Servico personalizado"></label><div class="form-row"><label>Imagens de visualizacao<input id="panel-preview-files" placeholder="mockup.png, foto-local.jpg"></label><label>Arquivos de producao<input id="panel-production-files" placeholder="arte-final.pdf, arquivo.cdr"></label></div><div class="form-row"><label>Obs. cliente<textarea id="panel-client-note"></textarea></label><label>Obs. producao<textarea id="panel-production-note"></textarea></label></div><label>Obs. financeiro<textarea id="panel-finance-note"></textarea></label></div>
        </div>
        <div class="quote-item-panel-footer">
          <button type="button" id="panel-simulate-price">Simular preco</button>
          <button type="button" class="primary" id="panel-add-item">Adicionar item ao orcamento</button>
        </div>
      </aside>
    `);
    document.getElementById("quote-item-close")?.addEventListener("click", closeQuoteItemPanel);
    document.getElementById("panel-product-search")?.addEventListener("input", renderQuoteItemPanelOptions);
    document.getElementById("panel-product")?.addEventListener("change", syncQuoteItemPanelProduct);
    document.getElementById("panel-composition")?.addEventListener("change", syncQuoteItemPanelComposition);
    ["panel-width", "panel-height", "panel-quantity"].forEach(id => document.getElementById(id)?.addEventListener("input", updatePanelArea));
    document.getElementById("panel-new-product")?.addEventListener("click", () => { closeQuoteItemPanel(); view("products"); });
    document.getElementById("panel-simulate-price")?.addEventListener("click", simulateQuoteItemPanel);
    document.getElementById("panel-add-item")?.addEventListener("click", addQuoteItemFromPanel);
  }
  renderQuoteItemPanelOptions();
}

function renderQuoteItemPanelOptions() {
  const productSelect = document.getElementById("panel-product");
  const compositionSelect = document.getElementById("panel-composition");
  if (!productSelect || !compositionSelect) return;
  const search = normalizeUxText(document.getElementById("panel-product-search")?.value || "");
  const products = (state.products || []).filter(product => {
    if (product.active === false) return false;
    return !search || normalizeUxText([product.code, product.name, product.category].join(" ")).includes(search);
  });
  const selectedProduct = productSelect.value || document.getElementById("quote-product")?.value || products[0]?.id || "";
  productSelect.innerHTML = products.map(product => `<option value="${product.id}" ${product.id === selectedProduct ? "selected" : ""}>${product.code || ""} ${product.name}</option>`).join("");
  const compositions = (state.compositions || []).filter(item => !productSelect.value || !item.productId || item.productId === productSelect.value);
  const selectedComposition = compositionSelect.value || document.getElementById("quote-composition")?.value || compositions[0]?.id || "";
  compositionSelect.innerHTML = compositions.map(item => `<option value="${item.id}" ${item.id === selectedComposition ? "selected" : ""}>${item.name} - ${item.category}</option>`).join("");
  syncQuoteItemPanelProduct(false);
}

function syncQuoteItemPanelProduct(resetComposition = true) {
  const product = state.products.find(item => item.id === document.getElementById("panel-product")?.value);
  if (!product) return;
  document.getElementById("panel-unit").value = product.unit || "unidade";
  document.getElementById("panel-material").value = document.getElementById("panel-material").value || (product.materialsUsed || [])[0] || "";
  document.getElementById("panel-finish").value = document.getElementById("panel-finish").value || (product.finishes || [])[0] || "";
  if (product.requiresInstallation) document.getElementById("panel-installation").value = "true";
  if (resetComposition) {
    const composition = state.compositions.find(item => item.productId === product.id);
    if (composition) document.getElementById("panel-composition").value = composition.id;
  }
  renderQuoteItemChecklist();
}

function syncQuoteItemPanelComposition() {
  const composition = state.compositions.find(item => item.id === document.getElementById("panel-composition")?.value);
  if (composition?.productId) {
    document.getElementById("panel-product").value = composition.productId;
    syncQuoteItemPanelProduct(false);
  }
}

function renderQuoteItemChecklist() {
  const product = state.products.find(item => item.id === document.getElementById("panel-product")?.value);
  const composition = state.compositions.find(item => item.id === document.getElementById("panel-composition")?.value);
  const items = checklistForItem(product, composition);
  document.getElementById("panel-checklist").innerHTML = items.map(item => `<label><input type="checkbox" data-panel-check="${item}"> ${item}</label>`).join("") || `<small>Sem checklist obrigatorio para este produto.</small>`;
}

function checklistForItem(product, composition) {
  const name = normalizeUxText(`${product?.name || ""} ${product?.category || ""} ${composition?.name || ""} ${composition?.category || ""}`);
  if (name.includes("acm") || name.includes("fachada")) return ["Medida conferida", "Foto do local anexada", "Estrutura verificada", "Eletrica verificada", "Prazo de montagem combinado"];
  if (name.includes("adesivo")) return ["Local de aplicacao informado", "Superficie conferida", "Medida conferida", "Arte aprovada", "Instalacao externa confirmada"];
  if (name.includes("lona") || name.includes("banner") || name.includes("faixa")) return ["Medidas conferidas", "Acabamento definido", "Ilhos confirmado", "Bainha ou bastao definido", "Arquivo em tamanho correto"];
  if (name.includes("letreiro") || name.includes("luminoso") || name.includes("led")) return ["Pontos de luz definidos", "Fonte/transformador definido", "Eletrica conferida", "Instalacao agendada", "Arte aprovada"];
  return ["Descricao conferida", "Quantidade conferida", "Prazo combinado", "Arquivo ou arte conferido"];
}

function openQuoteItemPanel(preset = {}) {
  prepareQuoteItemPanel();
  const panel = document.getElementById("quote-item-panel");
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  if (preset.productId) document.getElementById("panel-product").value = preset.productId;
  const currentAnswers = collectAnswers();
  const draft = { ...(state.quoteItemDraftAnswers || {}), ...(preset.answers || {}) };
  document.getElementById("panel-product").value = preset.productId || document.getElementById("quote-product")?.value || document.getElementById("panel-product").value;
  document.getElementById("panel-composition").value = preset.compositionId || document.getElementById("quote-composition")?.value || document.getElementById("panel-composition").value;
  document.getElementById("panel-description").value = preset.description || document.getElementById("quote-job")?.value || "Servico personalizado";
  document.getElementById("panel-width").value = preset.answers?.width || currentAnswers.width || "";
  document.getElementById("panel-height").value = preset.answers?.height || currentAnswers.height || "";
  document.getElementById("panel-thickness").value = preset.answers?.thickness || currentAnswers.thickness || "";
  document.getElementById("panel-quantity").value = preset.answers?.quantity || currentAnswers.quantity || 1;
  document.getElementById("panel-manual-price").value = document.getElementById("quote-manual-price")?.value || "";
  document.getElementById("panel-discount").value = document.getElementById("quote-discount")?.value || 0;
  document.getElementById("panel-price-reason").value = document.getElementById("quote-price-reason")?.value || "";
  document.getElementById("panel-preview-files").value = document.getElementById("quote-preview-files")?.value || "";
  document.getElementById("panel-production-files").value = document.getElementById("quote-production-files")?.value || "";
  document.getElementById("panel-client-note").value = document.getElementById("quote-client-note")?.value || "";
  document.getElementById("panel-production-note").value = document.getElementById("quote-production-note")?.value || "";
  document.getElementById("panel-finance-note").value = document.getElementById("quote-finance-note")?.value || "";
  document.getElementById("panel-material").value = draft.material || "";
  document.getElementById("panel-finish").value = draft.finish || "";
  document.getElementById("panel-lamination").value = draft.lamination || "";
  document.getElementById("panel-cut").value = draft.cut || "";
  document.getElementById("panel-application").value = draft.application || "";
  document.getElementById("panel-installation").value = draft.installation === true || draft.installation === "true" ? "true" : "false";
  document.getElementById("panel-art").value = draft.art || "";
  document.getElementById("panel-deadline").value = draft.deadline || "";
  document.getElementById("panel-distance").value = draft.distance_km || 0;
  syncQuoteItemPanelProduct(false);
  (draft.checklist || []).forEach(item => {
    const input = [...document.querySelectorAll("[data-panel-check]")].find(check => check.dataset.panelCheck === item);
    if (input) input.checked = true;
  });
  updatePanelArea();
  document.getElementById("panel-product-search")?.focus();
}

function closeQuoteItemPanel() {
  const panel = document.getElementById("quote-item-panel");
  panel?.classList.remove("open");
  panel?.setAttribute("aria-hidden", "true");
}

function updatePanelArea() {
  const width = Number(document.getElementById("panel-width")?.value || 0);
  const height = Number(document.getElementById("panel-height")?.value || 0);
  const quantity = Number(document.getElementById("panel-quantity")?.value || 1);
  const area = Math.round(width * height * quantity * 100) / 100;
  const target = document.getElementById("panel-area");
  if (target) target.textContent = `Area calculada: ${area} m2`;
}

function applyQuoteItemPanelToForm() {
  const productId = document.getElementById("panel-product")?.value || "";
  const compositionId = document.getElementById("panel-composition")?.value || "";
  if (productId) document.getElementById("quote-product").value = productId;
  if (compositionId) document.getElementById("quote-composition").value = compositionId;
  document.getElementById("quote-job").value = document.getElementById("panel-description").value || "Servico personalizado";
  setAnswerValue("width", document.getElementById("panel-width").value);
  setAnswerValue("height", document.getElementById("panel-height").value);
  setAnswerValue("thickness", document.getElementById("panel-thickness").value);
  setAnswerValue("quantity", document.getElementById("panel-quantity").value || 1);
  document.getElementById("quote-manual-price").value = document.getElementById("panel-manual-price").value || "";
  document.getElementById("quote-discount").value = document.getElementById("panel-discount").value || 0;
  document.getElementById("quote-price-reason").value = document.getElementById("panel-price-reason").value || "";
  document.getElementById("quote-preview-files").value = document.getElementById("panel-preview-files").value || "";
  document.getElementById("quote-production-files").value = document.getElementById("panel-production-files").value || "";
  document.getElementById("quote-client-note").value = document.getElementById("panel-client-note").value || "";
  document.getElementById("quote-production-note").value = document.getElementById("panel-production-note").value || "";
  document.getElementById("quote-finance-note").value = document.getElementById("panel-finance-note").value || "";
  state.quoteItemDraftAnswers = {
    material: document.getElementById("panel-material").value || "",
    finish: document.getElementById("panel-finish").value || "",
    lamination: document.getElementById("panel-lamination").value || "",
    cut: document.getElementById("panel-cut").value || "",
    application: document.getElementById("panel-application").value || "",
    installation: document.getElementById("panel-installation").value === "true",
    art: document.getElementById("panel-art").value || "",
    deadline: document.getElementById("panel-deadline").value || "",
    distance_km: document.getElementById("panel-distance").value || 0,
    checklist: [...document.querySelectorAll("[data-panel-check]:checked")].map(item => item.dataset.panelCheck)
  };
  renderCompositionInfo();
  renderQuestions();
}

function setAnswerValue(key, value) {
  const input = document.querySelector(`#quote [data-answer="${key}"]`);
  if (input) input.value = value;
}

async function simulateQuoteItemPanel() {
  applyQuoteItemPanelToForm();
  await calculateQuoteNow();
  const pricing = state.activeQuotePricing;
  const validation = pricing?.validation || {};
  const target = document.getElementById("panel-price-preview");
  target.innerHTML = pricing ? detailPanel([
    ["Preco sugerido", money.format(pricing.suggestedPrice || 0)],
    ["Preco final", money.format(pricing.finalPrice || pricing.suggestedPrice || 0)],
    ["Preco minimo", money.format(pricing.minPrice || 0)],
    ["Margem", `${validation.marginAtManualPrice ?? pricing.marginPercent ?? 0}%`],
    ["Lucro previsto", money.format(Math.max((pricing.finalPrice || pricing.suggestedPrice || 0) - (pricing.totalCost || 0), 0))],
    ["Saude da venda", quoteHealthLabel(validation.marginStatus)]
  ], { validacao: validation, custos: pricing.costBreakdown }, "Ver memoria do calculo") : "Nao foi possivel simular este item.";
}

async function addQuoteItemFromPanel() {
  await simulateQuoteItemPanel();
  if (!state.activeQuotePricing) {
    showToast("Preencha produto e medidas para adicionar o item.", "warning");
    return;
  }
  state.quoteItems.push(buildQuoteItem(state.activeQuotePricing));
  resetQuoteProductFields();
  renderQuoteItemPreview(null);
  renderQuoteTotals(null);
  renderQuotePricingResult(null);
  closeQuoteItemPanel();
  showToast("Item adicionado ao orcamento.", "success");
}

function quoteHealthLabel(status) {
  if (status === "ideal") return "Saudavel";
  if (status === "abaixo_meta") return "Atencao";
  if (status === "critica") return "Risco";
  return "Em analise";
}

function prepareOperationalChecklists() {
  const questionFields = document.getElementById("question-fields");
  if (questionFields && !document.getElementById("quote-light-checklist")) {
    questionFields.insertAdjacentHTML("afterend", `<details id="quote-light-checklist" class="business-details light-checklist"><summary>Checklist rapido do produto</summary><div id="quote-light-checklist-items" class="check-grid"></div></details>`);
  }
  renderQuoteLightChecklist();
}

function renderQuoteLightChecklist() {
  const target = document.getElementById("quote-light-checklist-items");
  if (!target) return;
  const product = productForQuoteConfiguration();
  const composition = state.compositions.find(item => item.id === document.getElementById("quote-composition")?.value);
  target.innerHTML = checklistForItem(product, composition).map(item => `<label><input type="checkbox"> ${item}</label>`).join("");
}

function syncSelectionActionState() {
  const hasOrder = Boolean(state.activeOrderId || state.orders?.length);
  document.querySelectorAll("[data-needs-selection]").forEach(button => {
    button.disabled = !hasOrder;
    button.title = hasOrder ? (button.title || "Executar na O.S. selecionada.") : "Selecione uma O.S. para liberar esta acao.";
    button.classList.toggle("inactive-action", !hasOrder);
  });
}

function goToSimpleStep(sectionId, direction) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const selector = sectionId === "quote"
    ? ["#quote-customer", "#quote-product", "#question-fields", "#quote-manual-price", ".quote-footer .primary"]
    : ["#order-client-card", "#order-work-grid", "#order-production-grid", "#order-finance-grid", "#order-timeline-full"];
  const current = Number(section.dataset.simpleStep || 0);
  const next = Math.max(0, Math.min(selector.length - 1, current + direction));
  section.dataset.simpleStep = String(next);
  const target = section.querySelector(selector[next]);
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
  target?.focus?.();
  section.querySelectorAll(".ux-flow-strip span").forEach((item, index) => item.classList.toggle("active-step", index === next));
  if (sectionId === "quote") {
    section.querySelectorAll("#quote-guided-wizard button").forEach((item, index) => item.classList.toggle("active-step", index === next));
  }
}

function setTabLabels(sectionId, labels) {
  const buttons = document.querySelectorAll(`#${sectionId} > .module-tabs > button`);
  buttons.forEach((button, index) => {
    const label = labels[index];
    if (!label) {
      button.classList.add("ux-hidden-tab");
      return;
    }
    button.textContent = label;
    button.classList.remove("ux-hidden-tab");
  });
}

function insertFlowStrip(sectionId, steps) {
  const section = document.getElementById(sectionId);
  const tabs = section?.querySelector(":scope > .module-tabs");
  if (!section || !tabs || section.querySelector(":scope > .ux-flow-strip")) return;
  tabs.insertAdjacentHTML("afterend", `<div class="ux-flow-strip">${steps.map((step, index) => `<span><b>${index + 1}</b>${step}</span>`).join("")}</div>`);
}

function markPanelByTitle(sectionId, words, className = "ux-hidden") {
  const normalizedWords = words.map(word => normalizeUxText(word));
  document.querySelectorAll(`#${sectionId} .panel, #${sectionId} .order-section`).forEach(panel => {
    const title = panel.querySelector("h2, h3")?.textContent || "";
    const normalizedTitle = normalizeUxText(title);
    if (normalizedWords.some(word => normalizedTitle.includes(word))) panel.classList.add(className);
  });
}

function normalizeUxText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function renumberOrderSections() {
  const labels = ["Cliente", "Trabalho", "Producao", "Financeiro", "Revisao"];
  document.querySelectorAll("#order-page .order-section:not(.ux-hidden):not(.simple-advanced-panel)").forEach((section, index) => {
    const badge = section.querySelector(".quote-section-title span");
    const title = section.querySelector(".quote-section-title h3");
    if (badge) badge.textContent = String(index + 1);
    if (title && labels[index]) title.textContent = labels[index];
  });
}

function simplifyDashboardUx() {
  setTabLabels("dashboard", ["Visao geral"]);
  document.getElementById("dashboard")?.classList.add("simple-dashboard");
  const quickTitle = document.querySelector("#dashboard #quick-panel")?.closest(".panel")?.querySelector("h2");
  if (quickTitle) quickTitle.textContent = "Acoes rapidas";
  document.querySelectorAll("#dashboard .panel h2").forEach(title => {
    if (normalizeUxText(title.textContent).includes("alert")) title.textContent = "Alertas";
  });
}

function simplifyQuoteUx() {
  document.getElementById("quote")?.classList.add("simple-quote");
  document.querySelectorAll("#quote > .ux-flow-strip, #quote > .simple-helper-bar, #quote-guided-wizard").forEach(node => node.remove());
  document.querySelector("#quote > .module-tabs")?.classList.add("single-screen-hidden");
  document.querySelectorAll("#quote .quote-form-pro > details").forEach(node => node.classList.add("simple-advanced-panel"));
  const quoteCard = document.querySelector("#quote .quote-os-card");
  quoteCard?.classList.add("ux-compact-callout");
  const priceTitle = document.querySelector("#quote .quote-side-panel h2");
  if (priceTitle) priceTitle.textContent = "Preco final";
  prepareQuoteSingleScreenLayout();
}

function prepareQuoteGuidedWizard() {
  const quote = document.getElementById("quote");
  quote?.querySelector("#quote-guided-wizard")?.remove();
}

function simplifyOrdersUx() {
  document.getElementById("orders")?.classList.add("simple-orders");
  document.querySelectorAll("#orders > .ux-flow-strip, #orders > .simple-helper-bar").forEach(node => node.remove());
  document.querySelector("#orders > .module-tabs")?.classList.add("single-screen-hidden");
  document.getElementById("order-page")?.classList.add("order-single-screen");
}

function simplifyProductionUx() {
  document.getElementById("pcp")?.classList.add("simple-production", "production-list-mode");
  setTabLabels("pcp", ["Painel de produção", "Kanban por setor"]);
  document.querySelectorAll("#pcp > .ux-flow-strip, #production-view-toggle").forEach(node => node.remove());
  const tabs = document.querySelector("#pcp > .module-tabs");
  if (tabs && !document.getElementById("production-view-toggle")) {
    tabs.insertAdjacentHTML("afterend", `
      <div class="simple-helper-bar" id="production-view-toggle">
        <div><b>Produção / PCP</b><span>Filtre as O.S., acompanhe prazos e execute a próxima ação do setor.</span></div>
        <button type="button" class="primary" id="production-list-button">Tabela operacional</button>
        <button type="button" id="production-kanban-button">Kanban por setor</button>
        <button type="button" id="production-refresh-button">Atualizar</button>
      </div>
    `);
    document.getElementById("production-list-button")?.addEventListener("click", () => {
      document.getElementById("pcp")?.classList.add("production-list-mode");
      document.getElementById("pcp")?.classList.remove("production-kanban-mode");
    });
    document.getElementById("production-kanban-button")?.addEventListener("click", () => {
      document.getElementById("pcp")?.classList.add("production-kanban-mode");
      document.getElementById("pcp")?.classList.remove("production-list-mode");
    });
    document.getElementById("production-refresh-button")?.addEventListener("click", () => loadAll());
  }
  ["pcp-dashboard-cards", "pcp-board"].forEach(id => document.getElementById(id)?.closest(".panel, .cards, .kanban")?.classList.remove("ux-hidden"));
  ["production-alerts", "capacity-list", "pcp-real-report"].forEach(id => document.getElementById(id)?.closest(".panel")?.classList.add("ux-advanced-panel"));
  [
    "move-sector-form",
    "real-cost-form",
    "problem-form",
    "install-checklist-form",
    "install-team-form",
    "production-event-form"
  ].forEach(id => document.getElementById(id)?.closest(".panel")?.classList.add("ux-hidden"));
  simplifyProductionTable();
}

function simplifyProductionTable() {
  const body = document.getElementById("production-detail-table");
  const table = body?.closest("table");
  if (!body || !table) return;
  table.classList.add("pcp-simple-table", "production-saas-table");
  table.closest(".panel")?.classList.add("production-list-panel");
  table.querySelector("thead").innerHTML = `<tr><th>O.S.</th><th>Cliente</th><th>Servico</th><th>Setor atual</th><th>Responsavel</th><th>Prazo</th><th>Status</th><th>Proxima acao</th><th>Acoes</th></tr>`;
  body.dataset.simpleReady = "true";
}

function simplifyCashUx() {
  setTabLabels("cash", ["Receber", "Venda rapida", "Despesa", "Sangria", "Fechar"]);
  insertFlowStrip("cash", ["Receber", "Venda rapida", "Despesa", "Sangria", "Fechar"]);
  document.getElementById("cash-report-cards")?.closest(".panel")?.classList.add("ux-hidden");
  const saleTitle = document.getElementById("cash-sale-form")?.closest(".panel")?.querySelector("h2");
  if (saleTitle) saleTitle.textContent = "Receber";
  const adjustTitle = document.getElementById("cash-adjust-form")?.closest(".panel")?.querySelector("h2");
  if (adjustTitle) adjustTitle.textContent = "Sangria";
  const blindTitle = document.getElementById("blind-close-form")?.closest(".panel")?.querySelector("h2");
  if (blindTitle) blindTitle.textContent = "Fechar caixa";
}

function simplifyFinanceUx() {
  setTabLabels("finance", ["Receber", "Pagar", "Fiados", "DRE", "Fluxo"]);
  insertFlowStrip("finance", ["Receber", "Pagar", "Fiados", "DRE", "Fluxo"]);
  const dashboardTitle = document.getElementById("finance-dashboard")?.closest(".panel")?.querySelector("h2");
  if (dashboardTitle) dashboardTitle.textContent = "Resumo financeiro";
  markPanelByTitle("finance", ["adiantamento para equipe", "prestacao de contas", "veiculos"], "ux-advanced-panel");
}

function simplifySystemUx() {
  setTabLabels("settings", ["Usuarios", "Permissoes", "Pagamentos", "Funcionarios", "Setores", "Custos", "Produtos", "Logs"]);
  insertFlowStrip("settings", ["Usuarios", "Permissoes", "Pagamentos", "Funcionarios", "Setores", "Custos", "Produtos", "Logs"]);
  document.getElementById("settings")?.classList.add("admin-only-settings");
}

function prepareSystemOperations() {
  const employeeForm = document.getElementById("employee-form");
  if (employeeForm && employeeForm.dataset.expanded !== "true") {
    employeeForm.dataset.expanded = "true";
    employeeForm.classList.remove("inline-form");
    employeeForm.classList.add("system-form-wide");
    employeeForm.innerHTML = `
      <label>Nome<input id="employee-name" placeholder="Nome completo"></label>
      <label>Foto<input id="employee-photo" placeholder="URL ou nome do arquivo"></label>
      <label>Funcao<input id="employee-role" placeholder="Cargo ou funcao"></label>
      <label>Setor<select id="employee-sector"></select></label>
      <label>Salario<input id="employee-salary" type="number" placeholder="Salario"></label>
      <label>Carga horaria<input id="employee-hours" type="number" value="176" placeholder="Horas/mes"></label>
      <label>Comissao (%)<input id="employee-commission" type="number" value="0"></label>
      <label>Telefone<input id="employee-phone" placeholder="Telefone ou WhatsApp"></label>
      <label>E-mail<input id="employee-email" type="email" placeholder="email@empresa.com"></label>
      <label>Data admissao<input id="employee-admission" type="date"></label>
      <label>Status<select id="employee-status"><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
      <button class="primary">Cadastrar funcionario</button>
    `;
  }
  const employeePanel = document.getElementById("employees-table")?.closest(".panel");
  if (employeePanel && !document.getElementById("sector-form")) {
    employeePanel.insertAdjacentHTML("afterend", `
      <div class="panel stack-gap system-sector-panel">
        <h2>Setores</h2>
        <form id="sector-form" class="system-form-wide">
          <label>Nome do setor<input id="sector-name" value="Comercial"></label>
          <label>Responsavel<input id="sector-responsible" value="Joao Victor"></label>
          <label>Usuarios vinculados<input id="sector-users" placeholder="Joao, Ana, Pedro"></label>
          <label>Horario<input id="sector-schedule" value="08:00 as 18:00"></label>
          <label>Capacidade<input id="sector-capacity" placeholder="Ex.: 20 O.S./dia"></label>
          <label>Equipamentos<input id="sector-equipment" placeholder="Plotter, Guilhotina, Computadores"></label>
          <label>Icone<input id="sector-icon" value="processo" placeholder="Ex.: impressora, corte, instalacao"></label>
          <label>Cor<input id="sector-color" type="color" value="#6f0f8f"></label>
          <label>Ordem<input id="sector-order" type="number" value="0"></label>
          <label>Descricao<input id="sector-description" placeholder="O que este setor executa"></label>
          <label>Status<select id="sector-active"><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
          <div class="sector-permissions check-grid" id="sector-permissions"></div>
          <button class="primary">Salvar setor</button>
        </form>
        <div id="sectors-table-wrap"><table><thead><tr><th>Setor</th><th>Ordem</th><th>Responsavel</th><th>Horario</th><th>Capacidade</th><th>Permissoes</th><th>Status</th><th>Acoes</th></tr></thead><tbody id="sectors-table"></tbody></table></div>
      </div>
    `);
    renderSectorPermissionOptions();
    document.getElementById("sector-form")?.addEventListener("submit", saveSector);
    document.getElementById("sectors-table")?.addEventListener("click", handleSectorAction);
  }
  renderSectorOptions();
  renderSectors();
}

function prepareProductOperations() {
  const products = document.getElementById("products");
  if (!products || products.dataset.productFlowReady === "true") return;
  products.dataset.productFlowReady = "true";
  const tabs = products.querySelector(":scope > .module-tabs");
  tabs?.insertAdjacentHTML("afterend", `
    <div class="ux-flow-strip product-flow-strip">
      <span><b>1</b>Produto</span>
      <span><b>2</b>Composicao</span>
      <span><b>3</b>Questionario</span>
      <span><b>4</b>Processo</span>
      <span><b>5</b>Precificacao</span>
    </div>
    <div class="panel product-workflow-note">
      <h2>Fluxo do produto</h2>
      <p>Cadastre o produto, vincule a composicao, configure perguntas, defina o processo produtivo e revise a precificacao sem procurar em telas soltas.</p>
      <div class="action-bar">
        <button type="button" data-view="products">Produto</button>
        <button type="button" data-view="settings">Composicao</button>
        <button type="button" data-view="admin">Questionario</button>
        <button type="button" data-view="settings">Processo e precificacao</button>
      </div>
    </div>
  `);
  products.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => view(button.dataset.view)));
}

function renderSectorPermissionOptions() {
  const target = document.getElementById("sector-permissions");
  if (!target || target.dataset.ready === "true") return;
  target.dataset.ready = "true";
  const options = [
    ["createQuote", "Pode criar orcamento"],
    ["editQuote", "Pode editar orcamento"],
    ["approveQuote", "Pode aprovar orcamento"],
    ["viewCosts", "Pode ver custos"],
    ["viewMargin", "Pode ver margem"],
    ["createOrder", "Pode gerar O.S."],
    ["receivePayment", "Pode receber pagamento"],
    ["openCash", "Pode abrir caixa"],
    ["closeCash", "Pode fechar caixa"],
    ["viewFinance", "Pode ver financeiro"],
    ["viewDre", "Pode ver DRE"],
    ["startProduction", "Pode iniciar producao"],
    ["finishProduction", "Pode finalizar producao"],
    ["movePcp", "Pode mover PCP"],
    ["createProduct", "Pode cadastrar produto"],
    ["editComposition", "Pode editar composicao"],
    ["editQuestionnaire", "Pode editar questionario"]
  ];
  target.innerHTML = options.map(([key, label]) => `<label><input type="checkbox" data-sector-permission="${key}"> ${label}</label>`).join("");
}

function renderSectorOptions() {
  const target = document.getElementById("employee-sector");
  if (!target) return;
  const sectors = state.sectors?.length ? state.sectors : state.costCenters;
  target.innerHTML = sectors.map(sector => `<option value="${sector.name}">${sector.name}</option>`).join("");
}

function renderSectors() {
  const target = document.getElementById("sectors-table");
  if (!target) return;
  target.innerHTML = (state.sectors || []).slice().sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0)).map(sector => `
    <tr>
      <td><b style="color:${sector.color || "#6f0f8f"}">${sector.icon || "processo"} ${sector.name}</b><small>${sector.description || ""}</small></td>
      <td>${sector.orderIndex ?? "-"}</td>
      <td>${sector.responsible || "-"}</td>
      <td>${sector.schedule || "-"}</td>
      <td>${sector.capacity || "-"}</td>
      <td>${Object.values(sector.permissions || {}).filter(Boolean).length} liberacoes</td>
      <td>${sector.active === false ? "Inativo" : "Ativo"}</td>
      <td class="row-actions"><button type="button" data-sector-action="edit" data-sector="${sector.id}">Editar</button><button type="button" data-sector-action="deactivate" data-sector="${sector.id}" ${sector.active === false ? "disabled" : ""}>Inativar</button></td>
    </tr>
  `).join("");
}

async function saveSector(event) {
  event.preventDefault();
  const editingId = event.target.dataset.editingId;
  const permissions = {};
  document.querySelectorAll("[data-sector-permission]").forEach(input => {
    permissions[input.dataset.sectorPermission] = input.checked;
  });
  await api(editingId ? `/api/production-sectors/${editingId}` : "/api/production-sectors", {
    method: editingId ? "PUT" : "POST",
    body: {
      name: document.getElementById("sector-name").value,
      icon: document.getElementById("sector-icon").value,
      color: document.getElementById("sector-color").value,
      orderIndex: Number(document.getElementById("sector-order").value || 0),
      description: document.getElementById("sector-description").value,
      responsible: document.getElementById("sector-responsible").value,
      users: document.getElementById("sector-users").value.split(",").map(item => item.trim()).filter(Boolean),
      schedule: document.getElementById("sector-schedule").value,
      capacity: document.getElementById("sector-capacity").value,
      equipment: document.getElementById("sector-equipment").value.split(",").map(item => item.trim()).filter(Boolean),
      permissions,
      active: document.getElementById("sector-active").value === "true"
    }
  });
  delete event.target.dataset.editingId;
  event.target.reset();
  await loadAll();
}

async function handleSectorAction(event) {
  const button = event.target.closest("[data-sector-action]");
  if (!button) return;
  const sector = state.sectors.find(item => item.id === button.dataset.sector);
  if (!sector) return;
  if (button.dataset.sectorAction === "deactivate") {
    await api(`/api/production-sectors/${sector.id}`, { method: "DELETE" });
    await loadAll();
    return;
  }
  document.getElementById("sector-name").value = sector.name || "";
  document.getElementById("sector-icon").value = sector.icon || "processo";
  document.getElementById("sector-color").value = sector.color || "#6f0f8f";
  document.getElementById("sector-order").value = sector.orderIndex || 0;
  document.getElementById("sector-description").value = sector.description || "";
  document.getElementById("sector-responsible").value = sector.responsible || "";
  document.getElementById("sector-users").value = (sector.users || []).join(", ");
  document.getElementById("sector-schedule").value = sector.schedule || "";
  document.getElementById("sector-capacity").value = sector.capacity || "";
  document.getElementById("sector-equipment").value = (sector.equipment || []).join(", ");
  document.getElementById("sector-active").value = sector.active === false ? "false" : "true";
  document.querySelectorAll("[data-sector-permission]").forEach(input => { input.checked = Boolean(sector.permissions?.[input.dataset.sectorPermission]); });
  document.getElementById("sector-form").dataset.editingId = sector.id;
  document.getElementById("sector-name").focus();
}

function renderDashboardBusinessView() {
  const dashboard = state.dashboard || {};
  const alerts = dashboard.importantAlerts?.length || 0;
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = (state.orders || []).filter(order => String(order.dueDate || "").slice(0, 10) === today).length || dashboard.todayOrders || 0;
  const pendingQuotes = (state.quotes || []).filter(quote => !String(quote.status || "").toLowerCase().includes("aprov")).length || dashboard.todayQuotes || 0;
  prepareDashboardWorkCenter();
  const kpis = [
    dashboardKpi("O.S. para hoje", todayOrders, countStatus(todayOrders, 6, 10), "orders-search"),
    dashboardKpi("O.S. atrasadas", dashboard.lateOrders || 0, countStatus(dashboard.lateOrders, 1, 3), "orders-late"),
    dashboardKpi("Em producao", dashboard.productionRunning || 0, countStatus(dashboard.productionRunning, 8, 15), "production-pcp"),
    dashboardKpi("Aguardando aprovacao", dashboard.awaitingApproval || pendingQuotes, countStatus(dashboard.awaitingApproval || pendingQuotes, 8, 15), "quote"),
    dashboardKpi("Aguardando pagamento", dashboard.awaitingPayment || 0, countStatus(dashboard.awaitingPayment, 1, 5), "cash-receive"),
    dashboardKpi("Proximos 3 dias", dashboard.next3Production || 0, countStatus(dashboard.next3Production, 8, 15), "production-pcp"),
    dashboardKpi("Contas a receber", money.format(dashboard.accountsReceivable || dashboard.pendingReceivables || 0), countStatus(dashboard.accountsReceivable || dashboard.pendingReceivables, 1, 5000), "finance-receivables"),
    dashboardKpi("Faturamento do mes", money.format(dashboard.monthRevenue || dashboard.revenue || 0), revenueStatus(dashboard.monthRevenue || dashboard.revenue), "finance-cashflow")
  ];
  safeSetHTML("dashboard-cards", kpis.join(""), true);

  const quickPanel = document.getElementById("quick-panel");
  if (quickPanel) {
    quickPanel.innerHTML = [
      quickAction("quote", "Novo orcamento", "Criar proposta", "OR"),
      quickAction("orders-new", "Nova O.S.", "Gerar pedido", "OS"),
      quickAction("production-pcp", "Producao", "Conferir PCP", "PC"),
      quickAction("cash-receive", "Caixa", "Receber venda", "CX"),
      quickAction("finance-receivables", "A receber", "Cobrar cliente", "AR"),
      quickAction("finance-payables", "A pagar", "Conferir contas", "AP"),
      quickAction("customers", "Clientes", "Consultar base", "CL"),
      quickAction("stock-products", "Produtos", "Catalogo", "PR"),
      quickAction("reports-orders", "Relatorios", "Analisar dados", "RE")
    ].join("");
  }

  safeSetHTML("important-alerts", dashboardNoticeRows(dashboard, todayOrders, pendingQuotes).join(""), true);
  safeSetHTML("tasks", dashboardTaskRows(dashboard, todayOrders, pendingQuotes).join(""), true);
  safeSetHTML("dashboard-company-widget", dashboardCompanyWidget(dashboard, alerts), true);
  safeSetHTML("dashboard-operational-summary", dashboardOperationalSummary(dashboard, todayOrders, pendingQuotes), true);
  document.querySelectorAll("#dashboard [data-view]").forEach(button => button.addEventListener("click", () => view(button.dataset.view, button)));
}

function prepareDashboardWorkCenter() {
  const dashboard = document.getElementById("dashboard");
  if (!dashboard || dashboard.dataset.workCenterReady === "true") return;
  dashboard.dataset.workCenterReady = "true";
  dashboard.classList.add("dashboard-work-center");
  dashboard.innerHTML = `
    <section class="home-work-center">
      <div class="home-main">
        <section class="home-welcome-card">
          <div class="home-avatar">${userInitials()}</div>
          <div>
            <span>PrintSys ERP</span>
            <h1>Welcome back, ${escapeHtml(state.user?.name || "Joao Victor")}</h1>
            <p id="dashboard-operational-summary">Carregando resumo operacional...</p>
          </div>
        </section>
        <section class="home-panel">
          <div class="home-section-head"><div><span>Acesso rapido</span><h2>Comece o trabalho</h2></div></div>
          <div id="quick-panel" class="home-shortcuts"></div>
        </section>
        <section class="home-panel">
          <div class="home-section-head"><div><span>Avisos</span><h2>Alertas e pendencias</h2></div><button type="button" data-view="notifications-center">Ver notificacoes</button></div>
          <div id="important-alerts" class="home-notices"></div>
        </section>
      </div>
      <aside class="home-side">
        <section class="home-panel home-kpi-panel">
          <div class="home-section-head"><div><span>Indicadores</span><h2>Resumo compacto</h2></div></div>
          <div id="dashboard-cards" class="home-kpi-strip"></div>
        </section>
        <section id="dashboard-company-widget" class="home-company-widget"></section>
        <section class="home-panel">
          <div class="home-section-head"><div><span>Tarefas</span><h2>O que fazer agora</h2></div></div>
          <div id="tasks" class="home-tasks"></div>
        </section>
      </aside>
    </section>
  `;
}

function userInitials() {
  return (state.user?.name || "Joao Victor").split(" ").filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "JV";
}

function dashboardOperationalSummary(dashboard = {}, todayOrders = 0, pendingQuotes = 0) {
  const date = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const store = state.currentCompanyName || state.companySettings?.name || "Loja Principal";
  const late = dashboard.lateOrders || 0;
  const running = dashboard.productionRunning || 0;
  return `${store} - ${date}. Hoje voce tem ${todayOrders} O.S. para acompanhar, ${running} em producao, ${pendingQuotes} aprovacao(oes) pendente(s) e ${late} atraso(s) pedindo atencao.`;
}

function dashboardKpi(title, value, status = "ok", target = "dashboard") {
  return `
    <button type="button" class="home-kpi status-${status}" data-view="${target}">
      <span>${title}</span>
      <b>${value}</b>
      <small>${managerStatusLabel(status)}</small>
    </button>
  `;
}

function quickAction(target, title, subtitle, icon = "PS") {
  return `<button type="button" class="quick-action" data-view="${target}"><i>${icon}</i><b>${title}</b><span>${subtitle}</span></button>`;
}

function dashboardNoticeRows(dashboard = {}, todayOrders = 0, pendingQuotes = 0) {
  const rows = (dashboard.importantAlerts || []).slice(0, 5).map(alert => ({
    title: businessLabel(alert.type),
    text: alert.message || "Verifique este ponto antes de avancar.",
    severity: alert.severity || "warning",
    view: dashboardAlertView(alert)
  }));
  if (dashboard.lateOrders) rows.push({ title: "O.S. atrasadas", text: `${dashboard.lateOrders} pedido(s) fora do prazo combinado.`, severity: "red", view: "orders-late" });
  if (dashboard.awaitingPayment) rows.push({ title: "Pagamentos pendentes", text: `${dashboard.awaitingPayment} O.S. aguardando sinal, pagamento ou liberacao.`, severity: "yellow", view: "cash-receive" });
  if (dashboard.pendingVisits) rows.push({ title: "Visitas pendentes", text: `${dashboard.pendingVisits} visita(s) aguardando conclusao ou reagendamento.`, severity: "yellow", view: "visits-open" });
  if (pendingQuotes) rows.push({ title: "Aprovacoes comerciais", text: `${pendingQuotes} proposta(s) ou O.S. dependem de aprovacao.`, severity: "green", view: "quote" });
  if (!rows.length) rows.push({ title: "Operacao em ordem", text: "Nenhum alerta critico encontrado agora.", severity: "green", view: "dashboard" });
  return rows.slice(0, 7).map(item => `
    <button type="button" class="home-notice ${item.severity}" data-view="${item.view}">
      <b>${item.title}</b>
      <span>${item.text}</span>
      <small>Abrir modulo</small>
    </button>
  `);
}

function dashboardTaskRows(dashboard = {}, todayOrders = 0, pendingQuotes = 0) {
  const running = dashboard.productionRunning || 0;
  const receivable = dashboard.accountsReceivable || dashboard.pendingReceivables || 0;
  const rows = [
    { title: "Producao", text: running ? `${running} trabalho(s) em execucao para acompanhar.` : "Conferir fila e liberar proximas O.S.", view: "production-pcp", tag: "PCP" },
    { title: "Financeiro", text: receivable ? `${money.format(receivable)} em contas a receber.` : "Conferir recebimentos do dia.", view: "finance-receivables", tag: "R$" },
    { title: "Clientes", text: "Revisar retornos, visitas e contatos pendentes.", view: "commercial", tag: "CRM" },
    { title: "Aprovacoes", text: pendingQuotes ? `${pendingQuotes} proposta(s) aguardando decisao.` : "Sem aprovacao critica agora.", view: "quote", tag: "OK" },
    { title: "Agenda", text: dashboard.pendingVisits ? `${dashboard.pendingVisits} visita(s) para ajustar.` : "Organizar visitas tecnicas da semana.", view: "visits-agenda", tag: "AG" }
  ];
  return rows.map(item => `
    <button type="button" class="home-task" data-view="${item.view}">
      <i>${item.tag}</i>
      <span><b>${item.title}</b><small>${item.text}</small></span>
    </button>
  `);
}

function dashboardCompanyWidget(dashboard = {}, alerts = 0) {
  const store = state.currentCompanyName || state.companySettings?.name || "Loja Principal";
  const role = state.user?.role || "Admin/Gestor";
  const totalRecords = (state.orders?.length || 0) + (state.quotes?.length || 0) + (state.customers?.length || 0) + (state.products?.length || 0);
  const progress = Math.min(100, Math.max(12, Math.round((totalRecords / 180) * 100)));
  const status = alerts || dashboard.lateOrders ? "Atencao operacional" : "Sistema estavel";
  return `
    <div class="home-company-head">
      <span>Empresa</span>
      <h2>${escapeHtml(store)}</h2>
      <p>${escapeHtml(role)} - ${status}</p>
    </div>
    <div class="home-company-progress"><span style="width:${progress}%"></span></div>
    <div class="home-company-grid">
      <div><span>Clientes</span><b>${state.customers?.length || 0}</b></div>
      <div><span>Produtos</span><b>${state.products?.length || 0}</b></div>
      <div><span>O.S.</span><b>${state.orders?.length || 0}</b></div>
      <div><span>Alertas</span><b>${alerts}</b></div>
    </div>
  `;
}

function dashboardAlertView(alert) {
  const type = normalizeUxText(alert?.type || alert?.origin || "");
  const message = normalizeUxText(alert?.message || "");
  if (type.includes("caixa") || message.includes("caixa")) return "cash";
  if (type.includes("finance") || type.includes("fiado") || message.includes("pagamento") || message.includes("receber")) return "finance";
  if (type.includes("estoque") || type.includes("material")) return "products";
  if (type.includes("orcamento")) return "quote";
  if (type.includes("produc") || type.includes("pcp") || message.includes("setor")) return "pcp";
  return "orders";
}

function dashboardList(title, rows, mapper) {
  const items = (rows || []).slice(0, 5);
  return `
    <div class="dashboard-list">
      <h3>${title}</h3>
      ${items.length ? items.map(item => `<div class="dashboard-list-row">${mapper(item)}</div>`).join("") : `<div class="empty-state">Nenhum registro encontrado.</div>`}
    </div>
  `;
}

function managerStatusLabel(status) {
  return { ok: "OK", warning: "Atenção", critical: "Crítico" }[status] || "OK";
}

function managerCard(title, value, status, description, targetView = "") {
  const safeStatus = status || "ok";
  const tag = targetView ? "button" : "div";
  const attrs = targetView ? ` type="button" data-view="${targetView}"` : "";
  return `
    <${tag}${attrs} class="small-card manager-card status-${safeStatus}${targetView ? " manager-card-link" : ""}">
      <div class="manager-card-head">
        <b>${title}</b>
        <span>${managerStatusLabel(safeStatus)}</span>
      </div>
      <strong>${value}</strong>
      <small>${description}</small>
    </${tag}>
  `;
}

function countStatus(value, warningAt = 1, criticalAt = 3) {
  const number = Number(value || 0);
  if (number >= criticalAt) return "critical";
  if (number >= warningAt) return "warning";
  return "ok";
}

function cashStatus(value) {
  const number = Number(value || 0);
  if (number < 0) return "critical";
  if (number < 1000) return "warning";
  return "ok";
}

function revenueStatus(value) {
  const number = Number(value || 0);
  if (number <= 0) return "warning";
  return "ok";
}

function bottleneckStatus(item, criticalAt = 5) {
  if (!item || Number(item.value || 0) <= 0) return "ok";
  if (Number(item.value || 0) >= criticalAt) return "critical";
  return "warning";
}

function bottleneckValue(item, empty = "Sem ocorrencias") {
  if (!item || Number(item.value || 0) <= 0) return empty;
  return `${item.name} (${item.value})`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function businessLabel(key) {
  const map = {
    order_payment: "Pagamento de O.S.",
    quick_sale: "Venda rápida",
    cashMovement: "Movimentação do caixa",
    costCenter: "Centro de custo",
    grossProfit: "Lucro bruto",
    marginPercent: "Margem",
    realCost: "Custo real",
    predictedCost: "Custo previsto",
    lateOrders: "O.S. atrasadas",
    ordersMade: "O.S. feitas",
    ordersBilled: "O.S. faturadas",
    pendingPaymentOrders: "O.S. pendentes de pagamento",
    signalOrders: "O.S. com sinal",
    pix: "Pix",
    credit: "Crédito",
    debit: "Débito",
    cash: "Dinheiro",
    boleto: "Boleto",
    fiado: "Fiado",
    openTotal: "Total em aberto",
    receivedTotal: "Total recebido",
    predictedTotal: "Total previsto",
    expectedByMethod: "Previsão por forma de pagamento",
    receivedToday: "Recebido hoje",
    receivedMonth: "Recebido no mês",
    receivable: "A receber",
    payable: "A pagar",
    profitEstimated: "Lucro previsto",
    profitRealized: "Lucro realizado",
    expenses: "Despesas",
    cashBalance: "Saldo do caixa",
    inflows: "Entradas",
    outflows: "Saídas",
    balance: "Saldo",
    projected: "Saldo projetado",
    revenue: "Receita",
    productionCosts: "Custos de produção",
    installationCosts: "Custos de instalação",
    operationalExpenses: "Despesas operacionais",
    administrativeExpenses: "Despesas administrativas",
    result: "Resultado",
    weekRevenue: "Faturamento previsto esta semana",
    monthRevenue: "Faturamento previsto este mês",
    cash7Days: "Caixa previsto para os próximos 7 dias",
    cash30Days: "Caixa previsto para os próximos 30 dias",
    lateSector: "Setor com mais atrasos",
    pauseStep: "Produções paradas",
    reworkSector: "Retrabalhos da semana",
    machineOccupancy: "Setor mais carregado",
    overloadedInstallationTeam: "Equipe de instalação mais ocupada",
    topCustomers: "Clientes que mais compram",
    topProducts: "Produtos mais vendidos",
    topSellers: "Vendedores com melhor resultado",
    lowMarginProducts: "Produtos abaixo da margem",
    overdueCustomers: "Clientes em atraso",
    cashDivergence: "Diferença no caixa",
    billed: "Faturada",
    pending: "Pendente",
    paid: "Recebida",
    unpaid: "Nao recebida",
    billed_external: "Ja faturada",
    entered_cash: "Lancada no caixa",
    pending_cash: "Aguardando caixa",
    none: "Sem impacto no caixa",
    bill_now: "Faturar agora",
    already_billed: "Ja faturada"
  };
  if (map[key]) return map[key];
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bid\b/gi, "código")
    .replace(/\bapi\b/gi, "integração")
    .replace(/\bos\b/gi, "O.S.")
    .trim()
    .replace(/^./, char => char.toUpperCase());
}

function businessDescription(key) {
  const map = {
    ordersMade: "Quantidade de O.S. registradas no período.",
    ordersBilled: "O.S. que já foram faturadas no caixa.",
    pendingPaymentOrders: "Pedidos que ainda precisam de recebimento.",
    signalOrders: "Pedidos com entrada ou sinal registrado.",
    pix: "Entradas recebidas por Pix.",
    credit: "Entradas recebidas no cartão de crédito.",
    debit: "Entradas recebidas no cartão de débito.",
    cash: "Entradas recebidas em dinheiro.",
    fiado: "Valores vendidos para pagamento futuro.",
    openTotal: "Saldo ainda em aberto.",
    receivedTotal: "Total já recebido no caixa.",
    predictedTotal: "Valor previsto somando recebido e pendências.",
    receivedToday: "Entradas confirmadas hoje.",
    receivedMonth: "Entradas confirmadas no mês.",
    receivable: "Valores que a empresa ainda tem para receber.",
    payable: "Compromissos que ainda precisam ser pagos.",
    profitEstimated: "Lucro previsto com base nos custos calculados.",
    profitRealized: "Lucro apurado com os custos reais.",
    expenses: "Saídas financeiras registradas.",
    cashBalance: "Saldo atual considerando entradas e saídas.",
    inflows: "Entradas financeiras do período.",
    outflows: "Saídas financeiras do período.",
    balance: "Resultado entre entradas e saídas.",
    projected: "Previsão de saldo para os próximos dias."
  };
  return map[key] || "Indicador consolidado para acompanhamento gerencial.";
}

function readableValue(key, value) {
  if (value && typeof value === "object") return formatSummaryValue(value);
  if (typeof value !== "number") return value ?? "-";
  const moneyKeys = ["pix", "credit", "debit", "cash", "boleto", "fiado", "openTotal", "receivedTotal", "predictedTotal", "receivedToday", "receivedMonth", "receivable", "payable", "profitEstimated", "profitRealized", "expenses", "cashBalance", "inflows", "outflows", "balance", "projected", "revenue", "productionCosts", "installationCosts", "operationalExpenses", "administrativeExpenses", "result"];
  return moneyKeys.includes(key) ? money.format(value) : value;
}

function numericTotal(value) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") return Object.values(value).reduce((sum, item) => sum + Number(item || 0), 0);
  return Number(value || 0);
}

function detailPanel(rows, raw, title = "Ver detalhes") {
  const summary = rows.map(([label, value]) => `<div class="small-card"><b>${label}</b><span>${value}</span></div>`).join("");
  const details = raw ? `<details class="business-details"><summary>${title}</summary>${formatRawDetails(raw)}</details>` : "";
  return `<div class="mini-grid">${summary}</div>${details}`;
}

function formatRawDetails(raw) {
  if (!raw || typeof raw !== "object") return `<p>${escapeHtml(raw ?? "-")}</p>`;
  return `<div class="details-list">${Object.entries(raw).map(([key, value]) => {
    const content = value && typeof value === "object" ? formatSummaryValue(value) : value ?? "-";
    return `<div><b>${businessLabel(key)}</b><span>${escapeHtml(content)}</span></div>`;
  }).join("")}</div>`;
}

function renderIntelligence() {
  const snapshot = state.intelligence || {};
  const data = snapshot.data || {};
  const summary = data.summary?.today || {};
  const predictions = data.predictions || {};
  const bottlenecks = data.bottlenecks || {};
  document.getElementById("intel-last-update").textContent = `Ultima atualizacao: ${snapshot.generatedAt || "sem snapshot"}`;
  document.getElementById("intel-greeting").textContent = data.summary?.greeting || "Central pronta para consolidar dados.";
  document.getElementById("intel-summary").innerHTML = [
    managerCard("O.S. atrasadas", summary.lateOrders || 0, countStatus(summary.lateOrders, 1, 3), "Pedidos fora do prazo precisam de acompanhamento imediato."),
    managerCard("Produções paradas", summary.stoppedProduction || 0, countStatus(summary.stoppedProduction, 1, 2), "Mostra trabalhos pausados ou sem evolução na produção."),
    managerCard("Clientes inadimplentes", summary.delinquentCustomers || 0, countStatus(summary.delinquentCustomers, 1, 5), "Clientes com pagamentos vencidos ou fiado em atraso."),
    managerCard("Caixa previsto para os próximos 7 dias", money.format(summary.predictedCash || 0), cashStatus(summary.predictedCash), "Saldo projetado considerando entradas e saídas próximas."),
    managerCard("Faturamento previsto", money.format(summary.predictedRevenue || 0), revenueStatus(summary.predictedRevenue), "Estimativa baseada em vendas, O.S. e recebimentos previstos."),
    managerCard("Instalações do dia", summary.todayInstallations || 0, countStatus(summary.todayInstallations, 4, 7), "Volume de instalações agendadas para hoje."),
    managerCard("Alertas críticos", summary.criticalAlerts || 0, countStatus(summary.criticalAlerts, 1, 2), "Situações que exigem decisão do gestor.")
  ].join("");
  document.getElementById("intel-alerts").innerHTML = (data.alerts || []).filter(alert => alert.severity === "CRITICO").slice(0, 8).map(alert => `<div class="alert red"><b>${alert.type}</b><span>${alert.description}</span><small>${alert.origin} | ${alert.status}</small></div>`).join("") || "<p>Sem alertas criticos.</p>";
  document.getElementById("intel-suggestions").innerHTML = (data.suggestions || []).map(item => `<div class="small-card"><b>${item.type}</b><span>${item.description}</span>${item.targetView ? `<button type="button" data-assistant-view="${escapeHtml(item.targetView)}">Abrir tela relacionada</button>` : ""}</div>`).join("") || "<p>Sem sugestões no snapshot.</p>";
  document.getElementById("intel-predictions").innerHTML = [
    managerCard("Faturamento previsto esta semana", money.format(predictions.weekRevenue || 0), revenueStatus(predictions.weekRevenue), "Previsão comercial para a semana com base nos dados consolidados."),
    managerCard("Faturamento previsto este mês", money.format(predictions.monthRevenue || 0), revenueStatus(predictions.monthRevenue), "Projeção mensal de receitas esperadas."),
    managerCard("Caixa previsto para os próximos 7 dias", money.format(predictions.cash7Days || 0), cashStatus(predictions.cash7Days), "Saldo esperado no curto prazo depois de entradas e saídas."),
    managerCard("Caixa previsto para os próximos 30 dias", money.format(predictions.cash30Days || 0), cashStatus(predictions.cash30Days), "Visão de fôlego financeiro para o mês.")
  ].join("");
  document.getElementById("intel-bottlenecks").innerHTML = [
    managerCard("Setor com mais atrasos", bottleneckValue(bottlenecks.lateSector, "Nenhum setor atrasado"), bottleneckStatus(bottlenecks.lateSector), "Indica onde os prazos estão concentrando mais risco."),
    managerCard("Produções paradas", bottleneckValue(bottlenecks.pauseStep, "Nenhuma produção parada"), bottleneckStatus(bottlenecks.pauseStep, 3), "Etapa com maior quantidade de trabalhos pausados."),
    managerCard("Retrabalhos da semana", bottleneckValue(bottlenecks.reworkSector, "Sem retrabalho relevante"), bottleneckStatus(bottlenecks.reworkSector, 3), "Mostra onde houve mais repetição de serviço."),
    managerCard("Setor mais carregado", bottleneckValue(bottlenecks.machineOccupancy, "Carga normal"), bottleneckStatus(bottlenecks.machineOccupancy, 80), "Aponta o setor com maior ocupação operacional."),
    managerCard("Equipe de instalação mais ocupada", bottleneckValue(bottlenecks.overloadedInstallationTeam, "Sem sobrecarga"), bottleneckStatus(bottlenecks.overloadedInstallationTeam, 5), "Ajuda a prever atrasos em entregas externas.")
  ].join("");
  document.getElementById("intel-production").innerHTML = [
    ["Risco de atraso", (data.production?.delayRisk || []).map(item => `${item.orderId}: ${item.risk}`).join(" | ") || "Sem dados"],
    ["Setor com atencao", data.production?.bottleneckSector ? `${data.production.bottleneckSector.name}: ${data.production.bottleneckSector.value}` : "Sem gargalo"],
    ["Setor mais carregado", data.production?.overloadedMachine ? `${data.production.overloadedMachine.name}: ${data.production.overloadedMachine.value}` : "Sem dado"],
    ["Retrabalho recorrente", data.production?.recurringReworkProduct ? `${data.production.recurringReworkProduct.name}` : "Sem retrabalho"],
    ["O.S. parada", (data.production?.stoppedOrders || []).length]
  ].map(item => `<div class="small-card"><b>${item[0]}</b><span>${item[1]}</span></div>`).join("");
  document.getElementById("intel-financial").innerHTML = [
    ["Clientes de risco", (data.financial?.customerRisk || []).map(item => `${item.customerName}: ${item.score}`).join(" | ") || "Sem dados"],
    ["Produtos abaixo da margem", (data.financial?.productLowMargin || []).length],
    ["Custos acima da media", (data.financial?.costAboveAverage || []).length],
    ["Despesas fora do padrao", (data.financial?.unusualExpenses || []).length],
    ["Queda faturamento", data.financial?.revenueDrop ? "Sim" : "Nao"]
  ].map(item => `<div class="small-card"><b>${item[0]}</b><span>${item[1]}</span></div>`).join("");
  document.getElementById("intel-analytics").innerHTML = [
    ["Clientes analisados", (state.analytics.customers || data.analytics?.customers || []).length],
    ["Produtos analisados", (state.analytics.products || data.analytics?.products || []).length],
    ["Financeiro", state.analytics.financial?.trend || data.analytics?.financial?.trend || "Sem snapshot"],
    ["Produtividade", state.analytics.production?.productivity ?? data.analytics?.production?.productivity ?? 0]
  ].map(item => `<div class="small-card"><b>${item[0]}</b><span>${item[1]}</span></div>`).join("");
  document.getElementById("pref-theme").value = state.preferences.theme || "light";
  document.getElementById("pref-favorites").value = (state.preferences.favorites || []).join(",");
  document.getElementById("pref-shortcuts").value = (state.preferences.shortcuts || []).join(",");
  document.getElementById("pref-widgets").value = (state.preferences.dashboardWidgets || []).join(",");
}

function renderCommercial() {
  const crm = state.crm || {};
  const leads = crm.leads || [];
  document.getElementById("follow-lead").innerHTML = leads.map(lead => `<option value="${lead.id}">${lead.name} - ${lead.status}</option>`).join("");
  document.getElementById("convert-lead").innerHTML = leads.map(lead => `<option value="${lead.id}">${lead.name} - ${lead.interest}</option>`).join("");
  document.getElementById("convert-product").innerHTML = state.products.map(product => `<option value="${product.id}">${product.code || ""} ${product.name}</option>`).join("");
  document.getElementById("convert-composition").innerHTML = state.compositions.map(item => `<option value="${item.id}">${item.name}</option>`).join("");
  const stages = crm.funnelStages || ["novo", "em atendimento", "orcamento solicitado", "orcamento enviado", "aguardando aprovacao", "fechado", "perdido"];
  document.getElementById("sales-funnel").innerHTML = stages.map(stage => `
    <div class="column">
      <h3>${stage}</h3>
      ${leads.filter(lead => lead.status === stage).map(lead => `
        <div class="job">
          <b>${lead.name}</b>
          <p>${lead.phone || lead.whatsapp || ""}</p>
          <small>${lead.origin} | ${lead.seller}</small>
          <small>${money.format(Number(lead.estimatedValue || 0))}</small>
          <small>Retorno: ${lead.nextContactAt ? lead.nextContactAt.slice(0, 16).replace("T", " ") : "sem agenda"}</small>
        </div>
      `).join("") || "<p>Sem cards.</p>"}
    </div>
  `).join("");
  document.getElementById("commercial-alerts").innerHTML = (crm.alerts || []).map(alert => `<div class="alert ${alert.severity}"><b>${alert.type}</b><span>${alert.message}</span></div>`).join("") || "<p>Sem alertas comerciais.</p>";
  document.getElementById("seller-goals").innerHTML = (crm.sellerGoals || []).map(goal => `
    <div class="small-card">
      <b>${goal.seller}</b>
      <span>Vendido: ${money.format(goal.sold || 0)}</span>
      <small>Recebido: ${money.format(goal.received || 0)}</small>
      <small>Falta meta: ${money.format(goal.missingMonthly || 0)}</small>
      <small>Conversao: ${goal.conversionRate || 0}%</small>
      <small>Comissao liberada: ${money.format(goal.commissionReleased || 0)}</small>
    </div>
  `).join("");
  const report = crm.report || {};
  document.getElementById("commercial-report").innerHTML = [
    ["Leads por origem", formatCountObject(report.byOrigin)],
    ["Conversao por vendedor", Object.entries(report.bySeller || {}).map(([seller, item]) => `${seller}: ${item.closed}/${item.leads}`).join(" | ") || "Sem dados"],
    ["Orcamentos enviados", report.sentQuotes || 0],
    ["Orcamentos aprovados", report.approvedQuotes || 0],
    ["Valor em negociacao", money.format(report.negotiationValue || 0)],
    ["Taxa fechamento", `${report.closingRate || 0}%`],
    ["Ticket medio", money.format(report.averageTicket || 0)],
    ["Motivos de perda", formatCountObject(report.lossReasons)]
  ].map(item => `<div class="small-card"><b>${item[0]}</b><span>${item[1]}</span></div>`).join("");
  document.getElementById("lead-table").innerHTML = leads.map(lead => `
    <tr>
      <td>${lead.name}</td><td>${lead.origin}</td><td>${lead.seller}</td><td>${lead.interest}</td>
      <td>${money.format(Number(lead.estimatedValue || 0))}</td>
      <td>${lead.nextContactAt ? lead.nextContactAt.slice(0, 16).replace("T", " ") : ""}</td><td><span class="status">${lead.status}</span></td>
    </tr>
  `).join("");
}

function renderPortal() {
  const data = state.portalData || { quotes: [], orders: [], timeline: [], customer: {} };
  document.getElementById("portal-token").value = state.portalToken;
  document.getElementById("portal-upload-quote").innerHTML = `<option value="">Sem orcamento</option>` + (data.quotes || []).map(quote => `<option value="${quote.id}">${quote.quoteNumber}</option>`).join("");
  document.getElementById("portal-upload-order").innerHTML = `<option value="">Sem O.S.</option>` + (data.orders || []).map(order => `<option value="${order.id}">${order.id}</option>`).join("");
  document.getElementById("portal-quotes").innerHTML = (data.quotes || []).map(quote => `
    <div class="job">
      <b>${quote.quoteNumber} - ${quote.jobName}</b>
      <p>${money.format(Number(quote.total || 0))} | ${quote.status}</p>
      <small>Arte: ${quote.artApprovalStatus}</small>
      <div class="tabs-inline"><button data-portal-approve="${quote.id}">Aprovar</button><button data-portal-adjust="${quote.id}">Solicitar ajuste</button></div>
    </div>
  `).join("") || "<p>Nenhum orcamento neste portal.</p>";
  document.getElementById("portal-orders").innerHTML = (data.orders || []).map(order => `
    <div class="job">
      <b>${order.id} - ${order.product}</b>
      <p>${order.status} | Prazo ${order.dueDate}</p>
      <small>Total: ${money.format(order.payments.total)} | Recebido: ${money.format(order.payments.received)} | Saldo: ${money.format(order.payments.balance)}</small>
      <div class="tabs-inline"><button data-art-approve="${order.id}">Aprovar arte</button><button data-art-adjust="${order.id}">Ajuste na arte</button></div>
    </div>
  `).join("") || "<p>Nenhuma O.S. neste portal.</p>";
  document.getElementById("portal-timeline").innerHTML = (data.timeline || []).map(item => `<div><b>${item.action}</b><small>${item.at}</small><p>${item.details || ""}</p></div>`).join("") || "<p>Sem eventos liberados.</p>";
}

function renderAIAssistantPanel() {
  renderIntelligence();
}

function navigateFromAssistant(targetView) {
  if (!targetView || !document.getElementById(targetView) || !canOpenView(targetView)) return false;
  view(targetView);
  return true;
}

function renderBI() {
  const bi = state.biData || {};
  const dashboard = bi.dashboard || {};
  document.getElementById("bi-dashboard").innerHTML = Object.entries(dashboard).map(([key, value]) => managerCard(businessLabel(key), readableValue(key, value), key.toLowerCase().includes("late") || key.toLowerCase().includes("overdue") ? countStatus(value, 1, 3) : "ok", businessDescription(key))).join("");
  const profit = bi.profitability || {};
  document.getElementById("bi-profitability").innerHTML = [
    ["Lucro por O.S.", topList(profit.byOrder)],
    ["Lucro por produto", topList(profit.byProduct)],
    ["Lucro por cliente", topList(profit.byCustomer)],
    ["Lucro por vendedor", topList(profit.bySeller)],
    ["Lucro por centro de custo", topList(profit.byCostCenter)],
    ["Produtos com prejuizo", (profit.lossProducts || []).map(item => `${item.product}: ${money.format(item.loss)}`).join(" | ") || "Sem prejuizo"],
    ["Servicos com retrabalho", (profit.reworkServices || []).map(item => `${item.orderId}: ${item.reworks}`).join(" | ") || "Sem retrabalho"]
  ].map(item => `<div class="small-card"><b>${item[0]}</b><span>${item[1]}</span></div>`).join("");
  const rankings = bi.rankings || {};
  document.getElementById("bi-rankings").innerHTML = Object.entries(rankings).map(([key, value]) => managerCard(businessLabel(key), topList(value), "ok", "Ranking consolidado para apoiar decisões comerciais e operacionais.")).join("");
  document.getElementById("bi-alerts").innerHTML = (bi.alerts || []).map(alert => `<div class="alert ${alert.severity === "CRITICO" ? "red" : "yellow"}"><b>${businessLabel(alert.type)}</b><span>${alert.description}</span><small>Ação sugerida: conferir ${businessLabel(alert.module)} e definir responsável. Status: ${alert.status}</small></div>`).join("") || "<p>Sem alertas inteligentes.</p>";
  document.getElementById("bi-predictions").innerHTML = Object.entries(bi.predictions || {}).map(([key, value]) => managerCard(businessLabel(key), Array.isArray(value) ? `${value.length} item(ns)` : money.format(Number(value || 0)), key.toLowerCase().includes("cash") ? cashStatus(value) : revenueStatus(value), businessDescription(key))).join("");
  document.getElementById("bi-bottlenecks").innerHTML = Object.entries(bi.bottlenecks || {}).map(([key, value]) => managerCard(businessLabel(key), value ? `${value.name} (${value.value})` : "Sem ocorrência", bottleneckStatus(value), "Mostra onde a gestão deve agir para evitar atraso, retrabalho ou perda de margem.")).join("");
}

function renderIntegrations() {
  const data = state.integrations || {};
  document.getElementById("integration-customer").innerHTML = state.customers.map(customer => `<option value="${customer.id}">${customer.name}</option>`).join("");
  document.getElementById("integration-connectors").innerHTML = (data.connectors || []).map(item => `<div class="small-card"><b>${item.name}</b><span>${item.type} | ${item.status}</span><small>${(item.events || []).join(", ")}</small></div>`).join("");
  document.getElementById("integration-webhooks").innerHTML = (data.webhooks || []).map(item => `<div class="small-card"><b>${item.event}</b><span>${item.status}</span><small>${item.url}</small></div>`).join("");
  document.getElementById("integration-backups").innerHTML = (data.backups || []).map(item => `<div class="small-card"><b>${item.frequency}</b><span>${item.status}</span><small>${item.destination}</small></div>`).join("");
  document.getElementById("integration-automations").innerHTML = (data.automations || []).map(item => `<div class="small-card"><b>${item.event}</b><span>${item.active ? "ativa" : "inativa"} | ${item.severity}</span></div>`).join("");
  document.getElementById("integration-structures").innerHTML = detailPanel([
    ["Pix", data.pix?.enabled ? "Preparado" : "Aguardando configuração"],
    ["Fiscal", data.fiscal?.enabled ? "Preparado" : "Aguardando configuração"],
    ["TEF", data.tef?.enabled ? "Preparado" : "Aguardando configuração"],
    ["Drive", data.drive?.enabled ? "Preparado" : "Aguardando configuração"]
  ], { pix: data.pix, fiscal: data.fiscal, tef: data.tef, drive: data.drive });
  document.getElementById("integration-logs").innerHTML = (data.logs || []).map(log => `<div class="timeline-item"><b>${businessLabel(log.event)}</b><span>${log.date} ${log.hour} | ${log.status}</span><p>${log.error ? `Problema: ${log.error}. Ação sugerida: revisar a integração.` : log.reference || "Registro concluído."}</p></div>`).join("") || "<p>Sem registros de integração ainda.</p>";
}

function topList(items) {
  if (!items || !items.length) return "Sem dados";
  return items.slice(0, 5).map(item => `${item.name}: ${typeof item.value === "number" ? money.format(item.value) : item.value}`).join(" | ");
}

function prepareQuoteProjectRecognitionPanel() {
  const form = document.getElementById("quote-form");
  if (!form) return;
  const slot = document.getElementById("quote-project-recognition-slot");
  const existing = document.getElementById("quote-project-recognition-panel");
  if (existing) {
    if (slot && !slot.contains(existing)) slot.appendChild(existing);
    return;
  }
  const html = `
    <section id="quote-project-recognition-panel" class="quote-project-panel">
      <div class="quote-project-head">
        <div>
          <span>Projeto do cliente</span>
          <h3>Upload do projeto e sugestao assistida</h3>
          <p>Envie imagem, PDF ou briefing. Sem IA configurada, o PrintSys usa leitura manual e correspondencia por palavras-chave do catalogo.</p>
        </div>
        <button type="button" class="primary" data-project-action="analyze">Analisar projeto</button>
      </div>
      <div class="root-form-grid" style="--root-columns:3">
        <label>Arquivo do projeto<input id="quote-project-file" type="file" accept="image/*,.pdf,.cdr,.ai,.psd,.svg"></label>
        <label>Nome/descricao do arquivo<input id="quote-project-file-name" placeholder="fachada-acm-10x1.pdf"></label>
        <label>Pedido do cliente<input id="quote-project-request" placeholder="Ex.: Fachada ACM 10x1,20 com LED"></label>
        <label class="root-wide-field">Texto extraido ou observacoes<textarea id="quote-project-text" placeholder="Cole textos visiveis, medidas, materiais ou informacoes do layout"></textarea></label>
      </div>
      <div id="quote-project-review" class="project-review-panel"></div>
    </section>
  `;
  if (slot) slot.insertAdjacentHTML("beforeend", html);
  else {
    const anchor = form.querySelector(".quote-os-card") || form.firstElementChild;
    anchor?.insertAdjacentHTML("afterend", html);
  }
  document.getElementById("quote-project-file")?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (file && !document.getElementById("quote-project-file-name").value) document.getElementById("quote-project-file-name").value = file.name;
  });
}

async function analyzeQuoteProject() {
  const file = document.getElementById("quote-project-file")?.files?.[0] || null;
  const fileName = document.getElementById("quote-project-file-name")?.value || file?.name || "";
  const text = document.getElementById("quote-project-text")?.value || "";
  const customerRequest = document.getElementById("quote-project-request")?.value || document.getElementById("quote-job")?.value || "";
  if (!fileName && !text && !customerRequest) return showToast("Informe arquivo, descricao ou observacoes do projeto.", "warning");
  const result = await api("/api/project-recognition/analyze", {
    method: "POST",
    body: {
      fileName,
      fileType: file?.type || "",
      fileSize: file?.size || 0,
      customerId: document.getElementById("quote-customer")?.value || "",
      customerRequest,
      extractedText: text,
      notes: customerRequest,
      user: state.user?.name || "Vendedor"
    }
  });
  state.projectRecognition.active = result.analysis;
  state.projectRecognition.analyses = [result.analysis, ...(state.projectRecognition.analyses || [])];
  renderProjectRecognitionReview();
  showToast(result.analysis?.message || "Projeto analisado para revisao.", result.analysis?.aiProviderConfigured ? "success" : "info");
}

function renderProjectRecognitionReview() {
  const target = document.getElementById("quote-project-review");
  if (!target) return;
  const analysis = state.projectRecognition?.active;
  if (!analysis) {
    target.innerHTML = `<div class="focused-empty-note"><b>Nenhum projeto analisado.</b><span>Use a analise assistida para sugerir produtos do catalogo sem salvar nada automaticamente.</span></div>`;
    return;
  }
  const suggestions = analysis.suggestions || [];
  target.innerHTML = `
    <div class="project-review-status ${analysis.aiProviderConfigured ? "ready" : "manual"}">
      <b>${analysis.aiProviderConfigured ? "IA configurada" : "Reconhecimento por catalogo"}</b>
      <span>${escapeHtml(analysis.message || "Analise pronta para revisao.")}</span>
      <small>Arquivo: ${escapeHtml(analysis.fileName || "-")} | Modo: ${escapeHtml(analysis.analysisMode || "keyword_fallback")}</small>
    </div>
    <div class="project-suggestion-grid">
      ${suggestions.map((suggestion, index) => renderProjectSuggestionCard(suggestion, index, analysis)).join("") || emptyStateMarkup("Nenhuma sugestao encontrada.", "Revise o texto do projeto ou selecione o produto manualmente no catalogo.")}
    </div>
    <div class="focused-actions">
      <button type="button" data-project-action="create-draft">Montar rascunho revisavel</button>
      <button type="button" data-project-action="clear">Limpar analise</button>
    </div>
    ${state.projectRecognition?.draft ? `<div class="alert green"><b>Rascunho pronto</b><span>${escapeHtml(state.projectRecognition.draft.message || "Revise os itens antes de salvar o orcamento.")}</span></div>` : ""}
  `;
}

function renderProjectSuggestionCard(suggestion = {}, index = 0, analysis = {}) {
  const product = state.products.find(item => item.id === suggestion.productId) || {};
  const missing = (suggestion.missingInformation || []).length ? `Falta: ${suggestion.missingInformation.join(", ")}` : "Informacoes principais encontradas";
  return `
    <article class="project-suggestion-card">
      <div class="suggestion-image">${suggestion.imageUrl || product.imageUrl ? `<img src="${escapeHtml(suggestion.imageUrl || product.imageUrl)}" alt="">` : `<span>${escapeHtml(product.categoryIcon || suggestion.category?.slice(0, 2) || "PR")}</span>`}</div>
      <div>
        <small>${escapeHtml(suggestion.category || product.category || "Catalogo")}</small>
        <h4>${escapeHtml(suggestion.productName || product.name || "Produto sugerido")}</h4>
        <p>${escapeHtml(suggestion.reason || "Produto encontrado no catalogo.")}</p>
        <span class="status-pill ${suggestion.confidence >= 70 ? "green" : suggestion.confidence >= 45 ? "warning" : "red"}">${suggestion.confidence || 0}% confianca</span>
        <small>${escapeHtml(missing)}</small>
      </div>
      <div class="suggestion-actions">
        <button type="button" class="primary" data-project-action="accept-suggestion" data-index="${index}">Adicionar item</button>
        <button type="button" data-project-action="select-suggestion" data-index="${index}">Preencher produto</button>
      </div>
    </article>
  `;
}

async function addProjectSuggestionToQuote(index = 0) {
  const analysis = state.projectRecognition?.active;
  const suggestion = analysis?.suggestions?.[index];
  if (!suggestion) return showToast("Sugestao nao encontrada.", "warning");
  const product = state.products.find(item => item.id === suggestion.productId);
  if (!product) return showToast("Produto sugerido nao esta mais disponivel.", "warning");
  const answers = { ...(suggestion.suggestedAnswers || {}), compositionId: suggestion.compositionId || suggestion.suggestedAnswers?.compositionId || "" };
  const pricing = await api("/api/quote/calculate", {
    method: "POST",
    body: {
      productId: product.id,
      productModelId: suggestion.productModelId || "",
      answers,
      additionalExpenses: 0,
      manualPrice: 0
    }
  });
  state.quoteItems.push(buildQuoteItemFromSuggestion(suggestion, pricing, analysis));
  renderQuoteItemPreview(null);
  renderQuoteTotals(null);
  renderQuotePricingResult(null);
  showToast("Item sugerido adicionado ao orcamento.", "success");
}

function buildQuoteItemFromSuggestion(suggestion = {}, pricing = {}, analysis = {}) {
  const product = state.products.find(item => item.id === suggestion.productId) || {};
  const model = productModels(product).find(item => item.id === (pricing.productModelId || suggestion.productModelId)) || activeProductModels(product)[0] || {};
  const composition = state.compositions.find(item => item.id === (suggestion.compositionId || suggestion.suggestedAnswers?.compositionId)) || state.compositions.find(item => item.productId === product.id) || {};
  const answers = { ...(suggestion.suggestedAnswers || {}), compositionId: composition.id || suggestion.compositionId || "" };
  const quantity = Math.max(Number(answers.quantity || suggestion.suggestedQuantity || 1), 1);
  const subtotal = Number(pricing.finalPrice || pricing.suggestedPrice || product.minPrice || 0);
  const size = suggestion.suggestedMeasure || calculateProductMeasure(product, answers).label || "A confirmar";
  const route = structuredClone(pricing.productionRoute || product.productionRoute || []);
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    productId: product.id,
    productModelId: model.id || pricing.productModelId || "",
    productModelName: model.name || pricing.productModelName || "",
    productName: product.name || suggestion.productName || "Produto",
    productImageUrl: product.imageUrl || suggestion.imageUrl || "",
    categoryId: product.categoryId || suggestion.categoryId || "",
    categoryIcon: product.categoryIcon || "",
    compositionId: composition.id || "",
    compositionName: composition.name || suggestion.compositionName || "Sem composicao",
    description: document.getElementById("quote-project-request")?.value || document.getElementById("quote-job")?.value || product.name || "Projeto do cliente",
    size,
    quantity,
    unitPrice: subtotal / quantity,
    subtotal,
    status: "Sugerido pelo projeto",
    material: answers.material || product.materialsUsed?.[0] || "",
    finish: answers.finish || product.finishes?.[0] || "",
    margin: pricing.validation?.marginAtManualPrice ?? pricing.marginPercent ?? 0,
    answers,
    technicalAnswersSnapshot: { ...answers },
    questionCostsSnapshot: structuredClone(pricing.questionCosts || []),
    productionRouteSnapshot: route,
    productConfigSnapshot: structuredClone({
      id: product.id,
      code: product.code,
      name: product.name,
      imageUrl: product.imageUrl || "",
      categoryId: product.categoryId || "",
      pricingMode: product.pricingMode,
      technicalQuestions: product.technicalQuestions || product.questions || [],
      productionRoute: product.productionRoute || []
    }),
    productModelSnapshot: model?.id ? structuredClone(model) : null,
    pricingSnapshot: pricing,
    flow: route.map(step => step.sectorName || step),
    files: [analysis.fileName].filter(Boolean),
    projectFiles: [analysis.fileName].filter(Boolean),
    aiTrace: { analysisId: analysis.id, confidence: suggestion.confidence, reason: suggestion.reason, source: suggestion.source || analysis.analysisMode },
    notes: {
      client: "Item sugerido a partir de projeto enviado pelo cliente.",
      production: `Conferir arquivo ${analysis.fileName || ""} antes de produzir.`,
      finance: ""
    }
  };
}

async function createProjectQuoteDraft() {
  const analysis = state.projectRecognition?.active;
  if (!analysis?.id) return showToast("Analise um projeto antes de montar o rascunho.", "warning");
  const draft = await api(`/api/project-recognition/${analysis.id}/quote-draft`, {
    method: "POST",
    body: {
      customerId: document.getElementById("quote-customer")?.value || "",
      jobName: document.getElementById("quote-project-request")?.value || document.getElementById("quote-job")?.value || "",
      items: (analysis.suggestions || []).slice(0, 3),
      user: state.user?.name || "Vendedor"
    }
  });
  state.projectRecognition.draft = draft;
  state.quoteItems = [...state.quoteItems, ...(draft.items || []).map(item => ({
    ...item,
    productImageUrl: item.productImageUrl || item.productConfigSnapshot?.imageUrl || "",
    size: item.size || (item.answers?.width && item.answers?.height ? `${item.answers.width} x ${item.answers.height}` : "A confirmar"),
    unitPrice: Number(item.unitPrice || item.subtotal || item.pricingSnapshot?.finalPrice || 0) / Math.max(Number(item.quantity || 1), 1),
    subtotal: Number(item.subtotal || item.pricingSnapshot?.finalPrice || item.pricingSnapshot?.suggestedPrice || 0),
    margin: item.margin || item.pricingSnapshot?.validation?.marginAtManualPrice || item.pricingSnapshot?.marginPercent || 0,
    status: "Rascunho do projeto"
  }))];
  renderProjectRecognitionReview();
  renderQuoteItemPreview(null);
  renderQuoteTotals(null);
  showToast("Rascunho aplicado aos itens do orcamento para revisao.", "success");
}

function selectProjectSuggestion(index = 0) {
  const suggestion = state.projectRecognition?.active?.suggestions?.[index];
  if (!suggestion) return;
  document.getElementById("quote-product").value = suggestion.productId;
  if (suggestion.compositionId && document.getElementById("quote-composition")) document.getElementById("quote-composition").value = suggestion.compositionId;
  renderQuoteProductModels();
  applyProductConfigurationToQuote();
  Object.entries(suggestion.suggestedAnswers || {}).forEach(([key, value]) => {
    const input = document.querySelector(`#quote [data-answer="${key}"]`);
    if (input && value !== undefined && value !== "") input.value = value;
  });
  scheduleQuoteCalculation();
  showToast("Produto sugerido preenchido. Revise perguntas e medidas.", "success");
}

function renderQuoteForm() {
  prepareQuoteProjectRecognitionPanel();
  document.getElementById("quote-customer").innerHTML = state.customers.filter(customer => customer.active !== false).map(customer => `<option value="${customer.id}">${customer.name}</option>`).join("");
  document.getElementById("quote-product").innerHTML = state.products.filter(product => product.active !== false).map(product => `<option value="${product.id}">${product.code || ""} ${product.name}</option>`).join("");
  document.getElementById("quote-composition").innerHTML = state.compositions.filter(item => item.active !== false).map(item => `<option value="${item.id}" data-product="${item.productId}">${item.name} - ${item.category}</option>`).join("");
  const option = document.getElementById("quote-composition").selectedOptions[0];
  if (option?.dataset.product) document.getElementById("quote-product").value = option.dataset.product;
  renderQuoteProductModels();
  renderQuoteCustomerCard();
  renderCompositionInfo();
  renderQuestions();
  renderQuoteItemPreview(state.activeQuotePricing);
  renderQuoteTotals(state.activeQuotePricing);
  updateQuoteMeasurementVisibility();
  prepareQuoteProjectRecognitionPanel();
  renderProjectRecognitionReview();
}

function renderQuoteCustomerCardLegacyUnused() {
  const customer = state.customers.find(item => item.id === document.getElementById("quote-customer")?.value) || state.customers[0];
  const target = document.getElementById("quote-customer-card");
  if (!target || !customer) return;
  target.innerHTML = [
    ["Nome", customer.name || "Cliente"],
    ["Razão social", customer.companyName || customer.name || "Não informado"],
    ["CPF/CNPJ", customer.document || "Não informado"],
    ["Telefone", customer.phone || "Não informado"],
    ["Celular", customer.mobile || customer.whatsapp || customer.phone || "Não informado"],
    ["Classificação", customer.classification || "Essencial"],
    ["Origem", customer.origin || "Cadastro interno"],
    ["Avaliação", customer.rating ? `${customer.rating} estrela(s)` : "Sem avaliação"]
  ].map(([label, value]) => `<div class="small-card"><b>${label}</b><span>${value}</span></div>`).join("");
}

function renderQuestions() {
  const product = productForQuoteConfiguration() || state.products[0];
  const composition = state.compositions.find(item => item.id === document.getElementById("quote-composition").value);
  const allowed = composition?.questions || [];
  const measurementKeys = ["width", "height", "quantity", "linearMeasure", "linear_measure", "thickness"];
  const configuredQuestions = (product?.technicalQuestions || product?.questions || []).filter(question => question.active !== false && question.visibleInQuote !== false && !measurementKeys.includes(question.key));
  const productQuestions = allowed.length ? configuredQuestions.filter(question => allowed.includes(question.key) || question.affectsCost) : configuredQuestions;
  const questions = productQuestions.length ? productQuestions : quotePresetQuestions(product, composition);
  const questionSummary = document.getElementById("quote-question-summary");
  if (questionSummary) questionSummary.innerHTML = renderProductQuestionGrid(product, questions);
  document.getElementById("question-fields").innerHTML = questions.map(question => {
    if (question.type === "boolean") {
      return `<label class="root-question-card"><span>${question.label}</span><select data-answer="${question.key}"><option value="">Não</option><option value="true">Sim</option></select>${question.affectsCost ? `<small>Altera o custo</small>` : ""}</label>`;
    }
    if (question.type === "select") {
      return `<label class="root-question-card"><span>${question.label}</span><select data-answer="${question.key}"><option value="">Selecione</option>${(question.options || []).map(option => `<option value="${option.value}">${option.label}</option>`).join("")}</select>${question.affectsCost ? `<small>Altera o custo</small>` : ""}</label>`;
    }
    if (question.type === "multiselect") {
      return `<label class="root-question-card"><span>${question.label}</span><select data-answer="${question.key}" multiple>${(question.options || []).map(option => `<option value="${option.value}">${option.label}</option>`).join("")}</select>${question.affectsCost ? `<small>Altera o custo</small>` : ""}</label>`;
    }
    if (question.type === "upload") {
      return `<label class="root-question-card"><span>${question.label}</span><input data-answer="${question.key}" type="file" ${question.required ? "required" : ""}></label>`;
    }
    const inputType = question.type === "money" || question.type === "measure" ? "number" : question.type;
    return `<label class="root-question-card"><span>${question.label}</span><input data-answer="${question.key}" type="${inputType}" step="0.01" value="${question.key === "quantity" ? 1 : ""}" ${question.required ? "required" : ""}>${question.affectsCost ? `<small>Altera o custo</small>` : ""}</label>`;
  }).join("");
  renderQuoteLightChecklist();
}

function suggestedDeadline(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function applyProductConfigurationToQuote() {
  renderQuoteProductModels();
  const product = productForQuoteConfiguration();
  if (!product) return;
  const compositionSelect = document.getElementById("quote-composition");
  const matching = state.compositions.find(item => item.productId === product.id);
  if (matching && compositionSelect && compositionSelect.selectedOptions[0]?.dataset.product !== product.id) compositionSelect.value = matching.id;
  const deadline = document.getElementById("quote-deadline");
  const nextSuggestion = suggestedDeadline(product.defaultProductionDays || matching?.deadlineDays || 3);
  if (deadline && (!deadline.value || deadline.dataset.autoSuggested === "true")) {
    deadline.value = nextSuggestion;
    deadline.dataset.autoSuggested = "true";
  }
  renderCompositionInfo();
  renderQuestions();
}

function quotePresetQuestions(product, composition) {
  const name = `${composition?.name || ""} ${composition?.category || ""} ${product?.name || ""} ${product?.category || ""}`.toLowerCase();
  const base = [
    { key: "installation", label: "Instalação inclusa?", type: "boolean" },
    { key: "distance_km", label: "Distância de deslocamento (km)", type: "number" }
  ];
  if (name.includes("adesivo") || name.includes("adesiva")) return [
    { key: "adhesive_type", label: "Tipo de adesivo", type: "select", options: ["Vinil brilho", "Vinil fosco", "Perfurado", "Transparente"].map(label => ({ label, value: label })) },
    { key: "lamination", label: "Com laminação?", type: "boolean" },
    { key: "auto_varnish", label: "Com verniz automotivo?", type: "boolean" },
    { key: "detailed_place", label: "Local liso ou detalhado?", type: "select", options: ["Liso", "Detalhado"].map(label => ({ label, value: label })) },
    { key: "cleaning", label: "Precisa de limpeza?", type: "boolean" },
    { key: "sanding", label: "Precisa ser lixado?", type: "boolean" },
    { key: "painting", label: "Precisa ser pintado?", type: "boolean" },
    { key: "electronic_cut", label: "Com recorte eletrônico?", type: "boolean" },
    { key: "adhesive_applied", label: "Aplicado ou somente material?", type: "select", options: ["Aplicado", "Somente material"].map(label => ({ label, value: label })) },
    ...base
  ];
  if (name.includes("lona") || name.includes("faixa")) return [
    { key: "canvas_type", label: "Tipo de lona", type: "select", options: ["Lona 280g", "Lona 380g", "Lona 440g", "Lona dupla face"].map(label => ({ label, value: label })) },
    { key: "varnish", label: "Com verniz?", type: "boolean" },
    { key: "eyelets", label: "Com ilhós?", type: "boolean" },
    { key: "hem", label: "Com bainha?", type: "boolean" },
    { key: "reinforcement", label: "Com reforço?", type: "boolean" },
    ...base
  ];
  if (name.includes("acm") || name.includes("fachada") || name.includes("placa")) return [
    { key: "plate_type", label: "Placa reta ou caixote?", type: "select", options: ["Reta", "Caixote"].map(label => ({ label, value: label })) },
    { key: "depth", label: "Avanço/profundidade", type: "number" },
    { key: "base", label: "Com base?", type: "boolean" },
    { key: "metalon_structure", label: "Com estrutura em metalon?", type: "boolean" },
    { key: "metalon_type", label: "Tipo de metalon", type: "select", options: ["20x20", "30x20", "40x20", "50x30"].map(label => ({ label, value: label })) },
    { key: "lining", label: "Com forro?", type: "boolean" },
    { key: "gutter", label: "Com calha?", type: "boolean" },
    { key: "painting", label: "Com pintura?", type: "boolean" },
    { key: "arms", label: "Precisa de braço?", type: "boolean" },
    { key: "arms_quantity", label: "Quantidade de braços", type: "number" },
    { key: "arm_size", label: "Tamanho do braço", type: "number" },
    ...base
  ];
  if (name.includes("toldo")) return [
    { key: "advance", label: "Avanço", type: "number" },
    { key: "awning_material", label: "Material do toldo", type: "select", options: ["Lona", "Policarbonato", "ACM", "Acrílico"].map(label => ({ label, value: label })) },
    { key: "arms", label: "Precisa de braço?", type: "boolean" },
    { key: "arms_quantity", label: "Quantidade de braços", type: "number" },
    { key: "structure", label: "Estrutura", type: "select", options: ["Metalon", "Alumínio", "Ferro"].map(label => ({ label, value: label })) },
    { key: "painting", label: "Pintura", type: "boolean" },
    ...base
  ];
  if (name.includes("letreiro") || name.includes("led") || name.includes("luminoso")) return [
    { key: "lighting", label: "Com iluminação?", type: "boolean" },
    { key: "lighting_type", label: "Tipo de iluminação", type: "select", options: ["LED interno", "LED externo", "Spot", "Refletor"].map(label => ({ label, value: label })) },
    { key: "light_points", label: "Quantidade de pontos", type: "number" },
    { key: "power_supply", label: "Fonte/transformador", type: "boolean" },
    { key: "electric_labor", label: "Instalação elétrica", type: "boolean" },
    ...base
  ];
  if (name.includes("pvc") || name.includes("acrílico") || name.includes("acrilico")) return [
    { key: "thickness", label: "Espessura", type: "number" },
    { key: "base", label: "Com base?", type: "boolean" },
    { key: "adhesive_applied", label: "Com adesivo aplicado?", type: "boolean" },
    { key: "laser_cut", label: "Com corte laser?", type: "boolean" },
    { key: "electronic_cut", label: "Com recorte eletrônico?", type: "boolean" },
    { key: "delivery_type", label: "Instalação ou retirada?", type: "select", options: ["Instalação", "Retirada no balcão"].map(label => ({ label, value: label })) }
  ];
  return base;
}

function renderCompositionInfo() {
  const composition = state.compositions.find(item => item.id === document.getElementById("quote-composition")?.value);
  if (!composition) return;
  const product = state.products.find(item => item.id === document.getElementById("quote-product")?.value);
  const materials = (composition.materials || []).map(line => state.materials.find(material => material.id === line.materialId)?.name || line.materialId).join(", ");
  const sectors = (product?.productionRoute || []).map(step => step.sectorName).join(" > ") || (composition.productionFlow || []).join(" > ");
  document.getElementById("quote-composition-info").innerHTML = detailPanel([
    ["Composição escolhida", composition.name],
    ["Materiais previstos", materials || "Sem material padrão"],
    ["Fluxo de produção", sectors || "Sem fluxo definido"],
    ["Prazo padrão", `${product?.defaultProductionDays || composition.deadlineDays || 0} dia(s)`],
    ["Margem alvo", `${composition.marginPercent || 0}%`]
  ], composition, "Ver ficha técnica da composição");
}

function renderPricingSimulator() {
  const select = document.getElementById("sim-composition");
  if (!select) return;
  const preferred = ["Fachada ACM", "Faixa / Lona", "Adesivo Aplicado", "PVC Adesivado", "Totem", "Letreiro luminoso"];
  const items = preferred.map(name => state.compositions.find(item => item.name === name)).filter(Boolean);
  select.innerHTML = items.map(item => `<option value="${item.id}">${item.name} - ${item.category}</option>`).join("");
  document.getElementById("sim-presets").innerHTML = items.map(item => `<button type="button" data-sim-preset="${item.id}">${item.name}</button>`).join("");
  renderSimulationResult(state.activeSimulation);
  renderSimulationHistory();
}

function renderSimulationResult(simulation) {
  const pricing = simulation?.pricing || {};
  const validation = simulation?.validation || {};
  document.getElementById("sim-result-cards").innerHTML = simulation ? [
    ["Composicao", simulation.compositionName],
    ["Custo material", money.format(pricing.materialCost || 0)],
    ["Custos das perguntas", money.format(pricing.questionCostTotal || 0)],
    ["Custo producao", money.format(pricing.productionCost || 0)],
    ["Instalacao", money.format(pricing.installationCost || 0)],
    ["Deslocamento", `${simulation.answers?.distance_km || 0} km`],
    ["Despesas adicionais", money.format(pricing.additionalExpenses || 0)],
    ["Comissao", money.format(pricing.commission || 0)],
    ["Impostos", money.format(pricing.taxes || 0)],
    ["Margem", `${pricing.marginPercent || 0}%`],
    ["Meta de margem", `${validation.targetMarginPercent || pricing.targetMarginPercent || 0}%`],
    ["Gap da meta", `${validation.targetMarginGap || 0}%`],
    ["Status da margem", validation.marginStatus || "ideal"],
    ["Preco minimo", money.format(pricing.minPrice || 0)],
    ["Preco sugerido", money.format(pricing.suggestedPrice || 0)],
    ["Preco final", money.format(validation.manualPrice || pricing.suggestedPrice || 0)],
    ["Lucro previsto", money.format(pricing.grossProfit || 0)]
  ].map(item => `<div class="small-card"><b>${item[0]}</b><span>${item[1]}</span></div>`).join("") : "<p>Selecione uma composicao e execute a simulacao.</p>";
  document.getElementById("sim-material-table").innerHTML = (pricing.materialLines || []).map(line => `<tr><td>${line.material}</td><td>${line.quantity} ${line.unit}</td><td>${money.format(line.unitCost || 0)}</td><td>${money.format(line.totalCost || 0)}</td></tr>`).join("");
  document.getElementById("sim-production-table").innerHTML = (pricing.productionLines || []).map(line => `<tr><td>${line.sector}</td><td>${line.humanHours || 0}h</td><td>${line.machineHours || 0}h</td><td>${money.format(line.totalCost || 0)}</td></tr>`).join("");
  document.getElementById("sim-alerts").innerHTML = simulation ? [
    validation.marginStatus === "ideal" ? `<div class="alert green"><b>Margem ideal</b><span>Margem igual ou acima da meta definida.</span></div>` : "",
    validation.marginStatus === "abaixo_meta" ? `<div class="alert yellow"><b>Margem abaixo da meta definida</b><span>Margem atual: ${validation.marginAtManualPrice}%. Meta: ${validation.targetMarginPercent}%. Gap: ${validation.targetMarginGap}%.</span></div>` : "",
    validation.lowMarginAlert ? `<div class="alert red"><b>Margem minima critica</b><span>Margem no preco final: ${validation.marginAtManualPrice}%.</span></div>` : "",
    validation.belowCostAlert ? `<div class="alert red"><b>Venda abaixo do custo</b><span>Preco final menor que o custo total.</span></div>` : "",
    validation.difference ? `<div class="alert"><b>Diferenca entre preco manual e calculado</b><span>${money.format(validation.difference)} (${validation.differencePercent}%).</span></div>` : ""
  ].join("") : "";
  document.getElementById("sim-difference").innerHTML = simulation ? detailPanel([
    ["Preço manual", money.format(validation.manualPrice || 0)],
    ["Preço calculado", money.format(validation.calculatedPrice || 0)],
    ["Diferença", money.format(validation.difference || 0)],
    ["Diferença percentual", `${validation.differencePercent || 0}%`],
    ["Margem no preço manual", `${validation.marginAtManualPrice || 0}%`],
    ["Meta de margem", `${validation.targetMarginPercent || 0}%`],
    ["Status da margem", businessLabel(validation.marginStatus || "ideal")]
  ], { validacao: validation, historicoCustoUsado: pricing.costBreakdown }, "Ver memória de cálculo") : "Execute uma simulação.";
  document.getElementById("sim-create-quote").disabled = !simulation;
}

function renderSimulationHistory() {
  const list = state.pricingSimulations.slice().reverse();
  document.getElementById("sim-history").innerHTML = list.map(item => `<div class="timeline-item"><b>${item.compositionName}</b><span>${item.user} - ${new Date(item.createdAt).toLocaleString("pt-BR")}</span><p>Calculado: ${money.format(item.pricing.suggestedPrice || 0)} | Manual: ${money.format(item.validation.manualPrice || 0)} | Dif.: ${money.format(item.validation.difference || 0)}</p></div>`).join("") || "<p>Sem historico de simulacoes.</p>";
}

function renderQuotePricingResultLegacyUnused(pricing) {
  state.activeQuotePricing = pricing || null;
  const validation = pricing?.validation || {};
  document.getElementById("quote-price-cards").innerHTML = pricing ? [
    ["Custo material", money.format(pricing.materialCost || 0)],
    ["Custo producao", money.format(pricing.productionCost || 0)],
    ["Custo instalacao", money.format(pricing.installationCost || 0)],
    ["Custo administrativo", money.format(pricing.administrativeCost || 0)],
    ["Comissao", money.format(pricing.commission || 0)],
    ["Impostos", money.format(pricing.taxes || 0)],
    ["Lucro previsto", money.format((pricing.finalPrice || pricing.suggestedPrice || 0) - (pricing.totalCost || 0))],
    ["Margem", `${validation.marginAtManualPrice ?? pricing.marginPercent}%`],
    ["Preco minimo", money.format(pricing.minPrice || 0)],
    ["Preco sugerido", money.format(pricing.suggestedPrice || 0)],
    ["Preco final", money.format(pricing.finalPrice || pricing.suggestedPrice || 0)]
  ].map(item => `<div class="small-card"><b>${item[0]}</b><span>${item[1]}</span></div>`).join("") : (state.quoteItems.length ? [
    ["Valor final", money.format(quoteGrandTotal().finalValue)],
    ["Saldo a pagar", money.format(Math.max(quoteGrandTotal().finalValue - Number(document.getElementById("quote-down-payment")?.value || 0), 0))],
    ["Margem", `${averageQuoteMargin()}%`],
    ["Lucro previsto", money.format(state.quoteItems.reduce((sum, item) => sum + Math.max((item.subtotal || 0) - (item.pricingSnapshot?.totalCost || 0), 0), 0))]
  ].map(item => `<div class="small-card"><b>${item[0]}</b><span>${item[1]}</span></div>`).join("") : "");
  document.getElementById("quote-price-alerts").innerHTML = pricing ? [
    validation.marginStatus === "ideal" ? `<div class="alert green"><b>Margem ideal</b><span>Margem igual ou acima da meta definida.</span></div>` : "",
    validation.marginStatus === "abaixo_meta" ? `<div class="alert yellow"><b>Margem abaixo da meta definida</b><span>Gap: ${validation.targetMarginGap}%.</span></div>` : "",
    validation.lowMarginAlert ? `<div class="alert red"><b>Margem critica</b><span>Margem abaixo do minimo.</span></div>` : "",
    validation.belowCostAlert ? `<div class="alert red"><b>Venda abaixo do custo</b><span>Preco final menor que o custo total.</span></div>` : "",
    pricing.approvalRequired ? `<div class="alert red"><b>Aprovacao de desconto necessaria</b><span>Desconto ${pricing.discountPercent}% acima do limite ${pricing.discountLimit}%.</span></div>` : "",
    validation.difference ? `<div class="alert"><b>Diferenca manual x calculado</b><span>${money.format(validation.difference)} (${validation.differencePercent}%).</span></div>` : ""
  ].join("") : "";
  document.getElementById("price-result").innerHTML = pricing ? detailPanel([
    ["Composição", pricing.compositionName || "Não informada"],
    ["Materiais previstos", `${(pricing.materialLines || []).length} item(ns)`],
    ["Fluxo produtivo", (pricing.productionFlow || []).join(" > ") || "Não definido"],
    ["Margem", `${pricing.validation?.marginAtManualPrice ?? pricing.marginPercent ?? 0}%`],
    ["Preço sugerido", money.format(pricing.suggestedPrice || 0)]
  ], {
    composicao: pricing.compositionName,
    materiais: pricing.materialLines,
    fluxo: pricing.productionFlow,
    validacao: pricing.validation,
    snapshot: pricing.costBreakdown
  }, "Ver memória de cálculo") : "Responda o questionário.";
}

function renderQuoteItemPreviewLegacyUnused(pricing) {
  const target = document.getElementById("quote-items-preview");
  if (!target) return;
  const composition = state.compositions.find(item => item.id === document.getElementById("quote-composition")?.value);
  const product = state.products.find(item => item.id === document.getElementById("quote-product")?.value);
  const answers = { ...collectAnswers(), productModelId: model?.id || document.getElementById("quote-product-model")?.value || "" };
  const size = [answers.width, answers.height, answers.thickness].filter(Boolean).join(" x ") || "A confirmar";
  const quantity = Number(answers.quantity || 1);
  const materials = (pricing?.materialLines || []).map(line => line.material).join(", ") || "Conforme composição";
  const equipment = (pricing?.productionLines || []).map(line => line.sector).filter(Boolean).join(", ") || "Definido pelo PCP";
  const unitPrice = pricing?.finalPrice || pricing?.suggestedPrice || product?.minPrice || 0;
  target.innerHTML = `
    <tr>
      <td>1</td>
      <td>${composition?.name || product?.name || "Produto"}</td>
      <td>${document.getElementById("quote-job")?.value || "Trabalho"}</td>
      <td>${equipment}</td>
      <td>${materials}</td>
      <td>${size}</td>
      <td>${quantity}</td>
      <td>${product?.unit || "un."}</td>
      <td>${money.format(unitPrice)}</td>
      <td>${money.format(unitPrice)}</td>
      <td><button type="button">Editar</button><button type="button">Duplicar</button><button type="button">Excluir</button></td>
    </tr>
  `;
}

function renderQuoteTotalsLegacyUnused(pricing) {
  const target = document.getElementById("quote-total-summary");
  if (!target) return;
  const finalPrice = pricing?.finalPrice || pricing?.suggestedPrice || 0;
  const discount = Number(document.getElementById("quote-discount")?.value || 0);
  const downPayment = Number(document.getElementById("quote-down-payment")?.value || 0);
  const discounted = finalPrice * (discount / 100);
  const finalValue = Math.max(finalPrice - discounted, 0);
  const fixedContribution = Math.max(pricing?.administrativeCost || 0, 0);
  target.innerHTML = `
    <div class="total-line"><span>Total bruto</span><strong>${money.format(finalPrice)}</strong></div>
    <div class="total-line"><span>Descontos</span><strong>${money.format(discounted)}</strong></div>
    <div class="total-line"><span>Valor final</span><strong>${money.format(finalValue)}</strong></div>
    <div class="total-line"><span>Sinal pago</span><strong>${money.format(downPayment)}</strong></div>
    <div class="total-line"><span>Saldo a pagar</span><strong>${money.format(Math.max(finalValue - downPayment, 0))}</strong></div>
    <small>Este trabalho contribui com ${money.format(fixedContribution)} para pagar os custos fixos, conforme a composição e os custos configurados.</small>
  `;
  const commissionValue = document.getElementById("quote-commission-value");
  if (commissionValue) commissionValue.textContent = money.format(finalValue * (Number(document.getElementById("quote-commission")?.value || 0) / 100));
}

function quoteRequestBody() {
  const manual = Number(document.getElementById("quote-manual-price").value || 0);
  const splitFiles = value => String(value || "").split(",").map(item => item.trim()).filter(Boolean);
  const previewFiles = splitFiles(document.getElementById("quote-preview-files")?.value);
  const productionFiles = splitFiles(document.getElementById("quote-production-files")?.value);
  return {
    customerId: document.getElementById("quote-customer").value,
    productId: document.getElementById("quote-product").value,
    jobName: document.getElementById("quote-job").value,
    answers: {
      ...collectAnswers(),
      compositionId: document.getElementById("quote-composition").value,
      clientNote: document.getElementById("quote-client-note")?.value || "",
      productionNote: document.getElementById("quote-production-note")?.value || "",
      financeNote: document.getElementById("quote-finance-note")?.value || "",
      downPayment: Number(document.getElementById("quote-down-payment")?.value || 0),
      billTo: document.getElementById("quote-bill-to")?.value || "",
      purchaseOrder: document.getElementById("quote-purchase-order")?.value || ""
    },
    photos: previewFiles,
    files: [...productionFiles, ...splitFiles(document.getElementById("quote-purchase-file")?.value)],
    additionalExpenses: Number(document.getElementById("quote-extra-costs-final").value || 0),
    manualPrice: manual || undefined,
    priceChangeReason: document.getElementById("quote-price-reason").value,
    discountPercent: document.getElementById("quote-discount").value
  };
}

let quoteCalcTimer;
function scheduleQuoteCalculation() {
  clearTimeout(quoteCalcTimer);
  quoteCalcTimer = setTimeout(calculateQuoteNow, 350);
}

async function calculateQuoteNow() {
  if (!document.getElementById("quote-product")?.value) return;
  try {
    const pricing = await api("/api/quote/calculate", { method: "POST", body: quoteRequestBody() });
    if (!Number(document.getElementById("quote-manual-price").value || 0)) document.getElementById("quote-manual-price").placeholder = String(pricing.suggestedPrice || 0);
    renderQuotePricingResult(pricing);
    renderQuoteItemPreview(pricing);
    renderQuoteTotals(pricing);
  } catch (error) {
    document.getElementById("price-result").textContent = error.message;
  }
}

async function saveCurrentQuoteDraft() {
  const quote = await api("/api/quotes", { method: "POST", body: quoteRequestBody() });
  state.lastSavedQuoteId = quote.id;
  state.quoteItems = [];
  renderQuotePricingResult(quote.pricing);
  renderQuoteItemPreview(quote.pricing);
  renderQuoteTotals(quote.pricing);
  await loadAll();
  return quote;
}

async function handleQuoteFinalAction(action) {
  if (action === "print") {
    window.print();
    return;
  }
  if (action === "cancel") {
    view("dashboard");
    return;
  }
  const quote = state.lastSavedQuoteId
    ? (state.quotes || []).find(item => item.id === state.lastSavedQuoteId) || await saveCurrentQuoteDraft()
    : await saveCurrentQuoteDraft();
  if (!quote?.id) {
    showToast("Salve o orcamento antes de continuar.", "warning");
    return;
  }
  if (action === "approve" || action === "order") {
    await api(`/api/quotes/${quote.id}/approve`, { method: "POST", body: {} });
    await loadAll();
    showToast(action === "order" ? "O.S. gerada a partir do orcamento." : "Orcamento aprovado.", "success");
    if (action === "order") view("orders");
  }
}

function collectAnswers() {
  const answers = [...document.querySelectorAll("[data-answer]")].reduce((answers, field) => {
    if (field.type === "file") {
      answers[field.dataset.answer] = field.files?.[0]?.name || "";
    } else if (field.multiple) {
      answers[field.dataset.answer] = [...field.selectedOptions].map(option => option.value);
    } else {
      answers[field.dataset.answer] = field.value === "true" ? true : field.value;
    }
    return answers;
  }, {});
  return { ...answers, ...(state.quoteItemDraftAnswers || {}) };
}

function renderQuotes() {
  document.getElementById("quote-table").innerHTML = state.quotes.map(quote => `
    <tr>
      <td>${quote.quoteNumber}</td>
      <td>${customerName(quote.customerId)}</td>
      <td>${quote.jobName}</td>
      <td>${money.format(quote.pricing.suggestedPrice)}</td>
      <td>${quote.status}</td>
      <td><button data-print-quote="${quote.id}">Imprimir</button><button data-approve="${quote.id}">Aprovar</button></td>
    </tr>
  `).join("");
}

function renderOrdersLegacyUnused() {
  const query = (document.getElementById("order-filter")?.value || "").toLowerCase();
  const normalizedQuery = normalizeUxText(query);
  const rows = state.orders.filter(order => {
    if (normalizedQuery.includes("sem arquivo")) return !(order.files || []).length;
    if (normalizedQuery.includes("atras")) return productionVisualStatus(order) === "atrasado";
    if (normalizedQuery.includes("sem pagamento")) return normalizeUxText(order.financialStatus || "").match(/aguard|pend|sem pagamento/);
    return normalizeUxText([order.id, order.customerName, order.jobName, order.productionStatus, order.financialStatus].join(" ")).includes(normalizedQuery);
  });
  const summary = document.getElementById("orders-summary");
  if (summary) {
    const nextOrder = rows[0] || state.orders[0];
    const late = rows.filter(order => String(order.productionStatus || "").toLowerCase().includes("atras")).length;
    summary.innerHTML = [
      managerCard("O.S. em consulta", rows.length, "ok", "Ordens encontradas conforme o filtro atual."),
      managerCard("Próxima O.S.", nextOrder?.id || "Sem O.S.", nextOrder ? "ok" : "warning", nextOrder ? `${nextOrder.customerName} - ${nextOrder.jobName}` : "Nenhuma ordem cadastrada."),
      managerCard("Status financeiro", nextOrder?.financialStatus || "Sem informação", nextOrder?.financialStatus === "quitada" ? "ok" : "warning", "Use Registrar pagamento para atualizar o caixa."),
      managerCard("Status de produção", nextOrder?.productionStatus || "Sem informação", countStatus(late, 1, 3), "Acompanhe envio para PCP, produção e entrega.")
    ].join("");
  }
  document.getElementById("orders-table").innerHTML = rows.map(order => {
    const product = state.products.find(item => item.id === order.productId)?.name || order.jobName;
    return `
    <tr>
      <td>${order.id}</td>
      <td>${order.customerName}</td>
      <td>${product}</td>
      <td>${order.seller || "Joao Victor"}</td>
      <td>${money.format(order.total || 0)}</td>
      <td>${money.format(order.predictedCost || 0)}</td>
      <td>${order.predictedMargin ?? 0}%</td>
      <td><span class="status-pill finance">${order.financialStatus}</span></td>
      <td><span class="status-pill production">${order.productionStatus}</span></td>
      <td>${order.dueDate}</td>
      <td class="row-actions">
        <button data-action="bill-order" data-order="${order.id}">Registrar pagamento</button>
        <button data-action="send-pcp" data-order="${order.id}">Enviar para PCP</button>
        <button data-action="attach-order" data-order="${order.id}">Anexar arquivo</button>
        <button data-action="history-order" data-order="${order.id}">Ver histórico</button>
      </td>
    </tr>
  `;
  }).join("");
  renderCashOrders();
}

function renderOrderTools() {
  const options = state.orders.map(order => `<option value="${order.id}">${order.id} - ${order.jobName}</option>`).join("");
  ["approval-order", "history-order", "stock-order", "postcalc-order", "label-order"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = options;
  });
  document.getElementById("stock-material").innerHTML = state.materials.map(material => `<option value="${material.id}">${material.name} (${material.stock} ${material.unit})</option>`).join("");
  renderSelectedHistory();
  renderSelectedPostcalc();
}

function renderCustomers() {
  const query = normalizeUxText(document.getElementById("customer-search")?.value || "");
  const rows = (state.customers || []).filter(customer => {
    const haystack = normalizeUxText([customer.name, customer.phone, customer.email, customer.document, customer.companyName, customer.mobile].join(" "));
    return customer.active === false ? false : !query || haystack.includes(query);
  });
  document.getElementById("customer-table").innerHTML = rows.map(customer => `
    <tr>
      <td><b>${customer.name}</b><small>${customer.companyName || customer.classification || "Cliente"}</small></td>
      <td>${customer.phone || customer.mobile || ""}</td>
      <td>${customer.email || ""}</td>
      <td>${money.format(customer.creditLimit || 0)}</td>
      <td class="row-actions">
        <button type="button" data-customer-action="edit" data-customer="${customer.id}">Editar</button>
        <button type="button" data-customer-action="history" data-customer="${customer.id}">Historico</button>
        <button type="button" data-customer-action="delete" data-customer="${customer.id}">Inativar</button>
      </td>
    </tr>
  `).join("");
  const table = document.getElementById("customer-table")?.closest("table");
  const header = table?.querySelector("thead tr");
  if (header && header.children.length < 5) header.insertAdjacentHTML("beforeend", "<th>Acoes</th>");
}

function productModels(product = {}) {
  const existing = Array.isArray(product.models) && product.models.length ? product.models : [{
    id: `model-${product.id || "default"}-1`,
    name: "Modelo padrao",
    finish: (product.finishes || [])[0] || "",
    unit: product.unit || "unidade",
    variation: product.pricingMode || "unit",
    materialCost: Number(product.baseCostM2 || product.costBase || 0),
    laborCost: Number(product.productionCost || 0),
    totalCost: Number(product.baseCostM2 || product.costBase || 0) + Number(product.productionCost || 0),
    salePrice: Number(product.salePrice || product.minPrice || product.baseValue || 0),
    active: product.active !== false,
    technicalQuestions: product.technicalQuestions || product.questions || [],
    productionRoute: product.productionRoute || []
  }];
  return existing.map((model, index) => ({
    ...model,
    id: model.id || `model-${product.id || "default"}-${index + 1}`,
    name: model.name || model.model || "Modelo padrao",
    finish: model.finish || model.acabamento || "",
    unit: model.unit || product.unit || "unidade",
    variation: model.variation || product.pricingMode || "unit",
    materialCost: Number(model.materialCost ?? model.thirdPartyCost ?? product.baseCostM2 ?? 0),
    laborCost: Number(model.laborCost ?? model.productionCost ?? product.productionCost ?? 0),
    totalCost: Number(model.totalCost ?? (Number(model.materialCost ?? product.baseCostM2 ?? 0) + Number(model.laborCost ?? product.productionCost ?? 0))),
    salePrice: Number(model.salePrice ?? model.minPrice ?? product.salePrice ?? product.minPrice ?? 0),
    active: model.active !== false,
    technicalQuestions: model.technicalQuestions || model.questions || product.technicalQuestions || product.questions || [],
    questions: model.technicalQuestions || model.questions || product.technicalQuestions || product.questions || [],
    productionRoute: model.productionRoute || product.productionRoute || []
  }));
}

function activeProductModels(product = {}) {
  return productModels(product).filter(model => model.active !== false);
}

function modelVariationLabel(value) {
  return ({ unit: "Unidade", square_meter: "m2", linear_meter: "Metro linear", m2: "m2", metro_linear: "Metro linear" }[value] || value || "Unidade");
}

function selectedQuoteProduct() {
  return state.products.find(item => item.id === document.getElementById("quote-product")?.value) || state.products[0];
}

function selectedQuoteProductModel(product = selectedQuoteProduct()) {
  const modelId = document.getElementById("quote-product-model")?.value || state.quoteItemDraftAnswers.productModelId || "";
  return productModels(product).find(model => model.id === modelId) || activeProductModels(product)[0] || productModels(product)[0] || null;
}

function productForQuoteConfiguration() {
  const product = selectedQuoteProduct();
  const model = selectedQuoteProductModel(product);
  if (!product || !model) return product;
  return {
    ...product,
    selectedModelId: model.id,
    selectedModel: model,
    unit: model.unit || product.unit,
    pricingMode: ["unit", "square_meter", "linear_meter"].includes(model.variation) ? model.variation : product.pricingMode,
    baseCostM2: Number(model.materialCost ?? product.baseCostM2 ?? 0),
    productionCost: Number(model.laborCost ?? product.productionCost ?? 0),
    salePrice: Number(model.salePrice ?? product.salePrice ?? 0),
    minPrice: Number(model.minPrice ?? model.salePrice ?? product.minPrice ?? 0),
    technicalQuestions: model.technicalQuestions || model.questions || product.technicalQuestions || product.questions || [],
    questions: model.technicalQuestions || model.questions || product.technicalQuestions || product.questions || [],
    productionRoute: model.productionRoute || product.productionRoute || []
  };
}

function renderQuoteProductModels() {
  const product = selectedQuoteProduct();
  if (!product) return;
  let field = document.getElementById("quote-product-model-field");
  if (!field) {
    field = document.createElement("label");
    field.id = "quote-product-model-field";
    field.innerHTML = `Modelo<select id="quote-product-model"></select>`;
    const grid = document.getElementById("quote-product-grid");
    const productField = findFieldBlock("quote-product");
    if (grid) grid.insertBefore(field, document.getElementById("quote-composition")?.closest("label") || null);
    else productField?.insertAdjacentElement("afterend", field);
    document.getElementById("quote-product-model")?.addEventListener("change", () => {
      state.quoteItemDraftAnswers.productModelId = document.getElementById("quote-product-model").value;
      renderQuestions();
      updateQuoteMeasurementVisibility();
      renderQuoteItemPreview(state.activeQuotePricing);
      scheduleQuoteCalculation();
    });
  }
  const select = document.getElementById("quote-product-model");
  if (!select) return;
  const models = activeProductModels(product);
  const previous = select.value || state.quoteItemDraftAnswers.productModelId || "";
  select.innerHTML = models.map(model => `<option value="${model.id}">${escapeHtml(model.name)} - ${money.format(model.salePrice || 0)}</option>`).join("");
  if ([...select.options].some(option => option.value === previous)) select.value = previous;
  else if (models[0]) select.value = models[0].id;
  state.quoteItemDraftAnswers.productModelId = select.value || "";
}

function renderProducts() {
  document.getElementById("quick-product").innerHTML = state.products.filter(product => product.active !== false).map(product => `<option value="${product.code || product.id}" data-name="${product.name}" data-base="${product.minPrice || 0}">${product.code || ""} ${product.name}</option>`).join("");
  document.getElementById("admin-product").innerHTML = state.products.map(product => `<option value="${product.id}">${product.code || ""} ${product.name}</option>`).join("");
  document.getElementById("technical-product").innerHTML = state.products.map(product => `<option value="${product.id}">${product.code || ""} ${product.name}</option>`).join("");
  const categories = (state.productCategories?.length ? state.productCategories : [...new Set((state.products || []).map(product => product.category).filter(Boolean))].map(name => ({ id: name, name, icon: String(name).slice(0, 2).toUpperCase(), color: "#7b179f" })));
  const filter = document.getElementById("product-category-filter");
  if (filter) {
    const current = filter.value;
    filter.innerHTML = `<option value="">Todas</option>` + categories.map(category => `<option value="${category.id || category.name}" ${[category.id, category.name].includes(current) ? "selected" : ""}>${category.name}</option>`).join("");
  }
  const query = normalizeUxText(document.getElementById("product-search")?.value || "");
  const category = document.getElementById("product-category-filter")?.value || "";
  const status = document.getElementById("product-status-filter")?.value || "";
  const type = document.getElementById("product-type-filter")?.value || "";
  const rows = (state.products || []).filter(product => {
    const haystack = normalizeUxText([product.code, product.name, product.category, product.description].join(" "));
    const statusOk = status === "active" ? product.active !== false : status === "inactive" ? product.active === false : true;
    const typeOk = !type || (product.pricingMode || "unit") === type;
    const categoryOk = !category || product.category === category || product.categoryId === category;
    return categoryOk && statusOk && typeOk && (!query || haystack.includes(query));
  });
  const canEdit = canUsePermission("settings");
  const list = document.getElementById("product-list");
  if (!rows.length) {
    list.innerHTML = emptyStateMarkup("Nenhum produto encontrado.", "Cadastre um produto principal para vincular modelos, perguntas, estoque e producao.");
    return;
  }
  const favorites = rows.filter(product => product.favorite).slice(0, 6);
  const recent = (state.productCatalog?.recentlyUsed || []).filter(product => rows.some(row => row.id === product.id)).slice(0, 6);
  list.innerHTML = `
    <section class="product-catalog-shell">
      <aside class="catalog-category-panel">
        <div class="catalog-summary">
          <span>Catalogo comercial</span>
          <b>${rows.length} produto(s)</b>
          <small>${state.productCatalog?.summary?.activeProducts || rows.filter(item => item.active !== false).length} ativos</small>
        </div>
        <button type="button" class="${!category ? "active" : ""}" data-product-category-select="">Todos os produtos</button>
        ${categories.map(categoryItem => `<button type="button" class="${category === categoryItem.id || category === categoryItem.name ? "active" : ""}" data-product-category-select="${escapeHtml(categoryItem.id || categoryItem.name)}"><span style="--cat-color:${escapeHtml(categoryItem.color || "#7b179f")}">${escapeHtml(categoryItem.icon || String(categoryItem.name).slice(0, 2).toUpperCase())}</span>${escapeHtml(categoryItem.name)}</button>`).join("")}
      </aside>
      <div class="catalog-main-panel">
        <div class="catalog-highlight-row">
          <div class="catalog-mini-section"><b>Favoritos</b><div>${(favorites.length ? favorites : rows.slice(0, 4)).map(product => productMiniChip(product)).join("")}</div></div>
          <div class="catalog-mini-section"><b>Usados recentemente</b><div>${(recent.length ? recent : rows.slice(0, 4)).map(product => productMiniChip(product)).join("")}</div></div>
        </div>
        <div class="product-card-grid">${rows.slice(0, 12).map(product => productCatalogCard(product, canEdit)).join("")}</div>
        <div class="product-group-list">${rows.map(product => {
    const models = productModels(product);
    const activeModels = models.filter(model => model.active !== false);
    const expanded = state.expandedProductId === product.id;
    const initials = escapeHtml(product.categoryIcon || (product.category || product.name || "P").slice(0, 2).toUpperCase());
    const actions = `
      <button type="button" data-product-action="quote" data-product="${product.id}">Orcar</button>
      <button type="button" data-product-action="catalog-preview" data-product="${product.id}">Previa</button>
      ${canEdit ? `<button type="button" data-product-action="model-add" data-product="${product.id}">Adicionar modelo</button><button type="button" data-product-action="catalog-image" data-product="${product.id}">Imagem</button><button type="button" data-product-action="catalog-favorite" data-product="${product.id}">${product.favorite ? "Desfavoritar" : "Favoritar"}</button><button type="button" data-product-action="catalog-category" data-product="${product.id}">Categoria</button><button type="button" data-product-action="edit" data-product="${product.id}">Editar</button><button type="button" data-product-action="duplicate" data-product="${product.id}">Duplicar</button><button type="button" data-product-action="delete" data-product="${product.id}">Inativar</button>` : ""}
    `;
    return `
      <article class="product-group ${expanded ? "expanded" : ""} ${product.active === false ? "inactive-product" : ""}">
        <div class="product-group-row ${expanded ? "active" : ""}" data-product-row="${product.id}">
          ${product.imageUrl ? `<img class="product-thumb" src="${escapeHtml(product.imageUrl)}" alt="">` : `<div class="product-group-icon">${initials}</div>`}
          <div class="product-group-main">
            <b>${escapeHtml(product.name || "Produto sem nome")}</b>
            <small>${escapeHtml(product.code || "Sem codigo")} | ${escapeHtml(product.category || "Sem categoria")} | ${activeModels.length} modelo(s) ativo(s)</small>
          </div>
          <span class="product-model-count">${models.length} modelo(s)</span>
          <span class="status-pill ${product.active === false ? "red" : "green"}">${product.active === false ? "Inativo" : "Ativo"}</span>
          <div class="row-actions product-group-actions">${actions}</div>
        </div>
        ${expanded ? renderProductModelsTable(product, models, canEdit) : ""}
      </article>
    `;
        }).join("")}</div>
      </div>
    </section>
  `;
}

function productMiniChip(product = {}) {
  return `<button type="button" data-product-action="quote" data-product="${product.id}">${product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="">` : `<span>${escapeHtml(product.categoryIcon || product.name?.slice(0, 2) || "PR")}</span>`}<b>${escapeHtml(product.name || "Produto")}</b></button>`;
}

function productCatalogCard(product = {}, canEdit = false) {
  const models = productModels(product);
  return `
    <article class="catalog-product-card ${product.active === false ? "inactive-product" : ""}">
      <button type="button" class="catalog-favorite-button ${product.favorite ? "active" : ""}" data-product-action="catalog-favorite" data-product="${product.id}" title="Favorito">${product.favorite ? "Fav" : "+"}</button>
      <div class="catalog-product-image">${product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="">` : `<span>${escapeHtml(product.categoryIcon || product.name?.slice(0, 2) || "PR")}</span>`}</div>
      <div class="catalog-product-body">
        <small>${escapeHtml(product.code || "Sem codigo")} | ${escapeHtml(product.category || "Sem categoria")}</small>
        <b>${escapeHtml(product.name || "Produto")}</b>
        <p>${escapeHtml(product.description || `${models.length} modelo(s), perguntas e rota produtiva vinculadas.`)}</p>
      </div>
      <div class="catalog-product-meta">
        <span class="status-pill ${product.active === false ? "red" : "green"}">${product.active === false ? "Inativo" : "Ativo"}</span>
        <span>${models.length} modelo(s)</span>
        <b>${money.format(product.salePrice || product.minPrice || 0)}</b>
      </div>
      <div class="catalog-card-actions">
        <button type="button" class="primary" data-product-action="quote" data-product="${product.id}">Usar no orcamento</button>
        <button type="button" data-product-action="catalog-preview" data-product="${product.id}">Detalhes</button>
        ${canEdit ? `<button type="button" data-product-action="edit" data-product="${product.id}">Editar</button>` : ""}
      </div>
    </article>
  `;
}

function renderProductModelsTable(product, models, canEdit) {
  return `
    <div class="product-models-wrap">
      <table class="product-model-table">
        <thead><tr><th>Modelo</th><th>Acabamento</th><th>Unidade</th><th>Variacao</th><th>Custo material/terceiro</th><th>Custo mao de obra</th><th>MP + MO</th><th>Valor de venda</th><th>Acoes</th></tr></thead>
        <tbody>
          ${models.map(model => `
            <tr class="${model.active === false ? "inactive-product" : ""}">
              <td><b>${escapeHtml(model.name)}</b><small>${model.active === false ? "Inativo" : `${(model.technicalQuestions || model.questions || []).length} pergunta(s)`}</small></td>
              <td>${escapeHtml(model.finish || "A definir")}</td>
              <td>${escapeHtml(model.unit || product.unit || "unidade")}</td>
              <td>${escapeHtml(modelVariationLabel(model.variation))}</td>
              <td>${money.format(model.materialCost || 0)}</td>
              <td>${money.format(model.laborCost || 0)}</td>
              <td><b>${money.format((model.materialCost || 0) + (model.laborCost || 0))}</b></td>
              <td><b>${money.format(model.salePrice || 0)}</b></td>
              <td class="row-actions">
                ${canEdit ? `<button type="button" data-product-action="model-edit" data-product="${product.id}" data-model="${model.id}">Editar</button><button type="button" data-product-action="model-duplicate" data-product="${product.id}" data-model="${model.id}">Duplicar</button><button type="button" data-product-action="model-questions" data-product="${product.id}" data-model="${model.id}">Perguntas</button><button type="button" data-product-action="model-delete" data-product="${product.id}" data-model="${model.id}">Inativar</button>` : `<span class="blocked-note">Sem permissao</span>`}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTechnicalSheet() {
  const product = state.products.find(item => item.id === document.getElementById("technical-product")?.value) || state.products[0];
  const sheet = product?.technicalSheet || {};
  document.getElementById("technical-preview").innerHTML = detailPanel([
    ["Materiais padrão", (sheet.standardMaterials || []).join(", ") || "Não informado"],
    ["Equipamentos usados", (sheet.equipment || []).join(", ") || "Não informado"],
    ["Tempo médio", `${sheet.averageProductionMinutes || 0} min`],
    ["Setores obrigatórios", (sheet.requiredSectors || []).join(" > ") || "Não informado"],
    ["Perda técnica padrão", `${sheet.defaultWastePercent || 0}%`]
  ], sheet, "Ver ficha completa");
}

function renderAdminQuestions() {
  const product = state.products.find(item => item.id === document.getElementById("admin-product")?.value) || state.products[0];
  const list = product?.questions || [];
  document.getElementById("admin-question-list").innerHTML = list.map(question => `
    <div class="job">
      <b>${question.label}</b>
      <p>Tipo de resposta: ${businessLabel(question.type)}</p>
      <p>${impactSummary(question)}</p>
      <details class="business-details"><summary>Ver detalhes</summary>${formatRawDetails({ pergunta: question.key, tipo: question.type, opcoes: question.options, impacto: question.priceImpact })}</details>
    </div>
  `).join("") || "<p>Nenhuma pergunta configurada.</p>";
}

function impactSummary(question) {
  const impact = question.priceImpact || {};
  const parts = Object.keys(impact).map(key => `${key}: ${impact[key]}`);
  const options = (question.options || []).map(option => `${option.label} (${Object.keys(option.priceImpact || {}).join(", ")})`);
  return [...parts, ...options].join(" | ") || "Sem impacto direto";
}

function renderOperationalSelects() {
  const orderOptions = state.orders.map(order => `<option value="${order.id}">${order.id} - ${order.jobName}</option>`).join("");
  const billableOrderOptions = state.orders.filter(orderIsBillable).map(order => `<option value="${order.id}">${order.id} - ${order.jobName}</option>`).join("");
  ["team-order", "event-order", "move-order", "real-order", "problem-order", "check-order", "pcp-report-order"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = orderOptions;
  });
  const payOrder = document.getElementById("pay-order");
  if (payOrder) payOrder.innerHTML = billableOrderOptions;
  const sectors = ["aguardando liberacao", "liberada para PCP", "Impressao", "Corte", "Acabamento", "Serralheria", "ACM", "Pintura", "LED", "Montagem", "Instalacao", "Conferencia", "Com problema", "Finalizada", "Entregue"];
  const sectorSelect = document.getElementById("move-next-sector");
  if (sectorSelect) sectorSelect.innerHTML = sectors.map(sector => `<option>${sector}</option>`).join("");
  document.getElementById("quick-customer").innerHTML = `<option value="">Sem cliente</option>` + state.customers.map(customer => `<option value="${customer.id}">${customer.name}</option>`).join("");
  document.getElementById("opex-order").innerHTML = `<option value="">Sem O.S.</option>` + orderOptions;
  document.getElementById("cash-expense-category").innerHTML = state.expenseCategories.map(category => `<option>${category}</option>`).join("");
  const realMaterial = document.getElementById("real-material");
  if (realMaterial) realMaterial.innerHTML = `<option value="">Sem material</option>` + state.materials.map(material => `<option value="${material.id}">${material.name} (${material.stock} ${material.unit})</option>`).join("");
  renderOrderTools();
  renderPcpRealReport();
}

function renderSelectedHistory() {
  const orderId = document.getElementById("history-order")?.value;
  const order = state.orders.find(item => item.id === orderId) || state.orders[0];
  document.getElementById("order-history").innerHTML = (order?.history || []).map(item => `<div class="timeline-item"><b>${businessLabel(item.action)}</b><span>${item.actor} - ${new Date(item.at).toLocaleString("pt-BR")}</span><p>${item.details || "Registro de andamento da O.S."}</p></div>`).join("") || "<p>Sem histórico registrado.</p>";
}

function renderSelectedPostcalc() {
  const orderId = document.getElementById("postcalc-order")?.value;
  const order = state.orders.find(item => item.id === orderId) || state.orders[0];
  const report = order?.postCalculation || {};
  document.getElementById("postcalc-result").innerHTML = detailPanel([
    ["Custo previsto", money.format(report.predictedCost || 0)],
    ["Custo real", money.format(report.realCost || 0)],
    ["Margem prevista", `${report.predictedMargin || 0}%`],
    ["Margem real", `${report.realMargin || 0}%`],
    ["Situação", Number(report.realCost || 0) > Number(report.predictedCost || 0) ? "Custo real acima do previsto" : "Dentro do previsto"]
  ], report, "Ver comparação completa");
}

function renderControl() {
  const hasControl = Object.values(state.permissions || {}).some(Boolean);
  document.querySelectorAll('button[data-view="control"]').forEach(button => {
    const allowed = hasControl || isAdminUser();
    button.style.display = allowed ? "" : "none";
    if (allowed) enableNavigationButton(button);
  });
  document.querySelectorAll('button[data-view="settings"]').forEach(button => {
    const allowed = canUsePermission("settings");
    button.style.display = allowed ? "" : "none";
    if (allowed) enableNavigationButton(button);
  });
  document.querySelectorAll("[data-required-permission]").forEach(button => {
    const permission = button.dataset.requiredPermission;
    const allowed = canUsePermission(permission);
    button.style.display = allowed ? "" : "none";
    if (allowed) enableNavigationButton(button);
  });
  document.querySelectorAll(".nav-section").forEach(section => {
    const hasVisible = [...section.querySelectorAll(".nav-children button")].some(button => button.style.display !== "none");
    section.style.display = hasVisible ? "" : "none";
    if (hasVisible) enableNavigationButton(section.querySelector(".nav-parent"));
  });
  renderPaymentOrderInfo();
  document.getElementById("alerts-list").innerHTML = state.alerts.map(alert => `<div class="alert ${alert.severity}"><b>${businessLabel(alert.type)}</b><span>${alert.message || "Existe uma pendência que precisa ser conferida."}</span><small>Ação sugerida: confira o responsável, o prazo e o módulo relacionado.</small></div>`).join("");
  document.getElementById("audit-list").innerHTML = state.audit.slice().reverse().map(log => `<div class="timeline-item"><b>${businessLabel(log.action)}</b><span>${log.user} - ${new Date(log.createdAt).toLocaleString("pt-BR")}</span><p>${businessLabel(log.entity)} ${log.entityId ? `(${log.entityId})` : ""}: ${log.details || "Registro de alteração no sistema."}</p></div>`).join("");
  document.getElementById("materials-table").innerHTML = state.materials.map(material => `<tr><td>${material.name}</td><td>${material.unit}</td><td>${material.stock}</td><td>${material.minStock}</td><td>${money.format(material.cost)}</td></tr>`).join("");
  document.getElementById("daily-summary").innerHTML = Object.entries(state.dailySummary || {}).map(([key, value]) => managerCard(businessLabel(key), readableValue(key, value), key.toLowerCase().includes("pending") || key.toLowerCase().includes("open") ? countStatus(value, 1, 3000) : "ok", businessDescription(key))).join("");
  document.getElementById("control-blind-note").textContent = isAdminUser() ? "Admin/Gestor: resumo completo liberado." : "Operador: totais esperados ocultos.";
}

function enableNavigationButton(button) {
  if (!button) return;
  button.disabled = false;
  button.removeAttribute("aria-disabled");
  button.classList.remove("inactive-action");
}

function renderSettings() {
  if (!document.getElementById("cost-mode")) return;
  prepareCompaniesPanel();
  renderCompaniesPanel();
  document.getElementById("cost-mode").value = state.costConfig.mode || "automatico";
  document.getElementById("cost-human-hour").value = state.costConfig.humanHourValue || state.costConfig.automaticHumanHourValue || 0;
  document.getElementById("cost-machine-hour").value = state.costConfig.machineHourValue || 0;
  document.getElementById("cost-fixed").value = state.costConfig.monthlyFixedCost || 0;
  document.getElementById("cost-km").value = state.costConfig.displacementCostPerKm || 0;
  document.getElementById("cost-margin").value = state.costConfig.defaultMarginPercent || 0;
  document.getElementById("cost-tax").value = state.costConfig.taxPercent || 0;
  document.getElementById("cost-commission").value = state.costConfig.commissionPercent || 0;
  document.getElementById("cost-waste").value = state.costConfig.wastePercent || 0;
  document.getElementById("cost-production-rule").value = state.costConfig.productionReleaseRule || "produzir_com_sinal";
  const employeesTable = document.getElementById("employees-table");
  const employeeHeader = employeesTable?.closest("table")?.querySelector("thead");
  if (employeeHeader) employeeHeader.innerHTML = `<tr><th>Nome</th><th>Funcao</th><th>Setor</th><th>Telefone</th><th>E-mail</th><th>Admissao</th><th>Salario</th><th>Horas</th><th>Valor hora</th><th>Comissao</th><th>Status</th></tr>`;
  if (employeesTable) employeesTable.innerHTML = state.employees.map(employee => `<tr><td>${employee.name}</td><td>${employee.role}</td><td>${employee.sector}</td><td>${employee.phone || "-"}</td><td>${employee.email || "-"}</td><td>${employee.admissionDate || "-"}</td><td>${money.format(employee.salary)}</td><td>${employee.monthlyHours}</td><td>${money.format(employee.hourValue)}</td><td>${employee.commissionPercent}%</td><td>${employee.active ? "Ativo" : "Inativo"}</td></tr>`).join("");
  document.getElementById("expenses-list").innerHTML = state.expenses.map(expense => `<div class="small-card"><b>${expense.type}</b><span>${expense.description}</span><small>${money.format(expense.amount)}</small></div>`).join("");
  document.getElementById("composition-product").innerHTML = state.products.map(product => `<option value="${product.id}">${product.code || ""} ${product.name}</option>`).join("");
  document.getElementById("composition-list").innerHTML = state.compositions.map(item => `<div class="small-card"><b>${item.name}</b><span>${item.category}</span><small>Margem ${item.marginPercent}% | Prazo ${item.deadlineDays} dias</small><small>${item.productionFlow.join(" > ")}</small></div>`).join("");
  document.getElementById("cost-center-list").innerHTML = state.costCenters.map(item => `<div class="small-card"><b>${item.name}</b><span>${item.type}</span><small>Orçamento: ${money.format(item.monthlyBudget || 0)}</small></div>`).join("");
  renderSectorOptions();
  renderSectors();
}

function prepareCompaniesPanel() {
  const settings = document.getElementById("settings");
  if (!settings || document.getElementById("companies-panel")) return;
  const tabs = settings.querySelector(".module-tabs");
  tabs?.insertAdjacentHTML("afterend", `
    <div class="panel stack-gap" id="companies-panel">
      <div class="title compact-title">
        <div><h2>Empresas / Lojas</h2><p>Controle lojas separadas para caixa, financeiro, O.S., producao, estoque e relatorios.</p></div>
      </div>
      <div class="grid two">
        <form id="company-form" class="stack-gap">
          <div class="form-row"><label>Nome da loja<input id="company-name" placeholder="Loja Fortaleza"></label><label>Nome fantasia<input id="company-trade" placeholder="Fortaleza Centro"></label></div>
          <div class="form-row"><label>Cidade<input id="company-city" placeholder="Fortaleza"></label><label>Estado<input id="company-state" placeholder="CE"></label></div>
          <div class="form-row"><label>CNPJ<input id="company-cnpj" placeholder="Opcional"></label><label>Telefone<input id="company-phone" placeholder="Opcional"></label></div>
          <label>Endereco<input id="company-address" placeholder="Rua, numero, bairro"></label>
          <button class="primary">Cadastrar loja</button>
        </form>
        <form id="company-settings-form" class="stack-gap">
          <label>Loja padrao<select id="company-default"></select></label>
          <label class="check-line"><input id="company-share-customers" type="checkbox"> Clientes compartilhados entre lojas</label>
          <label class="check-line"><input id="company-share-products" type="checkbox"> Produtos compartilhados entre lojas</label>
          <button class="primary">Salvar configuracao de lojas</button>
        </form>
      </div>
      <div id="companies-list" class="mini-grid"></div>
    </div>
  `);
  document.getElementById("company-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    await api("/api/companies", {
      method: "POST",
      body: {
        name: document.getElementById("company-name").value,
        tradeName: document.getElementById("company-trade").value,
        city: document.getElementById("company-city").value,
        state: document.getElementById("company-state").value,
        cnpj: document.getElementById("company-cnpj").value,
        phone: document.getElementById("company-phone").value,
        address: document.getElementById("company-address").value
      }
    });
    event.target.reset();
    await loadAll();
    showToast("Loja cadastrada com sucesso.", "success");
  });
  document.getElementById("company-settings-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    await api("/api/company-settings", {
      method: "POST",
      body: {
        defaultCompanyId: document.getElementById("company-default").value,
        shareCustomers: document.getElementById("company-share-customers").checked,
        shareProducts: document.getElementById("company-share-products").checked
      }
    });
    await loadAll();
    showToast("Configuracao de lojas salva.", "success");
  });
}

function renderCompaniesPanel() {
  const list = document.getElementById("companies-list");
  const defaultSelect = document.getElementById("company-default");
  if (!list || !defaultSelect) return;
  const realCompanies = (state.companies || []).filter(company => company.id !== "all");
  defaultSelect.innerHTML = realCompanies.map(company => `<option value="${company.id}">${company.tradeName || company.name}</option>`).join("");
  defaultSelect.value = state.companySettings?.defaultCompanyId || realCompanies.find(company => company.default)?.id || realCompanies[0]?.id || "";
  document.getElementById("company-share-customers").checked = state.companySettings?.shareCustomers !== false;
  document.getElementById("company-share-products").checked = state.companySettings?.shareProducts !== false;
  list.innerHTML = realCompanies.map(company => `
    <div class="small-card company-card ${company.id === state.currentCompanyId ? "active-company" : ""}">
      <b>${company.tradeName || company.name}</b>
      <span>${company.city || "Cidade nao informada"}${company.state ? ` / ${company.state}` : ""}</span>
      <small>${company.default ? "Loja padrao" : "Loja cadastrada"} | ${company.active ? "Ativa" : "Inativa"}</small>
      <small>${company.id === state.currentCompanyId ? "Visualizando agora" : "Disponivel para permissao"}</small>
    </div>
  `).join("") || `<div class="premium-empty-state"><b>Nenhuma loja cadastrada.</b><span>Cadastre a primeira unidade para separar operacao, caixa e relatorios.</span></div>`;
}

function renderValidationReport() {
  const report = state.validationReport;
  if (!document.getElementById("validation-summary")) return;
  if (!report) {
    document.getElementById("validation-summary").innerHTML = "";
    document.getElementById("validation-decision").textContent = "Validacao ainda nao executada.";
    document.getElementById("validation-sections").innerHTML = "";
    return;
  }
  const statusClass = report.status === "OK" ? "green" : report.status === "Erro" ? "red" : "yellow";
  document.getElementById("validation-summary").innerHTML = [
    ["Status geral", report.status],
    ["Modulos testados", report.modulesTested],
    ["Modulos aprovados", report.modulesApproved],
    ["Modulos com falha", report.modulesWithFailure],
    ["Conclusao", `${report.completionPercent}%`],
    ["Classificacao", report.classification]
  ].map(item => `<div class="card"><span>${item[0]}</span><strong>${item[1]}</strong></div>`).join("");
  document.getElementById("validation-decision").innerHTML = `<div class="alert ${statusClass}"><b>${report.level3Decision}</b><span>Falhas criticas: ${report.criticalFailures}. Gerado em ${new Date(report.generatedAt).toLocaleString("pt-BR")}.</span></div>`;
  document.getElementById("validation-sections").innerHTML = (report.sections || []).map(section => `
    <div class="validation-section">
      <div class="validation-head"><b>${section.title}</b><span class="status-pill ${section.status === "OK" ? "finance" : "production"}">${section.status}</span></div>
      <table><thead><tr><th>Teste</th><th>Resultado</th><th>Detalhes</th></tr></thead><tbody>
        ${(section.tests || []).map(test => `<tr><td>${test.name}</td><td><span class="status-pill ${test.passed ? "finance" : "production"}">${test.result}</span></td><td>${test.details || ""}${test.missing?.length ? ` | Faltando: ${Array.isArray(test.missing) ? test.missing.map(item => typeof item === "string" ? item : item.id || item.kind || "item").join(", ") : ""}` : ""}</td></tr>`).join("")}
      </tbody></table>
    </div>
  `).join("");
}

function renderPaymentOrderInfo() {
  const order = state.orders.find(item => item.id === document.getElementById("pay-order")?.value && orderIsBillable(item)) || state.orders.find(orderIsBillable);
  if (!order) return;
  document.getElementById("pay-customer").value = order.customerName || "";
  document.getElementById("pay-total").value = money.format(order.total || 0);
}

function renderPermissions() {
  document.querySelectorAll("[data-permission]").forEach(input => {
    input.checked = Boolean(state.permissions[input.dataset.permission]);
    input.disabled = !isAdminUser();
  });
}

function labelize(key) {
  const map = { ordersMade: "O.S. feitas", ordersBilled: "O.S. faturadas", pendingPaymentOrders: "O.S. pendentes", signalOrders: "O.S. com sinal", pix: "Pix", credit: "Crédito", debit: "Débito", cash: "Dinheiro/à vista", fiado: "Fiado", openTotal: "Total em aberto", receivedTotal: "Total recebido", predictedTotal: "Total previsto", expectedByMethod: "Esperado por forma" };
  return businessLabel(key);
}

function moneyOrNumber(key, value) {
  return ["pix", "credit", "debit", "cash", "fiado", "openTotal", "receivedTotal", "predictedTotal"].includes(key) ? money.format(value) : value;
}

function formatSummaryValue(value) {
  if (value && typeof value === "object") return Object.entries(value).map(([key, amount]) => `${key}: ${money.format(amount)}`).join(" | ");
  return value;
}

function renderQuickSales() {
  safeSetHTML("quick-sales-table", state.quickSales.map(sale => `
    <tr><td>${sale.description}</td><td>${sale.productCode || ""}</td><td>${sale.quantity}</td><td>${money.format(sale.amount || sale.total)}</td><td>${sale.paymentMethod}</td><td><span class="status-pill finance">${businessLabel(sale.billingStatus || "faturada")}</span><small>${businessLabel(sale.paymentStatus || "recebida")}</small></td><td><span class="status-pill production">${businessLabel(sale.cashImpact || "entered_cash")}</span></td></tr>
  `).join(""), true);
  const report = state.cashReport || {};
  const reportEl = document.getElementById("cash-report-cards");
  if (reportEl) reportEl.innerHTML = [
    ["Pix", report.pix || 0],
    ["Crédito", report.credit || 0],
    ["Débito", report.debit || 0],
    ["Dinheiro", report.cash || 0],
    ["Boleto", report.boleto || 0],
    ["Fiado", report.fiado || 0],
    ["Sinais", report.signals || 0],
    ["Recebido", report.receivedTotal || 0],
    ["Despesas", report.expensesTotal || 0],
    ["Sangrias", report.sangrias || 0],
    ["Suprimentos", report.suprimentos || 0],
    ["Saldo final", report.finalBalance || 0]
  ].map(item => managerCard(item[0], money.format(item[1]), item[0].includes("Despesas") || item[0].includes("Sangrias") ? countStatus(item[1], 1, 1000) : "ok", "Resumo do caixa aberto e dos movimentos registrados.")).join("");
}

function renderCashOrders() {
  const rows = state.orders.filter(order => orderIsBillable(order) && Number(order.paidAmount || 0) < Number(order.total || 0));
  const table = document.getElementById("cash-orders-table");
  if (!table) return;
  table.innerHTML = rows.map(order => `<tr><td>${order.id}</td><td>${order.customerName}</td><td>${money.format(order.total || 0)}</td><td>${order.financialStatus}</td><td><button data-action="bill-order" data-order="${order.id}">Registrar pagamento</button></td></tr>`).join("");
}

function renderOperationalExpenses() {
  document.getElementById("opex-category").innerHTML = state.expenseCategories.map(category => `<option>${category}</option>`).join("");
  document.getElementById("opex-vehicle").innerHTML = `<option value="">Sem veículo</option>` + state.vehicles.map(vehicle => `<option value="${vehicle.id}">${vehicle.vehicle} - ${vehicle.plate}</option>`).join("");
  document.getElementById("accountability-advance").innerHTML = state.advances.map(advance => `<option value="${advance.id}">${advance.team} - ${money.format(advance.receivedValue)}</option>`).join("");
  document.getElementById("operational-expense-table").innerHTML = state.operationalExpenses.map(expense => `<tr><td>${expense.date} ${expense.time}</td><td>${expense.responsible}</td><td>${expense.category}</td><td>${expense.sector}</td><td>${expense.orderId || "-"}</td><td>${money.format(expense.value)}</td><td>${expense.status}</td></tr>`).join("");
  document.getElementById("dre-cards").innerHTML = Object.entries(state.dre).map(([key, value]) => managerCard(labelizeDre(key), money.format(value), key === "result" && value < 0 ? "critical" : "ok", "Resultado gerencial alimentado por caixa, financeiro e custos reais.")).join("");
  document.getElementById("expense-report-cards").innerHTML = `
    <div class="small-card"><b>Despesas do dia</b><span>${money.format(state.expenseReports.day || 0)}</span></div>
    <div class="small-card"><b>Despesas do mês</b><span>${money.format(state.expenseReports.month || 0)}</span></div>
    <div class="small-card"><b>Por categoria</b><span>${formatReportObject(state.expenseReports.byCategory)}</span></div>
    <div class="small-card"><b>Por setor</b><span>${formatReportObject(state.expenseReports.bySector)}</span></div>
    <div class="small-card"><b>Por funcionário</b><span>${formatReportObject(state.expenseReports.byResponsible)}</span></div>
    <div class="small-card"><b>Por veículo</b><span>${formatReportObject(state.expenseReports.byVehicle)}</span></div>
    <div class="small-card"><b>Por O.S.</b><span>${formatReportObject(state.expenseReports.byOrder)}</span></div>
  `;
  document.getElementById("vehicle-report").innerHTML = state.vehicles.map(vehicle => `<div class="small-card"><b>${vehicle.vehicle}</b><span>${vehicle.plate} | ${vehicle.driver}</span><small>Custo/km: ${money.format(vehicle.costPerKm || 0)}</small><small>Custo instalação: ${money.format(vehicle.installationCost || 0)}</small></div>`).join("");
}

function visitStatusLabel(status) {
  return {
    requested: "Solicitada",
    scheduled: "Agendada",
    in_progress: "Em atendimento",
    completed: "Concluida",
    canceled: "Cancelada"
  }[status] || status || "Solicitada";
}

function visitTypeLabel(type) {
  return {
    measurement: "Medicao",
    installation_check: "Conferencia de instalacao",
    doubt: "Duvida tecnica",
    survey: "Levantamento"
  }[type] || type || "Medicao";
}

function technicalVisitTable(visits, emptyMessage = "Nenhuma visita encontrada.") {
  return focusedOrderRows(visits, ["Cliente", "Tipo", "Data", "Responsavel", "Status", "Vinculo", "Acoes"], visit => {
    const date = String(visit.scheduledDate || visit.requestedDate || "-").replace("T", " ").slice(0, 16);
    const links = [visit.relatedQuoteId, visit.relatedOrderId].filter(Boolean).join(" / ") || "-";
    const actions = [
      `<button type="button" data-visit-action="edit" data-visit="${visit.id}">Editar</button>`,
      visit.status === "requested" ? `<button type="button" data-visit-action="schedule" data-visit="${visit.id}">Agendar</button>` : "",
      !["completed", "canceled"].includes(visit.status) ? `<button type="button" data-visit-action="reschedule" data-visit="${visit.id}">Reagendar</button>` : "",
      visit.status === "scheduled" ? `<button type="button" class="primary" data-visit-action="start" data-visit="${visit.id}">Iniciar</button>` : "",
      !["completed", "canceled"].includes(visit.status) ? `<button type="button" class="primary" data-visit-action="complete" data-visit="${visit.id}">Concluir</button>` : "",
      !["completed", "canceled"].includes(visit.status) ? `<button type="button" data-visit-action="cancel" data-visit="${visit.id}">Cancelar</button>` : ""
    ].filter(Boolean).join("");
    return `<tr><td><b>${escapeHtml(visit.customerName || "Cliente")}</b><small>${escapeHtml(visit.address || "")}</small></td><td>${visitTypeLabel(visit.visitType)}</td><td>${date}</td><td>${escapeHtml(visit.responsibleEmployeeName || "A definir")}</td><td><span class="status-pill production">${visitStatusLabel(visit.status)}</span></td><td>${escapeHtml(links)}</td><td class="row-actions">${actions}</td></tr>`;
  }, emptyMessage);
}

function renderTechnicalVisits() {
  if (!document.getElementById("technical-visit-form")) return;
  const preserve = id => document.getElementById(id)?.value || "";
  const customerValue = preserve("visit-customer");
  const employeeValue = preserve("visit-employee");
  const quoteValue = preserve("visit-quote");
  const orderValue = preserve("visit-order");
  safeSetHTML("visit-customer", `<option value="">Selecione o cliente</option>${state.customers.map(customer => `<option value="${customer.id}">${escapeHtml(customer.name)}</option>`).join("")}`);
  safeSetHTML("visit-employee", `<option value="">A definir</option>${state.employees.filter(employee => employee.active !== false).map(employee => `<option value="${employee.id}">${escapeHtml(employee.name)} - ${escapeHtml(employee.sector || employee.role || "")}</option>`).join("")}`);
  safeSetHTML("visit-quote", `<option value="">Sem orcamento</option>${state.quotes.map(quote => `<option value="${quote.id}">${escapeHtml(quote.quoteNumber || quote.id)} - ${escapeHtml(customerName(quote.customerId))}</option>`).join("")}`);
  safeSetHTML("visit-order", `<option value="">Sem O.S.</option>${state.orders.map(order => `<option value="${order.id}">${escapeHtml(order.id)} - ${escapeHtml(order.customerName || "")}</option>`).join("")}`);
  if (state.customers.some(customer => customer.id === customerValue)) document.getElementById("visit-customer").value = customerValue;
  if (state.employees.some(employee => employee.id === employeeValue)) document.getElementById("visit-employee").value = employeeValue;
  if (state.quotes.some(quote => quote.id === quoteValue)) document.getElementById("visit-quote").value = quoteValue;
  if (state.orders.some(order => order.id === orderValue)) document.getElementById("visit-order").value = orderValue;
  if (!document.getElementById("visit-requested-date").value) document.getElementById("visit-requested-date").value = new Date().toISOString().slice(0, 10);

  const filterEmployee = document.getElementById("visit-filter-employee");
  const currentFilterEmployee = filterEmployee?.value || "";
  if (filterEmployee) {
    filterEmployee.innerHTML = `<option value="">Todos</option>${state.employees.filter(employee => employee.active !== false).map(employee => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`).join("")}`;
    filterEmployee.value = currentFilterEmployee;
  }
  const reportEmployee = document.getElementById("visit-report-employee");
  const currentReportEmployee = reportEmployee?.value || "";
  if (reportEmployee) {
    reportEmployee.innerHTML = `<option value="">Todos</option>${state.employees.filter(employee => employee.active !== false).map(employee => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`).join("")}`;
    reportEmployee.value = currentReportEmployee;
  }
  const filterDate = document.getElementById("visit-filter-date")?.value || "";
  const filterStatus = document.getElementById("visit-filter-status")?.value || "";
  const filtered = state.technicalVisits.filter(visit => (!filterDate || String(visit.scheduledDate || visit.requestedDate || "").startsWith(filterDate)) && (!currentFilterEmployee || visit.responsibleEmployeeId === currentFilterEmployee) && (!filterStatus || visit.status === filterStatus));
  safeSetHTML("visits-agenda-table", technicalVisitTable(filtered, "Nenhuma visita para os filtros informados."));
  const open = state.technicalVisits.filter(visit => !["completed", "canceled"].includes(visit.status));
  safeSetHTML("visits-open-summary", [
    ["Solicitadas", open.filter(visit => visit.status === "requested").length],
    ["Agendadas", open.filter(visit => visit.status === "scheduled").length],
    ["Em atendimento", open.filter(visit => visit.status === "in_progress").length],
    ["Total em aberto", open.length]
  ].map(([label, value]) => `<div class="focused-summary-item"><span>${label}</span><b>${value}</b></div>`).join(""));
  safeSetHTML("visits-open-table", technicalVisitTable(open, "Nenhuma visita tecnica em aberto."));
  safeSetHTML("visits-completed-table", technicalVisitTable(state.technicalVisits.filter(visit => visit.status === "completed"), "Nenhuma visita tecnica concluida."));
  const report = state.technicalVisitReports || {};
  safeSetHTML("visits-report-summary", [
    ["Visitas no periodo", report.total || 0],
    ["Pendentes", report.pending || 0],
    ["Concluidas", report.completed || 0],
    ["Convertidas em orcamento/O.S.", report.converted || 0]
  ].map(([label, value]) => `<div class="focused-summary-item"><span>${label}</span><b>${value}</b></div>`).join(""));
  safeSetHTML("visits-report-table", technicalVisitTable(report.visits || [], "Nenhuma visita encontrada para o relatorio."));
}

function technicalVisitReportParams() {
  const value = id => document.getElementById(id)?.value || "";
  const params = new URLSearchParams({
    dateFrom: value("visit-report-from"),
    dateTo: value("visit-report-to"),
    status: value("visit-report-status"),
    customer: value("visit-report-customer"),
    employeeId: value("visit-report-employee")
  });
  [...params.entries()].forEach(([key, entry]) => { if (!entry) params.delete(key); });
  return params;
}

function technicalVisitReportDocument(report = state.technicalVisitReports || {}) {
  const company = currentCompanyForDocument();
  const rows = (report.visits || []).map(visit => `<tr><td><b>${escapeHtml(visit.customerName || "Cliente")}</b><small>${escapeHtml(visit.address || "-")}</small></td><td>${escapeHtml(visit.responsibleEmployeeName || "A definir")}</td><td>${escapeHtml(String(visit.scheduledDate || visit.requestedDate || "-").replace("T", " ").slice(0, 16))}</td><td>${visitStatusLabel(visit.status)}</td><td>${escapeHtml(visit.measurementNotes || "-")}</td><td>${escapeHtml((visit.photos || []).join(", ") || "-")}</td><td>${escapeHtml(visit.notes || "-")}</td></tr>`).join("");
  return `<article class="print-document production-report-document"><section class="print-page"><header class="report-document-header"><div><span>PrintSys | ${escapeHtml(company.tradeName || company.name || "Empresa")}</span><h1>RELATORIO DE VISITAS TECNICAS</h1></div><div><b>${report.total || 0} visita(s)</b><small>Emitido por ${escapeHtml(state.user?.name || "Usuario")} em ${new Date().toLocaleString("pt-BR")}</small></div></header><div class="report-filter-summary"><span>Loja: ${escapeHtml(state.currentCompanyName || "Atual")}</span><span>Concluidas: ${report.completed || 0}</span><span>Pendentes: ${report.pending || 0}</span></div><table class="production-report-table"><thead><tr><th>Cliente / endereco</th><th>Responsavel</th><th>Data</th><th>Status</th><th>Medidas</th><th>Fotos/anexos</th><th>Observacoes</th></tr></thead><tbody>${rows || `<tr><td colspan="7">Nenhuma visita encontrada.</td></tr>`}</tbody></table></section></article>`;
}

async function refreshTechnicalVisitReport(print = false) {
  const report = await api(`/api/technical-visits/reports?${technicalVisitReportParams().toString()}`);
  state.technicalVisitReports = report;
  renderTechnicalVisits();
  if (print) openDocumentPreview("Relatorio de visitas tecnicas", technicalVisitReportDocument(report), true);
  return report;
}

async function exportTechnicalVisitReport() {
  const headers = {};
  if (state.currentCompanyId) headers["x-company-id"] = state.currentCompanyId;
  const response = await fetch(`/api/technical-visits/reports/csv?${technicalVisitReportParams().toString()}`, { headers });
  if (!response.ok) throw new Error((await response.json()).error || "Nao foi possivel exportar visitas");
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "relatorio-visitas-tecnicas.csv";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Relatorio de visitas exportado.", "success");
}

function applyVisitCustomer() {
  const customer = state.customers.find(item => item.id === document.getElementById("visit-customer")?.value);
  if (!customer) return;
  document.getElementById("visit-phone").value = customer.phone || customer.mobile || "";
  document.getElementById("visit-address").value = customer.address || "";
  document.getElementById("visit-city").value = customer.city || "";
  document.getElementById("visit-neighborhood").value = customer.neighborhood || "";
}

async function handleTechnicalVisitSubmit(event) {
  event.preventDefault();
  const id = document.getElementById("technical-visit-id").value;
  const customer = state.customers.find(item => item.id === document.getElementById("visit-customer").value);
  const employee = state.employees.find(item => item.id === document.getElementById("visit-employee").value);
  const body = {
    customerId: customer?.id || "",
    customerName: customer?.name || "",
    phone: document.getElementById("visit-phone").value,
    address: document.getElementById("visit-address").value,
    city: document.getElementById("visit-city").value,
    neighborhood: document.getElementById("visit-neighborhood").value,
    referencePoint: document.getElementById("visit-reference").value,
    requestedDate: document.getElementById("visit-requested-date").value,
    scheduledDate: document.getElementById("visit-scheduled-date").value,
    responsibleEmployeeId: employee?.id || "",
    responsibleEmployeeName: employee?.name || "",
    visitType: document.getElementById("visit-type").value,
    notes: document.getElementById("visit-notes").value,
    measurementNotes: document.getElementById("visit-measurement-notes").value,
    photos: document.getElementById("visit-photos").value.split(",").map(item => item.trim()).filter(Boolean),
    relatedQuoteId: document.getElementById("visit-quote").value,
    relatedOrderId: document.getElementById("visit-order").value
  };
  try {
    await api(id ? `/api/technical-visits/${id}` : "/api/technical-visits", { method: id ? "PATCH" : "POST", body });
    event.currentTarget.reset();
    document.getElementById("technical-visit-id").value = "";
    await loadAll();
    view("visits-open");
    showToast(id ? "Visita tecnica atualizada." : "Visita tecnica criada.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function handleTechnicalVisitAction(button) {
  const action = button.dataset.visitAction;
  if (action === "generate-report") {
    await refreshTechnicalVisitReport(false);
    showToast("Relatorio de visitas atualizado.", "success");
    return;
  }
  if (action === "print-report") {
    await refreshTechnicalVisitReport(true);
    return;
  }
  if (action === "export-report") {
    await exportTechnicalVisitReport();
    return;
  }
  if (action === "clear") {
    document.getElementById("technical-visit-form")?.reset();
    document.getElementById("technical-visit-id").value = "";
    renderTechnicalVisits();
    return;
  }
  if (action === "clear-filters") {
    document.getElementById("visit-filter-form")?.reset();
    renderTechnicalVisits();
    return;
  }
  const visit = state.technicalVisits.find(item => item.id === button.dataset.visit);
  if (!visit) return;
  if (action === "edit") {
    view("visits-new");
    document.getElementById("technical-visit-id").value = visit.id;
    document.getElementById("visit-customer").value = visit.customerId || "";
    document.getElementById("visit-phone").value = visit.phone || "";
    document.getElementById("visit-address").value = visit.address || "";
    document.getElementById("visit-city").value = visit.city || "";
    document.getElementById("visit-neighborhood").value = visit.neighborhood || "";
    document.getElementById("visit-reference").value = visit.referencePoint || "";
    document.getElementById("visit-requested-date").value = visit.requestedDate || "";
    document.getElementById("visit-scheduled-date").value = String(visit.scheduledDate || "").slice(0, 16);
    document.getElementById("visit-employee").value = visit.responsibleEmployeeId || "";
    document.getElementById("visit-type").value = visit.visitType || "measurement";
    document.getElementById("visit-notes").value = visit.notes || "";
    document.getElementById("visit-measurement-notes").value = visit.measurementNotes || "";
    document.getElementById("visit-photos").value = (visit.photos || []).join(", ");
    document.getElementById("visit-quote").value = visit.relatedQuoteId || "";
    document.getElementById("visit-order").value = visit.relatedOrderId || "";
    return;
  }
  const body = action === "schedule" ? { status: "scheduled", scheduledDate: visit.scheduledDate || new Date().toISOString().slice(0, 16) }
    : action === "start" ? { status: "in_progress" }
      : action === "cancel" ? { status: "canceled" }
        : {};
  if (action === "reschedule") {
    const nextDate = window.prompt("Nova data e hora da visita (AAAA-MM-DDTHH:mm):", String(visit.scheduledDate || visit.requestedDate || new Date().toISOString()).slice(0, 16));
    if (!nextDate) return;
    body.status = "scheduled";
    body.scheduledDate = nextDate;
  }
  if (action === "cancel") {
    const reason = window.prompt("Motivo do cancelamento:", visit.cancelReason || "");
    if (reason === null) return;
    body.cancelReason = reason;
    body.notes = [visit.notes, reason ? `Cancelamento: ${reason}` : ""].filter(Boolean).join("\n");
  }
  if (action === "complete") {
    const measurementNotes = visit.measurementNotes || window.prompt("Informe medidas e observacoes da visita:", "");
    if (!measurementNotes) {
      showToast("Informe as medidas/observacoes antes de concluir a visita.", "error");
      return;
    }
    body.measurementNotes = measurementNotes;
  }
  try {
    if (action === "complete") await api(`/api/technical-visits/${visit.id}/complete`, { method: "POST", body: { measurementNotes: body.measurementNotes, photos: visit.photos } });
    else await api(`/api/technical-visits/${visit.id}`, { method: "PATCH", body });
    await loadAll();
    showToast(`Visita ${visitStatusLabel(action === "schedule" || action === "reschedule" ? "scheduled" : action === "start" ? "in_progress" : action === "complete" ? "completed" : "canceled").toLowerCase()}.`, "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function labelizeDre(key) {
  const map = {
    revenue: "Receita",
    productionCosts: "Custos de producao",
    installationCosts: "Custos de instalacao",
    operationalExpenses: "Despesas operacionais",
    administrativeExpenses: "Despesas administrativas",
    result: "Resultado"
  };
  return map[key] || key;
}

function formatReportObject(value) {
  if (!value || !Object.keys(value).length) return "Sem dados";
  return Object.entries(value).map(([key, amount]) => `${key}: ${money.format(amount)}`).join(" | ");
}

function formatCountObject(value) {
  if (!value || !Object.keys(value).length) return "Sem dados";
  return Object.entries(value).map(([key, amount]) => `${key}: ${amount}`).join(" | ");
}

async function renderPcpLegacyUnused() {
  const data = await api("/api/production/pcp");
  document.getElementById("pcp-dashboard-cards").innerHTML = [
    ["O.S. em producao", data.dashboard?.running || 0],
    ["Atrasadas", data.dashboard?.late || 0],
    ["Paradas", data.dashboard?.stopped || 0],
    ["Finalizadas hoje", data.dashboard?.finishedToday || 0],
    ["Retrabalhos", data.dashboard?.reworks || 0],
    ["Custo acima previsto", data.dashboard?.realAbovePredicted || 0]
  ].map(item => managerCard(item[0], item[1], item[0].includes("Atrasadas") || item[0].includes("Paradas") || item[0].includes("Retrabalhos") || item[0].includes("Custo") ? countStatus(item[1], 1, 3) : "ok", "Indicador operacional do PCP para priorizar a produção.")).join("");
  document.getElementById("production-alerts").innerHTML = (data.alerts || []).map(alert => `<div class="alert ${alert.severity}"><b>${businessLabel(alert.type)}</b><span>${alert.message}</span><small>Ação sugerida: avaliar o setor, o responsável e o prazo da O.S.</small></div>`).join("") || "<p>Sem alertas de produção.</p>";
  document.getElementById("capacity-list").innerHTML = (data.capacity || []).map(item => `<div class="small-card"><b>${item.resource}</b><span>${item.sector}</span><small>Capacidade: ${item.dailyCapacity} ${item.unit}/dia</small><small>Ocupada: ${item.occupied} | Disponivel: ${item.available}</small></div>`).join("");
  const sectors = Object.keys(data.porSetor);
  document.getElementById("pcp-board").innerHTML = sectors.map(sector => `
    <div class="column">
      <h3>${sector}</h3>
      ${data.porSetor[sector].map(order => `<div class="job">
        <b>${order.id}</b>
        <p>${order.customerName}</p>
        <p>${order.productName || order.jobName}</p>
        <small>Composição: ${order.compositionName || "-"}</small>
        <small>Prazo: ${order.dueDate} | Prioridade: ${order.priority}</small>
        <small>Financeiro: ${order.financialStatus} | Arquivos: ${(order.files || []).length}</small>
        <small>Custo previsto: ${money.format(order.predictedCost || 0)} | Margem: ${order.predictedMargin ?? 0}%</small>
      </div>`).join("")}
    </div>
  `).join("");
  document.getElementById("production-detail-table").innerHTML = state.orders.map(order => {
    const flow = order.flow || [];
    const currentIndex = Math.max(flow.indexOf(order.productionStatus), 0);
    const next = flow[currentIndex + 1] || "Entrega";
    const product = state.products.find(item => item.id === order.productId)?.name || order.jobName;
    const problems = (order.events || []).filter(event => event.problem).length;
    return `<tr><td>${order.id}</td><td>${order.customerName}</td><td>${product}</td><td>${order.productionStatus}</td><td>${next}</td><td>${order.events?.[0]?.startedBy || "-"}</td><td>${order.productionStatus}</td><td>${order.dueDate}</td><td>${order.priority}</td><td>${(order.files || []).length}</td><td>${problems}</td></tr>`;
  }).join("");
  renderPcpRealReport();
}

function renderPcpRealReport() {
  const order = state.orders.find(item => item.id === document.getElementById("pcp-report-order")?.value) || state.orders[0];
  const report = order?.postCalculation || {};
  const raw = {
    material: report.profitability?.material,
    maoDeObra: report.profitability?.production,
    maquina: report.profitability?.machine,
    instalacao: report.profitability?.installation,
    despesas: report.profitability?.expenses,
    lucro: report.profitability?.profit,
    margemPrevista: report.predictedMargin,
    margemReal: report.realMargin,
    custoPrevisto: report.predictedCost,
    custoReal: report.realCost
  };
  document.getElementById("pcp-real-report").innerHTML = detailPanel([
    ["Material", money.format(report.profitability?.material || 0)],
    ["Mão de obra", money.format(report.profitability?.production || 0)],
    ["Máquina", money.format(report.profitability?.machine || 0)],
    ["Instalação", money.format(report.profitability?.installation || 0)],
    ["Lucro", money.format(report.profitability?.profit || 0)],
    ["Margem real", `${report.realMargin || 0}%`]
  ], raw, "Ver custo detalhado");
}

async function renderFinance() {
  const data = state.financeData && Object.keys(state.financeData).length ? state.financeData : await apiOptional("/api/finance", {});
  document.getElementById("finance-cards").innerHTML = [
    ["Faturado", data.billed],
    ["Recebido", data.paid],
    ["A receber", data.receivable],
    ["A pagar", data.payable || 0]
  ].map(item => managerCard(item[0], money.format(item[1]), item[0] === "A pagar" ? countStatus(item[1], 1, 5000) : "ok", "Resumo financeiro para conferência gerencial.")).join("");
  document.getElementById("finance-dashboard").innerHTML = Object.entries(data.dashboard || {}).map(([key, value]) => managerCard(businessLabel(key), readableValue(key, value), key.toLowerCase().includes("payable") || key.toLowerCase().includes("expenses") ? countStatus(value, 1, 5000) : "ok", businessDescription(key))).join("");
  document.getElementById("receivables-table").innerHTML = (data.receivables || []).map(item => `<tr><td>${item.origin}</td><td>${item.customerName}</td><td>${item.dueDate}</td><td>${money.format(item.amount)}</td><td>${money.format(item.balance)}</td></tr>`).join("");
  document.getElementById("payables-table").innerHTML = (data.payables || []).map(item => `<tr><td>${item.category}</td><td>${item.supplier}</td><td>${item.dueDate}</td><td>${money.format(item.amount)}</td><td>${money.format(item.balance)}</td></tr>`).join("");
  document.getElementById("cash-flow-cards").innerHTML = Object.entries(data.cashFlow || {}).map(([key, value]) => managerCard(businessLabel(key), money.format(value || 0), key === "outflows" ? countStatus(value, 1, 5000) : cashStatus(value), businessDescription(key))).join("");
  document.getElementById("delinquency-list").innerHTML = (data.delinquency || []).map(item => `<div class="small-card manager-card status-${countStatus(item.daysLate, 1, 15)}"><div class="manager-card-head"><b>${item.customerName}</b><span>${managerStatusLabel(countStatus(item.daysLate, 1, 15))}</span></div><strong>${money.format(item.balance)}</strong><small>${item.daysLate} dias em atraso. Ação sugerida: cobrar, renegociar ou bloquear novo fiado.</small></div>`).join("") || "<p>Sem inadimplência.</p>";
  document.getElementById("fiado-table").innerHTML = (data.fiadoCustomers || []).map(customer => `
    <tr><td>${customer.name}</td><td>${money.format(customer.creditLimit)}</td><td>${money.format(customer.balance)}</td></tr>
  `).join("");
}

function renderQuoteCustomerCard() {
  const customer = state.customers.find(item => item.id === document.getElementById("quote-customer")?.value) || state.customers[0];
  const target = document.getElementById("quote-customer-card");
  if (!target || !customer) return;
  target.innerHTML = `
    <div class="small-card"><b>Cliente</b><span>${customer.name || "Cliente"}</span></div>
    <div class="small-card"><b>Telefone</b><span>${customer.phone || customer.mobile || "Nao informado"}</span></div>
    <div class="small-card"><b>Classificacao</b><span>${customer.classification || "Essencial"}</span></div>
    <div class="small-card"><b>Origem</b><span>${customer.origin || "Cadastro interno"}</span></div>
    <details class="business-details client-full-data"><summary>Ver dados completos</summary>${formatRawDetails({
      razaoSocial: customer.companyName || customer.name || "Nao informado",
      documento: customer.document || "Nao informado",
      celular: customer.mobile || customer.whatsapp || customer.phone || "Nao informado",
      avaliacao: customer.rating ? `${customer.rating} estrela(s)` : "Sem avaliacao",
      historico: customer.history || "Consultar historico do cliente"
    })}</details>
  `;
}

function renderQuotePricingResult(pricing) {
  state.activeQuotePricing = pricing || null;
  const validation = pricing?.validation || {};
  const finalPrice = pricing?.finalPrice || pricing?.suggestedPrice || 0;
  const profit = Math.max(finalPrice - (pricing?.totalCost || 0), 0);
  document.getElementById("quote-price-cards").innerHTML = pricing ? [
    ["Valor final", money.format(finalPrice)],
    ["Saldo a pagar", money.format(Math.max(quoteGrandTotal().finalValue - Number(document.getElementById("quote-down-payment")?.value || 0), 0))],
    ["Margem", `${validation.marginAtManualPrice ?? pricing.marginPercent ?? 0}%`],
    ["Lucro previsto", money.format(profit)]
  ].map((item, index) => `<div class="small-card quote-metric${index > 1 ? " quote-metric-sensitive" : ""}"><b>${item[0]}</b><span>${item[1]}</span></div>`).join("") : "";
  document.getElementById("quote-price-alerts").innerHTML = pricing ? [
    validation.marginStatus === "ideal" ? `<div class="alert green"><b>Margem ideal</b><span>Margem igual ou acima da meta definida.</span></div>` : "",
    validation.marginStatus === "abaixo_meta" ? `<div class="alert yellow"><b>Margem abaixo da meta definida</b><span>Gap: ${validation.targetMarginGap}%.</span></div>` : "",
    validation.lowMarginAlert ? `<div class="alert red"><b>Margem critica</b><span>Margem abaixo do minimo.</span></div>` : "",
    validation.belowCostAlert ? `<div class="alert red"><b>Venda abaixo do custo</b><span>Preco final menor que o custo total.</span></div>` : "",
    pricing.approvalRequired ? `<div class="alert red"><b>Aprovacao de desconto necessaria</b><span>Desconto ${pricing.discountPercent}% acima do limite ${pricing.discountLimit}%.</span></div>` : "",
    validation.difference ? `<div class="alert"><b>Diferenca manual x calculado</b><span>${money.format(validation.difference)} (${validation.differencePercent}%).</span></div>` : ""
  ].join("") : "";
  document.getElementById("price-result").innerHTML = pricing ? detailPanel([
    ["Custo material", money.format(pricing.materialCost || 0)],
    ["Custo producao", money.format(pricing.productionCost || 0)],
    ["Custo instalacao", money.format(pricing.installationCost || 0)],
    ["Custo administrativo", money.format(pricing.administrativeCost || 0)],
    ["Comissao", money.format(pricing.commission || 0)],
    ["Impostos", money.format(pricing.taxes || 0)],
    ["Preco minimo", money.format(pricing.minPrice || 0)],
    ["Preco sugerido", money.format(pricing.suggestedPrice || 0)],
    ["Margem", `${validation.marginAtManualPrice ?? pricing.marginPercent ?? 0}%`],
    ["Lucro previsto", money.format(profit)]
  ], { materiais: pricing.materialLines, custosDasPerguntas: pricing.questionCosts, fluxo: pricing.productionRoute || pricing.productionFlow, validacao: pricing.validation, snapshot: pricing.costBreakdown }, "Ver memoria do calculo") : "Responda o questionario.";
  updateQuoteSingleScreenSummary(pricing);
}

function quoteGrandTotal() {
  const itemTotal = state.quoteItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const current = state.quoteItems.length ? 0 : Number(state.activeQuotePricing?.finalPrice || state.activeQuotePricing?.suggestedPrice || 0);
  const total = itemTotal + current;
  const discount = Number(document.getElementById("quote-discount")?.value || 0);
  const discountValue = total * (discount / 100);
  const finalValue = Math.max(total - discountValue, 0);
  return { itemTotal: total, discountValue, finalValue };
}

function renderQuoteTotals(pricing) {
  const target = document.getElementById("quote-total-summary");
  if (!target) return;
  const totals = quoteGrandTotal();
  const downPayment = Number(document.getElementById("quote-down-payment")?.value || 0);
  const margin = state.quoteItems.length
    ? averageQuoteMargin()
    : (pricing?.validation?.marginAtManualPrice ?? pricing?.marginPercent ?? 0);
  target.innerHTML = `
    <div class="total-line"><span>Total dos itens</span><strong>${money.format(totals.itemTotal)}</strong></div>
    <div class="total-line"><span>Desconto geral</span><strong>${money.format(totals.discountValue)}</strong></div>
    <div class="total-line"><span>Valor final</span><strong>${money.format(totals.finalValue)}</strong></div>
    <div class="total-line"><span>Sinal pago</span><strong>${money.format(downPayment)}</strong></div>
    <div class="total-line"><span>Saldo a pagar</span><strong>${money.format(Math.max(totals.finalValue - downPayment, 0))}</strong></div>
  `;
  const bottom = document.getElementById("quote-bottom-summary");
  if (bottom) bottom.textContent = `Total: ${money.format(totals.finalValue)} | Sinal: ${money.format(downPayment)} | Saldo: ${money.format(Math.max(totals.finalValue - downPayment, 0))} | Margem: ${margin}%`;
  updateQuoteSingleScreenSummary(pricing);
}

function averageQuoteMargin() {
  if (!state.quoteItems.length) return 0;
  const total = state.quoteItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  if (!total) return 0;
  const weighted = state.quoteItems.reduce((sum, item) => sum + (Number(item.margin || 0) * Number(item.subtotal || 0)), 0);
  return Math.round((weighted / total) * 100) / 100;
}

function renderQuoteItemPreview(pricing) {
  const target = document.getElementById("quote-items-preview");
  if (!target) return;
  target.innerHTML = state.quoteItems.length
    ? state.quoteItems.map((item, index) => quoteItemRow(item, index)).join("")
    : `<tr><td colspan="8"><div class="premium-empty-state"><b>Nenhum item adicionado.</b><span>Configure o produto acima e clique em Adicionar item.</span></div></td></tr>`;
  renderQuoteItemCards(null);
}

function renderQuoteItemCards(previewItem = null) {
  const target = document.getElementById("quote-item-cards");
  if (!target) return;
  const rows = [...state.quoteItems.map((item, index) => ({ item, index, preview: false })), ...(previewItem ? [{ item: previewItem, index: state.quoteItems.length, preview: true }] : [])];
  target.innerHTML = rows.map(({ item, index, preview }) => `
    <article class="quote-item-card ${preview ? "preview" : ""}">
      <div><span>${preview ? "Previa" : `Item ${index + 1}`}</span><h3>${item.productName}</h3><p>${item.description}</p></div>
      <div class="quote-item-card-meta">
        <small>Qtd.: <b>${item.quantity}</b></small>
        <small>Medidas: <b>${item.size}</b></small>
        <small>Material: <b>${item.material || "A definir"}</b></small>
        <small>Acabamento: <b>${item.finish || "A definir"}</b></small>
      </div>
      <div class="quote-item-card-price"><b>${money.format(item.subtotal)}</b><span class="status-pill">${item.status}</span></div>
      <div class="row-actions">
        ${preview ? `<button type="button" data-quote-action="add">Adicionar</button>` : `<button type="button" data-quote-action="edit" data-index="${index}">Editar</button><button type="button" data-quote-action="duplicate" data-index="${index}">Duplicar</button><button type="button" data-quote-action="delete" data-index="${index}">Excluir</button>`}
      </div>
    </article>
  `).join("") || emptyStateMarkup("Nenhum item no orcamento.", "Clique em Adicionar item para montar o primeiro produto ou servico.");
}

function quoteItemRow(item, index, preview = false) {
  const sectors = (item.productionRouteSnapshot || item.pricingSnapshot?.productionRoute || []).map(step => step.sectorName || step).join(" > ") || (item.flow || item.pricingSnapshot?.productionFlow || []).join(" > ") || "Sem rota";
  return `
    <tr class="${preview ? "quote-preview-row" : ""}">
      <td>${index + 1}</td>
      <td><b>${item.productName}</b><small>${item.description}</small></td>
      <td>${item.size}</td>
      <td>${item.quantity}</td>
      <td>${money.format(item.unitPrice)}</td>
      <td>${money.format(item.subtotal)}</td>
      <td><small>${escapeHtml(sectors)}</small></td>
      <td class="row-actions">
        ${preview ? `<button type="button" data-quote-action="add">Adicionar item</button>` : `<button type="button" data-quote-action="edit" data-index="${index}">Editar</button><button type="button" data-quote-action="duplicate" data-index="${index}">Duplicar</button><button type="button" data-quote-action="delete" data-index="${index}">Excluir</button>`}
      </td>
    </tr>
  `;
}

function buildQuoteItem(pricing = state.activeQuotePricing, status = "Adicionado") {
  const product = productForQuoteConfiguration();
  const model = selectedQuoteProductModel(selectedQuoteProduct());
  const composition = state.compositions.find(item => item.id === document.getElementById("quote-composition")?.value);
  const answers = collectAnswers();
  const quantity = Math.max(Number(answers.quantity || 1), 1);
  const subtotal = Number(pricing?.finalPrice || pricing?.suggestedPrice || product?.minPrice || 0);
  const size = calculateProductMeasure(product, answers).label || "A confirmar";
  const productConfigSnapshot = product ? structuredClone({
    id: product.id,
    code: product.code,
    name: product.name,
    pricingMode: product.pricingMode,
    defaultProductionDays: product.defaultProductionDays,
    technicalQuestions: product.technicalQuestions || product.questions || [],
    productionRoute: product.productionRoute || []
  }) : null;
  const productionRouteSnapshot = structuredClone(pricing?.productionRoute || product?.productionRoute || []);
  const questionCostsSnapshot = structuredClone(pricing?.questionCosts || []);
  return {
    id: Date.now(),
    productId: product?.id,
    productModelId: model?.id || pricing?.productModelId || "",
    productModelName: model?.name || pricing?.productModelName || "",
    productName: product?.name || composition?.name || "Produto",
    productImageUrl: product?.imageUrl || "",
    categoryId: product?.categoryId || "",
    categoryIcon: product?.categoryIcon || "",
    compositionId: composition?.id,
    compositionName: composition?.name || "Sem composicao",
    description: document.getElementById("quote-job")?.value || "Trabalho",
    size,
    quantity,
    unitPrice: subtotal / quantity,
    subtotal,
    status,
    material: answers.material || product?.materialsUsed?.[0] || "",
    finish: answers.finish || product?.finishes?.[0] || "",
    margin: pricing?.validation?.marginAtManualPrice ?? pricing?.marginPercent ?? 0,
    answers: { ...answers },
    technicalAnswersSnapshot: { ...answers },
    questionCostsSnapshot,
    productionRouteSnapshot,
    productConfigSnapshot,
    productModelSnapshot: model ? structuredClone(model) : null,
    pricingSnapshot: pricing,
    flow: productionRouteSnapshot.map(step => step.sectorName || step),
    files: splitQuoteFiles(),
    projectFiles: projectFilesForQuote(),
    checklist: answers.checklist || [],
    notes: {
      client: document.getElementById("quote-client-note")?.value || "",
      production: document.getElementById("quote-production-note")?.value || "",
      finance: document.getElementById("quote-finance-note")?.value || ""
    }
  };
}

function splitQuoteFiles() {
  const split = value => String(value || "").split(",").map(item => item.trim()).filter(Boolean);
  return [
    ...split(document.getElementById("quote-preview-files")?.value),
    ...split(document.getElementById("quote-production-files")?.value),
    ...split(document.getElementById("quote-purchase-file")?.value)
  ];
}

function projectFilesForQuote() {
  const analysis = state.projectRecognition?.active;
  const draft = state.projectRecognition?.draft;
  return [...new Set([
    analysis?.fileName,
    ...(draft?.projectFiles || []),
    ...(state.quoteItems || []).flatMap(item => item.projectFiles || [])
  ].filter(Boolean))];
}

function addCurrentQuoteItem() {
  if (!state.activeQuotePricing) {
    calculateQuoteNow().then(addCurrentQuoteItem);
    return;
  }
  state.quoteItems.push(buildQuoteItem(state.activeQuotePricing));
  resetQuoteProductFields();
  renderQuoteItemPreview(null);
  renderQuoteTotals(null);
  renderQuotePricingResult(null);
}

function resetQuoteProductFields() {
  document.querySelectorAll("#quote [data-answer]").forEach(input => {
    if (input.dataset.answer === "quantity") input.value = "1";
    else if (input.tagName === "SELECT") input.selectedIndex = 0;
    else input.value = "";
  });
  ["quote-preview-files", "quote-production-files", "quote-client-note", "quote-production-note", "quote-finance-note", "quote-manual-price", "quote-price-reason"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  state.activeQuotePricing = null;
  state.quoteItemDraftAnswers = {};
}

function handleQuoteItemAction(event) {
  const button = event.target.closest("[data-quote-action]");
  if (!button) return;
  const action = button.dataset.quoteAction;
  const index = Number(button.dataset.index || 0);
  if (action === "add") return addCurrentQuoteItem();
  if (action === "delete") removeQuoteItem(index);
  if (action === "duplicate") duplicateQuoteItem(index);
  if (action === "edit") {
    const item = state.quoteItems[index];
    if (!item) return;
    document.getElementById("quote-product").value = item.productId || document.getElementById("quote-product").value;
    state.quoteItemDraftAnswers.productModelId = item.productModelId || item.answers?.productModelId || "";
    renderQuoteProductModels();
    if (item.productModelId && document.getElementById("quote-product-model")) document.getElementById("quote-product-model").value = item.productModelId;
    document.getElementById("quote-composition").value = item.compositionId || document.getElementById("quote-composition").value;
    document.getElementById("quote-job").value = item.description || "";
    state.quoteItemDraftAnswers = { ...(item.answers || {}), material: item.material || "", finish: item.finish || "", checklist: item.checklist || [] };
    renderCompositionInfo();
    renderQuestions();
    Object.entries(item.answers || {}).forEach(([key, value]) => {
      const input = document.querySelector(`#quote [data-answer="${key}"]`);
      if (input) input.value = value;
    });
    state.activeQuotePricing = item.pricingSnapshot;
    state.quoteItems.splice(index, 1);
    activateRootTab("quote-root-shell", "items");
    renderQuotePricingResult(state.activeQuotePricing);
    renderQuoteItemPreview(state.activeQuotePricing);
    renderQuoteTotals(state.activeQuotePricing);
  }
  if (action === "calc") {
    const item = state.quoteItems[index];
    if (item?.pricingSnapshot) renderQuotePricingResult(item.pricingSnapshot);
    document.querySelector(".quote-side-panel")?.classList.add("show-details");
  }
  if (action === "attach") {
    document.getElementById("quote-production-files")?.focus();
  }
}

function duplicateQuoteItem(index) {
  const item = state.quoteItems[index];
  if (item) state.quoteItems.splice(index + 1, 0, structuredClone({ ...item, id: Date.now(), status: "Duplicado" }));
  renderQuoteItemPreview(state.activeQuotePricing);
  renderQuoteTotals(state.activeQuotePricing);
}

function removeQuoteItem(index) {
  state.quoteItems.splice(index, 1);
  renderQuoteItemPreview(state.activeQuotePricing);
  renderQuoteTotals(state.activeQuotePricing);
  renderQuotePricingResult(state.activeQuotePricing);
}

async function duplicateOrderItem(orderId, itemId) {
  return api(`/api/orders/${orderId}/items/${itemId}/duplicate`, { method: "POST", body: { user: state.user?.name || "Atendimento" } });
}

async function removeOrderItem(orderId, itemId) {
  return api(`/api/orders/${orderId}/items/${itemId}`, { method: "DELETE" });
}

function quoteRequestBody() {
  const manual = Number(document.getElementById("quote-manual-price").value || 0);
  const totals = quoteGrandTotal();
  const productModelId = document.getElementById("quote-product-model")?.value || state.quoteItemDraftAnswers.productModelId || "";
  return {
    customerId: document.getElementById("quote-customer").value,
    productId: document.getElementById("quote-product").value,
    productModelId,
    jobName: document.getElementById("quote-job").value,
    answers: {
      ...collectAnswers(),
      productModelId,
      compositionId: document.getElementById("quote-composition").value,
      quoteItems: state.quoteItems,
      contact: document.getElementById("quote-contact")?.value || "",
      seller: document.getElementById("quote-seller")?.value || "",
      attendant: document.getElementById("quote-attendant")?.value || "",
      campaign: document.getElementById("quote-campaign")?.value || "",
      deliveryAddress: document.getElementById("quote-delivery-address")?.value || "",
      logistics: document.getElementById("quote-logistics")?.value || "",
      deadline: document.getElementById("quote-deadline")?.value || "",
      validity: document.getElementById("quote-validity")?.value || "",
      paymentMethod: document.getElementById("quote-payment-method")?.value || "",
      paymentTerms: document.getElementById("quote-payment-terms")?.value || "",
      billing: document.getElementById("quote-billing")?.value || "",
      commissionPercent: Number(document.getElementById("quote-commission")?.value || 0),
      clientNote: document.getElementById("quote-client-note")?.value || "",
      productionNote: document.getElementById("quote-production-note")?.value || "",
      financeNote: document.getElementById("quote-finance-note")?.value || "",
      downPayment: Number(document.getElementById("quote-down-payment")?.value || 0),
      billTo: document.getElementById("quote-bill-to")?.value || "",
      purchaseOrder: document.getElementById("quote-purchase-order")?.value || "",
      totalItems: totals.itemTotal,
      discountValue: totals.discountValue,
      finalValue: totals.finalValue
    },
    photos: splitQuoteFiles(),
    files: splitQuoteFiles(),
    projectFiles: projectFilesForQuote(),
    additionalExpenses: Number(document.getElementById("quote-extra-costs-final").value || 0),
    manualPrice: state.quoteItems.length ? totals.finalValue : (manual || undefined),
    priceChangeReason: document.getElementById("quote-price-reason").value,
    discountPercent: document.getElementById("quote-discount").value
  };
}

function renderOrders() {
  const query = (document.getElementById("order-filter")?.value || "").toLowerCase();
  const normalizedQuery = normalizeUxText(query);
  const today = new Date().toISOString().slice(0, 10);
  const rows = state.orders.filter(order => {
    if (normalizedQuery === "hoje") return String(order.dueDate || "").slice(0, 10) === today;
    if (normalizedQuery.includes("atras")) return productionVisualStatus(order) === "atrasado";
    if (normalizedQuery.includes("producao")) return normalizeUxText(order.productionStatus || "").includes("produc");
    if (normalizedQuery.includes("final")) return normalizeUxText(order.productionStatus || "").match(/final|entreg/);
    if (normalizedQuery.includes("sem arquivo")) return !(order.files || []).length;
    if (normalizedQuery.includes("sem pagamento")) return normalizeUxText(order.financialStatus || "").match(/aguard|pend|sem pagamento/);
    return normalizeUxText([order.id, order.customerName, order.jobName, order.productionStatus, order.financialStatus, order.currentSector, order.responsible, order.currentResponsible].join(" ")).includes(normalizedQuery);
  });
  const current = rows.find(order => order.id === state.activeOrderId) || rows[0] || state.orders[0];
  if (current) state.activeOrderId = current.id;
  const paid = Number(current?.paidAmount || current?.receivedAmount || current?.downPayment || 0);
  const total = Number(current?.total || 0);
  const balance = Math.max(total - paid, 0);
  const summary = document.getElementById("orders-summary");
  if (summary) {
    const today = new Date().toISOString().slice(0, 10);
    const lateRows = rows.filter(order => productionVisualStatus(order) === "atrasado");
    const todayRows = rows.filter(order => String(order.dueDate || "").slice(0, 10) === today);
    const productionRows = rows.filter(order => normalizeUxText(order.productionStatus || "").includes("produc"));
    const noFileRows = rows.filter(order => !(order.files || []).length);
    const noPaymentRows = rows.filter(order => orderIsBillable(order) && normalizeUxText(order.financialStatus || "").match(/aguard|pend|sem pagamento/));
    summary.innerHTML = [
      managerCard("Total", rows.length, "ok", "Ordens exibidas conforme filtros atuais."),
      managerCard("Para hoje", todayRows.length, countStatus(todayRows.length, 4, 8), "O.S. com prazo para hoje."),
      managerCard("Atrasadas", lateRows.length, countStatus(lateRows.length, 1, 3), "Precisa de ação do PCP ou responsável."),
      managerCard("Em produção", productionRows.length, productionRows.length ? "ok" : "warning", "Trabalhos em execução."),
      managerCard("Sem arquivo", noFileRows.length, countStatus(noFileRows.length, 1, 3), "Anexar arte ou arquivo de produção."),
      managerCard("Sem pagamento", noPaymentRows.length, countStatus(noPaymentRows.length, 1, 3), "Conferir sinal, fiado ou liberação.")
    ].join("");
  }
  const header = document.getElementById("orders-header-summary");
  if (header) header.innerHTML = current ? `
    <div class="os-hero-card">
      <div><span>Numero da O.S.</span><strong>${current.id}</strong></div>
      <div><span>Cliente</span><b>${current.customerName}</b></div>
      <div><span>Trabalho</span><b>${current.jobName}</b></div>
      <div><span>Financeiro</span><span class="status-pill finance">${current.financialStatus}</span></div>
      <div><span>Producao</span><span class="status-pill production">${current.productionStatus}</span></div>
      <div><span>Prazo</span><b>${current.dueDate || "-"}</b></div>
      <div><span>Valor final</span><strong>${money.format(total)}</strong></div>
    </div>
  ` : "";
  document.getElementById("orders-table").innerHTML = rows.map(order => {
    const product = state.products.find(item => item.id === order.productId)?.name || order.jobName;
    const responsible = order.responsible || order.currentResponsible || order.events?.[0]?.startedBy || "Definir";
    const sector = order.currentSector || order.productionStatus || "PCP";
    return `
      <tr class="order-list-row ${order.id === current?.id ? "selected" : ""}" data-order-list-row="${order.id}" tabindex="0">
        <td><b>${order.id}</b><small>${orderTypeBadge(order)} ${order.approvalStatus || "O.S."}</small></td>
        <td><b>${order.customerName}</b><small>${order.contact || order.answers?.contact || "-"}</small></td>
        <td><b>${product}</b><small>${money.format(order.total || 0)}</small></td>
        <td>${order.dueDate || "-"}</td>
        <td><span class="status-pill production">${order.productionStatus}</span></td>
        <td><span class="status-pill finance">${order.financialStatus}</span></td>
        <td>${sector}</td>
        <td>${responsible}</td>
        <td class="row-actions">
          <button data-action="open-order" data-order="${order.id}">Abrir</button>
          <button data-action="print-order" data-order="${order.id}">Imprimir</button>
          ${orderIsCancelled(order) ? "" : `<button data-action="send-pcp" data-order="${order.id}">Enviar PCP</button>`}
          ${orderIsBillable(order) ? `<button data-action="bill-order" data-order="${order.id}">Receber</button>` : ""}
          <button data-action="attach-order" data-order="${order.id}">Anexar</button>
          <button data-action="history-order" data-order="${order.id}">Historico</button>
        </td>
      </tr>
    `;
  }).join("");
  renderOrderItems(current);
  const bottom = document.getElementById("orders-bottom-summary");
  if (bottom && current) bottom.textContent = `Valor: ${money.format(total)} | Sinal: ${money.format(paid)} | Saldo: ${money.format(balance)} | Financeiro: ${current.financialStatus} | Producao: ${current.productionStatus}`;
  renderOrderFullPage(current, rows);
  renderCashOrders();
}

function renderOrderFullPage(order, rows = state.orders) {
  if (!document.getElementById("order-page") || !order) return;
  const customer = state.customers.find(item => item.id === order.customerId) || {};
  const paid = Number(order.paidAmount || order.receivedAmount || order.downPayment || 0);
  const total = Number(order.total || 0);
  const balance = Math.max(total - paid, 0);
  const items = orderItems(order);
  document.getElementById("order-header-sticky").innerHTML = `
    <div class="single-compact-header order-compact-header">
      <div class="single-header-title">
        <span>Ordem de Servico</span>
        <strong>${order.id} ${orderTypeBadge(order)}</strong>
        <label>Selecionar O.S.<select id="order-current-select">${rows.map(item => `<option value="${item.id}" ${item.id === order.id ? "selected" : ""}>${item.id} - ${item.customerName}</option>`).join("")}</select></label>
      </div>
      <div class="single-header-kpis">
        <div><span>Cliente</span><b>${order.customerName}</b></div>
        <div><span>Prazo</span><b>${order.dueDate || "-"}</b></div>
        <div><span>Producao</span><b><span class="status-pill production">${order.productionStatus}</span></b></div>
        <div><span>Financeiro</span><b><span class="status-pill finance">${order.financialStatus}</span></b></div>
        <div><span>Total</span><strong>${money.format(total)}</strong></div>
        <div><span>Saldo</span><b>${money.format(balance)}</b></div>
      </div>
      <div class="single-header-actions order-action-line">
        <button type="button" data-action="open-order" data-order="${order.id}">Abrir</button>
        <button type="button" data-action="print-order" data-order="${order.id}">Imprimir</button>
        ${orderIsCancelled(order) ? "" : `<button type="button" class="primary" data-action="send-pcp" data-order="${order.id}">Enviar producao</button>`}
        ${orderIsBillable(order) ? `<button type="button" data-action="bill-order" data-order="${order.id}">Receber</button>` : ""}
        <button type="button" data-action="attach-order" data-order="${order.id}">Anexar</button>
        <button type="button" data-action="order-note" data-order="${order.id}">Observacao</button>
        <button type="button" data-action="history-order" data-order="${order.id}">Historico</button>
      </div>
    </div>
  `;
  document.getElementById("order-current-select")?.addEventListener("change", event => {
    state.activeOrderId = event.target.value;
    renderOrders();
  });
  const summaryCards = document.getElementById("order-summary-cards");
  if (summaryCards) {
    summaryCards.innerHTML = [
      ["Cliente", `<b>${order.customerName}</b><small>${customer.phone || order.contact || "Contato nao informado"}</small>`],
      ["Trabalho", `<b>${order.jobName}</b><small>${order.deliveryAddress || order.answers?.deliveryAddress || "Entrega a combinar"}</small>`],
      ["Producao", `<b>${order.currentSector || order.productionStatus || "-"}</b><small>${productionNextAction(order)}</small>`],
      ["Financeiro", `<b>${money.format(total)}</b><small>Recebido ${money.format(paid)} | Saldo ${money.format(balance)}</small>`]
    ].map(([label, value]) => `<article class="single-card order-summary-card"><h3>${label}</h3><div>${value}</div></article>`).join("");
  }
  const legacyClient = document.getElementById("order-client-card");
  if (legacyClient) legacyClient.innerHTML = orderClientCard(customer);
  const legacyCommercial = document.getElementById("order-commercial-grid");
  if (legacyCommercial) legacyCommercial.innerHTML = orderInfoCards([
    ["Vendedor", order.seller || "Joao Victor"],
    ["Atendente", order.attendant || order.answers?.attendant || "Atendimento"],
    ["Contato", order.contact || order.answers?.contact || customer.phone || "-"],
    ["Campanha", order.campaign || order.answers?.campaign || "-"],
    ["Origem do orcamento", order.quoteId || order.quoteNumber || "O.S. direta"]
  ]);
  const legacyWork = document.getElementById("order-work-grid");
  if (legacyWork) legacyWork.innerHTML = orderInfoCards([
    ["Trabalho", order.jobName],
    ["Logistica", order.logistics || order.answers?.logistics || "A combinar"],
    ["Endereco de entrega", order.deliveryAddress || order.answers?.deliveryAddress || "-"],
    ["Entrega", order.dueDate || "-"],
    ["Prioridade", order.priority || "normal"]
  ]);
  renderOrderItemsTable(order, items);
  const filesGrid = document.getElementById("order-files-grid");
  if (filesGrid) filesGrid.innerHTML = renderOrderFiles(order, items);
  const notesGrid = document.getElementById("order-notes-grid");
  if (notesGrid) notesGrid.innerHTML = orderInfoCards([
    ["Observacao para cliente", order.answers?.clientNote || order.clientNote || "-"],
    ["Observacao para producao", order.productionNotes || order.answers?.productionNote || order.productionNote || "-"],
    ["Alertas internos da producao", order.internalProductionWarnings || "-"],
    ["Instrucoes de arquivo", order.fileInstructions || "-"],
    ["Observacoes de instalacao", order.installationNotes || "-"],
    ["Observacao para financeiro", order.answers?.financeNote || order.financeNote || "-"]
  ]);
  const financeGrid = document.getElementById("order-finance-grid");
  if (financeGrid) financeGrid.innerHTML = orderInfoCards([
    ["Valor total", money.format(total)],
    ["Sinal pago", money.format(Number(order.downPayment || order.answers?.downPayment || 0))],
    ["Valor recebido", money.format(paid)],
    ["Saldo a receber", money.format(balance)],
    ["Forma de pagamento", order.paymentMethod || order.answers?.paymentMethod || "Pix / Dinheiro / Cartao / Boleto / Transferencia / Fiado"],
    ["Condicao de pagamento", order.paymentTerms || order.answers?.paymentTerms || "-"],
    ["Vencimento", order.duePaymentDate || "-"],
    ["Status financeiro", order.financialStatus]
  ]);
  const predicted = Number(order.predictedCost || 0);
  const real = Number(order.realCost || 0);
  const productionGrid = document.getElementById("order-production-grid");
  if (productionGrid) productionGrid.innerHTML = renderOrderProductionRoute(order) + orderInfoCards([
    ["Status producao", order.productionStatus],
    ["Setor atual", order.currentSectorName || order.currentSector || order.productionStatus || "-"],
    ["Proximo setor", nextOrderSector(order)],
    ["Fluxo produtivo", (order.productionRouteSnapshot || []).map(step => step.sectorName).join(" > ") || (order.flow || []).join(" > ") || "-"],
    ["Respostas tecnicas", Object.entries(order.technicalAnswersSnapshot || {}).filter(([key]) => !["quoteItems"].includes(key)).map(([key, value]) => `${businessLabel(key)}: ${Array.isArray(value) ? value.join(", ") : value}`).join(" | ") || "-"],
    ["Custos das perguntas", money.format((order.questionCostsSnapshot || []).reduce((sum, line) => sum + Number(line.amount || 0), 0))],
    ["Responsavel atual", order.responsible || order.events?.[0]?.startedBy || "-"],
    ["Prazo por setor", order.sectorDueDate || order.dueDate || "-"],
    ["Materiais previstos", materialSummaryForOrder(order, items)],
    ["Custo previsto", money.format(predicted)],
    ["Custo real", money.format(real)],
    ["Diferenca previsto x real", money.format(real - predicted)]
  ]);
  const installationGrid = document.getElementById("order-installation-grid");
  if (installationGrid) installationGrid.innerHTML = orderInfoCards([
    ["Equipe", order.installationTeam?.name || order.team?.name || "-"],
    ["Responsavel", order.installationTeam?.responsible || "-"],
    ["Veiculo", order.installationTeam?.vehicle || "-"],
    ["Data de saida", order.installationTeam?.date || "-"],
    ["Horario de saida", order.installationTeam?.outTime || "-"],
    ["Horario de retorno", order.installationTeam?.backTime || "-"],
    ["Checklist", order.installationChecklist ? "Conferido" : "Pendente"],
    ["Fotos antes/durante/depois", installationPhotos(order)],
    ["Assinatura do cliente", order.customerSignature || order.installationTeam?.confirmation || "-"],
    ["Despesas da instalacao", money.format(Number(order.installationExpenses || 0))]
  ]);
  const timeline = document.getElementById("order-timeline-full");
  if (timeline) timeline.innerHTML = orderTimeline(order);
  const bottom = document.getElementById("orders-bottom-summary");
  if (bottom) bottom.textContent = `O.S. ${order.id} | Valor: ${money.format(total)} | Recebido: ${money.format(paid)} | Saldo: ${money.format(balance)} | Financeiro: ${order.financialStatus} | Producao: ${order.productionStatus}`;
}

function renderOrderProductionRoute(order) {
  const route = order.productionRouteSnapshot || [];
  if (!route.length) return "";
  const events = order.events || [];
  const currentIndex = Number(order.currentRouteIndex || 0);
  return `<section class="order-route-snapshot"><div class="order-route-heading"><b>Rota congelada da producao</b><small>Esta sequencia veio dos produtos do orcamento e nao muda com alteracoes futuras no cadastro.</small></div><div class="order-route-steps">${route.map((step, index) => {
    const sectorEvents = events.filter(event => event.sectorId === step.sectorId || event.sectorName === step.sectorName || event.sector === step.sectorName);
    const started = sectorEvents.find(event => ["started", "iniciar"].includes(event.action || event.originalAction));
    const finished = sectorEvents.find(event => ["finished_sector", "finalizar"].includes(event.action || event.originalAction));
    const status = finished || index < currentIndex ? "done" : index === currentIndex && !["Finalizada", "Entregue"].includes(order.productionStatus) ? "active" : "waiting";
    return `<article class="order-route-step ${status}" style="--sector-color:${escapeHtml(step.color || "#6f0f8f")}">
      <span>${escapeHtml(step.icon || String(index + 1))}</span>
      <b>${escapeHtml(step.sectorName)}</b>
      <small>${status === "done" ? "Concluido" : status === "active" ? "Setor atual" : "Aguardando"}</small>
      <small>Inicio: ${started?.createdAt ? new Date(started.createdAt).toLocaleString("pt-BR") : "-"}</small>
      <small>Fim: ${finished?.createdAt ? new Date(finished.createdAt).toLocaleString("pt-BR") : "-"}</small>
      <small>Responsavel: ${escapeHtml(finished?.user || started?.user || step.defaultResponsible || "A definir")}</small>
      ${step.requiredFile ? `<small class="${order.files?.length || order.productionFiles?.length ? "" : "critical-text"}">Arquivo obrigatorio</small>` : ""}
      ${step.checklistRequired ? "<small>Checklist obrigatorio</small>" : ""}
    </article>`;
  }).join("")}</div></section>`;
}

function orderInfoCards(rows) {
  return rows.map(([label, value]) => `<div class="small-card"><b>${label}</b><span>${value ?? "-"}</span></div>`).join("");
}

function orderClientCard(customer) {
  const fiado = Number(customer.balance || customer.fiadoBalance || 0);
  return `
    <div class="small-card"><b>Cliente</b><span>${customer.name || "Cliente"}</span></div>
    <div class="small-card"><b>Telefone</b><span>${customer.phone || customer.mobile || "Nao informado"}</span></div>
    <div class="small-card"><b>Classificacao</b><span>${customer.classification || "Essencial"}</span></div>
    <div class="small-card"><b>Origem</b><span>${customer.origin || "Cadastro interno"}</span></div>
    <details class="business-details client-full-data"><summary>Ver dados completos</summary>${formatRawDetails({
      razaoSocial: customer.companyName || customer.name || "Nao informado",
      documento: customer.document || "Nao informado",
      celular: customer.mobile || customer.whatsapp || customer.phone || "Nao informado",
      avaliacao: customer.rating ? `${customer.rating} estrela(s)` : "Sem avaliacao",
      historico: customer.history || "Consultar historico do cliente",
      limiteCredito: money.format(customer.creditLimit || 0),
      fiadosEmAberto: money.format(fiado)
    })}</details>
  `;
}

function renderProductionRoute(order) {
  const route = order.productionRouteSnapshot || [];
  const events = order.events || [];
  const currentIndex = Number(order.currentRouteIndex || 0);
  if (!route.length) return `<div class="premium-empty-state"><b>Rota produtiva não definida.</b><span>Revise o produto ou o orçamento de origem.</span></div>`;
  return `<div class="root-production-route">${renderSectorCards(route, events, currentIndex, order.productionStatus)}</div>`;
}

function renderSectorCards(route, events = [], currentIndex = 0, productionStatus = "") {
  return route.map((step, index) => {
    const related = events.filter(event => event.sectorId === step.sectorId || event.sectorName === step.sectorName || event.sector === step.sectorName);
    const started = related.find(event => ["started", "iniciar"].includes(event.action || event.originalAction));
    const finished = related.find(event => ["finished_sector", "finalizar"].includes(event.action || event.originalAction));
    const status = finished || index < currentIndex ? "done" : index === currentIndex && !["Finalizada", "Entregue"].includes(productionStatus) ? "active" : "waiting";
    return `<article class="${status}" style="--sector-color:${escapeHtml(step.color || "#6f0f8f")}"><span>${escapeHtml(step.icon || String(index + 1))}</span><div><b>${escapeHtml(step.sectorName)}</b><small>${status === "done" ? "Concluído" : status === "active" ? "Setor atual" : "Aguardando"}${step.requiredFile ? " · arquivo obrigatório" : ""}${step.checklistRequired ? " · checklist" : ""}</small><small>${escapeHtml(finished?.user || started?.user || step.defaultResponsible || "Responsável a definir")}</small></div></article>`;
  }).join("");
}

function renderOrderItemsTable(order, items) {
  const target = document.getElementById("orders-items-table");
  if (!target) return;
  target.innerHTML = items.map((item, index) => {
    const subtotal = Number(item.subtotal || order.total || 0);
    const quantity = Number(item.quantity || 1);
    const sector = item.currentSector || order.currentSector || order.productionStatus || "PCP";
    const status = item.status || item.productionStatus || order.productionStatus;
    return `
      <tr>
        <td>${index + 1}</td>
        <td><b>${item.productName || item.product || order.jobName}</b><small>${item.description || order.jobName}</small></td>
        <td>${item.size || item.measures || "A confirmar"}</td>
        <td>${quantity}</td>
        <td>${sector}</td>
        <td><span class="status-pill production">${status}</span></td>
        <td class="row-actions">
          <button data-action="open-order" data-order="${order.id}">Abrir</button>
          <button data-action="send-pcp" data-order="${order.id}">Enviar producao</button>
          <button data-action="history-order" data-order="${order.id}">Historico</button>
        </td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="7">Nenhum item localizado nesta O.S.</td></tr>`;
}

function renderOrderFiles(order, items) {
  const allFiles = [...(order.files || []), ...items.flatMap(item => item.files || [])];
  const preview = allFiles.filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file));
  const production = allFiles.filter(file => /\.(pdf|cdr|ai|eps|svg)$/i.test(file));
  const proofs = allFiles.filter(file => /comprovante|sinal|pagamento|fiado|autoriz/i.test(file));
  const list = files => files.length ? files.map(file => `<small>${file}</small>`).join("") : "<small>Nenhum arquivo anexado.</small>";
  return `
    <div class="small-card"><b>Imagens de visualizacao</b>${list(preview)}</div>
    <div class="small-card"><b>Arquivos de producao</b>${list(production)}</div>
    <div class="small-card"><b>Comprovantes</b>${list(proofs)}</div>
  `;
}

function materialSummaryForOrder(order, items) {
  const materialLines = items.flatMap(item => item.pricingSnapshot?.materialLines || item.materials || []);
  if (materialLines.length) return materialLines.map(line => line.material || line.name || line.materialId).filter(Boolean).join(", ");
  return (order.materialsPredicted || []).map(line => line.material || line.name || line.materialId).filter(Boolean).join(", ") || "-";
}

function nextOrderSector(order) {
  const route = order.productionRouteSnapshot || [];
  if (route.length) return route[Number(order.currentRouteIndex || 0) + 1]?.sectorName || "Finalizada";
  const flow = order.flow || [];
  const currentIndex = flow.indexOf(order.currentSectorName || order.productionStatus);
  return flow[currentIndex + 1] || "Entrega";
}

function installationPhotos(order) {
  const photos = [
    ...(order.installationChecklist?.photosBefore || []),
    ...(order.installationChecklist?.photosDuring || []),
    ...(order.installationChecklist?.photosAfter || [])
  ];
  return photos.length ? `${photos.length} foto(s)` : "Pendente";
}

function orderTimeline(order) {
  const defaults = [
    ["Orcamento aprovado", order.approvedAt || order.createdAt, "Cliente aprovou o trabalho para gerar O.S."],
    ["O.S. criada", order.createdAt, "Ordem de servico registrada para execucao."],
    ["Pagamento registrado", order.paidAmount ? order.updatedAt || order.createdAt : null, `Recebido: ${money.format(order.paidAmount || 0)}.`],
    ["Arquivo anexado", (order.files || []).length ? order.updatedAt || order.createdAt : null, `${(order.files || []).length} arquivo(s) vinculado(s).`],
    ["Enviada ao PCP", order.productionStatus && order.productionStatus !== "aguardando liberacao" ? order.updatedAt || order.createdAt : null, "O.S. liberada para acompanhamento de producao."]
  ];
  const events = [
    ...defaults.filter(item => item[1]),
    ...(order.events || []).map(event => [productionEventLabel(event.action || event.type), event.createdAt || event.date, event.problem || event.observation || event.pauseReason || "Movimentacao registrada na O.S."])
  ];
  return events.map(([title, date, text]) => `<div class="timeline-item"><b>${title}</b><span>${date ? new Date(date).toLocaleString("pt-BR") : "Data nao informada"}</span><p>${text}</p></div>`).join("") || "<p>Sem eventos registrados.</p>";
}

function productionEventLabel(action) {
  const map = {
    receber: "O.S. recebida pelo setor",
    iniciar: "Producao iniciada",
    pausar: "Producao pausada",
    finalizar: "Etapa finalizada",
    problema: "Problema registrado",
    retrabalho: "Retrabalho registrado",
    instalacao: "Instalacao finalizada",
    received: "O.S. recebida pelo setor",
    started: "Producao iniciada",
    paused: "Producao pausada",
    resumed: "Producao retomada",
    finished_sector: "Etapa finalizada",
    homologated: "Producao homologada",
    rework_rejected: "Reprovada para retrabalho",
    released_delivery: "Liberada para entrega",
    moved_to_next_sector: "Enviada ao proximo setor",
    file_downloaded: "Arquivo de producao baixado",
    file_attached: "Arquivo de producao anexado",
    note_added: "Observacao de producao registrada"
  };
  return map[action] || businessLabel(action || "Evento da O.S.");
}

function orderItems(order) {
  if (!order) return [];
  const items = order.itemProductionSnapshots || order.items || order.answers?.quoteItems || order.quoteItems || [];
  if (items.length) return items;
  const product = state.products.find(item => item.id === order.productId);
  return [{
    productName: product?.name || order.jobName,
    compositionName: order.compositionName || order.answers?.compositionId || "Composicao da O.S.",
    size: [order.answers?.width, order.answers?.height, order.answers?.thickness].filter(Boolean).join(" x ") || "A confirmar",
    quantity: order.answers?.quantity || 1,
    files: order.files || [],
    pricingSnapshot: { materialLines: order.materialsPredicted || [], totalCost: order.predictedCost },
    subtotal: order.total,
    margin: order.predictedMargin,
    status: order.productionStatus,
    flow: order.flow || []
  }];
}

function renderOrderItems(order) {
  const target = document.getElementById("orders-items-table");
  if (!target) return;
  target.innerHTML = orderItems(order).map((item, index) => {
    const flow = item.flow || item.pricingSnapshot?.productionFlow || order?.flow || [];
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${item.productName || item.product || order?.jobName || "-"}</td>
        <td>${item.compositionName || item.composition || "-"}</td>
        <td>${item.size || item.measures || "A confirmar"}</td>
        <td>${item.quantity || 1}</td>
        <td>${money.format(item.pricingSnapshot?.totalCost || item.predictedCost || order?.predictedCost || 0)}</td>
        <td>${item.margin ?? order?.predictedMargin ?? 0}%</td>
        <td>${(flow || []).join(" > ") || "PCP define fluxo"}</td>
        <td><span class="status-pill production">${item.status || order?.productionStatus || "aguardando"}</span></td>
        <td class="row-actions"><button data-action="send-pcp" data-order="${order?.id}">Enviar item</button><button data-action="history-order" data-order="${order?.id}">Detalhes</button></td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="10">Selecione uma O.S. para visualizar os itens.</td></tr>`;
}

function renderPermissions() {
  const profileCards = document.getElementById("access-profile-cards");
  if (profileCards) {
    const profiles = ["Admin/Gestor", "Vendedor", "Caixa", "Financeiro", "Producao", "PCP", "Instalacao", "Cliente"];
    profileCards.innerHTML = profiles.map(profile => `<div class="small-card"><b>${profile}</b><span>${profilePermissionHint(profile)}</span><small>${isAdminUser() ? "Admin pode liberar ou bloquear." : "Somente Admin/Gestor altera liberacoes."}</small></div>`).join("");
  }
  const labels = {
    cash: "Caixa / PDV",
    quickSale: "Venda rapida",
    blindClose: "Fechamento cego",
    financialSummary: "Financeiro",
    production: "Producao / PCP",
    quote: "Orcamentos",
    commercial: "Comercial",
    customerPortal: "Portal do Cliente",
    bi: "Central de Gestao e Relatorios",
    integrations: "Conexoes externas",
    settings: "Sistema / Configuracoes"
  };
  document.querySelectorAll("[data-permission]").forEach(input => {
    input.checked = Boolean(state.permissions[input.dataset.permission]);
    input.disabled = !isAdminUser();
    const label = input.closest("label");
    if (label && labels[input.dataset.permission]) {
      const text = label.childNodes[label.childNodes.length - 1];
      if (text?.nodeType === Node.TEXT_NODE) text.textContent = ` ${labels[input.dataset.permission]}`;
    }
  });
}

function profilePermissionHint(profile) {
  const map = {
    "Admin/Gestor": "Acesso total, relatorios, custos, DRE e liberacoes.",
    Vendedor: "Clientes, leads, orcamentos, follow-up e metas.",
    Caixa: "Abrir caixa, receber O.S., venda rapida, despesas e fechamento cego.",
    Financeiro: "Contas, baixas, fluxo, DRE, fiados e inadimplencia.",
    Producao: "O.S. do setor, arquivos, iniciar, pausar, finalizar e problemas.",
    PCP: "Kanban geral, gargalos, capacidade, setores e prioridades.",
    Instalacao: "Equipe, veiculo, checklist, fotos, despesas e conclusao.",
    Cliente: "Portal, aprovacoes, arquivos, pagamentos e timeline simples."
  };
  return map[profile] || "Perfil operacional.";
}

function productionVisualStatus(order) {
  const due = order?.dueDate ? new Date(order.dueDate) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const status = normalizeUxText(order?.productionStatus || "");
  if (status.match(/final|entreg|cancel|homologada|liberada/)) return "em_dia";
  if (due && due < today) return "atrasado";
  if (status.includes("produ")) return "em_producao";
  if (status.includes("problema") || status.includes("retrabalho") || status.includes("homologacao")) return "atencao";
  return "aguardando";
}

function processIcons(order) {
  const steps = ["impressao", "corte", "acabamento", "montagem", "instalacao", "conferencia", "entrega"];
  const flow = (order?.flow || []).join(" ").toLowerCase();
  return `<div class="process-icons">${steps.map(step => {
    const active = flow.includes(step) || String(order?.productionStatus || "").toLowerCase().includes(step);
    const done = String(order?.productionStatus || "").toLowerCase().includes("final") || String(order?.productionStatus || "").toLowerCase().includes("entreg");
    const problem = (order?.events || []).some(event => String(event.problem || "").toLowerCase().includes(step));
    const status = problem ? "problem" : done ? "done" : active ? "active" : "waiting";
    return `<span class="${status}" title="${step}">${step.slice(0, 3).toUpperCase()}</span>`;
  }).join("")}</div>`;
}

function productionQueryParams() {
  const value = id => document.getElementById(id)?.value || "";
  const params = new URLSearchParams({
    scope: state.productionScope || "today",
    view: state.productionView || "mine",
    dateFrom: value("pcp-filter-date-from"),
    dateTo: value("pcp-filter-date-to"),
    sector: value("pcp-filter-sector") === "Todas as O.S." ? "" : value("pcp-filter-sector"),
    responsible: value("pcp-filter-owner"),
    status: value("pcp-filter-status") === "Todos" ? "" : value("pcp-filter-status"),
    customer: value("pcp-filter-customer"),
    order: value("pcp-filter-order"),
    priority: value("pcp-filter-priority"),
    serviceType: value("pcp-filter-service"),
    financialStatus: value("pcp-filter-financial"),
    logistics: value("pcp-filter-logistics"),
    reportType: value("pcp-filter-report"),
    pageSize: "500"
  });
  [...params.entries()].forEach(([key, entry]) => { if (!entry) params.delete(key); });
  return params;
}

function productionViewLabel(value = state.productionView || "mine") {
  return {
    mine: "Minhas O.S.",
    sector: "O.S. do setor",
    upcoming: "Proximos trabalhos",
    running: "Em andamento",
    paused: "Pausadas",
    finished: "Finalizadas",
    installation: "Instalacao",
    checklist: "Checklist",
    files: "Arquivos / anexos"
  }[value] || "Fila operacional";
}

function productionScopeLabel(value = state.productionScope || "today") {
  return { today: "Hoje", next3: "Proximos 3 dias", all: "Geral" }[value] || "Geral";
}

function updatePcpFilterSummary(data = {}, visibleRows = 0) {
  const value = id => document.getElementById(id)?.value || "";
  const sector = value("pcp-filter-sector") === "Todas as O.S." ? "Todos os setores" : value("pcp-filter-sector") || "Todos os setores";
  const status = value("pcp-filter-status") === "Todos" ? "Todos os status" : value("pcp-filter-status") || "Todos os status";
  const activeIds = ["pcp-filter-date-from", "pcp-filter-date-to", "pcp-filter-sector", "pcp-filter-owner", "pcp-filter-status", "pcp-filter-customer", "pcp-filter-order", "pcp-filter-priority", "pcp-filter-service", "pcp-filter-financial", "pcp-filter-logistics", "pcp-filter-report"];
  const activeCount = activeIds.filter(id => {
    const current = value(id);
    return current && current !== "Todas as O.S." && current !== "Todos";
  }).length;
  const summary = document.getElementById("pcp-filter-summary-text");
  const count = document.getElementById("pcp-filter-count");
  if (summary) summary.textContent = `${productionScopeLabel()} | ${productionViewLabel()} | ${sector} | ${status} | ${state.currentCompanyName || "Todas as lojas"}`;
  if (count) count.textContent = `${activeCount} filtro(s) avancado(s) ativo(s) | ${visibleRows || data.query?.summary?.total || 0} O.S. na lista`;
}

async function renderPcp() {
  const queryParams = productionQueryParams();
  const data = await apiOptional(`/api/production/pcp?${queryParams.toString()}`, { dashboard: {}, alerts: [], capacity: [], porSetor: {}, orders: [], query: { summary: {} } });
  state.productionQuery = data.query || { rows: data.orders || [], summary: {} };
  document.querySelectorAll("[data-production-scope]").forEach(button => button.classList.toggle("active", button.dataset.productionScope === (state.productionScope || "today")));
  document.querySelectorAll("[data-production-view]").forEach(button => button.classList.toggle("active", button.dataset.productionView === (state.productionView || "mine")));
  const companyField = document.getElementById("pcp-filter-company");
  if (companyField) companyField.value = state.currentCompanyName || "Todas as lojas";
  const sectorSelect = document.getElementById("pcp-filter-sector");
  const previousSectorFilter = sectorSelect?.value || "Todas as O.S.";
  if (sectorSelect) {
    sectorSelect.innerHTML = `<option>Todas as O.S.</option>${(data.sectors || []).map(sector => `<option value="${escapeHtml(sector.name)}">${escapeHtml(sector.name)}</option>`).join("")}`;
    sectorSelect.value = [...sectorSelect.options].some(option => option.value === previousSectorFilter) ? previousSectorFilter : "Todas as O.S.";
  }
  const sectorFilter = sectorSelect?.value || "Todas as O.S.";
  const filteredOrders = data.orders || data.query?.rows || [];
  state.filteredProductionOrders = filteredOrders;
  updatePcpFilterSummary(data, filteredOrders.length);
  const strip = document.getElementById("pcp-sector-strip");
  const selectedProductionOrder = state.orders.find(order => order.id === state.selectedProductionOrderId);
  if (state.selectedProductionOrderId && !selectedProductionOrder) state.selectedProductionOrderId = null;
  let moveSelection = document.getElementById("pcp-move-selection");
  if (strip && !moveSelection) {
    strip.insertAdjacentHTML("beforebegin", `<div id="pcp-move-selection" class="pcp-move-selection"></div>`);
    moveSelection = document.getElementById("pcp-move-selection");
  }
  if (moveSelection) {
    moveSelection.innerHTML = selectedProductionOrder
      ? `<div><b>O.S. selecionada: ${escapeHtml(selectedProductionOrder.id)}</b><span>Setor atual: ${escapeHtml(selectedProductionOrder.currentSectorName || selectedProductionOrder.productionStatus || "-")} | Proximo: ${escapeHtml(nextOrderSector(selectedProductionOrder))}</span><small>Clique no card destacado do proximo setor para movimentar a O.S. pela rota congelada.</small></div><button type="button" data-production-action="clear-selection">Limpar selecao</button>`
      : `<div><b>Movimentacao pelos setores</b><span>Selecione uma O.S. na tabela para habilitar o card do proximo setor.</span></div>`;
  }
  if (strip) {
    const selectedNextSector = selectedProductionOrder ? nextOrderSector(selectedProductionOrder) : "";
    strip.innerHTML = (data.sectors || []).map(sector => `<button type="button" data-sector-filter="${escapeHtml(sector.name)}" class="${sectorFilter === sector.name ? "active-filter" : ""} ${selectedNextSector === sector.name ? "move-target" : ""}" style="--sector-color:${escapeHtml(sector.color || "#6f0f8f")}" title="${selectedNextSector === sector.name ? `Mover ${escapeHtml(selectedProductionOrder.id)} para ${escapeHtml(sector.name)}` : `Filtrar O.S. em ${escapeHtml(sector.name)}`}"><span>${escapeHtml(sector.icon || "PCP")}</span><b>${escapeHtml(sector.name)}</b><small>${sector.openOrders || 0} abertas | ${sector.lateOrders || 0} atrasadas</small>${selectedNextSector === sector.name ? `<em>Mover ${escapeHtml(selectedProductionOrder.id)} para ca</em>` : ""}</button>`).join("");
    prepareProductionQuickFilters();
  }
  const today = new Date().toISOString().slice(0, 10);
  const awaiting = filteredOrders.filter(order => productionVisualStatus(order) === "aguardando").length;
  const running = filteredOrders.filter(order => normalizeUxText(order.productionStatus || "").includes("produc")).length;
  const late = filteredOrders.filter(order => productionVisualStatus(order) === "atrasado").length;
  const finishedToday = filteredOrders.filter(order => normalizeUxText(order.productionStatus || "").match(/final|entreg/) && String(order.finishedAt || order.updatedAt || "").slice(0, 10) === today).length;
  const noFile = filteredOrders.filter(order => !(order.files || []).length).length;
  const noPayment = filteredOrders.filter(order => normalizeUxText(order.financialStatus || "").match(/aguard|pend|sem pagamento/)).length;
  document.getElementById("pcp-dashboard-cards").innerHTML = [
    ["O.S. encontradas", data.query?.summary?.total ?? filteredOrders.length, "ok", `Consulta ${state.productionScope === "today" ? "de hoje" : state.productionScope === "next3" ? "dos proximos 3 dias" : "geral"} usando dados da loja ativa.`],
    ["Em producao", data.query?.summary?.running ?? running, running ? "ok" : "warning", "Trabalhos em execucao neste momento."],
    ["Atrasadas", data.query?.summary?.late ?? late, countStatus(late, 1, 3), "O.S. com prazo de entrega vencido."],
    ["Pendentes de material", data.query?.summary?.pendingMaterial ?? 0, countStatus(data.query?.summary?.pendingMaterial, 1, 3), "Ordens que dependem de estoque suficiente."],
    ["Pendentes de aprovacao", data.query?.summary?.pendingApproval ?? 0, countStatus(data.query?.summary?.pendingApproval, 1, 3), "Ordens que ainda dependem de aprovacao."],
    ["Instalacao / logistica", data.query?.summary?.installation ?? 0, countStatus(data.query?.summary?.installation, 3, 7), "Ordens com entrega ou instalacao externa."]
  ].map(item => managerCard(item[0], item[1], item[2], item[3])).join("");
  document.getElementById("production-alerts").innerHTML = (data.alerts || []).map(alert => `<div class="alert ${alert.severity}"><b>${businessLabel(alert.type)}</b><span>${alert.message}</span><small>Acao sugerida: avaliar setor, responsavel e prazo da O.S.</small></div>`).join("") || "<p>Sem alertas de producao.</p>";
  document.getElementById("capacity-list").innerHTML = (data.capacity || []).map(item => `<div class="small-card"><b>${item.resource}</b><span>${item.sector}</span><small>Capacidade: ${item.dailyCapacity} ${item.unit}/dia</small><small>Ocupada: ${item.occupied} | Disponivel: ${item.available}</small></div>`).join("");
  const sectors = Object.keys(data.porSetor || {});
  document.getElementById("pcp-board").innerHTML = sectors.map(sector => `
    <div class="column">
      <h3>${sector}</h3>
      ${(data.porSetor[sector] || []).map(order => `<div class="job production-card status-${productionVisualStatus(order)}">
        <b>${order.id} - ${order.customerName}</b>
        <p>${order.productName || order.jobName}</p>
        <small>Prazo: ${order.dueDate} | Prioridade: ${order.priority}</small>
        ${processIcons(order)}
      </div>`).join("")}
    </div>
  `).join("");
  const productionTableBody = document.getElementById("production-detail-table");
  if (productionTableBody) productionTableBody.dataset.simpleReady = "false";
  document.getElementById("production-detail-table").innerHTML = filteredOrders.map(order => {
    const product = state.products.find(item => item.id === order.productId)?.name || order.jobName || order.productName || "Servico grafico";
    const visual = productionVisualStatus(order);
    const responsible = order.responsible || order.currentResponsible || order.events?.[0]?.startedBy || "Definir";
    const currentSector = order.currentSectorName || order.currentSector || order.productionStatus || "-";
    const isPaused = normalizeUxText(order.productionStatus || "").includes("paus");
    const isRunning = normalizeUxText(order.productionStatus || "").includes("produc");
    const isHomologation = normalizeUxText(order.productionStatus || "").includes("homologacao") || normalizeUxText(order.productionStatus || "").includes("finalizada");
    const isHomologated = normalizeUxText(order.productionStatus || "").includes("homologada");
    const isClosed = normalizeUxText(order.productionStatus || "").match(/entreg|cancel|liberada/);
    const primaryLabel = isPaused ? "Retomar" : isRunning ? "Finalizar etapa" : "Iniciar";
    const primaryAction = isPaused ? "retomar" : isRunning ? "finalizar" : "iniciar";
    return `<tr class="production-row status-${visual} ${state.selectedProductionOrderId === order.id ? "selected-for-move" : ""}" data-order-row="${order.id}" tabindex="0">
      <td class="production-order-cell"><b>${escapeHtml(order.id)}</b><small>${escapeHtml(order.priority || "normal")} | ${escapeHtml(order.financialStatus || "financeiro restrito")}</small></td>
      <td><b>${escapeHtml(order.customerName || customerName(order.customerId))}</b><small>${escapeHtml(order.companyName || state.currentCompanyName || "Loja atual")}</small></td>
      <td><b>${escapeHtml(product)}</b><small>${escapeHtml(order.logistics || order.answers?.logistics || "A combinar")}</small></td>
      <td><b>${escapeHtml(currentSector)}</b><small>Proximo: ${escapeHtml(order.nextSectorName || nextOrderSector(order))}</small>${order.fileRequired && order.fileMissing ? `<small class="critical-text">Arquivo obrigatorio pendente</small>` : ""}${order.checklistRequired && !order.checklistCompleted ? `<small class="critical-text">Checklist pendente</small>` : ""}</td>
      <td>${escapeHtml(responsible)}</td>
      <td><b>${escapeHtml(order.dueDate || "-")}</b><small>${escapeHtml(order.timeRemainingLabel || "-")}</small></td>
      <td><span class="status-pill production">${escapeHtml(order.productionStatus || visual.replace("_", " "))}</span></td>
      <td><b class="next-action-text">${escapeHtml(productionNextAction(order))}</b></td>
      <td class="row-actions">
        <button class="primary-row-action" data-production-action="ver-detalhes" data-order="${order.id}">Visualizar</button>
        ${!isClosed && !isHomologation && !isHomologated ? `<button data-production-action="select-order" data-order="${order.id}">${state.selectedProductionOrderId === order.id ? "Selecionada" : "Selecionar"}</button>
        <button data-production-action="editar-producao" data-order="${order.id}">Editar</button>
        <button data-production-action="agendar-producao" data-order="${order.id}">Agendar</button>
        <button data-production-action="${primaryAction}" data-order="${order.id}">${primaryLabel}</button>
        ${isRunning ? `<button data-production-action="pausar" data-order="${order.id}">Pausar</button>` : ""}
        <button data-action="move-next-sector" data-order="${order.id}">Proximo setor</button>
        ${order.checklistRequired && !order.checklistCompleted ? `<button data-production-action="checklist" data-order="${order.id}">Checklist</button>` : ""}
        <button data-production-action="retrabalho" data-order="${order.id}">Retrabalho</button>
        <button class="danger-action" data-production-action="cancelar-producao" data-order="${order.id}">Cancelar</button>` : ""}
        ${isHomologation ? `<button data-production-action="homologar" data-order="${order.id}">Homologar</button><button class="danger-action" data-production-action="reprovar" data-order="${order.id}">Reprovar</button>` : ""}
        ${isHomologated ? `<button data-production-action="liberar" data-order="${order.id}">Liberar entrega</button>` : ""}
        <button data-production-action="adicionar-observacao" data-order="${order.id}">Observacao</button>
        <button data-production-action="registrar-duvida" data-order="${order.id}">Duvida</button>
        <button data-production-action="ver-arquivos" data-order="${order.id}">Arquivos</button>
        ${(order.productionFiles || []).length || (order.files || []).length ? `<button data-production-action="download-file" data-order="${order.id}">Baixar arquivo</button>` : `<button data-action="attach-order" data-order="${order.id}">Anexar arquivo</button>`}
        <button data-action="open-order" data-order="${order.id}">O.S.</button>
        <button data-action="print-order" data-order="${order.id}">Imprimir</button>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="9"><div class="premium-empty-state"><b>Nenhuma O.S. encontrada.</b><span>Ajuste os filtros ou atualize a producao.</span></div></td></tr>`;
  simplifyProductionTable();
  renderProductionOrderDetailPanel(state.activeOrderId || filteredOrders[0]?.id);
  renderPcpRealReport();
}

function customerName(id) {
  return state.customers.find(customer => customer.id === id)?.name || "Cliente";
}

document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => view(button.dataset.view)));
document.getElementById("menu-toggle").addEventListener("click", () => {
  document.querySelector(".app").classList.toggle("sidebar-collapsed");
});
window.addEventListener("hashchange", () => {
  const target = location.hash.replace("#", "") || "dashboard";
  if (document.getElementById(target)) view(target);
});
document.getElementById("quote-customer").addEventListener("change", renderQuoteCustomerCard);
document.getElementById("quote-deadline")?.addEventListener("input", event => {
  if (event.isTrusted) event.target.dataset.autoSuggested = "false";
});
document.getElementById("quote-product").addEventListener("change", () => {
  state.quoteItemDraftAnswers.productModelId = "";
  renderQuoteProductModels();
  applyProductConfigurationToQuote();
  renderQuoteItemPreview(state.activeQuotePricing);
  scheduleQuoteCalculation();
});
document.getElementById("quote-composition").addEventListener("change", () => {
  const option = document.getElementById("quote-composition").selectedOptions[0];
  if (option?.dataset.product) document.getElementById("quote-product").value = option.dataset.product;
  renderQuoteProductModels();
  renderCompositionInfo();
  renderQuestions();
  scheduleQuoteCalculation();
});
document.getElementById("quote-form").addEventListener("input", scheduleQuoteCalculation);
document.getElementById("quote-form").addEventListener("change", scheduleQuoteCalculation);
document.getElementById("lead-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api("/api/crm/leads", {
    method: "POST",
    body: {
      name: document.getElementById("lead-name").value,
      company: document.getElementById("lead-company").value,
      phone: document.getElementById("lead-phone").value,
      whatsapp: document.getElementById("lead-whatsapp").value,
      origin: document.getElementById("lead-origin").value,
      seller: document.getElementById("lead-seller").value,
      interest: document.getElementById("lead-interest").value,
      estimatedValue: document.getElementById("lead-estimated").value,
      nextContactAt: document.getElementById("lead-next").value,
      observation: document.getElementById("lead-note").value
    }
  });
  await loadAll();
});
document.getElementById("follow-form").addEventListener("submit", async event => {
  event.preventDefault();
  const leadId = document.getElementById("follow-lead").value;
  await api(`/api/crm/leads/${leadId}/follow-ups`, {
    method: "POST",
    body: {
      seller: document.getElementById("follow-seller").value,
      date: document.getElementById("follow-date").value,
      time: document.getElementById("follow-time").value,
      channel: document.getElementById("follow-channel").value,
      observation: document.getElementById("follow-note").value,
      status: "em atendimento"
    }
  });
  await loadAll();
});
document.getElementById("convert-customer").addEventListener("click", async () => {
  const leadId = document.getElementById("convert-lead").value;
  await api(`/api/crm/leads/${leadId}/convert-customer`, { method: "POST", body: {} });
  await loadAll();
});
document.getElementById("lead-convert-form").addEventListener("submit", async event => {
  event.preventDefault();
  const leadId = document.getElementById("convert-lead").value;
  await api(`/api/crm/leads/${leadId}/convert-quote`, {
    method: "POST",
    body: {
      productId: document.getElementById("convert-product").value,
      compositionId: document.getElementById("convert-composition").value,
      jobName: document.getElementById("convert-job").value
    }
  });
  await loadAll();
  view("quote");
});
document.getElementById("portal-token-form").addEventListener("submit", async event => {
  event.preventDefault();
  state.portalToken = document.getElementById("portal-token").value;
  state.portalData = await api(`/api/portal/${state.portalToken}`);
  renderPortal();
});
document.getElementById("portal-upload-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api(`/api/portal/${state.portalToken}/uploads`, {
    method: "POST",
    body: {
      quoteId: document.getElementById("portal-upload-quote").value,
      orderId: document.getElementById("portal-upload-order").value,
      fileName: document.getElementById("portal-upload-file").value,
      notes: document.getElementById("portal-upload-note").value
    }
  });
  state.portalData = await api(`/api/portal/${state.portalToken}`);
  renderPortal();
});
document.getElementById("portal").addEventListener("click", async event => {
  if (event.target.dataset.portalApprove) {
    await api(`/api/portal/${state.portalToken}/quotes/${event.target.dataset.portalApprove}/approval`, { method: "POST", body: { status: "aprovado", observation: "Aprovado pelo portal" } });
    await loadAll();
    view("portal");
  }
  if (event.target.dataset.portalAdjust) {
    await api(`/api/portal/${state.portalToken}/quotes/${event.target.dataset.portalAdjust}/approval`, { method: "POST", body: { status: "ajuste solicitado", observation: "Cliente solicitou ajuste" } });
    await loadAll();
    view("portal");
  }
  if (event.target.dataset.artApprove) {
    await api(`/api/portal/${state.portalToken}/orders/${event.target.dataset.artApprove}/art-approval`, { method: "POST", body: { status: "aprovado", comment: "Arte aprovada pelo cliente" } });
    await loadAll();
    view("portal");
  }
  if (event.target.dataset.artAdjust) {
    await api(`/api/portal/${state.portalToken}/orders/${event.target.dataset.artAdjust}/art-approval`, { method: "POST", body: { status: "ajuste solicitado", comment: "Cliente pediu ajuste na arte" } });
    await loadAll();
    view("portal");
  }
});
document.getElementById("intel-refresh").addEventListener("click", async () => {
  state.intelligence = await api("/api/intelligence/refresh", { method: "POST", body: { user: state.user?.name || "Usuario" } });
  state.analytics = await api("/api/analytics");
  renderAIAssistantPanel();
});
document.getElementById("intelligence").addEventListener("click", event => {
  if (event.target.dataset.question) document.getElementById("intel-question").value = event.target.dataset.question;
  if (event.target.dataset.assistantView) navigateFromAssistant(event.target.dataset.assistantView);
});
document.getElementById("intel-question-form").addEventListener("submit", async event => {
  event.preventDefault();
  const answer = await api("/api/intelligence/executive-assistant", { method: "POST", body: { question: document.getElementById("intel-question").value, user: state.user?.name || "Usuario" } });
  safeSetHTML("intel-answer", `<p>${escapeHtml(answer.answer)}</p>${answer.targetView ? `<button type="button" data-assistant-view="${escapeHtml(answer.targetView)}">Abrir tela relacionada</button>` : ""}`, true);
});
document.getElementById("intel-quote-form").addEventListener("submit", async event => {
  event.preventDefault();
  const suggestion = await api("/api/intelligence/quote-assistant", { method: "POST", body: { text: document.getElementById("intel-quote-text").value, user: state.user?.name || "Usuario" } });
  document.getElementById("intel-quote-result").innerHTML = detailPanel([
    ["Composição sugerida", suggestion.composition || suggestion.compositionName || "Não identificada"],
    ["Materiais prováveis", (suggestion.materials || []).join(", ") || "Confirmar com o cliente"],
    ["Perguntas necessárias", (suggestion.questions || []).length ? `${suggestion.questions.length} pergunta(s)` : "Nenhuma pergunta adicional"],
    ["Prazo estimado", suggestion.deadline || suggestion.estimatedDeadline || "A confirmar"],
    ["Margem sugerida", `${suggestion.margin || suggestion.marginPercent || 0}%`]
  ], suggestion, "Ver sugestão completa");
});
document.getElementById("global-search-form").addEventListener("submit", async event => {
  event.preventDefault();
  const result = await api(`/api/search/global?q=${encodeURIComponent(document.getElementById("global-search").value)}`);
  document.getElementById("global-search-results").innerHTML = result.results.map(item => `<div class="job"><b>${businessLabel(item.type)}: ${item.title}</b><small>${item.id ? `Código: ${item.id}` : ""}</small><p>${item.link || "Abra o módulo correspondente para consultar."}</p></div>`).join("") || "<p>Nenhum resultado encontrado.</p>";
});
document.getElementById("preferences-form").addEventListener("submit", async event => {
  event.preventDefault();
  state.preferences = await api("/api/preferences", {
    method: "POST",
    body: {
      theme: document.getElementById("pref-theme").value,
      favorites: document.getElementById("pref-favorites").value.split(",").map(item => item.trim()).filter(Boolean),
      shortcuts: document.getElementById("pref-shortcuts").value.split(",").map(item => item.trim()).filter(Boolean),
      dashboardWidgets: document.getElementById("pref-widgets").value.split(",").map(item => item.trim()).filter(Boolean)
    }
  });
  renderIntelligence();
});
document.getElementById("bi-export-csv").addEventListener("click", async () => {
  const response = await fetch("/api/bi/executive-report/csv");
  document.getElementById("bi-export-preview").textContent = await response.text();
});
document.getElementById("bi-export-pdf").addEventListener("click", async () => {
  const response = await fetch("/api/bi/executive-report/pdf");
  document.getElementById("bi-export-preview").textContent = await response.text();
});
document.getElementById("bi-run-automations").addEventListener("click", async () => {
  const result = await api("/api/automations/run", { method: "POST", body: {} });
  document.getElementById("bi-export-preview").innerHTML = detailPanel([
    ["Rotina executada", "Automações internas"],
    ["Resultado", result.ok === false ? "Atenção" : "Concluído"],
    ["Registros processados", result.count ?? result.processed ?? 0]
  ], result, "Ver retorno completo");
  await loadAll();
  view("bi");
});
document.getElementById("integration-message-form").addEventListener("submit", async event => {
  event.preventDefault();
  const customer = state.customers.find(item => item.id === document.getElementById("integration-customer").value);
  await api("/api/integrations/messages", {
    method: "POST",
    body: {
      channel: document.getElementById("integration-channel").value,
      event: document.getElementById("integration-event").value,
      template: document.getElementById("integration-template").value,
      customerId: customer?.id,
      phone: customer?.phone,
      email: customer?.email,
      variables: { cliente: customer?.name || "", orcamento: "ORC-DEMO" }
    }
  });
  await loadAll();
  view("integrations");
});
document.getElementById("admin-product").addEventListener("change", renderAdminQuestions);
document.getElementById("technical-product").addEventListener("change", renderTechnicalSheet);
document.getElementById("history-order").addEventListener("change", renderSelectedHistory);
document.getElementById("postcalc-order").addEventListener("change", renderSelectedPostcalc);
document.getElementById("pcp-report-order").addEventListener("change", renderPcpRealReport);
document.getElementById("quick-product").addEventListener("change", () => {
  const option = document.getElementById("quick-product").selectedOptions[0];
  document.getElementById("quick-description").value = option?.dataset.name || "";
  document.getElementById("quick-unit").value = option?.dataset.base || 0;
});
document.getElementById("pricing-simulator-form").addEventListener("submit", async event => {
  event.preventDefault();
  const simulation = await api("/api/pricing-simulator/simulate", {
    method: "POST",
    body: {
      compositionId: document.getElementById("sim-composition").value,
      answers: {
        width: Number(document.getElementById("sim-width").value || 0),
        height: Number(document.getElementById("sim-height").value || 0),
        quantity: Number(document.getElementById("sim-quantity").value || 1),
        distance_km: Number(document.getElementById("sim-distance").value || 0),
        installation: true,
        lamination: true,
        varnish: true,
        adhesive_applied: true,
        auto_varnish: false
      },
      additionalExpenses: Number(document.getElementById("sim-extra").value || 0),
      manualPrice: Number(document.getElementById("sim-manual").value || 0)
    }
  });
  state.activeSimulation = simulation;
  state.pricingSimulations.push(simulation);
  renderSimulationResult(simulation);
  renderSimulationHistory();
});
document.getElementById("sim-create-quote").addEventListener("click", async () => {
  if (!state.activeSimulation) return;
  const quote = await api(`/api/pricing-simulator/${state.activeSimulation.id}/quote`, {
    method: "POST",
    body: { jobName: `Validacao Fase 1 - ${state.activeSimulation.compositionName}` }
  });
  await loadAll();
  view("quote");
  document.getElementById("price-result").innerHTML = detailPanel([
    ["Orçamento criado", quote.quoteNumber],
    ["Origem", "Simulação de precificação"],
    ["Memória de custo", quote.costHistory ? "Salva no orçamento" : "Não retornada"]
  ], { criado: quote.quoteNumber, costHistory: quote.costHistory }, "Ver detalhes do orçamento");
});
document.getElementById("simulate-price").addEventListener("click", async () => {
  const result = await api("/api/quote/calculate", {
    method: "POST",
    body: quoteRequestBody()
  });
  renderQuotePricingResult(result);
  renderQuoteItemPreview(result);
  renderQuoteTotals(result);
});
document.getElementById("quote-form").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await saveCurrentQuoteDraft();
    showToast("Orcamento salvo.", "success");
  } catch (error) {
    document.getElementById("quote-price-alerts").innerHTML = `<div class="alert red"><b>Bloqueio de desconto</b><span>${error.message}</span></div>`;
  }
});
document.body.addEventListener("click", async event => {
  const clickedButton = event.target.closest("button");
  const target = clickedButton || event.target;
  if (target.dataset?.projectAction) {
    const action = target.dataset.projectAction;
    try {
      if (action === "analyze") await analyzeQuoteProject();
      if (action === "accept-suggestion") await addProjectSuggestionToQuote(Number(target.dataset.index || 0));
      if (action === "select-suggestion") selectProjectSuggestion(Number(target.dataset.index || 0));
      if (action === "create-draft") await createProjectQuoteDraft();
      if (action === "clear") {
        state.projectRecognition.active = null;
        state.projectRecognition.draft = null;
        renderProjectRecognitionReview();
        showToast("Analise do projeto removida da tela.", "info");
      }
    } catch (error) {
      showToast(error.message, "error");
    }
    return;
  }
  if (target.dataset?.notificationAction) {
    const notification = (state.notifications?.queue || []).find(item => item.id === target.dataset.id);
    const action = target.dataset.notificationAction;
    if (!notification) return showToast("Notificacao nao encontrada.", "warning");
    try {
      if (action === "open-whatsapp") {
        if (!notification.whatsappLink) return showToast("Esta notificacao nao possui link de WhatsApp.", "warning");
        window.open(notification.whatsappLink, "_blank", "noopener");
      } else if (action === "copy-message") {
        await copyTextToClipboard(notification.message || "");
        showToast("Mensagem copiada.", "success");
      } else if (action === "view-order") {
        state.activeOrderId = notification.orderId;
        view("orders-search");
        renderOrders();
      } else if (action === "view-quote") {
        view("quote");
        const quote = state.quotes.find(item => item.id === notification.quoteId);
        if (quote) showToast(`Orcamento ${quote.quoteNumber || quote.id} aberto para consulta.`, "info");
      } else {
        await api(`/api/notifications/${notification.id}/${action}`, { method: "POST", body: { user: state.user?.name || "Usuario" } });
        await loadAll();
        renderNotificationCenter();
        showToast(action === "manual-confirmed" ? "Envio manual confirmado." : action === "cancel" ? "Notificacao cancelada." : action === "mark-sent" ? "Notificacao marcada como enviada." : "Notificacao reenfileirada.", "success");
      }
    } catch (error) {
      showToast(error.message, "error");
    }
    return;
  }
  if (target.dataset?.action === "preview-print-settings") {
    const order = (state.orders || [])[0];
    if (!order) return showToast("Crie ou selecione uma O.S. para visualizar a impressao.", "warning");
    openDocumentPreview(`Previa da O.S. ${order.id}`, printServiceOrder(order), false);
    return;
  }
  if (target.dataset?.action === "test-communication-settings") {
    try {
      const result = await api("/api/communication-settings/test", { method: "POST", body: { user: state.user?.name || "Usuario" } });
      const status = document.getElementById("communication-settings-status");
      if (status) status.innerHTML = detailPanel([["Status", result.status], ["Mensagem", result.message], ["Link WhatsApp", result.whatsappLink || "-"]], result, "Ver retorno do teste");
      showToast(result.message, result.status === "ready" ? "success" : "info");
    } catch (error) {
      showToast(error.message, "error");
    }
    return;
  }
  if (target.dataset?.orderItemAction) {
    const orderId = target.dataset.order;
    const itemId = target.dataset.item;
    const action = target.dataset.orderItemAction;
    try {
      if (action === "duplicate") {
        await duplicateOrderItem(orderId, itemId);
      } else if (action === "remove") {
        if (!window.confirm("Remover este produto da O.S.? Totais e rota serão atualizados.")) return;
        await removeOrderItem(orderId, itemId);
      } else if (action === "edit") {
        const order = state.orders.find(item => item.id === orderId);
        const item = orderItems(order).find(orderItem => String(orderItem.id) === String(itemId));
        const quantity = window.prompt("Informe a nova quantidade:", item?.quantity || item?.answers?.quantity || 1);
        if (quantity === null) return;
        await api(`/api/orders/${orderId}/items/${itemId}`, { method: "PATCH", body: { quantity: Number(quantity || 1), user: state.user?.name || "Atendimento" } });
      }
      state.activeOrderId = orderId;
      state.activeOrderDetailTab = "items";
      await loadAll();
      view("orders-search");
      showToast(`Item da O.S. ${action === "duplicate" ? "duplicado" : action === "remove" ? "removido" : "atualizado"}.`, "success");
    } catch (error) {
      showToast(error.message, "error");
    }
    return;
  }
  if (target.dataset?.quoteFinalAction) {
    try {
      await handleQuoteFinalAction(target.dataset.quoteFinalAction);
    } catch (error) {
      showToast(error.message, "error");
    }
    return;
  }
  const productionRow = event.target.closest?.("tr[data-order-row]");
  if (!clickedButton && productionRow?.dataset.orderRow) {
    state.activeOrderId = productionRow.dataset.orderRow;
    view("orders");
    renderOrders();
    document.getElementById("order-page")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const orderRow = event.target.closest?.("tr[data-order-list-row]");
  if (!clickedButton && orderRow?.dataset.orderListRow) {
    state.activeOrderId = orderRow.dataset.orderListRow;
    renderOrders();
    document.getElementById("order-page")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (target.id === "refresh-validation") {
    state.validationReport = await api("/api/audit/validation-erp");
    renderValidationReport();
  }
  if (target.dataset.simPreset) {
    const presets = {
      cmp1: { width: 4, height: 1.8, quantity: 1, distance: 24, extra: 120, manual: 4200 },
      cmp2: { width: 3, height: 1.2, quantity: 2, distance: 0, extra: 25, manual: 520 },
      cmp3: { width: 2.5, height: 1.4, quantity: 1, distance: 18, extra: 80, manual: 1600 },
      cmp4: { width: 1.2, height: .8, quantity: 3, distance: 0, extra: 35, manual: 950 },
      cmp5: { width: 2.2, height: 4, quantity: 1, distance: 32, extra: 350, manual: 9800 },
      cmp6: { width: 3.5, height: 1.3, quantity: 1, distance: 20, extra: 220, manual: 7200 }
    };
    const preset = presets[target.dataset.simPreset] || presets.cmp1;
    document.getElementById("sim-composition").value = target.dataset.simPreset;
    document.getElementById("sim-width").value = preset.width;
    document.getElementById("sim-height").value = preset.height;
    document.getElementById("sim-quantity").value = preset.quantity;
    document.getElementById("sim-distance").value = preset.distance;
    document.getElementById("sim-extra").value = preset.extra;
    document.getElementById("sim-manual").value = preset.manual;
    view("pricing-simulator");
  }
  if (target.dataset.approve) {
    await api(`/api/quotes/${target.dataset.approve}/approve`, { method: "POST", body: {} });
    await loadAll();
    view("orders");
  }
  if (target.dataset.printQuote) {
    const quote = state.quotes.find(item => item.id === target.dataset.printQuote);
    if (!quote) return showToast("Orcamento nao encontrado para impressao.", "warning");
    openDocumentPreview(`Orcamento ${quote.quoteNumber || quote.id}`, printQuote(quote), false);
    return;
  }
  if (target.dataset.productionAction) {
    const action = target.dataset.productionAction;
    if (action === "clear-selection") {
      state.selectedProductionOrderId = null;
      await renderPcp();
      showToast("Selecao de movimentacao removida.", "success");
      return;
    }
    const orderId = target.dataset.order || state.activeOrderId;
    if (!orderId) {
      showToast("Selecione uma O.S. para movimentar a producao.", "warning");
      return;
    }
    const selectedOrder = state.orders.find(order => order.id === orderId);
    if (action === "select-order") {
      state.selectedProductionOrderId = orderId;
      state.activeOrderId = orderId;
      await renderPcp();
      showToast(`${orderId} selecionada. Clique no card do proximo setor para movimentar.`, "success");
      return;
    }
    if (action === "ver-detalhes") {
      state.activeOrderId = orderId;
      state.selectedProductionOrderId = orderId;
      renderProductionOrderDetailPanel(orderId);
      document.getElementById("production-order-detail-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "ver-arquivos") {
      state.activeOrderId = orderId;
      renderProductionOrderDetailPanel(orderId);
      document.getElementById("production-detail-files")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (action === "download-file") {
      const files = productionFileEntries(selectedOrder || {});
      const file = files.find(item => String(item.id || productionFileName(item)) === String(target.dataset.file || "")) || selectedOrder?.productionFiles?.[0] || (selectedOrder?.files || [])[0];
      if (!file) return showToast("Nenhum arquivo de producao disponivel.", "warning");
      const fileId = file.id || file.name || file;
      const result = await api(`/api/orders/${orderId}/files/${encodeURIComponent(fileId)}/download`);
      showToast(result.message || "Download registrado.", "success");
      await loadAll();
      view("production-pcp");
      return;
    }
    if (action === "editar-producao") {
      const responsible = window.prompt("Responsavel atual da producao:", selectedOrder?.currentResponsible || selectedOrder?.responsible || "");
      if (responsible === null) return;
      const dueDate = window.prompt("Prazo da O.S. (AAAA-MM-DD):", selectedOrder?.dueDate || "");
      if (dueDate === null) return;
      await api(`/api/orders/${orderId}/production-settings`, {
        method: "PATCH",
        body: { currentResponsible: responsible, dueDate, user: state.user?.name || "PCP", observation: "Responsavel e prazo atualizados pelo PCP." }
      });
      await loadAll();
      view("production-pcp");
      showToast("Dados da producao atualizados e auditados.", "success");
      return;
    }
    if (action === "agendar-producao") {
      const scheduledProductionDate = window.prompt("Data da producao (AAAA-MM-DD):", selectedOrder?.scheduledProductionDate || selectedOrder?.dueDate || "");
      if (!scheduledProductionDate) return;
      await api(`/api/orders/${orderId}/production-settings`, {
        method: "PATCH",
        body: { scheduledProductionDate, user: state.user?.name || "PCP", observation: `Producao agendada para ${scheduledProductionDate}.` }
      });
      await loadAll();
      view("production-pcp");
      showToast("Producao agendada e registrada no historico.", "success");
      return;
    }
    if (action === "cancelar-producao") {
      if (!window.confirm(`Cancelar a producao da ${orderId}?`)) return;
      const cancelReason = window.prompt("Informe o motivo do cancelamento:");
      if (!cancelReason) return;
      await api(`/api/orders/${orderId}/production-events`, {
        method: "POST",
        body: { action: "cancelar", cancelReason, observation: cancelReason, user: state.user?.name || "PCP" }
      });
      await loadAll();
      view("production-pcp");
      showToast("Producao cancelada com historico e auditoria.", "success");
      return;
    }
    if (action === "checklist") {
      const observation = window.prompt("Observacao da conferencia da etapa:", "Conferencia e qualidade validadas");
      if (observation === null) return;
      await api(`/api/orders/${orderId}/production-checklist`, {
        method: "POST",
        body: {
          requiredItems: ["Conferencia da etapa", "Qualidade validada"],
          items: ["Conferencia da etapa", "Qualidade validada"],
          observation,
          responsible: state.user?.name || "Producao"
        }
      });
      await loadAll();
      view("production-pcp");
      showToast("Checklist da etapa concluido e auditado.", "success");
      return;
    }
    if (action === "retrabalho") {
      const description = window.prompt("Descreva o retrabalho e o motivo:");
      if (!description) return;
      await api(`/api/orders/${orderId}/production-problems`, {
        method: "POST",
        body: {
          type: "retrabalho",
          description,
          responsible: state.user?.name || "Producao",
          sector: selectedOrder?.currentSectorName || selectedOrder?.productionStatus || "Producao",
          rework: true
        }
      });
      await loadAll();
      view("production-pcp");
      showToast("Retrabalho registrado no custo, timeline e auditoria.", "success");
      return;
    }
    if (action === "adicionar-observacao") {
      const observation = window.prompt("Digite a observacao para o historico da O.S.:");
      if (!observation) return;
      await api(`/api/orders/${orderId}/production-events`, { method: "POST", body: { action: "observacao", observation, user: state.user?.name || "Producao" } });
      await loadAll();
      view("production-pcp");
      showToast("Observacao registrada no historico.", "success");
      return;
    }
    if (action === "registrar-duvida") {
      const observation = window.prompt("Descreva a duvida da producao:");
      if (!observation) return;
      await api(`/api/orders/${orderId}/production-events`, { method: "POST", body: { action: "observacao", observation: `Duvida da producao: ${observation}`, user: state.user?.name || "Producao" } });
      await loadAll();
      state.activeOrderId = orderId;
      view("production-pcp");
      showToast("Duvida registrada no historico da O.S.", "success");
      return;
    }
    if (action === "homologar") {
      if (!window.confirm(`Homologar a producao da ${orderId} e liberar para entrega?`)) return;
      const observation = window.prompt("Observacao da homologacao:", "Conferencia final aprovada");
      if (observation === null) return;
      await api(`/api/orders/${orderId}/production-events`, { method: "POST", body: { action: "homologar", observation, user: state.user?.name || "PCP" } });
      await loadAll();
      state.activeOrderId = orderId;
      view("production-pcp");
      showToast("Producao homologada e liberada para entrega.", "success");
      return;
    }
    if (action === "reprovar") {
      const reworkReason = window.prompt("Informe o motivo da reprova ou retrabalho:");
      if (!reworkReason) return;
      await api(`/api/orders/${orderId}/production-events`, { method: "POST", body: { action: "reprovar", reworkReason, observation: reworkReason, user: state.user?.name || "PCP" } });
      await loadAll();
      state.activeOrderId = orderId;
      view("production-pcp");
      showToast("Producao reprovada e enviada para retrabalho.", "success");
      return;
    }
    if (action === "liberar") {
      if (!window.confirm(`Liberar ${orderId} para entrega?`)) return;
      await api(`/api/orders/${orderId}/production-events`, { method: "POST", body: { action: "liberar", observation: "Liberada para entrega pelo PCP.", user: state.user?.name || "PCP" } });
      await loadAll();
      state.activeOrderId = orderId;
      view("production-pcp");
      showToast("O.S. liberada para entrega.", "success");
      return;
    }
    if (action === "observar" && selectedOrder) {
      const notes = [
        selectedOrder.productionNotes,
        selectedOrder.internalProductionWarnings,
        selectedOrder.fileInstructions,
        selectedOrder.installationNotes
      ].filter(Boolean).join("\n\n");
      window.alert(notes || "Esta O.S. nao possui observacoes de producao.");
      return;
    }
    if (action === "finalizar" && !window.confirm("Confirmar a finalizacao desta etapa de producao?")) return;
    let observation = `Acao ${action} registrada pelo painel de producao`;
    if (action === "pausar") {
      const reason = window.prompt("Informe o motivo da pausa:");
      if (reason === null) return;
      observation = reason || "Pausa operacional registrada pelo painel";
    }
    if (["observar", "problema"].includes(action)) {
      const note = window.prompt(action === "problema" ? "Descreva o problema identificado:" : "Registre a observacao da producao:");
      if (!note) return;
      observation = note;
    }
    await api(`/api/orders/${orderId}/production-events`, {
      method: "POST",
      body: {
        action,
        sector: "Producao",
        startedBy: action === "iniciar" ? state.user?.name : "",
        pausedBy: action === "pausar" ? state.user?.name : "",
        finishedBy: action === "finalizar" ? state.user?.name : "",
        pauseReason: action === "pausar" ? observation : "",
        problem: action === "problema" ? observation : "",
        observation
      }
    });
    await loadAll();
    view("production-pcp");
    showToast("Producao atualizada.", "success");
    return;
  }
  if (target.classList?.contains("inactive-action")) {
    return;
  }
  const action = target.dataset.action;
  const orderId = target.dataset.order || state.activeOrderId;
  if (action && ["bill-order", "send-pcp", "attach-order", "history-order", "open-order", "order-note", "print-order", "pdf-order", "move-next-sector"].includes(action) && !orderId) {
    alert("Selecione uma O.S. antes de executar esta acao.");
    return;
  }
  if (action === "open-order") {
    state.activeOrderId = orderId;
    view("orders-search");
    renderOrders();
  }
  if (action === "print-order") openOrderPrint(orderId, false);
  if (action === "pdf-order") openOrderPrint(orderId, true, true);
  if (action === "move-next-sector") {
    const order = state.orders.find(item => item.id === orderId);
    if (!order) return;
    const nextSector = nextOrderSector(order);
    if (!window.confirm(`Enviar ${order.id} para ${nextSector}?`)) return;
    try {
      await api(`/api/orders/${orderId}/move-sector`, { method: "POST", body: { nextSector, user: state.user?.name || "PCP" } });
      await loadAll();
      view("pcp");
      showToast(`O.S. enviada para ${nextSector}.`, "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  }
  if (action === "bill-order") {
    const order = state.orders.find(item => item.id === orderId);
    if (order && !orderIsBillable(order)) {
      showToast("Esta O.S. nao gera financeiro. Retrabalho, cortesia e cancelada ficam apenas no operacional.", "warning");
      return;
    }
    view("cash-receive");
    document.getElementById("pay-order").value = orderId;
    renderPaymentOrderInfo();
  }
  if (action === "order-note") {
    const note = window.prompt("Digite a observacao da O.S.:");
    if (!note) return;
    await api(`/api/orders/${orderId}/production-events`, {
      method: "POST",
      body: {
        action: "observacao",
        sector: "Atendimento",
        startedBy: state.user?.name || "",
        observation: note
      }
    });
    await loadAll();
    view("orders");
    showToast("Observacao registrada na timeline.", "success");
  }
  if (action === "send-pcp") {
    try {
      await api(`/api/orders/${orderId}/send-pcp`, { method: "POST", body: {} });
      await loadAll();
      view("pcp");
    } catch (error) {
      alert(error.message);
    }
  }
  if (action === "attach-order") {
    view("orders-no-file");
    document.getElementById("approval-order").value = orderId;
    document.getElementById("approval-file").focus();
  }
  if (action === "history-order") {
    state.activeOrderId = orderId;
    view("orders-followup");
    document.getElementById("history-order").value = orderId;
    renderSelectedHistory();
    renderFocusedOperationalSubpages();
    document.getElementById("order-history")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
});
document.getElementById("order-filter").addEventListener("input", renderOrders);
document.getElementById("cash-open-form").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await api("/api/cash/open", {
      method: "POST",
      body: {
        operator: document.getElementById("cash-open-operator").value,
        date: document.getElementById("cash-open-date").value,
        hour: document.getElementById("cash-open-hour").value,
        openingAmount: Number(document.getElementById("cash-open-amount").value || 0)
      }
    });
    await loadAll();
  } catch (error) {
    alert(error.message);
  }
});
document.getElementById("cash-sale-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api("/api/cash/sale", { method: "POST", body: { amount: document.getElementById("cash-sale-amount").value, paymentMethod: document.getElementById("cash-sale-method").value } });
  await loadAll();
});
document.getElementById("cash-adjust-form").addEventListener("submit", async event => {
  event.preventDefault();
  const type = document.getElementById("cash-adjust-type").value;
  await api(`/api/cash/${type}`, {
    method: "POST",
    body: {
      responsible: document.getElementById("cash-adjust-responsible").value,
      amount: Number(document.getElementById("cash-adjust-amount").value || 0),
      reason: document.getElementById("cash-adjust-note").value,
      origin: document.getElementById("cash-adjust-note").value
    }
  });
  event.target.reset();
  await loadAll();
});
document.getElementById("quick-sale-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api("/api/quick-sales", {
    method: "POST",
    body: {
      productCode: document.getElementById("quick-product").value,
      description: document.getElementById("quick-description").value,
      quantity: document.getElementById("quick-quantity").value,
      unitPrice: document.getElementById("quick-unit").value,
      paymentMethod: document.getElementById("quick-payment").value,
      billingDecision: document.getElementById("quick-billing-decision").value,
      customerId: document.getElementById("quick-customer").value,
      notes: document.getElementById("quick-notes").value,
      operator: state.user?.name || "Operador"
    }
  });
  event.target.reset();
  await loadAll();
});
document.getElementById("cash-expense-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api("/api/operational-expenses", {
    method: "POST",
    body: {
      date: document.getElementById("cash-expense-date").value,
      time: document.getElementById("cash-expense-time").value,
      responsible: document.getElementById("cash-expense-responsible").value,
      sector: "Caixa",
      category: document.getElementById("cash-expense-category").value,
      value: Number(document.getElementById("cash-expense-value").value || 0),
      paymentMethod: "Dinheiro",
      observation: document.getElementById("cash-expense-note").value,
      uploadType: "Comprovante"
    }
  });
  event.target.reset();
  await loadAll();
});
document.getElementById("blind-close-form").addEventListener("submit", async event => {
  event.preventDefault();
  const result = await api("/api/cash/close-blind", {
    method: "POST",
    body: {
      informed: {
        Dinheiro: Number(document.getElementById("blind-money").value || 0),
        Pix: Number(document.getElementById("blind-pix").value || 0),
        "Cartao credito": Number(document.getElementById("blind-credit").value || 0),
        "Cartao debito": Number(document.getElementById("blind-debit").value || 0)
      }
    }
  });
  document.getElementById("blind-result").innerHTML = detailPanel([
    ["Fechamento", result.status || "Registrado"],
    ["Total informado", money.format(result.informedTotal || numericTotal(result.informed))],
    ["Diferença", money.format(result.difference || 0)],
    ["Resultado", Number(result.difference || 0) === 0 ? "Sem divergência" : "Conferência necessária"]
  ], result, "Ver conferência completa");
});
document.getElementById("customer-form").addEventListener("submit", async event => {
  event.preventDefault();
  const editingId = event.target.dataset.editingId;
  await api(editingId ? `/api/customers/${editingId}` : "/api/customers", {
    method: editingId ? "PUT" : "POST",
    body: {
      name: document.getElementById("customer-name").value,
      phone: document.getElementById("customer-phone").value,
      email: document.getElementById("customer-email").value,
      mobile: document.getElementById("customer-mobile")?.value || "",
      document: document.getElementById("customer-document")?.value || "",
      whatsapp: document.getElementById("customer-whatsapp")?.value || document.getElementById("customer-mobile")?.value || document.getElementById("customer-phone").value,
      companyName: document.getElementById("customer-company")?.value || "",
      classification: document.getElementById("customer-classification")?.value || "Essencial",
      origin: document.getElementById("customer-origin")?.value || "Balcao",
      address: document.getElementById("customer-address")?.value || "",
      contact: document.getElementById("customer-contact")?.value || "",
      contactPerson: document.getElementById("customer-contact-person")?.value || document.getElementById("customer-contact")?.value || "",
      communicationPreference: document.getElementById("customer-communication-preference")?.value || "both",
      creditLimit: Number(document.getElementById("customer-credit")?.value || 0),
      notes: document.getElementById("customer-notes")?.value || "",
      type: "Empresa",
      active: true
    }
  });
  delete event.target.dataset.editingId;
  event.target.reset();
  await loadAll();
  showToast(editingId ? "Cliente atualizado." : "Cliente cadastrado.", "success");
});
document.getElementById("product-form").addEventListener("submit", async event => {
  event.preventDefault();
  const split = value => String(value || "").split(",").map(item => item.trim()).filter(Boolean);
  const editingId = event.target.dataset.editingId;
  try {
    await api(editingId ? `/api/products/${editingId}` : "/api/products", {
      method: editingId ? "PUT" : "POST",
      body: {
      code: document.getElementById("product-code").value,
      name: document.getElementById("product-name").value,
      description: document.getElementById("product-description").value,
      category: document.getElementById("product-category").value,
      imageUrl: document.getElementById("product-image-url")?.value || "",
      attachments: split(document.getElementById("product-attachments")?.value),
      examples: split(document.getElementById("product-attachments")?.value),
      unit: document.getElementById("product-unit").value,
      pricingMode: document.getElementById("product-pricing-mode").value,
      defaultProductionDays: Number(document.getElementById("product-default-days").value || 0),
      baseValue: document.getElementById("product-base").value,
      salePrice: Number(document.getElementById("product-base").value),
      baseCostM2: Number(document.getElementById("product-cost")?.value || 0),
      minPrice: document.getElementById("product-base").value,
      minMarginPercent: Number(document.getElementById("product-min-margin")?.value || 0),
      marginPercent: Number(document.getElementById("product-margin")?.value || 0),
      maxDiscountPercent: Number(document.getElementById("product-max-discount")?.value || 0),
      commissionPercent: Number(document.getElementById("product-commission")?.value || 0),
      taxPercent: Number(document.getElementById("product-tax")?.value || 0),
      productionCost: Number(document.getElementById("product-production-cost")?.value || 0),
      installationCost: Number(document.getElementById("product-installation-cost")?.value || 0),
      suggestedPrice: Number(document.getElementById("product-suggested-price")?.value || document.getElementById("product-base").value || 0),
      manualFinalPrice: Number(document.getElementById("product-manual-final-price")?.value || document.getElementById("product-base").value || 0),
      priceNote: document.getElementById("product-price-note")?.value || "",
      materialsUsed: split(document.getElementById("product-materials")?.value),
      finishes: split(document.getElementById("product-finishes")?.value),
      averageProductionMinutes: Number(document.getElementById("product-production-minutes")?.value || 0),
      sectors: split(document.getElementById("product-sectors")?.value),
      flow: state.productConfigDraft.productionRoute.map(step => step.sectorName),
      technicalQuestions: state.productConfigDraft.technicalQuestions,
      productionRoute: state.productConfigDraft.productionRoute,
      requiresInstallation: Boolean(document.getElementById("product-requires-installation")?.checked),
      requiresArt: Boolean(document.getElementById("product-requires-art")?.checked),
      requiresApproval: Boolean(document.getElementById("product-requires-approval")?.checked),
      generatesProduction: Boolean(document.getElementById("product-generates-production")?.checked),
      movesStock: Boolean(document.getElementById("product-moves-stock")?.checked),
      generatesFinancial: Boolean(document.getElementById("product-generates-financial")?.checked),
      active: document.getElementById("product-active").value === "true"
      }
    });
    delete event.target.dataset.editingId;
    event.target.reset();
    state.productConfigDraft = { technicalQuestions: [], productionRoute: [] };
    await loadAll();
    showToast(editingId ? "Produto e valores atualizados com auditoria." : "Produto cadastrado.", "success");
  } catch (error) {
    showToast(error.message || "Nao foi possivel salvar o produto.", "error");
  }
});
document.getElementById("technical-form").addEventListener("submit", async event => {
  event.preventDefault();
  const split = value => value.split(",").map(item => item.trim()).filter(Boolean);
  await api(`/api/products/${document.getElementById("technical-product").value}/technical-sheet`, {
    method: "POST",
    body: {
      standardMaterials: split(document.getElementById("tech-materials").value),
      equipment: split(document.getElementById("tech-equipment").value),
      averageProductionMinutes: Number(document.getElementById("tech-minutes").value || 0),
      requiredSectors: split(document.getElementById("tech-sectors").value),
      finishes: split(document.getElementById("tech-finishes").value),
      defaultWastePercent: Number(document.getElementById("tech-waste").value || 0),
      productionNotes: document.getElementById("tech-notes").value
    }
  });
  await loadAll();
});
document.getElementById("question-form").addEventListener("submit", async event => {
  event.preventDefault();
  const impactType = document.getElementById("impact-type").value;
  const impactValue = Number(document.getElementById("impact-value").value || 0);
  const impact = {};
  if (impactValue) impact[impactType] = impactValue;
  if (document.getElementById("impact-material").value) impact.material = document.getElementById("impact-material").value;
  if (document.getElementById("impact-sector").value) impact.sector = document.getElementById("impact-sector").value;
  const options = document.getElementById("question-options").value.split(",").map(item => item.trim()).filter(Boolean).map(item => {
    const [label, value] = item.split(":");
    return { label, value: label.toLowerCase().replaceAll(" ", "_"), priceImpact: value ? { [impactType]: Number(value) } : {} };
  });
  await api(`/api/products/${document.getElementById("admin-product").value}/questions`, {
    method: "POST",
    body: {
      key: document.getElementById("question-key").value,
      label: document.getElementById("question-label").value,
      type: document.getElementById("question-type").value,
      options,
      priceImpact: impact
    }
  });
  event.target.reset();
  await loadAll();
});
document.getElementById("install-team-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api(`/api/orders/${document.getElementById("team-order").value}/installation-teams`, {
    method: "POST",
    body: {
      name: document.getElementById("team-name").value,
      responsible: document.getElementById("team-responsible").value,
      members: document.getElementById("team-members").value,
      vehicle: document.getElementById("team-vehicle").value,
      departureDate: document.getElementById("team-date").value,
      departureTime: document.getElementById("team-out").value,
      returnTime: document.getElementById("team-back").value,
      status: document.getElementById("team-status").value,
      notes: document.getElementById("team-notes").value,
      photos: document.getElementById("team-photos").value.split(",").map(item => item.trim()).filter(Boolean),
      confirmation: document.getElementById("team-confirmation").value
    }
  });
  await loadAll();
});
document.getElementById("move-sector-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api(`/api/orders/${document.getElementById("move-order").value}/move-sector`, {
    method: "POST",
    body: {
      nextSector: document.getElementById("move-next-sector").value,
      user: document.getElementById("move-user").value,
      observation: document.getElementById("move-observation").value
    }
  });
  await loadAll();
});
document.getElementById("real-cost-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api(`/api/orders/${document.getElementById("real-order").value}/real-costs`, {
    method: "POST",
    body: {
      sector: document.getElementById("real-sector").value,
      employee: document.getElementById("real-employee").value,
      role: document.getElementById("real-role").value,
      laborMinutes: Number(document.getElementById("real-labor-min").value || 0),
      laborHourValue: Number(document.getElementById("real-labor-hour").value || 0),
      machine: document.getElementById("real-machine").value,
      machineMinutes: Number(document.getElementById("real-machine-min").value || 0),
      machineHourValue: Number(document.getElementById("real-machine-hour").value || 0),
      materialId: document.getElementById("real-material").value,
      materialQuantity: Number(document.getElementById("real-material-qty").value || 0)
    }
  });
  await loadAll();
});
document.getElementById("problem-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api(`/api/orders/${document.getElementById("problem-order").value}/production-problems`, {
    method: "POST",
    body: {
      type: document.getElementById("problem-type").value,
      description: document.getElementById("problem-description").value,
      responsible: document.getElementById("problem-responsible").value,
      sector: document.getElementById("problem-sector").value,
      estimatedCost: Number(document.getElementById("problem-cost").value || 0),
      deadlineImpactHours: Number(document.getElementById("problem-deadline").value || 0),
      rework: document.getElementById("problem-rework").checked,
      photos: document.getElementById("problem-photos").value.split(",").map(item => item.trim()).filter(Boolean)
    }
  });
  await loadAll();
});
document.getElementById("install-checklist-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api(`/api/orders/${document.getElementById("check-order").value}/installation-checklist`, {
    method: "POST",
    body: {
      responsible: document.getElementById("check-responsible").value,
      vehicle: document.getElementById("check-vehicle").value,
      items: document.getElementById("check-items").value.split(",").map(item => item.trim()).filter(Boolean),
      photosBefore: document.getElementById("check-before").value.split(",").map(item => item.trim()).filter(Boolean),
      photosAfter: document.getElementById("check-after").value.split(",").map(item => item.trim()).filter(Boolean),
      customerSignature: document.getElementById("check-signature").value,
      finishInstallation: document.getElementById("check-finish").checked
    }
  });
  await loadAll();
});
document.getElementById("production-event-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api(`/api/orders/${document.getElementById("event-order").value}/production-events`, {
    method: "POST",
    body: {
      action: document.getElementById("event-action").value,
      sector: document.getElementById("event-sector").value,
      receivedBy: document.getElementById("event-received").value,
      acknowledgedBy: document.getElementById("event-ack").value,
      startedBy: document.getElementById("event-started").value,
      pausedBy: document.getElementById("event-paused").value,
      pauseReason: document.getElementById("event-pause-reason").value,
      finishedBy: document.getElementById("event-finished").value,
      nextSector: document.getElementById("event-next").value,
      timeSpentMinutes: Number(document.getElementById("event-time-spent").value || 0),
      problem: document.getElementById("event-problem").value,
      files: document.getElementById("event-files").value.split(",").map(item => item.trim()).filter(Boolean)
    }
  });
  await loadAll();
});
document.getElementById("approval-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api(`/api/orders/${document.getElementById("approval-order").value}/approval`, {
    method: "POST",
    body: {
      status: document.getElementById("approval-status").value,
      file: document.getElementById("approval-file").value
    }
  });
  await loadAll();
});
document.getElementById("stock-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api(`/api/orders/${document.getElementById("stock-order").value}/stock-consume`, {
    method: "POST",
    body: {
      materialId: document.getElementById("stock-material").value,
      quantity: document.getElementById("stock-qty").value
    }
  });
  await loadAll();
});
document.getElementById("pay-order").addEventListener("change", renderPaymentOrderInfo);
document.getElementById("order-payment-form").addEventListener("submit", async event => {
  event.preventDefault();
  const payments = [
    ["Pix", "pay-pix"],
    ["Cartao credito", "pay-credit"],
    ["Cartao debito", "pay-debit"],
    ["Dinheiro", "pay-cash"],
    ["Transferencia", "pay-transfer"],
    ["Boleto", "pay-boleto"],
    ["Outros", "pay-other"]
  ].map(([method, id]) => ({ method, amount: Number(document.getElementById(id).value || 0) })).filter(payment => payment.amount > 0);
  const order = state.orders.find(item => item.id === document.getElementById("pay-order").value);
  if (!order || !orderIsBillable(order)) return showToast("Selecione uma O.S. faturavel para receber.", "warning");
  if (!payments.length) return showToast("Informe ao menos uma forma de pagamento.", "warning");
  await api("/api/cash/order-payment", {
    method: "POST",
    body: {
      orderId: document.getElementById("pay-order").value,
      seller: document.getElementById("pay-seller").value,
      paymentStatus: document.getElementById("pay-status").value,
      notes: document.getElementById("pay-notes").value,
      payments
    }
  });
  event.target.reset();
  await loadAll();
});
document.getElementById("permissions-form").addEventListener("submit", async event => {
  event.preventDefault();
  const permissions = {};
  document.querySelectorAll("[data-permission]").forEach(input => {
    permissions[input.dataset.permission] = input.checked;
  });
  await api("/api/permissions", { method: "POST", body: { permissions } });
  await loadAll();
});
document.getElementById("cost-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api("/api/cost-config", {
    method: "POST",
    body: {
      mode: document.getElementById("cost-mode").value,
      humanHourValue: Number(document.getElementById("cost-human-hour").value || 0),
      machineHourValue: Number(document.getElementById("cost-machine-hour").value || 0),
      monthlyFixedCost: Number(document.getElementById("cost-fixed").value || 0),
      displacementCostPerKm: Number(document.getElementById("cost-km").value || 0),
      defaultMarginPercent: Number(document.getElementById("cost-margin").value || 0),
      taxPercent: Number(document.getElementById("cost-tax").value || 0),
      commissionPercent: Number(document.getElementById("cost-commission").value || 0),
      wastePercent: Number(document.getElementById("cost-waste").value || 0),
      productionReleaseRule: document.getElementById("cost-production-rule").value
    }
  });
  await loadAll();
});
document.getElementById("employee-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api("/api/employees", {
    method: "POST",
    body: {
      name: document.getElementById("employee-name").value,
      role: document.getElementById("employee-role").value,
      sector: document.getElementById("employee-sector").value,
      salary: Number(document.getElementById("employee-salary").value || 0),
      monthlyHours: Number(document.getElementById("employee-hours").value || 176),
      commissionPercent: Number(document.getElementById("employee-commission").value || 0),
      photo: document.getElementById("employee-photo")?.value || "",
      phone: document.getElementById("employee-phone")?.value || "",
      whatsapp: document.getElementById("employee-whatsapp")?.value || document.getElementById("employee-phone")?.value || "",
      personalPhone: document.getElementById("employee-personal-phone")?.value || document.getElementById("employee-phone")?.value || "",
      companyPhone: document.getElementById("employee-company-phone")?.value || "",
      email: document.getElementById("employee-email")?.value || "",
      companyEmail: document.getElementById("employee-company-email")?.value || document.getElementById("employee-email")?.value || "",
      defaultContactPreference: document.getElementById("employee-contact-preference")?.value || "personal_whatsapp",
      admissionDate: document.getElementById("employee-admission")?.value || "",
      active: document.getElementById("employee-status")?.value !== "false"
    }
  });
  event.target.reset();
  await loadAll();
});
document.getElementById("expense-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api("/api/expenses", {
    method: "POST",
    body: {
      type: document.getElementById("expense-type").value,
      description: document.getElementById("expense-description").value,
      amount: Number(document.getElementById("expense-amount").value || 0)
    }
  });
  event.target.reset();
  await loadAll();
});
document.getElementById("composition-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api("/api/compositions", {
    method: "POST",
    body: {
      name: document.getElementById("composition-name").value,
      category: document.getElementById("composition-category").value,
      productId: document.getElementById("composition-product").value,
      marginPercent: Number(document.getElementById("composition-margin").value || 0),
      deadlineDays: Number(document.getElementById("composition-deadline").value || 0),
      productionFlow: document.getElementById("composition-flow").value.split(",").map(item => item.trim()).filter(Boolean),
      materials: [],
      production: [],
      installation: { teamHours: 0, vehicleKm: 0, fuel: 0, food: 0, toll: 0 },
      questions: []
    }
  });
  event.target.reset();
  await loadAll();
});
document.getElementById("cost-center-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api("/api/cost-centers", {
    method: "POST",
    body: {
      name: document.getElementById("cost-center-name").value,
      type: document.getElementById("cost-center-type").value,
      monthlyBudget: Number(document.getElementById("cost-center-budget").value || 0)
    }
  });
  event.target.reset();
  await loadAll();
});
document.getElementById("operational-expense-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api("/api/operational-expenses", {
    method: "POST",
    body: {
      date: document.getElementById("opex-date").value,
      time: document.getElementById("opex-time").value,
      responsible: document.getElementById("opex-responsible").value,
      sector: document.getElementById("opex-sector").value,
      category: document.getElementById("opex-category").value,
      subcategory: document.getElementById("opex-subcategory").value,
      orderId: document.getElementById("opex-order").value,
      value: Number(document.getElementById("opex-value").value || 0),
      paymentMethod: document.getElementById("opex-payment").value,
      observation: document.getElementById("opex-observation").value,
      receipt: document.getElementById("opex-receipt").value,
      uploadType: document.getElementById("opex-upload-type").value,
      vehicleId: document.getElementById("opex-vehicle").value
    }
  });
  event.target.reset();
  await loadAll();
});
document.getElementById("advance-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api("/api/expense-advances", {
    method: "POST",
    body: {
      team: document.getElementById("advance-team").value,
      responsible: document.getElementById("advance-responsible").value,
      purpose: document.getElementById("advance-purpose").value,
      receivedValue: Number(document.getElementById("advance-value").value || 0)
    }
  });
  await loadAll();
});
document.getElementById("accountability-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api(`/api/expense-advances/${document.getElementById("accountability-advance").value}/accountability`, {
    method: "POST",
    body: {
      spentValue: Number(document.getElementById("accountability-spent").value || 0),
      returnedValue: Number(document.getElementById("accountability-returned").value || 0),
      receipts: document.getElementById("accountability-receipts").value.split(",").map(item => item.trim()).filter(Boolean)
    }
  });
  await loadAll();
});
document.getElementById("vehicle-form").addEventListener("submit", async event => {
  event.preventDefault();
  await api("/api/vehicles", {
    method: "POST",
    body: {
      vehicle: document.getElementById("vehicle-name").value,
      plate: document.getElementById("vehicle-plate").value,
      driver: document.getElementById("vehicle-driver").value,
      initialKm: Number(document.getElementById("vehicle-initial").value || 0),
      finalKm: Number(document.getElementById("vehicle-final").value || 0),
      fuelCost: Number(document.getElementById("vehicle-fuel").value || 0),
      maintenanceCost: Number(document.getElementById("vehicle-maintenance").value || 0)
    }
  });
  event.target.reset();
  await loadAll();
});
document.getElementById("load-label").addEventListener("click", () => {
  openOrderPrint(document.getElementById("label-order").value, false);
});

function buildOperationalNavigation() {
  const nav = document.querySelector("nav");
  if (!nav) return;
  nav.dataset.erpNavReady = "true";
  nav.className = "erp-nav erp-nav-hierarchical";
  nav.innerHTML = [
    navDirect("dashboard", "Dashboard", "IN"),
    navSection("Atendimento", "AT", [
      ["commercial", "CRM e follow-up", "commercial"],
      ["customers", "Clientes", "administration"],
      ["visits-agenda", "Visitas tecnicas", "technicalVisits"]
    ]),
    navSection("Orcamentos", "OR", [
      ["quote", "Novo orcamento", "quote"],
      ["pricing-simulator", "Simular preco", "quote"],
      ["reports-orders", "Orcado x aprovado", "bi"]
    ]),
    navSection("Ordens de Servico", "OS", [
      ["orders-new", "Nova O.S.", "orders"],
      ["orders-search", "Consultar O.S.", "orders"],
      ["orders-followup", "Acompanhamento", "orders"],
      ["orders-late", "Atrasadas", "orders"],
      ["orders-no-file", "Sem arquivo", "orders"],
      ["orders-no-payment", "Sem pagamento", "orders"],
      ["orders-rework", "Retrabalhos", "orders"],
      ["orders-courtesy", "Cortesias", "orders"],
      ["orders-cancelled", "Canceladas", "orders"],
      ["orders-print", "Impressao", "orders"],
      ["orders-costs", "Custos e estoque", "orders"]
    ]),
    navSection("Producao / PCP", "PC", [
      ["production-pcp", "PCP / Producao", "production"],
      ["production-move", "Movimentacao", "production"],
      ["production-installation", "Equipe de instalacao", "production"],
      ["production-checklist", "Checklist instalacao", "production"]
    ]),
    navSection("Produtos", "PR", [
      ["stock-product-new", "Novo produto", "supplies"],
      ["stock-products", "Produtos e modelos", "supplies"],
      ["settings-compositions", "Composicoes", "settings"],
      ["admin", "Questionarios", "settings"]
    ]),
    navSection("Estoque", "ES", [
      ["stock-materials", "Materiais", "supplies"],
      ["stock-movements", "Movimentacoes", "supplies"],
      ["orders-costs", "Consumo por O.S.", "orders"]
    ]),
    navSection("Financeiro", "FI", [
      ["finance-receivables", "Contas a receber", "financialSummary"],
      ["finance-payables", "Contas a pagar", "financialSummary"],
      ["finance-cashflow", "Fluxo de caixa", "financialSummary"],
      ["finance-dre", "DRE", "financialSummary"],
      ["finance-expenses", "Despesas operacionais", "financialSummary"]
    ]),
    navSection("Caixa / PDV", "CX", [
      ["cash-receive", "Receber O.S.", "cash"],
      ["cash-quick-sale", "Venda rapida", "cash"],
      ["cash-expense", "Despesa", "cash"],
      ["cash-withdrawal", "Sangria", "cash"],
      ["cash-closing", "Fechamento", "blindClose"]
    ]),
    navSection("Relatorios", "RE", [
      ["reports-production", "Producao", "bi"],
      ["reports-finance", "Financeiro", "bi"],
      ["reports-orders", "Ordens de Servico", "bi"],
      ["reports-stock", "Estoque", "bi"]
    ]),
    navSection("Gestao", "GE", [
      ["intelligence", "Central de gestao", "bi"],
      ["notifications-center", "Notificacoes", "integrations"],
      ["visits-reports", "Relatorios de visitas", "technicalVisits"],
      ["settings-employees", "Funcionarios", "settings"],
      ["settings-sectors", "Setores", "settings"]
    ]),
    navSection("Configuracoes", "CF", [
      ["settings-users", "Usuarios", "settings"],
      ["settings-permissions", "Permissoes", "settings"],
      ["settings-stores", "Lojas", "settings"],
      ["settings-printing", "Impressao", "settings"],
      ["settings-communication", "Comunicacao", "settings"],
      ["settings-cost-centers", "Centro de custos", "settings"]
    ])
  ].join("");
  nav.querySelectorAll(".nav-parent").forEach(button => {
    button.addEventListener("click", () => {
      const section = button.closest(".nav-section");
      const shouldOpen = !section?.classList.contains("open");
      nav.querySelectorAll(".nav-section").forEach(item => item.classList.remove("open"));
      if (shouldOpen) section?.classList.add("open");
    });
  });
  nav.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => {
      view(button.dataset.view, button);
      if (window.innerWidth <= 980) document.querySelector(".app")?.classList.add("sidebar-collapsed");
    });
  });
  const currentView = document.querySelector(".view.active")?.id || "dashboard";
  const currentButton = nav.querySelector(`[data-view="${currentView}"]`);
  currentButton?.classList.add("active");
  currentButton?.closest(".nav-section")?.classList.add("open");
}

function focusedViewMarkup(id, eyebrow, title, description, content = "") {
  return `
    <section id="${id}" class="view focused-operational-view">
      <div class="focused-page-head">
        <div><span>${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>
      </div>
      <div id="${id}-content" class="focused-page-content">${content}</div>
    </section>
  `;
}

function moveOperationalPanel(formOrElementId, targetId, extraClass = "") {
  const element = document.getElementById(formOrElementId);
  const target = document.getElementById(targetId);
  const panel = element?.closest(".panel");
  if (!panel || !target) return;
  panel.classList.remove("ux-hidden", "ux-advanced-panel");
  panel.classList.add("focused-function-card");
  if (extraClass) panel.classList.add(extraClass);
  target.appendChild(panel);
}

function prepareRootOperationalSubpages() {
  const main = document.querySelector("main");
  if (!main || main.dataset.rootOperationalSplit === "true") return;
  main.dataset.rootOperationalSplit = "true";
  main.insertAdjacentHTML("beforeend", [
    focusedViewMarkup("visits-new", "Visitas Tecnicas", "Nova visita", "Cadastre a solicitacao, atribua o responsavel e vincule o atendimento ao cliente.", `
      <section class="panel focused-function-card">
        <form id="technical-visit-form" class="visit-form">
          <input id="technical-visit-id" type="hidden">
          <div class="root-form-grid" style="--root-columns:4">
            <label>Cliente<select id="visit-customer" required></select></label>
            <label>Telefone<input id="visit-phone"></label>
            <label>Tipo de visita<select id="visit-type"><option value="measurement">Medicao</option><option value="installation_check">Conferencia de instalacao</option><option value="doubt">Duvida tecnica</option><option value="survey">Levantamento</option></select></label>
            <label>Data solicitada<input id="visit-requested-date" type="date" required></label>
            <label class="root-wide-field">Endereco<input id="visit-address" required></label>
            <label>Cidade<input id="visit-city"></label>
            <label>Bairro<input id="visit-neighborhood"></label>
            <label>Ponto de referencia<input id="visit-reference"></label>
            <label>Data agendada<input id="visit-scheduled-date" type="datetime-local"></label>
            <label>Responsavel<select id="visit-employee"></select></label>
            <label>Orcamento relacionado<select id="visit-quote"></select></label>
            <label>O.S. relacionada<select id="visit-order"></select></label>
            <label class="root-wide-field">Observacoes<textarea id="visit-notes"></textarea></label>
            <label class="root-wide-field">Anotacoes de medicao<textarea id="visit-measurement-notes"></textarea></label>
            <label class="root-wide-field">Fotos / arquivos <input id="visit-photos" placeholder="Separe os nomes por virgula"></label>
          </div>
          ${renderCompactActionBar([{ label: "Limpar", data: 'data-visit-action="clear"' }, { label: "Salvar visita", type: "submit", primary: true }], "A visita fica isolada na loja selecionada.")}
        </form>
      </section>
    `),
    focusedViewMarkup("visits-agenda", "Visitas Tecnicas", "Agenda", "Filtre visitas por data, responsavel e situacao.", `
      <section class="panel focused-function-card"><form id="visit-filter-form" class="visit-filter-bar"><label>Data<input id="visit-filter-date" type="date"></label><label>Responsavel<select id="visit-filter-employee"></select></label><label>Status<select id="visit-filter-status"><option value="">Todos</option><option value="requested">Solicitada</option><option value="scheduled">Agendada</option><option value="in_progress">Em atendimento</option><option value="completed">Concluida</option><option value="canceled">Cancelada</option></select></label><button type="submit" class="primary">Aplicar filtros</button><button type="button" data-visit-action="clear-filters">Limpar</button></form><div id="visits-agenda-table"></div></section>
    `),
    focusedViewMarkup("visits-open", "Visitas Tecnicas", "Em aberto", "Acompanhe solicitacoes, agendamentos e visitas em atendimento.", `<section class="panel focused-function-card"><div id="visits-open-summary" class="focused-summary-grid"></div><div id="visits-open-table"></div></section>`),
    focusedViewMarkup("visits-completed", "Visitas Tecnicas", "Concluidas", "Consulte medicoes, fotos e vinculos gerados nas visitas concluidas.", `<section class="panel focused-function-card"><div id="visits-completed-table"></div></section>`),
    focusedViewMarkup("visits-reports", "Visitas Tecnicas", "Relatorios", "Analise volume, responsaveis, pendencias e conversoes.", `
      <section class="panel focused-function-card">
        <div class="visit-report-filters root-form-grid" style="--root-columns:5">
          <label>Data inicial<input id="visit-report-from" type="date"></label>
          <label>Data final<input id="visit-report-to" type="date"></label>
          <label>Status<select id="visit-report-status"><option value="">Todos</option><option value="requested">Solicitada</option><option value="scheduled">Agendada</option><option value="in_progress">Em atendimento</option><option value="completed">Concluida</option><option value="canceled">Cancelada</option></select></label>
          <label>Cliente<input id="visit-report-customer" placeholder="Todos"></label>
          <label>Responsavel<select id="visit-report-employee"><option value="">Todos</option></select></label>
        </div>
        <div class="action-bar"><button type="button" class="primary" data-visit-action="generate-report">Atualizar relatorio</button><button type="button" data-visit-action="print-report">Imprimir</button><button type="button" data-visit-action="export-report">Exportar CSV</button></div>
      </section>
      <div id="visits-report-summary" class="focused-summary-grid"></div>
      <section class="panel focused-function-card"><div id="visits-report-table"></div></section>
    `),
    focusedViewMarkup("production-pcp", "Producao", "PCP / Producao", "Acompanhe a fila operacional, os prazos e a proxima acao de cada O.S.", `<div id="production-pcp-tools" class="focused-page-content"></div><section id="production-order-detail-panel" class="panel focused-function-card production-order-detail-panel"></section>`),
    focusedViewMarkup("production-move", "Producao", "Movimentacao", "Consulte o historico real da producao e registre avancos, pausas, conclusoes ou envio de setor.", `
      <div id="production-movement-summary" class="focused-summary-grid"></div>
      <section class="panel focused-function-card">
        <div class="root-block-heading"><h2>Historico de movimentos</h2><small>Eventos registrados por O.S., setor, responsavel e data.</small></div>
        <div class="root-form-grid production-movement-filters" style="--root-columns:4">
          <label>Buscar<input id="production-movement-search" placeholder="O.S., cliente, setor ou responsavel"></label>
          <label>Setor<input id="production-movement-sector" placeholder="Todos"></label>
          <label>De<input id="production-movement-from" type="date"></label>
          <label>Ate<input id="production-movement-to" type="date"></label>
        </div>
        <div class="focused-actions"><button type="button" class="primary" data-action="refresh-production-movements">Atualizar movimentos</button></div>
        <div id="production-movement-table"></div>
      </section>
      <div id="production-move-tools" class="focused-two-column"></div>
    `),
    focusedViewMarkup("production-installation", "Producao", "Equipe de instalacao", "Monte e vincule uma equipe de instalacao a uma O.S.", `<div id="production-installation-tools" class="focused-form-width"></div>`),
    focusedViewMarkup("production-checklist", "Producao", "Checklist de instalacao", "Confira itens obrigatorios, fotos, anexos e assinatura antes da conclusao.", `<div id="production-checklist-tools" class="focused-form-width"></div><section class="panel focused-function-card"><h2>Arquivos e anexos das O.S.</h2><div id="production-checklist-files-table"></div></section>`),
    focusedViewMarkup("finance-receivables", "Financeiro", "Contas a receber", "Consulte valores a receber, vencimentos e saldos de clientes.", `<div id="finance-receivables-tools"></div>`),
    focusedViewMarkup("finance-payables", "Financeiro", "Contas a pagar", "Consulte fornecedores, categorias, vencimentos e saldos.", `<div id="finance-payables-tools"></div>`),
    focusedViewMarkup("finance-cashflow", "Financeiro", "Fluxo de caixa", "Acompanhe entradas, saidas, saldo e inadimplencia.", `<div id="finance-cashflow-tools" class="focused-two-column"></div>`),
    focusedViewMarkup("finance-dre", "Financeiro", "DRE", "Analise receitas, custos, despesas e resultado gerencial.", `<div id="finance-dre-tools"></div>`),
    focusedViewMarkup("finance-expenses", "Financeiro", "Despesas operacionais", "Registre e acompanhe despesas por responsavel, setor e O.S.", `<div id="finance-expenses-tools" class="focused-two-column"></div>`),
    focusedViewMarkup("stock-product-new", "Estoque", "Novo produto", "Cadastre um produto ou servico com seus dados comerciais e tecnicos.", `<div id="stock-product-new-tools" class="focused-form-width"></div>`),
    focusedViewMarkup("stock-products", "Estoque", "Produtos", "Consulte e gerencie produtos e servicos disponiveis.", `<div id="stock-products-tools"></div>`),
    focusedViewMarkup("stock-materials", "Estoque", "Materiais", "Consulte estoque atual, minimo e custo dos materiais.", `<div id="stock-materials-tools"></div>`),
    focusedViewMarkup("stock-movements", "Estoque", "Movimentacoes", "Registre consumo por O.S. e acompanhe a posicao dos materiais.", `<div id="stock-movements-tools" class="focused-two-column"></div>`),
    focusedViewMarkup("reports-production", "Relatorios", "Relatorio de producao", "Resumo operacional de status, setores e prazos.", `<section class="panel focused-function-card"><div id="reports-production-table"></div></section>`),
    focusedViewMarkup("reports-finance", "Relatorios", "Relatorio financeiro", "Resumo de recebiveis, caixa e resultado.", `<section class="panel focused-function-card"><div id="reports-finance-summary" class="focused-summary-grid"></div></section>`),
    focusedViewMarkup("reports-orders", "Relatorios", "Relatorio de O.S.", "Consulte volume, status e pendencias das ordens de servico.", `<section class="panel focused-function-card"><div id="reports-orders-table"></div></section>`),
    focusedViewMarkup("reports-stock", "Relatorios", "Relatorio de estoque", "Consulte materiais disponiveis e itens abaixo do minimo.", `<section class="panel focused-function-card"><div id="reports-stock-table"></div></section>`),
    focusedViewMarkup("notifications-center", "Gestao", "Central de notificacoes", "Acompanhe mensagens preparadas para clientes, abra WhatsApp e registre envio manual.", `
      <div id="notifications-summary" class="focused-summary-grid"></div>
      <section class="panel focused-function-card">
        <div class="root-block-heading"><h2>Fila de comunicacao</h2><small>Sem API externa configurada, o envio ocorre por link manual e confirmacao.</small></div>
        <div id="notifications-queue-table"></div>
      </section>
      <section class="panel focused-function-card">
        <div class="root-block-heading"><h2>Templates ativos</h2><small>Mensagens usadas por orcamento, O.S., producao e pagamento.</small></div>
        <div id="notifications-template-table"></div>
      </section>
    `),
    focusedViewMarkup("settings-users", "Configuracoes", "Usuarios", "Consulte usuarios cadastrados e seus perfis de acesso.", `<div id="settings-users-tools"></div>`),
    focusedViewMarkup("settings-employees", "Configuracoes", "Funcionarios", "Cadastre funcionarios e consulte setor, funcao, carga horaria e valor hora.", `<div id="settings-employees-tools"></div>`),
    focusedViewMarkup("settings-sectors", "Configuracoes", "Setores", "Cadastre setores, responsaveis, capacidade e permissoes padrao.", `<div id="settings-sectors-tools"></div>`),
    focusedViewMarkup("settings-permissions", "Configuracoes", "Permissoes", "Defina liberacoes de acesso por perfil e funcao.", `<div id="settings-permissions-tools" class="focused-form-width"></div>`),
    focusedViewMarkup("settings-stores", "Configuracoes", "Lojas", "Cadastre unidades e controle o contexto multiempresa.", `<div id="settings-stores-tools"></div>`),
    focusedViewMarkup("settings-printing", "Configuracoes", "Impressao", "Configure logo, cores, rodape e campos exibidos em O.S., orcamentos e relatorios.", `
      <section class="panel focused-function-card">
        <form id="print-settings-form">
          <div class="root-form-grid" style="--root-columns:3">
            <label>Logo da empresa<input id="print-logo-url" placeholder="URL ou caminho da imagem"></label>
            <label>Imagem de cabecalho<input id="print-header-image-url" placeholder="Opcional"></label>
            <label>Texto do rodape<input id="print-footer-text" placeholder="Mensagem no rodape"></label>
            <label>Cor principal<input id="print-primary-color" type="color"></label>
            <label>Cor secundaria<input id="print-secondary-color" type="color"></label>
            <label>Cor do texto<input id="print-text-color" type="color"></label>
            <label>Modelo O.S.<select id="print-order-model"><option value="operacional">Operacional</option><option value="comercial">Comercial</option><option value="compacto">Compacto</option></select></label>
            <label>Modelo orcamento<select id="print-quote-model"><option value="comercial">Comercial</option><option value="operacional">Operacional</option><option value="compacto">Compacto</option></select></label>
            <label>Modelo relatorio<select id="print-report-model"><option value="gerencial">Gerencial</option><option value="operacional">Operacional</option><option value="compacto">Compacto</option></select></label>
          </div>
          <div class="print-settings-toggles">
            ${["Endereco", "CNPJ", "Telefone", "Vendedor", "Contato do funcionario", "CPF/CNPJ do cliente", "Assinatura", "QR Code", "Imagem do produto no orcamento", "Imagem do produto na O.S.", "Previa do projeto"].map((label, index) => `<label><input type="checkbox" id="print-toggle-${index}"> ${label}</label>`).join("")}
          </div>
          ${renderCompactActionBar([{ label: "Salvar configuracao", type: "submit", primary: true }, { label: "Visualizar O.S.", data: 'data-action="preview-print-settings"' }], "As alteracoes valem para a loja atual e entram nos novos previews imediatamente.")}
        </form>
      </section>
      <section class="panel focused-function-card">
        <div class="root-block-heading"><h2>Previa rapida</h2><small>Use uma O.S. existente para validar cores, cabecalho e rodape.</small></div>
        <div id="print-settings-preview" class="print-settings-preview"></div>
      </section>
    `),
    focusedViewMarkup("settings-communication", "Configuracoes", "Comunicacao", "Configure WhatsApp, notificacoes e eventos enviados ao cliente.", `
      <section class="panel focused-function-card">
        <form id="communication-settings-form">
          <div class="root-form-grid" style="--root-columns:3">
            <label>Status<select id="comm-enabled"><option value="true">Ativa</option><option value="false">Desativada</option></select></label>
            <label>Modo WhatsApp<select id="comm-whatsapp-mode"><option value="manual_whatsapp_link">Manual via link WhatsApp</option><option value="api_provider">API externa</option></select></label>
            <label>WhatsApp da empresa<input id="comm-company-whatsapp" placeholder="5585999990000"></label>
            <label>Remetente padrao<input id="comm-default-sender" placeholder="Atendimento"></label>
            <label>Fornecedor API<input id="comm-provider-name" placeholder="Nome do provedor"></label>
            <label>URL base da API<input id="comm-provider-base-url" placeholder="https://api.exemplo.com"></label>
            <label>Token da API<input id="comm-provider-token" placeholder="Nao sera exibido para usuarios comuns"></label>
            <label>Segredo webhook<input id="comm-webhook-secret" placeholder="Opcional"></label>
            <label class="root-wide-field">Rodape das mensagens<input id="comm-footer" placeholder="Mensagem enviada pela equipe"></label>
          </div>
          <div class="print-settings-toggles">
            ${[
              ["comm-event-quote", "Orcamentos"],
              ["comm-event-order", "O.S."],
              ["comm-event-production", "Producao"],
              ["comm-event-payment", "Pagamentos"],
              ["comm-event-tracking", "Acompanhamento"]
            ].map(([id, label]) => `<label><input type="checkbox" id="${id}"> ${label}</label>`).join("")}
          </div>
          ${renderCompactActionBar([{ label: "Salvar comunicacao", type: "submit", primary: true }, { label: "Testar configuracao", data: 'data-action="test-communication-settings"' }], "Sem API configurada, o PrintSys prepara link manual e exige confirmacao do operador.")}
        </form>
      </section>
      <section class="panel focused-function-card">
        <div class="root-block-heading"><h2>Status de envio</h2><small>O sistema nunca marca mensagem como enviada automaticamente sem confirmacao ou API real.</small></div>
        <div id="communication-settings-status" class="price-box"></div>
      </section>
    `),
    focusedViewMarkup("settings-compositions", "Configuracoes", "Composicoes", "Cadastre e consulte composicoes tecnicas de produtos.", `<div id="settings-compositions-tools" class="focused-two-column"></div>`),
    focusedViewMarkup("settings-cost-centers", "Configuracoes", "Centro de custos", "Cadastre e consulte centros de custo usados nos lancamentos.", `<div id="settings-cost-centers-tools" class="focused-two-column"></div>`),
    focusedViewMarkup("orders-new", "Ordens de Servico", "Nova O.S.", "Gere uma ordem a partir de um orcamento aprovado, mantendo custos, arquivos e fluxo produtivo.", `
      <div class="focused-two-column">
        <section class="panel focused-function-card">
          <h2>Gerar O.S. de orcamento aprovado</h2>
          <form id="orders-new-form">
            <label>Orcamento pronto para gerar O.S.<select id="orders-new-quote"></select></label>
            <div id="orders-new-preview" class="focused-summary-grid"></div>
            <div class="focused-actions">
              <button type="button" data-view="quote">Abrir orcamento</button>
              <button class="primary">Salvar e gerar O.S.</button>
            </div>
          </form>
        </section>
        <aside class="panel focused-help-card">
          <h2>Antes de gerar</h2>
          <p>Confirme cliente, trabalho, valor aprovado, arquivos e prazo. A O.S. recebe o snapshot do orcamento sem recalcular custos antigos.</p>
        </aside>
      </div>
    `),
    focusedViewMarkup("orders-search", "Ordens de Servico", "Consultar O.S.", "Pesquise, selecione e consulte os dados essenciais sem abrir gavetas ou telas sobrepostas.", `
      <div id="orders-search-summary" class="focused-summary-grid"></div>
      <div id="orders-search-list"></div>
      <section class="panel focused-function-card" id="orders-search-detail"></section>
    `),
    focusedViewMarkup("orders-followup", "Ordens de Servico", "Acompanhamento", "Acompanhe setor, responsavel, prazo, proxima acao e historico produtivo.", `
      <section class="panel focused-function-card"><div id="orders-followup-table"></div></section>
      <div id="orders-followup-tools" class="focused-two-column"></div>
    `),
    focusedViewMarkup("orders-late", "Ordens de Servico", "O.S. atrasadas", "Priorize somente trabalhos vencidos e veja quantos dias de atraso exigem acao.", `
      <section class="panel focused-function-card"><div id="orders-late-table"></div></section>
    `),
    focusedViewMarkup("orders-no-file", "Ordens de Servico", "O.S. sem arquivo", "Resolva pendencias de arte e producao antes de liberar o trabalho.", `
      <section class="panel focused-function-card"><div id="orders-no-file-table"></div></section>
      <div id="orders-no-file-tools"></div>
    `),
    focusedViewMarkup("orders-no-payment", "Ordens de Servico", "O.S. sem pagamento", "Veja saldos pendentes e encaminhe o recebimento diretamente ao Caixa.", `
      <section class="panel focused-function-card"><div id="orders-no-payment-table"></div></section>
    `),
    focusedViewMarkup("orders-rework", "Ordens de Servico", "Retrabalhos", "Gere uma O.S. interna vinculada a uma ordem existente, sem financeiro e com responsavel obrigatorio.", `
      <div class="focused-two-column">
        <section class="panel focused-function-card">
          <h2>Novo retrabalho</h2>
          <form id="orders-rework-form">
            <div class="root-form-grid" style="--root-columns:3">
              <label>O.S. de origem<select id="rework-source-order" required></select></label>
              <label>Funcionario responsavel<select id="rework-responsible" required></select></label>
              <label>Setor<select id="rework-sector"></select></label>
              <label>Prazo<input id="rework-due-date" type="date"></label>
              <label>Custo deslocamento<input id="rework-displacement-cost" type="number" min="0" step="0.01" value="0"></label>
              <label>Custo diverso<input id="rework-misc-cost" type="number" min="0" step="0.01" value="0"></label>
              <label class="root-wide-field">Motivo<textarea id="rework-reason" required placeholder="Explique o que precisa ser corrigido"></textarea></label>
            </div>
            <div id="rework-source-items" class="rework-items-panel"></div>
            ${renderCompactActionBar([{ label: "Gerar O.S. de retrabalho", type: "submit", primary: true }], "Retrabalho nao gera financeiro; registra custo real e timeline.")}
          </form>
        </section>
        <section class="panel focused-function-card">
          <h2>Retrabalhos em aberto</h2>
          <div id="orders-rework-table"></div>
        </section>
      </div>
    `),
    focusedViewMarkup("orders-courtesy", "Ordens de Servico", "Cortesias", "Crie O.S. de cortesia autorizada, sem cobranca e com rota produtiva clara.", `
      <div class="focused-two-column">
        <section class="panel focused-function-card">
          <h2>Nova cortesia</h2>
          <form id="orders-courtesy-form">
            <div class="root-form-grid" style="--root-columns:3">
              <label>Cliente<select id="courtesy-customer" required></select></label>
              <label>Setor<select id="courtesy-sector"></select></label>
              <label>Prazo<input id="courtesy-due-date" type="date"></label>
              <label>Descricao<input id="courtesy-description" required placeholder="Servico de cortesia"></label>
              <label>Quantidade<input id="courtesy-quantity" type="number" min="1" value="1"></label>
              <label>Autorizado por<input id="courtesy-authorized-by" placeholder="Gestor/Admin"></label>
              <label class="root-wide-field">Motivo<textarea id="courtesy-reason" required placeholder="Motivo comercial ou operacional da cortesia"></textarea></label>
            </div>
            ${renderCompactActionBar([{ label: "Gerar O.S. de cortesia", type: "submit", primary: true }], "Cortesia entra no PCP, mas nao gera caixa nem contas a receber.")}
          </form>
        </section>
        <section class="panel focused-function-card">
          <h2>Cortesias registradas</h2>
          <div id="orders-courtesy-table"></div>
        </section>
      </div>
    `),
    focusedViewMarkup("orders-cancelled", "Ordens de Servico", "Canceladas", "Cancele O.S. com motivo, auditoria e tratamento financeiro quando houver recebimento.", `
      <div class="focused-two-column">
        <section class="panel focused-function-card">
          <h2>Cancelar O.S.</h2>
          <form id="orders-cancel-form">
            <div class="root-form-grid" style="--root-columns:2">
              <label>O.S.<select id="cancel-order-id" required></select></label>
              <label>Decisao financeira<input id="cancel-financial-decision" placeholder="Sem recebimento, credito, estorno ou analise"></label>
              <label class="root-wide-field">Motivo<textarea id="cancel-reason" required></textarea></label>
              <label class="root-wide-field">Observacao financeira<textarea id="cancel-financial-observation"></textarea></label>
            </div>
            ${renderCompactActionBar([{ label: "Cancelar O.S.", type: "submit", primary: true }], "Nada e apagado: a O.S. fica bloqueada e auditada.")}
          </form>
        </section>
        <section class="panel focused-function-card">
          <h2>Historico de cancelamentos</h2>
          <div id="orders-cancelled-table"></div>
        </section>
      </div>
    `),
    focusedViewMarkup("orders-print", "Ordens de Servico", "Central de impressao", "Selecione uma O.S., gere a ficha profissional e imprima ou salve em PDF.", `
      <div id="orders-print-tools"></div>
    `),
    focusedViewMarkup("orders-costs", "Ordens de Servico", "Custos e estoque", "Registre consumo de material e confira o pos-calculo da O.S. selecionada.", `
      <div id="orders-costs-tools" class="focused-two-column"></div>
    `),
    focusedViewMarkup("cash-receive", "Caixa / PDV", "Receber O.S.", "Receba pagamentos, sinais e parcelas vinculados a ordens de servico.", `
      <div id="cash-receive-summary" class="focused-summary-grid"></div>
      <div id="cash-receive-tools" class="focused-two-column"></div>
    `),
    focusedViewMarkup("cash-quick-sale", "Caixa / PDV", "Venda rapida", "Finalize servicos de balcao e vendas diretas sem abrir uma O.S. completa.", `
      <div id="cash-quick-sale-tools" class="focused-two-column"></div>
    `),
    focusedViewMarkup("cash-expense", "Caixa / PDV", "Registrar despesa", "Registre toda saida operacional com responsavel, categoria, valor e motivo.", `
      <div id="cash-expense-tools" class="focused-form-width"></div>
    `),
    focusedViewMarkup("cash-withdrawal", "Caixa / PDV", "Registrar sangria", "Registre retirada de dinheiro do caixa com operador, valor e justificativa.", `
      <div id="cash-withdrawal-tools" class="focused-form-width"></div>
    `),
    focusedViewMarkup("cash-closing", "Caixa / PDV", "Fechamento de caixa", "Abra ou feche o caixa e confira os valores informados sem misturar vendas e despesas.", `
      <div id="cash-closing-summary" class="focused-summary-grid"></div>
      <div id="cash-closing-tools" class="focused-two-column"></div>
    `)
  ].join(""));

  const orderListPanel = document.getElementById("orders-table")?.closest(".panel");
  if (orderListPanel) {
    orderListPanel.classList.add("focused-function-card", "focused-table-card");
    const orderHeader = orderListPanel.querySelector("thead");
    if (orderHeader) orderHeader.innerHTML = `<tr><th>O.S.</th><th>Cliente</th><th>Servico</th><th>Prazo</th><th>Producao</th><th>Financeiro</th><th>Setor</th><th>Responsavel</th><th>Acoes</th></tr>`;
    document.getElementById("orders-search-list")?.appendChild(orderListPanel);
  }
  moveOperationalPanel("history-order", "orders-followup-tools");
  moveOperationalPanel("approval-form", "orders-no-file-tools");
  moveOperationalPanel("label-order", "orders-print-tools");
  moveOperationalPanel("stock-form", "orders-costs-tools");
  moveOperationalPanel("postcalc-order", "orders-costs-tools");

  moveOperationalPanel("cash-orders-table", "cash-receive-tools");
  moveOperationalPanel("order-payment-form", "cash-receive-tools");
  moveOperationalPanel("quick-sale-form", "cash-quick-sale-tools");
  moveOperationalPanel("quick-sales-table", "cash-quick-sale-tools");
  moveOperationalPanel("cash-expense-form", "cash-expense-tools");
  moveOperationalPanel("cash-adjust-form", "cash-withdrawal-tools");
  moveOperationalPanel("cash-open-form", "cash-closing-tools");
  moveOperationalPanel("blind-close-form", "cash-closing-tools");
  moveOperationalPanel("cash-report-cards", "cash-closing-tools", "cash-closing-report");
  moveOperationalPanel("move-sector-form", "production-move-tools");
  moveOperationalPanel("production-event-form", "production-move-tools");
  moveOperationalPanel("install-team-form", "production-installation-tools");
  moveOperationalPanel("install-checklist-form", "production-checklist-tools");
  moveOperationalPanel("receivables-table", "finance-receivables-tools");
  moveOperationalPanel("payables-table", "finance-payables-tools");
  moveOperationalPanel("cash-flow-cards", "finance-cashflow-tools");
  moveOperationalPanel("delinquency-list", "finance-cashflow-tools");
  moveOperationalPanel("dre-cards", "finance-dre-tools");
  moveOperationalPanel("operational-expense-form", "finance-expenses-tools");
  moveOperationalPanel("operational-expense-table", "finance-expenses-tools");
  moveOperationalPanel("product-form", "stock-product-new-tools");
  moveOperationalPanel("product-list", "stock-products-tools");
  moveOperationalPanel("materials-table", "stock-materials-tools");
  moveOperationalPanel("employees-table", "settings-employees-tools");
  moveOperationalPanel("permissions-form", "settings-permissions-tools");
  moveOperationalPanel("composition-form", "settings-compositions-tools");
  moveOperationalPanel("composition-list", "settings-compositions-tools");
  moveOperationalPanel("cost-center-form", "settings-cost-centers-tools");
  moveOperationalPanel("cost-center-list", "settings-cost-centers-tools");

  const adjustType = document.getElementById("cash-adjust-type");
  if (adjustType) {
    adjustType.value = "sangria";
    const typeLabel = adjustType.closest("label");
    if (typeLabel) typeLabel.remove();
  }

  document.getElementById("orders")?.remove();
  document.getElementById("cash")?.remove();

  document.getElementById("orders-new-quote")?.addEventListener("change", renderNewOrderPreview);
  document.getElementById("orders-new-form")?.addEventListener("submit", createOrderFromApprovedQuote);
  document.getElementById("orders-rework-form")?.addEventListener("submit", handleReworkOrderSubmit);
  document.getElementById("rework-source-order")?.addEventListener("change", renderSpecialServiceOrderPages);
  document.getElementById("orders-courtesy-form")?.addEventListener("submit", handleCourtesyOrderSubmit);
  document.getElementById("orders-cancel-form")?.addEventListener("submit", handleCancelOrderSubmit);
  document.querySelectorAll(".focused-operational-view [data-view]").forEach(button => {
    button.addEventListener("click", () => view(button.dataset.view, button));
  });
  document.getElementById("technical-visit-form")?.addEventListener("submit", handleTechnicalVisitSubmit);
  document.getElementById("visit-customer")?.addEventListener("change", applyVisitCustomer);
  document.getElementById("visit-filter-form")?.addEventListener("submit", event => {
    event.preventDefault();
    renderTechnicalVisits();
  });
  if (main.dataset.visitActionsBound !== "true") {
    main.dataset.visitActionsBound = "true";
    main.addEventListener("click", event => {
      const button = event.target.closest("[data-visit-action]");
      if (button) handleTechnicalVisitAction(button);
    });
  }
  organizeExtendedOperationalPanels();
}

function moveOperationalElement(elementId, targetId, extraClass = "") {
  const element = document.getElementById(elementId);
  const target = document.getElementById(targetId);
  if (!element || !target || target.contains(element)) return;
  if (extraClass) element.classList.add(extraClass);
  target.appendChild(element);
}

function organizeExtendedOperationalPanels() {
  moveOperationalElement("pcp-dashboard-cards", "production-pcp-tools", "focused-summary-grid");
  moveOperationalElement("production-view-toggle", "production-pcp-tools");
  moveOperationalElement("pcp-board", "production-pcp-tools");
  moveOperationalPanel("production-detail-table", "production-pcp-tools");
  const toolbar = document.querySelector("#pcp .pcp-toolbar");
  if (toolbar && document.getElementById("production-pcp-tools") && !document.getElementById("production-pcp-tools").contains(toolbar)) {
    document.getElementById("production-pcp-tools").prepend(toolbar);
  }
  const companies = document.getElementById("companies-panel");
  if (companies && document.getElementById("settings-stores-tools") && !document.getElementById("settings-stores-tools").contains(companies)) {
    document.getElementById("settings-stores-tools").appendChild(companies);
  }
  const sectorPanel = document.querySelector(".system-sector-panel");
  if (sectorPanel && document.getElementById("settings-sectors-tools") && !document.getElementById("settings-sectors-tools").contains(sectorPanel)) {
    document.getElementById("settings-sectors-tools").appendChild(sectorPanel);
  }
  document.querySelectorAll(".focused-operational-view .panel").forEach(panel => panel.classList.remove("ux-hidden", "ux-advanced-panel"));
  document.querySelectorAll(".focused-operational-view .module-tabs, .focused-operational-view .page-tabs").forEach(tabs => tabs.remove());
}

function focusedOrderRows(orders, columns, rowRenderer, emptyMessage) {
  if (!orders.length) return `<div class="premium-empty-state"><b>${emptyMessage}</b><span>Nao ha registros para esta fila operacional.</span></div>`;
  return `<div class="focused-table-scroll"><table class="focused-data-table"><thead><tr>${columns.map(column => `<th>${column}</th>`).join("")}</tr></thead><tbody>${orders.map(rowRenderer).join("")}</tbody></table></div>`;
}

function stockMovementTypeLabel(type) {
  return {
    entry: "Entrada",
    add: "Entrada",
    output: "Saida",
    remove: "Saida",
    adjustment: "Ajuste manual",
    manual_adjustment: "Ajuste manual"
  }[type] || "Movimentacao";
}

function stockStatusPill(material = {}) {
  const stock = Number(material.stock || 0);
  const minStock = Number(material.minStock || 0);
  if (stock < 0) return `<span class="status-pill danger">Negativo</span>`;
  if (stock <= minStock) return `<span class="status-pill production">Critico</span>`;
  return `<span class="status-pill finance">Disponivel</span>`;
}

function stockMovementRows(materialId = "") {
  const rows = (state.stockMovements || [])
    .filter(movement => !materialId || movement.materialId === materialId)
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 25);
  return focusedOrderRows(rows, ["Data", "Material", "Tipo", "Qtd.", "Saldo", "Responsavel", "Motivo"], movement => {
    const delta = Number(movement.delta ?? movement.quantity ?? 0);
    const directionClass = delta < 0 || movement.direction === "out" ? "production" : "finance";
    const quantityText = `${delta > 0 ? "+" : ""}${roundNumber(delta || movement.quantity || 0)} ${escapeHtml(movement.unit || "")}`;
    return `<tr>
      <td>${formatDateTime(movement.createdAt)}</td>
      <td><b>${escapeHtml(movement.materialName || "Material")}</b><small>${escapeHtml(movement.storeName || state.currentCompanyName || "Loja atual")}</small></td>
      <td><span class="status-pill ${directionClass}">${stockMovementTypeLabel(movement.type)}</span></td>
      <td>${quantityText}</td>
      <td>${roundNumber(movement.previousBalance ?? 0)} -> <b>${roundNumber(movement.balanceAfter ?? 0)}</b></td>
      <td>${escapeHtml(movement.responsible || movement.user || "-")}</td>
      <td>${escapeHtml(movement.reason || movement.notes || "-")}</td>
    </tr>`;
  }, "Nenhuma movimentacao de estoque registrada.");
}

function roundNumber(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(".", ",");
}

function stockMovementPanel() {
  const selectedMaterialId = document.getElementById("stock-material")?.value || state.materials[0]?.id || "";
  const selectedMaterial = state.materials.find(material => material.id === selectedMaterialId) || state.materials[0] || {};
  const lowStock = state.materials.filter(material => Number(material.stock || 0) <= Number(material.minStock || 0)).length;
  const totalValue = state.materials.reduce((sum, material) => sum + Number(material.stock || 0) * Number(material.cost || 0), 0);
  const options = state.materials.map(material => `<option value="${material.id}" ${material.id === selectedMaterial.id ? "selected" : ""}>${escapeHtml(material.name)} (${roundNumber(material.stock)} ${escapeHtml(material.unit || "")})</option>`).join("");
  const actionValue = document.getElementById("stock-action")?.value || "entry";
  const adjustmentClass = actionValue === "adjustment" ? "" : "is-muted";
  return `
    <section class="panel focused-function-card stock-balance-card">
      <div class="panel-title-row">
        <div>
          <span class="eyebrow">Estoque operacional</span>
          <h2>Saldo e lancamentos</h2>
          <p>Registre cada entrada, saida ou ajuste com responsavel, motivo e loja.</p>
        </div>
        <div class="focused-actions">
          <button type="button" data-view="stock-materials">Ver materiais</button>
          <button type="button" data-view="orders-costs">Consumo por O.S.</button>
        </div>
      </div>
      <div class="stock-summary-strip">
        <div><span>Materiais</span><b>${state.materials.length}</b></div>
        <div><span>Criticos</span><b>${lowStock}</b></div>
        <div><span>Valor em estoque</span><b>${money.format(totalValue)}</b></div>
      </div>
      <form id="stock-movement-form" class="stock-movement-form">
        <label>Material
          <select id="stock-material" required>${options || `<option value="">Nenhum material cadastrado</option>`}</select>
        </label>
        <label>Movimento
          <select id="stock-action" required>
            <option value="entry" ${actionValue === "entry" ? "selected" : ""}>Entrada de estoque</option>
            <option value="output" ${actionValue === "output" ? "selected" : ""}>Saida de estoque</option>
            <option value="adjustment" ${actionValue === "adjustment" ? "selected" : ""}>Ajuste manual</option>
          </select>
        </label>
        <label>Quantidade
          <input id="stock-quantity" type="number" min="0" step="0.01" placeholder="0,00">
        </label>
        <label class="stock-adjustment-field ${adjustmentClass}">Saldo final do ajuste
          <input id="stock-new-balance" type="number" step="0.01" placeholder="${roundNumber(selectedMaterial.stock || 0)}">
        </label>
        <label>Responsavel
          <input id="stock-responsible" value="${escapeHtml(state.user?.name || "")}" required>
        </label>
        <label class="stock-form-wide">Motivo
          <input id="stock-reason" placeholder="Ex.: compra, baixa para producao, inventario" required>
        </label>
        <label class="stock-form-wide">Autorizacao para saldo negativo
          <input id="stock-authorized-by" placeholder="Somente quando Admin/Gestor autorizar">
        </label>
        <div class="stock-form-actions">
          <button type="submit" class="primary" ${state.materials.length ? "" : "disabled"}>Registrar movimento</button>
          <button type="button" data-stock-action="clear">Limpar</button>
        </div>
      </form>
    </section>
    <section class="panel focused-function-card stock-current-card">
      <div class="panel-title-row">
        <div>
          <span class="eyebrow">Material selecionado</span>
          <h2>${escapeHtml(selectedMaterial.name || "Selecione um material")}</h2>
          <p>${escapeHtml(selectedMaterial.category || selectedMaterial.description || "Controle por loja atual")}</p>
        </div>
        ${stockStatusPill(selectedMaterial)}
      </div>
      <div class="stock-material-balance">
        <span>Saldo atual</span>
        <b>${roundNumber(selectedMaterial.stock || 0)} ${escapeHtml(selectedMaterial.unit || "")}</b>
        <small>Minimo: ${roundNumber(selectedMaterial.minStock || 0)} | Custo: ${money.format(selectedMaterial.cost || 0)}</small>
      </div>
      <h3>Historico recente</h3>
      ${stockMovementRows(selectedMaterial.id)}
    </section>
  `;
}

function bindStockMovementEvents() {
  const form = document.getElementById("stock-movement-form");
  if (form && form.dataset.bound !== "true") {
    form.dataset.bound = "true";
    form.addEventListener("submit", handleStockMovementSubmit);
  }
  ["stock-material", "stock-action"].forEach(id => {
    const element = document.getElementById(id);
    if (element && element.dataset.bound !== "true") {
      element.dataset.bound = "true";
      element.addEventListener("change", () => {
        const container = document.getElementById("stock-movements-tools");
        if (container) {
          container.innerHTML = stockMovementPanel();
          bindStockMovementEvents();
        }
      });
    }
  });
  document.querySelectorAll("[data-stock-action='clear']").forEach(button => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      document.getElementById("stock-movement-form")?.reset();
      document.getElementById("stock-responsible").value = state.user?.name || "";
    });
  });
}

async function handleStockMovementSubmit(event) {
  event.preventDefault();
  const type = document.getElementById("stock-action")?.value || "entry";
  const body = {
    materialId: document.getElementById("stock-material")?.value || "",
    type,
    quantity: Number(document.getElementById("stock-quantity")?.value || 0),
    newBalance: document.getElementById("stock-new-balance")?.value ? Number(document.getElementById("stock-new-balance").value) : undefined,
    responsible: document.getElementById("stock-responsible")?.value || state.user?.name || "",
    reason: document.getElementById("stock-reason")?.value || "",
    authorizedBy: document.getElementById("stock-authorized-by")?.value || ""
  };
  try {
    await api("/api/stock-movements", { method: "POST", body });
    await loadAll();
    view("stock-movements");
    showToast("Movimento de estoque registrado.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderFocusedOperationalSubpages() {
  if (!document.getElementById("orders-search")) return;
  renderNewOrderPreview();
  renderOrdersSearchFocused();
  renderOrdersFollowupFocused();
  renderOrdersLateFocused();
  renderOrdersWithoutFileFocused();
  renderOrdersWithoutPaymentFocused();
  renderSpecialServiceOrderPages();
  renderProductionMovementFocused();
  renderCashFocusedSummaries();
  renderExtendedFocusedSubpages();
}

function quoteReadyForOrder(quote) {
  return !state.orders.some(order => order.quoteId === quote.id);
}

function renderNewOrderPreview() {
  const select = document.getElementById("orders-new-quote");
  const preview = document.getElementById("orders-new-preview");
  if (!select || !preview) return;
  const ready = state.quotes.filter(quoteReadyForOrder);
  const currentValue = select.value;
  select.innerHTML = ready.map(quote => `<option value="${quote.id}">${quote.quoteNumber || quote.id} - ${customerName(quote.customerId)} - ${quote.jobName}</option>`).join("");
  if (ready.some(quote => quote.id === currentValue)) select.value = currentValue;
  const quote = ready.find(item => item.id === select.value) || ready[0];
  preview.innerHTML = quote ? [
    ["Cliente", customerName(quote.customerId)],
    ["Trabalho", quote.jobName || "Servico grafico"],
    ["Valor aprovado", money.format(quote.approvedPrice || quote.pricing?.finalPrice || 0)],
    ["Status", quote.status || "rascunho"],
    ["Arquivos", (quote.files || []).length],
    ["Prazo", quote.answers?.deadline || quote.answers?.dueDate || "Definir"]
  ].map(([label, value]) => `<div class="focused-summary-item"><span>${label}</span><b>${value}</b></div>`).join("") : `<div class="focused-empty-note"><b>Nenhum orcamento disponivel.</b><span>Crie ou aprove um orcamento antes de gerar a O.S.</span></div>`;
  document.querySelector("#orders-new-form button[type='submit']")?.toggleAttribute("disabled", !quote);
}

async function createOrderFromApprovedQuote(event) {
  event.preventDefault();
  const quoteId = document.getElementById("orders-new-quote")?.value;
  if (!quoteId) return showToast("Selecione um orcamento para gerar a O.S.", "warning");
  try {
    const order = await api(`/api/quotes/${quoteId}/approve`, { method: "POST", body: { approvedBy: state.user?.name || "Gestor" } });
    state.activeOrderId = order.id;
    await loadAll();
    view("orders-search");
    showToast("O.S. gerada com sucesso.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderOrdersSearchFocused() {
  const summary = document.getElementById("orders-search-summary");
  const detail = document.getElementById("orders-search-detail");
  if (!summary || !detail) return;
  const current = state.orders.find(order => order.id === state.activeOrderId) || state.orders[0];
  summary.innerHTML = [
    ["O.S. cadastradas", state.orders.length],
    ["Em producao", state.orders.filter(order => normalizeUxText(order.productionStatus).includes("produc")).length],
    ["Pendentes de pagamento", state.orders.filter(order => orderIsBillable(order) && Number(order.paidAmount || 0) < Number(order.total || 0)).length]
  ].map(([label, value]) => `<div class="focused-summary-item"><span>${label}</span><b>${value}</b></div>`).join("");
  if (!current) {
    detail.innerHTML = `<div class="premium-empty-state"><b>Nenhuma O.S. selecionada.</b><span>Selecione uma ordem na tabela acima.</span></div>`;
    return;
  }
  const paid = Number(current.paidAmount || current.receivedAmount || current.downPayment || 0);
  const total = Number(current.total || 0);
  const balance = Math.max(total - paid, 0);
  const items = orderItems(current);
  const allowedTabs = ["data", "items", "production", "finance", "files", "notes", "history"];
  const activeTab = allowedTabs.includes(state.activeOrderDetailTab) ? state.activeOrderDetailTab : "items";
  state.activeOrderDetailTab = activeTab;
  const active = tab => activeTab === tab ? " active" : "";
  const customer = state.customers.find(item => item.id === current.customerId) || {};
  const predicted = Number(current.predictedCost || 0);
  const real = Number(current.realCost || 0);
  detail.classList.add("order-root-detail");
  detail.innerHTML = renderPageShell({
    id: "order-root-shell",
    header: renderPageHeader({
      eyebrow: "Ordem de Serviço",
      title: `${current.id} - ${current.customerName || customer.name || "Cliente"} ${orderTypeBadge(current)}`,
      subtitle: current.jobName || items.map(item => item.productName).filter(Boolean).join(", ") || "Serviço gráfico",
      metrics: [
        { label: "Prazo", value: current.dueDate || "-" },
        { label: "Produção", value: current.productionStatus || "-" },
        { label: "Financeiro", value: current.financialStatus || "-" },
        { label: "Total", value: money.format(total) }
      ],
      actions: [
        { label: "Imprimir", data: `data-action="print-order" data-order="${current.id}"` },
        ...(orderIsBillable(current) ? [{ label: "Receber", data: `data-action="bill-order" data-order="${current.id}"` }] : []),
        ...(orderIsCancelled(current) ? [] : [{ label: "Enviar ao PCP", primary: true, data: `data-action="send-pcp" data-order="${current.id}"` }])
      ]
    }),
    tabs: renderCompactTabs("order-root-tabs", [
      { id: "data", label: "Dados" },
      { id: "items", label: "Itens" },
      { id: "production", label: "Produção" },
      { id: "finance", label: "Financeiro" },
      { id: "files", label: "Arquivos" },
      { id: "notes", label: "Observações" },
      { id: "history", label: "Histórico" }
    ], activeTab),
    body: `
      <section class="root-tab-pane${active("data")}" data-root-pane="data">
        ${renderSummaryCards([
          { label: "Cliente", value: current.customerName || customer.name || "-", description: customer.phone || current.contact || "Contato não informado" },
          { label: "Trabalho", value: current.jobName || "-", description: current.deliveryAddress || current.answers?.deliveryAddress || "Entrega a combinar" },
          { label: "Vendedor", value: current.seller || "-", description: current.attendant ? `Atendimento: ${current.attendant}` : "Atendimento não informado" },
          { label: "Origem", value: current.quoteId || "O.S. direta", description: `${items.length} item(ns) congelado(s)` }
        ])}
        <section class="root-compact-block"><div class="root-block-heading"><h2>Dados operacionais</h2></div><div class="root-info-grid">${orderInfoCards([
          ["Logística", current.logistics || current.answers?.logistics || "A combinar"],
          ["Endereço de entrega", current.deliveryAddress || current.answers?.deliveryAddress || "-"],
          ["Prioridade", current.priority || "normal"],
          ["Aprovação", current.approvalStatus || "-"],
          ["Prazo", current.dueDate || "-"],
          ["Setor atual", current.currentSectorName || current.productionStatus || "-"]
        ])}</div></section>
      </section>
      <section class="root-tab-pane${active("items")}" data-root-pane="items">
        ${renderOrderProductPicker(current)}
        <section class="root-compact-block root-table-block"><div class="root-block-heading"><h2>Itens congelados na O.S.</h2><small>Produto, respostas, custos e rota preservados desde o orçamento.</small></div>${focusedOrderSnapshotItems(items, current)}</section>
      </section>
      <section class="root-tab-pane${active("production")}" data-root-pane="production">
        <section class="root-compact-block"><div class="root-block-heading"><h2>Rota produtiva congelada</h2><small>O avanço segue somente a sequência definida no cadastro do produto.</small></div>${renderProductionRoute(current)}</section>
        <div class="root-inline-actions">
          <button type="button" class="primary" data-production-action="iniciar" data-order="${current.id}">Iniciar</button>
          <button type="button" data-production-action="pausar" data-order="${current.id}">Pausar</button>
          <button type="button" data-production-action="finalizar" data-order="${current.id}">Finalizar etapa</button>
          <button type="button" data-action="move-next-sector" data-order="${current.id}">Próximo setor</button>
          <button type="button" data-production-action="observar" data-order="${current.id}">Ver observações</button>
        </div>
        ${renderSummaryCards([
          { label: "Setor atual", value: current.currentSectorName || current.productionStatus || "-", description: `Próximo: ${nextOrderSector(current)}` },
          { label: "Responsável", value: current.currentResponsible || current.responsible || "A definir", description: "Responsável pelo setor atual" },
          { label: "Custo previsto", value: money.format(predicted), description: `Materiais: ${money.format(current.predictedMaterialCost || 0)}` },
          { label: "Custo real", value: money.format(real), description: `Diferença: ${money.format(real - predicted)}` }
        ])}
      </section>
      <section class="root-tab-pane${active("finance")}" data-root-pane="finance">
        ${renderSummaryCards([
          { label: "Valor vendido", value: money.format(total), description: current.paymentMethod || current.answers?.paymentMethod || "Forma de pagamento a definir" },
          { label: "Recebido", value: money.format(paid), description: current.financialStatus || "-" },
          { label: "Saldo", value: money.format(balance), description: current.duePaymentDate ? `Vencimento: ${current.duePaymentDate}` : "Vencimento não informado" },
          { label: "Lucro previsto", value: money.format(current.predictedProfit || total - predicted), description: `Margem prevista: ${Number(current.predictedMargin || 0).toFixed(1)}%` }
        ])}
        <div class="root-inline-actions">${orderIsBillable(current) ? `<button type="button" class="primary" data-action="bill-order" data-order="${current.id}">Registrar recebimento</button><button type="button" data-view="finance-receivables">Contas a receber</button>` : `<button type="button" disabled title="Retrabalho, cortesia ou O.S. cancelada nao gera financeiro.">Sem financeiro</button>`}</div>
      </section>
      <section class="root-tab-pane${active("files")}" data-root-pane="files">
        <section class="root-compact-block"><div class="root-block-heading"><h2>Arquivos vinculados</h2><button type="button" data-action="attach-order" data-order="${current.id}">Anexar arquivo</button></div><div class="root-info-grid">${renderOrderFiles(current, items)}</div></section>
      </section>
      <section class="root-tab-pane${active("notes")}" data-root-pane="notes">
        <form id="order-production-notes-form" class="root-compact-block root-notes-form">
          <div class="root-block-heading"><h2>Orientações da O.S.</h2><small>Estas informações acompanham o PCP e as tarefas de produção.</small></div>
          <div class="root-form-grid" style="--root-columns:2">
            <label>Observações para produção<textarea name="productionNotes">${escapeHtml(current.productionNotes || "")}</textarea></label>
            <label>Alertas internos da produção<textarea name="internalProductionWarnings">${escapeHtml(current.internalProductionWarnings || "")}</textarea></label>
            <label>Instruções de arquivo<textarea name="fileInstructions">${escapeHtml(current.fileInstructions || "")}</textarea></label>
            <label>Observações de instalação<textarea name="installationNotes">${escapeHtml(current.installationNotes || "")}</textarea></label>
          </div>
          <div class="root-inline-actions"><button type="submit" class="primary">Salvar observações</button><button type="button" data-action="order-note" data-order="${current.id}">Adicionar evento à timeline</button></div>
        </form>
      </section>
      <section class="root-tab-pane${active("history")}" data-root-pane="history">
        <section class="root-compact-block"><div class="root-block-heading"><h2>Histórico da O.S.</h2></div><div class="root-timeline">${orderTimeline(current)}</div></section>
      </section>
    `
  });
  document.getElementById("order-root-tabs")?.addEventListener("click", event => {
    const button = event.target.closest("[data-root-tab]");
    if (!button) return;
    state.activeOrderDetailTab = button.dataset.rootTab;
    activateRootTab("order-root-shell", state.activeOrderDetailTab);
  });
  document.getElementById("order-product-picker")?.addEventListener("change", event => {
    if (event.target.name !== "productId") return;
    state.activeOrderProductDraftId = event.target.value;
    state.activeOrderDetailTab = "items";
    renderOrdersSearchFocused();
  });
  document.getElementById("order-product-picker")?.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const answers = {};
    formData.forEach((value, key) => {
      if (key.startsWith("answer:")) answers[key.slice(7)] = value;
    });
    await api(`/api/orders/${current.id}/items`, {
      method: "POST",
      body: {
        productId: formData.get("productId"),
        description: formData.get("description"),
        answers,
        user: state.user?.name || "Atendimento"
      }
    });
    await loadAll();
    view("orders-search");
    showToast("Produto adicionado à O.S. com cálculo e rota atualizados.", "success");
  });
  document.getElementById("order-production-notes-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await api(`/api/orders/${current.id}/production-notes`, { method: "PUT", body: { ...values, user: state.user?.name || "Produção" } });
    await loadAll();
    view("orders-search");
    showToast("Observações de produção atualizadas.", "success");
  });
}

function renderOrderProductPicker(order) {
  const products = state.products.filter(product => product.active !== false);
  const product = products.find(item => item.id === state.activeOrderProductDraftId) || products[0];
  if (!product) return "";
  state.activeOrderProductDraftId = product.id;
  const mode = product.pricingMode || "unit";
  const questions = (product.technicalQuestions || product.questions || []).filter(question => question.visibleInOrder !== false && !["width", "height", "quantity", "linearMeasure", "linear_measure", "thickness"].includes(question.key));
  const questionInput = question => {
    if (question.type === "boolean" || question.answerType === "yes_no") return `<select name="answer:${question.key}"><option value="">Não</option><option value="true">Sim</option></select>`;
    if (question.type === "select" || question.answerType === "select") return `<select name="answer:${question.key}"><option value="">Selecione</option>${(question.options || []).map(option => `<option value="${option.value}">${option.label}</option>`).join("")}</select>`;
    return `<input name="answer:${question.key}" type="${["number", "measure", "money"].includes(question.type || question.answerType) ? "number" : "text"}" step="0.01">`;
  };
  return `<form id="order-product-picker" class="root-compact-block">
    <div class="root-block-heading"><h2>Adicionar produto à O.S.</h2><small>O cadastro escolhido define perguntas, custo previsto e rota produtiva.</small></div>
    <div class="root-form-grid" style="--root-columns:4">
      <label>Produto<select name="productId">${products.map(item => `<option value="${item.id}" ${item.id === product.id ? "selected" : ""}>${item.code || ""} ${item.name}</option>`).join("")}</select></label>
      <label>Descrição<input name="description" value="${escapeHtml(product.name)}"></label>
      ${mode === "square_meter" ? `<label>Largura<input name="answer:width" type="number" step="0.01" required></label><label>Altura<input name="answer:height" type="number" step="0.01" required></label>` : ""}
      ${mode === "linear_meter" ? `<label>Metro linear<input name="answer:linearMeasure" type="number" step="0.01" required></label>` : ""}
      <label>Quantidade<input name="answer:quantity" type="number" min="1" value="1" required></label>
    </div>
    ${questions.length ? `<div class="root-question-grid"><div id="order-product-question-fields">${questions.map(question => `<label class="root-question-card"><span>${question.label}</span>${questionInput(question)}${question.affectsCost ? "<small>Altera o custo</small>" : ""}</label>`).join("")}</div></div>` : ""}
    ${renderCompactActionBar([{ label: "Adicionar produto", type: "submit", primary: true }], `${businessLabel(mode)} · prazo padrão ${product.defaultProductionDays || 3} dia(s)`)}
  </form>`;
}

function focusedOrderSnapshotItems(items, order = {}) {
  if (!items.length) return `<div class="premium-empty-state"><b>Nenhum item congelado nesta O.S.</b><span>Consulte o orçamento de origem para revisar o produto.</span></div>`;
  return `<div class="focused-table-scroll"><table class="focused-data-table root-items-table"><thead><tr><th>Item</th><th>Produto</th><th>Medida</th><th>Qtd.</th><th>Custos das perguntas</th><th>Setor atual</th><th>Status</th><th>Ações</th></tr></thead><tbody>${items.map((item, index) => {
    const answers = item.technicalAnswersSnapshot || item.answers || {};
    const measure = answers.width && answers.height ? `${answers.width} x ${answers.height} m` : answers.linearMeasure ? `${answers.linearMeasure} m` : item.measure || "-";
    const questionCost = (item.questionCostsSnapshot || item.pricingSnapshot?.questionCosts || []).reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const route = item.productionRouteSnapshot || item.productConfigSnapshot?.productionRoute || [];
    const sector = item.currentSectorName || order.currentSectorName || order.productionStatus || "-";
    const status = item.productionStatus || order.productionStatus || "Aguardando";
    return `<tr><td><b>${index + 1}</b></td><td><b>${escapeHtml(item.productName || item.description || "Produto")}</b><small>${escapeHtml(item.description || "")}</small><div class="focused-route-inline">${route.map(step => `<span style="--sector-color:${escapeHtml(step.color || "#6f0f8f")}">${escapeHtml(step.icon || "")} ${escapeHtml(step.sectorName)}</span>`).join("") || "<small>Sem rota definida</small>"}</div></td><td>${escapeHtml(measure)}</td><td>${Number(item.quantity || answers.quantity || 1)}</td><td>${money.format(questionCost)}</td><td>${escapeHtml(sector)}</td><td><span class="status-pill production">${escapeHtml(status)}</span></td><td class="row-actions"><button data-order-item-action="edit" data-order="${order.id || ""}" data-item="${item.id}">Editar</button><button data-order-item-action="duplicate" data-order="${order.id || ""}" data-item="${item.id}">Duplicar</button><button data-order-item-action="remove" data-order="${order.id || ""}" data-item="${item.id}">Remover</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderOrdersFollowupFocused() {
  const target = document.getElementById("orders-followup-table");
  if (!target) return;
  target.innerHTML = focusedOrderRows(state.orders, ["O.S.", "Cliente", "Setor", "Responsavel", "Prazo", "Status", "Proxima acao", "Acao"], order => `
    <tr><td><b>${order.id}</b></td><td>${order.customerName}</td><td>${order.currentSector || order.productionStatus || "-"}</td><td>${order.responsible || order.currentResponsible || "Definir"}</td><td>${order.dueDate || "-"}</td><td><span class="status-pill production">${order.productionStatus || "-"}</span></td><td>${productionNextAction(order)}</td><td><button data-action="history-order" data-order="${order.id}">Historico</button></td></tr>
  `, "Nenhuma O.S. em acompanhamento.");
}

function renderOrdersLateFocused() {
  const target = document.getElementById("orders-late-table");
  if (!target) return;
  const today = new Date();
  const late = state.orders.filter(order => productionVisualStatus(order) === "atrasado");
  target.innerHTML = focusedOrderRows(late, ["Prioridade", "O.S.", "Cliente", "Prazo", "Dias de atraso", "Setor", "Acao necessaria"], order => {
    const delay = Math.max(Math.floor((today - new Date(`${order.dueDate}T12:00:00`)) / 86400000), 0);
    return `<tr><td><span class="status-pill production">${order.priority || "alta"}</span></td><td><b>${order.id}</b></td><td>${order.customerName}</td><td>${order.dueDate || "-"}</td><td><b>${delay}</b></td><td>${order.currentSector || order.productionStatus || "-"}</td><td><button data-action="open-order" data-order="${order.id}">Resolver</button></td></tr>`;
  }, "Nenhuma O.S. atrasada.");
}

function renderOrdersWithoutFileFocused() {
  const target = document.getElementById("orders-no-file-table");
  if (!target) return;
  const rows = state.orders.filter(order => !(order.files || []).length);
  target.innerHTML = focusedOrderRows(rows, ["O.S.", "Cliente", "Trabalho", "Responsavel", "Prazo", "Acao"], order => `<tr><td><b>${order.id}</b></td><td>${order.customerName}</td><td>${order.jobName}</td><td>${order.responsible || order.currentResponsible || "Definir"}</td><td>${order.dueDate || "-"}</td><td><button class="primary" data-action="attach-order" data-order="${order.id}">Anexar arquivo</button></td></tr>`, "Nenhuma O.S. sem arquivo.");
}

function renderOrdersWithoutPaymentFocused() {
  const target = document.getElementById("orders-no-payment-table");
  if (!target) return;
  const rows = state.orders.filter(order => orderIsBillable(order) && Number(order.paidAmount || order.receivedAmount || 0) < Number(order.total || 0));
  target.innerHTML = focusedOrderRows(rows, ["O.S.", "Cliente", "Total", "Recebido", "Saldo", "Status", "Acao"], order => {
    const paid = Number(order.paidAmount || order.receivedAmount || 0);
    return `<tr><td><b>${order.id}</b></td><td>${order.customerName}</td><td>${money.format(order.total || 0)}</td><td>${money.format(paid)}</td><td><b>${money.format(Math.max(Number(order.total || 0) - paid, 0))}</b></td><td><span class="status-pill finance">${order.financialStatus || "-"}</span></td><td><button class="primary" data-action="bill-order" data-order="${order.id}">Receber</button></td></tr>`;
  }, "Nenhuma O.S. pendente de pagamento.");
}

function businessOrderTypeLabel(type = "normal") {
  return type === "rework" ? "Retrabalho" : type === "courtesy" ? "Cortesia" : "Normal";
}

function orderIsCancelled(order = {}) {
  return order.lifecycleStatus === "cancelled" || order.productionStatus === "Cancelada";
}

function orderIsBillable(order = {}) {
  return !orderIsCancelled(order) && !order.nonBillable && !order.billingBlocked && !["rework", "courtesy"].includes(order.serviceOrderType);
}

function orderTypeBadge(order = {}) {
  const type = order.serviceOrderType || "normal";
  const label = orderIsCancelled(order) ? "Cancelada" : businessOrderTypeLabel(type);
  const className = orderIsCancelled(order) ? "danger" : type === "rework" ? "warning" : type === "courtesy" ? "info" : "success";
  return `<span class="service-order-badge ${className}">${label}</span>`;
}

function fillSelectOptions(select, items, labelFn, emptyLabel = "Selecione") {
  if (!select) return;
  const previous = select.value;
  select.innerHTML = `<option value="">${emptyLabel}</option>${items.map(item => `<option value="${item.id}">${escapeHtml(labelFn(item))}</option>`).join("")}`;
  if (items.some(item => String(item.id) === previous)) select.value = previous;
  else if (items.length && !select.value) select.value = items[0].id;
}

function renderSpecialServiceOrderPages() {
  const activeOrders = state.orders.filter(order => !orderIsCancelled(order));
  const billableOrders = activeOrders.filter(order => order.serviceOrderType !== "rework" && order.serviceOrderType !== "courtesy");
  const sectors = state.sectors || [];
  const employees = state.employees || [];
  fillSelectOptions(document.getElementById("rework-source-order"), billableOrders, order => `${order.id} - ${order.customerName || customerName(order.customerId)} - ${order.jobName || "Servico"}`, "Selecione a O.S.");
  fillSelectOptions(document.getElementById("rework-responsible"), employees.filter(employee => employee.active !== false), employee => `${employee.name} - ${employee.sector || employee.role || "Equipe"}`, "Responsavel");
  fillSelectOptions(document.getElementById("rework-sector"), sectors.filter(sector => sector.active !== false), sector => sector.name, "Setor");
  fillSelectOptions(document.getElementById("courtesy-customer"), state.customers || [], customer => customer.name, "Cliente");
  fillSelectOptions(document.getElementById("courtesy-sector"), sectors.filter(sector => sector.active !== false), sector => sector.name, "Setor");
  fillSelectOptions(document.getElementById("cancel-order-id"), activeOrders.filter(order => !["rework", "courtesy"].includes(order.serviceOrderType)), order => `${order.id} - ${order.customerName || customerName(order.customerId)} - ${money.format(order.total || 0)}`, "Selecione a O.S.");

  const sourceOrderId = document.getElementById("rework-source-order")?.value;
  const sourceOrder = state.orders.find(order => order.id === sourceOrderId) || billableOrders[0];
  const itemPanel = document.getElementById("rework-source-items");
  if (itemPanel) {
    const items = sourceOrder ? orderItems(sourceOrder) : [];
    itemPanel.innerHTML = sourceOrder ? `
      <div class="root-block-heading"><h2>Itens da ${escapeHtml(sourceOrder.id)}</h2><small>Selecione apenas os itens que voltam para retrabalho.</small></div>
      <div class="rework-item-list">
        ${items.map((item, index) => `<label class="rework-item-row"><input type="checkbox" name="reworkItem" value="${escapeHtml(item.id)}" ${index === 0 ? "checked" : ""}><span><b>${escapeHtml(item.productName || item.description || `Item ${index + 1}`)}</b><small>${escapeHtml(item.measure || item.description || "Sem medida informada")}</small></span></label>`).join("") || `<div class="premium-empty-state compact"><b>Sem itens encontrados.</b><span>Esta O.S. nao possui itens congelados.</span></div>`}
      </div>
    ` : `<div class="premium-empty-state compact"><b>Nenhuma O.S. de origem.</b><span>Crie ou aprove uma O.S. antes de gerar retrabalho.</span></div>`;
  }

  const reworkTable = document.getElementById("orders-rework-table");
  if (reworkTable) {
    const rows = state.orders.filter(order => order.serviceOrderType === "rework");
    reworkTable.innerHTML = focusedOrderRows(rows, ["O.S.", "Origem", "Cliente", "Responsavel", "Status"], order => `<tr><td><b>${order.id}</b>${orderTypeBadge(order)}<small>${escapeHtml(order.currentSectorName || "-")} | ${order.dueDate || "-"}</small></td><td>${order.originalOrderId || "-"}</td><td>${order.customerName || customerName(order.customerId)}</td><td>${order.currentResponsible || "-"}</td><td><span class="status-pill production">${order.productionStatus || "-"}</span></td></tr>`, "Nenhuma O.S. de retrabalho registrada.");
  }

  const courtesyTable = document.getElementById("orders-courtesy-table");
  if (courtesyTable) {
    const rows = state.orders.filter(order => order.serviceOrderType === "courtesy");
    courtesyTable.innerHTML = focusedOrderRows(rows, ["O.S.", "Cliente", "Descricao", "Status"], order => `<tr><td><b>${order.id}</b>${orderTypeBadge(order)}<small>${escapeHtml(order.currentSectorName || "-")} | ${order.dueDate || "-"}</small></td><td>${order.customerName || customerName(order.customerId)}</td><td>${escapeHtml(order.jobName || "Cortesia")}<small>Autorizado por ${escapeHtml(order.authorizedBy || "-")}</small></td><td><span class="status-pill production">${order.productionStatus || "-"}</span></td></tr>`, "Nenhuma cortesia registrada.");
  }

  const cancelledTable = document.getElementById("orders-cancelled-table");
  if (cancelledTable) {
    const rows = state.orders.filter(orderIsCancelled);
    cancelledTable.innerHTML = focusedOrderRows(rows, ["O.S.", "Cliente", "Motivo", "Financeiro"], order => `<tr><td><b>${order.id}</b>${orderTypeBadge(order)}<small>${String(order.canceledAt || "").slice(0, 16).replace("T", " ") || "-"} por ${escapeHtml(order.canceledBy || "-")}</small></td><td>${order.customerName || customerName(order.customerId)}</td><td>${escapeHtml(order.cancelReason || "-")}</td><td>${escapeHtml(order.financialCancellationDecision || order.financialStatus || "-")}</td></tr>`, "Nenhuma O.S. cancelada.");
  }
}

function renderProductionMovementFocused() {
  const summary = document.getElementById("production-movement-summary");
  const table = document.getElementById("production-movement-table");
  if (!summary || !table) return;
  const movements = Array.isArray(state.productionMovements?.rows) ? state.productionMovements.rows : [];
  summary.innerHTML = [
    ["Movimentos registrados", state.productionMovements?.summary?.total ?? movements.length],
    ["Hoje", state.productionMovements?.summary?.today ?? 0],
    ["Retrabalhos", state.productionMovements?.summary?.reworks ?? 0],
    ["Cancelamentos", state.productionMovements?.summary?.cancellations ?? 0]
  ].map(([label, value]) => `<div class="focused-summary-item"><span>${label}</span><b>${value}</b></div>`).join("");
  table.innerHTML = focusedOrderRows(movements, ["Data", "O.S.", "Tipo", "Cliente", "Setor", "Movimento", "Responsavel", "Observacao"], movement => `<tr><td>${String(movement.createdAt || "").slice(0, 16).replace("T", " ")}</td><td><b>${movement.orderId}</b></td><td>${businessOrderTypeLabel(movement.orderType)}</td><td>${escapeHtml(movement.customerName || "-")}</td><td>${escapeHtml(movement.sectorName || "-")}</td><td><span class="status-pill production">${escapeHtml(productionActionLabel(movement.action))}</span></td><td>${escapeHtml(movement.responsible || "-")}</td><td>${escapeHtml(movement.observation || "-")}</td></tr>`, "Nenhuma movimentacao registrada.");
  const button = document.querySelector('[data-action="refresh-production-movements"]');
  if (button) button.onclick = refreshProductionMovements;
}

function productionActionLabel(action = "") {
  const labels = {
    order_cancelled: "O.S. cancelada",
    rework_order_created: "Retrabalho criado",
    rework_linked: "Retrabalho vinculado",
    courtesy_order_created: "Cortesia criada",
    moved_to_next_sector: "Enviada ao setor",
    received: "Recebida",
    started: "Iniciada",
    paused: "Pausada",
    resumed: "Retomada",
    finished_sector: "Etapa finalizada",
    homologated: "Homologada",
    rework_rejected: "Reprovada",
    released_delivery: "Liberada entrega",
    file_attached: "Arquivo anexado",
    note_added: "Observacao"
  };
  return labels[action] || String(action || "Movimento").replace(/_/g, " ");
}

async function refreshProductionMovements() {
  const params = new URLSearchParams();
  const search = document.getElementById("production-movement-search")?.value.trim();
  const sector = document.getElementById("production-movement-sector")?.value.trim();
  const dateFrom = document.getElementById("production-movement-from")?.value;
  const dateTo = document.getElementById("production-movement-to")?.value;
  if (search) params.set("q", search);
  if (sector) params.set("sector", sector);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  state.productionMovements = await api(`/api/production/movements${params.toString() ? `?${params}` : ""}`);
  renderProductionMovementFocused();
  showToast("Movimentacao da producao atualizada.", "success");
}

async function handleReworkOrderSubmit(event) {
  event.preventDefault();
  const sourceOrderId = document.getElementById("rework-source-order")?.value;
  const itemIds = Array.from(document.querySelectorAll('input[name="reworkItem"]:checked')).map(item => item.value);
  if (!sourceOrderId) return showToast("Selecione a O.S. de origem.", "warning");
  if (!itemIds.length) return showToast("Selecione ao menos um item para retrabalho.", "warning");
  try {
    const result = await api(`/api/orders/${sourceOrderId}/rework`, {
      method: "POST",
      body: {
        itemIds,
        responsible: document.getElementById("rework-responsible")?.selectedOptions?.[0]?.textContent || document.getElementById("rework-responsible")?.value,
        sector: document.getElementById("rework-sector")?.selectedOptions?.[0]?.textContent || document.getElementById("rework-sector")?.value,
        dueDate: document.getElementById("rework-due-date")?.value,
        displacementCost: Number(document.getElementById("rework-displacement-cost")?.value || 0),
        miscCost: Number(document.getElementById("rework-misc-cost")?.value || 0),
        reason: document.getElementById("rework-reason")?.value,
        user: state.user?.name || "PCP"
      }
    });
    state.activeOrderId = result.order?.id;
    await loadAll();
    view("orders-rework");
    showToast("O.S. de retrabalho criada e enviada ao PCP.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function handleCourtesyOrderSubmit(event) {
  event.preventDefault();
  try {
    const result = await api("/api/orders/courtesy", {
      method: "POST",
      body: {
        customerId: document.getElementById("courtesy-customer")?.value,
        sector: document.getElementById("courtesy-sector")?.selectedOptions?.[0]?.textContent || document.getElementById("courtesy-sector")?.value,
        dueDate: document.getElementById("courtesy-due-date")?.value,
        description: document.getElementById("courtesy-description")?.value,
        quantity: Number(document.getElementById("courtesy-quantity")?.value || 1),
        authorizedBy: document.getElementById("courtesy-authorized-by")?.value,
        reason: document.getElementById("courtesy-reason")?.value,
        user: state.user?.name || "Atendimento"
      }
    });
    state.activeOrderId = result.order?.id;
    event.target.reset();
    await loadAll();
    view("orders-courtesy");
    showToast("O.S. de cortesia criada sem financeiro.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function handleCancelOrderSubmit(event) {
  event.preventDefault();
  const orderId = document.getElementById("cancel-order-id")?.value;
  if (!orderId) return showToast("Selecione a O.S. para cancelar.", "warning");
  try {
    await api(`/api/orders/${orderId}/cancel`, {
      method: "POST",
      body: {
        reason: document.getElementById("cancel-reason")?.value,
        financialDecision: document.getElementById("cancel-financial-decision")?.value,
        financialObservation: document.getElementById("cancel-financial-observation")?.value,
        user: state.user?.name || "Gestor"
      }
    });
    await loadAll();
    view("orders-cancelled");
    showToast("O.S. cancelada com auditoria e financeiro protegido.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderCashFocusedSummaries() {
  const receive = document.getElementById("cash-receive-summary");
  const closing = document.getElementById("cash-closing-summary");
  const pending = state.orders.filter(order => orderIsBillable(order) && Number(order.paidAmount || order.receivedAmount || 0) < Number(order.total || 0));
  if (receive) receive.innerHTML = [
    ["O.S. para receber", pending.length],
    ["Saldo pendente", money.format(pending.reduce((sum, order) => sum + Math.max(Number(order.total || 0) - Number(order.paidAmount || order.receivedAmount || 0), 0), 0))],
    ["Recebido no caixa", money.format(state.cashReport?.receivedTotal || 0)]
  ].map(([label, value]) => `<div class="focused-summary-item"><span>${label}</span><b>${value}</b></div>`).join("");
  if (closing) closing.innerHTML = [
    ["Caixa", state.dashboard?.cashOpen ? "Aberto" : "Fechado"],
    ["Entradas", money.format(state.cashReport?.receivedTotal || 0)],
    ["Saidas", money.format((state.cashReport?.expensesTotal || 0) + (state.cashReport?.sangrias || 0))],
    ["Saldo final", money.format(state.cashReport?.finalBalance || 0)]
  ].map(([label, value]) => `<div class="focused-summary-item"><span>${label}</span><b>${value}</b></div>`).join("");
}

function renderPrintSettingsFocused() {
  const form = document.getElementById("print-settings-form");
  if (!form) return;
  const settings = state.printSettings || {};
  const setValue = (id, value) => {
    const field = document.getElementById(id);
    if (field && document.activeElement !== field) field.value = value ?? "";
  };
  setValue("print-logo-url", settings.logoUrl || "");
  setValue("print-header-image-url", settings.headerImageUrl || "");
  setValue("print-footer-text", settings.footerText || "");
  setValue("print-primary-color", settings.primaryColor || "#2563eb");
  setValue("print-secondary-color", settings.secondaryColor || "#f4e8fa");
  setValue("print-text-color", settings.textColor || "#202124");
  setValue("print-order-model", settings.defaultOrderModel || "operacional");
  setValue("print-quote-model", settings.defaultQuoteModel || "comercial");
  setValue("print-report-model", settings.defaultReportModel || "gerencial");
  [
    settings.showAddress !== false,
    settings.showCnpj !== false,
    settings.showPhone !== false,
    settings.showSeller !== false,
    settings.showEmployeeContact !== false,
    settings.showCustomerDocument !== false,
    settings.showSignature !== false,
    settings.showQrCode === true,
    settings.showProductImagesQuote !== false,
    settings.showProductImagesOrder !== false,
    settings.showProjectAttachmentPreview !== false
  ].forEach((checked, index) => {
    const input = document.getElementById(`print-toggle-${index}`);
    if (input) input.checked = checked;
  });
  const preview = document.getElementById("print-settings-preview");
  if (preview) {
    const order = (state.orders || [])[0];
    preview.innerHTML = order ? printServiceOrder(order, { compact: true }) : `<div class="empty-state"><b>Nenhuma O.S. para previa.</b><span>Crie uma ordem de servico para validar o modelo impresso.</span></div>`;
  }
  if (form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const body = {
        companyId: state.currentCompanyId === "all" ? "" : state.currentCompanyId,
        logoUrl: document.getElementById("print-logo-url")?.value || "",
        headerImageUrl: document.getElementById("print-header-image-url")?.value || "",
        footerText: document.getElementById("print-footer-text")?.value || "",
        primaryColor: document.getElementById("print-primary-color")?.value || "#2563eb",
        secondaryColor: document.getElementById("print-secondary-color")?.value || "#f4e8fa",
        textColor: document.getElementById("print-text-color")?.value || "#202124",
        showAddress: document.getElementById("print-toggle-0")?.checked,
        showCnpj: document.getElementById("print-toggle-1")?.checked,
        showPhone: document.getElementById("print-toggle-2")?.checked,
        showSeller: document.getElementById("print-toggle-3")?.checked,
        showEmployeeContact: document.getElementById("print-toggle-4")?.checked,
        showCustomerDocument: document.getElementById("print-toggle-5")?.checked,
        showSignature: document.getElementById("print-toggle-6")?.checked,
        showQrCode: document.getElementById("print-toggle-7")?.checked,
        showProductImagesQuote: document.getElementById("print-toggle-8")?.checked,
        showProductImagesOrder: document.getElementById("print-toggle-9")?.checked,
        showProjectAttachmentPreview: document.getElementById("print-toggle-10")?.checked,
        defaultOrderModel: document.getElementById("print-order-model")?.value,
        defaultQuoteModel: document.getElementById("print-quote-model")?.value,
        defaultReportModel: document.getElementById("print-report-model")?.value
      };
      state.printSettings = await api("/api/print-settings", { method: "POST", body });
      renderPrintSettingsFocused();
      showToast("Configuracao de impressao salva.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

function renderCommunicationSettingsFocused() {
  const form = document.getElementById("communication-settings-form");
  if (!form) return;
  const settings = state.communicationSettings || {};
  const setValue = (id, value) => {
    const field = document.getElementById(id);
    if (field && document.activeElement !== field) field.value = value ?? "";
  };
  setValue("comm-enabled", settings.enabled === false ? "false" : "true");
  setValue("comm-whatsapp-mode", settings.whatsappMode || "manual_whatsapp_link");
  setValue("comm-company-whatsapp", settings.companyWhatsApp || "");
  setValue("comm-default-sender", settings.defaultSender || state.user?.name || "");
  setValue("comm-provider-name", settings.provider?.name || "");
  setValue("comm-provider-base-url", settings.provider?.baseUrl || "");
  setValue("comm-provider-token", settings.provider?.token || "");
  setValue("comm-webhook-secret", settings.provider?.webhookSecret || "");
  setValue("comm-footer", settings.footer || "");
  const events = settings.events || {};
  [
    ["comm-event-quote", events.quote !== false],
    ["comm-event-order", events.order !== false],
    ["comm-event-production", events.production !== false],
    ["comm-event-payment", events.payment !== false],
    ["comm-event-tracking", events.tracking !== false]
  ].forEach(([id, checked]) => {
    const input = document.getElementById(id);
    if (input) input.checked = checked;
  });
  const status = document.getElementById("communication-settings-status");
  if (status) {
    const apiReady = settings.whatsappMode === "api_provider" && settings.provider?.baseUrl && settings.provider?.token;
    status.innerHTML = detailPanel([
      ["Modo atual", settings.whatsappMode === "api_provider" ? "API externa" : "Manual por link"],
      ["Envio automatico", apiReady ? "Configurado" : "Nao configurado"],
      ["Fila pendente", (state.notifications?.queue || []).filter(item => ["pending", "prepared"].includes(item.status)).length],
      ["Ultima alteracao", settings.updatedAt ? formatDateTime(settings.updatedAt) : "-"]
    ], { configuracao: settings, apiPronta: apiReady }, "Ver detalhes da comunicacao");
  }
  if (form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const body = {
        companyId: state.currentCompanyId === "all" ? "" : state.currentCompanyId,
        enabled: document.getElementById("comm-enabled")?.value !== "false",
        whatsappMode: document.getElementById("comm-whatsapp-mode")?.value,
        companyWhatsApp: document.getElementById("comm-company-whatsapp")?.value,
        defaultSender: document.getElementById("comm-default-sender")?.value,
        footer: document.getElementById("comm-footer")?.value,
        events: {
          quote: document.getElementById("comm-event-quote")?.checked,
          order: document.getElementById("comm-event-order")?.checked,
          production: document.getElementById("comm-event-production")?.checked,
          payment: document.getElementById("comm-event-payment")?.checked,
          tracking: document.getElementById("comm-event-tracking")?.checked
        },
        provider: {
          name: document.getElementById("comm-provider-name")?.value,
          baseUrl: document.getElementById("comm-provider-base-url")?.value,
          token: document.getElementById("comm-provider-token")?.value,
          webhookSecret: document.getElementById("comm-webhook-secret")?.value
        }
      };
      state.communicationSettings = await api("/api/communication-settings", { method: "POST", body });
      renderCommunicationSettingsFocused();
      showToast("Configuracao de comunicacao salva.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

function renderNotificationCenter() {
  const summary = document.getElementById("notifications-summary");
  const table = document.getElementById("notifications-queue-table");
  const templates = document.getElementById("notifications-template-table");
  if (!summary && !table && !templates) return;
  const queue = state.notifications?.queue || [];
  if (summary) summary.innerHTML = [
    ["Pendentes", queue.filter(item => item.status === "pending").length],
    ["Enviadas", queue.filter(item => item.status === "sent").length],
    ["Falhas", queue.filter(item => item.status === "failed").length],
    ["Ignoradas", queue.filter(item => item.status === "skipped").length]
  ].map(([label, value]) => `<div class="focused-summary-item"><span>${label}</span><b>${value}</b></div>`).join("");
  if (table) {
    table.innerHTML = focusedOrderRows(queue.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), ["Data", "Evento", "Cliente", "Canal", "Status", "Acao"], item => {
      const customer = state.customers.find(customerItem => customerItem.id === item.customerId);
      return `<tr>
        <td>${formatDateTime(item.createdAt)}</td>
        <td><b>${friendlyNotificationEvent(item.event)}</b><small>${escapeHtml(item.subject || "")}</small></td>
        <td>${escapeHtml(customer?.name || item.recipient || "-")}</td>
        <td>${escapeHtml(item.channel || "-")}</td>
        <td><span class="status-pill ${notificationStatusClass(item.status)}">${friendlyNotificationStatus(item.status)}</span></td>
        <td class="table-actions">
          ${item.whatsappLink ? `<button type="button" data-notification-action="open-whatsapp" data-id="${item.id}">WhatsApp</button>` : ""}
          <button type="button" data-notification-action="copy-message" data-id="${item.id}">Copiar</button>
          ${item.quoteId ? `<button type="button" data-notification-action="view-quote" data-id="${item.id}">Orcamento</button>` : ""}
          ${item.orderId ? `<button type="button" data-notification-action="view-order" data-id="${item.id}">O.S.</button>` : ""}
          <button type="button" data-notification-action="manual-confirmed" data-id="${item.id}">Confirmar manual</button>
          <button type="button" data-notification-action="resend" data-id="${item.id}">Reenviar</button>
          <button type="button" data-notification-action="cancel" data-id="${item.id}">Cancelar</button>
        </td>
      </tr>`;
    }, "Nenhuma notificacao na fila.");
  }
  if (templates) {
    templates.innerHTML = focusedOrderRows(state.notifications?.templates || [], ["Evento", "Canal", "Assunto", "Mensagem"], template => `<tr><td><b>${friendlyNotificationEvent(template.event)}</b></td><td>${template.channel || "-"}</td><td>${escapeHtml(template.subject || template.name || "-")}</td><td>${escapeHtml(template.body || "")}</td></tr>`, "Nenhum template configurado.");
  }
}

function friendlyNotificationEvent(event = "") {
  const map = {
    "quote.created": "Orcamento criado",
    "quote.approved": "Orcamento aprovado",
    "service_order.created": "O.S. criada",
    "service_order.sent_to_production": "Enviada para producao",
    "production.started": "Producao iniciada",
    "production.paused": "Producao pausada",
    "production.resumed": "Producao retomada",
    "production.finished": "Producao finalizada",
    "production.homologated": "Producao homologada",
    "order.ready": "Pronta para entrega",
    "order.delivered": "Entregue",
    "order.cancelled": "O.S. cancelada",
    "rework.created": "Retrabalho registrado",
    "courtesy.created": "Cortesia registrada",
    "payment.pending": "Pagamento pendente",
    "payment.received": "Pagamento recebido"
  };
  return map[event] || event || "Atualizacao";
}

function friendlyNotificationStatus(status = "") {
  return ({ pending: "Pendente", prepared: "Preparada", sent: "Enviada", manual_confirmed: "Confirmada manualmente", failed: "Falhou", skipped: "Ignorada", cancelled: "Cancelada" }[status] || status || "Pendente");
}

function notificationStatusClass(status = "") {
  return ["sent", "manual_confirmed"].includes(status) ? "finance" : ["failed", "cancelled"].includes(status) ? "production" : status === "skipped" ? "muted" : "warning";
}

function enhanceContactForms() {
  const customerForm = document.getElementById("customer-form");
  if (customerForm && customerForm.dataset.contactEnhanced !== "true") {
    customerForm.dataset.contactEnhanced = "true";
    customerForm.insertAdjacentHTML("beforeend", `
      <div class="contact-extra-grid">
        <label>WhatsApp<input id="customer-whatsapp" placeholder="DDD + numero"></label>
        <label>Preferencia de comunicacao<select id="customer-communication-preference"><option value="both">WhatsApp e e-mail</option><option value="whatsapp">Somente WhatsApp</option><option value="email">Somente e-mail</option><option value="disabled">Nao enviar avisos</option></select></label>
        <label>Pessoa de contato<input id="customer-contact-person" placeholder="Responsavel pelo atendimento"></label>
      </div>
    `);
  }
  const employeeForm = document.getElementById("employee-form");
  if (employeeForm && employeeForm.dataset.profileEnhanced !== "true") {
    employeeForm.dataset.profileEnhanced = "true";
    employeeForm.insertAdjacentHTML("beforeend", `
      <div class="contact-extra-grid">
        <label>Foto / avatar<input id="employee-photo" placeholder="URL ou caminho da imagem"></label>
        <label>WhatsApp<input id="employee-whatsapp" placeholder="DDD + numero"></label>
        <label>Telefone pessoal<input id="employee-personal-phone"></label>
        <label>Telefone da empresa<input id="employee-company-phone"></label>
        <label>E-mail da empresa<input id="employee-company-email" type="email"></label>
        <label>Contato padrao<select id="employee-contact-preference"><option value="personal_whatsapp">WhatsApp pessoal</option><option value="company_whatsapp">WhatsApp da empresa</option><option value="personal_email">E-mail pessoal</option><option value="company_email">E-mail da empresa</option></select></label>
      </div>
    `);
  }
}

function renderExtendedFocusedSubpages() {
  renderPrintSettingsFocused();
  renderCommunicationSettingsFocused();
  renderNotificationCenter();
  enhanceContactForms();
  const noFiles = state.orders.filter(order => !(order.files || []).length);
  const productionFiles = document.getElementById("production-files-table");
  if (productionFiles) productionFiles.innerHTML = focusedOrderRows(noFiles, ["O.S.", "Cliente", "Trabalho", "Setor", "Prazo", "Acao"], order => `<tr><td><b>${order.id}</b></td><td>${order.customerName}</td><td>${order.jobName}</td><td>${order.currentSector || order.productionStatus || "-"}</td><td>${order.dueDate || "-"}</td><td><button class="primary" data-action="attach-order" data-order="${order.id}">Anexar</button></td></tr>`, "Nenhuma O.S. aguardando arquivo.");
  const checklistFiles = document.getElementById("production-checklist-files-table");
  if (checklistFiles) checklistFiles.innerHTML = focusedOrderRows(state.orders.filter(order => (order.files || []).length || (order.productionFiles || []).length || !(order.files || []).length), ["O.S.", "Cliente", "Setor", "Arquivos", "Situacao", "Acao"], order => {
    const files = [...(order.files || []), ...(order.productionFiles || []).map(file => file.name || file)].filter(Boolean);
    return `<tr><td><b>${order.id}</b></td><td>${order.customerName}</td><td>${order.currentSectorName || order.currentSector || order.productionStatus || "-"}</td><td>${files.length ? files.map(file => `<small>${escapeHtml(file)}</small>`).join("") : "<small>Nenhum anexo</small>"}</td><td><span class="status-pill ${files.length ? "finance" : "production"}">${files.length ? "Disponivel" : "Pendente"}</span></td><td><button class="primary" data-action="attach-order" data-order="${order.id}">Anexar</button></td></tr>`;
  }, "Nenhuma O.S. disponivel para checklist.");

  const productionReport = document.getElementById("reports-production-table");
  if (productionReport) productionReport.innerHTML = focusedOrderRows(state.filteredProductionOrders || state.productionQuery?.rows || state.orders, ["O.S.", "Cliente / loja", "Setor", "Responsavel", "Prazo", "Status"], order => `<tr><td><b>${order.id}</b></td><td>${order.customerName}<small>${order.companyName || state.currentCompanyName || "Loja atual"}</small></td><td>${order.currentSectorName || order.currentSector || order.productionStatus || "-"}</td><td>${order.currentResponsible || order.responsible || "Definir"}</td><td>${order.dueDate || "-"}<small>${order.timeRemainingLabel || ""}</small></td><td><span class="status-pill production">${order.productionStatus || "-"}</span></td></tr>`, "Nenhuma O.S. para o relatorio de producao.");

  const financeReport = document.getElementById("reports-finance-summary");
  if (financeReport) financeReport.innerHTML = [
    ["Recebido", money.format(state.cashReport?.receivedTotal || 0)],
    ["A receber", money.format(state.financeData?.dashboard?.receivableTotal || state.dashboard?.pendingReceivables || 0)],
    ["Despesas", money.format(state.cashReport?.expensesTotal || 0)],
    ["Saldo de caixa", money.format(state.cashReport?.finalBalance || 0)],
    ["Resultado DRE", money.format(state.dre?.result || 0)]
  ].map(([label, value]) => `<div class="focused-summary-item"><span>${label}</span><b>${value}</b></div>`).join("");

  const orderReport = document.getElementById("reports-orders-table");
  if (orderReport) orderReport.innerHTML = focusedOrderRows(state.orders, ["O.S.", "Cliente", "Valor", "Financeiro", "Producao", "Prazo"], order => `<tr><td><b>${order.id}</b></td><td>${order.customerName}</td><td>${money.format(order.total || 0)}</td><td>${order.financialStatus || "-"}</td><td>${order.productionStatus || "-"}</td><td>${order.dueDate || "-"}</td></tr>`, "Nenhuma O.S. cadastrada.");

  const stockReport = document.getElementById("reports-stock-table");
  const stockMovement = document.getElementById("stock-movements-tools");
  const stockHtml = focusedOrderRows(state.materials, ["Material", "Unidade", "Estoque", "Minimo", "Custo", "Situacao"], material => `<tr><td><b>${material.name}</b></td><td>${material.unit}</td><td>${material.stock}</td><td>${material.minStock}</td><td>${money.format(material.cost || 0)}</td><td><span class="status-pill ${Number(material.stock) <= Number(material.minStock) ? "production" : "finance"}">${Number(material.stock) <= Number(material.minStock) ? "Critico" : "Disponivel"}</span></td></tr>`, "Nenhum material cadastrado.");
  if (stockReport) stockReport.innerHTML = stockHtml;
  if (stockMovement) {
    stockMovement.innerHTML = stockMovementPanel();
    bindStockMovementEvents();
  }

  const users = document.getElementById("settings-users-tools");
  if (users && !document.getElementById("settings-users-list")) {
    users.insertAdjacentHTML("afterbegin", `<section class="panel focused-function-card"><h2>Usuarios</h2><div id="settings-users-list"></div></section>`);
  }
  const usersList = document.getElementById("settings-users-list");
  if (usersList) usersList.innerHTML = focusedOrderRows(state.users || [], ["Nome", "E-mail", "Perfil", "Setor", "Status"], user => `<tr><td><b>${user.name}</b></td><td>${user.email || "-"}</td><td>${user.profile || user.role || "-"}</td><td>${user.sector || "-"}</td><td>${user.active === false ? "Inativo" : "Ativo"}</td></tr>`, "Nenhum usuario cadastrado.");

  document.querySelectorAll(".focused-operational-view [data-view]").forEach(button => {
    if (button.dataset.focusedBound === "true") return;
    button.dataset.focusedBound = "true";
    button.addEventListener("click", () => view(button.dataset.view, button));
  });
}

async function initApp() {
  ensureLoginScreen();
  try {
    const status = await api("/api/auth/status");
    if (!status.authenticated) {
      showLogin();
      return;
    }
    await loadAll();
    hideLogin();
    const target = location.hash.replace("#", "") || "dashboard";
    if (document.getElementById(target)) view(target);
  } catch (error) {
    if (error.message !== "Login necessario") console.error(error);
    showLogin();
  }
}

initApp();
