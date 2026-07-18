#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.css']);
const FAKE_SURFACE_MARKERS = [
  "Today's goal",
  'Ready to crush it today?',
  '5 days',
  "Today's Workout",
  'Est. 45 min',
];
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
const GRADIENT_PATTERN = /(?:linear|radial|conic)-gradient\s*\(/i;
const BASELINE_PATH = path.join('docs', 'contracts', 'prd-static-baseline.json');

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(target));
    else files.push(target);
  }
  return files;
}

function relative(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function add(violations, rule, file, message) {
  violations.push({ rule, file, message });
}

function violationKey(violation) {
  return `${violation.rule}\t${violation.file}`;
}

function readBaseline(root) {
  const target = path.join(root, BASELINE_PATH);
  if (!fs.existsSync(target)) return new Set();
  const entries = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (!Array.isArray(entries)) {
    throw new Error(`${BASELINE_PATH} must contain an array.`);
  }
  return new Set(entries.map((entry) => `${entry.rule}\t${entry.file}`));
}

function readJson(root, relativePath, violations, rule) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
  } catch (error) {
    add(violations, rule, relativePath, `Cannot read JSON contract: ${error.message}`);
    return null;
  }
}

function isProductionSource(rel) {
  return !/(^|\.)(test|spec)\.[jt]sx?$/.test(rel);
}

function validateSubpathAssets(root, violations) {
  const pkg = readJson(root, 'package.json', violations, 'invalid-subpath-assets');
  const manifest = readJson(root, 'public/manifest.json', violations, 'invalid-subpath-assets');
  const indexPath = path.join(root, 'public', 'index.html');
  const serviceWorkerPath = path.join(root, 'public', 'service-worker.js');
  const html = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
  const serviceWorker = fs.existsSync(serviceWorkerPath) ? fs.readFileSync(serviceWorkerPath, 'utf8') : '';
  const homepagePath = (() => {
    try {
      return new URL(pkg?.homepage || '').pathname.replace(/\/?$/, '/');
    } catch {
      return '';
    }
  })();

  if (homepagePath !== '/reptrack/') {
    add(violations, 'invalid-subpath-assets', 'package.json', 'homepage must target the /reptrack/ GitHub Pages subpath.');
  }
  if (manifest?.id !== homepagePath || manifest?.start_url !== homepagePath || manifest?.scope !== homepagePath) {
    add(violations, 'invalid-subpath-assets', 'public/manifest.json', 'Manifest id, start_url, and scope must match the homepage subpath.');
  }
  for (const asset of ['manifest.json', 'reptrack-192.png']) {
    if (!html.includes(`%PUBLIC_URL%/${asset}`)) {
      add(violations, 'invalid-subpath-assets', 'public/index.html', `HTML must reference ${asset} through %PUBLIC_URL%.`);
    }
  }
  for (const shellPath of ['./', './index.html', './manifest.json', './reptrack-192.png', './reptrack-512.png']) {
    if (!serviceWorker.includes(`'${shellPath}'`) && !serviceWorker.includes(`"${shellPath}"`)) {
      add(violations, 'invalid-subpath-assets', 'public/service-worker.js', `Service worker shell cache must use relative subpath-safe ${shellPath}.`);
    }
  }
}

function scanRepository(root, options = {}) {
  const violations = [];
  const srcRoot = path.join(root, 'src');
  const sourceFiles = walk(srcRoot).filter((file) => SOURCE_EXTENSIONS.has(path.extname(file)));

  for (const file of sourceFiles) {
    const rel = relative(root, file);
    const content = fs.readFileSync(file, 'utf8');

    if (isProductionSource(rel) && FAKE_SURFACE_MARKERS.some((marker) => content.includes(marker))) {
      add(violations, 'fake-surface', rel, 'Fabricated product-surface copy remains in reachable source.');
    }

    if (/\.[jt]sx?$/.test(file) && !rel.startsWith('src/components/icons/') && EMOJI_PATTERN.test(content)) {
      add(violations, 'functional-emoji', rel, 'Functional emoji must be replaced with local SVG icons.');
    }

    if (/\.[jt]sx?$/.test(file) && /style\s*=\s*\{\s*\{/.test(content)) {
      add(violations, 'inline-visual-style', rel, 'Inline visual style objects must be replaced by design-system classes.');
    }

    const isTokenSource = rel === 'src/index.css';
    const isIconSource = rel.startsWith('src/components/icons/');
    if (!isTokenSource && !isIconSource && HEX_PATTERN.test(content)) {
      add(violations, 'legacy-color', rel, 'Hard-coded color exists outside the canonical token/icon source.');
    }
    HEX_PATTERN.lastIndex = 0;

    if (GRADIENT_PATTERN.test(content)) {
      add(violations, 'legacy-gradient', rel, 'Legacy gradient remains; Gym Floor uses semantic flat surfaces.');
    }
  }

  const requiredFiles = [
    ['supabase/schema_current.sql', 'missing-schema-current', 'Canonical Supabase schema snapshot is missing.'],
    ['docs/qa-checklists.md', 'missing-qa-checklist', 'Executable release QA checklist is missing.'],
    ['public/service-worker.js', 'missing-service-worker', 'Offline app-shell service worker is missing.'],
  ];
  for (const [requiredPath, rule, message] of requiredFiles) {
    if (!fs.existsSync(path.join(root, requiredPath))) add(violations, rule, requiredPath, message);
  }

  const packagePath = path.join(root, 'package.json');
  let predeploy = '';
  try {
    predeploy = JSON.parse(fs.readFileSync(packagePath, 'utf8')).scripts?.predeploy || '';
  } catch (error) {
    add(violations, 'unsafe-predeploy', 'package.json', `Cannot read predeploy contract: ${error.message}`);
  }
  const cleanIndex = predeploy.indexOf('check-clean');
  const buildIndex = predeploy.indexOf('build');
  if (cleanIndex < 0 || buildIndex < 0 || cleanIndex > buildIndex) {
    add(violations, 'unsafe-predeploy', 'package.json', 'predeploy must run the clean-tree gate before the production build.');
  }
  if (!predeploy.includes('validate-build-metadata')) {
    add(violations, 'unsafe-predeploy', 'package.json', 'predeploy must validate exact build metadata after the production build.');
  }

  validateSubpathAssets(root, violations);

  const sorted = violations.sort((a, b) => `${a.rule}:${a.file}`.localeCompare(`${b.rule}:${b.file}`));
  if (options.includeBaseline === true) return sorted;

  const baseline = readBaseline(root);
  return sorted.filter((violation) => !baseline.has(violationKey(violation)));
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || process.cwd());
  const violations = scanRepository(root);
  if (violations.length === 0) {
    console.log('PRD static contracts: PASS');
  } else {
    console.error(`PRD static contracts: FAIL (${violations.length})`);
    for (const violation of violations) {
      console.error(`- [${violation.rule}] ${violation.file}: ${violation.message}`);
    }
    process.exitCode = 1;
  }
}

module.exports = { scanRepository };
