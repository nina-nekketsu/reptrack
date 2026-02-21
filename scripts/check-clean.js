const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function checkCleanTree() {
  const status = execSync('git status --porcelain', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

  if (status) {
    console.error('🚨 Git working tree is not clean. Commit or stash your changes before deploying.');
    console.error(status);
    process.exit(1);
  }
}

checkCleanTree();
