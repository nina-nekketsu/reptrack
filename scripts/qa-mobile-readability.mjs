import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'docs/design-qa/mobile-readability/fixture.html');
const outputDir = path.join(root, 'docs/design-qa/mobile-readability');
const blockedPath = path.join(outputDir, 'mobile-readability-browser-qa-blocked.json');
const profileDir = `/tmp/reptrack-mobile-readability-chrome-${process.pid}`;

function resolveChromeExecutable() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.GOOGLE_CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  const pathExtensions = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
    : [''];
  for (const directory of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']) {
      for (const extension of pathExtensions) {
        const candidate = path.join(directory, `${command}${extension}`);
        if (existsSync(candidate)) return candidate;
      }
    }
  }

  throw new Error('Chrome/Chromium executable not found. Set CHROME_BIN to run mobile readability browser QA.');
}

const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 430, height: 932 },
  { width: 430, height: 390, name: '430x390-short' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      const listeners = this.listeners.get(message.method) || [];
      for (const listener of listeners) listener(message.params);
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
    const id = this.nextId++;
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
  return {
    noDocumentOverflow: metrics.documentOverflow === 0,
    noModalOverflow: metrics.modalOverflow === 0 && metrics.scrollBodyOverflow === 0,
    modalAtMost92dvh: metrics.modalHeight <= metrics.viewport.height * 0.92 + 1,
    timerAtMost40Percent390: metrics.viewport.width !== 390 || metrics.stickyHeight <= metrics.viewport.height * 0.4,
    threeRowsVisible390: metrics.viewport.width !== 390 || metrics.completeRowsVisible >= 3,
    noSetControlOverlaps: metrics.rowLayouts.every((row) => row.controlOverlaps.length === 0),
    setContentContained: metrics.rowLayouts.every((row) => !row.contentEscapesRow),
    noSetFlowOverlaps: metrics.rowLayouts.every((row) => !row.flowOverlap),
    digitClamp: metrics.activeDigitFontSize >= 28 && metrics.activeDigitFontSize <= 38,
    inputFontSize: metrics.inputFontSize >= 16,
    touchTargets: metrics.minControlSize >= 44,
    srOnlyHidden: metrics.srOnly.position === 'absolute'
      && metrics.srOnly.width === '1px'
      && metrics.srOnly.height === '1px'
      && metrics.srOnly.overflow === 'hidden',
    noLightModalBackgrounds: metrics.lightBackgrounds.length === 0,
    contrast: metrics.colors.modalSubContrast >= 4.5
      && metrics.colors.setGhostContrast >= 4.5
      && metrics.colors.setNumContrast >= 4.5
      && metrics.colors.timerLabelContrast >= 3,
  };
}

await mkdir(outputDir, { recursive: true });
await mkdir(profileDir, { recursive: true });

let chromeProcess;
let chromeStderr = '';
const results = [];

try {
  const port = await getFreePort();
  const chrome = resolveChromeExecutable();
  chromeProcess = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-extensions',
    '--allow-file-access-from-files',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  chromeProcess.stderr.on('data', (chunk) => { chromeStderr += chunk; });

  await waitForJson(`http://127.0.0.1:${port}/json/version`);

  for (const viewport of viewports) {
    const name = viewport.name || `${viewport.width}x${viewport.height}`;
    const targetResponse = await fetch(
      `http://127.0.0.1:${port}/json/new?${encodeURIComponent(`file://${fixture}`)}`,
      { method: 'PUT' },
    );
    if (!targetResponse.ok) throw new Error(`Could not create Chrome target: ${targetResponse.status}`);
    const target = await targetResponse.json();
    const client = new CdpClient(target.webSocketDebuggerUrl);

    try {
      await client.connect();
      await client.send('Page.enable');
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
      await client.send('Page.navigate', { url: `file://${fixture}` });
      await loaded;
      const metrics = await waitForMetrics(client);
      const screenshot = await client.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      });
      const screenshotPath = path.join(outputDir, `after-${name}.png`);
      const screenshotReportPath = path.posix.join('docs', 'design-qa', 'mobile-readability', `after-${name}.png`);
      await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
      const verdict = verdictFor(metrics);
      results.push({ name, screenshotPath: screenshotReportPath, metrics, verdict });
    } finally {
      client.close();
      await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
    }
  }
} catch (error) {
  await writeFile(blockedPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    command: 'npm run qa:mobile-readability',
    status: 'blocked',
    reason: error.message,
    chromeStderr: chromeStderr.slice(-4000),
    note: 'Live viewport screenshots and DOM metrics require a runnable local browser. Static CSS QA is available via npm run qa:mobile-readability:static.',
  }, null, 2)}\n`);
  console.error(`Browser QA blocked; wrote ${blockedPath}`);
  console.error(error.message);
  process.exitCode = 2;
} finally {
  if (chromeProcess && !chromeProcess.killed) {
    chromeProcess.kill('SIGTERM');
    await sleep(500);
    if (chromeProcess.exitCode === null) chromeProcess.kill('SIGKILL');
  }
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}

if (!process.exitCode) {
  const reportPath = path.join(outputDir, 'mobile-readability-qa-results.json');
  await rm(blockedPath, { force: true });
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
