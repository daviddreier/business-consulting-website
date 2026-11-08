import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.env.SCREENSHOT_DIR || "/tmp/portfolio-screenshots";
const port = 8765;
const pageUrl = `http://127.0.0.1:${port}/`;
fs.mkdirSync(outDir, { recursive: true });

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
  cwd: root,
  stdio: "ignore",
});
const chrome = spawn("/usr/bin/google-chrome", [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--hide-scrollbars",
  "--remote-debugging-port=9341",
  "--user-data-dir=/tmp/chrome-portfolio-profile",
  "--remote-allow-origins=*",
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

let chromeLog = "";
chrome.stderr.on("data", (chunk) => {
  chromeLog += chunk.toString();
});

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result || {});
      } else if (message.method) {
        this.events.push(message);
      }
    });
  }

  send(method, params = {}, timeout = 20000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timeout ${method}`));
      }, timeout);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error("websocket failed")));
  });
  return new CDP(ws);
}

async function waitForChrome() {
  const start = Date.now();
  while (Date.now() - start < 20000) {
    try {
      const response = await fetch("http://127.0.0.1:9341/json/version");
      if (response.ok) return response.json();
    } catch {
      await sleep(200);
    }
  }
  throw new Error(`Chrome did not open.\n${chromeLog.slice(-1500)}`);
}

async function evalJson(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

async function screenshot(cdp, filename, clip) {
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip,
  }, 30000);
  const file = path.join(outDir, filename);
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  return file;
}

async function fullClip(cdp) {
  const metrics = await cdp.send("Page.getLayoutMetrics");
  return {
    x: 0,
    y: 0,
    width: Math.ceil(metrics.cssContentSize.width),
    height: Math.ceil(metrics.cssContentSize.height),
    scale: 1,
  };
}

async function elementClip(cdp, id) {
  const box = await evalJson(cdp, `(() => {
    const el = document.getElementById(${JSON.stringify(id)});
    const rect = el.getBoundingClientRect();
    return { x: 0, y: rect.top + window.scrollY, width: document.documentElement.clientWidth, height: Math.ceil(rect.height) };
  })()`);
  return {
    x: 0,
    y: Math.max(0, Math.floor(box.y - 8)),
    width: Math.ceil(box.width),
    height: Math.ceil(box.height + 16),
    scale: 1,
  };
}

try {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    try {
      const probe = await fetch(pageUrl);
      if (probe.ok) break;
    } catch {
      await sleep(100);
    }
  }

  const version = await waitForChrome();
  const browser = await connect(version.webSocketDebuggerUrl);
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  await sleep(200);
  const list = await (await fetch("http://127.0.0.1:9341/json/list")).json();
  const page = list.find((target) => target.id === targetId);
  const cdp = await connect(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Network.enable");
  await cdp.send("Network.setBlockedURLs", {
    urls: ["*://generativelanguage.googleapis.com/*", "*://formspree.io/*"],
  });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.__reviewFetches = [];
      const __origFetch = window.fetch.bind(window);
      window.fetch = (input, init = {}) => {
        const href = typeof input === "string" ? input : (input && input.url) || String(input);
        const record = { href, method: init.method || "GET" };
        if (init.body && typeof init.body.get === "function") {
          record.body = {
            name: init.body.get("name"),
            email: init.body.get("email"),
            service: init.body.get("service"),
            message: init.body.get("message"),
          };
        }
        window.__reviewFetches.push(record);
        if (/generativelanguage|formspree\\.io/i.test(href)) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }));
        }
        return __origFetch(input, init);
      };
    `,
  });
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Page.navigate", { url: pageUrl });
  const loaded = Date.now();
  while (Date.now() - loaded < 15000) {
    if (cdp.events.some((event) => event.method === "Page.loadEventFired")) break;
    await sleep(100);
  }
  await sleep(300);

  const initial = await evalJson(cdp, `(() => {
    const totals = document.getElementById("totals");
    const text = document.body.innerText;
    return {
      title: document.title,
      h1: document.querySelector("h1").textContent,
      revenue: totals.dataset.revenue,
      expenses: totals.dataset.expenses,
      net: totals.dataset.net,
      count: totals.dataset.count,
      reconciled: totals.dataset.reconciled,
      revenueText: document.getElementById("total-revenue").textContent,
      expenseText: document.getElementById("total-expenses").textContent,
      netText: document.getElementById("total-net").textContent,
      rows: document.querySelectorAll("#line-body tr").length,
      meters: document.querySelectorAll("#categories meter").length,
      firstMeter: document.querySelector("#categories li").dataset.amount,
      firstCategory: document.querySelector("#categories li").dataset.category,
      fetches: window.__reviewFetches.length,
      links: [...document.querySelectorAll("a")].map((a) => a.getAttribute("href")),
      action: document.getElementById("quote-form").getAttribute("action"),
      stars: text.includes("**"),
      ivy: /ivy/i.test(text),
      synthetic: text.includes("SYNTHETIC EXAMPLE DATA"),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  })()`);

  check(initial.title.includes("David Dreier"), "title");
  check(initial.h1 === "David Dreier", "h1");
  check(initial.revenue === "49500" && initial.revenueText === "$49,500.00", "full revenue");
  check(initial.expenses === "12840" && initial.expenseText === "$12,840.00", "full expenses");
  check(initial.net === "36660" && initial.netText === "$36,660.00", "full net");
  check(initial.count === "18" && initial.rows === 18 && initial.reconciled === "yes", "full count");
  check(initial.meters === 6 && initial.firstCategory === "Product sales" && initial.firstMeter === "36500", "category bars");
  check(initial.fetches === 0, "no fetch on load");
  check(initial.links.every((href) => href.startsWith("#")), "only in-page links");
  check(initial.action === "https://formspree.io/f/mjkreldr", "form action");
  check(initial.stars === false && initial.ivy === false && initial.synthetic === true, "copy checks");
  check(initial.scrollWidth <= initial.clientWidth + 1, `desktop overflow ${initial.scrollWidth}`);

  const desktopFile = await screenshot(cdp, "portfolio_desktop.png", await fullClip(cdp));

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await evalJson(cdp, "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  const mobile = await evalJson(cdp, `({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    h1: getComputedStyle(document.querySelector("h1")).fontSize
  })`);
  check(mobile.scrollWidth <= mobile.clientWidth + 1, `mobile overflow ${mobile.scrollWidth}`);
  const mobileFile = await screenshot(cdp, "portfolio_mobile.png", await fullClip(cdp));

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evalJson(cdp, "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");

  const january = await evalJson(cdp, `(() => {
    document.getElementById("month").value = "2026-01";
    document.getElementById("month").dispatchEvent(new Event("change"));
    const totals = document.getElementById("totals");
    return {
      revenue: totals.dataset.revenue,
      expenses: totals.dataset.expenses,
      net: totals.dataset.net,
      count: totals.dataset.count,
      revenueText: document.getElementById("total-revenue").textContent,
      expenseText: document.getElementById("total-expenses").textContent,
      netText: document.getElementById("total-net").textContent,
      rows: document.querySelectorAll("#line-body tr").length,
      firstAmount: document.querySelector("#line-body tr td.num").textContent,
      fetches: window.__reviewFetches.length,
    };
  })()`);
  check(january.revenue === "16800" && january.revenueText === "$16,800.00", "January revenue");
  check(january.expenses === "4200" && january.expenseText === "$4,200.00", "January expenses");
  check(january.net === "12600" && january.netText === "$12,600.00", "January net");
  check(january.count === "6" && january.rows === 6 && january.firstAmount === "$12,500.00", "January rows");
  check(january.fetches === 0, "filter made no request");
  const januaryFile = await screenshot(cdp, "portfolio_january_filter.png", await elementClip(cdp, "sample"));

  const empty = await evalJson(cdp, `(() => {
    document.getElementById("category").value = "Rent";
    document.getElementById("kind").value = "revenue";
    document.getElementById("kind").dispatchEvent(new Event("change"));
    const totals = document.getElementById("totals");
    return {
      count: totals.dataset.count,
      net: totals.dataset.net,
      empty: document.getElementById("empty-lines").hidden === false,
      tableHidden: document.getElementById("line-table").hidden,
    };
  })()`);
  check(empty.count === "0" && empty.net === "0" && empty.empty === true && empty.tableHidden === true, "empty filter");

  const reset = await evalJson(cdp, `(() => {
    document.getElementById("reset-filters").click();
    return document.getElementById("totals").dataset.revenue;
  })()`);
  check(reset === "49500", "reset");

  const invalid = await evalJson(cdp, `(() => {
    document.getElementById("quote-form").requestSubmit();
    return {
      status: document.getElementById("form-status").textContent,
      fetches: window.__reviewFetches.length,
      invalidName: document.getElementById("name").getAttribute("aria-invalid"),
    };
  })()`);
  check(invalid.fetches === 0, "invalid form did not fetch");
  check(invalid.status.includes("Enter your name"), "validation message");
  check(invalid.invalidName === "true", "name marked invalid");
  const formFile = await screenshot(cdp, "portfolio_form_validation.png", await elementClip(cdp, "quote"));

  const trapped = await evalJson(cdp, `(() => {
    document.getElementById("name").value = "Ada Example";
    document.getElementById("email").value = "ada@example.com";
    document.getElementById("service").value = "Data cleanup";
    document.getElementById("message").value = "Please quote a sample cleanup.";
    document.getElementById("gotcha").value = "bot";
    document.getElementById("quote-form").requestSubmit();
    return { status: document.getElementById("form-status").textContent, fetches: window.__reviewFetches.length };
  })()`);
  check(trapped.fetches === 0 && trapped.status.includes("The form was not sent."), "honeypot blocked send");

  const stubbed = await evalJson(cdp, `(() => {
    document.getElementById("gotcha").value = "";
    document.getElementById("quote-form").requestSubmit();
    return new Promise((resolve) => setTimeout(() => resolve({
      status: document.getElementById("form-status").textContent,
      fetches: window.__reviewFetches,
    }), 200));
  })()`);
  check(stubbed.fetches.length === 1, "one stubbed submit");
  check(stubbed.fetches[0].method === "POST", "stub method");
  check(stubbed.fetches[0].href === "https://formspree.io/f/mjkreldr", "stub url");
  check(stubbed.fetches[0].body.email === "ada@example.com", "stub body");
  check(stubbed.fetches[0].body.service === "Data cleanup", "stub service");
  check(stubbed.status.includes("does not confirm that David Dreier received it"), "honest success copy");

  const risky = cdp.events
    .filter((event) => event.method === "Network.requestWillBeSent")
    .map((event) => event.params.request.url)
    .filter((url) => /generativelanguage|formspree/i.test(url));
  check(risky.length === 0, `network calls ${risky.join(",")}`);

  const report = {
    ok: failures.length === 0,
    failures,
    screenshots: { desktopFile, mobileFile, januaryFile, formFile },
    initial: { revenue: initial.revenueText, expenses: initial.expenseText, net: initial.netText, count: initial.count },
    january: { revenue: january.revenueText, expenses: january.expenseText, net: january.netText },
    mobile,
    networkBlocked: risky,
  };
  fs.writeFileSync(path.join(outDir, "browser-check.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill("SIGKILL");
  chrome.kill("SIGKILL");
}
