const fs = require('fs');
const path = require('path');
const { generateBuildMetadata } = require('./build-metadata');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_BUILD_INFO = path.join(ROOT, 'public', 'build-info.json');
const ENV_FILE = path.join(ROOT, '.env.production.local');

function writeJson(targetPath, data) {
  const payload = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(targetPath, payload, 'utf8');
}

function writeEnvFile(targetPath, metadata) {
  const lines = [];
  if (metadata.buildId) lines.push(`REACT_APP_BUILD_ID=${metadata.buildId}`);
  if (metadata.commit) lines.push(`REACT_APP_BUILD_COMMIT=${metadata.commit}`);
  if (metadata.version) lines.push(`REACT_APP_BUILD_VERSION=${metadata.version}`);
  if (metadata.builtAt) lines.push(`REACT_APP_BUILD_TIME=${metadata.builtAt}`);
  if (lines.length === 0) return;
  const payload = lines.join('\n') + '\n';
  fs.writeFileSync(targetPath, payload, 'utf8');
}

function writeBuildInfo(options = {}) {
  const metadata = generateBuildMetadata(options);
  writeJson(PUBLIC_BUILD_INFO, metadata);
  writeEnvFile(ENV_FILE, metadata);
  return metadata;
}

if (require.main === module) {
  const metadata = writeBuildInfo();
  console.log(
    `Wrote build info ${metadata.buildId} (commit ${metadata.commit}) → ${PUBLIC_BUILD_INFO}`
  );
}

module.exports = { writeBuildInfo, PUBLIC_BUILD_INFO };
