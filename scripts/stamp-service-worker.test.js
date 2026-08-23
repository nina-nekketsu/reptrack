const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { stampServiceWorker } = require('./stamp-service-worker');

function fixture(buildId) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reptrack-worker-stamp-'));
  const buildDir = path.join(root, 'build');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(
    path.join(buildDir, 'build-info.json'),
    `${JSON.stringify({ buildId })}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(buildDir, 'service-worker.js'),
    "const CACHE_VERSION = 'offline-shell-__REPTRACK_BUILD_ID__';\n",
    'utf8'
  );
  return root;
}

test('stamps the deployed service worker with the current build id', () => {
  const root = fixture('8cfe23f8');

  const result = stampServiceWorker({ root });
  const worker = fs.readFileSync(path.join(root, 'build', 'service-worker.js'), 'utf8');

  assert.equal(result.buildId, '8cfe23f8');
  assert.match(worker, /offline-shell-8cfe23f8/);
  assert.doesNotMatch(worker, /__REPTRACK_BUILD_ID__/);
});

test('different releases produce byte-distinct service workers', () => {
  const firstRoot = fixture('8cfe23f8');
  const secondRoot = fixture('cafebabe');

  stampServiceWorker({ root: firstRoot });
  stampServiceWorker({ root: secondRoot });

  const first = fs.readFileSync(path.join(firstRoot, 'build', 'service-worker.js'), 'utf8');
  const second = fs.readFileSync(path.join(secondRoot, 'build', 'service-worker.js'), 'utf8');
  assert.notEqual(first, second);
});

test('refuses to publish a worker when the build id is invalid', () => {
  const root = fixture('not-a-build');
  assert.throws(() => stampServiceWorker({ root }), /valid 8-character hexadecimal build id/);
});
