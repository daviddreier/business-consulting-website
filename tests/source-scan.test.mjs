import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const secret = /AIza[0-9A-Za-z_\-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk_live_[0-9A-Za-z]|xox[baprs]-[0-9A-Za-z-]+/;
const remoteModel = /generativelanguage|gemini/i;
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
}

walk(root);
assert.equal(files.some((file) => file.endsWith(`${path.sep}api${path.sep}insight.py`)), false);

const textFiles = files.filter((file) => !file.endsWith(".svg"));
const siteFiles = new Set(["index.html", "styles.css", "main.js", "sample-report.js", "quote-form.js"]);
for (const file of textFiles) {
  const text = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  assert.equal(secret.test(text), false, `secret pattern in ${relative}`);
  if (siteFiles.has(relative) && remoteModel.test(text)) {
    assert.fail(`model host or product name in ${relative}`);
  }
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const banned = [
  /ivy/i,
  /dual[-\s]?degree/i,
  /minor in economics/i,
  /certification/i,
  /track record/i,
  /\bCRM\b/,
  /\bERP\b/,
  /testimonial/i,
  /mailto:/i,
  /fonts\.googleapis/,
  /tailwind/i,
  /googletagmanager/,
  /\*\*/,
];
for (const pattern of banned) {
  assert.equal(pattern.test(html), false, `banned pattern ${pattern}`);
}

for (const required of [
  "David Dreier",
  "Data Dave",
  "University of Pittsburgh",
  "Accounting &amp; Finance",
  "SYNTHETIC EXAMPLE DATA",
  "not an embedded Power BI report",
  "formspree.io/f/mjkreldr",
  "does not confirm",
  "LedgerFlow Systems LLC",
]) {
  assert.equal(html.includes(required), true, required);
}

assert.equal(/<script(?![^>]*\bsrc=)/i.test(html), false);
assert.equal(html.includes('src="main.js"'), true);
assert.equal(html.includes('href="styles.css"'), true);
assert.equal(fs.existsSync(path.join(root, ".nojekyll")), true);
assert.equal(/https?:\/\/(?!formspree\.io)/.test(html.replace("https://formspree.io/f/mjkreldr", "")), false);

console.log(`source-scan.test.mjs ok (${textFiles.length} text files)`);
