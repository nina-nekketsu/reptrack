#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SHA_PATTERN = /^[0-9a-f]{40}$/;

function runGit(args, root = ROOT) {
  return execSync(['git', ...args].join(' '), {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]])
  );
}

function validateBuildMetadata({
  root = ROOT,
  requireOriginMain = false,
} = {}) {
  const violations = [];
  const buildInfoPath = path.join(root, 'public', 'build-info.json');
  const envPath = path.join(root, '.env.production.local');

  if (!fs.existsSync(buildInfoPath)) {
    return [`Missing ${path.relative(root, buildInfoPath)}. Run npm run write:build-info.`];
  }

  let metadata;
  try {
    metadata = readJson(buildInfoPath);
  } catch (error) {
    return [`Invalid build metadata JSON: ${error.message}`];
  }

  const env = readEnv(envPath);
  if (!SHA_PATTERN.test(metadata.commit || '')) {
    violations.push('build-info.json commit must be a full 40-character lowercase git SHA.');
  }
  if (!metadata.buildId || metadata.buildId !== metadata.commit?.slice(0, 8)) {
    violations.push('build-info.json buildId must exactly match the first 8 characters of commit.');
  }
  if (!metadata.version || env.REACT_APP_BUILD_VERSION !== metadata.version) {
    violations.push('REACT_APP_BUILD_VERSION must match build-info.json version.');
  }
  if (env.REACT_APP_BUILD_ID !== metadata.buildId) {
    violations.push('REACT_APP_BUILD_ID must match build-info.json buildId.');
  }
  if (env.REACT_APP_BUILD_COMMIT !== metadata.commit) {
    violations.push('REACT_APP_BUILD_COMMIT must match build-info.json commit.');
  }
  if (env.REACT_APP_BUILD_TIME !== metadata.builtAt) {
    violations.push('REACT_APP_BUILD_TIME must match build-info.json builtAt.');
  }
  if (!metadata.builtAt || Number.isNaN(new Date(metadata.builtAt).getTime())) {
    violations.push('build-info.json builtAt must be a valid ISO timestamp.');
  }

  if (requireOriginMain) {
    try {
      runGit(['merge-base', '--is-ancestor', metadata.commit, 'origin/main'], root);
    } catch (error) {
      violations.push(`build metadata commit ${metadata.commit} is not reachable from origin/main.`);
    }
  }

  return violations;
}

if (require.main === module) {
  const requireOriginMain = process.argv.includes('--require-origin-main');
  const violations = validateBuildMetadata({ requireOriginMain });
  if (violations.length > 0) {
    console.error(`Build metadata validation: FAIL (${violations.length})`);
    violations.forEach((violation) => console.error(`- ${violation}`));
    process.exit(1);
  }
  console.log('Build metadata validation: PASS');
}

module.exports = { validateBuildMetadata };
