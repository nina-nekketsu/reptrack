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
  const generated = [];
  if (metadata.buildId) generated.push(`REACT_APP_BUILD_ID=${metadata.buildId}`);
  if (metadata.commit) generated.push(`REACT_APP_BUILD_COMMIT=${metadata.commit}`);
  if (metadata.version) generated.push(`REACT_APP_BUILD_VERSION=${metadata.version}`);
  if (metadata.builtAt) generated.push(`REACT_APP_BUILD_TIME=${metadata.builtAt}`);
  if (generated.length === 0) return;

  const generatedKeys = new Set(generated.map(line => line.slice(0, line.indexOf('='))));
  const existing = fs.existsSync(targetPath)
    ? fs.readFileSync(targetPath, 'utf8').split(/\r?\n/)
    : [];
  const preserved = existing.filter(line => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    return !match || !generatedKeys.has(match[1]);
  });
  while (preserved.length > 0 && preserved[preserved.length - 1] === '') preserved.pop();

  const payload = [...preserved, ...generated].join('\n') + '\n';
  fs.writeFileSync(targetPath, payload, 'utf8');
  fs.chmodSync(targetPath, 0o600);
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

module.exports = { writeBuildInfo, writeEnvFile, PUBLIC_BUILD_INFO };
