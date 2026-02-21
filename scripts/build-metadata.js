const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function runGit(...args) {
  try {
    return execSync(['git', ...args].join(' '), {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (err) {
    return null;
  }
}

function readPackageVersion() {
  try {
    const pkg = require(path.join(ROOT, 'package.json'));
    return pkg.version || '0.0.0';
  } catch (err) {
    return '0.0.0';
  }
}

function generateBuildMetadata(options = {}) {
  const commit = options.commit || runGit('rev-parse HEAD') || 'unknown';
  const shortCommit = commit === 'unknown' ? 'unknown' : commit.slice(0, 8);
  const version = options.version || readPackageVersion();
  const buildId = options.buildId || process.env.REACT_APP_BUILD_ID || shortCommit || `${Date.now()}`;
  const builtAt = options.builtAt || new Date().toISOString();

  return {
    buildId,
    version,
    commit,
    builtAt,
  };
}

module.exports = { generateBuildMetadata };
