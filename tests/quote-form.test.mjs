import assert from "node:assert/strict";
import fs from "node:fs";
import { SERVICES, validateQuote } from "../quote-form.js";

const valid = {
  name: "Ada Example",
  email: "ada@example.com",
  service: "Data cleanup",
  message: "Please quote a sample cleanup.",
};

assert.deepEqual(SERVICES, [
  "Excel report design",
  "Power BI report design",
  "Data cleanup",
  "Business reporting",
  "Bookkeeping support",
]);

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
for (const service of SERVICES) {
  assert.equal(html.includes(`<option value="${service}">${service}</option>`), true, service);
}

assert.equal(validateQuote(valid).ok, true);
assert.deepEqual(validateQuote(valid).value, valid);

const empty = validateQuote({});
assert.equal(empty.ok, false);
assert.deepEqual(empty.errors.map((error) => error.field), ["name", "email", "service", "message"]);

assert.equal(validateQuote({ ...valid, name: "   " }).ok, false);
assert.equal(validateQuote({ ...valid, name: "A".repeat(101) }).ok, false);
assert.equal(validateQuote({ ...valid, name: "  Ada Example  " }).value.name, "Ada Example");
assert.equal(validateQuote({ ...valid, email: "a@b" }).ok, false);
assert.equal(validateQuote({ ...valid, email: "a@b.c" }).ok, true);
assert.equal(validateQuote({ ...valid, service: "HR support" }).ok, false);
assert.equal(validateQuote({ ...valid, message: "Too short" }).ok, false);
assert.equal(validateQuote({ ...valid, message: "1234567890" }).ok, true);
assert.equal(validateQuote({ ...valid, message: "x".repeat(4001) }).ok, false);

const trapped = validateQuote({ ...valid, gotcha: "filled" });
assert.equal(trapped.ok, false);
assert.equal(trapped.errors.length, 1);
assert.equal(trapped.errors[0].field, "gotcha");

console.log("quote-form.test.mjs ok");
