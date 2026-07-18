#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function runGit(args, options = {}) {
  const root = options.root || ROOT;
  return execSync(['git', ...args].join(' '), {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.pipeStderr ? 'pipe' : 'ignore'],
  }).trim();
}

function checkCleanTree({ root = ROOT, git = runGit } = {}) {
  const status = git(['status', '--porcelain'], { root });
  if (status) {
    console.error('Git working tree is not clean. Commit or stash your changes before deploying.');
    console.error(status);
    return false;
  }
  return true;
}

function checkOriginMainProvenance({ root = ROOT, git = runGit } = {}) {
  let head;
  let originMain;
  try {
    head = git(['rev-parse', 'HEAD'], { root });
    originMain = git(['rev-parse', '--verify', 'origin/main'], { root });
  } catch (error) {
    console.error('Cannot verify origin/main provenance. Fetch origin/main before deploying.');
    return false;
  }

  try {
    git(['merge-base', '--is-ancestor', head, 'origin/main'], { root });
  } catch (error) {
    console.error(`Build commit ${head} is not reachable from origin/main (${originMain}).`);
    console.error('Deploy only from a commit already present on origin/main.');
    return false;
  }

  return true;
}

function runPredeployChecks(options = {}) {
  const checks = [
    checkCleanTree(options),
    checkOriginMainProvenance(options),
  ];
  return checks.every(Boolean);
}

if (require.main === module) {
  if (!runPredeployChecks()) process.exit(1);
  console.log('Predeploy git checks: PASS');
}

module.exports = {
  checkCleanTree,
  checkOriginMainProvenance,
  runPredeployChecks,
};
