const API_BASE_URL = "http://127.0.0.1:8001";
const storageKeys = {
  all: "expenseTrackerAllRows",
  filtered: "expenseTrackerFilteredRows"
};

const sampleTransactions = [
  { date: "2026-03-01", description: "Metro Supermarket", category: "Groceries", type: "debit", amount: 3280.5 },
  { date: "2026-03-02", description: "Salary Credit", category: "Income", type: "credit", amount: 78500 },
  { date: "2026-03-03", description: "Fuel Station", category: "Transport", type: "debit", amount: 2500 },
  { date: "2026-03-05", description: "Cloud Kitchen Dinner", category: "Food", type: "debit", amount: 890 },
  { date: "2026-03-08", description: "Electricity Bill", category: "Bills", type: "debit", amount: 4160 },
  { date: "2026-03-09", description: "Freelance Project", category: "Income", type: "credit", amount: 18500 },
  { date: "2026-03-10", description: "Pharmacy", category: "Health", type: "debit", amount: 1480 },
  { date: "2026-03-12", description: "Streaming Subscription", category: "Entertainment", type: "debit", amount: 499 },
  { date: "2026-03-14", description: "Airport Cab", category: "Transport", type: "debit", amount: 1280 }
];

let transactions = loadRows(storageKeys.all, sampleTransactions);
let filteredTransactions = [...transactions];

const elements = {
  body: document.querySelector("#transactionBody"),
  search: document.querySelector("#searchInput"),
  type: document.querySelector("#typeFilter"),
  category: document.querySelector("#categoryFilter"),
  visibleTotal: document.querySelector("#visibleTotal"),
  creditTotal: document.querySelector("#creditTotal"),
  debitTotal: document.querySelector("#debitTotal"),
  largestExpense: document.querySelector("#largestExpense"),
  largestExpenseLabel: document.querySelector("#largestExpenseLabel"),
  visibleCount: document.querySelector("#visibleCount"),
  importStatus: document.querySelector("#importStatus"),
  importMeta: document.querySelector("#importMeta"),
  importPreview: document.querySelector("#importPreview"),
  pdfUpload: document.querySelector("#pdfUpload"),
  showCharts: document.querySelector("#showCharts"),
  resetFilters: document.querySelector("#resetFilters"),
  addRow: document.querySelector("#addRow"),
  emptyTemplate: document.querySelector("#emptyStateTemplate")
};

init();

async function init() {
  populateCategories();
  applyFilters();
  wireEvents();
  await checkBackendHealth();
}

function wireEvents() {
  elements.search.addEventListener("input", applyFilters);
  elements.type.addEventListener("change", applyFilters);
  elements.category.addEventListener("change", applyFilters);
  elements.resetFilters.addEventListener("click", resetFilters);
  elements.showCharts.addEventListener("click", openCharts);
  elements.addRow.addEventListener("click", addManualRow);
  elements.pdfUpload.addEventListener("change", handlePdfUpload);
}

function loadRows(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(saved) && saved.length ? saved : fallback;
  } catch {
    return fallback;
  }
}

function saveRows() {
  localStorage.setItem(storageKeys.all, JSON.stringify(transactions));
  localStorage.setItem(storageKeys.filtered, JSON.stringify(filteredTransactions));
}

function setStatus(message, meta = "") {
  elements.importStatus.textContent = message;
  elements.importMeta.textContent = meta || "Waiting for next upload";
}

function setPreview(content) {
  elements.importPreview.value = content;
}

async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    setStatus("Backend connected. You can upload one or more PDFs.", API_BASE_URL);
  } catch {
    setStatus("Backend not reachable. Start start_backend.bat before importing PDFs.", API_BASE_URL);
  }
}

function populateCategories() {
  const categories = [...new Set(transactions.map((row) => row.category).filter(Boolean))].sort();
  const current = elements.category.value;
  elements.category.innerHTML = '<option value="all">All categories</option>';

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.category.appendChild(option);
  });

  if (categories.includes(current)) {
    elements.category.value = current;
  }
}

function applyFilters() {
  const searchValue = elements.search.value.trim().toLowerCase();
  const typeValue = elements.type.value;
  const categoryValue = elements.category.value;

  filteredTransactions = transactions.filter((row) => {
    const haystack = [row.date, row.description, row.category, row.type, row.amount]
      .join(" ")
      .toLowerCase();

    return (!searchValue || haystack.includes(searchValue))
      && (typeValue === "all" || row.type === typeValue)
      && (categoryValue === "all" || row.category === categoryValue);
  });

  renderTable();
  updateStats();
  saveRows();
}

function renderTable() {
  elements.body.innerHTML = "";

  if (!filteredTransactions.length) {
    elements.body.appendChild(elements.emptyTemplate.content.cloneNode(true));
    return;
  }

  filteredTransactions.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${escapeHtml(row.date)}</td>
      <td>${escapeHtml(row.description)}</td>
      <td>${escapeHtml(row.category)}</td>
      <td><span class="pill ${row.type}">${capitalize(row.type)}</span></td>
      <td class="mono amount ${row.type}">${formatCurrency(row.amount)}</td>
    `;
    elements.body.appendChild(tr);
  });
}

function updateStats() {
  const debitRows = filteredTransactions.filter((row) => row.type === "debit");
  const creditRows = filteredTransactions.filter((row) => row.type === "credit");
  const debitTotal = sumAmounts(debitRows);
  const creditTotal = sumAmounts(creditRows);
  const visibleTotal = creditTotal - debitTotal;
  const largestDebit = [...debitRows].sort((a, b) => b.amount - a.amount)[0];

  elements.visibleTotal.textContent = formatCurrency(visibleTotal);
  elements.creditTotal.textContent = formatCurrency(creditTotal);
  elements.debitTotal.textContent = formatCurrency(debitTotal);
  elements.visibleCount.textContent = `${filteredTransactions.length} transactions visible`;
  elements.largestExpense.textContent = formatCurrency(largestDebit?.amount || 0);
  elements.largestExpenseLabel.textContent = largestDebit ? largestDebit.description : "No debit selected";
}

function sumAmounts(rows) {
  return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

function resetFilters() {
  elements.search.value = "";
  elements.type.value = "all";
  elements.category.value = "all";
  applyFilters();
}

function openCharts() {
  localStorage.setItem(storageKeys.filtered, JSON.stringify(filteredTransactions));
  window.open("./charts.html", "_blank", "noopener");
}

function addManualRow() {
  const date = window.prompt("Date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
  if (!date) {
    return;
  }

  const description = window.prompt("Description", "Manual entry");
  if (!description) {
    return;
  }

  const category = window.prompt("Category", "Uncategorized") || "Uncategorized";
  const typeInput = (window.prompt("Type: debit or credit", "debit") || "debit").toLowerCase();
  const amountInput = window.prompt("Amount", "0");
  const amount = Number.parseFloat(amountInput || "0");
  const type = typeInput === "credit" ? "credit" : "debit";

  if (!Number.isFinite(amount)) {
    setStatus("Manual row not added because amount was invalid.", "Invalid amount");
    return;
  }

  transactions.unshift({ date, description, category, type, amount });
  populateCategories();
  applyFilters();
  setStatus("Manual transaction added.", `Rows: ${transactions.length}`);
}

async function handlePdfUpload(event) {
  const files = [...(event.target.files || [])];
  if (!files.length) {
    setStatus("No file selected.");
    return;
  }

  setStatus(`Uploading ${files.length} file(s) to the backend parser...`, files.map((file) => file.name).join(", "));
  setPreview(`Selected ${files.length} file(s):\n${files.map((file) => `- ${file.name}`).join("\n")}`);

  try {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const response = await fetch(`${API_BASE_URL}/api/parse-statements`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Backend returned HTTP ${response.status}`);
    }

    const result = await response.json();
    transactions = result.transactions.map(normalizeTransaction);
    populateCategories();
    applyFilters();

    const fileSummaries = result.files.map((file) => {
      return [
        `File: ${file.filename}`,
        `Bank: ${file.bank}`,
        `Pages: ${file.pages}`,
        `Characters extracted: ${file.characters_extracted}`,
        `Transactions parsed: ${file.transactions.length}`,
        "Preview:",
        file.preview.slice(0, 2500)
      ].join("\n");
    });

    setPreview(fileSummaries.join("\n\n------------------------------\n\n"));
    setStatus(`Imported ${result.total_transactions} transactions from ${result.files.length} file(s).`, `Last file: ${result.files.at(-1)?.filename || "n/a"}`);
  } catch (error) {
    setStatus(`PDF import failed: ${error.message}`, API_BASE_URL);
    setPreview(`Backend request failed.\n\n${error.stack || error.message}\n\nMake sure start_backend.bat is running.`);
  } finally {
    event.target.value = "";
  }
}

function normalizeTransaction(row) {
  return {
    date: row.date || "",
    description: row.description || "Imported transaction",
    category: row.category || "Uncategorized",
    type: row.type === "credit" ? "credit" : "debit",
    amount: Number(row.amount || 0)
  };
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

function capitalize(value = "") {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
