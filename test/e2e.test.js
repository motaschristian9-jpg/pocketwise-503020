import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BROWSER_BIN = fs.existsSync(CHROME_PATH) ? CHROME_PATH : (fs.existsSync(EDGE_PATH) ? EDGE_PATH : null);

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json'
};

function startStaticServer(distDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url.split('?')[0];
      let filePath = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(distDir, 'index.html');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

function waitPort(port, timeoutMs = 8000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error(`Timeout waiting for port ${port}`));
        else setTimeout(tryConnect, 150);
      });
    }
    tryConnect();
  });
}

function sendCDP(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    function onMsg(event) {
      try {
        const data = JSON.parse(event.data);
        if (data.id === id) {
          ws.removeEventListener('message', onMsg);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      } catch (err) {}
    }
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(ws, expression) {
  const res = await sendCDP(ws, 'Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || 'Evaluation error');
  }
  return res.result?.value;
}

test('End-to-End Headless Browser Verification', { timeout: 35000 }, async (t) => {
  if (!BROWSER_BIN) {
    t.skip('Chrome or Edge binary not found on host');
    return;
  }

  const distDir = path.resolve(import.meta.dirname, '..', 'dist');
  assert.ok(fs.existsSync(path.join(distDir, 'index.html')), 'dist/index.html must exist (run npm run build first)');

  const { server, port } = await startStaticServer(distDir);
  const debugPort = 9333 + Math.floor(Math.random() * 500);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-e2e-'));
  let chrome = null;
  let ws = null;

  try {
    // Launch headless browser with target URL directly
    chrome = spawn(BROWSER_BIN, [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--disable-gpu',
      '--no-sandbox',
      '--disable-extensions',
      `http://127.0.0.1:${port}/`
    ], { stdio: 'ignore' });

    await waitPort(debugPort, 10000);

    // Get the page target from /json/list
    const targetsRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    assert.ok(pageTarget?.webSocketDebuggerUrl, 'Page target debugger URL must exist');

    ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    const consoleErrors = [];
    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
          consoleErrors.push(msg.params.args.map(a => a.value || a.description).join(' '));
        }
        if (msg.method === 'Runtime.exceptionThrown') {
          consoleErrors.push(msg.params.exceptionDetails?.text || 'Uncaught exception');
        }
      } catch {}
    });

    await sendCDP(ws, 'Page.enable');
    await sendCDP(ws, 'Runtime.enable');

    // Wait for DOM ready & React mount
    await new Promise((r) => setTimeout(r, 1500));

    // Verify brand title and root element
    const title = await evaluate(ws, 'document.querySelector(".brand span")?.textContent');
    assert.match(title, /Pocketwise/, 'Brand title must render Pocketwise');

    // Verify "Install on your phone" is nowhere in the DOM
    const bodyText = await evaluate(ws, 'document.body.innerText');
    assert.ok(!bodyText.includes('Install on your phone'), 'Install on your phone must not exist');

    // Verify Tab switching to Settings
    await evaluate(ws, `
      const settingsNav = Array.from(document.querySelectorAll('nav .nav-item')).find(el => el.textContent.includes('Settings'));
      settingsNav?.click();
    `);
    await new Promise((r) => setTimeout(r, 400));
    const settingsHeader = await evaluate(ws, 'document.querySelector("h1")?.textContent');
    assert.match(settingsHeader, /Settings/i, 'Settings tab must be active');

    // Switch back to Overview (Home)
    await evaluate(ws, `
      const homeNav = Array.from(document.querySelectorAll('nav .nav-item')).find(el => el.textContent.includes('Overview'));
      homeNav?.click();
    `);
    await new Promise((r) => setTimeout(r, 400));

    // Open MoneyModal ("Add allowance")
    await evaluate(ws, `document.querySelector(".hero-btn")?.click()`);
    await new Promise((r) => setTimeout(r, 400));

    const modalTitle = await evaluate(ws, 'document.querySelector(".modal h2")?.textContent');
    assert.match(modalTitle, /Add your allowance/i, 'MoneyModal must open with Add your allowance title');

    // Check preview calculation with 1000 pesos
    await evaluate(ws, `
      const input = document.getElementById("amount");
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, "1000");
      input.dispatchEvent(new Event('input', { bubbles: true }));
    `);
    await new Promise((r) => setTimeout(r, 200));

    const previewText = await evaluate(ws, 'document.querySelector(".preview")?.textContent');
    assert.match(previewText, /Needs ₱500\.00/, '50% needs preview must be ₱500.00');
    assert.match(previewText, /Wants ₱300\.00/, '30% wants preview must be ₱300.00');
    assert.match(previewText, /Savings ₱200\.00/, '20% savings preview must be ₱200.00');

    // Fill in source description
    await evaluate(ws, `
      const label = document.getElementById("label");
      if (label) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(label, "Test Allowance");
        label.dispatchEvent(new Event('input', { bubbles: true }));
      }
    `);

    // Submit the modal form
    await evaluate(ws, `
      const submitBtn = document.querySelector(".modal button[type='submit']");
      submitBtn?.click();
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Verify toast appears
    const toastText = await evaluate(ws, 'document.querySelector(".toast")?.textContent');
    assert.match(toastText, /Allowance allocated successfully/i, 'Toast must announce successful allocation');

    // Verify hero total is updated to ₱1,000.00
    const heroMoney = await evaluate(ws, 'document.querySelector(".hero-money")?.textContent');
    assert.match(heroMoney, /1,000\.00/, 'Hero balance must reflect ₱1,000.00');

    // Verify buckets
    const bucketValues = await evaluate(ws, `
      Array.from(document.querySelectorAll(".bucket-money")).map(el => el.textContent)
    `);
    assert.equal(bucketValues.length, 3, 'Must render 3 buckets');
    assert.match(bucketValues[0], /500\.00/, 'Needs bucket must have ₱500.00');
    assert.match(bucketValues[1], /300\.00/, 'Wants bucket must have ₱300.00');
    assert.match(bucketValues[2], /200\.00/, 'Savings bucket must have ₱200.00');

    // Switch to Activity tab and verify the new entry exists
    await evaluate(ws, `
      const actNav = Array.from(document.querySelectorAll('nav .nav-item')).find(el => el.textContent.includes('Activity'));
      actNav?.click();
    `);
    await new Promise((r) => setTimeout(r, 400));
    const activityCount = await evaluate(ws, 'document.querySelectorAll(".activity-item").length');
    assert.ok(activityCount >= 1, 'Activity list must contain at least 1 transaction');

    // Assert zero runtime errors or unhandled exceptions
    assert.deepEqual(consoleErrors, [], `No console errors allowed: ${consoleErrors.join(', ')}`);

  } finally {
    if (ws) ws.close();
    if (chrome) chrome.kill();
    server.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
});
