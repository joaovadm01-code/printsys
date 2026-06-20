const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function formatDate(value = "") {
  if (!value) return "A combinar";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

async function fetchTracking(params) {
  const response = await fetch(`/api/customer-tracking?${params.toString()}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Nao foi possivel consultar seus pedidos.");
  return data;
}

function renderTracking(data) {
  const results = document.getElementById("tracking-results");
  const orderCards = (data.orders || []).map(order => `
    <article class="tracking-order-card">
      <div class="root-block-heading">
        <h2>${escapeHtml(order.id)} - ${escapeHtml(order.jobName || "Servico grafico")}</h2>
        <span class="status-pill production">${escapeHtml(order.status || "Aguardando")}</span>
      </div>
      <div class="root-info-grid">
        <div><span>Prazo previsto</span><b>${escapeHtml(formatDate(order.estimatedDelivery))}</b></div>
        <div><span>Etapa atual</span><b>${escapeHtml(order.productionStage || order.status || "-")}</b></div>
        <div><span>Financeiro</span><b>${escapeHtml(order.paymentStatus || "-")}</b></div>
        <div><span>Saldo</span><b>${money.format(order.payments?.balance || 0)}</b></div>
      </div>
      <div class="focused-data-table">
        <table><thead><tr><th>Item</th><th>Medida</th><th>Qtd.</th><th>Status</th></tr></thead><tbody>
          ${(order.items || []).map(item => `<tr><td>${escapeHtml(item.description || "Servico")}</td><td>${escapeHtml(item.measures || "-")}</td><td>${Number(item.quantity || 1)}</td><td>${escapeHtml(item.status || order.status || "-")}</td></tr>`).join("") || `<tr><td colspan="4">Itens em conferencia.</td></tr>`}
        </tbody></table>
      </div>
    </article>
  `).join("");
  const quoteCards = (data.quotes || []).map(quote => `
    <article class="tracking-order-card">
      <div class="root-block-heading">
        <h2>${escapeHtml(quote.quoteNumber || quote.id)} - ${escapeHtml(quote.jobName || "Orcamento")}</h2>
        <span class="status-pill finance">${escapeHtml(quote.status || "Rascunho")}</span>
      </div>
      <div class="root-info-grid">
        <div><span>Data</span><b>${escapeHtml(formatDate(quote.createdAt))}</b></div>
        <div><span>Valor</span><b>${money.format(quote.total || 0)}</b></div>
        <div><span>Aprovacao</span><b>${escapeHtml(quote.approvalStatus || "-")}</b></div>
      </div>
    </article>
  `).join("");
  results.innerHTML = `
    <section class="tracking-card">
      <div class="root-block-heading">
        <h2>${escapeHtml(data.customer?.name || "Cliente")}</h2>
        ${data.company?.contactLink ? `<a class="button-like primary" href="${escapeHtml(data.company.contactLink)}" target="_blank" rel="noopener">Falar com ${escapeHtml(data.company.name || "empresa")}</a>` : ""}
      </div>
      <p>Dados exibidos com seguranca: status, prazos, itens e pagamentos. Informacoes internas de custo nao aparecem aqui.</p>
    </section>
    ${quoteCards || ""}
    ${orderCards || ""}
    ${!quoteCards && !orderCards ? `<section class="tracking-card"><b>Nenhum pedido encontrado.</b><p>Confira os dados informados ou fale com a empresa.</p></section>` : ""}
  `;
}

async function submitTracking(event) {
  event?.preventDefault();
  const message = document.getElementById("tracking-message");
  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  if (!token) {
    params.set("document", document.getElementById("tracking-document").value.trim());
    params.set("whatsapp", document.getElementById("tracking-whatsapp").value.trim());
  }
  message.textContent = "Consultando...";
  try {
    const data = await fetchTracking(params);
    renderTracking(data);
    message.textContent = "";
  } catch (error) {
    document.getElementById("tracking-results").innerHTML = "";
    message.textContent = error.message;
  }
}

document.getElementById("tracking-form").addEventListener("submit", submitTracking);
if (new URLSearchParams(location.search).get("token")) submitTracking();
