import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'docs/design-qa/done-button-readability');
const blockedPath = path.join(outputDir, 'done-button-readability-browser-qa-blocked.json');
const fixturePath = '/docs/design-qa/done-button-readability/fixture.html';
const profileDir = `/tmp/reptrack-done-button-chrome-${process.pid}`;

const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
];
const states = ['disabled', 'enabled'];

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
};

function resolveChromeExecutable() {
  const configuredChrome = process.env.CHROME_BIN || process.env.GOOGLE_CHROME_BIN;
  if (configuredChrome) {
    if (existsSync(configuredChrome)) return configuredChrome;
    throw new Error(`Configured Chrome/Chromium executable not found: ${configuredChrome}`);
  }

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  for (const directory of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']) {
      const candidate = path.join(directory, command);
      if (existsSync(candidate)) return candidate;
    }
  }

  throw new Error('Chrome/Chromium executable not found. Set CHROME_BIN to run Done button readability browser QA.');
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startStaticServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, 'http://127.0.0.1');
      const decodedPath = decodeURIComponent(requestUrl.pathname);
      const absolutePath = path.normalize(path.join(root, decodedPath));
      if (!absolutePath.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }

      const body = await readFile(absolutePath);
      response.writeHead(200, {
        'Content-Type': contentTypes[path.extname(absolutePath)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(body);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(error.message);
    }
  });

  const port = await getFreePort();
  await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return { server, port };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForJson(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`Chrome DevTools endpoint did not become ready: ${lastError?.message || 'timeout'}`);
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params);
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out connecting to Chrome DevTools')), 10000);
      this.socket.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('Chrome DevTools WebSocket connection failed'));
      }, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, 15000);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.set(method, (this.listeners.get(method) || []).filter((item) => item !== listener));
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      const listener = (params) => {
        clearTimeout(timer);
        this.listeners.set(method, (this.listeners.get(method) || []).filter((item) => item !== listener));
        resolve(params);
      };
      this.listeners.set(method, [...(this.listeners.get(method) || []), listener]);
    });
  }

  on(method, listener) {
    this.listeners.set(method, [...(this.listeners.get(method) || []), listener]);
  }

  close() {
    this.socket?.close();
  }
}

async function waitForMetrics(client) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const result = await client.send('Runtime.evaluate', {
      expression: "document.getElementById('qa-result')?.textContent || ''",
      returnByValue: true,
    });
    const value = result.result?.value || '';
    if (value.trim().startsWith('{')) return JSON.parse(value);
    await sleep(100);
  }
  throw new Error('QA fixture did not produce metrics within 10 seconds.');
}

function verdictFor(metrics) {
  const expected = metrics.expectedViewport || metrics.viewport;
  const externalStylesheets = metrics.stylesheets.filter((sheet) => sheet.href);
  return {
    viewportApplied: metrics.viewport.width === expected.width && metrics.viewport.height === expected.height,
    stylesheetsLoaded: externalStylesheets.length === 3
      && externalStylesheets.every((sheet) => Number.isInteger(sheet.ruleCount) && sheet.ruleCount > 0)
      && metrics.resourceFailures.length === 0,
    keyCssVarsResolved: Object.values(metrics.cssVars).every((value) => typeof value === 'string' && value.length > 0),
    stateMatches: metrics.state === 'disabled' ? metrics.done.disabled : !metrics.done.disabled,
    disabledCursor: metrics.state !== 'disabled' || metrics.done.cursor === 'not-allowed',
    doneContrast: metrics.done.contrast >= 4.5,
    cancelContrast: metrics.cancel.contrast >= 4.5,
    enabledPrimary: metrics.state !== 'enabled' || (
      metrics.done.background === metrics.cssVars.goRgb
      && metrics.done.color === metrics.cssVars.inkOnAccentRgb
    ),
    disabledDistinct: metrics.state !== 'disabled' || (
      metrics.done.background === metrics.cssVars.bg1Rgb
      && metrics.done.color === metrics.cssVars.inkMidRgb
    ),
    doneTouchTarget: metrics.done.rect.width >= 44 && metrics.done.rect.height >= 44,
    cancelTouchTarget: metrics.cancel.rect.width >= 44 && metrics.cancel.rect.height >= 44,
    noDocumentOverflow: metrics.documentOverflow === 0,
    noModalOverflow: metrics.modalOverflow === 0,
    footerVisible: metrics.footer.bottom <= metrics.viewport.height + 1,
  };
}

await mkdir(outputDir, { recursive: true });

let chromeProcess;
let chromeStderr = '';
let staticServer;
const results = [];

try {
  const chrome = resolveChromeExecutable();
  staticServer = await startStaticServer();
  const port = await getFreePort();

  chromeProcess = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-extensions',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  chromeProcess.stderr.on('data', (chunk) => { chromeStderr += chunk; });

  await waitForJson(`http://127.0.0.1:${port}/json/version`);

  for (const viewport of viewports) {
    for (const state of states) {
      const name = `${state}-${viewport.width}x${viewport.height}`;
      const targetUrl = `http://127.0.0.1:${staticServer.port}${fixturePath}?state=${state}&width=${viewport.width}&height=${viewport.height}`;
      const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(targetUrl)}`, { method: 'PUT' });
      if (!targetResponse.ok) throw new Error(`Could not create Chrome target: ${targetResponse.status}`);
      const target = await targetResponse.json();
      const client = new CdpClient(target.webSocketDebuggerUrl);
      const resourceFailures = [];
      const httpFailures = [];
      const exceptions = [];

      try {
        await client.connect();
        client.on('Network.loadingFailed', (event) => {
          resourceFailures.push(`${event.type || 'resource'} ${event.errorText || 'failed'}`);
        });
        client.on('Network.responseReceived', (event) => {
          if (event.response.status >= 400) httpFailures.push(`${event.response.status} ${event.response.url}`);
        });
        client.on('Runtime.exceptionThrown', (event) => {
          exceptions.push(event.exceptionDetails?.text || event.exceptionDetails?.exception?.description || 'Runtime exception');
        });
        await client.send('Page.enable');
        await client.send('Network.enable');
        await client.send('Runtime.enable');
        await client.send('Emulation.setDeviceMetricsOverride', {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          mobile: true,
          screenWidth: viewport.width,
          screenHeight: viewport.height,
        });
        const loaded = client.once('Page.loadEventFired');
        await client.send('Page.navigate', { url: targetUrl });
        await loaded;
        await sleep(700);
        const metrics = await waitForMetrics(client);
        metrics.resourceFailures = [
          ...metrics.resourceFailures,
          ...resourceFailures,
          ...httpFailures,
          ...exceptions,
        ];
        // Capture the stable resting state after the finite 520 ms ready sheen.
        await sleep(700);
        const screenshot = await client.send('Page.captureScreenshot', {
          format: 'png',
          fromSurface: true,
          captureBeyondViewport: false,
        });
        const screenshotPath = path.join(outputDir, `after-${name}.png`);
        const screenshotReportPath = path.posix.join('docs', 'design-qa', 'done-button-readability', `after-${name}.png`);
        await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
        results.push({ name, screenshotPath: screenshotReportPath, metrics, verdict: verdictFor(metrics) });
      } finally {
        client.close();
        await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
      }
    }
  }
} catch (error) {
  await writeFile(blockedPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    command: 'npm run qa:done-button-readability',
    status: 'blocked',
    reason: error.message,
    chromeStderr: chromeStderr.slice(-4000),
  }, null, 2)}\n`);
  console.error(`Done button browser QA blocked; wrote ${blockedPath}`);
  console.error(error.message);
  process.exitCode = 2;
} finally {
  if (chromeProcess && !chromeProcess.killed) {
    chromeProcess.kill('SIGTERM');
    await sleep(500);
    if (chromeProcess.exitCode === null) chromeProcess.kill('SIGKILL');
  }
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  if (staticServer?.server) {
    await new Promise((resolve) => staticServer.server.close(resolve)).catch(() => {});
  }
}

if (!process.exitCode) {
  const reportPath = path.join(outputDir, 'done-button-readability-qa-results.json');
  await rm(blockedPath, { force: true }).catch(() => {});
  await writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`);

  const failed = results.flatMap((result) =>
    Object.entries(result.verdict)
      .filter(([, passed]) => !passed)
      .map(([check]) => `${result.name}: ${check}`)
  );

  console.log(`Wrote ${reportPath}`);
  for (const result of results) {
    console.log(`${result.name}: ${Object.values(result.verdict).every(Boolean) ? 'PASS' : 'FAIL'} ${result.screenshotPath}`);
  }

  if (failed.length) {
    console.error(`Failed checks:\n${failed.join('\n')}`);
    process.exitCode = 1;
  }
}
