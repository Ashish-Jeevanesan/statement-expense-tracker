const filteredRows = loadRows("expenseTrackerFilteredRows");
const allRows = loadRows("expenseTrackerAllRows");
const rows = filteredRows.length ? filteredRows : allRows;

const categoryBars = document.querySelector("#categoryBars");
const dailyBars = document.querySelector("#dailyBars");
const chartLegend = document.querySelector("#chartLegend");
const chartSummary = document.querySelector("#chartSummary");
const typeDonut = document.querySelector("#typeDonut");
const donutCenter = document.querySelector("#donutCenter");

renderCharts();

function loadRows(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function renderCharts() {
  chartSummary.textContent = `${rows.length} rows loaded`;

  if (!rows.length) {
    categoryBars.innerHTML = '<p class="empty-state">No transaction data available.</p>';
    dailyBars.innerHTML = "";
    chartLegend.innerHTML = "";
    typeDonut.style.setProperty("--angle", "0deg");
    donutCenter.textContent = formatCurrency(0);
    return;
  }

  renderCategoryBars();
  renderDailyBars();
  renderTypeDonut();
}

function renderCategoryBars() {
  const grouped = groupBy(rows.filter((row) => row.type === "debit"), "category");
  const entries = Object.entries(grouped)
    .map(([label, items]) => ({ label, total: sum(items) }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  const max = Math.max(...entries.map((entry) => Math.abs(entry.total)), 1);
  categoryBars.innerHTML = entries.map((entry) => `
    <div class="bar-row">
      <div class="bar-meta">
        <strong>${escapeHtml(entry.label)}</strong>
        <span>${formatCurrency(entry.total)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(Math.abs(entry.total) / max) * 100}%"></div>
      </div>
    </div>
  `).join("");
}

function renderDailyBars() {
  const grouped = groupBy(rows, "date");
  const entries = Object.entries(grouped)
    .map(([label, items]) => ({ label, total: sum(items) }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-7);

  const max = Math.max(...entries.map((entry) => Math.abs(entry.total)), 1);
  dailyBars.innerHTML = entries.map((entry) => `
    <div class="bar-row">
      <div class="bar-meta">
        <strong>${escapeHtml(entry.label)}</strong>
        <span>${formatCurrency(entry.total)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(Math.abs(entry.total) / max) * 100}%"></div>
      </div>
    </div>
  `).join("");
}

function renderTypeDonut() {
  const debit = Math.abs(sum(rows.filter((row) => row.type === "debit")));
  const credit = Math.abs(sum(rows.filter((row) => row.type === "credit")));
  const totalMovement = debit + credit;
  const angle = totalMovement ? `${(debit / totalMovement) * 360}deg` : "0deg";
  const visibleTotal = credit - debit;

  typeDonut.style.setProperty("--angle", angle);
  donutCenter.textContent = formatCurrency(visibleTotal);
  chartLegend.innerHTML = `
    ${legendRow("Debit", -debit, "var(--debit)")}
    ${legendRow("Credit", credit, "var(--credit)")}
    ${legendRow("Net Visible Total", visibleTotal, "var(--accent)")}
  `;
}

function legendRow(label, value, color) {
  return `
    <div class="legend-row">
      <div class="legend-label">
        <span class="legend-swatch" style="background:${color}"></span>
        <strong>${escapeHtml(label)}</strong>
      </div>
      <span>${formatCurrency(value)}</span>
    </div>
  `;
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const group = item[key] || "Unknown";
    acc[group] = acc[group] || [];
    acc[group].push(item);
    return acc;
  }, {});
}

function sum(items) {
  return items.reduce((total, item) => {
    const signedAmount = item.type === "credit" ? Number(item.amount || 0) : -Number(item.amount || 0);
    return total + signedAmount;
  }, 0);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount || 0);
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
