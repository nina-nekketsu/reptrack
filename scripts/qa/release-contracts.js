#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const REQUIRED_SUBPATH = '/reptrack/';
const PORTRAIT_VIEWPORTS = [
  { width: 320, height: 568, label: '320x568' },
  { width: 360, height: 800, label: '360x800' },
  { width: 390, height: 844, label: '390x844' },
  { width: 420, height: 900, label: '420x900' },
  { width: 428, height: 926, label: '428x926' },
];
const LANDSCAPE_VIEWPORTS = [
  { width: 568, height: 320, label: '568x320-landscape' },
  { width: 844, height: 390, label: '844x390-landscape' },
  { width: 926, height: 428, label: '926x428-landscape' },
];
const VIEWPORTS = [...PORTRAIT_VIEWPORTS, ...LANDSCAPE_VIEWPORTS];
const ROUTES = [
  { id: 'today', path: '/today', auth: 'signed-out-or-authenticated', source: 'src/pages/Dashboard.js' },
  { id: 'workouts', path: '/workouts', auth: 'authenticated-real-data', source: 'src/pages/Workouts.js' },
  { id: 'active-workout', path: '/workout/:planId', auth: 'authenticated-real-data', source: 'src/pages/ActiveWorkout.js' },
  { id: 'exercises', path: '/exercises', auth: 'signed-out-or-authenticated', source: 'src/pages/Exercises.js' },
  { id: 'history', path: '/history', auth: 'authenticated-real-data', source: 'src/pages/History.js' },
  { id: 'progress', path: '/progress', auth: 'authenticated-real-data', source: 'src/pages/Progress.js' },
  { id: 'coach', path: '/coach', auth: 'authenticated-real-data', source: 'src/pages/Coach.js' },
  { id: 'coach-settings', path: '/coach/settings', auth: 'authenticated-real-data', source: 'src/pages/CoachSettings.js' },
  { id: 'coach-share', path: '/coach/:token', auth: 'signed-out-real-token', source: 'src/pages/CoachView.js' },
  { id: 'profile', path: '/profile', auth: 'authenticated-real-data', source: 'src/pages/Profile.js' },
];
const KEYBOARD_AXE_SMOKE = [
  { surface: 'Workouts', route: '/workouts', requiredState: 'authenticated-real-data' },
  { surface: 'ActiveWorkout', route: '/workout/:planId', requiredState: 'authenticated-real-data' },
  { surface: 'ExerciseLogModal', route: '/workout/:planId', requiredState: 'authenticated-real-data' },
  { surface: 'Profile', route: '/profile', requiredState: 'authenticated-real-data' },
];
const SECRET_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/,
  /Bearer\s+(?!\[REDACTED\])[^\s]+/i,
  /\b(?:access_|refresh_)?token\s*[:=]\s*(?!\[REDACTED\])[^\s,;]+/i,
  /\bapi[_-]?key\s*[:=]\s*(?!\[REDACTED\])[^\s,;]+/i,
  /\bsecret\s*[:=]\s*(?!\[REDACTED\])[^\s,;]+/i,
  /\bpassword\s*[:=]\s*(?!\[REDACTED\])[^\s,;]+/i,
];

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(root, relativePath) {
  return JSON.parse(read(root, relativePath));
}

function exists(root, relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function add(violations, rule, file, message) {
  violations.push({ rule, file, message });
}

function includesAnyQuote(source, value) {
  return source.includes(`'${value}'`) || source.includes(`"${value}"`) || source.includes(`\`${value}\``);
}

function git(args, root) {
  return execSync(['git', ...args].join(' '), {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function expectedPublicUrl(pkg) {
  return new URL(pkg.homepage).pathname.replace(/\/?$/, '/');
}

function checkSubpathAssets(root, violations) {
  const pkg = readJson(root, 'package.json');
  const manifest = readJson(root, 'public/manifest.json');
  const html = read(root, 'public/index.html');
  const serviceWorker = read(root, 'public/service-worker.js');
  const publicUrl = expectedPublicUrl(pkg);

  if (publicUrl !== REQUIRED_SUBPATH) {
    add(violations, 'subpath-homepage', 'package.json', `homepage must resolve to ${REQUIRED_SUBPATH}.`);
  }
  for (const field of ['id', 'start_url', 'scope']) {
    if (manifest[field] !== REQUIRED_SUBPATH) {
      add(violations, 'subpath-manifest', 'public/manifest.json', `${field} must be ${REQUIRED_SUBPATH}.`);
    }
  }
  for (const asset of ['manifest.json', 'reptrack-192.png']) {
    if (!html.includes(`%PUBLIC_URL%/${asset}`)) {
      add(violations, 'subpath-html-asset', 'public/index.html', `${asset} must be referenced through %PUBLIC_URL%.`);
    }
  }
  for (const shellPath of ['./', './index.html', './manifest.json', './reptrack-192.png', './reptrack-512.png']) {
    if (!includesAnyQuote(serviceWorker, shellPath)) {
      add(violations, 'subpath-service-worker-shell', 'public/service-worker.js', `${shellPath} must stay relative for GitHub Pages subpath safety.`);
    }
  }
}

function checkRouteViewportMatrix(root, violations) {
  const app = read(root, 'src/App.js');
  const seenLabels = new Set(VIEWPORTS.map((item) => item.label));

  if (seenLabels.size !== VIEWPORTS.length) {
    add(violations, 'viewport-duplicates', 'scripts/qa/release-contracts.js', 'Viewport matrix labels must be unique.');
  }
  for (const viewport of PORTRAIT_VIEWPORTS) {
    if (viewport.width > viewport.height) {
      add(violations, 'viewport-orientation', 'scripts/qa/release-contracts.js', `${viewport.label} must be portrait.`);
    }
  }
  for (const viewport of LANDSCAPE_VIEWPORTS) {
    if (viewport.width <= viewport.height) {
      add(violations, 'viewport-orientation', 'scripts/qa/release-contracts.js', `${viewport.label} must be landscape.`);
    }
  }
  for (const route of ROUTES) {
    if (!exists(root, route.source)) {
      add(violations, 'route-source-missing', route.source, `${route.id} source is missing.`);
    }
    const literalPath = route.path.includes(':') ? route.path.replace('/:planId', '') : route.path;
    if (!app.includes(route.path) && !app.includes(literalPath)) {
      add(violations, 'route-not-registered', 'src/App.js', `${route.path} must be registered in the router.`);
    }
  }
}

function checkPwaContracts(root, violations) {
  const worker = read(root, 'public/service-worker.js');
  const controller = read(root, 'src/lib/pwaUpdateController.js');
  const index = read(root, 'src/index.js');

  const workerExpectations = [
    ['cache-first hashed assets', /isHashedAssetRequest[\s\S]+cacheFirst/],
    ['network-first build-info', /isBuildInfoRequest[\s\S]+networkFirst/],
    ['network-first navigations', /mode === ['"]navigate['"][\s\S]+networkFirst/],
    ['API/auth cache bypass', /isApiRequest[\s\S]+authorization/i],
    ['waiting worker activation', /SKIP_WAITING/],
    ['kill switch cache deletion', /REPTRACK_SW_KILL_SWITCH[\s\S]+caches\.delete[\s\S]+unregister/],
  ];
  for (const [label, pattern] of workerExpectations) {
    if (!pattern.test(worker)) add(violations, 'pwa-service-worker-contract', 'public/service-worker.js', `${label} contract is missing.`);
  }

  const controllerExpectations = [
    ['production registration from app mount', /registerPwaUpdateController\(\)/, index, 'src/index.js'],
    ['six-hour interval', /CHECK_INTERVAL_MS\s*=\s*6\s*\*\s*60\s*\*\s*60\s*\*\s*1000/, controller, 'src/lib/pwaUpdateController.js'],
    ['visibility return check', /visibilitychange[\s\S]+checkNow/, controller, 'src/lib/pwaUpdateController.js'],
    ['startup check', /await checkNow\(\)/, controller, 'src/lib/pwaUpdateController.js'],
    ['no-store build-info fetch', /build-info\.json\?ts=.*cache:\s*['"]no-store['"]/s, controller, 'src/lib/pwaUpdateController.js'],
    ['waiting banner reload callback', /postMessage\(\{\s*type:\s*['"]SKIP_WAITING['"]\s*\}\)/, controller, 'src/lib/pwaUpdateController.js'],
    ['unregister kill switch', /REPTRACK_SW_KILL_SWITCH[\s\S]+registration\.unregister\(\)/, controller, 'src/lib/pwaUpdateController.js'],
  ];
  for (const [label, pattern, source, file] of controllerExpectations) {
    if (!pattern.test(source)) add(violations, 'pwa-update-contract', file, `${label} contract is missing.`);
  }
}

function checkDiagnosticsContracts(root, violations) {
  const diagnostics = read(root, 'src/lib/clientDiagnostics.js');
  const runtime = read(root, 'src/lib/clientDiagnosticsRuntime.js');
  const panel = read(root, 'src/components/DiagnosticsPanel.js');
  const index = read(root, 'src/index.js');

  const expectations = [
    ['last 20 errors cap', /MAX_ERRORS\s*=\s*20/, diagnostics, 'src/lib/clientDiagnostics.js'],
    ['email redaction', /REDACTED_EMAIL/, diagnostics, 'src/lib/clientDiagnostics.js'],
    ['JWT redaction', /REDACTED_JWT/, diagnostics, 'src/lib/clientDiagnostics.js'],
    ['bearer redaction', /Bearer\s+\[REDACTED\]/, diagnostics, 'src/lib/clientDiagnostics.js'],
    ['secret-field redaction', /(?:token|api\[_-\]\?key|secret|password|authorization)[\s\S]+REDACTED/, diagnostics, 'src/lib/clientDiagnostics.js'],
    ['stack exclusion', !/\.stack\b/.test(diagnostics), diagnostics, 'src/lib/clientDiagnostics.js'],
    ['build ID in snapshot', /buildId/, diagnostics, 'src/lib/clientDiagnostics.js'],
    ['queue depth in snapshot', /queueDepth/, diagnostics, 'src/lib/clientDiagnostics.js'],
    ['last sync in snapshot', /lastSuccessfulSyncAt/, diagnostics, 'src/lib/clientDiagnostics.js'],
    ['global error handler installed', /installGlobalDiagnostics\(window,\s*clientDiagnostics\)/, index, 'src/index.js'],
    ['runtime reporter uses client diagnostics', /clientDiagnostics\.recordError/, runtime, 'src/lib/clientDiagnosticsRuntime.js'],
    ['diagnostics panel privacy copy', /redacted|sanitized/i, panel, 'src/components/DiagnosticsPanel.js'],
  ];
  for (const [label, patternOrBoolean, source, file] of expectations) {
    const ok = typeof patternOrBoolean === 'boolean' ? patternOrBoolean : patternOrBoolean.test(source);
    if (!ok) add(violations, 'diagnostics-contract', file, `${label} contract is missing.`);
  }
}

function checkRollbackMetadata(root, violations) {
  const checklist = read(root, 'docs/qa-checklists.md');
  const lifecycle = read(root, 'docs/operations/pwa-update-lifecycle.md');
  const pkg = readJson(root, 'package.json');

  if (!/previous production commit/i.test(checklist) || !/rollback command/i.test(checklist)) {
    add(violations, 'rollback-evidence-contract', 'docs/qa-checklists.md', 'Rollback checklist must require previous commit/build ID and command sequence.');
  }
  if (!/REPTRACK_SW_KILL_SWITCH/.test(lifecycle)) {
    add(violations, 'rollback-kill-switch-contract', 'docs/operations/pwa-update-lifecycle.md', 'PWA kill switch must be documented.');
  }
  if (!pkg.scripts?.predeploy?.includes('check-clean')) {
    add(violations, 'rollback-deploy-contract', 'package.json', 'predeploy must retain clean-tree protection.');
  }
}

function checkProductionResponseBuildId(root, violations) {
  const pkg = readJson(root, 'package.json');
  const metadataScript = read(root, 'scripts/validate-build-metadata.js');
  const buildInfoPath = path.join(root, 'build', 'build-info.json');

  if (!pkg.scripts?.prebuild?.includes('write-build-info')) {
    add(violations, 'build-id-generation-contract', 'package.json', 'prebuild must generate build-info metadata.');
  }
  if (!pkg.scripts?.predeploy?.includes('validate-build-metadata.js --require-origin-main')) {
    add(violations, 'production-origin-contract', 'package.json', 'predeploy must validate build metadata and origin/main provenance.');
  }
  if (!/commit must be a full 40-character/.test(metadataScript) || !/buildId must exactly match/.test(metadataScript)) {
    add(violations, 'build-id-validation-contract', 'scripts/validate-build-metadata.js', 'Build metadata validator must enforce full SHA and buildId.');
  }
  if (fs.existsSync(buildInfoPath)) {
    const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
    let head = null;
    try {
      head = git(['rev-parse', 'HEAD'], root);
    } catch {
      add(violations, 'build-id-git-contract', 'build/build-info.json', 'Cannot read HEAD for build metadata validation.');
    }
    if (head && buildInfo.commit !== head) {
      add(violations, 'build-id-response-contract', 'build/build-info.json', 'Built build-info.json commit must match exact HEAD.');
    }
    if (buildInfo.buildId !== buildInfo.commit?.slice(0, 8)) {
      add(violations, 'build-id-response-contract', 'build/build-info.json', 'Built buildId must match commit prefix.');
    }
  }
}

function validateDiagnosticsSnapshot(snapshot) {
  const violations = [];
  const text = JSON.stringify(snapshot);
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) violations.push(`Diagnostics snapshot contains unredacted sensitive data matching ${pattern}.`);
  }
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    violations.push('Diagnostics snapshot must be an object.');
    return violations;
  }
  for (const field of ['buildId', 'syncStatus', 'queueDepth', 'lastSuccessfulSyncAt', 'syncFailures', 'errors']) {
    if (!(field in snapshot)) violations.push(`Diagnostics snapshot is missing ${field}.`);
  }
  if (!Array.isArray(snapshot.errors)) {
    violations.push('Diagnostics errors must be an array.');
  } else if (snapshot.errors.length > 20) {
    violations.push('Diagnostics errors must contain at most 20 entries.');
  }
  return violations;
}

function scanReleaseContracts(root = process.cwd()) {
  const violations = [];
  checkSubpathAssets(root, violations);
  checkRouteViewportMatrix(root, violations);
  checkPwaContracts(root, violations);
  checkDiagnosticsContracts(root, violations);
  checkRollbackMetadata(root, violations);
  checkProductionResponseBuildId(root, violations);
  return violations.sort((a, b) => `${a.rule}:${a.file}`.localeCompare(`${b.rule}:${b.file}`));
}

function evidenceMatrix() {
  return {
    generatedAt: new Date().toISOString(),
    routes: ROUTES,
    viewports: VIEWPORTS,
    keyboardAxeSmoke: KEYBOARD_AXE_SMOKE,
    manualGates: [
      'iOS Safari PWA install/update/haptic confirmation',
      'Android Chrome PWA install/update/haptic confirmation',
      'Real two-device active-session lifecycle for all R3 cases',
      'Authenticated real-data route matrix and destructive round trips',
      'Production read-only response/build-id validation after approval',
    ],
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const rootArg = args.find((arg) => !arg.startsWith('-'));
  const root = path.resolve(rootArg || process.cwd());
  const violations = scanReleaseContracts(root);
  if (args.includes('--print-matrix')) {
    console.log(JSON.stringify(evidenceMatrix(), null, 2));
  }
  if (violations.length === 0) {
    console.log('Release QA contracts: PASS');
  } else {
    console.error(`Release QA contracts: FAIL (${violations.length})`);
    for (const violation of violations) {
      console.error(`- [${violation.rule}] ${violation.file}: ${violation.message}`);
    }
    process.exitCode = 1;
  }
}

module.exports = {
  KEYBOARD_AXE_SMOKE,
  LANDSCAPE_VIEWPORTS,
  PORTRAIT_VIEWPORTS,
  ROUTES,
  VIEWPORTS,
  evidenceMatrix,
  scanReleaseContracts,
  validateDiagnosticsSnapshot,
};
