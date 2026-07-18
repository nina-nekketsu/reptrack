#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.css']);
const FAKE_SURFACE_MARKERS = ["Today's goal", 'Upper Body', 'Yesterday', "Today's Workout", 'Tricep Dips'];
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
const GRADIENT_PATTERN = /(?:linear|radial|conic)-gradient\s*\(/i;

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

function scanRepository(root) {
  const violations = [];
  const srcRoot = path.join(root, 'src');
  const sourceFiles = walk(srcRoot).filter((file) => SOURCE_EXTENSIONS.has(path.extname(file)));

  for (const file of sourceFiles) {
    const rel = relative(root, file);
    const content = fs.readFileSync(file, 'utf8');

    if (FAKE_SURFACE_MARKERS.some((marker) => content.includes(marker))) {
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

  return violations.sort((a, b) => `${a.rule}:${a.file}`.localeCompare(`${b.rule}:${b.file}`));
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
