const fs = require('node:fs');
const path = require('node:path');

const TOKEN = '__REPTRACK_BUILD_ID__';
const BUILD_ID_PATTERN = /^[a-f0-9]{8}$/i;

function stampServiceWorker({ root = path.resolve(__dirname, '..') } = {}) {
  const buildDir = path.join(root, 'build');
  const buildInfoPath = path.join(buildDir, 'build-info.json');
  const workerPath = path.join(buildDir, 'service-worker.js');
  const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
  const buildId = buildInfo?.buildId;

  if (!BUILD_ID_PATTERN.test(buildId || '')) {
    throw new Error('Service worker stamping requires a valid 8-character hexadecimal build id');
  }

  const source = fs.readFileSync(workerPath, 'utf8');
  if (!source.includes(TOKEN)) {
    throw new Error(`Service worker is missing build token ${TOKEN}`);
  }

  const stamped = source.replaceAll(TOKEN, buildId);
  fs.writeFileSync(workerPath, stamped, 'utf8');
  return { buildId, workerPath };
}

if (require.main === module) {
  const { buildId, workerPath } = stampServiceWorker();
  console.log(`Stamped service worker for build ${buildId} → ${workerPath}`);
}

module.exports = { stampServiceWorker, TOKEN };
