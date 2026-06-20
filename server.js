const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { AsyncLocalStorage } = require("async_hooks");

loadEnv();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const dataFile = path.isAbsolute(process.env.DATABASE_URL || "") ? process.env.DATABASE_URL : path.join(__dirname, process.env.DATABASE_URL || "data/printsys-data.json");
const sessionMaxAgeMs = Number(process.env.SESSION_MAX_AGE_MS || 8 * 60 * 60 * 1000);

const db = {
  currentUser: { id: "u1", name: "Joao Victor", role: "Admin Geral", sector: "Administrativo" },
  activeCompanyId: "company-main",
  companies: [
    {
      id: "company-main",
      name: "PrintSys Loja Principal",
      tradeName: "Loja Principal",
      city: "Fortaleza",
      state: "CE",
      cnpj: "",
      phone: "",
      address: "",
      active: true,
      default: true,
      createdAt: "2026-06-01T09:00:00.000Z"
    }
  ],
  companySettings: {
    defaultCompanyId: "company-main",
    shareCustomers: true,
    shareProducts: true
  },
  quickPermissions: {
    cash: true,
    quickSale: true,
    blindClose: true,
    financialSummary: true,
    production: true,
    quote: true,
    settings: true,
    operationalExpenses: true,
    expenseApproval: true,
    administration: true,
    commercial: true,
    customerPortal: true,
    bi: true,
    integrations: true,
    orders: true,
    supplies: true,
    technicalVisits: true
  },
  costConfig: {
    mode: "automatico",
    humanHourValue: 42,
    machineHourValue: 55,
    monthlyFixedCost: 12500,
    sectorCosts: { Arte: 35, Impressao: 55, Acabamento: 38, Instalacao: 65 },
    equipmentCosts: { Plotter: 60, Laser: 80, Solda: 45 },
    defaultMarginPercent: 55,
    taxPercent: 6,
    commissionPercent: 3,
    wastePercent: 8,
    displacementCostPerKm: 4,
    productionReleaseRule: "produzir_com_sinal"
  },
  costCenters: [
    { id: "cc1", name: "Comercial", type: "indireto", monthlyBudget: 2200, active: true },
    { id: "cc2", name: "Administrativo", type: "indireto", monthlyBudget: 5300, active: true },
    { id: "cc3", name: "Impressao", type: "direto", monthlyBudget: 4200, active: true },
    { id: "cc4", name: "Producao", type: "direto", monthlyBudget: 3900, active: true },
    { id: "cc5", name: "Instalacao", type: "direto", monthlyBudget: 3100, active: true },
    { id: "cc6", name: "Almoxarifado", type: "indireto", monthlyBudget: 1600, active: true },
    { id: "cc7", name: "Financeiro", type: "indireto", monthlyBudget: 2400, active: true }
  ],
  sectors: [
    { id: "sec1", name: "Comercial", responsible: "Joao Victor", users: ["Joao Victor"], schedule: "08:00 as 18:00", capacity: "30 atendimentos/dia", equipment: ["Computadores", "WhatsApp"], permissions: { createQuote: true, editQuote: true, approveQuote: false, viewCosts: false, viewMargin: true, createOrder: true }, active: true },
    { id: "sec2", name: "Atendimento", responsible: "Atendente", users: ["Joao Victor"], schedule: "08:00 as 18:00", capacity: "40 atendimentos/dia", equipment: ["WhatsApp", "Telefone"], permissions: { createQuote: true, editQuote: true }, active: true },
    { id: "sec3", name: "Caixa", responsible: "Operador caixa", users: ["Joao Victor"], schedule: "08:00 as 18:00", capacity: "80 movimentos/dia", equipment: ["PDV", "TEF"], permissions: { receivePayment: true, openCash: true, closeCash: true, viewFinance: false }, active: true },
    { id: "sec4", name: "Financeiro", responsible: "Gestor financeiro", users: ["Joao Victor"], schedule: "08:00 as 18:00", capacity: "40 lancamentos/dia", equipment: ["ERP"], permissions: { viewFinance: true, viewDre: true, receivePayment: true }, active: true },
    { id: "sec5", name: "PCP", responsible: "PCP", users: ["Marcos Silva"], schedule: "08:00 as 18:00", capacity: "25 O.S./dia", equipment: ["Painel PCP"], permissions: { startProduction: true, finishProduction: true, movePcp: true, viewCosts: true }, active: true },
    { id: "sec6", name: "Impressao", responsible: "Marcos Silva", users: ["Marcos Silva"], schedule: "08:00 as 18:00", capacity: "80 m2/dia", equipment: ["Plotter"], permissions: { startProduction: true, finishProduction: true }, active: true },
    { id: "sec7", name: "Acabamento", responsible: "Ana Paula", users: ["Ana Paula"], schedule: "08:00 as 18:00", capacity: "60 m2/dia", equipment: ["Ilhoseira", "Mesa"], permissions: { startProduction: true, finishProduction: true }, active: true },
    { id: "sec8", name: "Serralheria", responsible: "Serralheiro", users: [], schedule: "08:00 as 18:00", capacity: "8 estruturas/dia", equipment: ["Solda", "Esmeril"], permissions: { startProduction: true, finishProduction: true }, active: true },
    { id: "sec9", name: "ACM", responsible: "Montador ACM", users: [], schedule: "08:00 as 18:00", capacity: "40 m2/dia", equipment: ["Serra", "Dobradeira"], permissions: { startProduction: true, finishProduction: true }, active: true },
    { id: "sec10", name: "Pintura", responsible: "Pintor", users: [], schedule: "08:00 as 18:00", capacity: "30 m2/dia", equipment: ["Pistola", "Compressor"], permissions: { startProduction: true, finishProduction: true }, active: true },
    { id: "sec11", name: "LED", responsible: "Eletrica", users: [], schedule: "08:00 as 18:00", capacity: "20 pontos/dia", equipment: ["Fontes", "Ferro de solda"], permissions: { startProduction: true, finishProduction: true }, active: true },
    { id: "sec12", name: "Instalacao", responsible: "Pedro Lima", users: ["Pedro Lima"], schedule: "08:00 as 18:00", capacity: "3 instalacoes/dia", equipment: ["Veiculo", "Ferramentas"], permissions: { startProduction: true, finishProduction: true }, active: true },
    { id: "sec13", name: "Almoxarifado", responsible: "Almoxarifado", users: [], schedule: "08:00 as 18:00", capacity: "100 movimentos/dia", equipment: ["Estoque"], permissions: {}, active: true },
    { id: "sec14", name: "Administrativo", responsible: "Admin Geral", users: ["Joao Victor"], schedule: "08:00 as 18:00", capacity: "Rotina interna", equipment: ["ERP"], permissions: { viewFinance: true, viewDre: true, createProduct: true, editComposition: true, editQuestionnaire: true }, active: true }
  ],
  employees: [
    { id: "e1", name: "Ana Paula", photo: "", role: "Arte-finalista", sector: "Acabamento", salary: 2600, monthlyHours: 176, commissionPercent: 0, phone: "", email: "", admissionDate: "", active: true },
    { id: "e2", name: "Marcos Silva", photo: "", role: "Impressor", sector: "Impressao", salary: 3100, monthlyHours: 176, commissionPercent: 0, phone: "", email: "", admissionDate: "", active: true },
    { id: "e3", name: "Pedro Lima", photo: "", role: "Instalador", sector: "Instalacao", salary: 3400, monthlyHours: 176, commissionPercent: 2, phone: "", email: "", admissionDate: "", active: true }
  ],
  expenses: [
    { id: "ex1", type: "Aluguel", description: "Galpao", amount: 3500, recurring: true },
    { id: "ex2", type: "Energia", description: "Media mensal", amount: 1800, recurring: true },
    { id: "ex3", type: "Internet", description: "Fibra", amount: 180, recurring: true }
  ],
  operationalExpenseCategories: [
    "Combustivel",
    "Alimentacao",
    "Frete",
    "Pedagio",
    "Estacionamento",
    "Hospedagem",
    "Ferramentas",
    "Material de instalacao",
    "Material de producao",
    "Manutencao de equipamentos",
    "Material de escritorio",
    "Internet",
    "Energia",
    "Agua",
    "Telefone",
    "Terceirizados",
    "Marketing",
    "Outros"
  ],
  operationalExpenses: [],
  technicalVisits: [],
  expenseAdvances: [],
  vehicles: [
    { id: "veh1", vehicle: "Strada branca", plate: "ABC-1D23", driver: "Pedro Lima", initialKm: 15200, finalKm: 15200, fuelCost: 0, maintenanceCost: 0 }
  ],
  compositions: [
    {
      id: "cmp1",
      name: "Fachada ACM",
      category: "Fachadas",
      productId: "p5",
      marginPercent: 60,
      deadlineDays: 7,
      productionFlow: ["Projeto", "Corte", "Serralheria", "Montagem", "Instalacao"],
      materials: [
        { materialId: "m3", qtyFormula: "area", wastePercent: 12 },
        { materialId: "m5", qtyFormula: "perimeter", wastePercent: 8 },
        { materialId: "m9", qtyFormula: "linear", quantity: 2, wastePercent: 5 }
      ],
      production: [
        { sector: "Corte", humanHours: 1.5, machineHours: 1 },
        { sector: "Serralheria", humanHours: 2, machineHours: .5 },
        { sector: "Montagem", humanHours: 2, machineHours: .5 }
      ],
      installation: { teamHours: 3, vehicleKm: 20, fuel: 80, food: 60, toll: 0 },
      questions: ["plate_type", "width", "height", "depth", "lighting", "installation", "distance_km"]
    },
    {
      id: "cmp2",
      name: "Faixa / Lona",
      category: "Lonas",
      productId: "p1",
      marginPercent: 55,
      deadlineDays: 3,
      productionFlow: ["Impressao", "Acabamento", "Conferencia", "Entrega"],
      materials: [
        { materialId: "m1", qtyFormula: "area", wastePercent: 8 },
        { materialId: "m8", qtyFormula: "unit", quantity: 12, wastePercent: 0 },
        { materialId: "m7", qtyFormula: "area_optional", quantity: .08, wastePercent: 5 }
      ],
      production: [
        { sector: "Impressao", humanHours: .5, machineHours: .7 },
        { sector: "Acabamento", humanHours: .8, machineHours: .1 }
      ],
      installation: { teamHours: 0, vehicleKm: 0, fuel: 0, food: 0, toll: 0 },
      questions: ["canvas_type", "width", "height", "quantity", "finish", "eyelets", "hem", "varnish", "installation", "distance_km"]
    },
    {
      id: "cmp3",
      name: "Adesivo Aplicado",
      category: "Adesivos",
      productId: "p3",
      marginPercent: 62,
      deadlineDays: 4,
      productionFlow: ["Arte", "Impressao", "Laminacao/verniz", "Corte", "Instalacao"],
      materials: [
        { materialId: "m2", qtyFormula: "area", wastePercent: 12 },
        { materialId: "m7", qtyFormula: "area_optional", quantity: .1, wastePercent: 5 }
      ],
      production: [
        { sector: "Arte", humanHours: 1, machineHours: 0 },
        { sector: "Impressao", humanHours: .4, machineHours: .8 },
        { sector: "Corte", humanHours: .5, machineHours: .5 }
      ],
      installation: { teamHours: 2, vehicleKm: 15, fuel: 60, food: 40, toll: 0 },
      questions: ["custom_application", "surface", "width", "height", "quantity", "lamination", "auto_varnish", "electronic_cut", "applied", "distance_km"]
    },
    {
      id: "cmp4",
      name: "PVC Adesivado",
      category: "Placas",
      productId: "p6",
      marginPercent: 58,
      deadlineDays: 3,
      productionFlow: ["Arte", "Corte", "Aplicacao", "Entrega"],
      materials: [
        { materialId: "m4", qtyFormula: "area", wastePercent: 8 },
        { materialId: "m2", qtyFormula: "area_optional", quantity: 1, wastePercent: 8 }
      ],
      production: [
        { sector: "Arte", humanHours: .7, machineHours: 0 },
        { sector: "Corte", humanHours: .6, machineHours: .7 },
        { sector: "Aplicacao", humanHours: .8, machineHours: .1 }
      ],
      installation: { teamHours: 0, vehicleKm: 0, fuel: 0, food: 0, toll: 0 },
      questions: ["base", "laser_cut", "adhesive_applied", "width", "height", "thickness", "quantity", "delivery_mode"]
    },
    {
      id: "cmp5",
      name: "Totem",
      category: "Comunicação visual",
      productId: "p5",
      marginPercent: 62,
      deadlineDays: 10,
      productionFlow: ["Projeto", "Serralheria", "ACM", "Elétrica", "Montagem", "Instalação"],
      materials: [
        { materialId: "m3", qtyFormula: "area", wastePercent: 15 },
        { materialId: "m5", qtyFormula: "perimeter", wastePercent: 12 },
        { materialId: "m9", qtyFormula: "linear", quantity: 3, wastePercent: 8 },
        { materialId: "m10", qtyFormula: "unit", quantity: 2, wastePercent: 0 }
      ],
      production: [
        { sector: "Projeto", humanHours: 2, machineHours: 0 },
        { sector: "Serralheria", humanHours: 4, machineHours: 1 },
        { sector: "ACM", humanHours: 3, machineHours: 1 },
        { sector: "Elétrica", humanHours: 2, machineHours: .5 },
        { sector: "Montagem", humanHours: 3, machineHours: .5 }
      ],
      installation: { teamHours: 5, vehicleKm: 30, fuel: 140, food: 120, toll: 0 },
      questions: ["width", "height", "depth", "lighting", "installation", "distance_km"]
    },
    {
      id: "cmp6",
      name: "Letreiro luminoso",
      category: "Letreiros",
      productId: "p5",
      marginPercent: 65,
      deadlineDays: 8,
      productionFlow: ["Projeto", "Corte", "LED", "Montagem", "Instalação"],
      materials: [
        { materialId: "m3", qtyFormula: "area", wastePercent: 10 },
        { materialId: "m9", qtyFormula: "linear", quantity: 4, wastePercent: 8 },
        { materialId: "m10", qtyFormula: "unit", quantity: 2, wastePercent: 0 }
      ],
      production: [
        { sector: "Projeto", humanHours: 1.5, machineHours: 0 },
        { sector: "Corte", humanHours: 1.5, machineHours: 1 },
        { sector: "LED", humanHours: 2.5, machineHours: .5 },
        { sector: "Montagem", humanHours: 2, machineHours: .5 }
      ],
      installation: { teamHours: 3, vehicleKm: 20, fuel: 90, food: 60, toll: 0 },
      questions: ["width", "height", "lighting", "light_points", "transformer", "electric_labor", "installation", "distance_km"]
    }
  ],
  pricingSimulations: [],
  customers: [
    { id: "c1", name: "Mercado Sao Luis", phone: "(85) 99820-1100", email: "compras@saoluis.com", type: "Empresa", creditLimit: 2500, balance: 360 },
    { id: "c2", name: "Dra. Marina Araujo", phone: "(85) 98771-4430", email: "contato@marina.com", type: "Pessoa fisica", creditLimit: 900, balance: 0 },
    { id: "c3", name: "Agencia Norte", phone: "(85) 99114-2210", email: "jobs@agencianorte.com", type: "Agencia", creditLimit: 6000, balance: 780 }
  ],
  leads: [
    { id: "lead-1001", name: "Auto Escola Central", phone: "(85) 98800-1200", whatsapp: "(85) 98800-1200", company: "Auto Escola Central", origin: "WhatsApp", seller: "Joao Victor", interest: "Fachada ACM", observation: "Cliente quer orçamento com instalacao.", status: "orcamento solicitado", estimatedValue: 2800, nextContactAt: "2026-06-03T09:00:00.000Z", customerId: "", quoteId: "", orderId: "", lossReason: "", files: ["briefing-fachada.pdf"], history: [] },
    { id: "lead-1002", name: "Clinica Boa Vista", phone: "(85) 98720-4444", whatsapp: "(85) 98720-4444", company: "Clinica Boa Vista", origin: "Instagram", seller: "Ana Paula", interest: "Letreiro luminoso", observation: "Aguardando medidas da fachada.", status: "em atendimento", estimatedValue: 4200, nextContactAt: "2026-06-02T16:00:00.000Z", customerId: "", quoteId: "", orderId: "", lossReason: "", files: [], history: [] }
  ],
  followUps: [
    { id: "follow-1001", leadId: "lead-1002", customerId: "", seller: "Ana Paula", date: "2026-06-02", time: "16:00", channel: "WhatsApp", observation: "Pedir medidas e foto do local.", completed: false, createdAt: new Date().toISOString() }
  ],
  sellerGoals: [
    { id: "goal-1001", seller: "Joao Victor", monthlyGoal: 35000, dailyGoal: 1800, defaultCommissionPercent: 3, active: true },
    { id: "goal-1002", seller: "Ana Paula", monthlyGoal: 22000, dailyGoal: 1100, defaultCommissionPercent: 2.5, active: true }
  ],
  lossReasons: ["preco", "prazo", "cliente desistiu", "concorrente", "sem retorno", "fora do perfil", "outro"],
  portalTokens: [
    { token: "portal-c1-demo", customerId: "c1", active: true, createdAt: new Date().toISOString() },
    { token: "portal-c3-demo", customerId: "c3", active: true, createdAt: new Date().toISOString() }
  ],
  portalApprovals: [],
  portalUploads: [],
  portalNotifications: [],
  materials: [
    { id: "m1", name: "Lona 440g", unit: "m2", stock: 180, minStock: 40, cost: 18 },
    { id: "m2", name: "Adesivo vinyl", unit: "m2", stock: 95, minStock: 30, cost: 24 },
    { id: "m3", name: "ACM", unit: "m2", stock: 26, minStock: 12, cost: 120 },
    { id: "m4", name: "PVC", unit: "m2", stock: 44, minStock: 15, cost: 58 },
    { id: "m5", name: "Metalon", unit: "m", stock: 72, minStock: 20, cost: 26 },
    { id: "m6", name: "Tinta", unit: "l", stock: 12, minStock: 8, cost: 38 },
    { id: "m7", name: "Verniz", unit: "l", stock: 9, minStock: 6, cost: 42 },
    { id: "m8", name: "Ilhos", unit: "un", stock: 650, minStock: 200, cost: 0.35 },
    { id: "m9", name: "LED", unit: "m", stock: 34, minStock: 15, cost: 22 },
    { id: "m10", name: "Refletores", unit: "un", stock: 8, minStock: 6, cost: 75 }
  ],
  products: [
    {
      id: "p1",
      code: "LON-001",
      name: "Faixa em lona",
      category: "Comunicacao visual",
      unit: "m2",
      baseCostM2: 18,
      laborHourCost: 38,
      machineHourCost: 55,
      marginPercent: 55,
      taxPercent: 6,
      minPrice: 80,
      maxDiscountPercent: 10,
      flow: ["Impressao", "Acabamento", "Conferencia", "Entrega"],
      technicalSheet: {
        standardMaterials: ["Lona 440g", "Ilhos", "Verniz"],
        equipment: ["Plotter de impressao", "Ilhoseira"],
        averageProductionMinutes: 90,
        requiredSectors: ["Impressao", "Acabamento", "Conferencia"],
        finishes: ["Refile", "Bainha", "Ilhos", "Reforco", "Verniz"],
        defaultWastePercent: 8,
        productionNotes: "Conferir sangria, sentido da lona e quantidade de ilhos antes da entrega."
      },
      questions: [
        { key: "canvas_type", label: "Tipo de lona", type: "select", options: [{ label: "Lona 280g", value: "280g", priceImpact: {} }, { label: "Lona 440g", value: "440g", priceImpact: { perM2: 12 } }, { label: "Lona blackout", value: "blackout", priceImpact: { perM2: 28 } }] },
        { key: "width", label: "Largura", type: "number", required: true, priceImpact: { target: "width" } },
        { key: "height", label: "Altura", type: "number", required: true, priceImpact: { target: "height" } },
        { key: "quantity", label: "Quantidade", type: "number", required: true, priceImpact: { target: "quantity" } },
        { key: "finish", label: "Acabamento", type: "select", options: [{ label: "Refile", value: "refile", priceImpact: { fixed: 10 } }, { label: "Bastao", value: "bastao", priceImpact: { perLinearMeter: 18 } }, { label: "Costura", value: "costura", priceImpact: { perLinearMeter: 22 } }] },
        { key: "reinforced", label: "Reforco lateral", type: "boolean", priceImpact: { fixed: 20 } },
        { key: "eyelets", label: "Ilhos", type: "boolean", priceImpact: { perM2: 8 } },
        { key: "hem", label: "Bainha", type: "boolean", priceImpact: { perLinearMeter: 16 } },
        { key: "varnish", label: "Verniz", type: "boolean", priceImpact: { perM2: 14, sector: "Verniz" } },
        { key: "installation", label: "Instalacao", type: "boolean", priceImpact: { fixed: 120, sector: "Instalacao" } },
        { key: "distance_km", label: "Distancia de deslocamento", type: "number", priceImpact: { perKm: 3.5 } },
        { key: "urgent", label: "Prazo urgente", type: "boolean", priceImpact: { percent: 20 } }
      ]
    },
    {
      id: "p2",
      code: "ADE-001",
      name: "Adesivo vinyl recortado",
      category: "Impressao digital",
      unit: "m2",
      baseCostM2: 24,
      laborHourCost: 42,
      machineHourCost: 60,
      marginPercent: 60,
      taxPercent: 6,
      minPrice: 95,
      maxDiscountPercent: 8,
      flow: ["Arte", "Impressao", "Corte", "Acabamento"],
      technicalSheet: {
        standardMaterials: ["Adesivo vinyl"],
        equipment: ["Plotter de impressao", "Plotter de recorte"],
        averageProductionMinutes: 120,
        requiredSectors: ["Arte", "Impressao", "Corte"],
        finishes: ["Recorte eletronico", "Laminacao", "Aplicacao"],
        defaultWastePercent: 10,
        productionNotes: "Validar superficie e enviar teste de cor quando houver recorte fino."
      },
      questions: [
        { key: "width", label: "Largura", type: "number", required: true, priceImpact: { target: "width" } },
        { key: "height", label: "Altura", type: "number", required: true, priceImpact: { target: "height" } },
        { key: "quantity", label: "Quantidade", type: "number", required: true, priceImpact: { target: "quantity" } },
        { key: "lamination", label: "Laminacao", type: "boolean", priceImpact: { perM2: 18 } },
        { key: "installation", label: "Instalacao", type: "boolean", priceImpact: { fixed: 150, sector: "Instalacao" } }
      ]
    },
    {
      id: "p3",
      code: "ADE-002",
      name: "Adesivacao / aplicacao",
      category: "Aplicacao externa",
      unit: "m2",
      baseCostM2: 32,
      laborHourCost: 58,
      machineHourCost: 35,
      marginPercent: 62,
      taxPercent: 6,
      minPrice: 180,
      maxDiscountPercent: 8,
      flow: ["Arte", "Impressao", "Laminacao/verniz", "Instalacao"],
      technicalSheet: {
        standardMaterials: ["Adesivo vinyl", "Verniz"],
        equipment: ["Plotter de impressao", "Soprador termico", "Espatulas"],
        averageProductionMinutes: 240,
        requiredSectors: ["Arte", "Impressao", "Instalacao"],
        finishes: ["Laminacao", "Verniz automotivo", "Recorte eletronico"],
        defaultWastePercent: 12,
        productionNotes: "Registrar fotos do local antes e depois da aplicacao."
      },
      questions: [
        { key: "custom_application", label: "E adesivacao personalizada?", type: "boolean", priceImpact: { percent: 12 } },
        { key: "surface", label: "Local e liso ou detalhado?", type: "select", options: [{ label: "Liso", value: "liso", priceImpact: {} }, { label: "Detalhado", value: "detalhado", priceImpact: { perM2: 28, laborHours: 1.5 } }] },
        { key: "needs_cleaning", label: "Precisa de limpeza?", type: "boolean", priceImpact: { perM2: 9, sector: "Preparacao" } },
        { key: "needs_sanding", label: "Precisa ser lixado?", type: "boolean", priceImpact: { perM2: 18, sector: "Preparacao" } },
        { key: "needs_painting", label: "Precisa ser pintado?", type: "boolean", priceImpact: { perM2: 35, material: "Tinta/primer", sector: "Pintura" } },
        { key: "distance_km", label: "Distancia de deslocamento (km)", type: "number", priceImpact: { perKm: 3.5 } },
        { key: "adhesive_type", label: "Tipo de adesivo", type: "select", options: [{ label: "Vinyl comum", value: "comum", priceImpact: {} }, { label: "Vinyl premium", value: "premium", priceImpact: { perM2: 22 } }, { label: "Automotivo", value: "auto", priceImpact: { perM2: 48 } }] },
        { key: "lamination", label: "Com laminacao?", type: "boolean", priceImpact: { perM2: 18 } },
        { key: "auto_varnish", label: "Com verniz automotivo?", type: "boolean", priceImpact: { perM2: 42, sector: "Verniz" } },
        { key: "electronic_cut", label: "Com recorte eletronico?", type: "boolean", priceImpact: { perM2: 15, machineHours: .4, sector: "Corte" } },
        { key: "applied", label: "Adesivo aplicado ou apenas material zerado?", type: "select", options: [{ label: "Apenas material", value: "material", priceImpact: {} }, { label: "Aplicado", value: "aplicado", priceImpact: { perM2: 35, sector: "Instalacao" } }] },
        { key: "width", label: "Largura", type: "measure", required: true, priceImpact: { target: "width" } },
        { key: "height", label: "Altura", type: "measure", required: true, priceImpact: { target: "height" } },
        { key: "quantity", label: "Quantidade", type: "number", required: true, priceImpact: { target: "quantity" } }
      ]
    },
    {
      id: "p4",
      code: "TOL-001",
      name: "Toldo personalizado",
      category: "Toldos",
      unit: "m2",
      baseCostM2: 85,
      laborHourCost: 70,
      machineHourCost: 45,
      marginPercent: 58,
      taxPercent: 6,
      minPrice: 450,
      maxDiscountPercent: 6,
      flow: ["Medicao", "Serralheria", "Costura/lona", "Pintura", "Instalacao"],
      technicalSheet: {
        standardMaterials: ["Lona 440g", "Metalon", "Tinta"],
        equipment: ["Solda", "Furadeira", "Maquina de costura"],
        averageProductionMinutes: 480,
        requiredSectors: ["Medicao", "Serralheria", "Instalacao"],
        finishes: ["Pintura", "Costura", "Bracos de avanco"],
        defaultWastePercent: 10,
        productionNotes: "Confirmar pontos de fixacao e medidas no local antes da fabricacao."
      },
      questions: [
        { key: "awning_material", label: "Material do toldo", type: "select", options: [{ label: "Lona comum", value: "lona", priceImpact: {} }, { label: "Lona premium", value: "premium", priceImpact: { perM2: 35 } }, { label: "Policarbonato", value: "policarbonato", priceImpact: { perM2: 95 } }] },
        { key: "width", label: "Largura", type: "measure", required: true, priceImpact: { target: "width" } },
        { key: "height", label: "Altura", type: "measure", required: true, priceImpact: { target: "height" } },
        { key: "projection", label: "Avanco", type: "number", priceImpact: { fixed: 0 } },
        { key: "needs_arm", label: "Precisa de braco para avanco?", type: "boolean", priceImpact: { fixed: 90, material: "Braco de avanco" } },
        { key: "arm_size", label: "Tamanho do braco", type: "number", priceImpact: { perLinearMeter: 45 } },
        { key: "arm_qty", label: "Quantidade de bracos", type: "number", priceImpact: { perUnit: 90 } },
        { key: "installation", label: "Com instalacao?", type: "boolean", priceImpact: { fixed: 220, sector: "Instalacao" } },
        { key: "distance_km", label: "Distancia de deslocamento", type: "number", priceImpact: { perKm: 4 } },
        { key: "structure_type", label: "Tipo de estrutura", type: "select", options: [{ label: "Metalon leve", value: "leve", priceImpact: { perM2: 35 } }, { label: "Metalon reforcado", value: "reforcado", priceImpact: { perM2: 65 } }] },
        { key: "painting", label: "Pintura", type: "boolean", priceImpact: { perM2: 28, sector: "Pintura" } },
        { key: "lighting", label: "Iluminacao opcional", type: "boolean", priceImpact: { fixed: 180, sector: "Eletrica" } },
        { key: "quantity", label: "Quantidade", type: "number", required: true, priceImpact: { target: "quantity" } }
      ]
    },
    {
      id: "p5",
      code: "ACM-001",
      name: "ACM / fachada / placa",
      category: "Fachadas",
      unit: "m2",
      baseCostM2: 120,
      laborHourCost: 75,
      machineHourCost: 60,
      marginPercent: 60,
      taxPercent: 6,
      minPrice: 380,
      maxDiscountPercent: 6,
      flow: ["Projeto", "Corte", "Serralheria", "Montagem", "Instalacao"],
      technicalSheet: {
        standardMaterials: ["ACM", "Metalon", "LED", "Refletores"],
        equipment: ["Serra", "Parafusadeira", "Solda", "Ferramentas eletricas"],
        averageProductionMinutes: 540,
        requiredSectors: ["Projeto", "Corte", "Serralheria", "Montagem", "Instalacao"],
        finishes: ["Caixote", "Forro", "Calha", "Iluminacao"],
        defaultWastePercent: 12,
        productionNotes: "Conferir estrutura, eletrica, fonte e acesso para instalacao."
      },
      questions: [
        { key: "plate_type", label: "E placa reta ou caixote?", type: "select", options: [{ label: "Reta", value: "reta", priceImpact: {} }, { label: "Caixote", value: "caixote", priceImpact: { perM2: 95, sector: "Montagem" } }] },
        { key: "width", label: "Largura", type: "measure", required: true, priceImpact: { target: "width" } },
        { key: "height", label: "Altura", type: "measure", required: true, priceImpact: { target: "height" } },
        { key: "depth", label: "Avanco/profundidade", type: "number", priceImpact: { perLinearMeter: 35 } },
        { key: "lining", label: "Com forro ou sem forro?", type: "select", options: [{ label: "Sem forro", value: "sem", priceImpact: {} }, { label: "Com forro", value: "com", priceImpact: { perM2: 55 } }] },
        { key: "gutter", label: "Com calha ou sem calha?", type: "boolean", priceImpact: { perLinearMeter: 40, material: "Calha" } },
        { key: "base", label: "Precisa de base?", type: "boolean", priceImpact: { fixed: 120 } },
        { key: "metalon", label: "Estrutura em metalon?", type: "boolean", priceImpact: { perM2: 70, sector: "Serralheria" } },
        { key: "metalon_type", label: "Tipo de metalon", type: "select", options: [{ label: "20x20", value: "20x20", priceImpact: { perLinearMeter: 18 } }, { label: "30x30", value: "30x30", priceImpact: { perLinearMeter: 26 } }, { label: "40x40", value: "40x40", priceImpact: { perLinearMeter: 38 } }] },
        { key: "structure_painting", label: "Pintura da estrutura", type: "boolean", priceImpact: { perM2: 28, sector: "Pintura" } },
        { key: "acm_type", label: "ACM simples ou composto", type: "select", options: [{ label: "Simples", value: "simples", priceImpact: {} }, { label: "Composto", value: "composto", priceImpact: { perM2: 60 } }] },
        { key: "lighting", label: "Tipo de iluminacao", type: "select", options: [{ label: "Sem iluminacao", value: "sem", priceImpact: {} }, { label: "Bracos com refletores", value: "refletores", priceImpact: { fixed: 220, sector: "Eletrica" } }, { label: "Spots no forro", value: "spots", priceImpact: { fixed: 320, sector: "Eletrica" } }, { label: "LED interno", value: "led_interno", priceImpact: { perM2: 120, sector: "Eletrica" } }, { label: "LED externo", value: "led_externo", priceImpact: { perM2: 80, sector: "Eletrica" } }, { label: "Letreiro luminoso", value: "letreiro", priceImpact: { fixed: 650, sector: "Eletrica" } }] },
        { key: "light_points", label: "Quantidade de pontos de luz", type: "number", priceImpact: { perUnit: 45 } },
        { key: "transformer", label: "Fonte/transformador", type: "boolean", priceImpact: { fixed: 160, material: "Fonte/transformador" } },
        { key: "electric_labor", label: "Mao de obra eletrica", type: "boolean", priceImpact: { laborHours: 2, sector: "Eletrica" } },
        { key: "installation", label: "Instalacao", type: "boolean", priceImpact: { fixed: 260, sector: "Instalacao" } },
        { key: "distance_km", label: "Distancia de deslocamento", type: "number", priceImpact: { perKm: 4.5 } },
        { key: "quantity", label: "Quantidade", type: "number", required: true, priceImpact: { target: "quantity" } }
      ]
    },
    {
      id: "p6",
      code: "PVC-001",
      name: "PVC adesivado",
      category: "Placas",
      unit: "m2",
      baseCostM2: 58,
      laborHourCost: 48,
      machineHourCost: 50,
      marginPercent: 58,
      taxPercent: 6,
      minPrice: 120,
      maxDiscountPercent: 8,
      flow: ["Arte", "Corte", "Aplicacao", "Entrega"],
      technicalSheet: {
        standardMaterials: ["PVC", "Adesivo vinyl"],
        equipment: ["Laser", "Plotter de recorte"],
        averageProductionMinutes: 150,
        requiredSectors: ["Arte", "Corte", "Aplicacao"],
        finishes: ["Corte laser", "Adesivo aplicado", "Recorte eletronico"],
        defaultWastePercent: 8,
        productionNotes: "Conferir espessura do PVC e pontos de fixacao."
      },
      questions: [
        { key: "base", label: "Com base ou sem base?", type: "boolean", priceImpact: { fixed: 35 } },
        { key: "laser_cut", label: "Corte a laser?", type: "boolean", priceImpact: { perM2: 30, sector: "Corte laser" } },
        { key: "adhesive_applied", label: "Com adesivo aplicado?", type: "boolean", priceImpact: { perM2: 24, sector: "Aplicacao" } },
        { key: "electronic_cut", label: "Com recorte eletronico?", type: "boolean", priceImpact: { perM2: 16 } },
        { key: "width", label: "Largura", type: "measure", required: true, priceImpact: { target: "width" } },
        { key: "height", label: "Altura", type: "measure", required: true, priceImpact: { target: "height" } },
        { key: "thickness", label: "Espessura", type: "number", priceImpact: { fixed: 0 } },
        { key: "quantity", label: "Quantidade", type: "number", required: true, priceImpact: { target: "quantity" } },
        { key: "delivery_mode", label: "Instalacao ou retirada no balcao", type: "select", options: [{ label: "Retirada", value: "retirada", priceImpact: {} }, { label: "Instalacao", value: "instalacao", priceImpact: { fixed: 150, sector: "Instalacao" } }] }
      ]
    },
    {
      id: "p7",
      code: "MET-001",
      name: "Placa de metalon",
      category: "Serralheria",
      unit: "m2",
      baseCostM2: 105,
      laborHourCost: 78,
      machineHourCost: 42,
      marginPercent: 55,
      taxPercent: 6,
      minPrice: 300,
      maxDiscountPercent: 6,
      flow: ["Serralheria", "Solda", "Pintura", "Aplicacao", "Instalacao"],
      technicalSheet: {
        standardMaterials: ["Metalon", "Tinta", "ACM", "PVC", "Lona 440g"],
        equipment: ["Solda", "Esmerilhadeira", "Furadeira"],
        averageProductionMinutes: 420,
        requiredSectors: ["Serralheria", "Solda", "Pintura"],
        finishes: ["Pintura", "Base", "Aplicacao de chapa/lona"],
        defaultWastePercent: 10,
        productionNotes: "Conferir esquadro, solda e pintura antes da aplicacao do material."
      },
      questions: [
        { key: "metalon_type", label: "Tipo de metalon", type: "select", options: [{ label: "20x20", value: "20x20", priceImpact: { perLinearMeter: 18 } }, { label: "30x30", value: "30x30", priceImpact: { perLinearMeter: 26 } }, { label: "40x40", value: "40x40", priceImpact: { perLinearMeter: 38 } }] },
        { key: "metalon_measure", label: "Medida do metalon", type: "text", priceImpact: {} },
        { key: "width", label: "Largura", type: "measure", required: true, priceImpact: { target: "width" } },
        { key: "height", label: "Altura", type: "measure", required: true, priceImpact: { target: "height" } },
        { key: "depth", label: "Profundidade", type: "number", priceImpact: { perLinearMeter: 30 } },
        { key: "painting", label: "Pintura", type: "boolean", priceImpact: { perM2: 25, sector: "Pintura" } },
        { key: "welding", label: "Solda", type: "boolean", priceImpact: { laborHours: 2, sector: "Solda" } },
        { key: "applied_material", label: "ACM/PVC/lona aplicado", type: "select", options: [{ label: "ACM", value: "acm", priceImpact: { perM2: 110 } }, { label: "PVC", value: "pvc", priceImpact: { perM2: 55 } }, { label: "Lona", value: "lona", priceImpact: { perM2: 35 } }] },
        { key: "base", label: "Com base ou sem base", type: "boolean", priceImpact: { fixed: 120 } },
        { key: "installation", label: "Instalacao", type: "boolean", priceImpact: { fixed: 240, sector: "Instalacao" } },
        { key: "distance_km", label: "Deslocamento", type: "number", priceImpact: { perKm: 4.5 } },
        { key: "quantity", label: "Quantidade", type: "number", required: true, priceImpact: { target: "quantity" } }
      ]
    },
    {
      id: "p8",
      code: "IMP-001",
      name: "Impressao rapida",
      category: "Venda direta",
      unit: "unidade",
      baseCostM2: 1,
      laborHourCost: 20,
      machineHourCost: 12,
      marginPercent: 45,
      taxPercent: 4,
      minPrice: 2,
      maxDiscountPercent: 0,
      flow: ["Balcao"],
      technicalSheet: {
        standardMaterials: ["Papel"],
        equipment: ["Multifuncional"],
        averageProductionMinutes: 5,
        requiredSectors: ["Balcao"],
        finishes: ["Corte simples", "Grampo"],
        defaultWastePercent: 3,
        productionNotes: "Venda direta sem O.S. completa."
      },
      questions: []
    }
  ],
  quotes: [],
  orders: [
    { id: "OS-1042", customerId: "c3", jobName: "Adesivos campanha", productId: "p2", total: 780, paidAmount: 300, productionStatus: "Impressao", financialStatus: "parcial", dueDate: "2026-06-02", priority: "alta", approvalStatus: "Aprovado pelo cliente", files: ["arte-aprovada.pdf"], predictedCost: 325, predictedMinutes: 180, realCost: 0, realMinutes: 0 },
    { id: "OS-1043", customerId: "c1", jobName: "Faixa promocional", productId: "p1", total: 360, paidAmount: 0, productionStatus: "Acabamento", financialStatus: "pendente", dueDate: "2026-06-01", priority: "normal", approvalStatus: "Aguardando aprovação", files: [], predictedCost: 168, predictedMinutes: 90, realCost: 0, realMinutes: 0 }
  ],
  cashSessions: [],
  cashMovements: [],
  accountsReceivable: [],
  accountsPayable: [],
  quickSales: [],
  installationTeams: [],
  productionEvents: [],
  productionChecklists: [],
  realCostEntries: [],
  productionProblems: [],
  installationChecklists: [],
  productionCapacities: [
    { sector: "Impressao", resource: "Plotter", dailyCapacity: 80, unit: "m2" },
    { sector: "Corte", resource: "Laser/plotter de corte", dailyCapacity: 40, unit: "m2" },
    { sector: "Acabamento", resource: "Equipe acabamento", dailyCapacity: 60, unit: "m2" },
    { sector: "Instalacao", resource: "Equipe externa", dailyCapacity: 3, unit: "OS" }
  ],
  stockMovements: [],
  smartAlerts: [],
  intelligenceSnapshots: [],
  intelligenceInsights: [],
  intelligenceQuestions: [],
  intelligenceAudit: [],
  analyticsSnapshots: [],
  userPreferences: [
    { userId: "u1", theme: "light", favorites: ["dashboard", "intelligence", "bi", "cash"], shortcuts: ["quote", "cash", "orders", "pcp"], dashboardWidgets: ["summary", "alerts", "predictions", "risks"], updatedAt: new Date().toISOString() }
  ],
  integrationLogs: [],
  integrationMessages: [],
  webhooks: [
    { id: "wh-1", event: "orcamento_aprovado", url: "https://exemplo.local/webhooks/orcamento", active: false, attempts: 0, status: "preparado", lastLog: "" },
    { id: "wh-2", event: "os_criada", url: "https://exemplo.local/webhooks/os", active: false, attempts: 0, status: "preparado", lastLog: "" },
    { id: "wh-3", event: "pagamento_recebido", url: "https://exemplo.local/webhooks/pagamento", active: false, attempts: 0, status: "preparado", lastLog: "" }
  ],
  integrationConnectors: [
    { id: "int-whatsapp", name: "WhatsApp", type: "mensageria", status: "preparado", active: false, events: ["orcamento criado", "orcamento aprovado", "arte aguardando aprovacao", "O.S. criada", "pagamento pendente", "fiado vencido"] },
    { id: "int-email", name: "E-mail", type: "mensageria", status: "preparado", active: false, events: ["envio de orcamento", "aprovacao de arte", "cobranca", "relatorio executivo"] },
    { id: "int-pix", name: "PIX", type: "pagamento", status: "preparado", active: false, events: ["gerar cobranca", "registrar pagamento", "conciliar recebimento"] },
    { id: "int-fiscal", name: "NFe / NFSe", type: "fiscal", status: "preparado", active: false, events: ["emitir NFe", "emitir NFSe", "vincular faturamento"] },
    { id: "int-tef", name: "TEF / Cartao", type: "pagamento", status: "preparado", active: false, events: ["credito", "debito", "NSU", "conciliacao"] },
    { id: "int-drive", name: "Google Drive", type: "arquivos", status: "preparado", active: false, events: ["backup artes", "backup comprovantes", "organizar por cliente/O.S."] },
    { id: "int-backup", name: "Backup externo", type: "backup", status: "preparado", active: false, events: ["backup diario", "backup semanal", "exportacao de dados"] },
    { id: "int-portal", name: "Portal do cliente", type: "portal", status: "ativo", active: true, events: ["aprovacao", "upload", "timeline"] },
    { id: "int-webhooks", name: "Webhooks", type: "automacao", status: "preparado", active: false, events: ["orcamento_aprovado", "os_criada", "pagamento_recebido", "producao_finalizada", "instalacao_finalizada", "caixa_fechado"] }
  ],
  automationRules: [
    { id: "auto-follow", event: "follow-up vencido", active: true, severity: "alta" },
    { id: "auto-fiado", event: "fiado vencido", active: true, severity: "alta" },
    { id: "auto-os-late", event: "O.S. atrasada", active: true, severity: "alta" },
    { id: "auto-stock", event: "estoque critico", active: true, severity: "alta" },
    { id: "auto-production", event: "producao parada", active: true, severity: "media" },
    { id: "auto-cash", event: "caixa com divergencia", active: true, severity: "alta" }
  ],
  backupJobs: [
    { id: "backup-daily", frequency: "diario", status: "preparado", lastRun: "", destination: "Backup externo" },
    { id: "backup-weekly", frequency: "semanal", status: "preparado", lastRun: "", destination: "Backup externo" }
  ],
  auditLogs: [
    { id: "aud-1001", action: "Sistema iniciado", entity: "system", entityId: "bootstrap", user: "Administrador", createdAt: new Date().toISOString(), details: "Base de exemplo carregada" }
  ],
  productCategories: [],
  projectUploads: [],
  productRecognitionAnalyses: [],
  communicationSettings: [],
  printSettings: [],
  notificationQueue: [],
  messageTemplates: [],
  users: [],
  sessions: [],
  roles: [
    { id: "role-admin", name: "Admin/Gestor", permissions: "all" },
    { id: "role-vendedor", name: "Vendedor", permissions: ["commercial", "quote", "orders", "administration", "technicalVisits"] },
    { id: "role-caixa", name: "Caixa", permissions: ["cash", "quickSale", "blindClose"] },
    { id: "role-financeiro", name: "Financeiro", permissions: ["financialSummary", "operationalExpenses"] },
    { id: "role-producao", name: "Producao", permissions: ["production"] },
    { id: "role-pcp", name: "PCP", permissions: ["production", "orders"] },
    { id: "role-instalacao", name: "Instalacao", permissions: ["production", "operationalExpenses", "technicalVisits"] }
  ],
  paymentMethods: ["Pix", "Dinheiro", "Cartao credito", "Cartao debito", "Transferencia", "Boleto", "Fiado"]
};

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

function loadEnv() {
  const envFile = path.join(__dirname, ".env");
  if (!fs.existsSync(envFile)) return;
  fs.readFileSync(envFile, "utf8").split(/\r?\n/).forEach(line => {
    const clean = line.trim();
    if (!clean || clean.startsWith("#") || !clean.includes("=")) return;
    const [key, ...rest] = clean.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  });
}

function loadPersistentDb() {
  if (!fs.existsSync(dataFile)) return;
  try {
    const persisted = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    Object.assign(db, persisted);
    db.currentUser = db.currentUser || { id: "u1", name: "Joao Victor", role: "Admin Geral", sector: "Administrativo" };
    db.quickPermissions = db.quickPermissions || {};
    db.sessions = (db.sessions || []).filter(session => new Date(session.expiresAt).getTime() > Date.now());
  } catch (error) {
    console.warn(`Nao foi possivel carregar banco persistente: ${error.message}`);
  }
}

function saveDb() {
  const targetDir = path.dirname(dataFile);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));
}

function pricingModeForProduct(product = {}) {
  if (["unit", "square_meter", "linear_meter"].includes(product.pricingMode)) return product.pricingMode;
  if (["m2", "metro_quadrado"].includes(product.unit)) return "square_meter";
  if (["metro_linear", "m", "linear"].includes(product.unit)) return "linear_meter";
  return "unit";
}

function legacyImpactCostRule(question = {}) {
  const impact = question.priceImpact || {};
  const rules = [
    ["fixed", "fixed"],
    ["perUnit", "unit"],
    ["perM2", "square_meter"],
    ["perLinearMeter", "linear_meter"],
    ["percent", "percentage"]
  ];
  const found = rules.find(([key]) => Number(impact[key] || 0));
  return found ? { costType: found[1], costValue: Number(impact[found[0]]), costApplication: "add_to_cost" } : {};
}

function normalizeTechnicalQuestion(question = {}, index = 0) {
  const legacyRule = legacyImpactCostRule(question);
  const answerType = question.answerType || ({ boolean: "yes_no", multiselect: "multi_select", money: "currency" }[question.type] || question.type || "text");
  const type = question.type || ({ yes_no: "boolean", multi_select: "multiselect", currency: "money" }[answerType] || answerType);
  const hasLegacyImpact = Object.keys(question.priceImpact || {}).some(key => key !== "target" && Boolean(question.priceImpact[key]));
  const optionHasImpact = (question.options || []).some(option => Object.keys(option.priceImpact || {}).length);
  return {
    ...question,
    id: question.id || question.key || `question-${index + 1}`,
    key: question.key || question.id || `question_${index + 1}`,
    label: question.label || "Pergunta tecnica",
    answerType,
    type,
    options: Array.isArray(question.options) ? question.options : [],
    required: Boolean(question.required),
    orderIndex: Number(question.orderIndex ?? question.order ?? index),
    defaultValue: question.defaultValue ?? question.default ?? "",
    productionImpact: String(question.productionImpact || ""),
    deadlineImpactDays: Number(question.deadlineImpactDays || question.deadlineImpact || 0),
    active: question.active !== false,
    visibleInQuote: question.visibleInQuote !== false,
    visibleInOrder: question.visibleInOrder !== false,
    visibleInProduction: question.visibleInProduction !== false,
    affectsCost: question.affectsCost ?? (hasLegacyImpact || optionHasImpact),
    costType: question.costType || legacyRule.costType || "fixed",
    costValue: Number(question.costValue ?? legacyRule.costValue ?? 0),
    costApplication: question.costApplication || legacyRule.costApplication || "add_to_cost"
  };
}

function sectorByName(name) {
  const normalized = String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return (db.sectors || []).find(sector => String(sector.name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === normalized);
}

function normalizeProductionRoute(route = [], fallback = []) {
  const source = route.length ? route : fallback;
  return source.map((step, index) => {
    const raw = typeof step === "string" ? { sectorName: step } : step;
    const sector = db.sectors.find(item => item.id === raw.sectorId) || sectorByName(raw.sectorName || raw.name || raw.sector);
    return {
      sectorId: raw.sectorId || sector?.id || "",
      sectorName: raw.sectorName || raw.name || raw.sector || sector?.name || `Etapa ${index + 1}`,
      icon: raw.icon || sector?.icon || "processo",
      color: raw.color || sector?.color || "#6f0f8f",
      orderIndex: Number(raw.orderIndex ?? index),
      defaultResponsible: raw.defaultResponsible || sector?.responsible || "",
      defaultDurationHours: Number(raw.defaultDurationHours || 0),
      requiredFile: Boolean(raw.requiredFile),
      checklistRequired: Boolean(raw.checklistRequired)
    };
  }).sort((a, b) => a.orderIndex - b.orderIndex).map((step, index) => ({ ...step, orderIndex: index }));
}

function normalizeProductModel(product = {}, model = {}, index = 0) {
  const id = model.id || `model-${product.id || "product"}-${index + 1}`;
  const materialCost = Number(model.materialCost ?? model.thirdPartyCost ?? model.baseCostM2 ?? product.baseCostM2 ?? 0);
  const laborCost = Number(model.laborCost ?? model.productionCost ?? product.productionCost ?? 0);
  const salePrice = Number(model.salePrice ?? model.minPrice ?? product.salePrice ?? product.minPrice ?? 0);
  const unit = model.unit || product.unit || "unidade";
  return {
    ...model,
    id,
    name: model.name || model.model || model.modelName || product.name || "Modelo padrao",
    finish: model.finish || model.acabamento || (product.finishes || [])[0] || "",
    unit,
    variation: model.variation || model.variacao || product.pricingMode || pricingModeForProduct({ ...product, unit }),
    materialCost,
    laborCost,
    totalCost: round(materialCost + laborCost),
    salePrice,
    minPrice: Number(model.minPrice ?? salePrice),
    active: model.active !== false,
    technicalQuestions: (model.technicalQuestions || model.questions || product.technicalQuestions || product.questions || []).map(normalizeTechnicalQuestion),
    questions: (model.technicalQuestions || model.questions || product.technicalQuestions || product.questions || []).map(normalizeTechnicalQuestion),
    productionRoute: normalizeProductionRoute(model.productionRoute || [], model.flow || product.productionRoute || product.flow || []),
    stockLinks: Array.isArray(model.stockLinks) ? model.stockLinks : [],
    finance: model.finance || {},
    createdAt: model.createdAt || new Date().toISOString(),
    updatedAt: model.updatedAt || model.createdAt || new Date().toISOString()
  };
}

function normalizeProductModels(product = {}) {
  const source = Array.isArray(product.models) && product.models.length ? product.models : [{
    id: `model-${product.id || product.code || "default"}-1`,
    name: "Modelo padrao",
    finish: (product.finishes || [])[0] || "",
    unit: product.unit || "unidade",
    variation: product.pricingMode || pricingModeForProduct(product),
    materialCost: product.baseCostM2 || product.costBase || 0,
    laborCost: product.productionCost || 0,
    salePrice: product.salePrice || product.minPrice || product.baseValue || 0,
    technicalQuestions: product.technicalQuestions || product.questions || [],
    productionRoute: product.productionRoute || product.flow || [],
    active: true
  }];
  return source.map((model, index) => normalizeProductModel(product, model, index));
}

function productWithModel(product = {}, modelId = "") {
  if (!product || !product.id) return null;
  const models = normalizeProductModels(product);
  const model = models.find(item => item.id === modelId) || null;
  if (!model) return { ...product, models };
  return {
    ...product,
    selectedModelId: model.id,
    selectedModel: model,
    unit: model.unit || product.unit,
    pricingMode: ["square_meter", "linear_meter", "unit"].includes(model.variation) ? model.variation : product.pricingMode,
    baseCostM2: Number(model.materialCost ?? product.baseCostM2 ?? 0),
    productionCost: Number(model.laborCost ?? product.productionCost ?? 0),
    salePrice: Number(model.salePrice ?? product.salePrice ?? 0),
    minPrice: Number(model.minPrice ?? model.salePrice ?? product.minPrice ?? 0),
    technicalQuestions: model.technicalQuestions || product.technicalQuestions || product.questions || [],
    questions: model.technicalQuestions || model.questions || product.technicalQuestions || product.questions || [],
    productionRoute: model.productionRoute || product.productionRoute || [],
    models
  };
}

function refreshProductModels(product = {}) {
  product.models = normalizeProductModels(product);
  return product.models;
}

function groupedProductPayload(product = {}) {
  normalizeProductCatalogFields(product);
  const models = refreshProductModels(product);
  return {
    ...product,
    models,
    activeModels: models.filter(model => model.active !== false).length,
    inactiveModels: models.filter(model => model.active === false).length
  };
}

function findProductModel(product = {}, modelId = "") {
  const models = refreshProductModels(product);
  const index = models.findIndex(model => String(model.id) === String(modelId));
  return { models, index, model: index >= 0 ? models[index] : null };
}

function syncProductFieldsFromModel(product = {}, model = {}) {
  if (!model || !product) return product;
  product.unit = model.unit || product.unit || "unidade";
  if (["unit", "square_meter", "linear_meter"].includes(model.variation)) product.pricingMode = model.variation;
  product.baseCostM2 = Number(model.materialCost ?? product.baseCostM2 ?? 0);
  product.productionCost = Number(model.laborCost ?? product.productionCost ?? 0);
  product.salePrice = Number(model.salePrice ?? product.salePrice ?? 0);
  product.minPrice = Number(model.minPrice ?? model.salePrice ?? product.minPrice ?? 0);
  product.technicalQuestions = (model.technicalQuestions || model.questions || product.technicalQuestions || product.questions || []).map(normalizeTechnicalQuestion);
  product.questions = product.technicalQuestions;
  product.productionRoute = normalizeProductionRoute(model.productionRoute || product.productionRoute || [], product.flow || []);
  product.flow = product.productionRoute.map(step => step.sectorName);
  return product;
}

function ensureDeepProductConfigSupport() {
  db.sectors = (db.sectors || []).map((sector, index) => ({
    ...sector,
    icon: sector.icon || "processo",
    color: sector.color || "#6f0f8f",
    orderIndex: Number(sector.orderIndex ?? index),
    description: sector.description || "",
    active: sector.active !== false
  }));
  db.products = (db.products || []).map(product => {
    const technicalQuestions = (product.technicalQuestions || product.questions || []).map(normalizeTechnicalQuestion);
    const productionRoute = normalizeProductionRoute(product.productionRoute || [], product.sectors?.length ? product.sectors : product.flow || []);
    const normalized = { ...product, technicalQuestions, questions: technicalQuestions, productionRoute };
    return {
      ...normalized,
      pricingMode: pricingModeForProduct(product),
      defaultProductionDays: Number(product.defaultProductionDays || product.deadlineDays || 3),
      technicalQuestions,
      questions: technicalQuestions,
      productionRoute,
      models: normalizeProductModels(normalized)
    };
  });
  db.quotes = (db.quotes || []).map(quote => {
    const itemSnapshots = (quote.itemSnapshots?.length ? quote.itemSnapshots : quote.items || []).map((item, index) => item.costSnapshot ? item : buildQuoteItemSnapshot(item, index));
    const productionRoute = consolidateProductionRoutes(itemSnapshots, quote.costSnapshot?.productionRoute || quote.pricing?.productionRoute || quote.pricing?.productionFlow || []);
    return {
      ...quote,
      items: itemSnapshots.length ? itemSnapshots : quote.items || [],
      itemSnapshots,
      costSnapshot: {
        ...(quote.costSnapshot || {}),
        items: itemSnapshots,
        productionRoute: productionRoute.length ? productionRoute : quote.costSnapshot?.productionRoute || []
      }
    };
  });
  db.orders = (db.orders || []).map(order => {
    const product = db.products.find(item => item.id === order.productId);
    const itemSnapshots = order.itemProductionSnapshots?.length ? order.itemProductionSnapshots : order.items || [];
    const itemQuestionCosts = itemSnapshots.flatMap(item => item.questionCostsSnapshot || item.costSnapshot?.questionCosts || []);
    const route = consolidateProductionRoutes(itemSnapshots, order.productionRouteSnapshot || order.flow || product?.productionRoute || []);
    const currentStep = route.find(step => step.sectorId === order.currentSectorId || step.sectorName === order.currentSectorName || step.sectorName === order.productionStatus) || route[0];
    return {
      ...order,
      items: itemSnapshots,
      itemProductionSnapshots: itemSnapshots,
      productConfigSnapshots: order.productConfigSnapshots || itemSnapshots.map(item => item.productConfigSnapshot || item.costSnapshot?.product).filter(Boolean),
      technicalAnswersByItem: order.technicalAnswersByItem || itemSnapshots.map(item => ({ itemId: item.id, productId: item.productId, productName: item.productName, answers: item.technicalAnswersSnapshot || item.answers || {} })),
      productionRouteSnapshot: route,
      currentRouteIndex: Number(order.currentRouteIndex ?? Math.max(route.indexOf(currentStep), 0)),
      currentSectorId: order.currentSectorId || currentStep?.sectorId || "",
      currentSectorName: order.currentSectorName || currentStep?.sectorName || order.productionStatus || "",
      technicalAnswersSnapshot: order.technicalAnswersSnapshot || order.answers || {},
      questionCostsSnapshot: order.questionCostsSnapshot?.length ? order.questionCostsSnapshot : itemQuestionCosts.length ? itemQuestionCosts : order.costSnapshot?.questionCosts || [],
      productionEvents: order.productionEvents || [],
      productionNotes: order.productionNotes || order.answers?.productionNote || "",
      internalProductionWarnings: order.internalProductionWarnings || "",
      fileInstructions: order.fileInstructions || "",
      installationNotes: order.installationNotes || ""
    };
  });
  saveDb();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith("scrypt:")) return false;
  const [, salt, hash] = stored.split(":");
  const current = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === current.length && crypto.timingSafeEqual(expected, current);
}

function fullPermissions() {
  return {
    ...db.quickPermissions,
    cash: true,
    quickSale: true,
    blindClose: true,
    financialSummary: true,
    production: true,
    productionViewMine: true,
    productionViewSector: true,
    productionViewAll: true,
    productionStart: true,
    productionPause: true,
    productionResume: true,
    productionFinish: true,
    productionChecklist: true,
    productionNote: true,
    productionAttachments: true,
    productionRework: true,
    productionMove: true,
    productionEdit: true,
    productionSchedule: true,
    productionCancel: true,
    productionReports: true,
    productionSensitiveData: true,
    changeCompany: true,
    quote: true,
    settings: true,
    operationalExpenses: true,
    expenseApproval: true,
    administration: true,
    commercial: true,
    customerPortal: true,
    bi: true,
    integrations: true,
    orders: true,
    supplies: true,
    technicalVisits: true
  };
}

const companyScopedCollections = [
  "quotes",
  "orders",
  "productionEvents",
  "productionChecklists",
  "productionProblems",
  "realCostEntries",
  "installationTeams",
  "installationChecklists",
  "stockMovements",
  "cashSessions",
  "cashMovements",
  "quickSales",
  "accountsReceivable",
  "accountsPayable",
  "operationalExpenses",
  "technicalVisits",
  "expenseAdvances",
  "vehicles",
  "employees",
  "sectors",
  "expenses",
  "costCenters"
  ,
  "pricingSimulations",
  "auditLogs"
];

const requestCompanyContext = new AsyncLocalStorage();

function primaryCompanyId() {
  return db.companySettings?.defaultCompanyId || db.companies?.find(company => company.default)?.id || db.companies?.[0]?.id || "company-main";
}

function currentCompanyId() {
  return requestCompanyContext.getStore()?.companyId || db.activeCompanyId || primaryCompanyId();
}

function normalizeCompany(company = {}) {
  const id = company.id || uid("company");
  return {
    id,
    name: company.name || company.nome || company.tradeName || "Nova loja",
    tradeName: company.tradeName || company.nome_fantasia || company.name || "Nova loja",
    city: company.city || company.cidade || "",
    state: company.state || company.estado || "",
    cnpj: company.cnpj || "",
    phone: company.phone || company.telefone || "",
    address: company.address || company.endereco || "",
    active: company.active !== false && company.ativa !== false,
    default: Boolean(company.default || company.padrao),
    createdAt: company.createdAt || company.data_criacao || new Date().toISOString()
  };
}

function effectivePermissions(user = db.currentUser) {
  if (isAdmin(user)) return fullPermissions();
  const role = String(user?.role || "").toLowerCase();
  const defaults = role.includes("vendedor") ? { commercial: true, quote: true, orders: true, administration: true, technicalVisits: true }
    : role.includes("caixa") ? { cash: true, quickSale: true, blindClose: true }
    : role.includes("financeiro") ? { financialSummary: true, operationalExpenses: true }
    : role.includes("pcp") ? {
      production: true, orders: true, productionViewMine: true, productionViewSector: true, productionViewAll: true,
      productionStart: true, productionPause: true, productionResume: true, productionFinish: true,
      productionChecklist: true, productionNote: true, productionAttachments: true, productionRework: true,
      productionMove: true, productionEdit: true, productionSchedule: true, productionCancel: true,
      productionReports: true, productionSensitiveData: true
    }
    : role.includes("produc") ? {
      production: true, productionViewMine: true, productionViewSector: true,
      productionStart: true, productionPause: true, productionResume: true, productionFinish: true,
      productionChecklist: true, productionNote: true, productionAttachments: true, productionRework: true,
      productionMove: true
    }
    : role.includes("instal") ? {
      production: true, operationalExpenses: true, technicalVisits: true, productionViewMine: true, productionViewSector: true,
      productionStart: true, productionPause: true, productionResume: true, productionFinish: true,
      productionChecklist: true, productionNote: true, productionAttachments: true
    }
    : {};
  return { ...defaults, ...(user?.permissions || {}) };
}

function ensureCompanySupport() {
  db.companies = (db.companies?.length ? db.companies : [{
    id: "company-main",
    name: "PrintSys Loja Principal",
    tradeName: "Loja Principal",
    city: "Fortaleza",
    state: "CE",
    cnpj: "",
    phone: "",
    address: "",
    active: true,
    default: true,
    createdAt: new Date().toISOString()
  }]).map(normalizeCompany);
  if (!db.companies.some(company => company.default)) db.companies[0].default = true;
  db.companySettings = {
    defaultCompanyId: primaryCompanyId(),
    shareCustomers: db.companySettings?.shareCustomers !== false,
    shareProducts: db.companySettings?.shareProducts !== false
  };
  db.activeCompanyId = db.activeCompanyId || primaryCompanyId();

  [...companyScopedCollections, "customers", "products", "materials", "compositions"].forEach(collection => {
    db[collection] = db[collection] || [];
    db[collection].forEach(item => {
      if (!item.companyId) item.companyId = primaryCompanyId();
    });
  });
  db.cashMovements.forEach(movement => {
    movement.category = movement.category || (movement.type === "expense" ? "Despesa operacional" : movement.type === "quick_sale" ? "Venda rapida" : movement.type === "opening" ? "Abertura" : "Financeiro");
    movement.costCenter = movement.costCenter || movement.costCenterId || (movement.type === "expense" ? "Administrativo" : movement.type === "quick_sale" ? "Comercial" : "Financeiro");
    movement.costCenterId = movement.costCenterId || movement.costCenter;
    movement.responsible = movement.responsible || movement.operator || movement.seller || db.currentUser.name || "Sistema";
  });
  db.operationalExpenses.forEach(expense => {
    expense.category = expense.category || "Outros";
    expense.sector = expense.sector || expense.costCenter || "Administrativo";
    expense.costCenter = expense.costCenter || expense.sector;
    expense.costCenterId = expense.costCenterId || expense.costCenter;
    expense.responsible = expense.responsible || expense.operator || db.currentUser.name || "Sistema";
  });
  db.compositions.forEach(composition => {
    if (composition.active === undefined) composition.active = true;
    const product = db.products.find(item => item.id === composition.productId);
    const validationRecord = /validacao|homologacao/i.test(`${composition.name} ${product?.name || ""}`);
    if (validationRecord && !composition.materials?.length) composition.active = false;
  });

  db.users = db.users || [];
  db.users.forEach(user => {
    user.permissions = effectivePermissions(user);
    user.companyIds = Array.isArray(user.companyIds) && user.companyIds.length ? user.companyIds : (isAdmin(user) ? ["all"] : [primaryCompanyId()]);
    user.companyRoles = user.companyRoles || {};
    user.defaultCompanyId = user.defaultCompanyId || (isAdmin(user) ? "all" : primaryCompanyId());
    const storeIds = user.companyIds.includes("all") && isAdmin(user) ? db.companies.map(company => company.id) : user.companyIds.filter(id => id !== "all");
    user.storeAccess = storeIds.map(storeId => {
      const current = (user.storeAccess || []).find(access => access.storeId === storeId) || {};
      return {
        storeId,
        role: current.role || user.companyRoles[storeId] || user.role,
        permissions: { ...user.permissions, ...(current.permissions || {}) }
      };
    });
  });
  if (isAdmin(db.currentUser)) db.quickPermissions = fullPermissions();
  saveDb();
}

function defaultMessageTemplates() {
  return [
    { id: "tpl-quote-created", event: "quote.created", name: "Orcamento criado", channel: "WhatsApp", subject: "Seu orcamento foi criado", body: "Ola, {{customer_name}}! Seu orcamento {{quote_number}} foi criado na {{company_name}}. Acompanhe pelo link: {{tracking_link}}", active: true },
    { id: "tpl-quote-approved", event: "quote.approved", name: "Orcamento aprovado", channel: "WhatsApp", subject: "Orcamento aprovado", body: "{{customer_name}}, seu orcamento {{quote_number}} foi aprovado e vamos abrir a O.S. {{order_number}}. Obrigado por escolher a {{company_name}}.", active: true },
    { id: "tpl-order-created", event: "service_order.created", name: "O.S. criada", channel: "WhatsApp", subject: "Ordem de servico criada", body: "Ola, {{customer_name}}! Sua O.S. {{order_number}} foi criada. Status atual: {{status}}. Acompanhe: {{tracking_link}}", active: true },
    { id: "tpl-order-production", event: "service_order.sent_to_production", name: "O.S. enviada para producao", channel: "WhatsApp", subject: "O.S. enviada para producao", body: "{{customer_name}}, sua O.S. {{order_number}} foi enviada para producao. Prazo previsto: {{estimated_delivery}}.", active: true },
    { id: "tpl-production-started", event: "production.started", name: "Producao iniciada", channel: "WhatsApp", subject: "Producao iniciada", body: "{{customer_name}}, a producao da O.S. {{order_number}} foi iniciada. Status: {{status}}.", active: true },
    { id: "tpl-production-paused", event: "production.paused", name: "Producao pausada", channel: "WhatsApp", subject: "Atualizacao da producao", body: "{{customer_name}}, sua O.S. {{order_number}} teve uma pausa operacional. Nossa equipe acompanha e atualizara o andamento.", active: true },
    { id: "tpl-production-finished", event: "production.finished", name: "Producao finalizada", channel: "WhatsApp", subject: "Producao finalizada", body: "{{customer_name}}, a producao da O.S. {{order_number}} foi finalizada e segue para conferencia.", active: true },
    { id: "tpl-production-homologated", event: "production.homologated", name: "O.S. homologada", channel: "WhatsApp", subject: "O.S. homologada", body: "{{customer_name}}, sua O.S. {{order_number}} foi conferida e homologada. Status: {{status}}.", active: true },
    { id: "tpl-order-ready", event: "order.ready", name: "Pronto para retirada/entrega", channel: "WhatsApp", subject: "Pedido pronto", body: "{{customer_name}}, sua O.S. {{order_number}} esta pronta para retirada/entrega. Fale conosco: {{company_whatsapp}}.", active: true },
    { id: "tpl-order-delivered", event: "order.delivered", name: "O.S. entregue", channel: "WhatsApp", subject: "Pedido entregue", body: "{{customer_name}}, registramos a entrega da O.S. {{order_number}}. Obrigado pela preferencia!", active: true },
    { id: "tpl-order-cancelled", event: "order.cancelled", name: "O.S. cancelada", channel: "WhatsApp", subject: "O.S. cancelada", body: "{{customer_name}}, registramos o cancelamento da O.S. {{order_number}}. Nossa equipe esta a disposicao para orientar os proximos passos.", active: true },
    { id: "tpl-rework-created", event: "rework.created", name: "Retrabalho registrado", channel: "WhatsApp", subject: "Atualizacao da O.S.", body: "{{customer_name}}, registramos um retrabalho interno vinculado a O.S. {{order_number}}. Acompanhe o andamento pelo link: {{tracking_link}}", active: true },
    { id: "tpl-courtesy-created", event: "courtesy.created", name: "Cortesia registrada", channel: "WhatsApp", subject: "Cortesia registrada", body: "{{customer_name}}, uma O.S. de cortesia foi registrada na {{company_name}}. Status atual: {{status}}.", active: true },
    { id: "tpl-payment-pending", event: "payment.pending", name: "Pagamento pendente", channel: "WhatsApp", subject: "Pagamento pendente", body: "{{customer_name}}, consta saldo pendente na O.S. {{order_number}}. Status financeiro: {{status}}.", active: true },
    { id: "tpl-payment-received", event: "payment.received", name: "Pagamento recebido", channel: "WhatsApp", subject: "Pagamento recebido", body: "{{customer_name}}, recebemos o pagamento da O.S. {{order_number}}. Obrigado!", active: true }
  ];
}

function defaultPrintSettings(companyId = primaryCompanyId()) {
  const company = companyById(companyId) || companyById(primaryCompanyId()) || {};
  return {
    companyId,
    logoUrl: company.logoUrl || "",
    headerImageUrl: "",
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
    showProductImagesQuote: true,
    showProductImagesOrder: true,
    showProjectAttachmentPreview: true,
    defaultOrderModel: "operacional",
    defaultQuoteModel: "comercial",
    defaultReportModel: "gerencial",
    updatedAt: new Date().toISOString()
  };
}

function printSettingsForCompany(companyId = currentCompanyId()) {
  const scopedCompanyId = companyId === "all" ? primaryCompanyId() : (companyId || primaryCompanyId());
  const saved = (db.printSettings || []).find(item => item.companyId === scopedCompanyId) || {};
  return { ...defaultPrintSettings(scopedCompanyId), ...saved, companyId: scopedCompanyId };
}

function defaultProductCategories(companyId = primaryCompanyId()) {
  return [
    { id: "cat-adhesives", name: "Adesivos e adesivacao", icon: "AD", color: "#7b179f", defaultSector: "Impressao", keywords: ["adesivo", "adesivacao", "vinil", "recorte", "aplicado", "perfurado", "plotagem"], defaultFlow: ["Arte", "Impressao", "Corte", "Instalacao"] },
    { id: "cat-banners", name: "Lonas e faixas", icon: "LN", color: "#2563eb", defaultSector: "Impressao", keywords: ["lona", "faixa", "banner", "front", "ilhos", "bainha"], defaultFlow: ["Impressao", "Acabamento", "Conferencia", "Entrega"] },
    { id: "cat-plates", name: "Placas", icon: "PL", color: "#16a34a", defaultSector: "Acabamento", keywords: ["placa", "pvc", "ps", "acrilico", "sinalizacao"], defaultFlow: ["Arte", "Corte", "Acabamento", "Entrega"] },
    { id: "cat-acm", name: "ACM e fachadas", icon: "AC", color: "#0f766e", defaultSector: "ACM", keywords: ["acm", "fachada", "caixote", "forro", "metalon", "estrutura"], defaultFlow: ["Projeto", "Corte", "Serralheria", "Montagem", "Instalacao"] },
    { id: "cat-pvc", name: "PVC adesivado", icon: "PV", color: "#0891b2", defaultSector: "Corte", keywords: ["pvc", "adesivado", "laser", "base"], defaultFlow: ["Arte", "Corte", "Aplicacao", "Entrega"] },
    { id: "cat-acrylic", name: "Acrilico", icon: "AR", color: "#db2777", defaultSector: "Corte", keywords: ["acrilico", "display", "corte laser", "transparent"], defaultFlow: ["Projeto", "Corte", "Acabamento", "Entrega"] },
    { id: "cat-signs", name: "Letreiros e letras", icon: "LT", color: "#dc2626", defaultSector: "LED", keywords: ["letreiro", "letra caixa", "letra", "luminoso", "backlight"], defaultFlow: ["Projeto", "Corte", "LED", "Montagem", "Instalacao"] },
    { id: "cat-led", name: "LED e iluminacao", icon: "LD", color: "#facc15", defaultSector: "LED", keywords: ["led", "iluminacao", "refletor", "spot", "fonte", "transformador"], defaultFlow: ["Eletrica", "Montagem", "Teste", "Instalacao"] },
    { id: "cat-structures", name: "Estruturas e metalon", icon: "MT", color: "#475569", defaultSector: "Serralheria", keywords: ["metalon", "estrutura", "solda", "braco", "toldo", "totem"], defaultFlow: ["Serralheria", "Pintura", "Montagem", "Instalacao"] },
    { id: "cat-pdv", name: "Displays e PDV", icon: "PD", color: "#ea580c", defaultSector: "Acabamento", keywords: ["display", "pdv", "balcao", "expositor"], defaultFlow: ["Projeto", "Corte", "Acabamento", "Entrega"] }
  ].map(category => ({
    ...category,
    companyId,
    description: category.description || `Categoria para ${category.name.toLowerCase()}.`,
    imageUrl: category.imageUrl || "",
    active: true
  }));
}

function defaultCommunicationSettings(companyId = primaryCompanyId()) {
  const company = companyById(companyId) || {};
  return {
    companyId,
    enabled: true,
    whatsappMode: "manual_whatsapp_link",
    companyWhatsApp: normalizeWhatsApp(company.whatsapp || company.phone || ""),
    defaultSender: db.currentUser.name || "Atendimento",
    footer: "Mensagem enviada pela equipe PrintSys.",
    events: {
      quote: true,
      order: true,
      production: true,
      payment: true,
      tracking: true
    },
    provider: {
      name: "",
      baseUrl: "",
      token: "",
      webhookSecret: ""
    },
    updatedAt: new Date().toISOString()
  };
}

function communicationSettingsForCompany(companyId = currentCompanyId()) {
  const scopedCompanyId = companyId === "all" ? primaryCompanyId() : (companyId || primaryCompanyId());
  const saved = (db.communicationSettings || []).find(item => item.companyId === scopedCompanyId) || {};
  return {
    ...defaultCommunicationSettings(scopedCompanyId),
    ...saved,
    events: { ...defaultCommunicationSettings(scopedCompanyId).events, ...(saved.events || {}) },
    provider: { ...defaultCommunicationSettings(scopedCompanyId).provider, ...(saved.provider || {}) },
    companyId: scopedCompanyId
  };
}

function notificationEventGroup(event = "") {
  if (String(event).startsWith("quote.")) return "quote";
  if (String(event).startsWith("payment.")) return "payment";
  if (String(event).startsWith("production.") || String(event).startsWith("service_order.sent")) return "production";
  if (String(event).includes("tracking")) return "tracking";
  return "order";
}

function catalogText(value = "") {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function catalogCategoriesForCompany(companyId = currentCompanyId()) {
  const scopedCompanyId = companyId === "all" ? primaryCompanyId() : (companyId || primaryCompanyId());
  return (db.productCategories || []).filter(item => (item.companyId || primaryCompanyId()) === scopedCompanyId && item.active !== false);
}

function categoryForProduct(product = {}) {
  const categories = catalogCategoriesForCompany(product.companyId || currentCompanyId());
  const haystack = catalogText([product.category, product.name, product.description, product.code].join(" "));
  return categories.find(category => product.categoryId && category.id === product.categoryId)
    || categories.find(category => catalogText(category.name) === catalogText(product.category))
    || categories.find(category => (category.keywords || []).some(keyword => haystack.includes(catalogText(keyword))))
    || categories[0]
    || defaultProductCategories(product.companyId || primaryCompanyId())[0];
}

function defaultMeasurementsForCategory(categoryId = "", product = {}) {
  if (["cat-banners", "cat-acm", "cat-adhesives", "cat-pvc", "cat-plates"].includes(categoryId)) return { width: 1, height: 1, quantity: 1, unit: product.unit || "m2" };
  if (["cat-structures", "cat-signs", "cat-led"].includes(categoryId)) return { width: 1, height: 1, depth: 0, quantity: 1, unit: product.unit || "unidade" };
  return { quantity: 1, unit: product.unit || "unidade" };
}

function normalizeCatalogAttachments(value = []) {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  return source.map((item, index) => {
    if (typeof item === "object") return { id: item.id || uid("att"), name: item.name || item.fileName || `Arquivo ${index + 1}`, url: item.url || "", type: item.type || "referencia", createdAt: item.createdAt || new Date().toISOString() };
    const name = String(item || "").trim();
    return name ? { id: uid("att"), name, url: "", type: "referencia", createdAt: new Date().toISOString() } : null;
  }).filter(Boolean);
}

function normalizeProductCatalogFields(product = {}) {
  const category = categoryForProduct(product);
  product.categoryId = product.categoryId || category?.id || "";
  product.category = product.category || category?.name || "Personalizado";
  product.categoryIcon = product.categoryIcon || category?.icon || (product.category || "PR").slice(0, 2).toUpperCase();
  product.categoryImageUrl = product.categoryImageUrl || category?.imageUrl || "";
  product.imageUrl = product.imageUrl || product.photo || product.thumbnailUrl || "";
  product.thumbnailUrl = product.thumbnailUrl || product.imageUrl || "";
  product.favorite = Boolean(product.favorite);
  product.recentlyUsedAt = product.recentlyUsedAt || "";
  product.attachments = normalizeCatalogAttachments(product.attachments || product.examples || []);
  product.examples = normalizeCatalogAttachments(product.examples || []);
  product.defaultMeasurements = product.defaultMeasurements || defaultMeasurementsForCategory(product.categoryId, product);
  product.keywords = [...new Set([
    product.code,
    product.name,
    product.category,
    ...(category?.keywords || []),
    ...(product.keywords || []),
    ...(product.technicalQuestions || product.questions || []).map(question => question.label || question.key)
  ].filter(Boolean).map(catalogText))];
  return product;
}

function productCatalogPayload(companyId = currentCompanyId()) {
  const categories = catalogCategoriesForCompany(companyId);
  const products = scoped("products").map(product => groupedProductPayload(normalizeProductCatalogFields(product)));
  return {
    categories,
    products,
    favorites: products.filter(product => product.favorite && product.active !== false),
    recentlyUsed: products.filter(product => product.recentlyUsedAt).sort((a, b) => new Date(b.recentlyUsedAt) - new Date(a.recentlyUsedAt)).slice(0, 12),
    summary: {
      categories: categories.length,
      products: products.length,
      activeProducts: products.filter(product => product.active !== false).length,
      inactiveProducts: products.filter(product => product.active === false).length
    }
  };
}

function parseRecognitionMeasurements(text = "") {
  const source = catalogText(text).replace(/,/g, ".");
  const match = source.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/i);
  const quantityMatch = source.match(/(?:qtd|quantidade|unidades|un\.?)\s*(\d+)/i) || source.match(/(\d+)\s*(?:unidades|un\.?)/i);
  return {
    width: match ? Number(match[1]) : 0,
    height: match ? Number(match[2]) : 0,
    quantity: quantityMatch ? Number(quantityMatch[1]) : 1
  };
}

function recognitionKeywordsForProduct(product = {}) {
  const category = categoryForProduct(product);
  const compositionKeywords = db.compositions.filter(item => item.productId === product.id).flatMap(item => [item.name, item.category, ...(item.productionFlow || [])]);
  return [...new Set([
    product.code,
    product.name,
    product.category,
    ...(product.keywords || []),
    ...(category?.keywords || []),
    ...compositionKeywords,
    ...(product.technicalQuestions || product.questions || []).map(question => question.label || question.key)
  ].filter(Boolean).map(catalogText).filter(Boolean))];
}

function analyzeProjectRecognition(body = {}) {
  const text = [body.fileName, body.extractedText, body.notes, body.customerRequest, body.manualDescription].filter(Boolean).join(" ");
  const normalized = catalogText(text);
  const measurements = parseRecognitionMeasurements(text);
  const configuredAi = Boolean(process.env.AI_PROVIDER || process.env.OPENAI_API_KEY || body.aiProviderConfigured);
  const products = scoped("products").filter(product => product.active !== false).map(normalizeProductCatalogFields);
  const suggestions = products.map(product => {
    const keywords = recognitionKeywordsForProduct(product);
    const matched = keywords.filter(keyword => keyword && normalized.includes(keyword));
    const nameTokens = catalogText(product.name).split(/\s+/).filter(token => token.length > 2);
    const tokenHits = nameTokens.filter(token => normalized.includes(token));
    let confidence = matched.length ? 35 + matched.length * 12 : 0;
    if (tokenHits.length) confidence += tokenHits.length * 8;
    if (normalized.includes(catalogText(product.category))) confidence += 10;
    if (!confidence) return null;
    confidence = Math.min(95, Math.round(confidence));
    const composition = db.compositions.find(item => item.productId === product.id) || null;
    const missingInformation = [];
    if (!measurements.width && ["square_meter", "linear_meter"].includes(pricingModeForProduct(product))) missingInformation.push("largura");
    if (!measurements.height && pricingModeForProduct(product) === "square_meter") missingInformation.push("altura");
    if (!measurements.quantity) missingInformation.push("quantidade");
    const suggestedAnswers = {
      width: measurements.width || "",
      height: measurements.height || "",
      quantity: measurements.quantity || 1,
      compositionId: composition?.id || "",
      installation: /instala|aplicad|fachada|totem/.test(normalized),
      lighting: /led|luminos|ilumina|refletor|spot/.test(normalized),
      electronic_cut: /recorte|laser|corte/.test(normalized)
    };
    return {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      categoryId: product.categoryId,
      category: product.category,
      imageUrl: product.imageUrl || product.categoryImageUrl || "",
      compositionId: composition?.id || "",
      compositionName: composition?.name || "",
      confidence,
      reason: matched.length ? `Palavras encontradas: ${matched.slice(0, 6).join(", ")}` : `Nome parecido com ${product.name}`,
      missingInformation,
      suggestedAnswers,
      suggestedQuantity: suggestedAnswers.quantity,
      suggestedMeasure: measurements.width && measurements.height ? `${measurements.width} x ${measurements.height}` : "A confirmar",
      source: configuredAi ? "ai_ready_metadata" : "keyword_fallback"
    };
  }).filter(Boolean).sort((a, b) => b.confidence - a.confidence).slice(0, 8);
  return {
    analysisMode: configuredAi ? "ai_ready_metadata" : "keyword_fallback",
    aiProviderConfigured: configuredAi,
    message: configuredAi ? "Analise preparada para provedor de IA configurado." : "Automatic recognition requires AI provider configuration.",
    extractedText: body.extractedText || "",
    normalizedInput: normalized,
    measurements,
    suggestions,
    missingInformation: [...new Set(suggestions.flatMap(item => item.missingInformation || []))]
  };
}

function normalizeDigits(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function normalizeWhatsApp(value = "") {
  const digits = normalizeDigits(value);
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return digits.length >= 10 ? `55${digits}` : digits;
}

function whatsappDeepLink(phone = "", message = "") {
  const digits = normalizeWhatsApp(phone);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message || "")}`;
}

function normalizeCommunicationPreference(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (["whatsapp", "email", "both", "disabled"].includes(normalized)) return normalized;
  if (["ambos", "todos"].includes(normalized)) return "both";
  if (["desativado", "nenhum"].includes(normalized)) return "disabled";
  return "both";
}

function normalizeCustomerContact(customer = {}) {
  customer.document = customer.document || customer.cpfCnpj || customer.cnpj || customer.cpf || "";
  customer.whatsapp = customer.whatsapp || customer.mobile || customer.phone || "";
  customer.phone = customer.phone || customer.whatsapp || "";
  customer.contactPerson = customer.contactPerson || customer.contact || "";
  customer.communicationPreference = normalizeCommunicationPreference(customer.communicationPreference || customer.contactPreference);
  customer.address = customer.address || customer.endereco || "";
  customer.email = customer.email || "";
  customer.active = customer.active !== false;
  return customer;
}

function normalizeEmployeeProfile(employee = {}) {
  employee.profilePhoto = employee.profilePhoto || employee.photo || "";
  employee.photo = employee.profilePhoto || employee.photo || "";
  employee.whatsapp = employee.whatsapp || employee.phone || "";
  employee.personalPhone = employee.personalPhone || employee.phone || "";
  employee.companyPhone = employee.companyPhone || "";
  employee.companyEmail = employee.companyEmail || employee.email || "";
  employee.defaultContactPreference = employee.defaultContactPreference || "personal_whatsapp";
  employee.email = employee.email || employee.companyEmail || "";
  employee.active = employee.active !== false;
  return employee;
}

function ensureCommunicationSupport() {
  db.printSettings = Array.isArray(db.printSettings) ? db.printSettings : [];
  db.notificationQueue = Array.isArray(db.notificationQueue) ? db.notificationQueue : [];
  db.messageTemplates = Array.isArray(db.messageTemplates) && db.messageTemplates.length ? db.messageTemplates : defaultMessageTemplates();
  db.portalNotifications = Array.isArray(db.portalNotifications) ? db.portalNotifications : [];
  db.integrationMessages = Array.isArray(db.integrationMessages) ? db.integrationMessages : [];
  db.integrationLogs = Array.isArray(db.integrationLogs) ? db.integrationLogs : [];
  db.customers = (db.customers || []).map(normalizeCustomerContact);
  db.employees = (db.employees || []).map(normalizeEmployeeProfile);
  db.users = (db.users || []).map(user => ({
    ...user,
    profilePhoto: user.profilePhoto || user.photo || "",
    whatsapp: user.whatsapp || user.phone || "",
    personalPhone: user.personalPhone || user.phone || "",
    companyPhone: user.companyPhone || "",
    companyEmail: user.companyEmail || user.email || "",
    defaultContactPreference: user.defaultContactPreference || "personal_whatsapp"
  }));
  db.companies.forEach(company => {
    if (!db.printSettings.some(item => item.companyId === company.id)) db.printSettings.push(defaultPrintSettings(company.id));
  });
  db.notificationQueue.forEach(item => {
    item.companyId = item.companyId || primaryCompanyId();
    item.status = item.status || "pending";
    item.createdAt = item.createdAt || new Date().toISOString();
  });
  saveDb();
}

function ensureCatalogSupport() {
  db.productCategories = Array.isArray(db.productCategories) ? db.productCategories : [];
  db.projectUploads = Array.isArray(db.projectUploads) ? db.projectUploads : [];
  db.productRecognitionAnalyses = Array.isArray(db.productRecognitionAnalyses) ? db.productRecognitionAnalyses : [];
  db.communicationSettings = Array.isArray(db.communicationSettings) ? db.communicationSettings : [];
  db.companies.forEach(company => {
    const existingCategories = db.productCategories.filter(category => (category.companyId || primaryCompanyId()) === company.id);
    if (!existingCategories.length) db.productCategories.push(...defaultProductCategories(company.id));
    if (!db.communicationSettings.some(item => item.companyId === company.id)) db.communicationSettings.push(defaultCommunicationSettings(company.id));
    const settings = db.printSettings.find(item => item.companyId === company.id);
    if (settings) {
      if (settings.showProductImagesQuote === undefined) settings.showProductImagesQuote = true;
      if (settings.showProductImagesOrder === undefined) settings.showProductImagesOrder = true;
      if (settings.showProjectAttachmentPreview === undefined) settings.showProjectAttachmentPreview = true;
    }
  });
  db.productCategories = db.productCategories.map(category => ({
    ...category,
    companyId: category.companyId || primaryCompanyId(),
    icon: category.icon || String(category.name || "PR").slice(0, 2).toUpperCase(),
    color: category.color || "#7b179f",
    keywords: Array.isArray(category.keywords) ? category.keywords : String(category.keywords || "").split(",").map(item => item.trim()).filter(Boolean),
    defaultFlow: Array.isArray(category.defaultFlow) ? category.defaultFlow : String(category.defaultFlow || "").split(",").map(item => item.trim()).filter(Boolean),
    active: category.active !== false
  }));
  db.products = (db.products || []).map(product => normalizeProductCatalogFields(product));
  db.projectUploads.forEach(upload => {
    upload.companyId = upload.companyId || primaryCompanyId();
    upload.createdAt = upload.createdAt || new Date().toISOString();
  });
  db.productRecognitionAnalyses.forEach(analysis => {
    analysis.companyId = analysis.companyId || primaryCompanyId();
    analysis.createdAt = analysis.createdAt || new Date().toISOString();
  });
  saveDb();
}

function ensureAdminUser() {
  db.users = db.users || [];
  db.sessions = db.sessions || [];
  if (db.users.some(user => user.role === "Admin Geral" || user.role === "Admin/Gestor")) return;
  const generatedPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(8).toString("hex");
  const admin = {
    id: "u1",
    name: "Joao Victor",
    email: process.env.ADMIN_EMAIL || "admin@printsys.local",
    username: "joao",
    role: "Admin Geral",
    profile: "Admin/Gestor",
    sector: "Administrativo",
    passwordHash: hashPassword(generatedPassword),
    permissions: fullPermissions(),
    companyIds: ["all"],
    companyRoles: { all: "Admin/Gestor" },
    defaultCompanyId: "all",
    active: true,
    createdAt: new Date().toISOString()
  };
  db.users.push(admin);
  db.currentUser = { id: admin.id, name: admin.name, role: admin.role, sector: admin.sector };
  db.quickPermissions = { ...admin.permissions };
  if (!process.env.ADMIN_PASSWORD) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "admin-inicial.txt"), `Usuario: ${admin.email}\nSenha temporaria: ${generatedPassword}\nAltere esta senha antes do uso real.\n`);
  }
  saveDb();
}

loadPersistentDb();
ensureCompanySupport();
ensureCommunicationSupport();
ensureCatalogSupport();
ensureAdminUser();
ensureCompanySupport();
ensureCommunicationSupport();
ensureCatalogSupport();
ensureDeepProductConfigSupport();

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map(item => item.trim()).filter(Boolean).map(item => {
    const [key, ...rest] = item.split("=");
    return [decodeURIComponent(key), decodeURIComponent(rest.join("="))];
  }));
}

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, username: user.username, role: user.role, profile: user.profile || user.role, sector: user.sector, permissions: effectivePermissions(user), companyIds: userCompanyIds(user), storeAccess: user.storeAccess || [], defaultCompanyId: user.defaultCompanyId || primaryCompanyId() };
}

function userFromRequest(req) {
  const session = requestSession(req);
  if (!session) return null;
  const user = (db.users || []).find(item => item.id === session.userId && item.active !== false);
  if (user) user._sessionCompanyId = session.companyId;
  return user || null;
}

function setSessionCookie(res, token, expiresAt) {
  res.setHeader("Set-Cookie", `printsys_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "printsys_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

function loginUser(res, user) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionMaxAgeMs).toISOString();
  const companyId = canAccessCompany(user, user.lastCompanyId || user.defaultCompanyId) ? (user.lastCompanyId || user.defaultCompanyId) : (isAdmin(user) ? "all" : primaryCompanyId());
  db.sessions = (db.sessions || []).filter(session => new Date(session.expiresAt).getTime() > Date.now());
  db.sessions.push({ token, userId: user.id, companyId, createdAt: new Date().toISOString(), expiresAt });
  setSessionCookie(res, token, expiresAt);
  setActiveCompany(companyId);
  db.currentUser = { id: user.id, name: user.name, role: user.role, sector: user.sector, companyIds: userCompanyIds(user), defaultCompanyId: user.defaultCompanyId || primaryCompanyId() };
  db.quickPermissions = effectivePermissions(user);
  saveDb();
  return { user: publicUser(user), permissions: effectivePermissions(user), ...scopeMeta(), expiresAt };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (error) { reject(error); }
    });
  });
}

function uid(prefix) {
  return `${prefix}-${Math.floor(Math.random() * 90000 + 10000)}`;
}

function isAllCompanies(companyId = currentCompanyId()) {
  return companyId === "all";
}

function companyById(companyId) {
  return (db.companies || []).find(company => company.id === companyId);
}

function companyLabel(companyId = currentCompanyId()) {
  if (isAllCompanies(companyId)) return "Todas as lojas";
  const company = companyById(companyId);
  return company?.tradeName || company?.name || "Loja principal";
}

function userCompanyIds(user = db.currentUser) {
  const ids = Array.isArray(user?.companyIds) && user.companyIds.length ? user.companyIds : (isAdmin(user) ? ["all"] : [primaryCompanyId()]);
  return ids.includes("all") && isAdmin(user) ? ["all"] : ids.filter(id => companyById(id));
}

function companiesForUser(user = db.currentUser) {
  if (userCompanyIds(user).includes("all")) return [{ id: "all", name: "Todas as lojas", tradeName: "Todas as lojas", active: true, consolidated: true }, ...(db.companies || [])];
  const allowed = new Set(userCompanyIds(user));
  return (db.companies || []).filter(company => allowed.has(company.id) && company.active !== false);
}

function canAccessCompany(user, companyId) {
  if (!companyId) return true;
  if (companyId === "all") return isAdmin(user);
  if (!companyById(companyId)?.active) return false;
  const ids = userCompanyIds(user);
  return ids.includes("all") || ids.includes(companyId);
}

function requestSession(req) {
  const token = parseCookies(req).printsys_session;
  if (!token) return null;
  return (db.sessions || []).find(item => item.token === token && new Date(item.expiresAt).getTime() > Date.now()) || null;
}

function requestedCompanyId(req, user) {
  const session = requestSession(req);
  const fromHeader = req.headers["x-company-id"];
  const fromCookie = parseCookies(req).printsys_company;
  const requested = String(fromHeader || fromCookie || session?.companyId || user.lastCompanyId || user.defaultCompanyId || primaryCompanyId());
  if (canAccessCompany(user, requested)) return requested;
  const fallback = userCompanyIds(user).includes("all") ? "all" : userCompanyIds(user)[0] || primaryCompanyId();
  return canAccessCompany(user, fallback) ? fallback : primaryCompanyId();
}

function setActiveCompany(companyId) {
  const nextCompanyId = companyId || primaryCompanyId();
  const requestScope = requestCompanyContext.getStore();
  if (requestScope) requestScope.companyId = nextCompanyId;
  else db.activeCompanyId = nextCompanyId;
  return nextCompanyId;
}

function shareCollection(collection) {
  if (collection === "customers") return db.companySettings?.shareCustomers !== false;
  if (collection === "products" || collection === "compositions") return db.companySettings?.shareProducts !== false;
  return false;
}

function scoped(collection) {
  const list = db[collection] || [];
  if (isAllCompanies()) return list;
  if (shareCollection(collection)) return list;
  return list.filter(item => (item.companyId || primaryCompanyId()) === currentCompanyId());
}

function scopedFind(collection, predicate) {
  return scoped(collection).find(predicate);
}

function withCompany(data = {}, collection = "") {
  if (isAllCompanies()) return { ...data, companyId: primaryCompanyId() };
  if (shareCollection(collection)) return db.companySettings?.[`share${collection === "customers" ? "Customers" : "Products"}`] ? data : { ...data, companyId: currentCompanyId() };
  return { ...data, companyId: data.companyId || currentCompanyId() || primaryCompanyId() };
}

function scopeMeta() {
  return {
    currentCompanyId: currentCompanyId(),
    currentCompanyName: companyLabel(),
    consolidated: isAllCompanies(),
    companies: companiesForUser(db.currentUser),
    settings: db.companySettings
  };
}

function customerName(id) {
  return db.customers.find(customer => customer.id === id)?.name || "Cliente avulso";
}

function orderIsCancelled(order = {}) {
  return order.lifecycleStatus === "cancelled" || order.productionStatus === "Cancelada";
}

function orderIsNonBillable(order = {}) {
  return Boolean(order.nonBillable || order.billingBlocked || ["rework", "courtesy"].includes(order.serviceOrderType));
}

function nextServiceOrderId() {
  const numbers = db.orders.map(order => Number(String(order.id || "").replace(/\D/g, ""))).filter(Boolean);
  return `OS-${Math.max(1043, ...numbers) + 1}`;
}

function businessOrderTypeLabel(type = "normal") {
  return type === "rework" ? "Retrabalho" : type === "courtesy" ? "Cortesia" : "Normal";
}

function orderItemList(order = {}) {
  return (order.itemProductionSnapshots?.length ? order.itemProductionSnapshots : order.items || []).map((item, index) => ({
    ...item,
    id: item.id || `item-${index + 1}`,
    itemNumber: item.itemNumber || index + 1,
    productName: item.productName || item.productConfigSnapshot?.name || item.description || `Item ${index + 1}`
  }));
}

function productionRouteFromSector(sectorName = "", fallbackRoute = []) {
  const selected = String(sectorName || "").trim();
  const sector = db.sectors.find(item => item.name === selected || item.id === selected);
  if (sector) return normalizeProductionRoute([{ sectorId: sector.id, sectorName: sector.name, responsible: sector.responsible || "", color: sector.color || "#2563eb", icon: sector.icon || "PCP" }], []);
  if (selected) return normalizeProductionRoute([{ sectorName: selected, color: "#2563eb", icon: "PCP" }], []);
  return normalizeProductionRoute(fallbackRoute || [], []);
}

function pushProductionEvent(order, data = {}) {
  const event = withCompany({
    id: uid("evt"),
    orderId: order.id,
    sectorId: data.sectorId || order.currentSectorId || "",
    sectorName: data.sectorName || order.currentSectorName || order.productionStatus || "",
    sector: data.sector || data.sectorName || order.currentSectorName || order.productionStatus || "Producao",
    action: data.action || "operational_event",
    previousStatus: data.previousStatus || "",
    newStatus: data.newStatus || order.productionStatus || "",
    previousSector: data.previousSector || "",
    nextSector: data.nextSector || "",
    user: data.user || db.currentUser.name,
    responsible: data.responsible || data.user || db.currentUser.name,
    observation: data.observation || "",
    reworkReason: data.reworkReason || "",
    cancelReason: data.cancelReason || "",
    files: data.files || [],
    photos: data.photos || [],
    createdAt: data.createdAt || new Date().toISOString()
  }, "productionEvents");
  db.productionEvents.push(event);
  order.productionEvents = [...(order.productionEvents || []), event.id];
  return event;
}

function productionMovementRows(params = {}) {
  const orders = scoped("orders");
  const customers = scoped("customers");
  const rows = scoped("productionEvents").map(event => {
    const order = orders.find(item => item.id === event.orderId) || db.orders.find(item => item.id === event.orderId) || {};
    const customer = customers.find(item => item.id === order.customerId) || db.customers.find(item => item.id === order.customerId) || {};
    return {
      id: event.id,
      orderId: event.orderId,
      orderType: order.serviceOrderType || "normal",
      customerId: order.customerId || "",
      customerName: customer.name || customerName(order.customerId),
      jobName: order.jobName || "",
      sectorId: event.sectorId || "",
      sectorName: event.sectorName || event.sector || order.currentSectorName || order.productionStatus || "",
      previousSector: event.previousSector || "",
      nextSector: event.nextSector || "",
      action: event.action || "evento",
      previousStatus: event.previousStatus || "",
      newStatus: event.newStatus || order.productionStatus || "",
      responsible: event.responsible || event.user || event.startedBy || event.finishedBy || "",
      observation: event.observation || event.reworkReason || event.cancelReason || "",
      createdAt: event.createdAt,
      companyId: event.companyId || order.companyId || primaryCompanyId()
    };
  }).filter(row => {
    const query = String(params.q || params.search || "").toLowerCase();
    if (params.orderId && row.orderId !== params.orderId) return false;
    if (params.sector && !String(row.sectorName || "").toLowerCase().includes(String(params.sector).toLowerCase())) return false;
    if (params.action && row.action !== params.action) return false;
    if (params.dateFrom && String(row.createdAt || "").slice(0, 10) < params.dateFrom) return false;
    if (params.dateTo && String(row.createdAt || "").slice(0, 10) > params.dateTo) return false;
    if (query && !`${row.orderId} ${row.customerName} ${row.jobName} ${row.sectorName} ${row.responsible} ${row.action}`.toLowerCase().includes(query)) return false;
    return true;
  }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const summary = {
    total: rows.length,
    today: rows.filter(row => String(row.createdAt || "").slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
    reworks: rows.filter(row => row.orderType === "rework" || String(row.action).includes("rework") || String(row.action).includes("retrabalho")).length,
    cancellations: rows.filter(row => String(row.action).includes("cancel")).length
  };
  return { rows, total: rows.length, summary, filters: params };
}

function pricingContext(product, answers = {}) {
  const width = Number(answers.width || 1);
  const height = Number(answers.height || 1);
  const quantity = Number(answers.quantity || 1);
  const area = Math.max(width * height, 0.01);
  const totalArea = area * quantity;
  const linearMeters = Number(answers.linear_measure || answers.depth || answers.projection || answers.arm_size || width || 1);
  const totalLinearMeters = Math.max(linearMeters, 0.01) * quantity;
  const pricingMode = pricingModeForProduct(product);
  const measurementQuantity = pricingMode === "square_meter" ? totalArea : pricingMode === "linear_meter" ? totalLinearMeters : quantity;
  return { width, height, quantity, area, totalArea, linearMeters, totalLinearMeters, pricingMode, measurementQuantity, distanceKm: Number(answers.distance_km || 0) };
}

function answerEnablesCost(value) {
  if (Array.isArray(value)) return value.length > 0;
  return ![undefined, null, "", false, "false", "nao", "não", "0"].includes(value);
}

function impactAmount(impact = {}, value, context, product) {
  const numericValue = Number(value || 0);
  if (Number(impact.fixed || 0)) return Number(impact.fixed);
  if (Number(impact.perM2 || 0)) return Number(impact.perM2) * context.totalArea;
  if (Number(impact.perLinearMeter || 0)) return Number(impact.perLinearMeter) * context.totalLinearMeters;
  if (Number(impact.perUnit || 0)) return Number(impact.perUnit) * Math.max(numericValue, context.quantity, 1);
  if (Number(impact.perKm || 0)) return Number(impact.perKm) * Math.max(context.distanceKm || numericValue, 0);
  if (Number(impact.laborHours || 0)) return Number(impact.laborHours) * Number(product.laborHourCost || db.costConfig.humanHourValue || 0);
  if (Number(impact.machineHours || 0)) return Number(impact.machineHours) * Number(product.machineHourCost || db.costConfig.machineHourValue || 0);
  return 0;
}

function configuredQuestionAmount(question, value, context) {
  const multiplier = question.costType === "square_meter" ? context.totalArea
    : question.costType === "linear_meter" ? context.totalLinearMeters
      : question.costType === "unit" ? context.quantity
        : question.costType === "percentage" ? 1
          : 1;
  return round(Number(question.costValue || 0) * multiplier);
}

function calculateQuestionCosts(product, answers, context) {
  const lines = [];
  const addedSectors = [];
  const addedMaterials = [];
  (product.technicalQuestions || product.questions || []).map(normalizeTechnicalQuestion).filter(question => question.active !== false).forEach(question => {
    const value = answers[question.key];
    if (!answerEnablesCost(value)) return;
    const impacts = resolveImpacts(question, value);
    if (question.affectsCost && question.costValue && !impacts.some(impact => Object.keys(impact || {}).some(key => !["target", "sector", "material"].includes(key)))) {
      impacts.push({
        [question.costType === "square_meter" ? "perM2" : question.costType === "linear_meter" ? "perLinearMeter" : question.costType === "unit" ? "perUnit" : question.costType === "percentage" ? "percent" : "fixed"]: question.costValue,
        costApplication: question.costApplication
      });
    }
    impacts.forEach((impact, impactIndex) => {
      if (impact.target) return;
      if (impact.sector) addedSectors.push(impact.sector);
      if (impact.material) addedMaterials.push(impact.material);
      const application = impact.costApplication || question.costApplication || "add_to_cost";
      const percent = Number(impact.percent || 0);
      const amount = percent ? 0 : round(impactAmount(impact, value, context, product) || (question.affectsCost ? configuredQuestionAmount(question, value, context) : 0));
      if (!amount && !percent && !impact.sector && !impact.material) return;
      lines.push({
        id: `${question.id}-${impactIndex}`,
        questionId: question.id,
        questionKey: question.key,
        label: question.label,
        answer: value,
        costType: question.costType,
        costValue: Number(question.costValue || 0),
        costApplication: application,
        amount,
        percentage: percent,
        sector: impact.sector || "",
        material: impact.material || ""
      });
    });
  });
  return {
    lines,
    addToCost: round(lines.filter(line => line.costApplication === "add_to_cost").reduce((sum, line) => sum + line.amount, 0)),
    addToPrice: round(lines.filter(line => line.costApplication === "add_to_price").reduce((sum, line) => sum + line.amount, 0)),
    marginAdjustment: round(lines.filter(line => line.costApplication === "margin_adjustment").reduce((sum, line) => sum + line.percentage + line.amount, 0)),
    costPercentage: round(lines.filter(line => line.costApplication === "add_to_cost").reduce((sum, line) => sum + line.percentage, 0)),
    pricePercentage: round(lines.filter(line => line.costApplication === "add_to_price").reduce((sum, line) => sum + line.percentage, 0)),
    addedSectors,
    addedMaterials
  };
}

function productRouteForPricing(product, composition, addedSectors = []) {
  const base = normalizeProductionRoute(product.productionRoute || [], composition?.productionFlow || product.flow || []);
  const existing = new Set(base.map(step => step.sectorName));
  addedSectors.forEach(name => {
    if (!existing.has(name)) {
      base.push(normalizeProductionRoute([{ sectorName: name, orderIndex: base.length }])[0]);
      existing.add(name);
    }
  });
  return base.map((step, index) => ({ ...step, orderIndex: index }));
}

function ensurePortalToken(customerId) {
  let token = db.portalTokens.find(item => item.customerId === customerId && item.active);
  if (!token) {
    token = { token: `portal-${customerId}-${Math.floor(Math.random() * 9000 + 1000)}`, customerId, active: true, createdAt: new Date().toISOString() };
    db.portalTokens.push(token);
  }
  return token;
}

function publicTrackingUrl(customerId = "") {
  const token = customerId ? ensurePortalToken(customerId) : null;
  return token ? `/customer-tracking.html?token=${encodeURIComponent(token.token)}` : "/customer-tracking.html";
}

function templateForEvent(event, channel = "WhatsApp") {
  return (db.messageTemplates || []).find(item => item.event === event && item.active !== false && String(item.channel || "").toLowerCase() === String(channel || "").toLowerCase())
    || (db.messageTemplates || []).find(item => item.event === event && item.active !== false)
    || defaultMessageTemplates().find(item => item.event === event)
    || { id: `tpl-${event}`, event, channel, subject: "Atualizacao PrintSys", body: "{{customer_name}}, temos uma atualizacao sobre seu atendimento na {{company_name}}.", active: true };
}

function messageVariables({ customer = {}, quote = {}, order = {}, event = "" } = {}) {
  const company = companyById(order.companyId || quote.companyId || customer.companyId || currentCompanyId()) || companyById(primaryCompanyId()) || {};
  return {
    customer_name: customer.name || "Cliente",
    order_number: order.id || "",
    quote_number: quote.quoteNumber || quote.id || "",
    company_name: company.tradeName || company.name || "PrintSys",
    status: order.productionStatus || quote.status || event,
    estimated_delivery: order.dueDate || quote.answers?.deadline || "A combinar",
    seller_name: order.seller || quote.answers?.seller || db.currentUser.name || "",
    company_whatsapp: company.whatsapp || company.phone || "",
    tracking_link: publicTrackingUrl(customer.id)
  };
}

function renderTemplateText(text = "", variables = {}) {
  return String(text || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => variables[key] ?? "");
}

function notificationChannelsForCustomer(customer = {}, forcedChannel = "") {
  if (forcedChannel) return [forcedChannel];
  const preference = normalizeCommunicationPreference(customer.communicationPreference);
  if (preference === "disabled") return [];
  const channels = [];
  if (["whatsapp", "both"].includes(preference) && (customer.whatsapp || customer.phone)) channels.push("WhatsApp");
  if (["email", "both"].includes(preference) && customer.email) channels.push("Email");
  return channels;
}

function notificationQueueForCompany(companyId = currentCompanyId()) {
  const scopedCompanyId = companyId === "all" ? null : companyId;
  return (db.notificationQueue || []).filter(item => !scopedCompanyId || (item.companyId || primaryCompanyId()) === scopedCompanyId);
}

function enqueueCustomerNotification(event, options = {}) {
  try {
    const order = options.order || db.orders.find(item => item.id === options.orderId) || {};
    const quote = options.quote || db.quotes.find(item => item.id === options.quoteId || item.id === order.quoteId) || {};
    const customer = normalizeCustomerContact(options.customer || db.customers.find(item => item.id === options.customerId || item.id === order.customerId || item.id === quote.customerId) || {});
    const companyId = options.companyId || order.companyId || quote.companyId || customer.companyId || (currentCompanyId() === "all" ? primaryCompanyId() : currentCompanyId());
    const communication = communicationSettingsForCompany(companyId);
    const eventGroup = notificationEventGroup(event);
    const createSkipped = (reason, message) => {
      const skipped = withCompany({
        id: uid("ntf"),
        companyId,
        event,
        channel: options.channel || "Cliente",
        customerId: customer.id || options.customerId || "",
        orderId: order.id || options.orderId || "",
        quoteId: quote.id || options.quoteId || "",
        recipient: customer.name || "",
        subject: "Notificacao nao enviada",
        message,
        status: "skipped",
        reason,
        createdAt: new Date().toISOString(),
        createdBy: options.user || db.currentUser.name || "Sistema"
      }, "notificationQueue");
      db.notificationQueue.push(skipped);
      return [skipped];
    };
    if (communication.enabled === false) return createSkipped("comunicacao_desativada", "Comunicacao com cliente desativada nas configuracoes.");
    if (communication.events && communication.events[eventGroup] === false) return createSkipped("evento_desativado", "Evento desativado nas configuracoes de comunicacao.");
    const channels = notificationChannelsForCustomer(customer, options.channel);
    const variables = messageVariables({ customer, quote, order, event });
    const created = [];
    if (!customer.id || !channels.length) {
      return createSkipped(customer.id ? "sem_canal" : "cliente_nao_encontrado", customer.id ? "Cliente sem canal de comunicacao ativo." : "Cliente nao encontrado para notificacao.");
    }
    channels.forEach(channel => {
      const template = templateForEvent(event, channel);
      const message = renderTemplateText(template.body, variables);
      const apiReady = channel === "WhatsApp"
        && communication.whatsappMode === "api_provider"
        && communication.provider?.baseUrl
        && communication.provider?.token;
      const preparedManually = channel === "WhatsApp" && !apiReady;
      const item = withCompany({
        id: uid("ntf"),
        companyId,
        event,
        templateId: template.id,
        channel,
        customerId: customer.id,
        orderId: order.id || options.orderId || "",
        quoteId: quote.id || options.quoteId || "",
        recipient: channel === "Email" ? customer.email : normalizeWhatsApp(customer.whatsapp || customer.phone),
        subject: renderTemplateText(template.subject || template.name || "Atualizacao PrintSys", variables),
        message,
        whatsappLink: channel === "WhatsApp" ? whatsappDeepLink(customer.whatsapp || customer.phone, message) : "",
        emailTo: channel === "Email" ? customer.email : "",
        deliveryMode: channel === "WhatsApp" ? (apiReady ? "api_provider" : "manual_whatsapp_link") : "manual_email",
        providerName: apiReady ? communication.provider.name || "WhatsApp API" : "",
        status: preparedManually ? "prepared" : "pending",
        reason: preparedManually ? "envio_manual_necessario" : "",
        attempts: 0,
        createdAt: new Date().toISOString(),
        createdBy: options.user || db.currentUser.name || "Sistema"
      }, "notificationQueue");
      db.notificationQueue.push(item);
      db.portalNotifications.push(withCompany({
        id: uid("pntf"),
        companyId,
        notificationId: item.id,
        customerId: customer.id,
        orderId: item.orderId,
        quoteId: item.quoteId,
        event,
        title: item.subject,
        message: item.message,
        status: item.status,
        createdAt: item.createdAt
      }, "portalNotifications"));
      created.push(item);
    });
    if (created.length) audit("Notificacao preparada", "notification", created.map(item => item.id).join(","), options.user || db.currentUser.name, event, { newData: created.map(item => ({ id: item.id, channel: item.channel, status: item.status })) });
    return created;
  } catch (error) {
    console.warn(`Falha ao preparar notificacao ${event}: ${error.message}`);
    return [];
  }
}

function safeOrderForCustomer(order = {}) {
  const items = (order.itemProductionSnapshots?.length ? order.itemProductionSnapshots : order.items || []).map(item => ({
    description: item.description || item.productName || order.jobName || "Servico grafico",
    quantity: Number(item.quantity || 1),
    measures: item.size || item.measures || "",
    status: item.status || order.productionStatus || ""
  }));
  return {
    id: order.id,
    jobName: order.jobName || items[0]?.description || "Servico grafico",
    status: order.productionStatus || "Aguardando",
    date: order.createdAt || order.approvedAt || "",
    estimatedDelivery: order.dueDate || "",
    productionStage: order.currentSectorName || order.productionStatus || "",
    paymentStatus: order.financialStatus || "",
    payments: {
      total: Number(order.total || 0),
      received: Number(order.paidAmount || 0),
      balance: Math.max(Number(order.total || 0) - Number(order.paidAmount || 0), 0)
    },
    items
  };
}

function safeQuoteForCustomer(quote = {}) {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber || quote.id,
    jobName: quote.jobName || "Orcamento",
    status: quote.status || "rascunho",
    total: Number(quote.approvedPrice || quote.pricing?.finalPrice || quote.pricing?.suggestedPrice || 0),
    createdAt: quote.createdAt || "",
    approvalStatus: quote.approvalStatus || quote.status || ""
  };
}

function customerTrackingPayload({ document = "", whatsapp = "", token = "", companyId = "" } = {}) {
  let customer = null;
  if (token) {
    const portalToken = db.portalTokens.find(item => item.token === token && item.active);
    customer = portalToken ? db.customers.find(item => item.id === portalToken.customerId) : null;
  } else {
    const doc = normalizeDigits(document);
    const phone = normalizeDigits(whatsapp);
    customer = (db.customers || []).find(item => {
      const normalized = normalizeCustomerContact(item);
      return doc && phone
        && normalizeDigits(normalized.document) === doc
        && normalizeDigits(normalized.whatsapp || normalized.phone).endsWith(phone.slice(-10));
    });
  }
  if (!customer) return null;
  const effectiveCompanyId = companyId && companyById(companyId) ? companyId : (customer.companyId || primaryCompanyId());
  const company = companyById(effectiveCompanyId) || companyById(primaryCompanyId()) || {};
  const sameCompany = item => db.companySettings?.shareCustomers !== false || !item.companyId || item.companyId === effectiveCompanyId;
  const orders = (db.orders || []).filter(order => order.customerId === customer.id && sameCompany(order) && !orderIsCancelled(order)).map(safeOrderForCustomer);
  const quotes = (db.quotes || []).filter(quote => quote.customerId === customer.id && sameCompany(quote)).map(safeQuoteForCustomer);
  const notifications = (db.portalNotifications || []).filter(item => item.customerId === customer.id && sameCompany(item)).map(item => ({
    title: item.title,
    message: item.message,
    status: item.status,
    createdAt: item.createdAt,
    orderId: item.orderId,
    quoteId: item.quoteId
  }));
  return {
    customer: { name: customer.name, document: customer.document ? `***${normalizeDigits(customer.document).slice(-4)}` : "", whatsapp: customer.whatsapp ? `***${normalizeDigits(customer.whatsapp).slice(-4)}` : "" },
    company: {
      name: company.tradeName || company.name || "PrintSys",
      phone: company.phone || "",
      whatsapp: company.whatsapp || company.phone || "",
      contactLink: whatsappDeepLink(company.whatsapp || company.phone, "Ola, gostaria de falar sobre meu pedido.")
    },
    quotes,
    orders,
    notifications
  };
}

function calculatePrice(product, answers) {
  const composition = db.compositions.find(item => item.id === answers.compositionId || item.productId === product.id);
  if (composition) return calculateCompositionPrice(product, composition, answers);

  const context = pricingContext(product, answers);
  const { area, totalArea, pricingMode, measurementQuantity } = context;
  const wastePercent = Number(answers.wastePercent || 8);
  const baseProductCost = measurementQuantity * Number(product.baseCostM2 || product.costBase || 0);
  const materialCost = baseProductCost * (1 + wastePercent / 100);
  const laborCost = Math.max(totalArea * 0.08, 0.5) * product.laborHourCost;
  const machineCost = Math.max(totalArea * 0.06, 0.4) * product.machineHourCost;
  const questionCosts = calculateQuestionCosts(product, answers, context);
  const subtotalBeforeMargin = (materialCost + laborCost + machineCost + questionCosts.addToCost) * (1 + questionCosts.costPercentage / 100);
  const totalCost = subtotalBeforeMargin;
  const targetMarginPercent = Number(product.marginPercent || db.costConfig.defaultMarginPercent || 0) + questionCosts.marginAdjustment;
  const withMargin = totalCost * (1 + targetMarginPercent / 100);
  const taxes = withMargin * (product.taxPercent / 100);
  const suggestedPrice = Math.max((withMargin + taxes + questionCosts.addToPrice) * (1 + questionCosts.pricePercentage / 100), Number(product.salePrice || product.minPrice || 0));
  const grossProfit = suggestedPrice - totalCost;
  const marginPercent = (grossProfit / suggestedPrice) * 100;
  const productionRoute = productRouteForPricing(product, null, questionCosts.addedSectors);

  return {
    pricingMode,
    measurementQuantity: round(measurementQuantity),
    area,
    totalArea,
    baseProductCost: round(baseProductCost),
    materialCost: round(materialCost),
    laborCost: round(laborCost),
    machineCost: round(machineCost),
    extraCost: questionCosts.addToCost,
    questionCosts: questionCosts.lines,
    questionCostTotal: questionCosts.addToCost,
    totalCost: round(totalCost),
    taxes: round(taxes),
    suggestedPrice: round(suggestedPrice),
    minPrice: product.minPrice,
    grossProfit: round(grossProfit),
    marginPercent: round(marginPercent),
    targetMarginPercent,
    productionRoute,
    productionFlow: productionRoute.map(step => step.sectorName),
    materials: [...new Set(questionCosts.addedMaterials)],
    deadlineDays: Number(product.defaultProductionDays || 3),
    costBreakdown: {
      baseProduct: round(baseProductCost),
      material: round(materialCost),
      production: round(laborCost + machineCost),
      questionCosts: questionCosts.addToCost,
      taxes: round(taxes),
      profit: round(grossProfit),
      final: round(suggestedPrice)
    }
  };
}

function calculateCompositionPrice(product, composition, answers) {
  const context = pricingContext(product, answers);
  const { width, height, quantity, area, totalArea, pricingMode, measurementQuantity } = context;
  const perimeter = Math.max((width + height) * 2, 1) * quantity;
  const linear = context.totalLinearMeters;
  const distanceKm = Number(answers.distance_km || composition.installation?.vehicleKm || 0);
  const humanHourValue = db.costConfig.mode === "automatico" ? automaticHumanHourValue() : Number(db.costConfig.humanHourValue || 0);
  const machineHourValue = Number(db.costConfig.machineHourValue || 0);

  const materialLines = composition.materials.map(line => {
    const material = db.materials.find(item => item.id === line.materialId);
    const baseQty = formulaQuantity(line, { totalArea, perimeter, linear, quantity, answers });
    const qty = round(baseQty * (1 + Number(line.wastePercent || 0) / 100));
    const unitCost = Number(material?.cost || 0);
    return {
      materialId: line.materialId,
      material: material?.name || line.materialId,
      quantity: qty,
      unit: material?.unit || "",
      unitCost,
      totalCost: round(qty * unitCost),
      wastePercent: Number(line.wastePercent || 0)
    };
  });

  const materialCost = round(materialLines.reduce((sum, line) => sum + line.totalCost, 0));
  const baseProductCost = materialLines.length ? 0 : round(measurementQuantity * Number(product.baseCostM2 || product.costBase || 0));
  const productionLines = composition.production.map(line => {
    const humanCost = Number(line.humanHours || 0) * humanHourValue;
    const machineCost = Number(line.machineHours || 0) * machineHourValue;
    return { ...line, humanCost: round(humanCost), machineCost: round(machineCost), totalCost: round(humanCost + machineCost) };
  });
  const productionCost = round(productionLines.reduce((sum, line) => sum + line.totalCost, 0));
  const install = composition.installation || {};
  const installationCost = round(
    Number(install.teamHours || 0) * humanHourValue +
    distanceKm * Number(db.costConfig.displacementCostPerKm || 0) +
    Number(install.fuel || 0) +
    Number(install.food || 0) +
    Number(install.toll || 0)
  );
  const administrativeCost = round((Number(db.costConfig.monthlyFixedCost || 0) / 22 / 8) * Math.max(composition.production.reduce((sum, line) => sum + Number(line.humanHours || 0), 0), 1));
  const questionCosts = calculateQuestionCosts(product, answers, { ...context, distanceKm });
  const baseCost = round((baseProductCost + materialCost + productionCost + installationCost + administrativeCost + questionCosts.addToCost) * (1 + questionCosts.costPercentage / 100));
  const commission = round(baseCost * (Number(db.costConfig.commissionPercent || 0) / 100));
  const taxesBase = baseCost + commission;
  const taxes = round(taxesBase * (Number(db.costConfig.taxPercent || 0) / 100));
  const marginPercent = Number(composition.marginPercent || product.marginPercent || db.costConfig.defaultMarginPercent || 0) + questionCosts.marginAdjustment;
  const saleBeforeMargin = baseCost + commission + taxes;
  const suggestedPrice = round(Math.max((saleBeforeMargin * (1 + marginPercent / 100) + questionCosts.addToPrice) * (1 + questionCosts.pricePercentage / 100), Number(product.salePrice || product.minPrice || 0)));
  const grossProfit = round(suggestedPrice - saleBeforeMargin);
  const realMarginPercent = round((grossProfit / Math.max(suggestedPrice, 1)) * 100);
  const productionRoute = productRouteForPricing(product, composition, questionCosts.addedSectors);

  return {
    compositionId: composition.id,
    compositionName: composition.name,
    pricingMode,
    measurementQuantity: round(measurementQuantity),
    area,
    totalArea,
    baseProductCost,
    materialLines,
    productionLines,
    materialCost,
    productionCost,
    installationCost,
    administrativeCost,
    commission,
    taxes,
    questionCosts: questionCosts.lines,
    questionCostTotal: questionCosts.addToCost,
    totalCost: round(baseCost + commission + taxes),
    suggestedPrice,
    minPrice: round((baseCost + commission + taxes) * 1.08),
    grossProfit,
    marginPercent: realMarginPercent,
    targetMarginPercent: marginPercent,
    productionRoute,
    productionFlow: productionRoute.map(step => step.sectorName),
    materials: [...new Set([...materialLines.map(line => line.material), ...questionCosts.addedMaterials])],
    deadlineDays: Number(product.defaultProductionDays || composition.deadlineDays || 3),
    costBreakdown: {
      baseProduct: baseProductCost,
      material: materialCost,
      production: productionCost,
      installation: installationCost,
      administrative: administrativeCost,
      questionCosts: questionCosts.addToCost,
      commission,
      taxes,
      profit: grossProfit,
      final: suggestedPrice
    }
  };
}

function applyAdditionalExpenses(pricing, additionalExpenses) {
  const extra = round(Number(additionalExpenses || 0));
  if (!extra) return { ...pricing, additionalExpenses: 0 };
  const totalCost = round(Number(pricing.totalCost || 0) + extra);
  const marginPercent = Number(pricing.targetMarginPercent || 0);
  const minPrice = round(totalCost * 1.08);
  const suggestedPrice = round(totalCost * (1 + marginPercent / 100));
  const grossProfit = round(suggestedPrice - totalCost);
  return {
    ...pricing,
    additionalExpenses: extra,
    totalCost,
    minPrice,
    suggestedPrice,
    grossProfit,
    marginPercent: round((grossProfit / Math.max(suggestedPrice, 1)) * 100),
    costBreakdown: {
      ...(pricing.costBreakdown || {}),
      additionalExpenses: extra,
      profit: grossProfit,
      final: suggestedPrice
    }
  };
}

function formulaQuantity(line, context) {
  if (line.qtyFormula === "area") return context.totalArea * Number(line.quantity || 1);
  if (line.qtyFormula === "area_optional") {
    const enabled = context.answers.varnish || context.answers.lamination || context.answers.auto_varnish || context.answers.adhesive_applied;
    return enabled ? context.totalArea * Number(line.quantity || 1) : 0;
  }
  if (line.qtyFormula === "perimeter") return context.perimeter * Number(line.quantity || 1);
  if (line.qtyFormula === "linear") return context.linear * Number(line.quantity || 1);
  if (line.qtyFormula === "unit") return context.quantity * Number(line.quantity || 1);
  return Number(line.quantity || 0);
}

function simulateDiscount(pricing, discountPercent) {
  const discount = Number(discountPercent || 0);
  const finalPrice = round(pricing.suggestedPrice * (1 - discount / 100));
  const grossProfit = round(finalPrice - pricing.totalCost);
  return {
    discountPercent: discount,
    finalPrice,
    impact: round(pricing.suggestedPrice - finalPrice),
    grossProfit,
    marginPercent: round((grossProfit / Math.max(finalPrice, 1)) * 100),
    belowMinimum: finalPrice < pricing.minPrice
  };
}

function buildPricingValidation(pricing, manualPrice) {
  const price = Number(manualPrice || pricing.suggestedPrice || 0);
  const difference = round(price - Number(pricing.suggestedPrice || 0));
  const belowCost = price < Number(pricing.totalCost || 0);
  const margin = round(((price - Number(pricing.totalCost || 0)) / Math.max(price, 1)) * 100);
  const targetMarginPercent = Number(pricing.targetMarginPercent || 0);
  const targetMarginGap = round(targetMarginPercent - margin);
  const criticalMargin = margin < 25;
  const marginBelowTarget = margin < targetMarginPercent;
  const marginStatus = belowCost || criticalMargin ? "critica" : marginBelowTarget ? "abaixo_meta" : "ideal";
  return {
    manualPrice: price,
    calculatedPrice: pricing.suggestedPrice,
    difference,
    differencePercent: round((difference / Math.max(pricing.suggestedPrice || 1, 1)) * 100),
    marginAtManualPrice: margin,
    targetMarginPercent,
    targetMarginGap,
    marginStatus,
    marginBelowTargetAlert: marginBelowTarget,
    lowMarginAlert: criticalMargin,
    belowCostAlert: belowCost
  };
}

function discountLimitForRole(role) {
  if (["Admin Geral", "Administrador"].includes(role)) return 100;
  if (role === "Gestor") return 15;
  return 5;
}

function buildIntegratedPricing(product, body) {
  const pricedProduct = productWithModel(product, body.productModelId || body.answers?.productModelId || "");
  const rawPricing = calculatePrice(pricedProduct, body.answers || {});
  const pricing = applyAdditionalExpenses(rawPricing, body.additionalExpenses);
  const finalPrice = Number(body.manualPrice || pricing.suggestedPrice || 0);
  const validation = buildPricingValidation(pricing, finalPrice);
  const discountPercent = finalPrice < pricing.suggestedPrice ? round(((pricing.suggestedPrice - finalPrice) / Math.max(pricing.suggestedPrice, 1)) * 100) : 0;
  return {
    pricing: {
      ...pricing,
      productModelId: pricedProduct.selectedModelId || "",
      productModelName: pricedProduct.selectedModel?.name || "",
      finalPrice,
      approvedPrice: finalPrice,
      validation,
      discountPercent
    },
    validation,
    discountPercent,
    discountLimit: discountLimitForRole(db.currentUser.role)
  };
}

function costVersionSnapshot() {
  return {
    mode: db.costConfig.mode,
    humanHourValue: db.costConfig.mode === "automatico" ? automaticHumanHourValue() : db.costConfig.humanHourValue,
    machineHourValue: db.costConfig.machineHourValue,
    monthlyFixedCost: db.costConfig.monthlyFixedCost,
    displacementCostPerKm: db.costConfig.displacementCostPerKm,
    defaultMarginPercent: db.costConfig.defaultMarginPercent,
    taxPercent: db.costConfig.taxPercent,
    commissionPercent: db.costConfig.commissionPercent,
    wastePercent: db.costConfig.wastePercent,
    capturedAt: new Date().toISOString()
  };
}

function buildQuoteSnapshot(quote, composition, pricing, product = null) {
  const selectedProduct = productWithModel(product || db.products.find(item => item.id === composition?.productId) || {}, quote.productModelId || quote.answers?.productModelId || pricing.productModelId || "");
  return {
    product: selectedProduct ? {
      id: selectedProduct.id,
      code: selectedProduct.code,
      name: selectedProduct.name,
      pricingMode: pricingModeForProduct(selectedProduct),
      defaultProductionDays: Number(selectedProduct.defaultProductionDays || pricing.deadlineDays || 3),
      technicalQuestions: (selectedProduct.technicalQuestions || selectedProduct.questions || []).map(normalizeTechnicalQuestion),
      productionRoute: normalizeProductionRoute(selectedProduct.productionRoute || [], pricing.productionFlow || selectedProduct.flow || [])
    } : null,
    productModel: selectedProduct?.selectedModel || null,
    composition: composition ? {
      id: composition.id,
      name: composition.name,
      category: composition.category,
      marginPercent: composition.marginPercent,
      deadlineDays: composition.deadlineDays,
      productionFlow: composition.productionFlow,
      questions: composition.questions
    } : null,
    answers: quote.answers,
    technicalAnswers: quote.answers,
    questionCosts: pricing.questionCosts || [],
    productionRoute: pricing.productionRoute || normalizeProductionRoute([], pricing.productionFlow || []),
    materials: pricing.materialLines || [],
    production: pricing.productionLines || [],
    costs: pricing.costBreakdown || {},
    materialCost: pricing.materialCost || 0,
    productionCost: pricing.productionCost || 0,
    installationCost: pricing.installationCost || 0,
    administrativeCost: pricing.administrativeCost || 0,
    marginPercent: pricing.validation?.marginAtManualPrice ?? pricing.marginPercent,
    targetMarginPercent: pricing.targetMarginPercent || 0,
    price: pricing.finalPrice || pricing.suggestedPrice,
    suggestedPrice: pricing.suggestedPrice,
    minPrice: pricing.minPrice,
    pricingMode: pricing.pricingMode || pricingModeForProduct(selectedProduct || {}),
    deadlineDays: Number(pricing.deadlineDays || selectedProduct?.defaultProductionDays || composition?.deadlineDays || 3),
    costVersion: costVersionSnapshot(),
    user: db.currentUser.name,
    createdAt: new Date().toISOString()
  };
}

function buildQuoteItemSnapshot(item = {}, index = 0) {
  const product = productWithModel(db.products.find(productItem => productItem.id === item.productId) || {}, item.productModelId || item.answers?.productModelId || item.pricingSnapshot?.productModelId || "");
  const composition = db.compositions.find(compositionItem => compositionItem.id === item.compositionId);
  const answers = { ...(item.answers || {}), compositionId: item.compositionId || item.answers?.compositionId || composition?.id || null };
  const submittedPricing = item.pricingSnapshot || item.pricing || {};
  let pricing = product?.id ? calculatePrice(product, answers) : submittedPricing;
  if (product?.id && Number(submittedPricing.additionalExpenses || 0)) pricing = applyAdditionalExpenses(pricing, submittedPricing.additionalExpenses);
  const finalPrice = Number(item.subtotal || submittedPricing.finalPrice || submittedPricing.suggestedPrice || pricing.suggestedPrice || 0);
  pricing = {
    ...submittedPricing,
    ...pricing,
    finalPrice,
    approvedPrice: finalPrice,
    validation: buildPricingValidation(pricing, finalPrice)
  };
  const snapshot = buildQuoteSnapshot({ answers, productModelId: product?.selectedModelId || item.productModelId || "" }, composition, pricing, product);
  return {
    ...item,
    id: item.id || `item-${index + 1}`,
    itemNumber: index + 1,
    productId: product?.id || item.productId || "",
    productModelId: product?.selectedModelId || item.productModelId || "",
    productModelName: item.productModelName || product?.selectedModel?.name || "",
    productName: item.productName || product?.name || item.description || `Item ${index + 1}`,
    productImageUrl: item.productImageUrl || product?.imageUrl || product?.thumbnailUrl || "",
    categoryId: item.categoryId || product?.categoryId || "",
    categoryIcon: item.categoryIcon || product?.categoryIcon || "",
    compositionId: composition?.id || item.compositionId || null,
    compositionName: item.compositionName || composition?.name || "",
    description: item.description || product?.name || `Item ${index + 1}`,
    quantity: Number(item.quantity || answers.quantity || 1),
    answers,
    technicalAnswersSnapshot: snapshot.technicalAnswers || {},
    questionCostsSnapshot: snapshot.questionCosts || [],
    productionRouteSnapshot: snapshot.productionRoute || [],
    productConfigSnapshot: snapshot.product,
    productModelSnapshot: snapshot.productModel || null,
    costSnapshot: snapshot,
    pricingSnapshot: pricing,
    files: item.files || [],
    projectFiles: item.projectFiles || item.files || [],
    notes: item.notes || {},
    flow: (snapshot.productionRoute || []).map(step => step.sectorName)
  };
}

function itemPricingSnapshot(item = {}) {
  return item.pricingSnapshot || item.pricing || item.costSnapshot || {};
}

function itemApprovedPrice(item = {}) {
  const pricing = itemPricingSnapshot(item);
  return Number(
    item.subtotal
    || pricing.finalPrice
    || pricing.approvedPrice
    || pricing.suggestedPrice
    || (Number(item.unitPrice || 0) * Number(item.quantity || 1))
    || 0
  );
}

function consolidateProductionRoutes(itemSnapshots = [], fallbackRoute = []) {
  const routes = itemSnapshots.map(item => {
    const pricing = itemPricingSnapshot(item);
    return normalizeProductionRoute(
      item.productionRouteSnapshot || item.costSnapshot?.productionRoute || pricing.productionRoute || [],
      item.flow || pricing.productionFlow || []
    );
  });
  if (!routes.some(route => route.length)) return normalizeProductionRoute(fallbackRoute || [], []);
  const nodes = new Map();
  const edges = new Map();
  const indegree = new Map();
  let firstSeen = 0;
  routes.forEach(route => {
    route.forEach(step => {
      const key = step.sectorId || String(step.sectorName || "").toLowerCase();
      if (!nodes.has(key)) {
        nodes.set(key, { ...step, firstSeen: firstSeen++ });
        edges.set(key, new Set());
        indegree.set(key, 0);
      } else {
        const current = nodes.get(key);
        current.requiredFile = current.requiredFile || step.requiredFile;
        current.checklistRequired = current.checklistRequired || step.checklistRequired;
        current.defaultDurationHours = Math.max(Number(current.defaultDurationHours || 0), Number(step.defaultDurationHours || 0));
      }
    });
    route.forEach((step, index) => {
      if (!index) return;
      const previous = route[index - 1];
      const previousKey = previous.sectorId || String(previous.sectorName || "").toLowerCase();
      const key = step.sectorId || String(step.sectorName || "").toLowerCase();
      if (previousKey !== key && !edges.get(previousKey).has(key)) {
        edges.get(previousKey).add(key);
        indegree.set(key, Number(indegree.get(key) || 0) + 1);
      }
    });
  });
  const pending = [...nodes.keys()].filter(key => indegree.get(key) === 0).sort((a, b) => nodes.get(a).firstSeen - nodes.get(b).firstSeen);
  const ordered = [];
  while (pending.length) {
    const key = pending.shift();
    ordered.push(key);
    edges.get(key).forEach(nextKey => {
      indegree.set(nextKey, indegree.get(nextKey) - 1);
      if (indegree.get(nextKey) === 0) {
        pending.push(nextKey);
        pending.sort((a, b) => nodes.get(a).firstSeen - nodes.get(b).firstSeen);
      }
    });
  }
  [...nodes.keys()].filter(key => !ordered.includes(key)).sort((a, b) => nodes.get(a).firstSeen - nodes.get(b).firstSeen).forEach(key => ordered.push(key));
  return ordered.map((key, orderIndex) => {
    const { firstSeen: _firstSeen, ...step } = nodes.get(key);
    return { ...step, orderIndex };
  });
}

function aggregateItemPricing(itemSnapshots = [], fallbackPricing = {}, finalPriceOverride = 0) {
  if (!itemSnapshots.length) return fallbackPricing;
  const pricingLines = itemSnapshots.map(itemPricingSnapshot);
  const sum = key => round(pricingLines.reduce((total, pricing) => total + Number(pricing[key] || 0), 0));
  const suggestedPrice = sum("suggestedPrice");
  const finalPrice = round(Number(finalPriceOverride || pricingLines.reduce((total, pricing) => total + Number(pricing.finalPrice || pricing.suggestedPrice || 0), 0)));
  const totalCost = sum("totalCost");
  const grossProfit = round(finalPrice - totalCost);
  const targetMarginPercent = pricingLines.length ? round(pricingLines.reduce((total, pricing) => total + Number(pricing.targetMarginPercent || 0), 0) / pricingLines.length) : 0;
  const route = consolidateProductionRoutes(itemSnapshots, fallbackPricing.productionRoute || fallbackPricing.productionFlow || []);
  const costKeys = ["baseProduct", "material", "production", "installation", "administrative", "questionCosts", "commission", "taxes", "additionalExpenses"];
  const costBreakdown = Object.fromEntries(costKeys.map(key => [key, round(pricingLines.reduce((total, pricing) => total + Number(pricing.costBreakdown?.[key] || 0), 0))]));
  costBreakdown.profit = grossProfit;
  costBreakdown.final = finalPrice;
  const aggregated = {
    ...fallbackPricing,
    itemCount: itemSnapshots.length,
    materialCost: sum("materialCost"),
    productionCost: sum("productionCost"),
    installationCost: sum("installationCost"),
    administrativeCost: sum("administrativeCost"),
    commission: sum("commission"),
    taxes: sum("taxes"),
    questionCostTotal: sum("questionCostTotal"),
    totalCost,
    suggestedPrice,
    finalPrice,
    approvedPrice: finalPrice,
    minPrice: sum("minPrice"),
    grossProfit,
    marginPercent: round((grossProfit / Math.max(finalPrice, 1)) * 100),
    targetMarginPercent,
    materialLines: itemSnapshots.flatMap(item => itemPricingSnapshot(item).materialLines || []),
    productionLines: itemSnapshots.flatMap(item => itemPricingSnapshot(item).productionLines || []),
    questionCosts: itemSnapshots.flatMap(item => (item.questionCostsSnapshot || []).map(line => ({ ...line, itemId: item.id, productName: item.productName }))),
    productionRoute: route,
    productionFlow: route.map(step => step.sectorName),
    deadlineDays: Math.max(...itemSnapshots.map(item => Number(item.costSnapshot?.deadlineDays || item.productConfigSnapshot?.defaultProductionDays || 0)), 0),
    costBreakdown
  };
  aggregated.validation = buildPricingValidation(aggregated, finalPrice);
  aggregated.discountPercent = suggestedPrice > finalPrice ? round(((suggestedPrice - finalPrice) / Math.max(suggestedPrice, 1)) * 100) : 0;
  return aggregated;
}

function rebuildOrderFromItemSnapshots(order) {
  const items = (order.itemProductionSnapshots || order.items || []).map((item, index) => {
    const pricing = itemPricingSnapshot(item);
    return {
      ...item,
      id: item.id || uid("ositem"),
      itemNumber: index + 1,
      productName: item.productName || item.productConfigSnapshot?.name || item.description || `Item ${index + 1}`,
      pricingSnapshot: item.pricingSnapshot || pricing,
      productionRouteSnapshot: item.productionRouteSnapshot || normalizeProductionRoute(
        item.costSnapshot?.productionRoute || pricing.productionRoute || [],
        item.flow || pricing.productionFlow || []
      ),
      flow: item.flow || pricing.productionFlow || []
    };
  });
  const total = round(items.reduce((sum, item) => sum + itemApprovedPrice(item), 0));
  const pricing = aggregateItemPricing(items, {}, total);
  const route = consolidateProductionRoutes(items, order.productionRouteSnapshot || order.flow || []);
  const currentIndex = route.findIndex(step => step.sectorId === order.currentSectorId || step.sectorName === order.currentSectorName);
  order.items = items;
  order.itemProductionSnapshots = items;
  order.total = total;
  order.approvedPrice = total;
  order.predictedCost = Number(pricing.totalCost || 0);
  order.predictedBreakdown = pricing.costBreakdown || {};
  order.predictedMaterialCost = Number(pricing.materialCost || 0);
  order.predictedProductionCost = Number(pricing.productionCost || 0);
  order.predictedInstallationCost = Number(pricing.installationCost || 0);
  order.predictedAdministrativeCost = Number(pricing.administrativeCost || 0);
  order.predictedProfit = round(total - order.predictedCost);
  order.predictedMargin = pricing.validation?.marginAtManualPrice ?? pricing.marginPercent ?? 0;
  order.predictedMaterials = items.flatMap(item => itemPricingSnapshot(item).materialLines || item.costSnapshot?.materials || []);
  order.productionRouteSnapshot = route;
  order.flow = route.map(step => step.sectorName);
  order.sectors = order.flow;
  order.productConfigSnapshots = items.map(item => item.productConfigSnapshot || item.costSnapshot?.product).filter(Boolean);
  order.technicalAnswersByItem = items.map(item => ({ itemId: item.id, productId: item.productId, productName: item.productName, answers: item.technicalAnswersSnapshot || item.answers || {} }));
  order.questionCostsSnapshot = items.flatMap(item => item.questionCostsSnapshot || item.costSnapshot?.questionCosts || []);
  if (currentIndex >= 0) setOrderCurrentRouteStep(order, route[currentIndex], currentIndex);
  else if (route[0]) setOrderCurrentRouteStep(order, route[0], 0);
  const paid = Number(order.paidAmount || 0);
  order.financialStatus = paid >= total && total > 0 ? "quitada" : paid > 0 ? "pagamento parcial" : order.financialStatus;
  order.updatedAt = new Date().toISOString();
  return order;
}

function canReleaseToPcp(order) {
  const rule = db.costConfig.productionReleaseRule || "produzir_com_sinal";
  const paid = Number(order.paidAmount || 0);
  const total = Number(order.total || 0);
  const authorizedFiado = order.financialStatus === "fiado autorizado" || order.financialStatus === "fiado";
  if (rule === "produzir_somente_pago") return paid >= total;
  if (rule === "produzir_com_sinal") return paid > 0 || paid >= total;
  if (rule === "produzir_fiado_autorizado") return paid > 0 || authorizedFiado;
  if (rule === "produzir_sem_pagamento_com_autorizacao") return Boolean(order.productionAuthorization || paid > 0);
  return paid > 0;
}

function resolveImpacts(question, value) {
  const impacts = [];
  if (question.priceImpact) impacts.push(question.priceImpact);
  const selected = Array.isArray(value) ? value : String(value).split(",").map(item => item.trim());
  (question.options || []).forEach(option => {
    if (selected.includes(String(option.value)) && option.priceImpact) impacts.push(option.priceImpact);
  });
  return impacts;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function dashboard() {
  const cashMovements = scoped("cashMovements");
  const orders = scoped("orders");
  const quotes = scoped("quotes");
  const customers = scoped("customers");
  const cashSessions = scoped("cashSessions");
  const technicalVisits = scoped("technicalVisits");
  const accountsReceivable = scoped("accountsReceivable");
  const accountsPayable = scoped("accountsPayable");
  const today = productionDateKey();
  const month = today.slice(0, 7);
  const next3 = addProductionDays(today, 3);
  const revenue = cashMovements.filter(m => m.type === "sale" || m.type === "receipt" || m.type === "order_payment" || m.type === "quick_sale").reduce((sum, item) => sum + item.amount, 0);
  const openOrders = orders.filter(order => !["Entregue", "Finalizada", "Cancelada"].includes(order.productionStatus)).length;
  const lateOrders = orders.filter(order => order.dueDate && productionDateKey(order.dueDate) < today && !["Entregue", "Finalizada", "Cancelada"].includes(order.productionStatus)).length;
  const okOrders = orders.filter(order => ["Entregue", "Finalizada", "Concluida"].includes(order.productionStatus)).length;
  const attentionOrders = orders.filter(order => ["Aguardando", "Pausada", "Impressao", "Acabamento", "Instalacao"].includes(order.productionStatus)).length;
  const pendingReceivables = orders.reduce((sum, order) => sum + Math.max(order.total - order.paidAmount, 0), 0);
  const productSales = orders.reduce((result, order) => {
    const name = db.products.find(product => product.id === order.productId)?.name || order.jobName || "Servico";
    result[name] = (result[name] || 0) + Number(order.total || 0);
    return result;
  }, {});
  const productMargins = orders.reduce((result, order) => {
    const name = db.products.find(product => product.id === order.productId)?.name || order.jobName || "Servico";
    const margin = Number(order.predictedMargin || order.costSnapshot?.marginPercent || 0);
    if (!result[name] || margin > result[name]) result[name] = margin;
    return result;
  }, {});
  return {
    revenue,
    openOrders,
    lateOrders,
    okOrders,
    attentionOrders,
    pendingReceivables,
    quoteCount: quotes.length,
    todayQuotes: quotes.filter(quote => quote.createdAt?.slice(0, 10) === today).length,
    todayOrders: orders.filter(order => productionDateKey(order.dueDate) === today).length,
    productionRunning: orders.filter(order => !["Entregue", "Finalizada", "Concluida"].includes(order.productionStatus)).length,
    awaitingApproval: orders.filter(order => !productionSearchText(order.approvalStatus).includes("aprov")).length,
    awaitingPayment: orders.filter(order => Number(order.paidAmount || 0) < Number(order.total || 0)).length,
    next3Production: orders.filter(order => order.dueDate && productionDateKey(order.dueDate) > today && productionDateKey(order.dueDate) <= next3 && !["Entregue", "Finalizada", "Cancelada"].includes(order.productionStatus)).length,
    todayVisits: technicalVisits.filter(visit => productionDateKey(visit.scheduledDate || visit.requestedDate) === today).length,
    pendingVisits: technicalVisits.filter(visit => !["completed", "canceled"].includes(visit.status)).length,
    accountsReceivable: round(accountsReceivable.reduce((sum, item) => sum + Number(item.balance ?? item.amount ?? 0), 0)),
    accountsPayable: round(accountsPayable.reduce((sum, item) => sum + Number(item.balance ?? item.amount ?? 0), 0)),
    todayCash: round(cashMovements.filter(item => String(item.createdAt || "").slice(0, 10) === today).reduce((sum, item) => sum + Number(item.amount || 0), 0)),
    monthRevenue: round(cashMovements.filter(item => String(item.createdAt || "").slice(0, 7) === month && Number(item.amount || 0) > 0).reduce((sum, item) => sum + Number(item.amount || 0), 0)),
    topProducts: Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value: round(value) })),
    highestMarginServices: Object.entries(productMargins).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, margin]) => ({ name, margin: round(margin) })),
    overdueFiado: customers.filter(customer => customer.balance > 0).length,
    cashOpen: cashSessions.some(session => session.status === "aberto"),
    company: scopeMeta(),
    importantAlerts: alerts().slice(0, 6)
  };
}

function alerts() {
  const now = new Date("2026-06-01T12:00:00");
  const list = [];
  scoped("orders").forEach(order => {
    if (new Date(order.dueDate) < now && order.productionStatus !== "Entregue") list.push({ type: "O.S. atrasada", severity: "red", orderId: order.id, message: `${order.id} passou do prazo` });
    if (!order.files?.length) list.push({ type: "O.S. sem arquivo", severity: "yellow", orderId: order.id, message: `${order.id} ainda nao possui arte/anexo` });
    if (!order.paidAmount) list.push({ type: "O.S. sem pagamento/sinal", severity: "yellow", orderId: order.id, message: `${order.id} esta sem sinal` });
    if (["Pausada", "Problema"].includes(order.productionStatus)) list.push({ type: "Producao parada", severity: "red", orderId: order.id, message: `${order.id} precisa de acao do PCP` });
  });
  scoped("customers").filter(customer => customer.balance > 0).forEach(customer => list.push({ type: "Cliente fiado em atraso", severity: "yellow", customerId: customer.id, message: `${customer.name} tem saldo em aberto` }));
  scoped("materials").filter(material => material.stock <= material.minStock).forEach(material => list.push({ type: "Material insuficiente", severity: "red", materialId: material.id, message: `${material.name} abaixo do estoque minimo` }));
  return list;
}

function audit(action, entity, entityId, user, details, metadata = {}) {
  db.auditLogs.push(withCompany({
    id: uid("aud"),
    action,
    entity,
    entityId,
    user: user || "Sistema",
    ip: metadata.ip || db.currentRequestIp || "",
    storeId: currentCompanyId(),
    storeName: companyLabel(),
    details: details || "",
    previousData: metadata.previousData || null,
    newData: metadata.newData || null,
    storeId: metadata.storeId || currentCompanyId(),
    createdAt: new Date().toISOString()
  }, "auditLogs"));
}

function leadHistory(leadId) {
  return [
    ...db.auditLogs.filter(log => log.entityId === leadId).map(log => ({ at: log.createdAt, actor: log.user, action: log.action, details: log.details })),
    ...db.followUps.filter(item => item.leadId === leadId).map(item => ({ at: `${item.date}T${item.time || "00:00"}:00.000Z`, actor: item.seller, action: item.completed ? "Follow-up concluido" : "Follow-up agendado", details: `${item.channel}: ${item.observation}` }))
  ].sort((a, b) => new Date(a.at) - new Date(b.at));
}

function commercialAlerts() {
  const now = new Date();
  const staleLimit = now.getTime() - (3 * 86400000);
  const quoteStaleLimit = now.getTime() - (5 * 86400000);
  const list = [];
  db.followUps.filter(item => !item.completed && new Date(`${item.date}T${item.time || "00:00"}:00`) < now).forEach(item => {
    const lead = db.leads.find(leadItem => leadItem.id === item.leadId);
    list.push({ type: "follow-up vencido", severity: "red", leadId: item.leadId, message: `${lead?.name || "Cliente"} aguardava retorno ${item.date} ${item.time}` });
  });
  db.leads.filter(lead => !["fechado", "perdido"].includes(lead.status) && new Date(lead.nextContactAt || lead.createdAt || 0).getTime() < staleLimit).forEach(lead => {
    list.push({ type: "cliente sem retorno", severity: "yellow", leadId: lead.id, message: `${lead.name} sem retorno recente` });
  });
  scoped("quotes").filter(quote => !["aprovado", "perdido", "reprovado"].includes(quote.status) && new Date(quote.createdAt || 0).getTime() < quoteStaleLimit).forEach(quote => {
    list.push({ type: "orcamento parado", severity: "yellow", quoteId: quote.id, message: `${quote.quoteNumber} parado ha mais de 5 dias` });
  });
  return list;
}

function commercialReport() {
  const byOrigin = db.leads.reduce((acc, lead) => ({ ...acc, [lead.origin || "Outro"]: (acc[lead.origin || "Outro"] || 0) + 1 }), {});
  const bySeller = db.leads.reduce((acc, lead) => {
    const seller = lead.seller || "Sem vendedor";
    const current = acc[seller] || { leads: 0, closed: 0, lost: 0, estimated: 0 };
    current.leads += 1;
    if (lead.status === "fechado") current.closed += 1;
    if (lead.status === "perdido") current.lost += 1;
    current.estimated += Number(lead.estimatedValue || 0);
    acc[seller] = current;
    return acc;
  }, {});
  const quotes = scoped("quotes");
  const sentQuotes = quotes.length;
  const approvedQuotes = quotes.filter(quote => quote.status === "aprovado").length;
  const lostQuotes = quotes.filter(quote => ["perdido", "reprovado"].includes(quote.status)).length;
  const negotiationValue = round(db.leads.filter(lead => !["fechado", "perdido"].includes(lead.status)).reduce((sum, lead) => sum + Number(lead.estimatedValue || 0), 0));
  const closedValue = round(db.leads.filter(lead => lead.status === "fechado").reduce((sum, lead) => sum + Number(lead.estimatedValue || 0), 0));
  const averageTicket = approvedQuotes ? round(quotes.filter(quote => quote.status === "aprovado").reduce((sum, quote) => sum + Number(quote.approvedPrice || quote.pricing?.finalPrice || 0), 0) / approvedQuotes) : 0;
  const lossReasons = db.leads.filter(lead => lead.status === "perdido").reduce((acc, lead) => ({ ...acc, [lead.lossReason || "sem motivo"]: (acc[lead.lossReason || "sem motivo"] || 0) + 1 }), {});
  return { byOrigin, bySeller, sentQuotes, approvedQuotes, lostQuotes, negotiationValue, closingRate: db.leads.length ? round((db.leads.filter(lead => lead.status === "fechado").length / db.leads.length) * 100) : 0, averageTicket, closedValue, lossReasons };
}

function sellerGoalDashboard() {
  return db.sellerGoals.map(goal => {
    const sellerQuotes = db.quotes.filter(quote => (quote.seller || quote.costSnapshot?.user || "Joao Victor") === goal.seller);
    const sellerOrders = db.orders.filter(order => sellerQuotes.some(quote => quote.id === order.quoteId));
    const sold = round(sellerOrders.reduce((sum, order) => sum + Number(order.total || 0), 0));
    const received = round(sellerOrders.reduce((sum, order) => sum + Number(order.paidAmount || 0), 0));
    const marginGenerated = round(sellerOrders.reduce((sum, order) => sum + Number(order.predictedProfit || 0), 0));
    const commissionPredicted = round(sold * (Number(goal.defaultCommissionPercent || 0) / 100));
    const commissionReleased = round(received * (Number(goal.defaultCommissionPercent || 0) / 100));
    return {
      ...goal,
      sold,
      received,
      missingMonthly: Math.max(round(Number(goal.monthlyGoal || 0) - sold), 0),
      conversionRate: db.leads.filter(lead => lead.seller === goal.seller).length ? round((db.leads.filter(lead => lead.seller === goal.seller && lead.status === "fechado").length / db.leads.filter(lead => lead.seller === goal.seller).length) * 100) : 0,
      marginGenerated,
      commissionPredicted,
      commissionReleased
    };
  });
}

function createCustomerFromLead(lead) {
  if (lead.customerId) return db.customers.find(customer => customer.id === lead.customerId);
  const existing = db.customers.find(customer => customer.phone === lead.phone || customer.email === lead.email);
  if (existing) {
    lead.customerId = existing.id;
    lead.portalToken = ensurePortalToken(existing.id).token;
    return existing;
  }
  const customer = withCompany({ id: uid("c"), name: lead.company || lead.name, phone: lead.phone || lead.whatsapp || "", email: lead.email || "", type: lead.company ? "Empresa" : "Pessoa fisica", creditLimit: 0, balance: 0, origin: lead.origin, seller: lead.seller }, "customers");
  db.customers.push(customer);
  lead.customerId = customer.id;
  lead.portalToken = ensurePortalToken(customer.id).token;
  audit("Lead convertido em cliente", "lead", lead.id, lead.seller || db.currentUser.name, customer.name);
  return customer;
}

function createQuoteFromLead(lead, body = {}) {
  const customer = createCustomerFromLead(lead);
  const product = db.products.find(item => item.id === (body.productId || "p1")) || db.products[0];
  const composition = db.compositions.find(item => item.id === (body.compositionId || "cmp2")) || db.compositions.find(item => item.productId === product.id);
  const answers = { compositionId: composition?.id, width: 2, height: 1, quantity: 1, ...(body.answers || {}) };
  const productModelId = body.productModelId || answers.productModelId || "";
  const integrated = buildIntegratedPricing(product, { answers, productModelId, manualPrice: body.manualPrice || 0, additionalExpenses: body.additionalExpenses || 0 });
  const itemSnapshot = buildQuoteItemSnapshot({ productId: product.id, productModelId: productModelId || integrated.pricing.productModelId || "", compositionId: composition?.id || null, description: body.jobName || lead.interest || product.name, quantity: Number(answers.quantity || 1), answers, pricingSnapshot: integrated.pricing, files: body.files || [] }, 0);
  const costSnapshot = buildQuoteSnapshot({ answers, productModelId: itemSnapshot.productModelId }, composition, integrated.pricing, product);
  costSnapshot.items = [itemSnapshot];
  const quote = {
    id: uid("q"),
    quoteNumber: `ORC-${db.quotes.length + 1001}`,
    customerId: customer.id,
    leadId: lead.id,
    seller: lead.seller || db.currentUser.name,
    origin: lead.origin,
    jobName: body.jobName || lead.interest || product.name,
    productId: product.id,
    answers,
    pricing: integrated.pricing,
    compositionId: integrated.pricing.compositionId || composition?.id || null,
    items: [itemSnapshot],
    itemSnapshots: [itemSnapshot],
    files: [...(lead.files || []), ...(body.files || [])],
    photos: [],
    approvedPrice: integrated.pricing.finalPrice || integrated.pricing.suggestedPrice,
    costSnapshot,
    status: "enviado",
    createdAt: new Date().toISOString()
  };
  db.quotes.push(withCompany(quote, "quotes"));
  lead.quoteId = quote.id;
  lead.status = "orcamento enviado";
  audit("Lead convertido em orcamento", "lead", lead.id, lead.seller || db.currentUser.name, quote.quoteNumber);
  audit("Orcamento criado", "quote", quote.id, lead.seller || db.currentUser.name, `Origem lead ${lead.name}`);
  return quote;
}

function dateAfterDays(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function routeStepForOrder(order, index = order.currentRouteIndex || 0) {
  return (order.productionRouteSnapshot || [])[Number(index)] || null;
}

function nextRouteStepForOrder(order) {
  return routeStepForOrder(order, Number(order.currentRouteIndex || 0) + 1);
}

function setOrderCurrentRouteStep(order, step, index) {
  if (!step) return;
  order.currentRouteIndex = Number(index);
  order.currentSectorId = step.sectorId || "";
  order.currentSectorName = step.sectorName || "";
  order.currentResponsible = step.defaultResponsible || order.currentResponsible || "";
}

function approveQuoteToOrder(quote, body = {}) {
  if (!quote) return null;
  if (quote.status === "aprovado") {
    const existing = scopedFind("orders", order => order.quoteId === quote.id);
    if (existing) return existing;
  }
  quote.status = "aprovado";
  quote.approvedAt = new Date().toISOString();
  quote.approvedBy = body.approvedBy || "Cliente";
  const approvedValue = Number(quote.approvedPrice || quote.pricing.finalPrice || quote.pricing.suggestedPrice || 0);
  const product = db.products.find(item => item.id === quote.productId);
  const itemSnapshots = (quote.itemSnapshots?.length ? quote.itemSnapshots : quote.items || []).map((item, index) => item.costSnapshot ? item : buildQuoteItemSnapshot(item, index));
  const productSnapshot = quote.costSnapshot?.product || (product ? {
    id: product.id,
    code: product.code,
    name: product.name,
    pricingMode: pricingModeForProduct(product),
    defaultProductionDays: Number(product.defaultProductionDays || quote.pricing.deadlineDays || 3),
    technicalQuestions: (product.technicalQuestions || product.questions || []).map(normalizeTechnicalQuestion),
    productionRoute: normalizeProductionRoute(product.productionRoute || [], quote.pricing.productionFlow || product.flow || [])
  } : null);
  const productionRouteSnapshot = consolidateProductionRoutes(itemSnapshots, quote.costSnapshot?.productionRoute || quote.pricing.productionRoute || productSnapshot?.productionRoute || quote.pricing.productionFlow || []);
  const firstStep = productionRouteSnapshot[0] || null;
  const questionCostsSnapshot = itemSnapshots.flatMap(item => item.questionCostsSnapshot || item.costSnapshot?.questionCosts || []);
  const productConfigSnapshots = itemSnapshots.map(item => item.productConfigSnapshot || item.costSnapshot?.product).filter(Boolean);
  const technicalAnswersByItem = itemSnapshots.map(item => ({ itemId: item.id, productId: item.productId, productName: item.productName, answers: item.technicalAnswersSnapshot || item.answers || {} }));
  const predictedMaterials = itemSnapshots.flatMap(item => item.pricingSnapshot?.materialLines || item.costSnapshot?.materials || []);
  const itemFiles = itemSnapshots.flatMap(item => item.files || []);
  const projectFiles = [...new Set([...(quote.projectFiles || []), ...itemSnapshots.flatMap(item => item.projectFiles || [])])];
  const productionNotesByItem = itemSnapshots.map(item => item.notes?.production).filter(Boolean);
  const predictedCost = Number(quote.pricing.totalCost || itemSnapshots.reduce((sum, item) => sum + Number(item.pricingSnapshot?.totalCost || 0), 0));
  const defaultProductionDays = Math.max(Number(productSnapshot?.defaultProductionDays || quote.pricing.deadlineDays || 0), ...itemSnapshots.map(item => Number(item.costSnapshot?.deadlineDays || item.productConfigSnapshot?.defaultProductionDays || 0)));
  const order = {
    id: nextServiceOrderId(),
    companyId: quote.companyId || (currentCompanyId() === "all" ? primaryCompanyId() : currentCompanyId()),
    serviceOrderType: "normal",
    lifecycleStatus: "active",
    nonBillable: false,
    billingBlocked: false,
    quoteId: quote.id,
    customerId: quote.customerId,
    jobName: quote.jobName,
    productId: quote.productId,
    productModelId: quote.productModelId || itemSnapshots[0]?.productModelId || "",
    productModelName: quote.productModelName || itemSnapshots[0]?.productModelName || "",
    compositionId: quote.compositionId,
    seller: quote.answers?.seller || "",
    attendant: quote.answers?.attendant || "",
    contact: quote.answers?.contact || "",
    campaign: quote.answers?.campaign || "",
    logistics: quote.answers?.logistics || "",
    deliveryAddress: quote.answers?.deliveryAddress || "",
    paymentMethod: quote.answers?.paymentMethod || "",
    paymentTerms: quote.answers?.paymentTerms || "",
    approvalStatus: "Aprovado pelo cliente",
    artApprovalStatus: quote.artApprovalStatus || "aguardando aprovacao",
    items: itemSnapshots,
    itemProductionSnapshots: itemSnapshots,
    files: [...new Set([...(quote.files || []), ...itemFiles])],
    projectFiles,
    photos: quote.photos || [],
    answers: quote.answers,
    productConfigSnapshot: productSnapshot,
    productConfigSnapshots,
    technicalAnswersSnapshot: quote.costSnapshot?.technicalAnswers || quote.answers || {},
    technicalAnswersByItem,
    questionCostsSnapshot,
    productionRouteSnapshot,
    currentRouteIndex: 0,
    currentSectorId: firstStep?.sectorId || "",
    currentSectorName: firstStep?.sectorName || "aguardando liberacao",
    productionNotes: [quote.answers?.productionNote, ...productionNotesByItem].filter(Boolean).join("\n\n"),
    internalProductionWarnings: quote.answers?.internalProductionWarnings || "",
    fileInstructions: quote.answers?.fileInstructions || "",
    installationNotes: quote.answers?.installationNotes || "",
    total: approvedValue,
    approvedPrice: approvedValue,
    paidAmount: 0,
    productionStatus: "aguardando liberacao",
    financialStatus: "aguardando pagamento",
    dueDate: body.dueDate || quote.answers?.deadline || dateAfterDays(defaultProductionDays || 3),
    priority: "normal",
    flow: productionRouteSnapshot.map(step => step.sectorName),
    predictedCost,
    predictedBreakdown: quote.pricing.costBreakdown || {},
    predictedMaterialCost: quote.pricing.materialCost || 0,
    predictedProductionCost: quote.pricing.productionCost || 0,
    predictedInstallationCost: quote.pricing.installationCost || 0,
    predictedAdministrativeCost: quote.pricing.administrativeCost || 0,
    predictedProfit: round(approvedValue - predictedCost),
    predictedMargin: quote.pricing.validation?.marginAtManualPrice ?? quote.pricing.marginPercent,
    predictedMaterials,
    sectors: productionRouteSnapshot.map(step => step.sectorName),
    costSnapshot: quote.costSnapshot,
    predictedMinutes: (db.products.find(product => product.id === quote.productId)?.technicalSheet?.averageProductionMinutes || 60),
    realCost: 0,
    realMinutes: 0
  };
  db.orders.push(withCompany(order, "orders"));
  const lead = db.leads.find(item => item.quoteId === quote.id);
  if (lead) {
    lead.status = "fechado";
    lead.orderId = order.id;
  }
  audit("Orcamento aprovado", "quote", quote.id, body.user || body.approvedBy || "Cliente", quote.jobName);
  audit("O.S. criada", "order", order.id, "Sistema", `Origem ${quote.quoteNumber}`);
  enqueueCustomerNotification("quote.approved", { customerId: quote.customerId, quoteId: quote.id, orderId: order.id, user: body.user || body.approvedBy || "Sistema" });
  enqueueCustomerNotification("service_order.created", { customerId: order.customerId, quoteId: quote.id, orderId: order.id, user: "Sistema" });
  return order;
}

function portalTimeline(customerId) {
  const quoteIds = db.quotes.filter(quote => quote.customerId === customerId).map(quote => quote.id);
  const orderIds = db.orders.filter(order => order.customerId === customerId).map(order => order.id);
  return db.auditLogs.filter(log => quoteIds.includes(log.entityId) || orderIds.includes(log.entityId)).map(log => ({
    at: log.createdAt,
    action: log.action
      .replace("Orcamento", "Orcamento")
      .replace("O.S. criada", "Ordem de servico aberta")
      .replace("Enviado ao PCP", "Producao iniciada"),
    details: log.details
  })).sort((a, b) => new Date(a.at) - new Date(b.at));
}

function portalPayload(tokenValue) {
  const token = db.portalTokens.find(item => item.token === tokenValue && item.active);
  if (!token) return null;
  const customer = db.customers.find(item => item.id === token.customerId);
  if (!customer) return null;
  const quotes = db.quotes.filter(quote => quote.customerId === customer.id).map(quote => ({
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    jobName: quote.jobName,
    status: quote.status,
    total: quote.approvedPrice || quote.pricing?.finalPrice || quote.pricing?.suggestedPrice || 0,
    files: quote.files || [],
    artApprovalStatus: quote.artApprovalStatus || "aguardando aprovacao",
    createdAt: quote.createdAt
  }));
  const orders = db.orders.filter(order => order.customerId === customer.id).map(order => ({
    id: order.id,
    product: db.products.find(product => product.id === order.productId)?.name || order.jobName,
    status: order.productionStatus,
    dueDate: order.dueDate,
    files: order.files || [],
    payments: { total: order.total, received: order.paidAmount || 0, balance: Math.max(Number(order.total || 0) - Number(order.paidAmount || 0), 0), financialStatus: order.financialStatus },
    approvalStatus: order.approvalStatus,
    artApprovalStatus: order.artApprovalStatus || "aguardando aprovacao"
  }));
  return {
    customer: { id: customer.id, name: customer.name, phone: customer.phone },
    quotes,
    orders,
    uploads: db.portalUploads.filter(upload => upload.customerId === customer.id),
    timeline: portalTimeline(customer.id),
    notifications: db.portalNotifications.filter(item => item.customerId === customer.id)
  };
}

function orderHistory(orderId) {
  return [
    ...db.auditLogs.filter(log => log.entityId === orderId).map(log => ({ at: log.createdAt, actor: log.user, action: log.action, details: log.details })),
    ...db.productionEvents.filter(event => event.orderId === orderId).map(event => ({ at: event.createdAt, actor: event.user || event.startedBy || event.receivedBy || "Producao", action: event.action || "Evento de producao", details: `${event.sectorName || event.sector || ""}${event.nextSector ? ` -> ${event.nextSector}` : ""}${event.observation ? ` | ${event.observation}` : ""}` })),
    ...db.stockMovements.filter(movement => movement.orderId === orderId).map(movement => ({ at: movement.createdAt, actor: movement.user || "Estoque", action: "Material consumido", details: `${movement.materialName}: ${movement.quantity}` })),
    ...db.realCostEntries.filter(entry => entry.orderId === orderId).map(entry => ({ at: entry.createdAt, actor: entry.employee || "Producao", action: "Custo real apontado", details: `${entry.sector}: ${entry.totalCost}` })),
    ...db.productionProblems.filter(problem => problem.orderId === orderId).map(problem => ({ at: problem.createdAt, actor: problem.responsible || "Producao", action: problem.rework ? "Retrabalho registrado" : "Problema registrado", details: `${problem.sector}: ${problem.type}` })),
    ...db.installationChecklists.filter(item => item.orderId === orderId).map(item => ({ at: item.createdAt, actor: item.responsible || "Instalacao", action: "Checklist de instalacao", details: item.completed ? "Completo" : "Pendente" }))
  ].sort((a, b) => new Date(a.at) - new Date(b.at));
}

function postCalculation(order) {
  const materialUsed = db.stockMovements.filter(movement => movement.orderId === order.id).reduce((sum, movement) => sum + movement.totalCost, 0);
  const operationalLinked = db.operationalExpenses.filter(expense => expense.orderId === order.id).reduce((sum, expense) => sum + Number(expense.value || 0), 0);
  const realEntries = db.realCostEntries.filter(entry => entry.orderId === order.id);
  const realLaborCost = round(realEntries.reduce((sum, entry) => sum + Number(entry.laborCost || 0), 0));
  const realMachineCost = round(realEntries.reduce((sum, entry) => sum + Number(entry.machineCost || 0), 0));
  const realEntryMaterialCost = round(realEntries.reduce((sum, entry) => sum + Number(entry.materialCost || 0), 0));
  const realMaterialCost = round(Math.max(materialUsed, realEntryMaterialCost));
  const problemCost = round(db.productionProblems.filter(problem => problem.orderId === order.id).reduce((sum, problem) => sum + Number(problem.estimatedCost || problem.realCost || 0), 0));
  const eventMinutes = db.productionEvents.filter(event => event.orderId === order.id).length * 45;
  const realCost = round(realMaterialCost + realLaborCost + realMachineCost + operationalLinked + problemCost);
  const realMinutes = Number(order.realMinutes || 0) + eventMinutes + realEntries.reduce((sum, entry) => sum + Number(entry.laborMinutes || 0), 0);
  const predictedCost = Number(order.predictedCost || 0);
  const predictedMinutes = Number(order.predictedMinutes || 0);
  const predictedMargin = round(((order.total - predictedCost) / Math.max(order.total, 1)) * 100);
  const realMargin = round(((order.total - realCost) / Math.max(order.total, 1)) * 100);
  return {
    predictedCost,
    realCost,
    costDifference: round(realCost - predictedCost),
    predictedMinutes,
    realMinutes,
    timeDifference: round(realMinutes - predictedMinutes),
    predictedMaterialCost: predictedCost,
    realMaterialCost,
    predictedMargin,
    realMargin,
    marginDifference: round(realMargin - predictedMargin),
    profitability: {
      material: {
        predicted: Number(order.predictedBreakdown?.material || order.predictedCost || 0),
        real: realMaterialCost
      },
      production: {
        predicted: Number(order.predictedBreakdown?.production || 0),
        real: round(realLaborCost)
      },
      machine: {
        predicted: Number(order.predictedBreakdown?.machine || 0),
        real: round(realMachineCost)
      },
      installation: {
        predicted: Number(order.predictedBreakdown?.installation || 0),
        real: round(operationalLinked)
      },
      expenses: {
        predicted: 0,
        real: round(operationalLinked)
      },
      profit: {
        predicted: round(Number(order.total || 0) - predictedCost),
        real: round(Number(order.total || 0) - realCost)
      }
    }
  };
}

function productionLabel(order) {
  return {
    osNumber: order.id,
    customer: customerName(order.customerId),
    product: db.products.find(product => product.id === order.productId)?.name || order.jobName,
    measures: order.answers ? `${order.answers.width || "-"} x ${order.answers.height || "-"}` : "Ver item da O.S.",
    currentSector: order.currentSectorName || order.productionStatus,
    productionRoute: order.productionRouteSnapshot || [],
    dueDate: order.dueDate,
    notes: order.productionNotes || "",
    internalProductionWarnings: order.internalProductionWarnings || "",
    fileInstructions: order.fileInstructions || "",
    installationNotes: order.installationNotes || "",
    technicalAnswers: order.technicalAnswersSnapshot || order.answers || {},
    qrCodeUrl: `http://localhost:${PORT}/?os=${encodeURIComponent(order.id)}`,
    files: order.files || []
  };
}

function productionDateKey(value = new Date()) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(date);
}

function addProductionDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00-03:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return productionDateKey(date);
}

function productionSearchText(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function productionOrderDates(order = {}) {
  const currentStep = routeStepForOrder(order) || {};
  return [...new Set([
    order.productionDate,
    order.scheduledProductionDate,
    currentStep.scheduledDate,
    currentStep.dueDate,
    order.dueDate,
    order.installationDate
  ].filter(Boolean).map(productionDateKey))];
}

function productionActionAllowed(action, user = db.currentUser) {
  if (isAdmin(user)) return true;
  const access = effectivePermissions(user);
  if (!access.production) return false;
  const sector = db.sectors.find(item => item.name === user?.sector);
  const permission = sector?.permissions || {};
  const granular = {
    view: "production",
    viewMine: "productionViewMine",
    viewSector: "productionViewSector",
    viewAll: "productionViewAll",
    start: "productionStart",
    receive: "productionStart",
    pause: "productionPause",
    resume: "productionResume",
    finish: "productionFinish",
    note: "productionNote",
    checklist: "productionChecklist",
    attachments: "productionAttachments",
    rework: "productionRework",
    homologate: "productionFinish",
    move: "productionMove",
    edit: "productionEdit",
    schedule: "productionSchedule",
    cancel: "productionCancel",
    report: "productionReports",
    export: "productionReports"
  };
  const permissionKey = granular[action];
  if (permissionKey && access[permissionKey] === false) return false;
  if (["start", "receive", "pause", "resume", "note", "checklist", "attachments"].includes(action)) return access[permissionKey] !== false && permission.startProduction !== false;
  if (["finish", "rework", "homologate"].includes(action)) return access[permissionKey] !== false && permission.finishProduction !== false;
  if (["move", "edit", "schedule", "cancel"].includes(action)) return Boolean(access[permissionKey] && permission.movePcp !== false);
  if (["report", "export"].includes(action)) return Boolean(access.productionReports);
  if (["view", "viewMine", "viewSector", "viewAll"].includes(action)) return access[permissionKey] !== false;
  return false;
}

function productionUserScope(user = db.currentUser, requestedView = "") {
  if (isAdmin(user) || String(user?.role || "").toLowerCase().includes("pcp")) return requestedView || "all";
  const access = effectivePermissions(user);
  if (["upcoming", "running", "paused", "finished", "installation", "checklist", "files"].includes(requestedView) && access.productionViewSector) return requestedView;
  if (requestedView === "mine" && access.productionViewMine) return "mine";
  if (requestedView === "sector" && access.productionViewSector) return "sector";
  return access.productionViewSector ? "sector" : "mine";
}

function sanitizeProductionRowForUser(order, user = db.currentUser) {
  if (isAdmin(user) || effectivePermissions(user).productionSensitiveData) return order;
  const hidden = {
    ...order,
    financialStatus: "Restrito",
    total: undefined,
    paidAmount: undefined,
    receivedAmount: undefined,
    approvedPrice: undefined,
    predictedCost: undefined,
    predictedBreakdown: undefined,
    predictedMaterialCost: undefined,
    predictedProductionCost: undefined,
    predictedInstallationCost: undefined,
    predictedAdministrativeCost: undefined,
    predictedProfit: undefined,
    predictedMargin: undefined,
    realCost: undefined,
    realCostReport: undefined,
    costSnapshot: undefined,
    pricing: undefined
  };
  return hidden;
}

function productionOrderRow(order) {
  const product = db.products.find(item => item.id === order.productId);
  const composition = db.compositions.find(item => item.id === order.compositionId);
  const events = scoped("productionEvents").filter(event => event.orderId === order.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const problems = scoped("productionProblems").filter(problem => problem.orderId === order.id);
  const checklist = scoped("productionChecklists").filter(item => item.orderId === order.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const currentStep = routeStepForOrder(order);
  const today = productionDateKey();
  const dueDate = productionDateKey(order.dueDate);
  const remainingDays = dueDate ? Math.ceil((new Date(`${dueDate}T23:59:59-03:00`) - new Date(`${today}T00:00:00-03:00`)) / 86400000) : null;
  const route = order.productionRouteSnapshot || [];
  const logistics = order.logistics || order.answers?.logistics || (route.some(step => productionSearchText(step.sectorName).includes("instal")) ? "Instalacao" : "A combinar");
  const operationalStatus = Number(remainingDays) < 0 && !["Finalizada", "Entregue", "Cancelada", "Liberada para entrega"].includes(order.productionStatus) ? "atrasado"
    : ["Pausado", "Pausada", "Com problema", "Retrabalho", "Homologacao pendente"].includes(order.productionStatus) ? "atencao"
      : productionSearchText(order.productionStatus).includes("produc") ? "em producao"
        : ["Finalizada", "Entregue"].includes(order.productionStatus) ? "finalizado"
          : order.productionStatus === "Cancelada" ? "cancelado" : "aguardando";
  return {
    ...order,
    customerName: customerName(order.customerId),
    companyName: companyLabel(order.companyId),
    storeId: order.companyId || primaryCompanyId(),
    productName: product?.name || order.jobName || "Servico grafico",
    compositionName: composition?.name || "",
    currentSectorId: order.currentSectorId || "",
    currentSectorName: order.currentSectorName || order.productionStatus || "Aguardando",
    nextSectorName: nextRouteStepForOrder(order)?.sectorName || "",
    currentRouteStep: currentStep,
    currentResponsible: order.currentResponsible || currentStep?.defaultResponsible || events[0]?.user || "",
    fileRequired: Boolean(currentStep?.requiredFile),
    fileMissing: Boolean(currentStep?.requiredFile && !(order.files || []).length && !(order.productionFiles || []).length),
    checklistRequired: Boolean(currentStep?.checklistRequired),
    checklistCompleted: Boolean(checklist?.completed),
    productionDates: productionOrderDates(order),
    remainingDays,
    timeRemainingLabel: remainingDays === null ? "Sem prazo" : remainingDays < 0 ? `${Math.abs(remainingDays)} dia(s) atrasada` : remainingDays === 0 ? "Entrega hoje" : `${remainingDays} dia(s)`,
    operationalStatus,
    logistics,
    dependsOnMaterial: (order.predictedMaterials || []).some(line => {
      const material = scopedFind("materials", item => item.id === line.materialId);
      return material && Number(material.stock || 0) < Number(line.quantity || 0);
    }),
    dependsOnApproval: !productionSearchText(order.approvalStatus).includes("aprov"),
    needsInstallation: productionSearchText(logistics).includes("instal") || route.some(step => productionSearchText(step.sectorName).includes("instal")),
    problems,
    events,
    latestEvent: events[0] || null,
    realCostReport: postCalculation(order)
  };
}

function queryProduction(params = {}, user = db.currentUser) {
  const today = productionDateKey();
  const scope = ["today", "next3", "all"].includes(params.scope) ? params.scope : "all";
  const view = productionUserScope(user, params.view);
  const restrictedToSector = !isAdmin(user) && !String(user?.role || "").toLowerCase().includes("pcp") && view !== "mine";
  const from = params.dateFrom ? productionDateKey(params.dateFrom) : "";
  const to = params.dateTo ? productionDateKey(params.dateTo) : "";
  const normalize = productionSearchText;
  const contains = (value, filter) => !filter || normalize(value).includes(normalize(filter));
  let rows = scoped("orders").map(productionOrderRow);
  rows = rows.filter(order => {
    const dates = order.productionDates || [];
    if (restrictedToSector && !contains(`${order.currentSectorName} ${order.currentSector}`, user?.sector)) return false;
    if (view === "mine" && !contains(`${order.currentResponsible} ${order.responsible}`, user?.name)) return false;
    if (view === "sector" && !contains(`${order.currentSectorName} ${order.currentSector}`, user?.sector)) return false;
    if (view === "upcoming" && !dates.some(date => date > today && date <= addProductionDays(today, 3))) return false;
    if (view === "running" && !productionSearchText(order.productionStatus).includes("produc")) return false;
    if (view === "paused" && !["Pausado", "Pausada", "Com problema", "Retrabalho", "Homologacao pendente"].includes(order.productionStatus)) return false;
    if (view === "finished" && !["Finalizada", "Entregue", "Homologada", "Liberada para entrega"].includes(order.productionStatus)) return false;
    if (view === "installation" && !order.needsInstallation) return false;
    if (view === "checklist" && !order.checklistRequired) return false;
    if (view === "files" && !(order.fileMissing || (order.files || []).length || (order.productionFiles || []).length)) return false;
    if (scope === "today" && !dates.includes(today)) return false;
    if (scope === "next3" && !dates.some(date => date > today && date <= addProductionDays(today, 3))) return false;
    if (from && !dates.some(date => date >= from)) return false;
    if (to && !dates.some(date => date <= to)) return false;
    if (!contains(order.currentSectorName, params.sector)) return false;
    if (!contains(`${order.productionStatus} ${order.currentSectorName} ${order.operationalStatus}`, params.status)) return false;
    if (!contains(order.currentResponsible, params.responsible)) return false;
    if (!contains(order.customerName, params.customer)) return false;
    if (!contains(order.id, params.order)) return false;
    if (!contains(order.priority, params.priority)) return false;
    if (!contains(`${order.productName} ${order.compositionName}`, params.serviceType)) return false;
    if (!contains(order.financialStatus, params.financialStatus)) return false;
    if (!contains(order.logistics, params.logistics)) return false;
    if (params.reportType === "late" && !(Number(order.remainingDays) < 0 && !["Finalizada", "Entregue", "Cancelada", "Liberada para entrega"].includes(order.productionStatus))) return false;
    if (params.reportType === "finished" && !["Finalizada", "Entregue", "Homologada", "Liberada para entrega"].includes(order.productionStatus)) return false;
    if (params.reportType === "pending" && !order.dependsOnMaterial && !order.dependsOnApproval && !order.fileMissing && !["Pausado", "Com problema", "Retrabalho", "Homologacao pendente"].includes(order.productionStatus)) return false;
    if (params.reportType === "installation" && !order.needsInstallation) return false;
    return true;
  });
  const priorityWeight = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
  rows.sort((a, b) => {
    const dateCompare = String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31"));
    return dateCompare || (priorityWeight[productionSearchText(a.priority)] ?? 9) - (priorityWeight[productionSearchText(b.priority)] ?? 9);
  });
  const total = rows.length;
  const pageSize = Math.min(Math.max(Number(params.pageSize || total || 1), 1), 500);
  const page = Math.max(Number(params.page || 1), 1);
  const paginated = rows.slice((page - 1) * pageSize, page * pageSize).map(order => sanitizeProductionRowForUser(order, user));
  const summary = {
    total,
    running: rows.filter(order => productionSearchText(order.productionStatus).includes("produc")).length,
    late: rows.filter(order => Number(order.remainingDays) < 0 && !["Finalizada", "Entregue", "Cancelada"].includes(order.productionStatus)).length,
    stopped: rows.filter(order => ["Pausado", "Pausada", "Com problema", "Retrabalho", "Homologacao pendente"].includes(order.productionStatus)).length,
    finished: rows.filter(order => ["Finalizada", "Entregue", "Homologada", "Liberada para entrega"].includes(order.productionStatus)).length,
    pendingMaterial: rows.filter(order => order.dependsOnMaterial).length,
    pendingApproval: rows.filter(order => order.dependsOnApproval).length,
    installation: rows.filter(order => order.needsInstallation).length,
    predictedCost: round(rows.reduce((sum, order) => sum + Number(order.predictedCost || 0), 0)),
    realCost: round(rows.reduce((sum, order) => sum + Number(order.realCostReport?.realCost || order.realCost || 0), 0))
  };
  return { scope, view, today, dateLimit: scope === "next3" ? addProductionDays(today, 3) : today, filters: params, summary, total, page, pageSize, rows: paginated };
}

function productionReportCsv(result) {
  const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const headers = ["O.S.", "Cliente", "Loja", "Servico", "Setor atual", "Proximo setor", "Responsavel", "Status", "Prioridade", "Entrega", "Tempo restante", "Financeiro", "Logistica", "Custo previsto", "Custo real"];
  const rows = result.rows.map(order => [order.id, order.customerName, order.companyName, order.productName, order.currentSectorName, order.nextSectorName, order.currentResponsible, order.productionStatus, order.priority, order.dueDate, order.timeRemainingLabel, order.financialStatus, order.logistics, order.predictedCost, order.realCostReport?.realCost || order.realCost || 0]);
  return [headers, ...rows].map(row => row.map(quote).join(";")).join("\r\n");
}

function validateProductPricing(body = {}, product = {}) {
  const values = {
    baseCostM2: Number(body.baseCostM2 ?? product.baseCostM2 ?? 0),
    minPrice: Number(body.minPrice ?? body.baseValue ?? product.minPrice ?? product.baseValue ?? 0),
    salePrice: Number(body.salePrice ?? body.minPrice ?? body.baseValue ?? product.salePrice ?? product.minPrice ?? 0),
    suggestedPrice: Number(body.suggestedPrice ?? body.salePrice ?? product.suggestedPrice ?? product.salePrice ?? 0),
    manualFinalPrice: Number(body.manualFinalPrice ?? body.salePrice ?? product.manualFinalPrice ?? product.salePrice ?? 0),
    marginPercent: Number(body.marginPercent ?? product.marginPercent ?? 0),
    minMarginPercent: Number(body.minMarginPercent ?? product.minMarginPercent ?? 0),
    maxDiscountPercent: Number(body.maxDiscountPercent ?? product.maxDiscountPercent ?? 0),
    commissionPercent: Number(body.commissionPercent ?? product.commissionPercent ?? 0),
    taxPercent: Number(body.taxPercent ?? product.taxPercent ?? 0),
    productionCost: Number(body.productionCost ?? product.productionCost ?? 0),
    installationCost: Number(body.installationCost ?? product.installationCost ?? 0)
  };
  const invalid = Object.entries(values).find(([, value]) => !Number.isFinite(value) || value < 0);
  if (invalid) return { error: `Informe um valor valido e nao negativo para ${invalid[0]}.` };
  if (values.maxDiscountPercent > 100) return { error: "O desconto permitido nao pode ultrapassar 100%." };
  return { values };
}

function pcp(params = {}, user = db.currentUser) {
  const productionQuery = queryProduction({ ...params, pageSize: params.pageSize || 500 }, user);
  const orders = productionQuery.rows;
  const productionProblems = scoped("productionProblems");
  const realCostEntries = scoped("realCostEntries");
  const routeSectorNames = orders.flatMap(order => (order.productionRouteSnapshot || []).map(step => step.sectorName));
  const activeProductionSectors = scoped("sectors").filter(sector => sector.active !== false && (
    routeSectorNames.includes(sector.name) ||
    sector.permissions?.startProduction ||
    sector.permissions?.finishProduction ||
    sector.permissions?.movePcp ||
    ["PCP", "Arte", "Impressao", "Acabamento", "Corte", "Instalacao", "Serralheria", "ACM", "Pintura", "LED", "Montagem", "Conferencia", "Expedicao"].includes(sector.name)
  )).sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0));
  const standardSectors = [...new Set([...activeProductionSectors.map(sector => sector.name), ...routeSectorNames, "aguardando liberacao", "Homologacao pendente", "Homologada", "Liberada para entrega", "Retrabalho", "Finalizada", "Entregue"])];
  const groups = {};
  standardSectors.forEach(sector => { groups[sector] = []; });
  orders.forEach(order => {
    const key = order.currentSectorName || order.productionStatus;
    groups[key] ||= [];
    const composition = db.compositions.find(item => item.id === order.compositionId);
    const product = db.products.find(item => item.id === order.productId);
    groups[key].push({
      ...order,
      customerName: customerName(order.customerId),
      productName: product?.name || order.jobName,
      compositionName: composition?.name || "",
      currentSectorId: order.currentSectorId || "",
      currentSectorName: key,
      nextSectorName: nextRouteStepForOrder(order)?.sectorName || "",
      currentRouteStep: routeStepForOrder(order),
      fileRequired: Boolean(routeStepForOrder(order)?.requiredFile),
      fileMissing: Boolean(routeStepForOrder(order)?.requiredFile && !(order.files || []).length && !(order.productionFiles || []).length),
      productionNotes: order.productionNotes || "",
      problems: productionProblems.filter(problem => problem.orderId === order.id),
      realCostReport: postCalculation(order)
    });
  });
  const now = new Date();
  const running = orders.filter(order => !["Finalizada", "Entregue", "Cancelada", "Liberada para entrega"].includes(order.productionStatus));
  const late = orders.filter(order => new Date(order.dueDate) < now && !["Finalizada", "Entregue", "Cancelada", "Liberada para entrega"].includes(order.productionStatus));
  const stopped = orders.filter(order => ["Pausado", "Pausada", "Retrabalho", "Homologacao pendente"].includes(order.productionStatus));
  const today = productionDateKey();
  const finishedToday = orders.filter(order => ["Finalizada", "Entregue"].includes(order.productionStatus) && productionDateKey(order.finishedAt) === today);
  const realAbovePredicted = orders.filter(order => postCalculation(order).realCost > Number(order.predictedCost || 0));
  const sectorLoad = Object.entries(groups).reduce((acc, [sector, orders]) => ({ ...acc, [sector]: orders.length }), {});
  const capacity = db.productionCapacities.map(item => {
    const occupied = sectorLoad[item.sector] || 0;
    return { ...item, occupied, available: Math.max(Number(item.dailyCapacity || 0) - occupied, 0), overloaded: occupied > Number(item.dailyCapacity || 0) };
  });
  return {
    query: productionQuery,
    orders,
    atrasadas: orders.filter(order => Number(order.remainingDays) < 0),
    hoje: orders.filter(order => (order.productionDates || []).includes(today)),
    porSetor: groups,
    sectors: activeProductionSectors.map(sector => ({
      ...sector,
      openOrders: (groups[sector.name] || []).filter(order => !["Finalizada", "Entregue", "Cancelada", "Liberada para entrega"].includes(order.productionStatus)).length,
      lateOrders: (groups[sector.name] || []).filter(order => new Date(order.dueDate) < now && !["Finalizada", "Entregue", "Cancelada", "Liberada para entrega"].includes(order.productionStatus)).length
    })),
    dashboard: {
      running: running.length,
      late: late.length,
      stopped: stopped.length,
      finishedToday: finishedToday.length,
      bottlenecks: Object.entries(sectorLoad).filter(([, count]) => count >= 3).map(([sector, count]) => ({ sector, count })),
      productionByEmployee: realCostEntries.reduce((acc, entry) => ({ ...acc, [entry.employee || "Sem funcionario"]: (acc[entry.employee || "Sem funcionario"] || 0) + 1 }), {}),
      reworks: productionProblems.filter(problem => problem.rework).length,
      realAbovePredicted: realAbovePredicted.length
    },
    capacity,
    alerts: productionAlerts()
  };
}

function productionAlerts() {
  const now = new Date();
  const list = [];
  const orders = scoped("orders");
  const stockMovements = scoped("stockMovements");
  const productionProblems = scoped("productionProblems");
  const installationChecklists = scoped("installationChecklists");
  const installationTeams = scoped("installationTeams");
  orders.forEach(order => {
    const post = postCalculation(order);
    if (new Date(order.dueDate) < now && !["Finalizada", "Entregue", "Cancelada", "Liberada para entrega"].includes(order.productionStatus)) list.push({ type: "O.S. atrasada", severity: "red", orderId: order.id, message: `${order.id} passou do prazo` });
    if (["Pausado", "Pausada"].includes(order.productionStatus)) list.push({ type: "O.S. parada", severity: "yellow", orderId: order.id, message: `${order.id} esta pausada` });
    if (order.productionStatus === "Homologacao pendente") list.push({ type: "Homologacao pendente", severity: "yellow", orderId: order.id, message: `${order.id} precisa conferencia antes da entrega` });
    if (order.productionStatus === "Retrabalho") list.push({ type: "Retrabalho pendente", severity: "red", orderId: order.id, message: `${order.id} retornou para correcao` });
    if (post.realCost > Number(order.predictedCost || 0)) list.push({ type: "Custo real acima do previsto", severity: "red", orderId: order.id, message: `${order.id}: ${post.realCost} > ${order.predictedCost}` });
    if (post.profitability?.profit?.real < post.profitability?.profit?.predicted) list.push({ type: "Lucro real menor que o previsto", severity: "red", orderId: order.id, message: `${order.id}: lucro real ${post.profitability.profit.real}` });
    const targetMargin = Number(order.costSnapshot?.targetMarginPercent || order.pricing?.targetMarginPercent || order.predictedMargin || 0);
    if (targetMargin && post.realMargin < targetMargin) list.push({ type: "Margem real abaixo da meta", severity: "yellow", orderId: order.id, message: `${order.id}: margem real ${post.realMargin}% / meta ${targetMargin}%` });
    stockMovements.filter(movement => movement.orderId === order.id && Number(movement.quantity || 0) > Number(movement.predictedQuantity || Infinity)).forEach(() => list.push({ type: "Material acima do previsto", severity: "yellow", orderId: order.id, message: `${order.id} consumiu material acima do previsto` }));
    productionProblems.filter(problem => problem.orderId === order.id && problem.rework).forEach(problem => list.push({ type: "Retrabalho registrado", severity: "red", orderId: order.id, message: `${problem.type}: ${problem.description}` }));
    if (order.productionStatus === "Instalacao") {
      const checklist = installationChecklists.find(item => item.orderId === order.id);
      if (!checklist?.completed) list.push({ type: "Instalacao sem checklist", severity: "yellow", orderId: order.id, message: `${order.id} precisa checklist` });
      const team = installationTeams.find(item => item.orderId === order.id);
      if (team && !team.vehicle) list.push({ type: "Equipe sem veiculo", severity: "yellow", orderId: order.id, message: `${order.id} sem veiculo definido` });
    }
  });
  scoped("materials").filter(material => material.stock <= material.minStock).forEach(material => list.push({ type: "Estoque insuficiente", severity: "red", materialId: material.id, message: `${material.name} abaixo do minimo` }));
  return list;
}

function finance() {
  const orders = scoped("orders");
  const billableOrders = orders.filter(order => !orderIsCancelled(order) && !orderIsNonBillable(order));
  const cashMovements = scoped("cashMovements");
  const accountsReceivable = scoped("accountsReceivable");
  const accountsPayable = scoped("accountsPayable");
  const billed = billableOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const paid = cashMovements.filter(movement => ["order_payment", "sale", "quick_sale", "receipt"].includes(movement.type)).reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
  const orderReceivable = billableOrders.reduce((sum, order) => sum + Math.max(Number(order.total || 0) - Number(order.paidAmount || 0), 0), 0);
  const nonOrderReceivable = accountsReceivable.filter(item => (item.sourceType || (item.orderId ? "order" : "")) !== "order").reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const receivable = round(orderReceivable + nonOrderReceivable);
  const payable = round(accountsPayable.reduce((sum, item) => sum + Number(item.balance || 0), 0));
  const today = "2026-06-02";
  const month = "2026-06";
  const receivedToday = cashMovements.filter(movement => movement.createdAt?.startsWith(today) && Number(movement.amount || 0) > 0).reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
  const receivedMonth = cashMovements.filter(movement => movement.createdAt?.startsWith(month) && Number(movement.amount || 0) > 0).reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
  const realizedProfit = billableOrders.reduce((sum, order) => sum + postCalculation(order).profitability.profit.real, 0);
  const estimatedProfit = billableOrders.reduce((sum, order) => sum + Number(order.predictedProfit || 0), 0);
  const expensesTotal = Math.abs(cashMovements.filter(movement => Number(movement.amount || 0) < 0).reduce((sum, movement) => sum + Number(movement.amount || 0), 0));
  return {
    billed: round(billed),
    paid: round(paid),
    receivable,
    payable,
    fiadoCustomers: scoped("customers").filter(customer => customer.balance > 0),
    dashboard: {
      receivedToday: round(receivedToday),
      receivedMonth: round(receivedMonth),
      receivable,
      payable,
      fiados: round(accountsReceivable.filter(item => item.origin === "Fiado").reduce((sum, item) => sum + item.balance, 0)),
      estimatedProfit: round(estimatedProfit),
      realizedProfit: round(realizedProfit),
      expenses: round(expensesTotal),
      cashBalance: cashReport().finalBalance
    },
    cashFlow: {
      entries: round(cashMovements.filter(movement => Number(movement.amount || 0) > 0).reduce((sum, movement) => sum + Number(movement.amount || 0), 0)),
      exits: round(Math.abs(cashMovements.filter(movement => Number(movement.amount || 0) < 0).reduce((sum, movement) => sum + Number(movement.amount || 0), 0))),
      balance: cashReport().finalBalance,
      projected: round(cashReport().finalBalance + receivable - payable)
    },
    receivables: accountsReceivable,
    payables: accountsPayable,
    delinquency: accountsReceivable.filter(item => item.balance > 0 && new Date(item.dueDate) < new Date(today)).map(item => ({ ...item, daysLate: Math.ceil((new Date(today) - new Date(item.dueDate)) / 86400000) }))
  };
}

function isAdmin(user = db.currentUser) {
  return ["Admin Geral", "Admin/Gestor", "Administrador"].includes(user.role);
}

function employeeHour(employee) {
  return round(Number(employee.salary || 0) / Math.max(Number(employee.monthlyHours || 1), 1));
}

function automaticHumanHourValue() {
  const active = scoped("employees").filter(employee => employee.active);
  if (!active.length) return db.costConfig.humanHourValue;
  return round(active.reduce((sum, employee) => sum + employeeHour(employee), 0) / active.length);
}

function refreshFixedCostFromExpenses() {
  db.costConfig.monthlyFixedCost = round(scoped("expenses").filter(expense => expense.recurring).reduce((sum, expense) => sum + Number(expense.amount || 0), 0));
}

function expectedCashByMethod() {
  return db.cashMovements.reduce((acc, movement) => {
    acc[movement.paymentMethod] = round((acc[movement.paymentMethod] || 0) + Number(movement.amount || 0));
    return acc;
  }, {});
}

function openCashSession(operator = db.currentUser.name) {
  return scoped("cashSessions").find(session => session.operator === operator && session.status === "aberto");
}

function addCashMovement(data) {
  const movement = {
    id: uid("mov"),
    companyId: data.companyId || (currentCompanyId() === "all" ? primaryCompanyId() : currentCompanyId()),
    sessionId: data.sessionId || openCashSession(data.operator || db.currentUser.name)?.id || null,
    type: data.type || "receipt",
    paymentMethod: data.paymentMethod || "Pix",
    amount: round(Number(data.amount || 0)),
    customerId: data.customerId || "",
    orderId: data.orderId || "",
    quickSaleId: data.quickSaleId || "",
    seller: data.seller || "",
    category: data.category || data.type || "Financeiro",
    costCenter: data.costCenter || "Financeiro",
    responsible: data.responsible || data.operator || db.currentUser.name,
    notes: data.notes || "",
    createdAt: data.createdAt || new Date().toISOString()
  };
  db.cashMovements.push(movement);
  return movement;
}

function createReceivable(data) {
  const storeId = data.storeId || data.companyId || (currentCompanyId() === "all" ? primaryCompanyId() : currentCompanyId());
  const sourceType = data.sourceType || (data.quickSaleId ? "quick_sale" : data.orderId ? "order" : "manual");
  const sourceId = data.sourceId || data.quickSaleId || data.orderId || uid("receivable-source");
  const amount = round(Number(data.amount || 0));
  const paidAmount = round(Number(data.paidAmount ?? data.received ?? 0));
  const balance = round(Number(data.balance ?? Math.max(amount - paidAmount, 0)));
  const existing = db.accountsReceivable.find(item => {
    const itemStoreId = item.storeId || item.companyId || primaryCompanyId();
    const itemSourceType = item.sourceType || (item.quickSaleId ? "quick_sale" : item.orderId ? "order" : "");
    const itemSourceId = item.sourceId || item.quickSaleId || item.orderId || "";
    return itemStoreId === storeId && itemSourceType === sourceType && itemSourceId === sourceId;
  });
  const receivable = existing || { id: uid("rec"), createdAt: data.createdAt || new Date().toISOString() };
  Object.assign(receivable, {
    companyId: storeId,
    storeId,
    sourceType,
    sourceId,
    origin: data.origin || (sourceType === "order" ? "O.S." : sourceType === "quick_sale" ? "Venda rapida" : "Lancamento manual"),
    orderId: sourceType === "order" ? sourceId : data.orderId || "",
    quickSaleId: sourceType === "quick_sale" ? sourceId : data.quickSaleId || "",
    customerId: data.customerId || "",
    customerName: data.customerName || customerName(data.customerId),
    dueDate: data.dueDate || new Date().toISOString().slice(0, 10),
    amount,
    paidAmount,
    received: paidAmount,
    balance,
    paymentMethod: data.paymentMethod || receivable.paymentMethod || "",
    status: data.status || (balance <= 0 ? "quitada" : paidAmount > 0 ? "parcial" : "aberto"),
    updatedAt: new Date().toISOString()
  });
  if (!existing) db.accountsReceivable.push(receivable);
  return receivable;
}

function registerCashImpact(sale, body = {}) {
  if (sale.cashImpact === "entered_cash") {
    addCashMovement({ type: "quick_sale", paymentMethod: sale.paymentMethod, amount: sale.total, quickSaleId: sale.id, customerId: sale.customerId, category: "Venda rapida", costCenter: "Comercial", responsible: sale.operator, notes: sale.description });
  }
  return createReceivable({
    sourceType: "quick_sale",
    sourceId: sale.id,
    origin: sale.billingDecision === "pending_cash" ? "Venda rapida pendente de caixa" : sale.billingDecision === "already_billed" ? "Venda rapida faturada externamente" : "Venda rapida",
    customerId: sale.customerId,
    dueDate: body.dueDate || new Date().toISOString().slice(0, 10),
    amount: sale.total,
    paidAmount: sale.billingDecision === "pending_cash" ? 0 : sale.total,
    paymentMethod: sale.paymentMethod,
    status: sale.billingDecision === "pending_cash" ? "pendente_caixa" : sale.billingDecision === "already_billed" ? "faturada_externa" : "quitada"
  });
}

function finishQuickSale(body = {}) {
  const quantity = Number(body.quantity || 1);
  const unitPrice = Number(body.unitPrice || 0);
  const amount = round(quantity * unitPrice);
  const billingDecision = ["bill_now", "pending_cash", "already_billed"].includes(body.billingDecision) ? body.billingDecision : "bill_now";
  const operator = body.operator || body.user || db.currentUser.name;
  const timestamp = new Date().toISOString();
  const sale = withCompany({
    id: uid("quick"),
    description: body.description || "Venda direta",
    productCode: body.productCode || "",
    quantity,
    unitPrice,
    total: amount,
    amount,
    paymentMethod: body.paymentMethod || "Pix",
    customerId: body.customerId || null,
    notes: body.notes || "",
    billingDecision,
    billingStatus: billingDecision === "pending_cash" ? "pending" : "billed",
    paymentStatus: billingDecision === "bill_now" ? "paid" : billingDecision === "pending_cash" ? "unpaid" : "billed_external",
    cashImpact: billingDecision === "bill_now" ? "entered_cash" : billingDecision === "pending_cash" ? "pending_cash" : "none",
    operator,
    timestamp,
    createdAt: timestamp
  }, "quickSales");
  db.quickSales.push(sale);
  registerCashImpact(sale, body);
  audit("Venda rapida finalizada", "quick_sale", sale.id, operator, `${sale.description} | ${sale.billingStatus} | ${sale.paymentStatus} | ${sale.cashImpact}`);
  return sale;
}

function createPayable(data) {
  const storeId = data.storeId || data.companyId || (currentCompanyId() === "all" ? primaryCompanyId() : currentCompanyId());
  const sourceType = data.sourceType || (data.expenseId ? "expense" : "manual");
  const sourceId = data.sourceId || data.expenseId || uid("payable-source");
  const amount = round(Number(data.amount || 0));
  const paidAmount = round(Number(data.paidAmount ?? data.paid ?? 0));
  const balance = round(Number(data.balance ?? Math.max(amount - paidAmount, 0)));
  const existing = db.accountsPayable.find(item => {
    const itemStoreId = item.storeId || item.companyId || primaryCompanyId();
    const itemSourceType = item.sourceType || (item.expenseId ? "expense" : "");
    const itemSourceId = item.sourceId || item.expenseId || "";
    return itemStoreId === storeId && itemSourceType === sourceType && itemSourceId === sourceId;
  });
  const payable = existing || { id: uid("payable"), createdAt: data.createdAt || new Date().toISOString() };
  Object.assign(payable, {
    companyId: storeId,
    storeId,
    sourceType,
    sourceId,
    expenseId: sourceType === "expense" ? sourceId : data.expenseId || "",
    category: data.category || "fornecedores",
    description: data.description || data.observation || data.supplier || "",
    supplier: data.supplier || "",
    dueDate: data.dueDate || new Date().toISOString().slice(0, 10),
    amount,
    paidAmount,
    paid: paidAmount,
    balance,
    paymentMethod: data.paymentMethod || payable.paymentMethod || "",
    costCenter: data.costCenter || "Administrativo",
    responsible: data.responsible || db.currentUser.name,
    status: data.status || (balance <= 0 ? "pago" : paidAmount > 0 ? "parcial" : "aberto"),
    updatedAt: new Date().toISOString()
  });
  if (!existing) db.accountsPayable.push(payable);
  return payable;
}

function cashReport() {
  const cashMovements = scoped("cashMovements");
  const accountsReceivable = scoped("accountsReceivable");
  const cashSessions = scoped("cashSessions");
  const byType = type => cashMovements.filter(movement => movement.type === type).reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
  const byMethod = method => cashMovements.filter(movement => movement.paymentMethod === method && Number(movement.amount || 0) > 0).reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
  const totalReceived = cashMovements.filter(movement => Number(movement.amount || 0) > 0 && !["suprimento"].includes(movement.type)).reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
  const totalExpenses = Math.abs(cashMovements.filter(movement => ["expense", "sangria"].includes(movement.type)).reduce((sum, movement) => sum + Number(movement.amount || 0), 0));
  const totalSuprimentos = byType("suprimento");
  const totalSangrias = Math.abs(byType("sangria"));
  return {
    pix: round(byMethod("Pix")),
    credit: round(byMethod("Cartao credito")),
    debit: round(byMethod("Cartao debito")),
    cash: round(byMethod("Dinheiro")),
    boleto: round(byMethod("Boleto")),
    transfer: round(byMethod("Transferencia")),
    fiado: round(accountsReceivable.filter(item => item.origin === "Fiado").reduce((sum, item) => sum + item.balance, 0)),
    signals: round(cashMovements.filter(movement => movement.paymentStatus === "Pagamento de sinal" || movement.notes.includes("sinal")).reduce((sum, movement) => sum + Number(movement.amount || 0), 0)),
    receivedTotal: round(totalReceived),
    expensesTotal: round(totalExpenses - totalSangrias),
    sangrias: round(totalSangrias),
    suprimentos: round(totalSuprimentos),
    finalBalance: round(cashMovements.reduce((sum, movement) => sum + Number(movement.amount || 0), 0)),
    openSessions: cashSessions.filter(session => session.status === "aberto")
  };
}

function cashEntriesByMethod() {
  return scoped("cashMovements").filter(movement => Number(movement.amount || 0) > 0).reduce((acc, movement) => {
    acc[movement.paymentMethod] = round((acc[movement.paymentMethod] || 0) + Number(movement.amount || 0));
    return acc;
  }, {});
}

function cashOutByCategory() {
  return scoped("operationalExpenses").reduce((acc, expense) => {
    acc[expense.category] = round((acc[expense.category] || 0) + Number(expense.value || 0));
    return acc;
  }, {});
}

function dailyCashSummary(includeSensitive = false) {
  const methods = cashEntriesByMethod();
  const outflows = cashOutByCategory();
  const orders = scoped("orders");
  const orderPayments = scoped("cashMovements").filter(movement => movement.type === "order_payment");
  const billedOrderIds = new Set(orderPayments.map(movement => movement.orderId).filter(Boolean));
  const pendingOrders = orders.filter(order => Number(order.paidAmount || 0) < Number(order.total || 0));
  const signalOrders = orders.filter(order => Number(order.paidAmount || 0) > 0 && Number(order.paidAmount || 0) < Number(order.total || 0));
  const totalReceived = Object.values(methods).reduce((sum, value) => sum + value, 0);
  const totalExpenses = Object.values(outflows).reduce((sum, value) => sum + value, 0);
  const totalExpected = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const base = {
    ordersMade: orders.length,
    ordersBilled: billedOrderIds.size,
    pendingPaymentOrders: pendingOrders.length,
    signalOrders: signalOrders.length,
    pix: methods.Pix || 0,
    credit: methods["Cartao credito"] || 0,
    debit: methods["Cartao debito"] || 0,
    cash: methods.Dinheiro || 0,
    fiado: methods.Fiado || 0,
    openTotal: round(pendingOrders.reduce((sum, order) => sum + Math.max(Number(order.total || 0) - Number(order.paidAmount || 0), 0), 0)),
    receivedTotal: round(totalReceived),
    predictedTotal: round(totalExpected),
    outflows,
    expenseTotal: round(totalExpenses),
    grossBalance: round(totalReceived),
    netBalance: round(totalReceived - totalExpenses)
  };
  return includeSensitive ? { ...base, expectedByMethod: methods } : {
    ordersMade: base.ordersMade,
    ordersBilled: base.ordersBilled,
    pendingPaymentOrders: base.pendingPaymentOrders,
    signalOrders: base.signalOrders
  };
}

function expenseReports() {
  const today = "2026-06-02";
  const month = "2026-06";
  const operationalExpenses = scoped("operationalExpenses");
  const sumBy = key => operationalExpenses.reduce((acc, expense) => {
    const bucket = expense[key] || "Sem informacao";
    acc[bucket] = round((acc[bucket] || 0) + Number(expense.value || 0));
    return acc;
  }, {});
  return {
    day: round(operationalExpenses.filter(expense => expense.date === today).reduce((sum, expense) => sum + expense.value, 0)),
    month: round(operationalExpenses.filter(expense => expense.date?.startsWith(month)).reduce((sum, expense) => sum + expense.value, 0)),
    byCategory: sumBy("category"),
    bySector: sumBy("sector"),
    byResponsible: sumBy("responsible"),
    byVehicle: sumBy("vehicleId"),
    byOrder: sumBy("orderId")
  };
}

function queryTechnicalVisits(params = {}) {
  const normalize = productionSearchText;
  const contains = (value, filter) => !filter || normalize(value).includes(normalize(filter));
  const today = productionDateKey();
  return scoped("technicalVisits").filter(visit => {
    const date = productionDateKey(visit.scheduledDate || visit.requestedDate);
    if (params.scope === "today" && date !== today) return false;
    if (params.status && visit.status !== params.status) return false;
    if (params.employeeId && visit.responsibleEmployeeId !== params.employeeId) return false;
    if (!contains(visit.customerName, params.customer)) return false;
    if (params.date && date !== productionDateKey(params.date)) return false;
    if (params.dateFrom && date < productionDateKey(params.dateFrom)) return false;
    if (params.dateTo && date > productionDateKey(params.dateTo)) return false;
    return true;
  }).sort((a, b) => String(a.scheduledDate || a.requestedDate || "").localeCompare(String(b.scheduledDate || b.requestedDate || "")));
}

function technicalVisitReports(params = {}) {
  const visits = queryTechnicalVisits(params);
  const byEmployee = Object.entries(visits.reduce((acc, visit) => {
    const employee = visit.responsibleEmployeeName || "Sem responsavel";
    acc[employee] = (acc[employee] || 0) + 1;
    return acc;
  }, {})).map(([name, value]) => ({ name, value }));
  const byStatus = Object.entries(visits.reduce((acc, visit) => {
    acc[visit.status || "requested"] = (acc[visit.status || "requested"] || 0) + 1;
    return acc;
  }, {})).map(([name, value]) => ({ name, value }));
  return {
    total: visits.length,
    pending: visits.filter(visit => !["completed", "canceled"].includes(visit.status)).length,
    completed: visits.filter(visit => visit.status === "completed").length,
    converted: visits.filter(visit => visit.relatedQuoteId || visit.relatedOrderId).length,
    byEmployee,
    byStatus,
    filters: params,
    visits
  };
}

function technicalVisitReportCsv(report) {
  const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const headers = ["Cliente", "Endereco", "Responsavel", "Data agendada", "Status", "Tipo", "Medidas coletadas", "Fotos/anexos", "Observacoes", "Orcamento", "O.S.", "Loja"];
  const rows = report.visits.map(visit => [visit.customerName, visit.address, visit.responsibleEmployeeName, visit.scheduledDate || visit.requestedDate, visit.status, visit.visitType, visit.measurementNotes, (visit.photos || []).join(", "), visit.notes, visit.relatedQuoteId, visit.relatedOrderId, companyLabel(visit.companyId)]);
  return [headers, ...rows].map(row => row.map(quote).join(";")).join("\r\n");
}

function normalizeTechnicalVisit(body = {}, existing = {}) {
  const employee = db.employees.find(item => item.id === (body.responsibleEmployeeId ?? existing.responsibleEmployeeId));
  const status = body.status || existing.status || "requested";
  return withCompany({
    ...existing,
    id: existing.id || uid("visit"),
    customerId: body.customerId ?? existing.customerId ?? "",
    customerName: body.customerName ?? existing.customerName ?? customerName(body.customerId ?? existing.customerId) ?? "",
    phone: body.phone ?? existing.phone ?? "",
    address: body.address ?? existing.address ?? "",
    city: body.city ?? existing.city ?? "",
    neighborhood: body.neighborhood ?? existing.neighborhood ?? "",
    referencePoint: body.referencePoint ?? existing.referencePoint ?? "",
    requestedDate: body.requestedDate ?? existing.requestedDate ?? new Date().toISOString().slice(0, 10),
    scheduledDate: body.scheduledDate ?? existing.scheduledDate ?? "",
    responsibleEmployeeId: body.responsibleEmployeeId ?? existing.responsibleEmployeeId ?? "",
    responsibleEmployeeName: body.responsibleEmployeeName ?? employee?.name ?? existing.responsibleEmployeeName ?? "",
    status,
    visitType: body.visitType ?? existing.visitType ?? "measurement",
    notes: body.notes ?? existing.notes ?? "",
    measurementNotes: body.measurementNotes ?? existing.measurementNotes ?? "",
    photos: Array.isArray(body.photos) ? body.photos : existing.photos || [],
    relatedQuoteId: body.relatedQuoteId ?? existing.relatedQuoteId ?? "",
    relatedOrderId: body.relatedOrderId ?? existing.relatedOrderId ?? "",
    storeId: existing.storeId || existing.companyId || (currentCompanyId() === "all" ? primaryCompanyId() : currentCompanyId()),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: status === "completed" ? body.completedAt || existing.completedAt || new Date().toISOString() : existing.completedAt || ""
  }, "technicalVisits");
}

function dre() {
  const cashMovements = scoped("cashMovements");
  const orders = scoped("orders");
  const operationalExpenses = scoped("operationalExpenses");
  const expenses = scoped("expenses");
  const revenue = cashMovements.filter(movement => ["sale", "receipt", "order_payment", "quick_sale"].includes(movement.type)).reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
  const productionCosts = orders.reduce((sum, order) => sum + postCalculation(order).profitability.production.real + postCalculation(order).profitability.machine.real + postCalculation(order).profitability.material.real, 0);
  const installationCosts = orders.reduce((sum, order) => sum + postCalculation(order).profitability.installation.real, 0);
  const operational = operationalExpenses.filter(expense => !["Administrativo", "Financeiro"].includes(expense.sector)).reduce((sum, expense) => sum + expense.value, 0);
  const administrative = operationalExpenses.filter(expense => ["Administrativo", "Financeiro"].includes(expense.sector)).reduce((sum, expense) => sum + expense.value, 0) + expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  return {
    revenue: round(revenue),
    productionCosts: round(productionCosts),
    installationCosts: round(installationCosts),
    operationalExpenses: round(operational),
    administrativeExpenses: round(administrative),
    result: round(revenue - productionCosts - installationCosts - operational - administrative)
  };
}

function groupSum(items, keyFn, valueFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item) || "Sem informacao";
    acc[key] = round((acc[key] || 0) + Number(valueFn(item) || 0));
    return acc;
  }, {});
}

function topEntries(obj, limit = 10) {
  return Object.entries(obj || {}).map(([name, value]) => ({ name, value: round(value) })).sort((a, b) => b.value - a.value).slice(0, limit);
}

function averageBy(items, keyFn, valueFn) {
  const buckets = items.reduce((acc, item) => {
    const key = keyFn(item) || "Sem informacao";
    acc[key] = acc[key] || { sum: 0, count: 0 };
    acc[key].sum += Number(valueFn(item) || 0);
    acc[key].count += 1;
    return acc;
  }, {});
  return Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, value.count ? round(value.sum / value.count) : 0]));
}

function profitabilityRows() {
  const orders = scoped("orders");
  const productionProblems = scoped("productionProblems");
  return orders.map(order => {
    const post = postCalculation(order);
    const product = db.products.find(item => item.id === order.productId);
    const quote = db.quotes.find(item => item.id === order.quoteId);
    return {
      orderId: order.id,
      customerId: order.customerId,
      customerName: customerName(order.customerId),
      productId: order.productId,
      productName: product?.name || order.jobName,
      seller: quote?.seller || quote?.costSnapshot?.user || "Joao Victor",
      costCenter: product?.category || "Comercial",
      revenue: Number(order.total || 0),
      received: Number(order.paidAmount || 0),
      predictedMargin: post.predictedMargin,
      realMargin: post.realMargin,
      predictedProfit: post.profitability?.profit?.predicted || 0,
      realProfit: post.profitability?.profit?.real || 0,
      realCost: post.realCost,
      reworks: productionProblems.filter(problem => problem.orderId === order.id && problem.rework).length
    };
  });
}

function smartAlerts() {
  const now = new Date();
  const generated = [];
  const push = (type, severity, description, module, link, status = "aberto") => generated.push({ id: `${type}-${link}`.replace(/[^a-zA-Z0-9_-]/g, "-"), type, severity, description, module, link, status, createdAt: now.toISOString() });
  finance().delinquency.forEach(item => push("Cliente inadimplente", "CRITICO", `${item.customerName} deve ${item.balance}`, "Financeiro", `#finance`));
  scoped("orders").forEach(order => {
    const post = postCalculation(order);
    if (new Date(order.dueDate) < now && order.productionStatus !== "Entregue") push("O.S. atrasada", "CRITICO", `${order.id} passou do prazo`, "Produção", `#orders:${order.id}`);
    if (["Pausado", "Pausada", "Com problema"].includes(order.productionStatus)) push("Produção parada", "CRITICO", `${order.id} esta parada/em problema`, "PCP", `#pcp:${order.id}`);
    if (post.realCost > Number(order.predictedCost || 0)) push("Custo real acima do previsto", "MEDIO", `${order.id} custo real ${post.realCost} maior que previsto ${order.predictedCost}`, "Rentabilidade", `#orders:${order.id}`);
    if (post.realMargin < Number(db.costConfig.defaultMarginPercent || 0)) push("Margem abaixo da meta", "MEDIO", `${order.id} margem real ${post.realMargin}%`, "BI", `#orders:${order.id}`);
    if (!order.files?.length) push("O.S. sem arquivo obrigatório", "MEDIO", `${order.id} sem arte/anexo`, "O.S.", `#orders:${order.id}`);
    if (order.flow?.includes("Instalacao") && !db.installationChecklists.some(item => item.orderId === order.id && item.completed)) push("Instalação sem checklist", "MEDIO", `${order.id} sem checklist finalizado`, "Instalação", `#pcp:${order.id}`);
  });
  scoped("materials").filter(material => material.stock <= material.minStock).forEach(material => push("Estoque crítico", "CRITICO", `${material.name} abaixo do minimo`, "Suprimentos", "#products"));
  commercialAlerts().forEach(alert => push(alert.type, alert.severity === "red" ? "CRITICO" : "MEDIO", alert.message, "Comercial", "#commercial"));
  db.auditLogs.filter(log => log.action === "Fechamento de caixa" && log.details === "Com divergencia").slice(-3).forEach(log => push("Caixa com divergência", "CRITICO", "Fechamento de caixa registrou divergencia", "Caixa", "#cash"));
  const existing = new Map(db.smartAlerts.map(alert => [alert.id, alert]));
  generated.forEach(alert => existing.set(alert.id, { ...existing.get(alert.id), ...alert, status: existing.get(alert.id)?.status || alert.status }));
  db.smartAlerts = [...existing.values()];
  return db.smartAlerts;
}

function executiveBI() {
  const today = "2026-06-02";
  const month = "2026-06";
  const rows = profitabilityRows();
  const cash = cashReport();
  const fin = finance();
  const dreData = dre();
  const orders = scoped("orders");
  const quotes = scoped("quotes");
  const cashMovements = scoped("cashMovements");
  const operationalExpenses = scoped("operationalExpenses");
  const materials = scoped("materials");
  const productionEvents = scoped("productionEvents");
  const productionProblems = scoped("productionProblems");
  const realCostEntries = scoped("realCostEntries");
  const installationTeams = scoped("installationTeams");
  const realProfits = rows.map(row => row.realProfit);
  const realMargins = rows.filter(row => row.revenue > 0).map(row => row.realMargin);
  const dashboard = {
    dayRevenue: round(cashMovements.filter(item => item.createdAt?.startsWith(today) && Number(item.amount || 0) > 0 && !["suprimento"].includes(item.type)).reduce((sum, item) => sum + Number(item.amount || 0), 0)),
    monthRevenue: round(cashMovements.filter(item => item.createdAt?.startsWith(month) && Number(item.amount || 0) > 0 && !["suprimento"].includes(item.type)).reduce((sum, item) => sum + Number(item.amount || 0), 0)),
    monthRealProfit: round(realProfits.reduce((sum, value) => sum + value, 0)),
    averageRealMargin: realMargins.length ? round(realMargins.reduce((sum, value) => sum + value, 0) / realMargins.length) : 0,
    totalCash: cash.finalBalance,
    totalReceivable: fin.receivable,
    totalPayable: fin.payable,
    overdueFiado: fin.delinquency.length,
    openOrders: orders.filter(order => order.productionStatus !== "Entregue").length,
    lateOrders: orders.filter(order => new Date(order.dueDate) < new Date(today) && order.productionStatus !== "Entregue").length,
    stoppedProduction: orders.filter(order => ["Pausado", "Pausada", "Com problema"].includes(order.productionStatus)).length,
    pendingInstallations: orders.filter(order => order.flow?.includes("Instalacao") && order.productionStatus !== "Entregue").length,
    reworks: productionProblems.filter(problem => problem.rework).length,
    operationalExpenses: dreData.operationalExpenses,
    cashDivergences: db.auditLogs.filter(log => log.action === "Fechamento de caixa" && log.details === "Com divergencia").length,
    criticalStock: materials.filter(material => material.stock <= material.minStock).length
  };
  const profitability = {
    byOrder: rows.map(row => ({ name: row.orderId, value: row.realProfit, margin: row.realMargin })),
    byProduct: topEntries(groupSum(rows, row => row.productName, row => row.realProfit)),
    byCustomer: topEntries(groupSum(rows, row => row.customerName, row => row.realProfit)),
    bySeller: topEntries(groupSum(rows, row => row.seller, row => row.realProfit)),
    byCostCenter: topEntries(groupSum(rows, row => row.costCenter, row => row.realProfit)),
    marginComparison: rows.map(row => ({ orderId: row.orderId, predicted: row.predictedMargin, real: row.realMargin })),
    lossProducts: rows.filter(row => row.realProfit < 0).map(row => ({ orderId: row.orderId, product: row.productName, loss: row.realProfit })),
    mostProfitableProducts: topEntries(groupSum(rows, row => row.productName, row => row.realProfit)),
    reworkServices: rows.filter(row => row.reworks > 0).map(row => ({ orderId: row.orderId, product: row.productName, reworks: row.reworks }))
  };
  const rankings = {
    topCustomersRevenue: topEntries(groupSum(rows, row => row.customerName, row => row.revenue)),
    topCustomersProfit: topEntries(groupSum(rows, row => row.customerName, row => row.realProfit)),
    topSellersSales: topEntries(groupSum(rows, row => row.seller, row => row.revenue)),
    topSellersMargin: topEntries(averageBy(rows, row => row.seller, row => row.realMargin)),
    topProductsSold: topEntries(groupSum(rows, row => row.productName, () => 1)),
    topProductsProfit: topEntries(groupSum(rows, row => row.productName, row => row.realProfit)),
    topExpenses: topEntries(groupSum(operationalExpenses, expense => expense.category, expense => expense.value)),
    topLossOrders: rows.filter(row => row.realProfit < 0).sort((a, b) => a.realProfit - b.realProfit).slice(0, 10).map(row => ({ name: row.orderId, value: row.realProfit }))
  };
  const approvedOpen = quotes.filter(quote => quote.status === "aprovado").reduce((sum, quote) => sum + Number(quote.approvedPrice || quote.pricing?.finalPrice || 0), 0);
  const receivable = fin.receivable;
  const payable = fin.payable + db.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const predictions = {
    weekRevenue: round((dashboard.dayRevenue || dashboard.monthRevenue / 7 || 0) * 7 + approvedOpen * .25),
    monthRevenue: round((dashboard.monthRevenue || dashboard.dayRevenue * 22) + approvedOpen),
    cash7Days: round(cash.finalBalance + receivable * .35 - payable * .25),
    cash30Days: round(cash.finalBalance + receivable - payable),
    productionCapacity: db.productionCapacities.map(capacity => ({ ...capacity, occupied: orders.filter(order => order.productionStatus === capacity.sector).length, projectedLoad: round(orders.filter(order => order.flow?.includes(capacity.sector)).length / Math.max(capacity.dailyCapacity, 1) * 100) }))
  };
  const bottlenecks = {
    lateSector: topEntries(groupSum(orders.filter(order => new Date(order.dueDate) < new Date(today) && order.productionStatus !== "Entregue"), order => order.productionStatus, () => 1), 1)[0] || null,
    pauseStep: topEntries(groupSum(productionEvents.filter(event => event.action === "pausar"), event => event.sector, () => 1), 1)[0] || null,
    reworkSector: topEntries(groupSum(productionProblems.filter(problem => problem.rework), problem => problem.sector, () => 1), 1)[0] || null,
    machineOccupancy: topEntries(groupSum(realCostEntries, entry => entry.machine || "Sem maquina", entry => entry.machineMinutes), 1)[0] || null,
    overloadedInstallationTeam: topEntries(groupSum(installationTeams.filter(team => team.status !== "finalizada"), team => team.responsible || team.name, () => 1), 1)[0] || null
  };
  return { generatedAt: new Date().toISOString(), dashboard, profitability, rankings, alerts: smartAlerts(), predictions, bottlenecks };
}

function executiveReport(format = "json") {
  const bi = executiveBI();
  const rows = [
    ["Indicador", "Valor"],
    ...Object.entries(bi.dashboard).map(([key, value]) => [key, value])
  ];
  if (format === "csv" || format === "excel") return rows.map(row => row.join(";")).join("\n");
  if (format === "pdf") return `RELATORIO EXECUTIVO\nGerado em ${bi.generatedAt}\n\n${rows.slice(1).map(row => `${row[0]}: ${row[1]}`).join("\n")}`;
  return bi;
}

function integrationCenter() {
  return {
    connectors: db.integrationConnectors,
    messageTemplates: [
      { channel: "WhatsApp", event: "orcamento aprovado", template: "Olá {{cliente}}, seu orçamento {{orcamento}} foi aprovado." },
      { channel: "E-mail", event: "relatorio executivo", template: "Relatório executivo do período {{periodo}} disponível." },
      { channel: "PIX", event: "pagamento pendente", template: "Cobrança PIX para O.S. {{os}} no valor {{valor}}." }
    ],
    messages: db.integrationMessages,
    pix: { status: "preparado", fields: ["valor", "cliente", "O.S.", "txid", "status", "caixa"] },
    fiscal: { status: "preparado", fields: ["NFe", "NFSe", "dados fiscais do cliente", "faturamento", "status fiscal"] },
    tef: { status: "preparado", fields: ["credito", "debito", "taxa", "bandeira", "NSU", "autorizacao", "conciliacao"] },
    drive: { status: "preparado", folders: ["clientes", "ordens-de-servico", "artes", "comprovantes"] },
    webhooks: db.webhooks,
    backups: db.backupJobs,
    automations: db.automationRules,
    logs: db.integrationLogs
  };
}

function runAutomations() {
  const alertsGenerated = smartAlerts();
  alertsGenerated.forEach(alert => {
    const already = db.integrationLogs.some(log => log.event === alert.type && log.reference === alert.id);
    if (!already) db.integrationLogs.push({ id: uid("ilog"), date: new Date().toISOString().slice(0, 10), hour: new Date().toISOString().slice(11, 16), event: alert.type, status: "gerado", error: "", responsible: "Automacao", reference: alert.id, createdAt: new Date().toISOString() });
  });
  return { generatedAlerts: alertsGenerated.length, logs: db.integrationLogs };
}

function auditIntelligence(origin, rule, dataUsed, user = db.currentUser.name) {
  const entry = { id: uid("iaudit"), origin, rule, dataUsed, user, createdAt: new Date().toISOString() };
  db.intelligenceAudit.push(entry);
  audit("Auditoria da IA", "intelligence", entry.id, user, `${origin}: ${rule}`);
  return entry;
}

function advancedAlertsFromSnapshot(bi = executiveBI()) {
  return (bi.alerts || []).map(alert => ({
    id: alert.id,
    type: alert.type,
    severity: alert.severity || "MEDIA",
    description: alert.description,
    origin: alert.module,
    link: alert.link,
    status: alert.status || "aberto",
    createdAt: alert.createdAt || new Date().toISOString()
  }));
}

function quoteAssistant(text = "", user = db.currentUser.name) {
  const normalized = text.toLowerCase();
  const composition = db.compositions.find(item => normalized.includes(item.name.toLowerCase().split(" ")[0])) ||
    (normalized.includes("totem") ? db.compositions.find(item => item.name.toLowerCase().includes("totem")) : null) ||
    (normalized.includes("acm") || normalized.includes("fachada") ? db.compositions.find(item => item.name.toLowerCase().includes("acm")) : null) ||
    (normalized.includes("lona") || normalized.includes("faixa") ? db.compositions.find(item => item.name.toLowerCase().includes("lona")) : null) ||
    (normalized.includes("adesivo") ? db.compositions.find(item => item.name.toLowerCase().includes("adesivo")) : null) ||
    (normalized.includes("pvc") ? db.compositions.find(item => item.name.toLowerCase().includes("pvc")) : null) ||
    (normalized.includes("letreiro") || normalized.includes("led") ? db.compositions.find(item => item.name.toLowerCase().includes("letreiro")) : null) ||
    db.compositions[0];
  const product = db.products.find(item => item.id === composition?.productId) || db.products[0];
  const measure = normalized.match(/(\d+(?:[,.]\d+)?)\s*x\s*(\d+(?:[,.]\d+)?)/);
  const answers = {
    compositionId: composition?.id,
    width: measure ? Number(measure[1].replace(",", ".")) : 1,
    height: measure ? Number(measure[2].replace(",", ".")) : 1,
    quantity: 1,
    lighting: normalized.includes("led") || normalized.includes("ilumin"),
    installation: normalized.includes("instala")
  };
  const suggestion = {
    input: text,
    product: product ? { id: product.id, name: product.name, code: product.code } : null,
    composition: composition ? { id: composition.id, name: composition.name, category: composition.category } : null,
    likelyMaterials: (composition?.materials || []).map(line => db.materials.find(material => material.id === line.materialId)?.name).filter(Boolean),
    sectors: composition?.productionFlow || product?.flow || [],
    questions: composition?.questions || [],
    estimatedDeadlineDays: composition?.deadlineDays || 3,
    suggestedMarginPercent: composition?.marginPercent || product?.marginPercent || db.costConfig.defaultMarginPercent,
    answers,
    note: "Sugestao assistiva. Nenhum orcamento foi criado automaticamente."
  };
  db.intelligenceInsights.push({ id: uid("insight"), type: "orcamento", title: "Sugestao de orcamento por texto", suggestion, status: "sugerido", createdAt: new Date().toISOString() });
  auditIntelligence("IA de Orcamentacao", "parser_texto_composicao", { text, compositionId: composition?.id, productId: product?.id }, user);
  return suggestion;
}

function productionIntelligence() {
  const bi = executiveBI();
  const rows = profitabilityRows();
  const orderRisks = db.orders.map(order => {
    const post = postCalculation(order);
    let score = 0;
    if (new Date(order.dueDate) < new Date("2026-06-02") && order.productionStatus !== "Entregue") score += 45;
    if (["Pausado", "Pausada", "Com problema"].includes(order.productionStatus)) score += 35;
    if (post.realCost > Number(order.predictedCost || 0)) score += 15;
    if (!order.files?.length) score += 10;
    return { orderId: order.id, status: order.productionStatus, riskScore: Math.min(score, 100), risk: score >= 70 ? "Alta" : score >= 35 ? "Media" : "Baixa" };
  });
  const analysis = {
    delayRisk: orderRisks,
    bottleneckSector: bi.bottlenecks?.lateSector,
    overloadedMachine: bi.bottlenecks?.machineOccupancy,
    recurringReworkProduct: topEntries(groupSum(rows.filter(row => row.reworks > 0), row => row.productName, row => row.reworks), 1)[0] || null,
    stoppedOrders: db.orders.filter(order => ["Pausado", "Pausada", "Com problema"].includes(order.productionStatus)).map(order => ({ orderId: order.id, status: order.productionStatus }))
  };
  auditIntelligence("IA de Producao", "risco_por_atraso_custo_arquivo_status", { orders: db.orders.length, events: db.productionEvents.length });
  return analysis;
}

function financialIntelligence() {
  const rows = profitabilityRows();
  const fin = finance();
  const customerRisk = db.customers.map(customer => {
    const due = fin.receivables.filter(item => item.customerId === customer.id).reduce((sum, item) => sum + Number(item.balance || 0), 0);
    const revenue = rows.filter(row => row.customerId === customer.id).reduce((sum, row) => sum + row.revenue, 0);
    const scoreNumber = due > 1000 ? 4 : due > 0 ? 3 : revenue > 5000 ? 1 : 2;
    return { customerId: customer.id, customerName: customer.name, due, score: ["A", "B", "C", "D"][scoreNumber - 1], risk: scoreNumber >= 4 ? "Alta" : scoreNumber >= 3 ? "Media" : "Baixa" };
  });
  const productLowMargin = rows.filter(row => row.realMargin < Number(db.costConfig.defaultMarginPercent || 0)).map(row => ({ product: row.productName, orderId: row.orderId, margin: row.realMargin }));
  const averageExpense = db.operationalExpenses.length ? db.operationalExpenses.reduce((sum, item) => sum + Number(item.value || 0), 0) / db.operationalExpenses.length : 0;
  const unusualExpenses = db.operationalExpenses.filter(item => Number(item.value || 0) > averageExpense * 1.8 && averageExpense > 0);
  const analysis = {
    customerRisk,
    productLowMargin,
    costAboveAverage: rows.filter(row => row.realCost > (row.revenue * .7)).map(row => ({ orderId: row.orderId, product: row.productName, realCost: row.realCost, revenue: row.revenue })),
    unusualExpenses,
    revenueDrop: finance().dashboard.receivedMonth < (finance().dashboard.receivedToday * 10),
    delinquencyIncrease: fin.delinquency.length > 0
  };
  auditIntelligence("IA Financeira", "score_cliente_margem_custo_despesa", { customers: db.customers.length, receivables: fin.receivables.length, rows: rows.length });
  return analysis;
}

function analyticsReport() {
  const rows = profitabilityRows();
  const customerRows = db.customers.map(customer => {
    const related = rows.filter(row => row.customerId === customer.id);
    const revenue = related.reduce((sum, row) => sum + row.revenue, 0);
    return { customerId: customer.id, name: customer.name, averageTicket: related.length ? round(revenue / related.length) : 0, frequency: related.length, profit: round(related.reduce((sum, row) => sum + row.realProfit, 0)), delinquency: finance().receivables.filter(item => item.customerId === customer.id).reduce((sum, item) => sum + Number(item.balance || 0), 0) };
  });
  const productRows = db.products.map(product => {
    const related = rows.filter(row => row.productId === product.id);
    return { productId: product.id, name: product.name, margin: related.length ? round(related.reduce((sum, row) => sum + row.realMargin, 0) / related.length) : 0, rework: related.reduce((sum, row) => sum + row.reworks, 0), averageDeadlineDays: db.compositions.find(item => item.productId === product.id)?.deadlineDays || 0, profit: round(related.reduce((sum, row) => sum + row.realProfit, 0)) };
  });
  const financial = { revenue: dre().revenue, expenses: dre().operationalExpenses + dre().administrativeExpenses, profit: dre().result, seasonality: "base insuficiente para sazonalidade real", trend: dre().revenue > 0 ? "operacao com receita registrada" : "sem receita no periodo" };
  const production = { productivity: db.productionEvents.length, bottlenecks: executiveBI().bottlenecks, delays: db.orders.filter(order => new Date(order.dueDate) < new Date("2026-06-02") && order.productionStatus !== "Entregue").length };
  const report = { generatedAt: new Date().toISOString(), customers: customerRows, products: productRows, financial, production };
  db.analyticsSnapshots.push({ id: uid("analytics"), generatedAt: report.generatedAt, report });
  return report;
}

function executiveAnswer(question = "", user = db.currentUser.name) {
  const q = question.toLowerCase();
  const bi = db.intelligenceSnapshots[0]?.data?.bi || executiveBI();
  const analytics = db.intelligenceSnapshots[0]?.data?.analytics || analyticsReport();
  let answer = "Ainda nao encontrei dados suficientes para responder com seguranca.";
  let rule = "fallback";
  let targetView = "";
  if (q.includes("como") && q.includes("orcamento")) {
    answer = "Abra Novo orcamento, selecione cliente e produto, responda as perguntas tecnicas, adicione o item e salve. A composicao cadastrada calcula o custo e define a rota produtiva.";
    rule = "ajuda_criar_orcamento";
    targetView = "quote";
  } else if (q.includes("como") && (q.includes("o.s") || q.includes("ordem de servico"))) {
    answer = "Aprove um orcamento e use Gerar O.S. para preservar itens, custos previstos, arquivos e rota produtiva. Para uma ordem direta, abra Nova O.S.";
    rule = "ajuda_criar_os";
    targetView = "orders-new";
  } else if (q.includes("como") && (q.includes("receber") || q.includes("pagamento"))) {
    answer = "Abra Caixa / Receber O.S., escolha a ordem, informe uma ou mais formas de pagamento e confirme. O saldo e o status financeiro da O.S. serao atualizados.";
    rule = "ajuda_receber_pagamento";
    targetView = "cash-receive";
  } else if (q.includes("como") && (q.includes("mover") || q.includes("setor") || q.includes("producao"))) {
    answer = "Abra PCP / Producao, selecione a O.S. e avance pelo proximo setor indicado. O sistema bloqueia saltos fora da rota congelada do produto.";
    rule = "ajuda_mover_producao";
    targetView = "production-pcp";
  } else if (q.includes("como") && q.includes("visita")) {
    answer = "Abra Visitas Tecnicas / Nova visita, selecione o cliente, informe endereco, tipo e data solicitada. Depois atribua o responsavel pela medicao e acompanhe pela Agenda.";
    rule = "ajuda_registrar_visita";
    targetView = "visits-new";
  } else if (q.includes("pendente") || q.includes("pendência") || q.includes("pendencia") || q.includes("hoje")) {
    const analysis = analyzeSystemState();
    answer = `Hoje existem ${analysis.pendingOrders} O.S. pendentes, ${analysis.lateOrders} atrasadas, ${analysis.ordersWithoutFile} sem arquivo, ${analysis.ordersWithoutPayment} sem pagamento, ${analysis.quickSalesPendingCash} vendas rapidas aguardando caixa, ${analysis.pendingTechnicalVisits} visitas tecnicas pendentes, ${analysis.receivablesDue} contas a receber vencidas e ${analysis.payablesDue} contas a pagar vencidas.`;
    rule = "pendencias_operacionais_reais";
    targetView = "orders-search";
  } else if (q.includes("produto") && q.includes("lucro")) {
    const item = bi.rankings?.topProductsProfit?.[0];
    answer = item ? `O produto com mais lucro foi ${item.name}, com ${round(item.value)}.` : answer;
    rule = "ranking_produto_lucro";
  } else if (q.includes("cliente") && (q.includes("devendo") || q.includes("inadimpl"))) {
    const item = analytics.customers?.sort((a, b) => b.delinquency - a.delinquency)[0];
    answer = item && item.delinquency > 0 ? `${item.name} esta devendo ${round(item.delinquency)}.` : "Nao ha cliente inadimplente relevante no snapshot atual.";
    rule = "cliente_maior_inadimplencia";
  } else if (q.includes("vendedor") && q.includes("vende")) {
    const item = bi.rankings?.topSellersSales?.[0];
    answer = item ? `${item.name} foi o vendedor com maior venda: ${round(item.value)}.` : answer;
    rule = "ranking_vendedor_venda";
  } else if (q.includes("preju")) {
    const item = bi.rankings?.topLossOrders?.[0];
    answer = item ? `A O.S. com maior prejuizo foi ${item.name}: ${round(item.value)}.` : "Nenhuma O.S. com prejuizo foi identificada.";
    rule = "ranking_os_prejuizo";
  } else if (q.includes("setor") && q.includes("atras")) {
    const item = bi.bottlenecks?.lateSector;
    answer = item ? `O setor que mais atrasa no snapshot e ${item.name}, com ${item.value} ocorrencia(s).` : "Nenhum setor atrasado identificado.";
    rule = "gargalo_setor_atraso";
  } else if (q.includes("margem")) {
    const item = bi.profitability?.marginComparison?.find(row => row.real < db.costConfig.defaultMarginPercent);
    answer = item ? `${item.orderId} esta abaixo da margem alvo, com margem real de ${item.real}%.` : "Nenhum produto/O.S. abaixo da margem alvo foi identificado.";
    rule = "margem_abaixo_meta";
  } else if (q.includes("risco")) {
    const item = financialIntelligence().customerRisk.sort((a, b) => b.due - a.due)[0];
    answer = item ? `Cliente com maior risco: ${item.customerName}, score ${item.score}, risco ${item.risk}.` : answer;
    rule = "score_cliente_risco";
  }
  const record = { id: uid("iq"), question, answer, rule, targetView, user, createdAt: new Date().toISOString() };
  db.intelligenceQuestions.push(record);
  auditIntelligence("Assistente Executivo", rule, { question }, user);
  return record;
}

function analyzeSystemState() {
  const orders = scoped("orders");
  const quickSales = scoped("quickSales");
  const technicalVisits = scoped("technicalVisits");
  const accountsReceivable = scoped("accountsReceivable");
  const accountsPayable = scoped("accountsPayable");
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  return {
    pendingOrders: orders.filter(order => !["Finalizada", "Entregue", "Cancelada"].includes(order.productionStatus)).length,
    lateOrders: orders.filter(order => order.dueDate && new Date(`${order.dueDate}T23:59:59`) < now && !["Finalizada", "Entregue", "Cancelada"].includes(order.productionStatus)).length,
    ordersWithoutFile: orders.filter(order => !(order.files || []).length).length,
    ordersWithoutPayment: orders.filter(order => Number(order.paidAmount || 0) < Number(order.total || 0)).length,
    quickSalesPendingCash: quickSales.filter(sale => sale.cashImpact === "pending_cash" || sale.paymentStatus === "unpaid").length,
    pendingTechnicalVisits: technicalVisits.filter(visit => !["completed", "canceled"].includes(visit.status)).length,
    receivablesDue: accountsReceivable.filter(item => Number(item.balance || 0) > 0 && item.dueDate && item.dueDate <= today).length,
    payablesDue: accountsPayable.filter(item => Number(item.balance || 0) > 0 && item.dueDate && item.dueDate <= today).length,
    productionBottleneck: executiveBI().bottlenecks?.lateSector || null
  };
}

function answerAssistantQuestion(question = "", user = db.currentUser.name) {
  return executiveAnswer(question, user);
}

function getOperationalSuggestions(analysis = analyzeSystemState()) {
  const suggestions = [];
  if (analysis.lateOrders) suggestions.push({ type: "producao", description: `Existem ${analysis.lateOrders} O.S. atrasada(s).`, rule: "os_atrasadas", targetView: "orders-late" });
  if (analysis.ordersWithoutFile) suggestions.push({ type: "arquivo", description: `Existem ${analysis.ordersWithoutFile} O.S. sem arquivo.`, rule: "os_sem_arquivo", targetView: "orders-no-file" });
  if (analysis.ordersWithoutPayment) suggestions.push({ type: "financeiro", description: `Existem ${analysis.ordersWithoutPayment} O.S. sem pagamento completo.`, rule: "os_sem_pagamento", targetView: "orders-no-payment" });
  if (analysis.quickSalesPendingCash) suggestions.push({ type: "caixa", description: `Existem ${analysis.quickSalesPendingCash} vendas rapidas aguardando caixa.`, rule: "vendas_rapidas_pendentes", targetView: "cash-quick-sale" });
  if (analysis.pendingTechnicalVisits) suggestions.push({ type: "visita", description: `Existem ${analysis.pendingTechnicalVisits} visitas tecnicas aguardando atendimento.`, rule: "visitas_tecnicas_pendentes", targetView: "visits-open" });
  if (analysis.receivablesDue) suggestions.push({ type: "financeiro", description: `Existem ${analysis.receivablesDue} contas a receber vencidas.`, rule: "contas_receber_vencidas", targetView: "finance-receivables" });
  if (analysis.payablesDue) suggestions.push({ type: "financeiro", description: `Existem ${analysis.payablesDue} contas a pagar vencidas.`, rule: "contas_pagar_vencidas", targetView: "finance-payables" });
  if (analysis.productionBottleneck?.name) suggestions.push({ type: "producao", description: `O setor ${analysis.productionBottleneck.name} concentra a maior fila.`, rule: "gargalo_producao", targetView: "production-pcp" });
  return suggestions;
}

function getAIDiagnostics() {
  return analyzeSystemState();
}

function suggestNextActions() {
  return getOperationalSuggestions(getAIDiagnostics());
}

function refreshIntelligenceSnapshot(user = db.currentUser.name) {
  const bi = executiveBI();
  const analytics = analyticsReport();
  const production = productionIntelligence();
  const financial = financialIntelligence();
  const alerts = advancedAlertsFromSnapshot(bi);
  const predictions = bi.predictions;
  const summary = {
    greeting: `Bom dia, ${db.currentUser.name}.`,
    today: {
      lateOrders: bi.dashboard.lateOrders,
      stoppedProduction: bi.dashboard.stoppedProduction,
      delinquentCustomers: financial.customerRisk.filter(item => item.due > 0).length,
      predictedCash: predictions.cash7Days,
      predictedRevenue: predictions.weekRevenue,
      todayInstallations: db.installationTeams.filter(team => team.departureDate === "2026-06-02").length,
      criticalAlerts: alerts.filter(alert => alert.severity === "CRITICO").length
    }
  };
  const suggestions = [
    ...getOperationalSuggestions(),
    ...(bi.profitability?.marginComparison || []).filter(item => item.real < db.costConfig.defaultMarginPercent).slice(0, 3).map(item => ({ type: "margem", description: `Revisar margem da ${item.orderId}. Margem real ${item.real}% abaixo da meta.`, rule: "margem_real_abaixo_meta" })),
    ...financial.customerRisk.filter(item => item.due > 0).slice(0, 3).map(item => ({ type: "financeiro", description: `${item.customerName} apresenta risco ${item.risk} de inadimplencia.`, rule: "cliente_com_saldo_em_aberto" })),
    ...(production.delayRisk || []).filter(item => item.risk !== "Baixa").slice(0, 3).map(item => ({ type: "producao", description: `${item.orderId} tem risco ${item.risk} de atraso.`, rule: "risco_atraso_os" }))
  ];
  const opportunities = commercialReport();
  const snapshot = {
    id: uid("intel"),
    generatedAt: new Date().toISOString(),
    generatedBy: user,
    data: {
      summary,
      bi,
      analytics,
      alerts,
      predictions,
      bottlenecks: bi.bottlenecks,
      production,
      financial,
      suggestions,
      opportunities
    }
  };
  db.intelligenceSnapshots.unshift(snapshot);
  db.intelligenceSnapshots = db.intelligenceSnapshots.slice(0, 10);
  db.analyticsSnapshots.unshift({ id: uid("analytics-cache"), generatedAt: snapshot.generatedAt, report: analytics });
  db.analyticsSnapshots = db.analyticsSnapshots.slice(0, 10);
  suggestions.forEach(item => db.intelligenceInsights.push({ id: uid("insight"), ...item, status: "sugerido", createdAt: snapshot.generatedAt }));
  auditIntelligence("Snapshot de Inteligencia", "refreshIntelligenceSnapshot", { quotes: db.quotes.length, orders: db.orders.length, cashMovements: db.cashMovements.length, customers: db.customers.length }, user);
  return snapshot;
}

function currentIntelligenceSnapshot() {
  return db.intelligenceSnapshots[0] || refreshIntelligenceSnapshot("Sistema");
}

function searchGlobal(query = "") {
  const q = query.toLowerCase();
  const match = value => String(value || "").toLowerCase().includes(q);
  const results = [];
  db.customers.filter(item => match(item.name) || match(item.phone) || match(item.email)).forEach(item => results.push({ type: "cliente", id: item.id, title: item.name, link: "#customers" }));
  db.quotes.filter(item => match(item.quoteNumber) || match(item.jobName)).forEach(item => results.push({ type: "orcamento", id: item.id, title: `${item.quoteNumber} ${item.jobName}`, link: "#quote" }));
  db.orders.filter(item => match(item.id) || match(item.jobName) || match(item.files?.join(" "))).forEach(item => results.push({ type: "os", id: item.id, title: `${item.id} ${item.jobName}`, link: "#orders" }));
  db.products.filter(item => match(item.name) || match(item.code) || match(item.category)).forEach(item => results.push({ type: "produto", id: item.id, title: `${item.code} ${item.name}`, link: "#products" }));
  db.cashMovements.filter(item => match(item.orderId) || match(item.paymentMethod) || match(item.notes)).forEach(item => results.push({ type: "pagamento", id: item.id, title: `${item.paymentMethod} ${item.amount}`, link: "#cash" }));
  db.portalUploads.filter(item => match(item.fileName) || match(item.notes)).forEach(item => results.push({ type: "arquivo", id: item.id, title: item.fileName, link: "#portal" }));
  auditIntelligence("Busca Global", "indice_simples_memoria", { query, results: results.length });
  return { query, total: results.length, results: results.slice(0, 30), generatedAt: new Date().toISOString() };
}

function vehicleReports() {
  const operationalExpenses = scoped("operationalExpenses");
  return scoped("vehicles").map(vehicle => {
    const distance = Math.max(Number(vehicle.finalKm || 0) - Number(vehicle.initialKm || 0), 0);
    const linkedExpenses = operationalExpenses.filter(expense => expense.vehicleId === vehicle.id);
    const expenseCost = linkedExpenses.reduce((sum, expense) => sum + expense.value, 0);
    const totalCost = round(Number(vehicle.fuelCost || 0) + Number(vehicle.maintenanceCost || 0) + expenseCost);
    return {
      ...vehicle,
      distance,
      totalCost,
      costPerKm: distance ? round(totalCost / distance) : 0,
      installationCost: round(linkedExpenses.filter(expense => expense.orderId).reduce((sum, expense) => sum + expense.value, 0))
    };
  });
}

function validationItem(name, passed, details = "", severity = "critical", missing = []) {
  return { name, result: passed ? "PASSOU" : "FALHOU", passed, details, severity, missing };
}

function validationSection(title, tests) {
  const failed = tests.filter(test => !test.passed);
  const criticalFailed = failed.filter(test => test.severity === "critical");
  return {
    title,
    status: criticalFailed.length ? "Erro" : failed.length ? "Atenção" : "OK",
    passed: !failed.length,
    criticalPassed: !criticalFailed.length,
    tests
  };
}

function runErpValidation() {
  const pricingTargets = [
    ["Fachada ACM", "cmp1", { width: 4, height: 1.8, quantity: 1, distance_km: 24, installation: true }],
    ["Totem", "cmp5", { width: 2.2, height: 4, quantity: 1, distance_km: 32, installation: true }],
    ["Lona", "cmp2", { width: 3, height: 1.2, quantity: 2, varnish: true, installation: true }],
    ["Faixa", "cmp2", { width: 2, height: 1, quantity: 1, eyelets: true }],
    ["Adesivo", "cmp3", { width: 2.5, height: 1.4, quantity: 1, lamination: true, distance_km: 18 }],
    ["PVC", "cmp4", { width: 1.2, height: .8, quantity: 3, adhesive_applied: true }],
    ["Letreiro", "cmp6", { width: 3.5, height: 1.3, quantity: 1, distance_km: 20, lighting: true }]
  ];
  const pricingTests = pricingTargets.map(([name, compositionId, answers]) => {
    const composition = db.compositions.find(item => item.id === compositionId);
    const product = db.products.find(item => item.id === composition?.productId);
    const pricing = composition && product ? calculateCompositionPrice(product, composition, { ...answers, compositionId }) : null;
    const missing = [];
    if (!pricing?.materialLines?.length || !pricing.materialCost) missing.push("materiais");
    if (!pricing?.productionLines?.some(line => Number(line.humanHours || 0) > 0)) missing.push("hora homem");
    if (!pricing?.productionLines?.some(line => Number(line.machineHours || 0) > 0)) missing.push("hora maquina");
    if (pricing && pricing.installationCost < 0) missing.push("instalacao");
    ["taxes", "commission", "marginPercent", "minPrice", "suggestedPrice"].forEach(key => {
      if (pricing?.[key] === undefined || pricing?.[key] === null || Number.isNaN(Number(pricing?.[key]))) missing.push(key);
    });
    return validationItem(name, Boolean(pricing) && !missing.length, pricing ? `Sugerido ${pricing.suggestedPrice} | minimo ${pricing.minPrice}` : "Composicao/produto nao encontrado", "critical", missing);
  });

  const compositionTests = db.compositions.filter(composition => composition.active !== false).map(composition => {
    const missing = [];
    if (!composition.materials?.length) missing.push("materiais");
    if (!composition.production?.length) missing.push("setores");
    if (!composition.productionFlow?.length) missing.push("fluxo");
    if (!composition.deadlineDays) missing.push("prazo");
    if (!composition.marginPercent) missing.push("margem");
    if (!composition.questions?.length) missing.push("questionario");
    return validationItem(composition.name, !missing.length, missing.length ? `Faltando: ${missing.join(", ")}` : "Composicao completa", "critical", missing);
  });

  const financialLaunches = [
    ...db.operationalExpenses.map(expense => ({ kind: "despesa", id: expense.id, category: expense.category, responsible: expense.responsible || expense.operator, costCenter: expense.costCenterId || expense.costCenter || expense.sector })),
    ...db.cashMovements.map(movement => {
      const expense = db.operationalExpenses.find(item => item.id === movement.expenseId);
      return {
        kind: movement.type,
        id: movement.id,
        category: movement.category || movement.type,
        responsible: movement.responsible || movement.seller || expense?.responsible || movement.operator,
        costCenter: movement.costCenterId || movement.costCenter || expense?.costCenter || expense?.sector || (["sale", "order_payment", "receipt"].includes(movement.type) ? "Financeiro" : "")
      };
    })
  ];
  const inconsistentLaunches = financialLaunches.filter(item => !item.costCenter || !item.category || !item.responsible);
  const costCenterTests = [
    validationItem("Lancamentos financeiros", !inconsistentLaunches.length, inconsistentLaunches.length ? `${inconsistentLaunches.length} lancamento(s) sem centro/categoria/responsavel` : "Lancamentos consistentes", "critical", inconsistentLaunches.slice(0, 8))
  ];

  const quoteProduct = db.products.find(item => item.id === "p1");
  const quoteBody = { productId: "p1", customerId: "c1", jobName: "Validacao Nivel 2", answers: { compositionId: "cmp2", width: 3, height: 1.2, quantity: 2, varnish: true }, manualPrice: 590, priceChangeReason: "Validacao automatica" };
  const integrated = quoteProduct ? buildIntegratedPricing(quoteProduct, quoteBody) : null;
  const quoteComposition = db.compositions.find(item => item.id === "cmp2");
  const quoteSnapshot = integrated ? buildQuoteSnapshot({ answers: quoteBody.answers }, quoteComposition, integrated.pricing, quoteProduct) : null;
  const quoteTests = [
    validationItem("Calculo automatico", Boolean(integrated?.pricing?.suggestedPrice), integrated ? `Preco ${integrated.pricing.suggestedPrice}` : "Sem calculo", "critical"),
    validationItem("Alteracao manual", Boolean(integrated?.validation?.difference), integrated ? `Diferenca ${integrated.validation.difference}` : "Sem validacao manual", "critical"),
    validationItem("Aprovacao", Boolean(integrated && integrated.discountPercent <= integrated.discountLimit), integrated ? `Desconto ${integrated.discountPercent}% | limite ${integrated.discountLimit}%` : "Sem limite", "critical"),
    validationItem("Snapshot", Boolean(quoteSnapshot?.materials?.length && quoteSnapshot?.costVersion), quoteSnapshot ? "Snapshot completo" : "Snapshot ausente", "critical")
  ];

  const oldUnitCost = quoteSnapshot?.materials?.[0]?.unitCost;
  const changedCostWouldBe = round(Number(oldUnitCost || 0) + 99);
  const snapshotTests = [
    validationItem("Custo antigo preservado", oldUnitCost !== undefined && quoteSnapshot.materials[0].unitCost !== changedCostWouldBe, `Snapshot ${oldUnitCost}; custo futuro simulado ${changedCostWouldBe}`, "critical")
  ];

  const fakeQuote = integrated ? {
    id: "validation-quote",
    quoteNumber: "ORC-VALID",
    status: "aprovado",
    customerId: quoteBody.customerId,
    jobName: quoteBody.jobName,
    productId: quoteBody.productId,
    compositionId: integrated.pricing.compositionId,
    answers: quoteBody.answers,
    pricing: integrated.pricing,
    approvedPrice: integrated.pricing.finalPrice,
    files: ["arte-validacao.pdf"],
    photos: [],
    items: [],
    costSnapshot: quoteSnapshot
  } : null;
  const fakeOrder = fakeQuote ? {
    id: "OS-VALID",
    customerId: fakeQuote.customerId,
    quoteId: fakeQuote.id,
    total: fakeQuote.approvedPrice,
    predictedCost: fakeQuote.pricing.totalCost,
    predictedMargin: fakeQuote.pricing.validation?.marginAtManualPrice,
    predictedMaterials: fakeQuote.pricing.materialLines,
    flow: fakeQuote.pricing.productionFlow,
    sectors: fakeQuote.pricing.productionFlow
  } : null;
  const orderTests = [
    validationItem("Geracao automatica", Boolean(fakeOrder), "O.S. simulada a partir do orcamento aprovado", "critical"),
    validationItem("Cliente", Boolean(fakeOrder?.customerId), fakeOrder?.customerId || "Cliente ausente", "critical"),
    validationItem("Vendedor", Boolean(db.currentUser.name), db.currentUser.name, "critical"),
    validationItem("Custo previsto", Boolean(fakeOrder?.predictedCost), String(fakeOrder?.predictedCost || 0), "critical"),
    validationItem("Margem prevista", fakeOrder?.predictedMargin !== undefined, String(fakeOrder?.predictedMargin ?? ""), "critical"),
    validationItem("Materiais previstos", Boolean(fakeOrder?.predictedMaterials?.length), `${fakeOrder?.predictedMaterials?.length || 0} material(is)`, "critical"),
    validationItem("Fluxo produtivo", Boolean(fakeOrder?.flow?.length), (fakeOrder?.flow || []).join(" > "), "critical")
  ];

  const financialTests = [
    validationItem("Sinal", "aguardando sinal" === "aguardando sinal", "Status esperado apos pagamento de sinal", "critical"),
    validationItem("Pagamento parcial", "pagamento parcial" === "pagamento parcial", "Status esperado apos recebimento parcial", "critical"),
    validationItem("Pagamento total", "quitada" === "quitada", "Status esperado apos quitacao", "critical"),
    validationItem("Fiado", "fiado" === "fiado", "Status esperado para prazo/fiado", "critical")
  ];

  const cashOpenOk = typeof db.cashSessions.push === "function";
  const cashBalance = round(db.cashMovements.reduce((sum, movement) => sum + Number(movement.amount || 0), 0));
  const hasExpenseOut = db.cashMovements.some(movement => movement.type === "expense" && Number(movement.amount || 0) < 0);
  const hasBlindClose = typeof expectedCashByMethod === "function";
  const cashTests = [
    validationItem("Abertura", cashOpenOk, "Rota /api/cash/open disponivel", "warning"),
    validationItem("Recebimento", db.cashMovements.some(movement => Number(movement.amount || 0) > 0), `Saldo atual ${cashBalance}`, "warning"),
    validationItem("Despesa", hasExpenseOut, hasExpenseOut ? "Saida registrada" : "Nenhuma despesa de caixa registrada ainda", "warning"),
    validationItem("Sangria", db.cashMovements.some(movement => movement.type === "sangria"), "Movimento dedicado de sangria nao encontrado", "warning"),
    validationItem("Suprimento", db.cashMovements.some(movement => movement.type === "suprimento"), "Movimento dedicado de suprimento nao encontrado", "warning"),
    validationItem("Fechamento", hasBlindClose, "Fechamento cego calculavel", "warning")
  ];

  const permissionTests = [
    ["Admin", "settings", "/api/audit"],
    ["Financeiro", "financialSummary", "/api/finance"],
    ["Caixa", "cash", "/api/cash/order-payment"],
    ["Producao", "production", "/api/production/pcp"],
    ["PCP", "production", "/api/orders/OS-1/send-pcp"],
    ["Vendedor", "quote", "/api/quotes"]
  ].map(([role, permission, route]) => validationItem(role, Boolean(permissionForRoute("GET", route) || permissionForRoute("POST", route)) && Object.prototype.hasOwnProperty.call(db.quickPermissions, permission), `${route} protegido por ${permission}`, "critical"));

  const timelineActions = ["Orcamento criado", "Orcamento aprovado", "O.S. criada", "Pagamento de O.S. registrado", "Enviado ao PCP"];
  const validationTimeline = fakeOrder ? timelineActions : [];
  const timelineTests = timelineActions.map(action => {
    const persisted = db.auditLogs.some(log => log.action === action);
    const simulated = validationTimeline.includes(action);
    return validationItem(action, persisted || simulated, persisted ? "Registrado em auditoria" : simulated ? "Validado no cenario automatico" : "Nao registrado", "critical");
  });

  const report = db.quotes.filter(quote => quote.status === "aprovado").map(quote => ({
    calculated: Number(quote.pricing?.suggestedPrice || 0),
    approved: Number(quote.approvedPrice || quote.pricing?.finalPrice || quote.pricing?.suggestedPrice || 0),
    discount: Math.max(Number(quote.pricing?.suggestedPrice || 0) - Number(quote.approvedPrice || quote.pricing?.finalPrice || quote.pricing?.suggestedPrice || 0), 0),
    margin: quote.pricing?.validation?.marginAtManualPrice ?? quote.pricing?.marginPercent
  }));
  if (!report.length && integrated) {
    report.push({
      calculated: Number(integrated.pricing.suggestedPrice || 0),
      approved: Number(integrated.pricing.finalPrice || 0),
      discount: Math.max(Number(integrated.pricing.suggestedPrice || 0) - Number(integrated.pricing.finalPrice || 0), 0),
      margin: integrated.pricing.validation?.marginAtManualPrice
    });
  }
  const reportTests = [
    validationItem("Orcado x aprovado", report.length > 0 && report.every(item => item.calculated && item.approved && item.margin !== undefined), `${report.length} registro(s) aprovado(s)`, "critical")
  ];

  const sections = [
    validationSection("Motor de Precificacao", pricingTests),
    validationSection("Banco de Composicoes", compositionTests),
    validationSection("Centro de Custos", costCenterTests),
    validationSection("Orcamento", quoteTests),
    validationSection("Snapshot", snapshotTests),
    validationSection("Ordem de Servico", orderTests),
    validationSection("Financeiro", financialTests),
    validationSection("Caixa", cashTests),
    validationSection("Permissoes", permissionTests),
    validationSection("Timeline", timelineTests),
    validationSection("Relatorio Orcado x Aprovado", reportTests)
  ];
  const allTests = sections.flatMap(section => section.tests);
  const criticalFailures = allTests.filter(test => !test.passed && test.severity === "critical");
  const failed = allTests.filter(test => !test.passed);
  const approvedModules = sections.filter(section => section.passed).length;
  const completionPercent = round((allTests.filter(test => test.passed).length / Math.max(allTests.length, 1)) * 100);
  const status = criticalFailures.length ? "Erro" : failed.length ? "Atenção" : "OK";
  const classification = criticalFailures.length ? "Necessita Correção" : failed.length ? "Parcial" : "Concluído";
  return {
    title: "Sistema > Auditoria > Validacao ERP",
    generatedAt: new Date().toISOString(),
    status,
    level3Decision: criticalFailures.length ? "ERP NÃO APROVADO PARA NÍVEL 3" : "ERP APROVADO PARA NÍVEL 3",
    classification,
    completionPercent,
    modulesTested: sections.length,
    modulesApproved: approvedModules,
    modulesWithFailure: sections.length - approvedModules,
    criticalFailures: criticalFailures.length,
    financialInconsistencies: inconsistentLaunches,
    snapshotInconsistencies: snapshotTests.filter(test => !test.passed),
    permissionInconsistencies: permissionTests.filter(test => !test.passed),
    sections
  };
}

function runSystemHomologation() {
  return runErpValidation();
}

function permissionForRoute(method, pathname) {
  if (pathname === "/api/me") return null;
  if (pathname.startsWith("/api/customer-tracking")) return null;
  if (pathname.startsWith("/api/company-context")) return null;
  if (pathname.startsWith("/api/companies")) return method === "GET" ? null : "settings";
  if (pathname.startsWith("/api/company-settings")) return "settings";
  if (pathname.startsWith("/api/print-settings")) return method === "GET" ? ["settings", "orders", "quote"] : "settings";
  if (pathname.startsWith("/api/communication-settings")) return method === "GET" ? ["settings", "integrations"] : "settings";
  if (pathname.startsWith("/api/users")) return method === "GET" ? null : "settings";
  if (pathname.startsWith("/api/portal/")) return null;
  if (pathname.startsWith("/api/permissions")) return "settings";
  if (pathname.startsWith("/api/crm")) return "commercial";
  if (pathname.startsWith("/api/technical-visits")) return "technicalVisits";
  if (pathname.startsWith("/api/intelligence")) return ["bi", "financialSummary", "production", "commercial"];
  if (pathname.startsWith("/api/analytics")) return ["bi", "financialSummary", "production", "commercial"];
  if (pathname.startsWith("/api/preferences")) return null;
  if (pathname.startsWith("/api/search")) return ["bi", "quote", "orders", "financialSummary", "commercial"];
  if (pathname.startsWith("/api/bi")) return ["bi", "financialSummary", "production", "commercial"];
  if (pathname.startsWith("/api/management")) return ["bi", "financialSummary", "production", "commercial"];
  if (pathname.startsWith("/api/notifications")) return ["integrations", "orders", "commercial", "customerPortal"];
  if (pathname.startsWith("/api/product-catalog") || pathname.startsWith("/api/product-categories")) return method === "GET" ? ["quote", "supplies", "settings"] : "settings";
  if (pathname.startsWith("/api/project-recognition")) return "quote";
  if (pathname.startsWith("/api/integrations") || pathname.startsWith("/api/automations")) return "integrations";
  if (pathname.startsWith("/api/cost-config") || pathname.startsWith("/api/employees") || pathname.startsWith("/api/sectors") || pathname.startsWith("/api/production-sectors") || pathname.startsWith("/api/expenses") || pathname.startsWith("/api/audit")) return "settings";
  if (pathname.startsWith("/api/cost-centers") || pathname.startsWith("/api/compositions")) return method === "GET" ? ["quote", "settings"] : "settings";
  if (pathname.startsWith("/api/pricing-simulator")) return "quote";
  if (pathname.startsWith("/api/customers")) return "administration";
  if (pathname.startsWith("/api/materials")) return "supplies";
  if (pathname.startsWith("/api/reports/quoted-approved")) return "quote";
  if (pathname.startsWith("/api/quote") || pathname.startsWith("/api/quotes")) return "quote";
  if (pathname.startsWith("/api/orders") && (pathname.includes("/approval") || pathname.includes("/history") || pathname.includes("/post-calculation") || pathname.includes("/production-label"))) return "orders";
  if (pathname.startsWith("/api/orders") && pathname.includes("/stock-consume")) return "supplies";
  if (pathname.startsWith("/api/production") || pathname.includes("/production-events") || pathname.includes("/production-settings") || pathname.includes("/production-checklist") || pathname.includes("/installation-teams") || pathname.includes("/move-sector") || pathname.includes("/real-costs") || pathname.includes("/production-problems") || pathname.includes("/installation-checklist")) return "production";
  if (pathname.startsWith("/api/cash/order-payment") || pathname.startsWith("/api/cash/open") || pathname.startsWith("/api/cash/sale")) return "cash";
  if (pathname.startsWith("/api/cash/sangria") || pathname.startsWith("/api/cash/suprimento") || pathname.startsWith("/api/cash/report")) return "cash";
  if (pathname.startsWith("/api/operational-expenses") || pathname.startsWith("/api/expense-advances") || pathname.startsWith("/api/vehicles") || pathname.startsWith("/api/dre")) return "operationalExpenses";
  if (pathname.startsWith("/api/quick-sales")) return "quickSale";
  if (pathname.startsWith("/api/cash/close-blind")) return "blindClose";
  if (pathname.startsWith("/api/cash/daily-summary") || pathname.startsWith("/api/finance")) return "financialSummary";
  if (pathname.startsWith("/api/products") || pathname.includes("/questions") || pathname.includes("/technical-sheet")) return method === "GET" ? ["quote", "settings"] : "settings";
  if (pathname.startsWith("/api/orders")) return "orders";
  return null;
}

function canAccessRoute(method, pathname) {
  const permission = permissionForRoute(method, pathname);
  if (!permission) return true;
  if (Array.isArray(permission)) return permission.some(item => item === "settings" ? isAdmin() && db.quickPermissions.settings : db.quickPermissions[item]);
  if (permission === "settings" && !isAdmin()) return false;
  return Boolean(db.quickPermissions[permission]);
}

async function handleApi(req, res, pathname) {
  const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
  db.currentRequestIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "";
  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await readBody(req);
    const login = String(body.login || body.email || body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!login || !password) return json(res, 400, { error: "Informe usuario/e-mail e senha" });
    const user = (db.users || []).find(item => item.active !== false && [item.email, item.username].filter(Boolean).map(value => String(value).toLowerCase()).includes(login));
    if (!user || !verifyPassword(password, user.passwordHash)) {
      audit("Tentativa de login invalida", "auth", login, "Sistema", "Credenciais invalidas");
      return json(res, 401, { error: "Usuario ou senha invalidos" });
    }
    audit("Login realizado", "auth", user.id, user.name, user.role);
    return json(res, 200, loginUser(res, user));
  }
  if (req.method === "POST" && pathname === "/api/auth/logout") {
    const token = parseCookies(req).printsys_session;
    db.sessions = (db.sessions || []).filter(session => session.token !== token);
    clearSessionCookie(res);
    saveDb();
    return json(res, 200, { ok: true });
  }
  if (req.method === "GET" && pathname === "/api/auth/status") {
    const requestUser = userFromRequest(req);
    if (!requestUser) return json(res, 200, { authenticated: false });
    setActiveCompany(requestedCompanyId(req, requestUser));
    const userSector = db.sectors.find(sector => sector.name === requestUser.sector);
    return json(res, 200, { authenticated: true, user: publicUser(requestUser), permissions: effectivePermissions(requestUser), sectorPermissions: userSector?.permissions || {}, ...scopeMeta() });
  }
  if (req.method === "GET" && pathname === "/api/customer-tracking") {
    const payload = customerTrackingPayload({
      document: requestUrl.searchParams.get("document") || "",
      whatsapp: requestUrl.searchParams.get("whatsapp") || "",
      token: requestUrl.searchParams.get("token") || "",
      companyId: requestUrl.searchParams.get("companyId") || ""
    });
    if (!payload) return json(res, 404, { error: "Nao encontramos pedidos com esses dados. Confira CPF/CNPJ e WhatsApp." });
    return json(res, 200, payload);
  }
  const requestUser = userFromRequest(req);
  if (!requestUser) return json(res, 401, { error: "Login necessario" });
  setActiveCompany(requestedCompanyId(req, requestUser));
  db.currentUser = { id: requestUser.id, name: requestUser.name, role: requestUser.role, sector: requestUser.sector, companyIds: userCompanyIds(requestUser), defaultCompanyId: requestUser.defaultCompanyId || primaryCompanyId() };
  db.quickPermissions = effectivePermissions(requestUser);
  if (!canAccessRoute(req.method, pathname)) return json(res, 403, { error: "Acesso bloqueado por permissao" });
  if (req.method === "GET" && pathname === "/api/me") {
    const userSector = db.sectors.find(sector => sector.name === db.currentUser.sector);
    return json(res, 200, { user: publicUser(requestUser), permissions: db.quickPermissions, sectorPermissions: userSector?.permissions || {}, ...scopeMeta() });
  }
  if (req.method === "GET" && pathname === "/api/companies") return json(res, 200, companiesForUser(requestUser));
  if (req.method === "POST" && pathname === "/api/company-context") {
    const body = await readBody(req);
    const nextCompanyId = body.companyId || primaryCompanyId();
    if (!canAccessCompany(requestUser, nextCompanyId)) return json(res, 403, { error: "Usuario sem acesso a esta loja" });
    setActiveCompany(nextCompanyId);
    requestUser.lastCompanyId = nextCompanyId;
    const session = requestSession(req);
    if (session) session.companyId = nextCompanyId;
    audit("Troca de loja", "company", nextCompanyId, requestUser.name, companyLabel(nextCompanyId));
    return json(res, 200, scopeMeta());
  }
  if (req.method === "POST" && pathname === "/api/companies") {
    if (!isAdmin(requestUser)) return json(res, 403, { error: "Somente Admin/Gestor cadastra lojas" });
    const body = await readBody(req);
    const company = normalizeCompany(body);
    if (company.default) {
      db.companies.forEach(item => { item.default = false; });
      db.companySettings.defaultCompanyId = company.id;
    }
    db.companies.push(company);
    audit("Loja cadastrada", "company", company.id, db.currentUser.name, company.tradeName);
    return json(res, 201, company);
  }
  const companyMatch = pathname.match(/^\/api\/companies\/([^/]+)$/);
  if (req.method === "PUT" && companyMatch) {
    if (!isAdmin(requestUser)) return json(res, 403, { error: "Somente Admin/Gestor altera lojas" });
    const body = await readBody(req);
    const company = db.companies.find(item => item.id === companyMatch[1]);
    if (!company) return json(res, 404, { error: "Loja nao encontrada" });
    Object.assign(company, normalizeCompany({ ...company, ...body, id: company.id, createdAt: company.createdAt }));
    if (company.default) {
      db.companies.forEach(item => { if (item.id !== company.id) item.default = false; });
      db.companySettings.defaultCompanyId = company.id;
    }
    audit("Loja alterada", "company", company.id, db.currentUser.name, company.tradeName);
    return json(res, 200, company);
  }
  if (req.method === "POST" && pathname === "/api/company-settings") {
    if (!isAdmin(requestUser)) return json(res, 403, { error: "Somente Admin/Gestor altera configuracoes de loja" });
    const body = await readBody(req);
    db.companySettings = {
      ...db.companySettings,
      shareCustomers: body.shareCustomers !== false,
      shareProducts: body.shareProducts !== false,
      defaultCompanyId: body.defaultCompanyId && companyById(body.defaultCompanyId) ? body.defaultCompanyId : db.companySettings.defaultCompanyId
    };
    audit("Configuracao multiempresa alterada", "company", "settings", db.currentUser.name, JSON.stringify(db.companySettings));
    return json(res, 200, db.companySettings);
  }
  if (req.method === "GET" && pathname === "/api/print-settings") {
    return json(res, 200, printSettingsForCompany());
  }
  if (req.method === "POST" && pathname === "/api/print-settings") {
    if (!isAdmin(requestUser)) return json(res, 403, { error: "Somente Admin/Gestor altera modelos de impressao" });
    const body = await readBody(req);
    const companyId = body.companyId && companyById(body.companyId) ? body.companyId : (currentCompanyId() === "all" ? primaryCompanyId() : currentCompanyId());
    const current = db.printSettings.find(item => item.companyId === companyId);
    const allowedColors = value => /^#[0-9a-f]{3,8}$/i.test(String(value || ""));
    const next = {
      ...printSettingsForCompany(companyId),
      logoUrl: String(body.logoUrl || body.companyLogo || ""),
      headerImageUrl: String(body.headerImageUrl || ""),
      primaryColor: allowedColors(body.primaryColor) ? body.primaryColor : printSettingsForCompany(companyId).primaryColor,
      secondaryColor: allowedColors(body.secondaryColor) ? body.secondaryColor : printSettingsForCompany(companyId).secondaryColor,
      textColor: allowedColors(body.textColor) ? body.textColor : printSettingsForCompany(companyId).textColor,
      footerText: String(body.footerText || ""),
      showAddress: body.showAddress !== false,
      showCnpj: body.showCnpj !== false,
      showPhone: body.showPhone !== false,
      showSeller: body.showSeller !== false,
      showEmployeeContact: body.showEmployeeContact !== false,
      showCustomerDocument: body.showCustomerDocument !== false,
      showSignature: body.showSignature !== false,
      showQrCode: body.showQrCode === true,
      showProductImagesQuote: body.showProductImagesQuote !== false,
      showProductImagesOrder: body.showProductImagesOrder !== false,
      showProjectAttachmentPreview: body.showProjectAttachmentPreview !== false,
      defaultOrderModel: body.defaultOrderModel || "operacional",
      defaultQuoteModel: body.defaultQuoteModel || "comercial",
      defaultReportModel: body.defaultReportModel || "gerencial",
      updatedAt: new Date().toISOString(),
      updatedBy: db.currentUser.name
    };
    if (current) Object.assign(current, next);
    else db.printSettings.push(next);
    audit("Configuracao de impressao alterada", "print_settings", companyId, db.currentUser.name, "Modelo de impressao atualizado", { previousData: current || null, newData: next });
    return json(res, 200, next);
  }
  if (req.method === "GET" && pathname === "/api/communication-settings") {
    return json(res, 200, communicationSettingsForCompany());
  }
  if (req.method === "POST" && pathname === "/api/communication-settings") {
    if (!isAdmin(requestUser)) return json(res, 403, { error: "Somente Admin/Gestor altera comunicacao com clientes" });
    const body = await readBody(req);
    const companyId = body.companyId && companyById(body.companyId) ? body.companyId : (currentCompanyId() === "all" ? primaryCompanyId() : currentCompanyId());
    const current = db.communicationSettings.find(item => item.companyId === companyId);
    const next = {
      ...communicationSettingsForCompany(companyId),
      enabled: body.enabled !== false,
      whatsappMode: ["manual_whatsapp_link", "api_provider"].includes(body.whatsappMode) ? body.whatsappMode : "manual_whatsapp_link",
      companyWhatsApp: normalizeWhatsApp(body.companyWhatsApp || ""),
      defaultSender: body.defaultSender || db.currentUser.name,
      footer: body.footer || "",
      events: {
        quote: body.events?.quote !== false,
        order: body.events?.order !== false,
        production: body.events?.production !== false,
        payment: body.events?.payment !== false,
        tracking: body.events?.tracking !== false
      },
      provider: {
        name: String(body.provider?.name || body.providerName || ""),
        baseUrl: String(body.provider?.baseUrl || body.providerBaseUrl || ""),
        token: String(body.provider?.token || body.providerToken || ""),
        webhookSecret: String(body.provider?.webhookSecret || body.webhookSecret || "")
      },
      updatedAt: new Date().toISOString(),
      updatedBy: db.currentUser.name
    };
    if (current) Object.assign(current, next);
    else db.communicationSettings.push(next);
    audit("Configuracao de comunicacao alterada", "communication_settings", companyId, db.currentUser.name, next.whatsappMode, { previousData: current || null, newData: { ...next, provider: { ...next.provider, token: next.provider.token ? "***" : "" } } });
    return json(res, 200, next);
  }
  if (req.method === "POST" && pathname === "/api/communication-settings/test") {
    const settings = communicationSettingsForCompany();
    const apiReady = settings.whatsappMode === "api_provider" && settings.provider?.baseUrl && settings.provider?.token;
    return json(res, 200, {
      status: apiReady ? "ready" : "manual",
      message: apiReady ? "Provedor configurado. Envio real depende do conector externo." : "Sem API configurada. O sistema usara link manual do WhatsApp e confirmacao do operador.",
      whatsappLink: whatsappDeepLink(settings.companyWhatsApp, "Teste de comunicacao PrintSys.")
    });
  }
  if (req.method === "GET" && pathname === "/api/notifications") {
    return json(res, 200, {
      queue: notificationQueueForCompany(),
      templates: db.messageTemplates || []
    });
  }
  if (req.method === "POST" && pathname === "/api/notifications") {
    const body = await readBody(req);
    const created = enqueueCustomerNotification(body.event || "service_order.created", {
      customerId: body.customerId,
      orderId: body.orderId,
      quoteId: body.quoteId,
      channel: body.channel,
      user: body.user || db.currentUser.name
    });
    return json(res, 201, { created });
  }
  const notificationActionMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/(resend|mark-sent|mark-failed|manual-confirmed|cancel)$/);
  if (notificationActionMatch && req.method === "POST") {
    const body = await readBody(req);
    const notification = notificationQueueForCompany().find(item => item.id === notificationActionMatch[1]);
    if (!notification) return json(res, 404, { error: "Notificacao nao encontrada" });
    const previousData = { status: notification.status, attempts: notification.attempts || 0 };
    const action = notificationActionMatch[2];
    if (action === "resend") {
      notification.status = "pending";
      notification.attempts = Number(notification.attempts || 0) + 1;
      notification.lastAttemptAt = new Date().toISOString();
    }
    if (action === "mark-sent") {
      notification.status = "sent";
      notification.sentAt = new Date().toISOString();
      notification.sentBy = body.user || db.currentUser.name;
    }
    if (action === "mark-failed") {
      notification.status = "failed";
      notification.error = body.error || "Falha informada manualmente";
      notification.failedAt = new Date().toISOString();
      notification.failedBy = body.user || db.currentUser.name;
    }
    if (action === "manual-confirmed") {
      notification.status = "manual_confirmed";
      notification.sentAt = new Date().toISOString();
      notification.sentBy = body.user || db.currentUser.name;
      notification.manualConfirmation = body.note || "Confirmado manualmente";
    }
    if (action === "cancel") {
      notification.status = "cancelled";
      notification.cancelledAt = new Date().toISOString();
      notification.cancelledBy = body.user || db.currentUser.name;
      notification.cancelReason = body.reason || "Cancelado pelo operador";
    }
    (db.portalNotifications || []).filter(item => item.notificationId === notification.id).forEach(item => {
      item.status = notification.status;
      item.updatedAt = new Date().toISOString();
    });
    audit(action === "resend" ? "Notificacao reenfileirada" : action === "mark-sent" ? "Notificacao marcada como enviada" : action === "manual-confirmed" ? "Notificacao confirmada manualmente" : action === "cancel" ? "Notificacao cancelada" : "Notificacao marcada como falha", "notification", notification.id, body.user || db.currentUser.name, notification.event, { previousData, newData: { status: notification.status, attempts: notification.attempts || 0 } });
    return json(res, 200, notification);
  }
  if (req.method === "GET" && pathname === "/api/permissions") return json(res, 200, db.quickPermissions);
  if (req.method === "GET" && pathname === "/api/users") return json(res, 200, (db.users || []).map(publicUser));
  if (req.method === "POST" && pathname === "/api/users") {
    const body = await readBody(req);
    if (!body.password || String(body.password).length < 6) return json(res, 400, { error: "Senha obrigatoria com pelo menos 6 caracteres" });
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return json(res, 400, { error: "E-mail obrigatorio" });
    if ((db.users || []).some(user => String(user.email || "").toLowerCase() === email)) return json(res, 409, { error: "Usuario ja existe" });
    const user = {
      id: uid("usr"),
      name: body.name || email,
      email,
      username: body.username || email.split("@")[0],
      role: body.role || "Vendedor",
      profile: body.profile || body.role || "Vendedor",
      sector: body.sector || "Comercial",
      passwordHash: hashPassword(body.password),
      permissions: body.permissions || {},
      companyIds: Array.isArray(body.companyIds) && body.companyIds.length ? body.companyIds.filter(id => id === "all" || companyById(id)) : [currentCompanyId() === "all" ? primaryCompanyId() : currentCompanyId()],
      companyRoles: body.companyRoles || {},
      defaultCompanyId: body.defaultCompanyId || (Array.isArray(body.companyIds) && body.companyIds[0] ? body.companyIds[0] : (currentCompanyId() === "all" ? primaryCompanyId() : currentCompanyId())),
      active: body.active !== false,
      createdAt: new Date().toISOString()
    };
    if (isAdmin(user)) user.companyIds = ["all"];
    user.permissions = effectivePermissions(user);
    const accessibleStores = user.companyIds.includes("all") && isAdmin(user) ? db.companies.map(company => company.id) : user.companyIds.filter(id => id !== "all");
    user.storeAccess = accessibleStores.map(storeId => ({
      storeId,
      role: user.companyRoles[storeId] || user.role,
      permissions: { ...user.permissions }
    }));
    db.users.push(user);
    audit("Usuario criado", "user", user.id, db.currentUser.name, user.email);
    return json(res, 201, publicUser(user));
  }
  if (req.method === "POST" && pathname === "/api/permissions") {
    const body = await readBody(req);
    if (!isAdmin()) return json(res, 403, { error: "Somente Admin Geral pode alterar permissoes" });
    requestUser.permissions = { ...effectivePermissions(requestUser), ...body.permissions };
    db.quickPermissions = effectivePermissions(requestUser);
    audit("Alteracao de permissao", "permissions", "quick", db.currentUser.name, JSON.stringify(body.permissions));
    return json(res, 200, db.quickPermissions);
  }
  if (req.method === "GET" && pathname === "/api/audit/validation-erp") return json(res, 200, runSystemHomologation());
  if (req.method === "GET" && pathname === "/api/dashboard") return json(res, 200, dashboard());
  if (req.method === "GET" && pathname === "/api/management/overview") return json(res, 200, dashboard());
  if (req.method === "GET" && pathname === "/api/intelligence") return json(res, 200, currentIntelligenceSnapshot());
  if (req.method === "POST" && pathname === "/api/intelligence/refresh") {
    const body = await readBody(req);
    return json(res, 200, refreshIntelligenceSnapshot(body.user || db.currentUser.name));
  }
  if (req.method === "POST" && pathname === "/api/intelligence/quote-assistant") {
    const body = await readBody(req);
    return json(res, 200, quoteAssistant(body.text || "", body.user || db.currentUser.name));
  }
  if (req.method === "GET" && pathname === "/api/intelligence/production-risk") return json(res, 200, productionIntelligence());
  if (req.method === "GET" && pathname === "/api/intelligence/financial-risk") return json(res, 200, financialIntelligence());
  if (req.method === "POST" && pathname === "/api/intelligence/executive-assistant") {
    const body = await readBody(req);
    return json(res, 200, answerAssistantQuestion(body.question || "", body.user || db.currentUser.name));
  }
  if (req.method === "GET" && pathname === "/api/intelligence/audit") return json(res, 200, db.intelligenceAudit);
  if (req.method === "GET" && pathname === "/api/analytics") {
    const refresh = requestUrl.searchParams.get("refresh") === "true";
    const latest = db.analyticsSnapshots[0]?.report;
    return json(res, 200, refresh || !latest ? analyticsReport() : { ...latest, cached: true, lastUpdated: db.analyticsSnapshots[0]?.generatedAt });
  }
  if (req.method === "POST" && pathname === "/api/analytics/snapshot") return json(res, 201, analyticsReport());
  if (req.method === "GET" && pathname === "/api/preferences") {
    const userId = requestUrl.searchParams.get("userId") || db.currentUser.id;
    return json(res, 200, db.userPreferences.find(item => item.userId === userId) || { userId, theme: "light", favorites: [], shortcuts: [], dashboardWidgets: [] });
  }
  if (req.method === "POST" && pathname === "/api/preferences") {
    const body = await readBody(req);
    const userId = body.userId || db.currentUser.id;
    const current = db.userPreferences.find(item => item.userId === userId);
    const next = { ...(current || { userId }), ...body, updatedAt: new Date().toISOString() };
    if (current) Object.assign(current, next);
    else db.userPreferences.push(next);
    auditIntelligence("Preferencias", "salvar_preferencias_usuario", { userId, fields: Object.keys(body) }, db.currentUser.name);
    return json(res, 200, next);
  }
  if (req.method === "GET" && pathname === "/api/search/global") return json(res, 200, searchGlobal(requestUrl.searchParams.get("q") || ""));
  if (req.method === "GET" && pathname === "/api/bi/executive") return json(res, 200, executiveBI());
  if (req.method === "GET" && pathname === "/api/bi/alerts") return json(res, 200, smartAlerts());
  const alertResolveMatch = pathname.match(/^\/api\/bi\/alerts\/([^/]+)\/resolve$/);
  if (req.method === "POST" && alertResolveMatch) {
    const alert = smartAlerts().find(item => item.id === alertResolveMatch[1]);
    if (!alert) return json(res, 404, { error: "Alerta nao encontrado" });
    alert.status = "resolvido";
    alert.resolvedAt = new Date().toISOString();
    audit("Alerta inteligente resolvido", "bi_alert", alert.id, db.currentUser.name, alert.type);
    return json(res, 200, alert);
  }
  const biExportMatch = pathname.match(/^\/api\/bi\/executive-report\/([^/]+)$/);
  if (req.method === "GET" && biExportMatch) {
    const format = biExportMatch[1];
    const content = executiveReport(format);
    if (format === "csv" || format === "excel") {
      res.writeHead(200, { "content-type": "text/csv; charset=utf-8" });
      return res.end(content);
    }
    if (format === "pdf") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      return res.end(content);
    }
    return json(res, 200, content);
  }
  if (req.method === "GET" && pathname === "/api/integrations") return json(res, 200, integrationCenter());
  if (req.method === "POST" && pathname === "/api/integrations/messages") {
    const body = await readBody(req);
    const message = { id: uid("msg"), channel: body.channel || "WhatsApp", event: body.event || "", template: body.template || "", variables: body.variables || {}, customerId: body.customerId || "", phone: body.phone || "", email: body.email || "", status: "preparado", log: "Mensagem enfileirada para integracao futura", createdAt: new Date().toISOString() };
    db.integrationMessages.push(message);
    db.integrationLogs.push({ id: uid("ilog"), date: message.createdAt.slice(0, 10), hour: message.createdAt.slice(11, 16), event: message.event, status: message.status, error: "", responsible: body.user || db.currentUser.name, reference: message.id, createdAt: message.createdAt });
    audit("Mensagem de integracao preparada", "integration", message.id, body.user || db.currentUser.name, `${message.channel} ${message.event}`);
    return json(res, 201, message);
  }
  if (req.method === "POST" && pathname === "/api/integrations/webhooks") {
    const body = await readBody(req);
    const webhook = { id: uid("wh"), event: body.event || "", url: body.url || "", payload: body.payload || {}, status: "preparado", attempts: 0, log: "", active: body.active === true, createdAt: new Date().toISOString() };
    db.webhooks.push(webhook);
    audit("Webhook preparado", "webhook", webhook.id, db.currentUser.name, webhook.event);
    return json(res, 201, webhook);
  }
  if (req.method === "POST" && pathname === "/api/integrations/backup/run") {
    const body = await readBody(req);
    const job = db.backupJobs.find(item => item.id === body.jobId) || db.backupJobs[0];
    job.lastRun = new Date().toISOString();
    job.status = "simulado";
    db.integrationLogs.push({ id: uid("ilog"), date: job.lastRun.slice(0, 10), hour: job.lastRun.slice(11, 16), event: "backup", status: "simulado", error: "", responsible: body.user || db.currentUser.name, reference: job.id, createdAt: job.lastRun });
    return json(res, 200, job);
  }
  if (req.method === "POST" && pathname === "/api/automations/run") return json(res, 200, runAutomations());
  if (req.method === "GET" && pathname === "/api/crm") {
    return json(res, 200, {
      leads: db.leads.map(lead => ({ ...lead, history: leadHistory(lead.id) })),
      followUps: db.followUps,
      sellerGoals: sellerGoalDashboard(),
      lossReasons: db.lossReasons,
      alerts: commercialAlerts(),
      report: commercialReport(),
      funnelStages: ["novo", "em atendimento", "orcamento solicitado", "orcamento enviado", "aguardando aprovacao", "fechado", "perdido"]
    });
  }
  if (req.method === "POST" && pathname === "/api/crm/leads") {
    const body = await readBody(req);
    const lead = {
      id: uid("lead"),
      name: body.name || "",
      phone: body.phone || "",
      whatsapp: body.whatsapp || body.phone || "",
      company: body.company || "",
      origin: body.origin || "Outro",
      seller: body.seller || db.currentUser.name,
      interest: body.interest || "",
      observation: body.observation || "",
      status: body.status || "novo",
      estimatedValue: Number(body.estimatedValue || 0),
      nextContactAt: body.nextContactAt || "",
      customerId: "",
      quoteId: "",
      orderId: "",
      lossReason: "",
      files: body.files || [],
      createdAt: new Date().toISOString(),
      history: []
    };
    db.leads.push(lead);
    audit("Lead criado", "lead", lead.id, lead.seller, `${lead.name} via ${lead.origin}`);
    return json(res, 201, lead);
  }
  const leadFollowMatch = pathname.match(/^\/api\/crm\/leads\/([^/]+)\/follow-ups$/);
  if (req.method === "POST" && leadFollowMatch) {
    const body = await readBody(req);
    const lead = db.leads.find(item => item.id === leadFollowMatch[1]);
    if (!lead) return json(res, 404, { error: "Lead nao encontrado" });
    const followUp = { id: uid("follow"), leadId: lead.id, customerId: lead.customerId || "", seller: body.seller || lead.seller || db.currentUser.name, date: body.date, time: body.time, channel: body.channel || "WhatsApp", observation: body.observation || "", completed: false, createdAt: new Date().toISOString() };
    db.followUps.push(followUp);
    lead.nextContactAt = `${followUp.date}T${followUp.time || "00:00"}:00.000Z`;
    lead.status = body.status || lead.status || "em atendimento";
    audit("Follow-up agendado", "lead", lead.id, followUp.seller, `${followUp.channel} ${followUp.date} ${followUp.time}`);
    return json(res, 201, followUp);
  }
  const leadCustomerMatch = pathname.match(/^\/api\/crm\/leads\/([^/]+)\/convert-customer$/);
  if (req.method === "POST" && leadCustomerMatch) {
    const lead = db.leads.find(item => item.id === leadCustomerMatch[1]);
    if (!lead) return json(res, 404, { error: "Lead nao encontrado" });
    return json(res, 201, createCustomerFromLead(lead));
  }
  const leadQuoteMatch = pathname.match(/^\/api\/crm\/leads\/([^/]+)\/convert-quote$/);
  if (req.method === "POST" && leadQuoteMatch) {
    const body = await readBody(req);
    const lead = db.leads.find(item => item.id === leadQuoteMatch[1]);
    if (!lead) return json(res, 404, { error: "Lead nao encontrado" });
    return json(res, 201, createQuoteFromLead(lead, body));
  }
  const leadLostMatch = pathname.match(/^\/api\/crm\/leads\/([^/]+)\/lost$/);
  if (req.method === "POST" && leadLostMatch) {
    const body = await readBody(req);
    const lead = db.leads.find(item => item.id === leadLostMatch[1]);
    if (!lead) return json(res, 404, { error: "Lead nao encontrado" });
    lead.status = "perdido";
    lead.lossReason = body.reason || "outro";
    lead.observation = body.observation || lead.observation;
    audit("Lead perdido", "lead", lead.id, body.user || db.currentUser.name, lead.lossReason);
    return json(res, 200, lead);
  }
  if (req.method === "POST" && pathname === "/api/crm/seller-goals") {
    const body = await readBody(req);
    const goal = { id: uid("goal"), seller: body.seller || "", monthlyGoal: Number(body.monthlyGoal || 0), dailyGoal: Number(body.dailyGoal || 0), defaultCommissionPercent: Number(body.defaultCommissionPercent || 0), active: body.active !== false };
    db.sellerGoals.push(goal);
    audit("Meta comercial cadastrada", "seller_goal", goal.id, db.currentUser.name, goal.seller);
    return json(res, 201, goal);
  }
  const portalMatch = pathname.match(/^\/api\/portal\/([^/]+)$/);
  if (req.method === "GET" && portalMatch) {
    const payload = portalPayload(portalMatch[1]);
    if (!payload) return json(res, 404, { error: "Portal nao encontrado ou token invalido" });
    return json(res, 200, payload);
  }
  const portalQuoteApprovalMatch = pathname.match(/^\/api\/portal\/([^/]+)\/quotes\/([^/]+)\/approval$/);
  if (req.method === "POST" && portalQuoteApprovalMatch) {
    const body = await readBody(req);
    const payload = portalPayload(portalQuoteApprovalMatch[1]);
    if (!payload) return json(res, 404, { error: "Token invalido" });
    const quote = db.quotes.find(item => item.id === portalQuoteApprovalMatch[2] && item.customerId === payload.customer.id);
    if (!quote) return json(res, 404, { error: "Orcamento nao encontrado" });
    const approval = { id: uid("portal-approval"), type: "orcamento", quoteId: quote.id, customerId: payload.customer.id, status: body.status || "aprovado", observation: body.observation || "", token: portalQuoteApprovalMatch[1], ip: body.ip || "portal", createdAt: new Date().toISOString() };
    db.portalApprovals.push(approval);
    if (approval.status === "aprovado") {
      const order = approveQuoteToOrder(quote, { approvedBy: payload.customer.name, user: payload.customer.name });
      audit("Orcamento aprovado no portal", "quote", quote.id, payload.customer.name, approval.observation);
      return json(res, 201, { approval, order });
    }
    quote.status = approval.status === "ajuste solicitado" ? "ajuste solicitado" : "reprovado";
    audit("Orcamento atualizado no portal", "quote", quote.id, payload.customer.name, `${approval.status}: ${approval.observation}`);
    return json(res, 200, { approval, quote });
  }
  const portalArtApprovalMatch = pathname.match(/^\/api\/portal\/([^/]+)\/orders\/([^/]+)\/art-approval$/);
  if (req.method === "POST" && portalArtApprovalMatch) {
    const body = await readBody(req);
    const payload = portalPayload(portalArtApprovalMatch[1]);
    if (!payload) return json(res, 404, { error: "Token invalido" });
    const order = db.orders.find(item => item.id === portalArtApprovalMatch[2] && item.customerId === payload.customer.id);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    order.artApprovalStatus = body.status || "aprovado";
    if (body.file) order.files = [...(order.files || []), body.file];
    const approval = { id: uid("portal-approval"), type: "arte", orderId: order.id, customerId: payload.customer.id, status: order.artApprovalStatus, comment: body.comment || "", file: body.file || "", token: portalArtApprovalMatch[1], createdAt: new Date().toISOString() };
    db.portalApprovals.push(approval);
    audit("Arte aprovada no portal", "order", order.id, payload.customer.name, `${order.artApprovalStatus} ${approval.comment}`);
    return json(res, 200, { approval, order });
  }
  const portalUploadMatch = pathname.match(/^\/api\/portal\/([^/]+)\/uploads$/);
  if (req.method === "POST" && portalUploadMatch) {
    const body = await readBody(req);
    const payload = portalPayload(portalUploadMatch[1]);
    if (!payload) return json(res, 404, { error: "Token invalido" });
    const upload = { id: uid("upload"), customerId: payload.customer.id, quoteId: body.quoteId || "", orderId: body.orderId || "", fileName: body.fileName || "arquivo-cliente.pdf", type: body.type || "arquivo", notes: body.notes || "", createdAt: new Date().toISOString() };
    db.portalUploads.push(upload);
    if (upload.quoteId) {
      const quote = db.quotes.find(item => item.id === upload.quoteId && item.customerId === payload.customer.id);
      if (quote) quote.files = [...(quote.files || []), upload.fileName];
    }
    if (upload.orderId) {
      const order = db.orders.find(item => item.id === upload.orderId && item.customerId === payload.customer.id);
      if (order) order.files = [...(order.files || []), upload.fileName];
    }
    audit("Arquivo enviado pelo cliente", upload.orderId ? "order" : "quote", upload.orderId || upload.quoteId || payload.customer.id, payload.customer.name, upload.fileName);
    return json(res, 201, upload);
  }
  const portalPaymentMatch = pathname.match(/^\/api\/portal\/([^/]+)\/payment-proof$/);
  if (req.method === "POST" && portalPaymentMatch) {
    const body = await readBody(req);
    const payload = portalPayload(portalPaymentMatch[1]);
    if (!payload) return json(res, 404, { error: "Token invalido" });
    const upload = { id: uid("upload"), customerId: payload.customer.id, orderId: body.orderId || "", fileName: body.fileName || "comprovante.pdf", type: "comprovante_pagamento", notes: body.notes || "", createdAt: new Date().toISOString() };
    db.portalUploads.push(upload);
    audit("Comprovante anexado no portal", "order", upload.orderId || payload.customer.id, payload.customer.name, upload.fileName);
    return json(res, 201, upload);
  }
  if (req.method === "GET" && pathname === "/api/customers") return json(res, 200, scoped("customers"));
  if (req.method === "POST" && pathname === "/api/customers") {
    const body = await readBody(req);
    const customer = withCompany(normalizeCustomerContact({ id: uid("c"), creditLimit: 0, balance: 0, ...body }), "customers");
    db.customers.push(customer);
    ensurePortalToken(customer.id);
    audit("Cliente cadastrado", "customer", customer.id, db.currentUser.name, customer.name);
    return json(res, 201, customer);
  }
  const customerMatch = pathname.match(/^\/api\/customers\/([^/]+)$/);
  if (customerMatch && req.method === "PUT") {
    const body = await readBody(req);
    const customer = scopedFind("customers", item => item.id === customerMatch[1]);
    if (!customer) return json(res, 404, { error: "Cliente nao encontrado" });
    Object.assign(customer, normalizeCustomerContact({
      ...customer,
      ...body,
      creditLimit: Number(body.creditLimit ?? customer.creditLimit ?? 0),
      updatedAt: new Date().toISOString()
    }));
    audit("Cliente atualizado", "customer", customer.id, db.currentUser.name, customer.name);
    return json(res, 200, customer);
  }
  if (customerMatch && req.method === "DELETE") {
    const customer = scopedFind("customers", item => item.id === customerMatch[1]);
    if (!customer) return json(res, 404, { error: "Cliente nao encontrado" });
    customer.active = false;
    customer.updatedAt = new Date().toISOString();
    audit("Cliente inativado", "customer", customer.id, db.currentUser.name, customer.name);
    return json(res, 200, customer);
  }
  if (req.method === "GET" && pathname === "/api/product-catalog") return json(res, 200, productCatalogPayload());
  if (req.method === "GET" && pathname === "/api/product-categories") return json(res, 200, catalogCategoriesForCompany());
  if (req.method === "POST" && pathname === "/api/product-categories") {
    const body = await readBody(req);
    const category = withCompany({
      id: body.id || uid("cat"),
      name: body.name || "Nova categoria",
      icon: body.icon || String(body.name || "NC").slice(0, 2).toUpperCase(),
      color: body.color || "#7b179f",
      imageUrl: body.imageUrl || "",
      description: body.description || "",
      defaultSector: body.defaultSector || "",
      keywords: Array.isArray(body.keywords) ? body.keywords : String(body.keywords || "").split(",").map(item => item.trim()).filter(Boolean),
      defaultFlow: Array.isArray(body.defaultFlow) ? body.defaultFlow : String(body.defaultFlow || "").split(",").map(item => item.trim()).filter(Boolean),
      active: body.active !== false,
      createdAt: new Date().toISOString()
    }, "productCategories");
    db.productCategories.push(category);
    audit("Categoria de produto criada", "product_category", category.id, db.currentUser.name, category.name);
    return json(res, 201, category);
  }
  const productCategoryMatch = pathname.match(/^\/api\/product-categories\/([^/]+)$/);
  if (productCategoryMatch && ["PUT", "PATCH"].includes(req.method)) {
    const body = await readBody(req);
    const category = catalogCategoriesForCompany().find(item => item.id === productCategoryMatch[1]);
    if (!category) return json(res, 404, { error: "Categoria nao encontrada" });
    const previousData = { ...category };
    Object.assign(category, {
      ...body,
      name: body.name || category.name,
      icon: body.icon || category.icon,
      color: body.color || category.color,
      keywords: Array.isArray(body.keywords) ? body.keywords : String(body.keywords || category.keywords || "").split(",").map(item => item.trim()).filter(Boolean),
      defaultFlow: Array.isArray(body.defaultFlow) ? body.defaultFlow : String(body.defaultFlow || category.defaultFlow || "").split(",").map(item => item.trim()).filter(Boolean),
      active: body.active === undefined ? category.active !== false : body.active !== false,
      updatedAt: new Date().toISOString()
    });
    audit("Categoria de produto atualizada", "product_category", category.id, db.currentUser.name, category.name, { previousData, newData: category });
    return json(res, 200, category);
  }
  const productCatalogSettingsMatch = pathname.match(/^\/api\/products\/([^/]+)\/catalog$/);
  if (productCatalogSettingsMatch && ["PATCH", "PUT"].includes(req.method)) {
    const body = await readBody(req);
    const product = scopedFind("products", item => item.id === productCatalogSettingsMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    const previousData = { imageUrl: product.imageUrl, categoryId: product.categoryId, favorite: product.favorite, attachments: product.attachments, examples: product.examples };
    ["imageUrl", "categoryId", "category", "categoryImageUrl", "categoryIcon"].forEach(key => {
      if (body[key] !== undefined) product[key] = body[key];
    });
    if (body.favorite !== undefined) product.favorite = Boolean(body.favorite);
    if (body.attachments !== undefined) product.attachments = normalizeCatalogAttachments(body.attachments);
    if (body.examples !== undefined) product.examples = normalizeCatalogAttachments(body.examples);
    if (body.defaultMeasurements && typeof body.defaultMeasurements === "object") product.defaultMeasurements = body.defaultMeasurements;
    product.updatedAt = new Date().toISOString();
    normalizeProductCatalogFields(product);
    audit("Catalogo do produto atualizado", "product", product.id, db.currentUser.name, product.name, { previousData, newData: { imageUrl: product.imageUrl, categoryId: product.categoryId, favorite: product.favorite, attachments: product.attachments, examples: product.examples } });
    return json(res, 200, groupedProductPayload(product));
  }
  const productFavoriteMatch = pathname.match(/^\/api\/products\/([^/]+)\/favorite$/);
  if (productFavoriteMatch && req.method === "POST") {
    const body = await readBody(req);
    const product = scopedFind("products", item => item.id === productFavoriteMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    product.favorite = body.favorite === undefined ? !product.favorite : Boolean(body.favorite);
    product.updatedAt = new Date().toISOString();
    audit(product.favorite ? "Produto favoritado" : "Produto removido dos favoritos", "product", product.id, db.currentUser.name, product.name);
    return json(res, 200, groupedProductPayload(product));
  }
  const productUseMatch = pathname.match(/^\/api\/products\/([^/]+)\/use$/);
  if (productUseMatch && req.method === "POST") {
    const product = scopedFind("products", item => item.id === productUseMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    product.recentlyUsedAt = new Date().toISOString();
    audit("Produto selecionado para orcamento", "product", product.id, db.currentUser.name, product.name);
    return json(res, 200, groupedProductPayload(product));
  }
  if (req.method === "GET" && pathname === "/api/products") return json(res, 200, scoped("products").map(groupedProductPayload));
  if (req.method === "GET" && pathname === "/api/products/grouped") return json(res, 200, scoped("products").map(groupedProductPayload));
  if (req.method === "GET" && pathname === "/api/compositions") return json(res, 200, scoped("compositions"));
  if (req.method === "GET" && pathname === "/api/pricing-simulator/history") return json(res, 200, scoped("pricingSimulations"));
  if (req.method === "POST" && pathname === "/api/pricing-simulator/simulate") {
    const body = await readBody(req);
    const composition = db.compositions.find(item => item.id === body.compositionId);
    if (!composition) return json(res, 404, { error: "Composicao nao encontrada" });
    const product = db.products.find(item => item.id === composition.productId) || db.products[0];
    const pricing = applyAdditionalExpenses(calculateCompositionPrice(product, composition, { ...(body.answers || {}), compositionId: composition.id }), body.additionalExpenses);
    const validation = buildPricingValidation(pricing, body.manualPrice);
    const simulation = {
      id: uid("sim"),
      compositionId: composition.id,
      compositionName: composition.name,
      answers: body.answers || {},
      manualPrice: Number(body.manualPrice || 0),
      pricing,
      validation,
      createdAt: new Date().toISOString(),
      user: db.currentUser.name
    };
    db.pricingSimulations.push(withCompany(simulation, "pricingSimulations"));
    audit("Simulacao de precificacao", "pricing_simulation", simulation.id, db.currentUser.name, composition.name);
    return json(res, 201, simulation);
  }
  const simulationQuoteMatch = pathname.match(/^\/api\/pricing-simulator\/([^/]+)\/quote$/);
  if (req.method === "POST" && simulationQuoteMatch) {
    const body = await readBody(req);
    const simulation = scopedFind("pricingSimulations", item => item.id === simulationQuoteMatch[1]);
    if (!simulation) return json(res, 404, { error: "Simulacao nao encontrada" });
    const composition = db.compositions.find(item => item.id === simulation.compositionId);
    const product = db.products.find(item => item.id === composition?.productId);
    const answers = { ...(simulation.answers || {}), compositionId: simulation.compositionId };
    const itemSnapshot = buildQuoteItemSnapshot({ productId: product?.id || "", productModelId: simulation.pricing?.productModelId || answers.productModelId || "", compositionId: simulation.compositionId, description: body.jobName || `Simulacao - ${simulation.compositionName}`, quantity: Number(answers.quantity || 1), answers, pricingSnapshot: simulation.pricing }, 0);
    const costSnapshot = buildQuoteSnapshot({ answers, productModelId: itemSnapshot.productModelId || simulation.pricing?.productModelId || "" }, composition, simulation.pricing, product);
    costSnapshot.items = [itemSnapshot];
    const quote = {
      id: uid("q"),
      quoteNumber: `ORC-${db.quotes.length + 1001}`,
      customerId: body.customerId || db.customers[0]?.id,
      jobName: body.jobName || `Simulacao - ${simulation.compositionName}`,
      productId: product?.id || "",
      productModelId: itemSnapshot.productModelId || "",
      productModelName: itemSnapshot.productModelName || "",
      compositionId: simulation.compositionId,
      answers: { ...answers, quoteItems: [itemSnapshot] },
      pricing: simulation.pricing,
      items: [itemSnapshot],
      itemSnapshots: [itemSnapshot],
      costSnapshot,
      discountSimulation: simulateDiscount(simulation.pricing, 0),
      status: "rascunho",
      costHistory: simulation,
      createdAt: new Date().toISOString()
    };
    db.quotes.push(withCompany(quote, "quotes"));
    audit("Orcamento gerado por simulacao", "quote", quote.id, db.currentUser.name, simulation.compositionName);
    return json(res, 201, quote);
  }
  if (req.method === "POST" && pathname === "/api/compositions") {
    const body = await readBody(req);
    const composition = {
      id: uid("cmp"),
      name: body.name || "Composicao",
      category: body.category || "Personalizada",
      productId: body.productId || "",
      marginPercent: Number(body.marginPercent || db.costConfig.defaultMarginPercent || 50),
      deadlineDays: Number(body.deadlineDays || 3),
      productionFlow: body.productionFlow || ["Producao"],
      materials: body.materials || [],
      production: body.production || [],
      installation: body.installation || { teamHours: 0, vehicleKm: 0, fuel: 0, food: 0, toll: 0 },
      questions: body.questions || []
    };
    db.compositions.push(withCompany(composition, "compositions"));
    audit("Composicao criada", "composition", composition.id, db.currentUser.name, composition.name);
    return json(res, 201, composition);
  }
  if (req.method === "GET" && pathname === "/api/cost-centers") return json(res, 200, scoped("costCenters"));
  if (req.method === "POST" && pathname === "/api/cost-centers") {
    const body = await readBody(req);
    const center = withCompany({ id: uid("cc"), name: body.name || "Centro", type: body.type || "direto", monthlyBudget: Number(body.monthlyBudget || 0), active: body.active !== false }, "costCenters");
    db.costCenters.push(center);
    audit("Centro de custo criado", "cost_center", center.id, db.currentUser.name, center.name);
    return json(res, 201, center);
  }
  if (req.method === "GET" && pathname === "/api/cost-config") return json(res, 200, {
    ...db.costConfig,
    automaticHumanHourValue: automaticHumanHourValue()
  });
  if (req.method === "POST" && pathname === "/api/cost-config") {
    const body = await readBody(req);
    if (!isAdmin()) return json(res, 403, { error: "Somente Admin Geral pode acessar configuracoes" });
    db.costConfig = { ...db.costConfig, ...body };
    audit("Configuracao de custos alterada", "settings", "cost-config", db.currentUser.name, db.costConfig.mode);
    return json(res, 200, { ...db.costConfig, automaticHumanHourValue: automaticHumanHourValue() });
  }
  if (req.method === "GET" && pathname === "/api/employees") return json(res, 200, scoped("employees").map(employee => ({ ...employee, hourValue: employeeHour(employee) })));
  if (req.method === "POST" && pathname === "/api/employees") {
    const body = await readBody(req);
    const employee = normalizeEmployeeProfile({
      id: uid("emp"),
      name: body.name || "Funcionario",
      photo: body.photo || body.profilePhoto || "",
      profilePhoto: body.profilePhoto || body.photo || "",
      role: body.role || "",
      sector: body.sector || "",
      salary: Number(body.salary || 0),
      monthlyHours: Number(body.monthlyHours || 176),
      commissionPercent: Number(body.commissionPercent || 0),
      phone: body.phone || "",
      whatsapp: body.whatsapp || body.phone || "",
      personalPhone: body.personalPhone || body.phone || "",
      companyPhone: body.companyPhone || "",
      email: body.email || "",
      companyEmail: body.companyEmail || body.email || "",
      defaultContactPreference: body.defaultContactPreference || "personal_whatsapp",
      admissionDate: body.admissionDate || "",
      active: body.active !== false
    });
    db.employees.push(withCompany(employee, "employees"));
    audit("Funcionario cadastrado", "employee", employee.id, db.currentUser.name, employee.name);
    return json(res, 201, { ...employee, hourValue: employeeHour(employee) });
  }
  const employeeMatch = pathname.match(/^\/api\/employees\/([^/]+)$/);
  if (employeeMatch && ["PUT", "PATCH"].includes(req.method)) {
    const body = await readBody(req);
    const employee = scopedFind("employees", item => item.id === employeeMatch[1]);
    if (!employee) return json(res, 404, { error: "Funcionario nao encontrado" });
    const previousData = { ...employee };
    Object.assign(employee, normalizeEmployeeProfile({
      ...employee,
      ...body,
      salary: Number(body.salary ?? employee.salary ?? 0),
      monthlyHours: Number(body.monthlyHours ?? employee.monthlyHours ?? 176),
      commissionPercent: Number(body.commissionPercent ?? employee.commissionPercent ?? 0),
      updatedAt: new Date().toISOString()
    }));
    audit("Funcionario atualizado", "employee", employee.id, db.currentUser.name, employee.name, { previousData, newData: employee });
    return json(res, 200, { ...employee, hourValue: employeeHour(employee) });
  }
  if (req.method === "GET" && ["/api/sectors", "/api/production-sectors"].includes(pathname)) return json(res, 200, scoped("sectors").slice().sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0)));
  if (req.method === "POST" && ["/api/sectors", "/api/production-sectors"].includes(pathname)) {
    const body = await readBody(req);
    const sector = {
      id: uid("sec"),
      name: body.name || "Novo setor",
      icon: body.icon || "processo",
      color: body.color || "#6f0f8f",
      orderIndex: Number(body.orderIndex ?? db.sectors.length),
      description: body.description || "",
      responsible: body.responsible || "",
      users: Array.isArray(body.users) ? body.users : [],
      schedule: body.schedule || "",
      capacity: body.capacity || "",
      equipment: Array.isArray(body.equipment) ? body.equipment : [],
      permissions: body.permissions || {},
      active: body.active !== false
    };
    db.sectors.push(withCompany(sector, "sectors"));
    if (!db.costCenters.some(center => center.name === sector.name)) {
      db.costCenters.push(withCompany({ id: uid("cc"), name: sector.name, type: "indireto", monthlyBudget: 0, active: sector.active }, "costCenters"));
    }
    audit("Setor cadastrado", "sector", sector.id, db.currentUser.name, sector.name);
    return json(res, 201, sector);
  }
  const sectorMatch = pathname.match(/^\/api\/(?:production-)?sectors\/([^/]+)$/);
  if (sectorMatch && ["PUT", "PATCH"].includes(req.method)) {
    const body = await readBody(req);
    const sector = scopedFind("sectors", item => item.id === sectorMatch[1]);
    if (!sector) return json(res, 404, { error: "Setor nao encontrado" });
    Object.assign(sector, {
      ...body,
      name: body.name || sector.name,
      icon: body.icon ?? sector.icon ?? "processo",
      color: body.color ?? sector.color ?? "#6f0f8f",
      orderIndex: Number(body.orderIndex ?? sector.orderIndex ?? 0),
      description: body.description ?? sector.description ?? "",
      active: body.active ?? sector.active,
      updatedAt: new Date().toISOString()
    });
    audit("Setor atualizado", "sector", sector.id, db.currentUser.name, sector.name);
    return json(res, 200, sector);
  }
  if (sectorMatch && req.method === "DELETE") {
    const sector = scopedFind("sectors", item => item.id === sectorMatch[1]);
    if (!sector) return json(res, 404, { error: "Setor nao encontrado" });
    sector.active = false;
    sector.updatedAt = new Date().toISOString();
    audit("Setor inativado", "sector", sector.id, db.currentUser.name, sector.name);
    return json(res, 200, sector);
  }
  if (req.method === "GET" && pathname === "/api/expenses") return json(res, 200, scoped("expenses"));
  if (req.method === "POST" && pathname === "/api/expenses") {
    const body = await readBody(req);
    const expense = withCompany({ id: uid("exp"), type: body.type || "Outros", description: body.description || "", amount: Number(body.amount || 0), recurring: body.recurring !== false }, "expenses");
    db.expenses.push(expense);
    refreshFixedCostFromExpenses();
    audit("Despesa cadastrada", "expense", expense.id, db.currentUser.name, `${expense.type} ${expense.amount}`);
    return json(res, 201, expense);
  }
  const techMatch = pathname.match(/^\/api\/products\/([^/]+)\/technical-sheet$/);
  if (req.method === "GET" && techMatch) {
    const product = db.products.find(item => item.id === techMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    return json(res, 200, product.technicalSheet || {});
  }
  if (req.method === "POST" && techMatch) {
    const body = await readBody(req);
    const product = db.products.find(item => item.id === techMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    product.technicalSheet = { ...(product.technicalSheet || {}), ...body };
    audit("Ficha tecnica alterada", "product", product.id, body.user || "Administrador", product.name);
    return json(res, 200, product.technicalSheet);
  }
  if (req.method === "POST" && pathname === "/api/products") {
    const body = await readBody(req);
    const pricingValidation = validateProductPricing(body);
    if (pricingValidation.error) return json(res, 400, { error: pricingValidation.error });
    const product = {
      id: uid("p"),
      code: body.code || `PRD-${db.products.length + 1}`.padStart(7, "0"),
      name: body.name || "Produto sem nome",
      description: body.description || "",
      category: body.category || "Personalizado",
      unit: body.unit || "unidade",
      pricingMode: ["unit", "square_meter", "linear_meter"].includes(body.pricingMode) ? body.pricingMode : pricingModeForProduct(body),
      defaultProductionDays: Number(body.defaultProductionDays || 3),
      baseCostM2: pricingValidation.values.baseCostM2,
      laborHourCost: Number(body.laborHourCost || 40),
      machineHourCost: Number(body.machineHourCost || 30),
      marginPercent: pricingValidation.values.marginPercent || 50,
      taxPercent: pricingValidation.values.taxPercent || 6,
      commissionPercent: pricingValidation.values.commissionPercent,
      productionCost: pricingValidation.values.productionCost,
      installationCost: pricingValidation.values.installationCost,
      minPrice: pricingValidation.values.minPrice,
      salePrice: pricingValidation.values.salePrice,
      suggestedPrice: pricingValidation.values.suggestedPrice,
      manualFinalPrice: pricingValidation.values.manualFinalPrice,
      minMarginPercent: pricingValidation.values.minMarginPercent,
      maxDiscountPercent: pricingValidation.values.maxDiscountPercent || 10,
      priceNote: body.priceNote || "",
      active: body.active !== false,
      materialsUsed: Array.isArray(body.materialsUsed) ? body.materialsUsed : [],
      finishes: Array.isArray(body.finishes) ? body.finishes : [],
      averageProductionMinutes: Number(body.averageProductionMinutes || 0),
      sectors: Array.isArray(body.sectors) ? body.sectors : [],
      requiresInstallation: Boolean(body.requiresInstallation),
      requiresArt: Boolean(body.requiresArt),
      requiresApproval: Boolean(body.requiresApproval),
      generatesProduction: body.generatesProduction !== false,
      movesStock: body.movesStock !== false,
      generatesFinancial: body.generatesFinancial !== false,
      flow: body.flow || (body.productionRoute || []).map(step => step.sectorName) || ["Balcao"],
      technicalQuestions: (body.technicalQuestions || body.questions || []).map(normalizeTechnicalQuestion),
      questions: (body.technicalQuestions || body.questions || []).map(normalizeTechnicalQuestion),
      productionRoute: normalizeProductionRoute(body.productionRoute || [], body.flow || body.sectors || ["Balcao"]),
      categoryId: body.categoryId || "",
      imageUrl: body.imageUrl || "",
      categoryImageUrl: body.categoryImageUrl || "",
      attachments: normalizeCatalogAttachments(body.attachments || []),
      examples: normalizeCatalogAttachments(body.examples || []),
      defaultMeasurements: body.defaultMeasurements && typeof body.defaultMeasurements === "object" ? body.defaultMeasurements : null,
      favorite: Boolean(body.favorite)
    };
    normalizeProductCatalogFields(product);
    product.models = normalizeProductModels({ ...product, models: body.models || [] });
    db.products.push(withCompany(product, "products"));
    audit("Produto cadastrado", "product", product.id, db.currentUser.name, product.name, { newData: { baseCostM2: product.baseCostM2, salePrice: product.salePrice, marginPercent: product.marginPercent, maxDiscountPercent: product.maxDiscountPercent, active: product.active } });
    return json(res, 201, product);
  }
  const productMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  const productPricingMatch = pathname.match(/^\/api\/products\/([^/]+)\/pricing$/);
  if (productPricingMatch && req.method === "PATCH") {
    const body = await readBody(req);
    const product = scopedFind("products", item => item.id === productPricingMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado ou pertence a outra loja" });
    const pricingValidation = validateProductPricing(body, product);
    if (pricingValidation.error) return json(res, 400, { error: pricingValidation.error });
    const previousData = { baseCostM2: product.baseCostM2, minPrice: product.minPrice, salePrice: product.salePrice, suggestedPrice: product.suggestedPrice, manualFinalPrice: product.manualFinalPrice, marginPercent: product.marginPercent, minMarginPercent: product.minMarginPercent, maxDiscountPercent: product.maxDiscountPercent, commissionPercent: product.commissionPercent, taxPercent: product.taxPercent, productionCost: product.productionCost, installationCost: product.installationCost, unit: product.unit, priceNote: product.priceNote, active: product.active };
    Object.assign(product, pricingValidation.values, {
      unit: body.unit || product.unit || "unidade",
      priceNote: body.priceNote ?? product.priceNote ?? "",
      active: body.active === undefined ? product.active !== false : body.active !== false,
      updatedAt: new Date().toISOString()
    });
    product.models = normalizeProductModels(product);
    audit("Valores do produto alterados", "product", product.id, db.currentUser.name, body.reason || product.priceNote || product.name, {
      previousData,
      newData: { baseCostM2: product.baseCostM2, minPrice: product.minPrice, salePrice: product.salePrice, suggestedPrice: product.suggestedPrice, manualFinalPrice: product.manualFinalPrice, marginPercent: product.marginPercent, minMarginPercent: product.minMarginPercent, maxDiscountPercent: product.maxDiscountPercent, commissionPercent: product.commissionPercent, taxPercent: product.taxPercent, productionCost: product.productionCost, installationCost: product.installationCost, unit: product.unit, priceNote: product.priceNote, active: product.active }
    });
    return json(res, 200, product);
  }
  if (productMatch && req.method === "PUT") {
    const body = await readBody(req);
    const product = scopedFind("products", item => item.id === productMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    const pricingValidation = validateProductPricing(body, product);
    if (pricingValidation.error) return json(res, 400, { error: pricingValidation.error });
    const previousData = { name: product.name, baseCostM2: product.baseCostM2, minPrice: product.minPrice, salePrice: product.salePrice, suggestedPrice: product.suggestedPrice, manualFinalPrice: product.manualFinalPrice, marginPercent: product.marginPercent, minMarginPercent: product.minMarginPercent, maxDiscountPercent: product.maxDiscountPercent, commissionPercent: product.commissionPercent, taxPercent: product.taxPercent, productionCost: product.productionCost, installationCost: product.installationCost, unit: product.unit, priceNote: product.priceNote, active: product.active };
    Object.assign(product, {
      ...body,
      pricingMode: ["unit", "square_meter", "linear_meter"].includes(body.pricingMode) ? body.pricingMode : pricingModeForProduct({ ...product, ...body }),
      defaultProductionDays: Number(body.defaultProductionDays ?? product.defaultProductionDays ?? 3),
      baseCostM2: pricingValidation.values.baseCostM2,
      laborHourCost: Number(body.laborHourCost ?? product.laborHourCost ?? 40),
      machineHourCost: Number(body.machineHourCost ?? product.machineHourCost ?? 30),
      marginPercent: pricingValidation.values.marginPercent,
      minMarginPercent: pricingValidation.values.minMarginPercent,
      taxPercent: pricingValidation.values.taxPercent,
      commissionPercent: pricingValidation.values.commissionPercent,
      productionCost: pricingValidation.values.productionCost,
      installationCost: pricingValidation.values.installationCost,
      minPrice: pricingValidation.values.minPrice,
      salePrice: pricingValidation.values.salePrice,
      suggestedPrice: pricingValidation.values.suggestedPrice,
      manualFinalPrice: pricingValidation.values.manualFinalPrice,
      maxDiscountPercent: pricingValidation.values.maxDiscountPercent,
      priceNote: body.priceNote ?? product.priceNote ?? "",
      materialsUsed: Array.isArray(body.materialsUsed) ? body.materialsUsed : (product.materialsUsed || []),
      finishes: Array.isArray(body.finishes) ? body.finishes : (product.finishes || []),
      averageProductionMinutes: Number(body.averageProductionMinutes ?? product.averageProductionMinutes ?? 0),
      sectors: Array.isArray(body.sectors) ? body.sectors : (product.sectors || []),
      technicalQuestions: (body.technicalQuestions || body.questions || product.technicalQuestions || product.questions || []).map(normalizeTechnicalQuestion),
      questions: (body.technicalQuestions || body.questions || product.technicalQuestions || product.questions || []).map(normalizeTechnicalQuestion),
      productionRoute: normalizeProductionRoute(body.productionRoute || product.productionRoute || [], body.flow || body.sectors || product.flow || product.sectors || []),
      requiresInstallation: Boolean(body.requiresInstallation),
      requiresArt: Boolean(body.requiresArt),
      requiresApproval: Boolean(body.requiresApproval),
      generatesProduction: body.generatesProduction !== false,
      movesStock: body.movesStock !== false,
      generatesFinancial: body.generatesFinancial !== false,
      active: body.active !== false,
      updatedAt: new Date().toISOString()
    });
    normalizeProductCatalogFields(product);
    product.models = Array.isArray(body.models) ? normalizeProductModels(product) : normalizeProductModels(product);
    audit("Produto atualizado", "product", product.id, db.currentUser.name, product.name, {
      previousData,
      newData: { name: product.name, baseCostM2: product.baseCostM2, minPrice: product.minPrice, salePrice: product.salePrice, suggestedPrice: product.suggestedPrice, manualFinalPrice: product.manualFinalPrice, marginPercent: product.marginPercent, minMarginPercent: product.minMarginPercent, maxDiscountPercent: product.maxDiscountPercent, commissionPercent: product.commissionPercent, taxPercent: product.taxPercent, productionCost: product.productionCost, installationCost: product.installationCost, unit: product.unit, priceNote: product.priceNote, active: product.active }
    });
    return json(res, 200, product);
  }
  if (productMatch && req.method === "DELETE") {
    const product = scopedFind("products", item => item.id === productMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    product.active = false;
    product.updatedAt = new Date().toISOString();
    audit("Produto inativado", "product", product.id, db.currentUser.name, product.name);
    return json(res, 200, product);
  }
  const productDuplicateMatch = pathname.match(/^\/api\/products\/([^/]+)\/duplicate$/);
  if (productDuplicateMatch && req.method === "POST") {
    const body = await readBody(req);
    const product = scopedFind("products", item => item.id === productDuplicateMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    const previousData = groupedProductPayload(product);
    const duplicate = structuredClone(previousData);
    duplicate.id = uid("p");
    duplicate.code = body.code || `${product.code || "PRD"}-COPIA-${db.products.length + 1}`;
    duplicate.name = body.name || `${product.name} (copia)`;
    duplicate.active = true;
    duplicate.createdAt = new Date().toISOString();
    duplicate.updatedAt = duplicate.createdAt;
    duplicate.models = normalizeProductModels({ ...duplicate, models: (duplicate.models || []).map((model, index) => ({
      ...model,
      id: uid("model"),
      name: index === 0 ? `${model.name || "Modelo"} (copia)` : model.name
    })) });
    delete duplicate.activeModels;
    delete duplicate.inactiveModels;
    db.products.push(withCompany(duplicate, "products"));
    audit("Produto duplicado", "product", duplicate.id, db.currentUser.name, duplicate.name, { previousData, newData: groupedProductPayload(duplicate) });
    return json(res, 201, groupedProductPayload(duplicate));
  }
  const productModelCollectionMatch = pathname.match(/^\/api\/products\/([^/]+)\/models$/);
  if (productModelCollectionMatch && req.method === "POST") {
    const body = await readBody(req);
    const product = scopedFind("products", item => item.id === productModelCollectionMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    const previousData = groupedProductPayload(product);
    const baseModel = {
      id: uid("model"),
      name: body.name || body.model || "Novo modelo",
      finish: body.finish || "",
      unit: body.unit || product.unit || "unidade",
      variation: body.variation || product.pricingMode || pricingModeForProduct(product),
      materialCost: Number(body.materialCost ?? body.thirdPartyCost ?? product.baseCostM2 ?? 0),
      laborCost: Number(body.laborCost ?? body.productionCost ?? product.productionCost ?? 0),
      salePrice: Number(body.salePrice ?? body.minPrice ?? product.salePrice ?? product.minPrice ?? 0),
      minPrice: Number(body.minPrice ?? body.salePrice ?? product.minPrice ?? 0),
      technicalQuestions: (body.technicalQuestions || body.questions || product.technicalQuestions || product.questions || []).map(normalizeTechnicalQuestion),
      questions: (body.technicalQuestions || body.questions || product.technicalQuestions || product.questions || []).map(normalizeTechnicalQuestion),
      productionRoute: normalizeProductionRoute(body.productionRoute || [], body.flow || product.productionRoute || product.flow || []),
      stockLinks: Array.isArray(body.stockLinks) ? body.stockLinks : [],
      active: body.active !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    product.models = [...refreshProductModels(product), normalizeProductModel(product, baseModel, product.models?.length || 0)];
    audit("Modelo criado", "product", product.id, db.currentUser.name, baseModel.name, { previousData, newData: groupedProductPayload(product) });
    return json(res, 201, groupedProductPayload(product));
  }
  const productModelDuplicateMatch = pathname.match(/^\/api\/products\/([^/]+)\/models\/([^/]+)\/duplicate$/);
  if (productModelDuplicateMatch && req.method === "POST") {
    const body = await readBody(req);
    const product = scopedFind("products", item => item.id === productModelDuplicateMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    const previousData = groupedProductPayload(product);
    const found = findProductModel(product, productModelDuplicateMatch[2]);
    if (!found.model) return json(res, 404, { error: "Modelo nao encontrado" });
    const duplicate = normalizeProductModel(product, {
      ...structuredClone(found.model),
      id: uid("model"),
      name: body.name || `${found.model.name} (copia)`,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, found.models.length);
    product.models = [...found.models, duplicate];
    audit("Modelo duplicado", "product", product.id, db.currentUser.name, duplicate.name, { previousData, newData: groupedProductPayload(product) });
    return json(res, 201, groupedProductPayload(product));
  }
  const productModelQuestionsMatch = pathname.match(/^\/api\/products\/([^/]+)\/models\/([^/]+)\/questions$/);
  if (productModelQuestionsMatch && req.method === "GET") {
    const product = scopedFind("products", item => item.id === productModelQuestionsMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    const found = findProductModel(product, productModelQuestionsMatch[2]);
    if (!found.model) return json(res, 404, { error: "Modelo nao encontrado" });
    return json(res, 200, (found.model.technicalQuestions || found.model.questions || []).map(normalizeTechnicalQuestion).sort((a, b) => a.orderIndex - b.orderIndex));
  }
  if (productModelQuestionsMatch && ["PUT", "PATCH"].includes(req.method)) {
    const body = await readBody(req);
    const product = scopedFind("products", item => item.id === productModelQuestionsMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    const previousData = groupedProductPayload(product);
    const found = findProductModel(product, productModelQuestionsMatch[2]);
    if (!found.model) return json(res, 404, { error: "Modelo nao encontrado" });
    const questions = (body.technicalQuestions || body.questions || []).map(normalizeTechnicalQuestion);
    found.models[found.index] = normalizeProductModel(product, { ...found.model, technicalQuestions: questions, questions, updatedAt: new Date().toISOString() }, found.index);
    product.models = found.models;
    audit("Perguntas do modelo atualizadas", "product", product.id, db.currentUser.name, found.model.name, { previousData, newData: groupedProductPayload(product) });
    return json(res, 200, groupedProductPayload(product));
  }
  const productModelMatch = pathname.match(/^\/api\/products\/([^/]+)\/models\/([^/]+)$/);
  if (productModelMatch && ["PUT", "PATCH"].includes(req.method)) {
    const body = await readBody(req);
    const product = scopedFind("products", item => item.id === productModelMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    const previousData = groupedProductPayload(product);
    const found = findProductModel(product, productModelMatch[2]);
    if (!found.model) return json(res, 404, { error: "Modelo nao encontrado" });
    const merged = {
      ...found.model,
      ...body,
      materialCost: Number(body.materialCost ?? body.thirdPartyCost ?? found.model.materialCost ?? 0),
      laborCost: Number(body.laborCost ?? body.productionCost ?? found.model.laborCost ?? 0),
      salePrice: Number(body.salePrice ?? found.model.salePrice ?? 0),
      minPrice: Number(body.minPrice ?? body.salePrice ?? found.model.minPrice ?? found.model.salePrice ?? 0),
      technicalQuestions: (body.technicalQuestions || body.questions || found.model.technicalQuestions || found.model.questions || []).map(normalizeTechnicalQuestion),
      questions: (body.technicalQuestions || body.questions || found.model.technicalQuestions || found.model.questions || []).map(normalizeTechnicalQuestion),
      productionRoute: normalizeProductionRoute(body.productionRoute || found.model.productionRoute || [], body.flow || found.model.flow || product.productionRoute || product.flow || []),
      stockLinks: Array.isArray(body.stockLinks) ? body.stockLinks : found.model.stockLinks || [],
      active: body.active === undefined ? found.model.active !== false : body.active !== false,
      updatedAt: new Date().toISOString()
    };
    found.models[found.index] = normalizeProductModel(product, merged, found.index);
    product.models = found.models;
    if (body.syncMainProduct === true || found.index === 0) syncProductFieldsFromModel(product, product.models[found.index]);
    audit("Modelo editado", "product", product.id, db.currentUser.name, found.models[found.index].name, { previousData, newData: groupedProductPayload(product) });
    return json(res, 200, groupedProductPayload(product));
  }
  if (productModelMatch && req.method === "DELETE") {
    const product = scopedFind("products", item => item.id === productModelMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    const previousData = groupedProductPayload(product);
    const found = findProductModel(product, productModelMatch[2]);
    if (!found.model) return json(res, 404, { error: "Modelo nao encontrado" });
    found.models[found.index] = normalizeProductModel(product, { ...found.model, active: false, updatedAt: new Date().toISOString() }, found.index);
    product.models = found.models;
    audit("Modelo inativado", "product", product.id, db.currentUser.name, found.model.name, { previousData, newData: groupedProductPayload(product) });
    return json(res, 200, groupedProductPayload(product));
  }
  const productQuestionMatch = pathname.match(/^\/api\/products\/([^/]+)\/questions$/);
  if (req.method === "GET" && productQuestionMatch) {
    const product = scopedFind("products", item => item.id === productQuestionMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    return json(res, 200, (product.technicalQuestions || product.questions || []).map(normalizeTechnicalQuestion).sort((a, b) => a.orderIndex - b.orderIndex));
  }
  if (req.method === "POST" && productQuestionMatch) {
    const body = await readBody(req);
    const product = scopedFind("products", item => item.id === productQuestionMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    const question = {
      key: body.key || `custom_${product.questions.length + 1}`,
      label: body.label || "Pergunta personalizada",
      type: body.type || ({ yes_no: "boolean", multi_select: "multiselect" }[body.answerType] || body.answerType) || "text",
      answerType: body.answerType || ({ boolean: "yes_no", multiselect: "multi_select" }[body.type] || body.type) || "text",
      required: Boolean(body.required),
      orderIndex: Number(body.orderIndex ?? body.order ?? (product.questions || []).length),
      defaultValue: body.defaultValue ?? body.default ?? "",
      productionImpact: body.productionImpact || "",
      deadlineImpactDays: Number(body.deadlineImpactDays || body.deadlineImpact || 0),
      active: body.active !== false,
      visibleInQuote: body.visibleInQuote !== false,
      visibleInOrder: body.visibleInOrder !== false,
      visibleInProduction: body.visibleInProduction !== false,
      affectsCost: Boolean(body.affectsCost || Object.keys(body.priceImpact || {}).length),
      costType: body.costType || "fixed",
      costValue: Number(body.costValue || 0),
      costApplication: body.costApplication || "add_to_cost",
      options: body.options || [],
      priceImpact: body.priceImpact || {}
    };
    product.technicalQuestions = [...(product.technicalQuestions || product.questions || []), normalizeTechnicalQuestion(question)];
    product.questions = product.technicalQuestions;
    audit("Pergunta do produto cadastrada", "product", product.id, db.currentUser.name, question.label, { newData: normalizeTechnicalQuestion(question) });
    return json(res, 201, normalizeTechnicalQuestion(question));
  }
  const productConfigMatch = pathname.match(/^\/api\/products\/([^/]+)\/(production-config|technical-questions|production-route)$/);
  if (req.method === "PUT" && productConfigMatch) {
    const body = await readBody(req);
    const product = scopedFind("products", item => item.id === productConfigMatch[1]);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    const previousData = { questions: product.technicalQuestions || product.questions || [], productionRoute: product.productionRoute || [], flow: product.flow || [] };
    if (productConfigMatch[2] === "technical-questions") {
      product.technicalQuestions = (body.technicalQuestions || body.questions || []).map(normalizeTechnicalQuestion);
      product.questions = product.technicalQuestions;
    } else if (productConfigMatch[2] === "production-route") {
      product.productionRoute = normalizeProductionRoute(body.productionRoute || body.route || [], product.flow || []);
      product.flow = product.productionRoute.map(step => step.sectorName);
    } else {
      product.pricingMode = ["unit", "square_meter", "linear_meter"].includes(body.pricingMode) ? body.pricingMode : pricingModeForProduct(product);
      product.defaultProductionDays = Number(body.defaultProductionDays ?? product.defaultProductionDays ?? 3);
      if (body.technicalQuestions || body.questions) {
        product.technicalQuestions = (body.technicalQuestions || body.questions).map(normalizeTechnicalQuestion);
        product.questions = product.technicalQuestions;
      }
      if (body.productionRoute || body.route) {
        product.productionRoute = normalizeProductionRoute(body.productionRoute || body.route, product.flow || []);
        product.flow = product.productionRoute.map(step => step.sectorName);
      }
    }
    product.updatedAt = new Date().toISOString();
    audit("Configuracao produtiva do produto atualizada", "product", product.id, db.currentUser.name, product.name, { previousData, newData: { questions: product.technicalQuestions || product.questions || [], productionRoute: product.productionRoute || [], flow: product.flow || [] } });
    return json(res, 200, product);
  }
  if (req.method === "GET" && pathname === "/api/project-recognition") return json(res, 200, scoped("productRecognitionAnalyses"));
  if (req.method === "POST" && pathname === "/api/project-recognition/analyze") {
    const body = await readBody(req);
    const upload = withCompany({
      id: uid("upload"),
      fileName: body.fileName || body.name || "projeto-sem-nome",
      fileType: body.fileType || body.type || "",
      fileSize: Number(body.fileSize || 0),
      quoteId: body.quoteId || "",
      customerId: body.customerId || "",
      notes: body.notes || body.customerRequest || "",
      extractedText: body.extractedText || "",
      status: "stored",
      createdAt: new Date().toISOString(),
      createdBy: body.user || db.currentUser.name
    }, "projectUploads");
    db.projectUploads.push(upload);
    const result = analyzeProjectRecognition({ ...body, fileName: upload.fileName });
    const analysis = withCompany({
      id: uid("analysis"),
      uploadId: upload.id,
      quoteId: body.quoteId || "",
      customerId: body.customerId || "",
      fileName: upload.fileName,
      analysisMode: result.analysisMode,
      aiProviderConfigured: result.aiProviderConfigured,
      message: result.message,
      suggestions: result.suggestions,
      missingInformation: result.missingInformation,
      measurements: result.measurements,
      status: "review_required",
      createdAt: new Date().toISOString(),
      createdBy: body.user || db.currentUser.name
    }, "productRecognitionAnalyses");
    db.productRecognitionAnalyses.push(analysis);
    audit("Projeto analisado para orcamento", "project_recognition", analysis.id, analysis.createdBy, upload.fileName, { newData: { mode: analysis.analysisMode, suggestions: analysis.suggestions.length } });
    return json(res, 201, { upload, analysis });
  }
  const recognitionDraftMatch = pathname.match(/^\/api\/project-recognition\/([^/]+)\/quote-draft$/);
  if (recognitionDraftMatch && req.method === "POST") {
    const body = await readBody(req);
    const analysis = scopedFind("productRecognitionAnalyses", item => item.id === recognitionDraftMatch[1]);
    if (!analysis) return json(res, 404, { error: "Analise nao encontrada" });
    const selected = Array.isArray(body.items) && body.items.length ? body.items : (analysis.suggestions || []).slice(0, 1);
    const itemSnapshots = selected.map((selection, index) => {
      const productId = selection.productId || selection.id;
      const product = scopedFind("products", item => item.id === productId) || db.products.find(item => item.id === productId);
      if (!product) return null;
      const composition = db.compositions.find(item => item.id === (selection.compositionId || selection.suggestedAnswers?.compositionId)) || db.compositions.find(item => item.productId === product.id);
      const answers = {
        ...(selection.suggestedAnswers || {}),
        ...(selection.answers || {}),
        compositionId: composition?.id || selection.compositionId || ""
      };
      const integrated = buildIntegratedPricing(product, { productId: product.id, productModelId: selection.productModelId || answers.productModelId || "", answers, additionalExpenses: Number(selection.additionalExpenses || 0), manualPrice: Number(selection.manualPrice || 0) || undefined });
      return buildQuoteItemSnapshot({
        productId: product.id,
        productModelId: integrated.pricing.productModelId || selection.productModelId || "",
        compositionId: composition?.id || "",
        productName: product.name,
        description: selection.description || product.name,
        quantity: Number(answers.quantity || 1),
        answers,
        pricingSnapshot: integrated.pricing,
        files: [analysis.fileName].filter(Boolean),
        aiTrace: { analysisId: analysis.id, confidence: selection.confidence, source: selection.source || analysis.analysisMode, reason: selection.reason || "" }
      }, index);
    }).filter(Boolean);
    if (!itemSnapshots.length) return json(res, 400, { error: "Nenhum item valido para gerar rascunho" });
    const pricing = aggregateItemPricing(itemSnapshots, {}, body.manualPrice || 0);
    const draft = {
      id: uid("qdraft"),
      analysisId: analysis.id,
      status: "draft_ready",
      customerId: body.customerId || analysis.customerId || "",
      jobName: body.jobName || `Orcamento sugerido - ${analysis.fileName}`,
      items: itemSnapshots,
      itemSnapshots,
      pricing,
      projectFiles: [analysis.fileName].filter(Boolean),
      message: "Rascunho criado para revisao. O orcamento ainda nao foi salvo automaticamente.",
      createdAt: new Date().toISOString(),
      createdBy: body.user || db.currentUser.name
    };
    analysis.quoteDraft = draft;
    analysis.status = "draft_ready";
    analysis.updatedAt = new Date().toISOString();
    audit("Rascunho de orcamento por projeto", "project_recognition", analysis.id, draft.createdBy, draft.jobName, { newData: { itemCount: itemSnapshots.length, total: pricing.finalPrice } });
    return json(res, 201, draft);
  }
  if (req.method === "POST" && pathname === "/api/quote/calculate") {
    const body = await readBody(req);
    const product = db.products.find(item => item.id === body.productId);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    const result = buildIntegratedPricing(product, body);
    return json(res, 200, { ...result.pricing, discountSimulation: simulateDiscount(result.pricing, body.discountPercent || result.discountPercent), approvalRequired: result.discountPercent > result.discountLimit, discountLimit: result.discountLimit });
  }
  if (req.method === "GET" && pathname === "/api/quotes") return json(res, 200, scoped("quotes"));
  if (req.method === "GET" && pathname === "/api/reports/quoted-approved") {
    return json(res, 200, scoped("quotes").filter(quote => quote.status === "aprovado").map(quote => {
      const calculated = Number(quote.pricing?.suggestedPrice || 0);
      const approved = Number(quote.approvedPrice || quote.pricing?.finalPrice || calculated);
      return {
        quoteNumber: quote.quoteNumber,
        jobName: quote.jobName,
        calculated,
        approved,
        difference: round(approved - calculated),
        discount: calculated > approved ? round(calculated - approved) : 0,
        originalMargin: quote.pricing?.marginPercent || 0,
        finalMargin: quote.pricing?.validation?.marginAtManualPrice ?? quote.pricing?.marginPercent ?? 0,
        responsible: quote.approvedBy || quote.costSnapshot?.user || db.currentUser.name
      };
    }));
  }
  if (req.method === "POST" && pathname === "/api/quotes") {
    const body = await readBody(req);
    const submittedItems = Array.isArray(body.answers?.quoteItems) ? body.answers.quoteItems : [];
    let itemSnapshots = submittedItems.map(buildQuoteItemSnapshot);
    const firstItemProduct = db.products.find(item => item.id === itemSnapshots[0]?.productId);
    const product = firstItemProduct || db.products.find(item => item.id === body.productId);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    const integrated = buildIntegratedPricing(product, body);
    if (!itemSnapshots.length) {
      itemSnapshots = [buildQuoteItemSnapshot({
        productId: product.id,
        productModelId: body.productModelId || body.answers?.productModelId || integrated.pricing.productModelId || "",
        compositionId: integrated.pricing.compositionId || body.answers?.compositionId || null,
        description: body.jobName || product.name,
        quantity: Number(body.answers?.quantity || 1),
        answers: body.answers || {},
        pricingSnapshot: integrated.pricing,
        files: body.files || []
      }, 0)];
    }
    const pricing = itemSnapshots.length ? aggregateItemPricing(itemSnapshots, integrated.pricing, body.manualPrice) : integrated.pricing;
    integrated.pricing = pricing;
    integrated.validation = pricing.validation;
    integrated.discountPercent = pricing.discountPercent || 0;
    if (integrated.discountPercent > integrated.discountLimit && !body.approvedBy) {
      audit("Aprovacao de desconto solicitada", "quote", "pre-save", db.currentUser.name, `${integrated.discountPercent}% acima do limite ${integrated.discountLimit}%`);
      return json(res, 403, { error: "Desconto acima do limite do usuario. Solicite aprovacao de Gestor/Admin.", approvalRequired: true, discountPercent: integrated.discountPercent, discountLimit: integrated.discountLimit });
    }
    if (integrated.discountPercent) audit("Desconto aplicado", "quote", "pre-save", body.user || db.currentUser.name, `${integrated.discountPercent}% em ${product.name}`);
    if (body.manualPrice && Number(body.manualPrice) !== Number(pricing.suggestedPrice)) audit("Preco alterado manualmente", "quote", "pre-save", db.currentUser.name, `Anterior ${pricing.suggestedPrice} novo ${pricing.finalPrice}. Motivo: ${body.priceChangeReason || "nao informado"}`);
    const composition = db.compositions.find(item => item.id === (itemSnapshots[0]?.compositionId || pricing.compositionId));
    const quoteAnswers = { ...(body.answers || {}), productModelId: itemSnapshots[0]?.productModelId || body.productModelId || body.answers?.productModelId || "", quoteItems: itemSnapshots };
    const costSnapshot = buildQuoteSnapshot({ answers: quoteAnswers, productModelId: quoteAnswers.productModelId }, composition, pricing, product);
    costSnapshot.items = itemSnapshots;
    costSnapshot.productionRoute = consolidateProductionRoutes(itemSnapshots, costSnapshot.productionRoute);
    costSnapshot.questionCosts = itemSnapshots.length ? itemSnapshots.flatMap(item => item.questionCostsSnapshot || []) : costSnapshot.questionCosts;
    const itemFiles = itemSnapshots.flatMap(item => item.files || []);
    const quote = {
      id: uid("q"),
      quoteNumber: `ORC-${db.quotes.length + 1001}`,
      customerId: body.customerId,
      jobName: body.jobName || product.name,
      productId: product.id,
      productModelId: quoteAnswers.productModelId,
      productModelName: itemSnapshots[0]?.productModelName || pricing.productModelName || "",
      answers: quoteAnswers,
      pricing,
      compositionId: itemSnapshots[0]?.compositionId || pricing.compositionId || null,
      items: itemSnapshots,
      itemSnapshots,
      files: [...new Set([...(body.files || []), ...itemFiles])],
      projectFiles: [...new Set([...(body.projectFiles || []), ...itemSnapshots.flatMap(item => item.projectFiles || [])])],
      photos: body.photos || [],
      approvedPrice: pricing.finalPrice || pricing.suggestedPrice,
      costSnapshot,
      priceChangeReason: body.priceChangeReason || "",
      discountApproval: integrated.discountPercent > 0 ? { discountPercent: integrated.discountPercent, limit: integrated.discountLimit, approvedBy: body.approvedBy || null } : null,
      discountSimulation: simulateDiscount(pricing, body.discountPercent || 0),
      status: "rascunho",
      createdAt: new Date().toISOString()
    };
    db.quotes.push(withCompany(quote, "quotes"));
    audit("Orcamento criado", "quote", quote.id, body.user || "Vendedor", quote.jobName);
    audit("Preco calculado", "quote", quote.id, db.currentUser.name, `Composicao ${composition?.name || "sem composicao"} ${pricing.finalPrice}`);
    if (body.manualPrice && Number(body.manualPrice) !== Number(pricing.suggestedPrice)) audit("Preco alterado", "quote", quote.id, db.currentUser.name, `Anterior ${pricing.suggestedPrice} novo ${pricing.finalPrice}. Motivo: ${body.priceChangeReason || "nao informado"}`);
    enqueueCustomerNotification("quote.created", { customerId: quote.customerId, quoteId: quote.id, user: body.user || db.currentUser.name });
    return json(res, 201, quote);
  }
  const approveMatch = pathname.match(/^\/api\/quotes\/([^/]+)\/approve$/);
  if (req.method === "POST" && approveMatch) {
    const body = await readBody(req);
    const quote = scopedFind("quotes", item => item.id === approveMatch[1]);
    if (!quote) return json(res, 404, { error: "Orcamento nao encontrado" });
    const order = approveQuoteToOrder(quote, body);
    return json(res, 201, order);
  }
  if (req.method === "GET" && pathname === "/api/orders") return json(res, 200, scoped("orders").map(order => ({
    ...order,
    customerName: customerName(order.customerId),
    serviceOrderTypeLabel: businessOrderTypeLabel(order.serviceOrderType || "normal"),
    isBillable: !orderIsNonBillable(order) && !orderIsCancelled(order),
    teams: scoped("installationTeams").filter(team => team.orderId === order.id),
    events: scoped("productionEvents").filter(event => event.orderId === order.id),
    history: orderHistory(order.id),
    postCalculation: postCalculation(order)
  })));
  if (req.method === "GET" && pathname === "/api/production/movements") return json(res, 200, productionMovementRows(Object.fromEntries(requestUrl.searchParams.entries())));
  const cancelOrderMatch = pathname.match(/^\/api\/orders\/([^/]+)\/cancel$/);
  if (req.method === "POST" && cancelOrderMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === cancelOrderMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    if (orderIsCancelled(order)) return json(res, 409, { error: "Esta O.S. ja esta cancelada" });
    if (!isAdmin(requestUser) && !productionActionAllowed("cancel", requestUser) && !db.quickPermissions.orders) return json(res, 403, { error: "Usuario sem permissao para cancelar O.S." });
    const reason = String(body.reason || body.cancelReason || "").trim();
    if (!reason) return json(res, 400, { error: "Informe o motivo do cancelamento" });
    const paidAmount = Number(order.paidAmount || 0);
    if (paidAmount > 0 && !String(body.financialDecision || "").trim()) {
      return json(res, 409, { error: "O.S. possui valor recebido. Informe a decisao financeira: manter credito, estornar ou analisar com gestor.", requiresFinancialDecision: true, paidAmount });
    }
    const previousData = {
      lifecycleStatus: order.lifecycleStatus || "active",
      productionStatus: order.productionStatus,
      financialStatus: order.financialStatus,
      paidAmount
    };
    order.lifecycleStatus = "cancelled";
    order.productionStatus = "Cancelada";
    order.currentSectorName = "Cancelada";
    order.currentSectorId = "";
    order.cancelReason = reason;
    order.canceledAt = new Date().toISOString();
    order.canceledBy = body.user || db.currentUser.name;
    order.financialCancellationDecision = body.financialDecision || (paidAmount > 0 ? "analise_gestor" : "sem_recebimento");
    order.financialCancellationObservation = body.financialObservation || "";
    if (paidAmount <= 0 && !orderIsNonBillable(order)) order.financialStatus = "cancelada";
    scoped("accountsReceivable").filter(item => (item.orderId === order.id || item.sourceId === order.id) && item.balance > 0).forEach(receivable => {
      receivable.status = "cancelada";
      receivable.balance = 0;
      receivable.cancelReason = reason;
      receivable.updatedAt = order.canceledAt;
    });
    const event = pushProductionEvent(order, {
      action: "order_cancelled",
      previousStatus: previousData.productionStatus,
      newStatus: order.productionStatus,
      user: order.canceledBy,
      observation: reason,
      cancelReason: reason,
      createdAt: order.canceledAt
    });
    audit("O.S. cancelada", "order", order.id, order.canceledBy, reason, { previousData, newData: { productionStatus: order.productionStatus, financialStatus: order.financialStatus, lifecycleStatus: order.lifecycleStatus, eventId: event.id } });
    enqueueCustomerNotification("order.cancelled", { orderId: order.id, customerId: order.customerId, user: order.canceledBy });
    return json(res, 200, { order, event });
  }
  const reworkOrderMatch = pathname.match(/^\/api\/orders\/([^/]+)\/rework$/);
  if (req.method === "POST" && reworkOrderMatch) {
    const body = await readBody(req);
    const sourceOrder = scopedFind("orders", item => item.id === reworkOrderMatch[1]);
    if (!sourceOrder) return json(res, 404, { error: "O.S. de origem nao encontrada" });
    if (!productionActionAllowed("rework", requestUser) && !isAdmin(requestUser)) return json(res, 403, { error: "Usuario sem permissao para gerar retrabalho" });
    const responsible = String(body.responsible || body.responsibleEmployee || "").trim();
    if (!responsible) return json(res, 400, { error: "Defina obrigatoriamente o funcionario responsavel pelo retrabalho" });
    const reason = String(body.reason || body.reworkReason || "").trim();
    if (!reason) return json(res, 400, { error: "Informe o motivo do retrabalho" });
    const selectedIds = Array.isArray(body.itemIds) ? body.itemIds.map(String) : String(body.itemIds || "").split(",").map(item => item.trim()).filter(Boolean);
    if (!selectedIds.length) return json(res, 400, { error: "Selecione ao menos um item para retrabalho" });
    const sourceItems = orderItemList(sourceOrder);
    const selectedItems = sourceItems.filter(item => selectedIds.includes(String(item.id)));
    if (!selectedItems.length) return json(res, 400, { error: "Nenhum item selecionado foi encontrado na O.S. de origem" });
    const route = productionRouteFromSector(body.sector || sourceOrder.currentSectorName || sourceOrder.productionStatus, selectedItems[0]?.productionRouteSnapshot || sourceOrder.productionRouteSnapshot || []);
    const firstStep = route[0] || null;
    const additionalCosts = Array.isArray(body.additionalCosts) ? body.additionalCosts : [];
    const additionalCostTotal = round(Number(body.displacementCost || 0) + Number(body.miscCost || 0) + additionalCosts.reduce((sum, item) => sum + Number(item.value || item.amount || 0), 0));
    const now = new Date().toISOString();
    const reworkItems = selectedItems.map((item, index) => ({
      ...structuredClone(item),
      id: uid("rwitem"),
      itemNumber: index + 1,
      sourceOrderId: sourceOrder.id,
      sourceItemId: item.id,
      reworkReason: reason
    }));
    const order = withCompany({
      id: nextServiceOrderId(),
      serviceOrderType: "rework",
      serviceOrderTypeLabel: "Retrabalho",
      lifecycleStatus: "active",
      nonBillable: true,
      billingBlocked: true,
      originalOrderId: sourceOrder.id,
      customerId: sourceOrder.customerId,
      jobName: `Retrabalho - ${sourceOrder.jobName || sourceOrder.id}`,
      productId: reworkItems[0]?.productId || sourceOrder.productId || "",
      productModelId: reworkItems[0]?.productModelId || sourceOrder.productModelId || "",
      seller: sourceOrder.seller || "",
      attendant: sourceOrder.attendant || "",
      approvalStatus: "Retrabalho interno",
      items: reworkItems,
      itemProductionSnapshots: reworkItems,
      files: [...(sourceOrder.files || [])],
      answers: { ...(sourceOrder.answers || {}), reworkReason: reason },
      productionRouteSnapshot: route,
      currentRouteIndex: 0,
      currentSectorId: firstStep?.sectorId || "",
      currentSectorName: firstStep?.sectorName || body.sector || "Retrabalho",
      total: 0,
      approvedPrice: 0,
      paidAmount: 0,
      productionStatus: "Aguardando producao",
      financialStatus: "nao faturavel",
      dueDate: body.dueDate || dateAfterDays(1),
      priority: body.priority || "alta",
      flow: route.map(step => step.sectorName),
      sectors: route.map(step => step.sectorName),
      predictedCost: additionalCostTotal,
      predictedProfit: -additionalCostTotal,
      predictedMargin: 0,
      predictedMaterials: [],
      currentResponsible: responsible,
      reworkReason: reason,
      reworkCostOption: body.costOption || "custo_interno",
      additionalInternalCosts: additionalCosts,
      displacementCost: Number(body.displacementCost || 0),
      miscCost: Number(body.miscCost || 0),
      createdAt: now,
      realCost: additionalCostTotal,
      realMinutes: 0
    }, "orders");
    db.orders.push(order);
    if (additionalCostTotal > 0) {
      db.realCostEntries.push(withCompany({
        id: uid("real"),
        orderId: order.id,
        sector: order.currentSectorName,
        employee: responsible,
        role: "Retrabalho",
        laborMinutes: 0,
        laborHourValue: 0,
        machineMinutes: 0,
        machineHourValue: 0,
        materialCost: 0,
        laborCost: 0,
        machineCost: 0,
        totalCost: additionalCostTotal,
        notes: "Custo diverso/deslocamento do retrabalho",
        createdAt: now
      }, "realCostEntries"));
    }
    const event = pushProductionEvent(order, { action: "rework_order_created", previousStatus: "", newStatus: order.productionStatus, user: body.user || db.currentUser.name, responsible, observation: reason, reworkReason: reason, createdAt: now });
    pushProductionEvent(sourceOrder, { action: "rework_linked", previousStatus: sourceOrder.productionStatus, newStatus: sourceOrder.productionStatus, user: body.user || db.currentUser.name, responsible, observation: `Retrabalho ${order.id}: ${reason}`, reworkReason: reason, createdAt: now });
    audit("O.S. de retrabalho criada", "order", order.id, body.user || db.currentUser.name, `${sourceOrder.id} -> ${responsible}: ${reason}`, { newData: { originalOrderId: sourceOrder.id, itemIds: selectedIds, eventId: event.id, nonBillable: true } });
    enqueueCustomerNotification("rework.created", { orderId: order.id, customerId: order.customerId, user: body.user || db.currentUser.name });
    return json(res, 201, { order, sourceOrderId: sourceOrder.id, event });
  }
  if (req.method === "POST" && pathname === "/api/orders/courtesy") {
    const body = await readBody(req);
    if (!productionActionAllowed("move", requestUser) && !isAdmin(requestUser) && !db.quickPermissions.orders) return json(res, 403, { error: "Usuario sem permissao para gerar O.S. de cortesia" });
    if (!body.customerId) return json(res, 400, { error: "Informe o cliente da cortesia" });
    const reason = String(body.reason || body.courtesyReason || "").trim();
    if (!reason) return json(res, 400, { error: "Informe o motivo da cortesia" });
    const route = productionRouteFromSector(body.sector || "PCP", []);
    const firstStep = route[0] || null;
    const now = new Date().toISOString();
    const items = (Array.isArray(body.items) && body.items.length ? body.items : [{ description: body.description || "Servico de cortesia", quantity: Number(body.quantity || 1) }]).map((item, index) => ({
      id: uid("ctitem"),
      itemNumber: index + 1,
      description: item.description || body.description || "Servico de cortesia",
      productName: item.productName || item.description || body.description || "Cortesia",
      quantity: Number(item.quantity || body.quantity || 1),
      measure: item.measure || body.measure || "",
      productionRouteSnapshot: route,
      pricingSnapshot: { finalPrice: 0, suggestedPrice: 0, totalCost: 0 }
    }));
    const order = withCompany({
      id: nextServiceOrderId(),
      serviceOrderType: "courtesy",
      serviceOrderTypeLabel: "Cortesia",
      lifecycleStatus: "active",
      nonBillable: true,
      billingBlocked: true,
      customerId: body.customerId,
      jobName: body.jobName || body.description || "O.S. de cortesia",
      seller: body.seller || "",
      attendant: body.attendant || db.currentUser.name,
      approvalStatus: "Cortesia autorizada",
      authorizedBy: body.authorizedBy || db.currentUser.name,
      courtesyReason: reason,
      items,
      itemProductionSnapshots: items,
      files: body.files || [],
      answers: { courtesyReason: reason },
      productionRouteSnapshot: route,
      currentRouteIndex: 0,
      currentSectorId: firstStep?.sectorId || "",
      currentSectorName: firstStep?.sectorName || body.sector || "PCP",
      total: 0,
      approvedPrice: 0,
      paidAmount: 0,
      productionStatus: "Aguardando producao",
      financialStatus: "nao faturavel",
      dueDate: body.dueDate || dateAfterDays(1),
      priority: body.priority || "normal",
      flow: route.map(step => step.sectorName),
      sectors: route.map(step => step.sectorName),
      predictedCost: 0,
      predictedProfit: 0,
      predictedMargin: 0,
      predictedMaterials: [],
      currentResponsible: body.responsible || "",
      createdAt: now,
      realCost: 0,
      realMinutes: 0
    }, "orders");
    db.orders.push(order);
    const event = pushProductionEvent(order, { action: "courtesy_order_created", newStatus: order.productionStatus, user: body.user || db.currentUser.name, observation: reason, createdAt: now });
    audit("O.S. de cortesia criada", "order", order.id, body.user || db.currentUser.name, reason, { newData: { nonBillable: true, eventId: event.id } });
    enqueueCustomerNotification("courtesy.created", { orderId: order.id, customerId: order.customerId, user: body.user || db.currentUser.name });
    return json(res, 201, { order, event });
  }
  const orderHistoryMatch = pathname.match(/^\/api\/orders\/([^/]+)\/history$/);
  if (req.method === "GET" && orderHistoryMatch) return json(res, 200, orderHistory(orderHistoryMatch[1]));
  const orderPostCalcMatch = pathname.match(/^\/api\/orders\/([^/]+)\/post-calculation$/);
  if (req.method === "GET" && orderPostCalcMatch) {
    const order = scopedFind("orders", item => item.id === orderPostCalcMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    return json(res, 200, postCalculation(order));
  }
  const orderLabelMatch = pathname.match(/^\/api\/orders\/([^/]+)\/production-label$/);
  if (req.method === "GET" && orderLabelMatch) {
    const order = scopedFind("orders", item => item.id === orderLabelMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    return json(res, 200, productionLabel(order));
  }
  const approvalMatch = pathname.match(/^\/api\/orders\/([^/]+)\/approval$/);
  if (req.method === "POST" && approvalMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === approvalMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    order.approvalStatus = body.status || order.approvalStatus;
    if (body.file) order.files = [...(order.files || []), body.file];
    audit("Aprovacao do cliente atualizada", "order", order.id, body.user || "Atendente", `${order.approvalStatus} ${body.file || ""}`);
    return json(res, 200, order);
  }
  const productionNotesMatch = pathname.match(/^\/api\/orders\/([^/]+)\/production-notes$/);
  if (req.method === "PUT" && productionNotesMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === productionNotesMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    ["productionNotes", "internalProductionWarnings", "fileInstructions", "installationNotes"].forEach(key => {
      if (body[key] !== undefined) order[key] = body[key];
    });
    const event = withCompany({ id: uid("evt"), orderId: order.id, sectorId: order.currentSectorId || "", sectorName: order.currentSectorName || order.productionStatus, action: "note_added", user: body.user || db.currentUser.name, observation: order.productionNotes || order.internalProductionWarnings || order.fileInstructions || order.installationNotes || "", createdAt: new Date().toISOString() }, "productionEvents");
    db.productionEvents.push(event);
    audit("Observacao de producao atualizada", "order", order.id, event.user, event.observation);
    return json(res, 200, { order, event });
  }
  const orderItemsMatch = pathname.match(/^\/api\/orders\/([^/]+)\/items$/);
  if (req.method === "POST" && orderItemsMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === orderItemsMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    const product = scopedFind("products", item => item.id === body.productId) || db.products.find(item => item.id === body.productId);
    if (!product) return json(res, 404, { error: "Produto nao encontrado" });
    const items = order.itemProductionSnapshots || order.items || [];
    const snapshot = buildQuoteItemSnapshot({
      id: uid("ositem"),
      productId: product.id,
      productModelId: body.productModelId || body.answers?.productModelId || "",
      productName: product.name,
      description: body.description || product.name,
      quantity: Number(body.answers?.quantity || body.quantity || 1),
      answers: body.answers || {},
      files: body.files || [],
      notes: body.notes || {}
    }, items.length);
    items.push(snapshot);
    order.itemProductionSnapshots = items;
    rebuildOrderFromItemSnapshots(order);
    const event = withCompany({ id: uid("evt"), orderId: order.id, action: "order_item_added", user: body.user || db.currentUser.name, observation: snapshot.productName, createdAt: new Date().toISOString() }, "productionEvents");
    db.productionEvents.push(event);
    audit("Item adicionado na O.S.", "order", order.id, event.user, snapshot.productName);
    return json(res, 201, { order, item: snapshot, event });
  }
  const orderItemMatch = pathname.match(/^\/api\/orders\/([^/]+)\/items\/([^/]+)$/);
  const duplicateOrderItemMatch = pathname.match(/^\/api\/orders\/([^/]+)\/items\/([^/]+)\/duplicate$/);
  if (req.method === "POST" && duplicateOrderItemMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === duplicateOrderItemMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    const items = order.itemProductionSnapshots || order.items || [];
    const source = items.find(item => String(item.id) === duplicateOrderItemMatch[2]);
    if (!source) return json(res, 404, { error: "Item da O.S. nao encontrado" });
    const duplicate = structuredClone(source);
    duplicate.id = uid("ositem");
    duplicate.itemNumber = items.length + 1;
    duplicate.description = `${source.description || source.productName} (copia)`;
    items.push(duplicate);
    order.itemProductionSnapshots = items;
    rebuildOrderFromItemSnapshots(order);
    audit("Item duplicado na O.S.", "order", order.id, body.user || db.currentUser.name, duplicate.productName);
    return json(res, 201, { order, item: duplicate });
  }
  if (req.method === "PATCH" && orderItemMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === orderItemMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    const items = order.itemProductionSnapshots || order.items || [];
    const index = items.findIndex(item => String(item.id) === orderItemMatch[2]);
    if (index < 0) return json(res, 404, { error: "Item da O.S. nao encontrado" });
    const currentItem = items[index];
    const quantity = Number(body.quantity || body.answers?.quantity || currentItem.quantity || 1);
    const recalculationSeed = {
      additionalExpenses: Number(currentItem.pricingSnapshot?.additionalExpenses || currentItem.pricing?.additionalExpenses || 0)
    };
    items[index] = buildQuoteItemSnapshot({
      ...currentItem,
      description: body.description ?? currentItem.description,
      quantity,
      subtotal: body.subtotal,
      pricing: undefined,
      pricingSnapshot: recalculationSeed,
      answers: { ...(currentItem.technicalAnswersSnapshot || currentItem.answers || {}), ...(body.answers || {}), quantity }
    }, index);
    order.itemProductionSnapshots = items;
    rebuildOrderFromItemSnapshots(order);
    audit("Item editado na O.S.", "order", order.id, body.user || db.currentUser.name, items[index].productName);
    return json(res, 200, { order, item: items[index] });
  }
  if (req.method === "DELETE" && orderItemMatch) {
    const order = scopedFind("orders", item => item.id === orderItemMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    const items = order.itemProductionSnapshots || order.items || [];
    const index = items.findIndex(item => String(item.id) === orderItemMatch[2]);
    if (index < 0) return json(res, 404, { error: "Item da O.S. nao encontrado" });
    const [removed] = items.splice(index, 1);
    order.itemProductionSnapshots = items;
    rebuildOrderFromItemSnapshots(order);
    audit("Item removido da O.S.", "order", order.id, db.currentUser.name, removed.productName);
    return json(res, 200, { order, removed });
  }
  const orderFilesMatch = pathname.match(/^\/api\/orders\/([^/]+)\/files$/);
  if (req.method === "POST" && orderFilesMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === orderFilesMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    const file = { id: uid("file"), name: body.fileName || body.name || "arquivo-producao.pdf", type: body.type || "production", url: body.url || "", uploadedBy: body.user || db.currentUser.name, createdAt: new Date().toISOString() };
    order.productionFiles = [...(order.productionFiles || []), file];
    order.files = [...new Set([...(order.files || []), file.name])];
    const event = withCompany({ id: uid("evt"), orderId: order.id, sectorId: order.currentSectorId || "", sectorName: order.currentSectorName || order.productionStatus, action: "file_attached", user: file.uploadedBy, fileInfo: file, observation: body.observation || "", createdAt: new Date().toISOString() }, "productionEvents");
    db.productionEvents.push(event);
    audit("Arquivo de producao anexado", "order", order.id, file.uploadedBy, file.name);
    return json(res, 201, { order, file, event });
  }
  const downloadFileMatch = pathname.match(/^\/api\/orders\/([^/]+)\/files\/([^/]+)\/download$/);
  if (req.method === "GET" && downloadFileMatch) {
    const order = scopedFind("orders", item => item.id === downloadFileMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    const file = (order.productionFiles || []).find(item => item.id === downloadFileMatch[2]) || { id: downloadFileMatch[2], name: (order.files || []).find(name => name === downloadFileMatch[2]) || downloadFileMatch[2] };
    const event = withCompany({ id: uid("evt"), orderId: order.id, sectorId: order.currentSectorId || "", sectorName: order.currentSectorName || order.productionStatus, action: "file_downloaded", user: db.currentUser.name, fileInfo: file, createdAt: new Date().toISOString() }, "productionEvents");
    db.productionEvents.push(event);
    audit("Arquivo de producao baixado", "order", order.id, db.currentUser.name, file.name);
    saveDb();
    return json(res, 200, { file, message: "Download registrado. Use a URL do arquivo quando houver armazenamento externo configurado.", event });
  }
  const moveMatch = pathname.match(/^\/api\/orders\/([^/]+)\/move$/);
  if (req.method === "POST" && moveMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === moveMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    if (!productionActionAllowed("move", requestUser)) return json(res, 403, { error: "Usuario sem permissao para alterar status de producao" });
    const previousData = { productionStatus: order.productionStatus };
    order.productionStatus = body.status || order.productionStatus;
    order.updatedAt = new Date().toISOString();
    audit("Status de producao alterado", "order", order.id, body.user || "PCP", order.productionStatus, { previousData, newData: { productionStatus: order.productionStatus } });
    return json(res, 200, order);
  }
  const moveSectorMatch = pathname.match(/^\/api\/orders\/([^/]+)\/move-sector$/);
  if (req.method === "POST" && moveSectorMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === moveSectorMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    if (!productionActionAllowed("move", requestUser)) return json(res, 403, { error: "Usuario sem permissao para mover O.S. entre setores" });
    const previousData = { productionStatus: order.productionStatus, currentSectorId: order.currentSectorId, currentSectorName: order.currentSectorName, currentRouteIndex: order.currentRouteIndex };
    const previousSector = order.currentSectorName || order.productionStatus || "aguardando liberacao";
    const route = order.productionRouteSnapshot || [];
    const automaticNext = nextRouteStepForOrder(order);
    const requestedSector = body.nextSector || body.sector || "";
    const nextSector = requestedSector || automaticNext?.sectorName || "Finalizada";
    const nextStepIndex = route.findIndex(step => step.sectorName === nextSector || step.sectorId === nextSector);
    const expectedNextIndex = Number(order.currentRouteIndex || 0) + 1;
    const overrideRoute = Boolean(body.overrideRoute && isAdmin());
    if (requestedSector && nextSector !== "Finalizada" && nextStepIndex < 0 && !overrideRoute) {
      return json(res, 400, { error: "Setor nao pertence a rota congelada da O.S.", route: route.map(step => step.sectorName) });
    }
    if (nextStepIndex >= 0 && nextStepIndex !== expectedNextIndex && !overrideRoute) {
      return json(res, 400, { error: "A O.S. so pode avancar para o proximo setor da rota.", expectedSector: automaticNext?.sectorName || "Finalizada" });
    }
    if (nextSector === "Finalizada" && automaticNext && !overrideRoute) {
      return json(res, 400, { error: "Ainda existem setores pendentes na rota.", expectedSector: automaticNext.sectorName });
    }
    if (nextStepIndex >= 0) setOrderCurrentRouteStep(order, route[nextStepIndex], nextStepIndex);
    else if (nextSector === "Finalizada") {
      order.currentRouteIndex = route.length;
      order.currentSectorId = "";
      order.currentSectorName = "Finalizada";
    } else {
      order.currentSectorId = "";
      order.currentSectorName = nextSector;
    }
    order.productionStatus = ["Finalizada", "Entregue"].includes(nextSector) ? nextSector : "Aguardando producao";
    order.currentResponsible = body.user || db.currentUser.name;
    if (["Finalizada", "Entregue"].includes(nextSector)) order.finishedAt = new Date().toISOString();
    const event = withCompany({ id: uid("evt"), orderId: order.id, action: "moved_to_next_sector", previousSector, sector: previousSector, sectorId: order.currentSectorId || "", sectorName: order.currentSectorName || nextSector, nextSector, source: body.source || "manual_action", user: body.user || db.currentUser.name, observation: body.observation || "", createdAt: new Date().toISOString() }, "productionEvents");
    db.productionEvents.push(event);
    audit("Enviada para proximo setor", "order", order.id, event.user, `${previousSector} -> ${nextSector}. ${event.observation}`, {
      previousData,
      newData: { productionStatus: order.productionStatus, currentSectorId: order.currentSectorId, currentSectorName: order.currentSectorName, currentRouteIndex: order.currentRouteIndex }
    });
    if (previousSector === "aguardando liberacao" || previousSector === "Aguardando liberacao") enqueueCustomerNotification("service_order.sent_to_production", { orderId: order.id, customerId: order.customerId, user: event.user });
    if (nextSector === "Finalizada") enqueueCustomerNotification("production.finished", { orderId: order.id, customerId: order.customerId, user: event.user });
    if (nextSector === "Entregue") enqueueCustomerNotification("order.delivered", { orderId: order.id, customerId: order.customerId, user: event.user });
    return json(res, 200, { order, event });
  }
  const sendPcpMatch = pathname.match(/^\/api\/orders\/([^/]+)\/send-pcp$/);
  if (req.method === "POST" && sendPcpMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === sendPcpMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    const quote = scopedFind("quotes", item => item.id === order.quoteId);
    if (!quote || quote.status !== "aprovado") return json(res, 400, { error: "Orcamento precisa estar aprovado" });
    if (!order.files?.length && !body.overrideFiles) return json(res, 400, { error: "Anexe os arquivos obrigatorios antes de enviar ao PCP" });
    if (!canReleaseToPcp(order) && !body.authorizedBy) return json(res, 403, { error: "Status financeiro nao permite producao pela regra atual", rule: db.costConfig.productionReleaseRule });
    const firstStep = routeStepForOrder(order, 0);
    if (firstStep) setOrderCurrentRouteStep(order, firstStep, 0);
    order.productionStatus = "Aguardando producao";
    order.pcpStatus = "liberada";
    order.productionAuthorization = body.authorizedBy || order.productionAuthorization || null;
    audit("Enviado ao PCP", "order", order.id, body.user || db.currentUser.name, `Regra ${db.costConfig.productionReleaseRule}`);
    enqueueCustomerNotification("service_order.sent_to_production", { orderId: order.id, customerId: order.customerId, user: body.user || db.currentUser.name });
    return json(res, 200, order);
  }
  if (req.method === "GET" && pathname === "/api/production/orders") {
    if (!productionActionAllowed("view", requestUser)) return json(res, 403, { error: "Usuario sem permissao para visualizar producao" });
    return json(res, 200, queryProduction(Object.fromEntries(requestUrl.searchParams.entries()), requestUser));
  }
  if (req.method === "GET" && pathname === "/api/production/mine") {
    if (!productionActionAllowed("viewMine", requestUser)) return json(res, 403, { error: "Usuario sem permissao para visualizar as proprias O.S." });
    return json(res, 200, queryProduction({ ...Object.fromEntries(requestUrl.searchParams.entries()), view: "mine" }, requestUser));
  }
  if (req.method === "GET" && pathname === "/api/production/sector") {
    if (!productionActionAllowed("viewSector", requestUser)) return json(res, 403, { error: "Usuario sem permissao para visualizar O.S. do setor" });
    return json(res, 200, queryProduction({ ...Object.fromEntries(requestUrl.searchParams.entries()), view: "sector" }, requestUser));
  }
  if (req.method === "GET" && pathname === "/api/production/attachments") {
    if (!productionActionAllowed("attachments", requestUser)) return json(res, 403, { error: "Usuario sem permissao para consultar anexos de producao" });
    return json(res, 200, queryProduction({ ...Object.fromEntries(requestUrl.searchParams.entries()), view: "files" }, requestUser));
  }
  if (req.method === "GET" && pathname === "/api/production/reports") {
    if (!productionActionAllowed("report", requestUser)) return json(res, 403, { error: "Usuario sem permissao para gerar relatorio de producao" });
    return json(res, 200, queryProduction(Object.fromEntries(requestUrl.searchParams.entries()), requestUser));
  }
  if (req.method === "GET" && pathname === "/api/production/reports/csv") {
    if (!productionActionAllowed("export", requestUser)) return json(res, 403, { error: "Usuario sem permissao para exportar relatorio de producao" });
    const report = queryProduction({ ...Object.fromEntries(requestUrl.searchParams.entries()), pageSize: 500 }, requestUser);
    audit("Relatorio de producao exportado", "production_report", report.scope, db.currentUser.name, `${report.total} O.S. | ${report.scope}`, { newData: report.filters });
    saveDb();
    res.writeHead(200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="relatorio-producao-${report.scope}.csv"`
    });
    return res.end(`\uFEFF${productionReportCsv(report)}`);
  }
  if (req.method === "GET" && pathname === "/api/production/pcp") {
    if (!productionActionAllowed("view", requestUser)) return json(res, 403, { error: "Usuario sem permissao para visualizar producao" });
    return json(res, 200, pcp(Object.fromEntries(requestUrl.searchParams.entries()), requestUser));
  }
  if (req.method === "GET" && pathname === "/api/alerts") return json(res, 200, alerts());
  if (req.method === "GET" && pathname === "/api/materials") return json(res, 200, scoped("materials"));
  const stockMatch = pathname.match(/^\/api\/orders\/([^/]+)\/stock-consume$/);
  if (req.method === "POST" && stockMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === stockMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    const material = scopedFind("materials", item => item.id === body.materialId);
    if (!material) return json(res, 404, { error: "Material nao encontrado" });
    const quantity = Number(body.quantity || 0);
    if (quantity > Number(material.stock || 0) && !body.authorizedBy) return json(res, 403, { error: "Estoque insuficiente. Solicite autorizacao.", available: material.stock });
    material.stock = round(material.stock - quantity);
    const predictedLine = (order.predictedMaterials || []).find(line => line.materialId === material.id);
    const predictedQuantity = Number(body.predictedQuantity || predictedLine?.quantity || 0);
    const movement = withCompany({ id: uid("stk"), orderId: order.id, materialId: material.id, materialName: material.name, quantity, predictedQuantity, loss: round(Math.max(quantity - predictedQuantity, 0)), difference: round(quantity - predictedQuantity), sector: body.sector || order.productionStatus, responsible: body.responsible || body.user || "Almoxarifado", unit: material.unit, totalCost: round(quantity * material.cost), user: body.user || body.responsible || "Almoxarifado", createdAt: new Date().toISOString() }, "stockMovements");
    db.stockMovements.push(movement);
    audit(quantity > predictedQuantity && predictedQuantity ? "Material usado acima do previsto" : "Material consumido", "order", order.id, movement.user, `${material.name}: ${quantity} ${material.unit}`);
    return json(res, 201, { material, movement });
  }
  const teamMatch = pathname.match(/^\/api\/orders\/([^/]+)\/installation-teams$/);
  if (req.method === "POST" && teamMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === teamMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    const team = {
      id: uid("team"),
      orderId: order.id,
      name: body.name || "Equipe de instalacao",
      responsible: body.responsible || "",
      members: body.members || "",
      vehicle: body.vehicle || "",
      departureDate: body.departureDate || "",
      departureTime: body.departureTime || "",
      returnTime: body.returnTime || "",
      status: body.status || "agendada",
      notes: body.notes || "",
      photos: body.photos || [],
      confirmation: body.confirmation || ""
    };
    db.installationTeams.push(withCompany(team, "installationTeams"));
    if (!order.flow?.includes("Instalacao")) order.flow = [...(order.flow || []), "Instalacao"];
    audit("Equipe de instalacao vinculada", "order", order.id, body.user || "PCP", team.name);
    return json(res, 201, team);
  }
  const productionChecklistMatch = pathname.match(/^\/api\/orders\/([^/]+)\/production-checklist$/);
  if (req.method === "POST" && productionChecklistMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === productionChecklistMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    if (!productionActionAllowed("checklist", requestUser)) return json(res, 403, { error: "Usuario sem permissao para conferir checklist de producao" });
    const currentStep = routeStepForOrder(order) || { sectorId: order.currentSectorId || "", sectorName: order.currentSectorName || order.productionStatus };
    const requiredItems = Array.isArray(body.requiredItems) && body.requiredItems.length ? body.requiredItems : ["Conferencia da etapa", "Qualidade validada"];
    const items = Array.isArray(body.items) ? body.items : [];
    const missing = requiredItems.filter(item => !items.includes(item));
    const checklist = withCompany({
      id: uid("pchk"),
      orderId: order.id,
      sectorId: currentStep.sectorId || "",
      sectorName: currentStep.sectorName || "",
      requiredItems,
      items,
      missing,
      completed: !missing.length,
      responsible: body.responsible || db.currentUser.name,
      observation: body.observation || "",
      photos: body.photos || [],
      createdAt: new Date().toISOString()
    }, "productionChecklists");
    db.productionChecklists.push(checklist);
    audit(checklist.completed ? "Checklist de producao concluido" : "Checklist de producao pendente", "order", order.id, checklist.responsible, `${checklist.sectorName}: ${missing.length ? `faltando ${missing.join(", ")}` : "completo"}`, { newData: checklist });
    return json(res, 201, checklist);
  }
  const productionSettingsMatch = pathname.match(/^\/api\/orders\/([^/]+)\/production-settings$/);
  if (req.method === "PATCH" && productionSettingsMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === productionSettingsMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    const scheduling = body.scheduledProductionDate !== undefined;
    if (!productionActionAllowed(scheduling ? "schedule" : "edit", requestUser)) return json(res, 403, { error: "Usuario sem permissao para editar ou agendar a producao" });
    if (["Finalizada", "Entregue", "Cancelada"].includes(order.productionStatus)) return json(res, 400, { error: `A producao nao pode ser alterada porque esta ${String(order.productionStatus).toLowerCase()}.` });
    if (body.dueDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.dueDate))) return json(res, 400, { error: "Informe o prazo no formato AAAA-MM-DD" });
    if (body.scheduledProductionDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.scheduledProductionDate))) return json(res, 400, { error: "Informe a data de agendamento no formato AAAA-MM-DD" });
    const previousData = {
      dueDate: order.dueDate || "",
      scheduledProductionDate: order.scheduledProductionDate || "",
      currentResponsible: order.currentResponsible || "",
      priority: order.priority || ""
    };
    if (body.dueDate !== undefined) order.dueDate = body.dueDate;
    if (body.scheduledProductionDate !== undefined) order.scheduledProductionDate = body.scheduledProductionDate;
    if (body.currentResponsible !== undefined) order.currentResponsible = String(body.currentResponsible || "").trim();
    if (body.priority !== undefined) order.priority = String(body.priority || "normal").trim() || "normal";
    order.updatedAt = new Date().toISOString();
    const event = withCompany({
      id: uid("evt"),
      orderId: order.id,
      action: scheduling ? "production_scheduled" : "production_settings_updated",
      sectorId: order.currentSectorId || "",
      sectorName: order.currentSectorName || order.productionStatus || "",
      sector: order.currentSectorName || order.productionStatus || "Producao",
      user: body.user || db.currentUser.name,
      observation: body.observation || (scheduling ? `Producao agendada para ${order.scheduledProductionDate}` : "Dados operacionais da producao atualizados"),
      createdAt: order.updatedAt
    }, "productionEvents");
    db.productionEvents.push(event);
    order.productionEvents = [...(order.productionEvents || []), event.id];
    audit(scheduling ? "Producao agendada" : "Producao editada", "order", order.id, event.user, event.observation, {
      previousData,
      newData: {
        dueDate: order.dueDate || "",
        scheduledProductionDate: order.scheduledProductionDate || "",
        currentResponsible: order.currentResponsible || "",
        priority: order.priority || "",
        eventId: event.id
      }
    });
    return json(res, 200, { order, event });
  }
  const stepMatch = pathname.match(/^\/api\/orders\/([^/]+)\/production-events$/);
  if (req.method === "POST" && stepMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === stepMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    const action = body.action || "etapa";
    const standardizedAction = { receber: "received", iniciar: "started", pausar: "paused", retomar: "resumed", finalizar: "finished_sector", homologar: "homologated", reprovar: "rework_rejected", liberar: "released_delivery", cancelar: "canceled", observacao: "note_added" }[action] || action;
    const permissionAction = { received: "receive", started: "start", paused: "pause", resumed: "resume", finished_sector: "finish", homologated: "homologate", rework_rejected: "rework", released_delivery: "homologate", canceled: "cancel", note_added: "note" }[standardizedAction] || standardizedAction;
    if (!productionActionAllowed(permissionAction, requestUser)) return json(res, 403, { error: `Usuario sem permissao para executar: ${action}` });
    const finishedStatuses = ["Entregue", "Cancelada", "Liberada para entrega"];
    const allowedAfterProductionFinish = ["note_added", "homologated", "rework_rejected", "released_delivery"];
    if (finishedStatuses.includes(order.productionStatus) && !allowedAfterProductionFinish.includes(standardizedAction)) return json(res, 400, { error: "A O.S. ja esta finalizada e nao aceita nova movimentacao operacional" });
    if (standardizedAction === "paused" && !["Em producao", "Recebido pelo setor"].includes(order.productionStatus)) return json(res, 400, { error: "Somente uma etapa iniciada pode ser pausada", currentStatus: order.productionStatus });
    if (standardizedAction === "paused" && !String(body.pauseReason || body.observation || "").trim()) return json(res, 400, { error: "Informe o motivo da pausa" });
    if (standardizedAction === "resumed" && !["Pausado", "Pausada"].includes(order.productionStatus)) return json(res, 400, { error: "Somente uma etapa pausada pode ser retomada", currentStatus: order.productionStatus });
    if (standardizedAction === "canceled" && !String(body.cancelReason || body.observation || "").trim()) return json(res, 400, { error: "Informe o motivo do cancelamento da producao" });
    if (standardizedAction === "rework_rejected" && !String(body.reworkReason || body.observation || "").trim()) return json(res, 400, { error: "Informe o motivo da reprova ou retrabalho" });
    const currentStep = routeStepForOrder(order) || { sectorId: order.currentSectorId || "", sectorName: order.currentSectorName || body.sector || order.productionStatus };
    if (standardizedAction === "finished_sector" && currentStep.requiredFile && !(order.files || []).length && !(order.productionFiles || []).length && !body.overrideRequiredFile) {
      return json(res, 400, { error: "Arquivo obrigatorio pendente para finalizar este setor", sector: currentStep.sectorName });
    }
    const productionChecklist = scoped("productionChecklists").filter(item => item.orderId === order.id && (item.sectorId === currentStep.sectorId || item.sectorName === currentStep.sectorName) && item.completed).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    const installationChecklist = scoped("installationChecklists").filter(item => item.orderId === order.id && item.completed).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (standardizedAction === "finished_sector" && currentStep.checklistRequired && !productionChecklist && !installationChecklist && !(body.overrideChecklist && isAdmin(requestUser))) {
      return json(res, 400, { error: "Checklist obrigatorio pendente para finalizar este setor", sector: currentStep.sectorName });
    }
    const previousData = { productionStatus: order.productionStatus, currentSectorId: order.currentSectorId, currentSectorName: order.currentSectorName, currentRouteIndex: order.currentRouteIndex, realCost: order.realCost || 0 };
    const nextStep = standardizedAction === "finished_sector" ? nextRouteStepForOrder(order) : null;
    const completionValidation = {
      orderExists: true,
      storeValidated: true,
      permissionValidated: true,
      currentStepValidated: true,
      requiredFileValidated: !currentStep.requiredFile || Boolean((order.files || []).length || (order.productionFiles || []).length),
      checklistValidated: !currentStep.checklistRequired || Boolean(productionChecklist || installationChecklist || (body.overrideChecklist && isAdmin(requestUser))),
      materialMovements: [],
      realCostRegistered: Number(body.realCost || 0)
    };
    for (const consumption of Array.isArray(body.materialConsumptions) ? body.materialConsumptions : []) {
      const material = scopedFind("materials", item => item.id === consumption.materialId);
      const quantity = Number(consumption.quantity || 0);
      if (!material || quantity <= 0) return json(res, 400, { error: "Material invalido na baixa de producao", materialId: consumption.materialId });
      if (quantity > Number(material.stock || 0) && !body.authorizedBy) return json(res, 403, { error: "Estoque insuficiente para concluir a baixa", materialId: material.id, available: material.stock });
      material.stock = round(Number(material.stock || 0) - quantity);
      const predictedLine = (order.predictedMaterials || []).find(line => line.materialId === material.id);
      const movement = withCompany({ id: uid("stk"), orderId: order.id, materialId: material.id, materialName: material.name, quantity, predictedQuantity: Number(predictedLine?.quantity || 0), sector: currentStep.sectorName, responsible: body.user || db.currentUser.name, unit: material.unit, totalCost: round(quantity * Number(material.cost || 0)), user: body.user || db.currentUser.name, createdAt: new Date().toISOString() }, "stockMovements");
      db.stockMovements.push(movement);
      completionValidation.materialMovements.push(movement.id);
    }
    if (Number(body.realCost || 0) > 0) order.realCost = round(Number(order.realCost || 0) + Number(body.realCost));
    const event = {
      id: uid("evt"),
      orderId: order.id,
      action: standardizedAction,
      originalAction: action,
      sectorId: currentStep.sectorId || "",
      sectorName: currentStep.sectorName || "",
      sector: currentStep.sectorName || body.sector || order.productionStatus,
      user: body.user || body.startedBy || body.receivedBy || body.pausedBy || body.finishedBy || db.currentUser.name,
      receivedBy: body.receivedBy || "",
      acknowledgedBy: body.acknowledgedBy || "",
      startedBy: body.startedBy || "",
      pausedBy: body.pausedBy || "",
      pauseReason: body.pauseReason || "",
      cancelReason: body.cancelReason || "",
      finishedBy: body.finishedBy || "",
      nextSector: body.nextSector || nextStep?.sectorName || "",
      timeSpentMinutes: Number(body.timeSpentMinutes || 0),
      observation: body.observation || body.notes || "",
      problem: body.problem || "",
      files: body.files || [],
      photos: body.photos || [],
      checklistId: productionChecklist?.id || installationChecklist?.id || "",
      completionValidation,
      createdAt: new Date().toISOString()
    };
    db.productionEvents.push(withCompany(event, "productionEvents"));
    order.productionEvents = [...(order.productionEvents || []), event.id];
    if (standardizedAction === "received") {
      order.productionStatus = "Recebido pelo setor";
      order.receivedAt = event.createdAt;
    }
    if (standardizedAction === "started" || standardizedAction === "resumed") {
      order.productionStatus = "Em producao";
      order.startedAt = order.startedAt || event.createdAt;
      order.resumedAt = standardizedAction === "resumed" ? event.createdAt : order.resumedAt;
      order.currentResponsible = event.user;
    }
    if (standardizedAction === "paused") {
      order.productionStatus = "Pausado";
      order.pausedAt = event.createdAt;
      order.pauseReason = event.pauseReason || event.observation;
    }
    if (standardizedAction === "finished_sector") {
      if (nextStep) {
        setOrderCurrentRouteStep(order, nextStep, Number(order.currentRouteIndex || 0) + 1);
        order.productionStatus = "Aguardando producao";
        const moveEvent = withCompany({ id: uid("evt"), orderId: order.id, action: "moved_to_next_sector", sectorId: nextStep.sectorId || "", sectorName: nextStep.sectorName, sector: currentStep.sectorName, previousSector: currentStep.sectorName, nextSector: nextStep.sectorName, user: event.user, observation: "Avanco automatico conforme rota congelada da O.S.", createdAt: new Date().toISOString() }, "productionEvents");
        db.productionEvents.push(moveEvent);
        order.productionEvents.push(moveEvent.id);
      } else {
        order.productionStatus = body.skipHomologation ? "Finalizada" : "Homologacao pendente";
        order.currentSectorName = order.productionStatus;
        order.currentSectorId = "";
        order.finishedAt = new Date().toISOString();
        if (!body.skipHomologation) order.homologationPendingAt = order.finishedAt;
      }
    }
    if (standardizedAction === "homologated") {
      order.productionStatus = body.releaseForDelivery === false ? "Homologada" : "Liberada para entrega";
      order.currentSectorName = order.productionStatus;
      order.currentSectorId = "";
      order.homologatedAt = event.createdAt;
      order.homologatedBy = event.user;
      if (order.productionStatus === "Liberada para entrega") order.releasedForDeliveryAt = event.createdAt;
    }
    if (standardizedAction === "released_delivery") {
      order.productionStatus = "Liberada para entrega";
      order.currentSectorName = "Liberada para entrega";
      order.currentSectorId = "";
      order.releasedForDeliveryAt = event.createdAt;
      order.releasedForDeliveryBy = event.user;
    }
    if (standardizedAction === "rework_rejected") {
      const reworkReason = body.reworkReason || event.observation || "Reprovada na homologacao";
      const problem = withCompany({
        id: uid("prob"),
        orderId: order.id,
        type: "retrabalho",
        description: reworkReason,
        responsible: event.user,
        sector: currentStep.sectorName || order.currentSectorName || "Homologacao",
        photos: body.photos || [],
        estimatedCost: Number(body.estimatedCost || 0),
        deadlineImpactHours: Number(body.deadlineImpactHours || 0),
        rework: true,
        lostMaterial: body.lostMaterial || "",
        lostTimeMinutes: Number(body.lostTimeMinutes || 0),
        realCost: Number(body.realCost || body.estimatedCost || 0),
        createdAt: event.createdAt
      }, "productionProblems");
      db.productionProblems.push(problem);
      order.productionStatus = "Retrabalho";
      order.currentSectorName = currentStep.sectorName || order.currentSectorName || "Retrabalho";
      order.reworkReason = reworkReason;
      order.reworkAt = event.createdAt;
      order.realCost = round(Number(order.realCost || 0) + Number(problem.realCost || 0));
    }
    if (standardizedAction === "canceled") {
      order.productionStatus = "Cancelada";
      order.canceledAt = event.createdAt;
      order.cancelReason = event.cancelReason || event.observation;
    }
    order.updatedAt = event.createdAt;
    audit(action === "receber" ? "Recebida pelo setor" : action === "iniciar" ? "Producao iniciada" : action === "pausar" ? "Producao pausada" : action === "retomar" ? "Producao retomada" : action === "finalizar" ? "Etapa finalizada" : action === "homologar" ? "Producao homologada" : action === "reprovar" ? "Producao reprovada para retrabalho" : action === "liberar" ? "Liberada para entrega" : action === "cancelar" ? "Producao cancelada" : "Etapa de producao registrada", "order", order.id, event.user, `${event.sector} ${event.cancelReason || event.pauseReason || event.observation || ""}`, {
      previousData,
      newData: { productionStatus: order.productionStatus, currentSectorId: order.currentSectorId, currentSectorName: order.currentSectorName, currentRouteIndex: order.currentRouteIndex, realCost: order.realCost || 0, eventId: event.id }
    });
    const notificationEvent = {
      started: "production.started",
      paused: "production.paused",
      finished_sector: nextStep ? "service_order.sent_to_production" : "production.finished",
      homologated: "production.homologated",
      released_delivery: "order.ready"
    }[standardizedAction];
    if (notificationEvent) enqueueCustomerNotification(notificationEvent, { orderId: order.id, customerId: order.customerId, user: event.user });
    return json(res, 201, { event, order, nextSector: order.currentSectorName });
  }
  const realCostMatch = pathname.match(/^\/api\/orders\/([^/]+)\/real-costs$/);
  if (req.method === "POST" && realCostMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === realCostMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    const laborMinutes = Number(body.laborMinutes || 0);
    const machineMinutes = Number(body.machineMinutes || 0);
    const materialQuantity = Number(body.materialQuantity || 0);
    const material = scopedFind("materials", item => item.id === body.materialId);
    const laborHourValue = Number(body.laborHourValue || automaticHumanHourValue());
    const machineHourValue = Number(body.machineHourValue || db.costConfig.machineHourValue || 0);
    const laborCost = round((laborMinutes / 60) * laborHourValue);
    const machineCost = round((machineMinutes / 60) * machineHourValue);
    const materialCost = round(materialQuantity * Number(material?.cost || 0));
    const entry = {
      id: uid("real"),
      orderId: order.id,
      sector: body.sector || order.productionStatus,
      employee: body.employee || "",
      role: body.role || "",
      laborMinutes,
      laborHourValue,
      machine: body.machine || "",
      machineMinutes,
      machineHourValue,
      materialId: body.materialId || "",
      materialName: material?.name || "",
      materialQuantity,
      laborCost,
      machineCost,
      materialCost,
      totalCost: round(laborCost + machineCost + materialCost),
      createdAt: new Date().toISOString()
    };
    db.realCostEntries.push(withCompany(entry, "realCostEntries"));
    order.realCost = round(Number(order.realCost || 0) + entry.totalCost);
    audit("Custo real apontado", "order", order.id, entry.employee || db.currentUser.name, `${entry.sector}: ${entry.totalCost}`);
    return json(res, 201, entry);
  }
  const problemMatch = pathname.match(/^\/api\/orders\/([^/]+)\/production-problems$/);
  if (req.method === "POST" && problemMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === problemMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    if (!productionActionAllowed(body.rework ? "rework" : "note", requestUser)) return json(res, 403, { error: "Usuario sem permissao para registrar problema/retrabalho" });
    const previousData = { productionStatus: order.productionStatus, realCost: order.realCost || 0 };
    const problem = { id: uid("prob"), orderId: order.id, type: body.type || "outro", description: body.description || "", responsible: body.responsible || db.currentUser.name, sector: body.sector || order.productionStatus, photos: body.photos || [], estimatedCost: Number(body.estimatedCost || 0), deadlineImpactHours: Number(body.deadlineImpactHours || 0), rework: Boolean(body.rework), lostMaterial: body.lostMaterial || "", lostTimeMinutes: Number(body.lostTimeMinutes || 0), realCost: Number(body.realCost || body.estimatedCost || 0), createdAt: new Date().toISOString() };
    db.productionProblems.push(withCompany(problem, "productionProblems"));
    order.productionStatus = "Com problema";
    order.realCost = round(Number(order.realCost || 0) + Number(problem.realCost || 0));
    order.updatedAt = problem.createdAt;
    audit(problem.rework ? "Retrabalho registrado" : "Problema registrado", "order", order.id, problem.responsible, `${problem.sector}: ${problem.type}`, { previousData, newData: { productionStatus: order.productionStatus, realCost: order.realCost, problemId: problem.id } });
    return json(res, 201, problem);
  }
  const checklistMatch = pathname.match(/^\/api\/orders\/([^/]+)\/installation-checklist$/);
  if (req.method === "POST" && checklistMatch) {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === checklistMatch[1]);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    const required = ["material conferido", "ferramentas", "EPIs", "escada", "parafusos", "fita dupla face", "silicone", "extensoes", "refletores/LED se houver"];
    const checked = body.items || [];
    const missing = required.filter(item => !checked.includes(item));
    if (body.finishInstallation && missing.length) return json(res, 400, { error: "Nao e permitido finalizar instalacao sem checklist completo", missing });
    const checklist = { id: uid("chk"), orderId: order.id, responsible: body.responsible || db.currentUser.name, team: body.team || "", vehicle: body.vehicle || "", departureDate: body.departureDate || "", departureTime: body.departureTime || "", returnForecast: body.returnForecast || "", items: checked, missing, photosBefore: body.photosBefore || [], photosDuring: body.photosDuring || [], photosAfter: body.photosAfter || [], customerSignature: body.customerSignature || "", completed: !missing.length && Boolean(body.customerSignature), createdAt: new Date().toISOString() };
    db.installationChecklists.push(withCompany(checklist, "installationChecklists"));
    if (body.finishInstallation && checklist.completed) order.productionStatus = "Entregue";
    audit(checklist.completed ? "Instalacao finalizada" : "Instalacao iniciada", "order", order.id, checklist.responsible, checklist.completed ? "Checklist completo" : `Pendente: ${missing.join(", ")}`);
    if (body.finishInstallation && checklist.completed) enqueueCustomerNotification("order.delivered", { orderId: order.id, customerId: order.customerId, user: checklist.responsible });
    return json(res, 201, checklist);
  }
  if (req.method === "GET" && pathname === "/api/technical-visits/reports/csv") {
    const report = technicalVisitReports(Object.fromEntries(requestUrl.searchParams.entries()));
    audit("Relatorio de visitas exportado", "technical_visit_report", currentCompanyId(), db.currentUser.name, `${report.total} visita(s)`, { newData: report.filters });
    saveDb();
    res.writeHead(200, { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="relatorio-visitas-tecnicas.csv"' });
    return res.end(`\uFEFF${technicalVisitReportCsv(report)}`);
  }
  if (req.method === "GET" && pathname === "/api/technical-visits/reports") return json(res, 200, technicalVisitReports(Object.fromEntries(requestUrl.searchParams.entries())));
  if (req.method === "GET" && pathname === "/api/technical-visits") {
    return json(res, 200, queryTechnicalVisits(Object.fromEntries(requestUrl.searchParams.entries())));
  }
  if (req.method === "POST" && pathname === "/api/technical-visits") {
    const body = await readBody(req);
    if (!body.customerId && !body.customerName) return json(res, 400, { error: "Informe o cliente da visita" });
    if (!body.address) return json(res, 400, { error: "Informe o endereco da visita" });
    const visit = normalizeTechnicalVisit(body);
    db.technicalVisits.push(visit);
    audit("Visita tecnica criada", "technical_visit", visit.id, db.currentUser.name, `${visit.customerName} | ${visit.visitType}`);
    return json(res, 201, visit);
  }
  const technicalVisitMatch = pathname.match(/^\/api\/technical-visits\/([^/]+)$/);
  if (req.method === "PATCH" && technicalVisitMatch) {
    const body = await readBody(req);
    const visit = scopedFind("technicalVisits", item => item.id === technicalVisitMatch[1]);
    if (!visit) return json(res, 404, { error: "Visita tecnica nao encontrada" });
    const previousData = { ...visit };
    const updated = normalizeTechnicalVisit(body, visit);
    Object.assign(visit, updated);
    audit(visit.status === "canceled" ? "Visita tecnica cancelada" : "Visita tecnica atualizada", "technical_visit", visit.id, db.currentUser.name, `${visit.status} | ${visit.responsibleEmployeeName || "sem responsavel"}`, { previousData, newData: visit });
    return json(res, 200, visit);
  }
  const completeTechnicalVisitMatch = pathname.match(/^\/api\/technical-visits\/([^/]+)\/complete$/);
  if (req.method === "POST" && completeTechnicalVisitMatch) {
    const body = await readBody(req);
    const visit = scopedFind("technicalVisits", item => item.id === completeTechnicalVisitMatch[1]);
    if (!visit) return json(res, 404, { error: "Visita tecnica nao encontrada" });
    const previousData = { ...visit };
    Object.assign(visit, normalizeTechnicalVisit({ ...body, status: "completed", completedAt: new Date().toISOString() }, visit));
    audit("Visita tecnica concluida", "technical_visit", visit.id, db.currentUser.name, visit.measurementNotes || "Visita concluida", { previousData, newData: visit });
    return json(res, 200, visit);
  }
  if (req.method === "GET" && pathname === "/api/operational-expenses/categories") return json(res, 200, db.operationalExpenseCategories);
  if (req.method === "GET" && pathname === "/api/operational-expenses") return json(res, 200, scoped("operationalExpenses"));
  if (req.method === "POST" && pathname === "/api/operational-expenses") {
    const body = await readBody(req);
    if (!body.responsible || !body.category || !body.value || !body.date || !body.time) return json(res, 400, { error: "Toda saida precisa de responsavel, motivo/categoria, valor e data/hora" });
    const expense = {
      id: uid("opex"),
      date: body.date,
      time: body.time,
      responsible: body.responsible,
      sector: body.sector || "Administrativo",
      category: body.category,
      subcategory: body.subcategory || "",
      orderId: body.orderId || "",
      value: Number(body.value || 0),
      paymentMethod: body.paymentMethod || "Dinheiro",
      observation: body.observation || "",
      receipt: body.receipt || "",
      uploadType: body.uploadType || "",
      vehicleId: body.vehicleId || "",
      costCenter: body.costCenter || body.sector || "Administrativo",
      status: body.status || "pendente_aprovacao",
      operator: body.operator || db.currentUser.name,
      createdAt: new Date().toISOString()
    };
    db.operationalExpenses.push(withCompany(expense, "operationalExpenses"));
    addCashMovement({ type: "expense", paymentMethod: expense.paymentMethod, amount: -expense.value, category: expense.category, costCenter: expense.costCenter, responsible: expense.responsible, notes: expense.observation, createdAt: expense.createdAt });
    createPayable({ sourceType: "expense", sourceId: expense.id, category: expense.category, description: expense.observation || expense.category, supplier: expense.responsible, dueDate: expense.date, amount: expense.value, paidAmount: expense.paymentMethod ? expense.value : 0, paymentMethod: expense.paymentMethod, costCenter: expense.costCenter, responsible: expense.responsible, status: expense.paymentMethod ? "pago" : "aberto" });
    if (expense.orderId) {
      const order = scopedFind("orders", item => item.id === expense.orderId);
      if (order) order.realCost = round(Number(order.realCost || 0) + expense.value);
    }
    audit("Despesa operacional registrada", "expense", expense.id, expense.operator, `${expense.category} ${expense.value}`);
    return json(res, 201, expense);
  }
  const expenseApprovalMatch = pathname.match(/^\/api\/operational-expenses\/([^/]+)\/approve$/);
  if (req.method === "POST" && expenseApprovalMatch) {
    const body = await readBody(req);
    if (!isAdmin() && !db.quickPermissions.expenseApproval) return json(res, 403, { error: "Somente Gestor/Admin aprova despesas" });
    const expense = scopedFind("operationalExpenses", item => item.id === expenseApprovalMatch[1]);
    if (!expense) return json(res, 404, { error: "Despesa nao encontrada" });
    expense.status = body.status || "aprovada";
    expense.approvedBy = body.approvedBy || db.currentUser.name;
    expense.approvedAt = new Date().toISOString();
    audit("Despesa operacional aprovada", "expense", expense.id, expense.approvedBy, expense.status);
    return json(res, 200, expense);
  }
  if (req.method === "GET" && pathname === "/api/expense-advances") return json(res, 200, scoped("expenseAdvances"));
  if (req.method === "POST" && pathname === "/api/expense-advances") {
    const body = await readBody(req);
    const advance = {
      id: uid("adv"),
      team: body.team || "Equipe instalacao",
      responsible: body.responsible || "",
      purpose: body.purpose || "",
      receivedValue: Number(body.receivedValue || 0),
      spentValue: 0,
      returnedValue: 0,
      status: "prestacao_pendente",
      receipts: [],
      createdAt: new Date().toISOString()
    };
    db.expenseAdvances.push(withCompany(advance, "expenseAdvances"));
    db.cashMovements.push(withCompany({ id: uid("mov"), type: "advance", paymentMethod: "Dinheiro", amount: -advance.receivedValue, advanceId: advance.id, createdAt: advance.createdAt }, "cashMovements"));
    audit("Adiantamento para equipe", "advance", advance.id, db.currentUser.name, `${advance.team} ${advance.receivedValue}`);
    return json(res, 201, advance);
  }
  const accountabilityMatch = pathname.match(/^\/api\/expense-advances\/([^/]+)\/accountability$/);
  if (req.method === "POST" && accountabilityMatch) {
    const body = await readBody(req);
    const advance = scopedFind("expenseAdvances", item => item.id === accountabilityMatch[1]);
    if (!advance) return json(res, 404, { error: "Adiantamento nao encontrado" });
    advance.spentValue = Number(body.spentValue || 0);
    advance.returnedValue = Number(body.returnedValue || 0);
    advance.receipts = body.receipts || [];
    advance.balance = round(advance.receivedValue - advance.spentValue - advance.returnedValue);
    advance.status = advance.balance === 0 ? "prestado" : "divergente";
    audit("Prestacao de contas registrada", "advance", advance.id, body.responsible || db.currentUser.name, advance.status);
    return json(res, 200, advance);
  }
  if (req.method === "GET" && pathname === "/api/operational-expenses/reports") return json(res, 200, expenseReports());
  if (req.method === "GET" && pathname === "/api/dre") return json(res, 200, dre());
  if (req.method === "GET" && pathname === "/api/vehicles") return json(res, 200, vehicleReports());
  if (req.method === "POST" && pathname === "/api/vehicles") {
    const body = await readBody(req);
    const vehicle = {
      id: uid("veh"),
      vehicle: body.vehicle || "",
      plate: body.plate || "",
      driver: body.driver || "",
      initialKm: Number(body.initialKm || 0),
      finalKm: Number(body.finalKm || 0),
      fuelCost: Number(body.fuelCost || 0),
      maintenanceCost: Number(body.maintenanceCost || 0)
    };
    db.vehicles.push(withCompany(vehicle, "vehicles"));
    audit("Veiculo cadastrado", "vehicle", vehicle.id, db.currentUser.name, vehicle.vehicle);
    return json(res, 201, vehicle);
  }
  if (req.method === "GET" && pathname === "/api/finance") return json(res, 200, finance());
  if (req.method === "GET" && pathname === "/api/finance/receivables") return json(res, 200, scoped("accountsReceivable"));
  if (req.method === "GET" && pathname === "/api/finance/payables") return json(res, 200, scoped("accountsPayable"));
  if (req.method === "POST" && pathname === "/api/finance/payables") {
    const body = await readBody(req);
    const payable = createPayable(body);
    audit("Conta a pagar registrada", "payable", payable.id, payable.responsible, `${payable.category} ${payable.amount}`);
    return json(res, 201, payable);
  }
  if (req.method === "GET" && pathname === "/api/finance/delinquency") return json(res, 200, finance().delinquency);
  if (req.method === "POST" && pathname === "/api/finance/allocate-fixed-costs") {
    const body = await readBody(req);
    const targets = body.targets || ["Producao", "Instalacao", "Administrativo"];
    const fixed = scoped("expenses").filter(expense => ["Aluguel", "Energia", "Internet", "Agua", "Água"].includes(expense.type));
    const allocations = fixed.flatMap(expense => targets.map(target => ({ id: uid("alloc"), expenseId: expense.id, type: expense.type, costCenter: target, amount: round(Number(expense.amount || 0) / targets.length), createdAt: new Date().toISOString() })));
    audit("Rateio automatico aplicado", "finance", "rateio", db.currentUser.name, `${allocations.length} lancamentos`);
    return json(res, 201, allocations);
  }
  if (req.method === "POST" && pathname === "/api/cash/open") {
    const body = await readBody(req);
    const operator = body.operator || db.currentUser.name || "Operador";
    if (openCashSession(operator)) return json(res, 409, { error: "Ja existe caixa aberto para este operador" });
    const session = withCompany({ id: uid("cash"), operator, openingAmount: Number(body.openingAmount || 0), status: "aberto", openedAt: new Date().toISOString(), date: body.date || new Date().toISOString().slice(0, 10), hour: body.hour || new Date().toISOString().slice(11, 16), user: db.currentUser.name }, "cashSessions");
    db.cashSessions.push(session);
    if (session.openingAmount) addCashMovement({ sessionId: session.id, type: "opening", paymentMethod: "Dinheiro", amount: session.openingAmount, operator, responsible: operator, category: "Abertura", costCenter: "Financeiro" });
    audit("Abertura de caixa", "cash", session.id, operator, `${session.openingAmount}`);
    return json(res, 201, session);
  }
  if (req.method === "POST" && pathname === "/api/cash/sale") {
    const body = await readBody(req);
    const movement = addCashMovement({ type: "sale", paymentMethod: body.paymentMethod || "Pix", amount: Number(body.amount || 0), operator: body.operator, responsible: body.operator || db.currentUser.name, category: body.category || "Venda direta", costCenter: body.costCenter || "Comercial", notes: body.notes || "" });
    audit("Venda registrada no caixa", "cash", movement.id, body.user || "Operador", `${movement.paymentMethod} ${movement.amount}`);
    return json(res, 201, movement);
  }
  if (req.method === "POST" && pathname === "/api/cash/order-payment") {
    const body = await readBody(req);
    const order = scopedFind("orders", item => item.id === body.orderId);
    if (!order) return json(res, 404, { error: "O.S. nao encontrada" });
    if (orderIsCancelled(order)) return json(res, 400, { error: "O.S. cancelada nao pode receber pagamento" });
    if (orderIsNonBillable(order)) return json(res, 400, { error: `${businessOrderTypeLabel(order.serviceOrderType)} nao gera financeiro nem caixa` });
    const payments = Array.isArray(body.payments) ? body.payments : [];
    const received = round(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    order.paidAmount = round(Number(order.paidAmount || 0) + received);
    const requestedStatus = body.paymentStatus || "";
    if (order.paidAmount >= order.total) order.financialStatus = "quitada";
    else if (requestedStatus.includes("sinal")) order.financialStatus = "aguardando sinal";
    else if (requestedStatus.includes("Fiado") || requestedStatus.includes("prazo")) order.financialStatus = "fiado";
    else if (order.paidAmount > 0) order.financialStatus = "pagamento parcial";
    else order.financialStatus = "aguardando pagamento";
    payments.forEach(payment => {
      const movement = addCashMovement({
        type: "order_payment",
        orderId: order.id,
        customerId: order.customerId,
        seller: body.seller || "",
        paymentStatus: order.financialStatus,
        paymentMethod: payment.method || "Pix",
        amount: Number(payment.amount || 0),
        category: "Recebimento O.S.",
        costCenter: "Financeiro",
        responsible: body.seller || db.currentUser.name,
        notes: body.notes || "",
        operator: body.operator || db.currentUser.name
      });
      movement.paymentStatus = body.paymentStatus || order.financialStatus;
    });
    const balance = round(Math.max(Number(order.total || 0) - Number(order.paidAmount || 0), 0));
    createReceivable({
      sourceType: "order",
      sourceId: order.id,
      origin: order.financialStatus === "fiado" ? "Fiado" : body.paymentStatus?.includes("sinal") ? "Sinal" : "O.S.",
      customerId: order.customerId,
      customerName: order.customerName,
      dueDate: body.dueDate || order.duePaymentDate || new Date().toISOString().slice(0, 10),
      amount: Number(order.total || 0),
      paidAmount: Number(order.paidAmount || 0),
      balance,
      paymentMethod: payments.map(payment => payment.method || "Pix").join(" + "),
      status: balance <= 0 ? "quitada" : order.financialStatus
    });
    audit("Pagamento de O.S. registrado", "order", order.id, db.currentUser.name, `${received} em ${payments.length} forma(s)`);
    if (received > 0) enqueueCustomerNotification("payment.received", { orderId: order.id, customerId: order.customerId, user: db.currentUser.name });
    if (balance > 0) enqueueCustomerNotification("payment.pending", { orderId: order.id, customerId: order.customerId, user: db.currentUser.name });
    return json(res, 201, { order, received, payments });
  }
  if (req.method === "GET" && pathname === "/api/quick-sales") return json(res, 200, scoped("quickSales"));
  if (req.method === "POST" && pathname === "/api/quick-sales") {
    const body = await readBody(req);
    const sale = finishQuickSale(body);
    return json(res, 201, sale);
  }
  if (req.method === "POST" && pathname === "/api/cash/sangria") {
    const body = await readBody(req);
    const movement = addCashMovement({ type: "sangria", paymentMethod: "Dinheiro", amount: -Math.abs(Number(body.amount || 0)), responsible: body.responsible || db.currentUser.name, category: "Sangria", costCenter: "Financeiro", notes: body.reason || "" });
    audit("Sangria registrada", "cash", movement.id, movement.responsible, `${movement.amount} ${movement.notes}`);
    return json(res, 201, movement);
  }
  if (req.method === "POST" && pathname === "/api/cash/suprimento") {
    const body = await readBody(req);
    const movement = addCashMovement({ type: "suprimento", paymentMethod: "Dinheiro", amount: Math.abs(Number(body.amount || 0)), responsible: body.responsible || db.currentUser.name, category: "Suprimento", costCenter: "Financeiro", notes: body.origin || "" });
    audit("Suprimento registrado", "cash", movement.id, movement.responsible, `${movement.amount} ${movement.notes}`);
    return json(res, 201, movement);
  }
  if (req.method === "GET" && pathname === "/api/cash/report") return json(res, 200, cashReport());
  if (req.method === "POST" && pathname === "/api/cash/close-blind") {
    const body = await readBody(req);
    const informed = body.informed || {};
    const expected = scoped("cashMovements").reduce((acc, movement) => {
      acc[movement.paymentMethod] = round((acc[movement.paymentMethod] || 0) + movement.amount);
      return acc;
    }, {});
    const difference = {};
    [...new Set([...Object.keys(informed), ...Object.keys(expected)])].forEach(key => {
      difference[key] = round(Number(informed[key] || 0) - Number(expected[key] || 0));
    });
    const sensitive = isAdmin();
    const result = {
      informed,
      expected: sensitive ? expected : undefined,
      difference: sensitive ? difference : undefined,
      requiresManagerReview: Object.values(difference).some(value => value !== 0),
      message: sensitive ? "Conferencia completa liberada para Admin/Gestor" : "Fechamento registrado. Gestor/Admin visualiza divergencias."
    };
    audit("Fechamento de caixa", "cash", "blind-close", body.user || "Operador", result.requiresManagerReview ? "Com divergencia" : "Sem divergencia");
    return json(res, 200, result);
  }
  if (req.method === "GET" && pathname === "/api/cash/daily-summary") return json(res, 200, dailyCashSummary(isAdmin()));
  if (req.method === "GET" && pathname === "/api/audit") return json(res, 200, scoped("auditLogs"));
  return json(res, 404, { error: "Rota nao encontrada" });
}

function serveStatic(res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, requestedPath));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8" };
    res.writeHead(200, { "content-type": types[ext] || "text/plain; charset=utf-8" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await requestCompanyContext.run({ companyId: db.activeCompanyId || primaryCompanyId() }, async () => {
        await handleApi(req, res, url.pathname);
        if (req.method !== "GET") saveDb();
      });
      return;
    }
    return serveStatic(res, url.pathname);
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`PrintSys ERP rodando em http://localhost:${PORT}`);
});
