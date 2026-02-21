const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BUILD_JSON_PATH = path.join(ROOT, 'public', 'build.json');

function runGit(...args) {
  try {
    return execSync(['git', ...args].join(' '), { cwd: ROOT, encoding: 'utf8' }).trim();
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
  const buildId =
    options.buildId ||
    process.env.REACT_APP_BUILD_ID ||
    shortCommit ||
    `${Date.now()}`;

  const metadata = {
    buildId,
    version,
    commit,
  };

  try {
    fs.writeFileSync(BUILD_JSON_PATH, JSON.stringify(metadata, null, 2) + '\n');
  } catch (err) {
    console.error('Failed to write build metadata:', err);
    throw err;
  }

  return metadata;
}

module.exports = { generateBuildMetadata, BUILD_JSON_PATH };

if (require.main === module) {
  const metadata = generateBuildMetadata();
  console.log(`Generated build.json → buildId=${metadata.buildId} commit=${metadata.commit}`);
}
