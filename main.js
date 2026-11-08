import {
  applyFilters,
  formatMoney,
  listCategories,
  listMonths,
  rows,
  summarize,
} from "./sample-report.js";
import { validateQuote } from "./quote-form.js";

const monthSelect = document.getElementById("month");
const categorySelect = document.getElementById("category");
const kindSelect = document.getElementById("kind");
const resetButton = document.getElementById("reset-filters");
const totals = document.getElementById("totals");
const recon = document.getElementById("recon");
const fullLedger = document.getElementById("full-ledger");
const categoryList = document.getElementById("categories");
const emptyCategories = document.getElementById("empty-categories");
const lineBody = document.getElementById("line-body");
const lineTable = document.getElementById("line-table");
const emptyLines = document.getElementById("empty-lines");
const form = document.getElementById("quote-form");
const formStatus = document.getElementById("form-status");
const submitButton = document.getElementById("quote-submit");

const quoteFields = ["name", "email", "service", "message"];

function addOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function kindLabel(kind) {
  return kind === "revenue" ? "Revenue" : "Expense";
}

function renderCategories(summary) {
  categoryList.replaceChildren();
  emptyCategories.hidden = summary.categoryTotals.length !== 0;
  if (summary.categoryTotals.length === 0) return;

  const max = Math.max(...summary.categoryTotals.map((item) => item.amount));
  for (const item of summary.categoryTotals) {
    const li = document.createElement("li");
    const top = document.createElement("div");
    top.className = "cat-top";

    const name = document.createElement("span");
    name.textContent = item.category;
    const meta = document.createElement("span");
    meta.textContent = `${kindLabel(item.kind)} · ${item.count} line${item.count === 1 ? "" : "s"}`;
    const amount = document.createElement("span");
    amount.className = "num";
    amount.textContent = formatMoney(item.amount);

    top.append(name, meta, amount);

    const meter = document.createElement("meter");
    meter.min = 0;
    meter.max = Math.max(max, 1);
    meter.value = item.amount;
    meter.textContent = formatMoney(item.amount);
    meter.setAttribute("aria-label", `${item.category}, ${kindLabel(item.kind)}, ${formatMoney(item.amount)}`);

    li.append(top, meter);
    li.dataset.amount = String(item.amount);
    li.dataset.category = item.category;
    categoryList.append(li);
  }
}

function renderLines(filtered) {
  lineBody.replaceChildren();
  const hasRows = filtered.length > 0;
  lineTable.hidden = !hasRows;
  emptyLines.hidden = hasRows;

  for (const row of filtered) {
    const tr = document.createElement("tr");
    const cells = [
      ["Month", row.monthLabel],
      ["Type", kindLabel(row.kind)],
      ["Category", row.category],
      ["Memo", row.memo],
      ["Amount", formatMoney(row.kind === "expense" ? -row.amount : row.amount)],
    ];
    for (const [label, value] of cells) {
      const td = document.createElement("td");
      td.dataset.label = label;
      td.textContent = value;
      if (label === "Amount") td.className = "num";
      tr.append(td);
    }
    lineBody.append(tr);
  }
}

function render() {
  const filtered = applyFilters(rows, {
    month: monthSelect.value,
    category: categorySelect.value,
    kind: kindSelect.value,
  });
  const summary = summarize(filtered);
  document.getElementById("total-revenue").textContent = formatMoney(summary.revenue);
  document.getElementById("total-expenses").textContent = formatMoney(summary.expenses);
  document.getElementById("total-net").textContent = formatMoney(summary.net);
  document.getElementById("total-count").textContent = String(summary.count);
  totals.dataset.revenue = String(summary.revenue);
  totals.dataset.expenses = String(summary.expenses);
  totals.dataset.net = String(summary.net);
  totals.dataset.count = String(summary.count);
  totals.dataset.reconciled = summary.reconciled ? "yes" : "no";
  recon.textContent = summary.reconciled
    ? `${summary.count} lines. Revenue ${formatMoney(summary.revenue)} − expenses ${formatMoney(summary.expenses)} = net ${formatMoney(summary.net)}. Category totals match the line totals. Signed amounts in the table add up to the net.`
    : `${summary.count} lines. Category totals do not match the line totals.`;
  renderCategories(summary);
  renderLines(filtered);
}

function initSample() {
  addOption(monthSelect, "all", "All months");
  for (const month of listMonths()) addOption(monthSelect, month.value, month.label);
  addOption(categorySelect, "all", "All categories");
  for (const category of listCategories()) addOption(categorySelect, category, category);
  addOption(kindSelect, "all", "All types");
  addOption(kindSelect, "revenue", "Revenue");
  addOption(kindSelect, "expense", "Expense");

  const full = summarize(rows);
  fullLedger.textContent = `Full synthetic ledger, before any filter: ${full.count} lines, revenue ${formatMoney(full.revenue)}, expenses ${formatMoney(full.expenses)}, net ${formatMoney(full.net)}.`;
  monthSelect.addEventListener("change", render);
  categorySelect.addEventListener("change", render);
  kindSelect.addEventListener("change", render);
  resetButton.addEventListener("click", () => {
    monthSelect.value = "all";
    categorySelect.value = "all";
    kindSelect.value = "all";
    render();
  });
  render();
}

function clearFieldErrors() {
  for (const field of quoteFields) {
    document.getElementById(field).removeAttribute("aria-invalid");
    const hint = document.getElementById(`${field}-error`);
    hint.hidden = true;
    hint.textContent = "";
  }
}

function showStatus(message) {
  formStatus.hidden = false;
  formStatus.textContent = message;
}

function showFieldErrors(errors) {
  const visible = errors.filter((error) => error.field !== "gotcha");
  showStatus(errors.map((error) => error.message).join(" "));
  for (const error of visible) {
    const input = document.getElementById(error.field);
    const hint = document.getElementById(`${error.field}-error`);
    input.setAttribute("aria-invalid", "true");
    hint.hidden = false;
    hint.textContent = error.message;
  }
  if (visible[0]) document.getElementById(visible[0].field).focus();
}

function initForm() {
  form.noValidate = true;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.sending === "true") return;

    clearFieldErrors();
    const result = validateQuote({
      name: document.getElementById("name").value,
      email: document.getElementById("email").value,
      service: document.getElementById("service").value,
      message: document.getElementById("message").value,
      gotcha: document.getElementById("gotcha").value,
    });

    if (!result.ok) {
      showFieldErrors(result.errors);
      return;
    }

    form.dataset.sending = "true";
    submitButton.disabled = true;
    showStatus("Sending the quote request.");
    try {
      const body = new FormData();
      body.set("name", result.value.name);
      body.set("email", result.value.email);
      body.set("service", result.value.service);
      body.set("message", result.value.message);
      body.set("_subject", "Quote request from the David Dreier portfolio page");
      const response = await fetch(form.action, {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (response.ok && (!payload || payload.ok !== false)) {
        showStatus("Formspree accepted the submission. This page does not confirm that David Dreier received it.");
      } else {
        showStatus("The submission was not accepted. This page does not confirm delivery.");
      }
    } catch {
      showStatus("The submission did not complete. This page does not confirm delivery.");
    } finally {
      form.dataset.sending = "false";
      submitButton.disabled = false;
    }
  });
}

initSample();
initForm();
