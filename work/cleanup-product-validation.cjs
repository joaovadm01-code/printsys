const fs = require("fs");

const file = "data/printsys-data.json";
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const productIds = new Set(["p-20138"]);
const quoteIds = new Set(["q-52935"]);
const orderIds = new Set(["OS-1065"]);

for (const product of data.products || []) {
  if (product.name === "Produto Homologacao Codex Copia" && String(product.code || "").startsWith("QA-1781705808004")) {
    productIds.add(product.id);
  }
}

data.products = (data.products || []).filter(product => !productIds.has(product.id));
data.quotes = (data.quotes || []).filter(quote => !quoteIds.has(quote.id));
data.orders = (data.orders || []).filter(order => !orderIds.has(order.id));
data.productionEvents = (data.productionEvents || []).filter(event => !orderIds.has(event.orderId));
data.cashMovements = (data.cashMovements || []).filter(movement => !orderIds.has(movement.orderId) && !quoteIds.has(movement.quoteId));
data.auditLogs = (data.auditLogs || []).filter(log => {
  if (productIds.has(log.entityId) || quoteIds.has(log.entityId) || orderIds.has(log.entityId)) return false;
  const text = JSON.stringify([log.details, log.previousData, log.newData]);
  return ![...productIds, ...quoteIds, ...orderIds].some(id => text.includes(id));
});

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log(JSON.stringify({
  removedProducts: [...productIds],
  removedQuotes: [...quoteIds],
  removedOrders: [...orderIds]
}, null, 2));
