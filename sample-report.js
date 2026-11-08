/**
 * Synthetic Harbor Sample Ledger.
 * Whole-dollar rows used only by the in-browser demonstration.
 */

export const rows = Object.freeze([
  Object.freeze({ id: "s01", month: "2026-01", monthLabel: "January 2026", kind: "revenue", category: "Product sales", memo: "Sample counter sales", amount: 12500 }),
  Object.freeze({ id: "s02", month: "2026-01", monthLabel: "January 2026", kind: "revenue", category: "Service income", memo: "Sample service billings", amount: 4300 }),
  Object.freeze({ id: "s03", month: "2026-01", monthLabel: "January 2026", kind: "expense", category: "Software", memo: "Sample ledger software", amount: 420 }),
  Object.freeze({ id: "s04", month: "2026-01", monthLabel: "January 2026", kind: "expense", category: "Contract labor", memo: "Sample contractor", amount: 2100 }),
  Object.freeze({ id: "s05", month: "2026-01", monthLabel: "January 2026", kind: "expense", category: "Supplies", memo: "Sample office supplies", amount: 180 }),
  Object.freeze({ id: "s06", month: "2026-01", monthLabel: "January 2026", kind: "expense", category: "Rent", memo: "Sample workspace rent", amount: 1500 }),
  Object.freeze({ id: "s07", month: "2026-02", monthLabel: "February 2026", kind: "revenue", category: "Product sales", memo: "Sample counter sales", amount: 9800 }),
  Object.freeze({ id: "s08", month: "2026-02", monthLabel: "February 2026", kind: "revenue", category: "Service income", memo: "Sample service billings", amount: 5100 }),
  Object.freeze({ id: "s09", month: "2026-02", monthLabel: "February 2026", kind: "expense", category: "Software", memo: "Sample ledger software", amount: 420 }),
  Object.freeze({ id: "s10", month: "2026-02", monthLabel: "February 2026", kind: "expense", category: "Contract labor", memo: "Sample contractor", amount: 1800 }),
  Object.freeze({ id: "s11", month: "2026-02", monthLabel: "February 2026", kind: "expense", category: "Supplies", memo: "Sample office supplies", amount: 260 }),
  Object.freeze({ id: "s12", month: "2026-02", monthLabel: "February 2026", kind: "expense", category: "Rent", memo: "Sample workspace rent", amount: 1500 }),
  Object.freeze({ id: "s13", month: "2026-03", monthLabel: "March 2026", kind: "revenue", category: "Product sales", memo: "Sample counter sales", amount: 14200 }),
  Object.freeze({ id: "s14", month: "2026-03", monthLabel: "March 2026", kind: "revenue", category: "Service income", memo: "Sample service billings", amount: 3600 }),
  Object.freeze({ id: "s15", month: "2026-03", monthLabel: "March 2026", kind: "expense", category: "Software", memo: "Sample ledger software", amount: 450 }),
  Object.freeze({ id: "s16", month: "2026-03", monthLabel: "March 2026", kind: "expense", category: "Contract labor", memo: "Sample contractor", amount: 2400 }),
  Object.freeze({ id: "s17", month: "2026-03", monthLabel: "March 2026", kind: "expense", category: "Supplies", memo: "Sample office supplies", amount: 310 }),
  Object.freeze({ id: "s18", month: "2026-03", monthLabel: "March 2026", kind: "expense", category: "Rent", memo: "Sample workspace rent", amount: 1500 }),
]);

export function listMonths(data = rows) {
  const months = [];
  for (const row of data) {
    if (!months.some((month) => month.value === row.month)) {
      months.push({ value: row.month, label: row.monthLabel });
    }
  }
  return months;
}

export function listCategories(data = rows) {
  return [...new Set(data.map((row) => row.category))].sort((a, b) => a.localeCompare(b));
}

export function signedAmount(row) {
  if (row.kind === "revenue") return row.amount;
  if (row.kind === "expense") return -row.amount;
  throw new Error("Unknown entry type.");
}

export function applyFilters(data, filters) {
  const month = filters.month || "all";
  const category = filters.category || "all";
  const kind = filters.kind || "all";
  return data.filter((row) =>
    (month === "all" || row.month === month) &&
    (category === "all" || row.category === category) &&
    (kind === "all" || row.kind === kind)
  );
}

export function summarize(filtered) {
  let revenue = 0;
  let expenses = 0;
  let signed = 0;
  const categories = new Map();

  for (const row of filtered) {
    const signedValue = signedAmount(row);
    signed += signedValue;
    if (row.kind === "revenue") revenue += row.amount;
    else expenses += row.amount;

    const key = `${row.kind}|${row.category}`;
    const current = categories.get(key) || {
      kind: row.kind,
      category: row.category,
      amount: 0,
      count: 0,
    };
    current.amount += row.amount;
    current.count += 1;
    categories.set(key, current);
  }

  const categoryTotals = [...categories.values()].sort((a, b) =>
    b.amount - a.amount || a.category.localeCompare(b.category) || a.kind.localeCompare(b.kind)
  );
  const revenueFromCategories = categoryTotals
    .filter((item) => item.kind === "revenue")
    .reduce((sum, item) => sum + item.amount, 0);
  const expensesFromCategories = categoryTotals
    .filter((item) => item.kind === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
  const net = revenue - expenses;

  return {
    count: filtered.length,
    revenue,
    expenses,
    net,
    signed,
    categoryTotals,
    reconciled: revenueFromCategories === revenue && expensesFromCategories === expenses && signed === net,
  };
}

export function formatMoney(amount) {
  if (!Number.isInteger(amount)) {
    throw new Error("Amounts are whole dollars.");
  }
  const sign = amount < 0 ? "-" : "";
  const withCommas = Math.abs(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${withCommas}.00`;
}
