import assert from "node:assert/strict";
import {
  applyFilters,
  formatMoney,
  listCategories,
  listMonths,
  rows,
  signedAmount,
  summarize,
} from "../sample-report.js";

const expected = [
  ["2026-01", "revenue", "Product sales", 12500],
  ["2026-01", "revenue", "Service income", 4300],
  ["2026-01", "expense", "Software", 420],
  ["2026-01", "expense", "Contract labor", 2100],
  ["2026-01", "expense", "Supplies", 180],
  ["2026-01", "expense", "Rent", 1500],
  ["2026-02", "revenue", "Product sales", 9800],
  ["2026-02", "revenue", "Service income", 5100],
  ["2026-02", "expense", "Software", 420],
  ["2026-02", "expense", "Contract labor", 1800],
  ["2026-02", "expense", "Supplies", 260],
  ["2026-02", "expense", "Rent", 1500],
  ["2026-03", "revenue", "Product sales", 14200],
  ["2026-03", "revenue", "Service income", 3600],
  ["2026-03", "expense", "Software", 450],
  ["2026-03", "expense", "Contract labor", 2400],
  ["2026-03", "expense", "Supplies", 310],
  ["2026-03", "expense", "Rent", 1500],
];

assert.deepEqual(
  rows.map((row) => [row.month, row.kind, row.category, row.amount]),
  expected,
);

for (const row of rows) {
  assert.equal(Number.isInteger(row.amount), true);
  assert.equal(row.amount > 0, true);
  assert.match(row.memo, /^Sample /);
}

assert.deepEqual(listMonths().map((month) => month.value), ["2026-01", "2026-02", "2026-03"]);
assert.deepEqual(listCategories(), [
  "Contract labor",
  "Product sales",
  "Rent",
  "Service income",
  "Software",
  "Supplies",
]);

function independent(filtered) {
  const revenue = filtered.filter((row) => row.kind === "revenue").reduce((sum, row) => sum + row.amount, 0);
  const expenses = filtered.filter((row) => row.kind === "expense").reduce((sum, row) => sum + row.amount, 0);
  const signed = filtered.reduce((sum, row) => sum + signedAmount(row), 0);
  return { revenue, expenses, net: revenue - expenses, signed, count: filtered.length };
}

const months = ["all", ...listMonths().map((month) => month.value)];
const categories = ["all", ...listCategories(), "Not a category"];
const kinds = ["all", "revenue", "expense"];
let combinations = 0;

for (const month of months) {
  for (const category of categories) {
    for (const kind of kinds) {
      const filtered = applyFilters(rows, { month, category, kind });
      const summary = summarize(filtered);
      const check = independent(filtered);
      assert.equal(summary.count, check.count, `${month} ${category} ${kind} count`);
      assert.equal(summary.revenue, check.revenue);
      assert.equal(summary.expenses, check.expenses);
      assert.equal(summary.net, check.net);
      assert.equal(summary.signed, check.signed);
      assert.equal(summary.reconciled, true);
      const fromBars = summary.categoryTotals.reduce((sum, item) => sum + item.amount, 0);
      assert.equal(fromBars, summary.revenue + summary.expenses);
      combinations += 1;
    }
  }
}

assert.equal(combinations, 4 * 8 * 3);

const all = summarize(rows);
assert.deepEqual(
  { count: all.count, revenue: all.revenue, expenses: all.expenses, net: all.net },
  { count: 18, revenue: 49500, expenses: 12840, net: 36660 },
);

const january = summarize(applyFilters(rows, { month: "2026-01", category: "all", kind: "all" }));
assert.deepEqual(
  { count: january.count, revenue: january.revenue, expenses: january.expenses, net: january.net },
  { count: 6, revenue: 16800, expenses: 4200, net: 12600 },
);

const february = summarize(applyFilters(rows, { month: "2026-02", category: "all", kind: "all" }));
assert.deepEqual(
  { count: february.count, revenue: february.revenue, expenses: february.expenses, net: february.net },
  { count: 6, revenue: 14900, expenses: 3980, net: 10920 },
);

const march = summarize(applyFilters(rows, { month: "2026-03", category: "all", kind: "all" }));
assert.deepEqual(
  { count: march.count, revenue: march.revenue, expenses: march.expenses, net: march.net },
  { count: 6, revenue: 17800, expenses: 4660, net: 13140 },
);

const byKey = Object.fromEntries(all.categoryTotals.map((item) => [`${item.kind}:${item.category}`, item.amount]));
assert.equal(byKey["revenue:Product sales"], 36500);
assert.equal(byKey["revenue:Service income"], 13000);
assert.equal(byKey["expense:Contract labor"], 6300);
assert.equal(byKey["expense:Rent"], 4500);
assert.equal(byKey["expense:Software"], 1290);
assert.equal(byKey["expense:Supplies"], 750);
assert.equal(all.categoryTotals[0].category, "Product sales");
assert.equal(all.categoryTotals.at(-1).category, "Supplies");

const rent = summarize(applyFilters(rows, { month: "all", category: "Rent", kind: "all" }));
assert.deepEqual(
  { count: rent.count, revenue: rent.revenue, expenses: rent.expenses, net: rent.net },
  { count: 3, revenue: 0, expenses: 4500, net: -4500 },
);

const februaryProduct = summarize(applyFilters(rows, { month: "2026-02", category: "Product sales", kind: "revenue" }));
assert.deepEqual(
  { count: februaryProduct.count, revenue: februaryProduct.revenue, expenses: februaryProduct.expenses, net: februaryProduct.net },
  { count: 1, revenue: 9800, expenses: 0, net: 9800 },
);

const empty = summarize(applyFilters(rows, { month: "all", category: "Rent", kind: "revenue" }));
assert.deepEqual(
  { count: empty.count, revenue: empty.revenue, expenses: empty.expenses, net: empty.net, reconciled: empty.reconciled },
  { count: 0, revenue: 0, expenses: 0, net: 0, reconciled: true },
);

assert.equal(formatMoney(49500), "$49,500.00");
assert.equal(formatMoney(16800), "$16,800.00");
assert.equal(formatMoney(-4500), "-$4,500.00");
assert.equal(formatMoney(0), "$0.00");
assert.throws(() => formatMoney(1.5));

console.log(`report.test.mjs ok (${combinations} filter combinations)`);
