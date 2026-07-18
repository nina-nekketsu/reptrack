const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { validateBuildMetadata } = require('./validate-build-metadata');

function write(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function validFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reptrack-build-metadata-'));
  const metadata = {
    buildId: '12345678',
    version: '0.1.0',
    commit: '1234567890abcdef1234567890abcdef12345678',
    builtAt: '2026-07-18T10:00:00.000Z',
  };
  write(root, 'public/build-info.json', `${JSON.stringify(metadata, null, 2)}\n`);
  write(root, '.env.production.local', [
    'REACT_APP_SUPABASE_URL=https://example.supabase.co',
    'REACT_APP_BUILD_ID=12345678',
    'REACT_APP_BUILD_COMMIT=1234567890abcdef1234567890abcdef12345678',
    'REACT_APP_BUILD_VERSION=0.1.0',
    'REACT_APP_BUILD_TIME=2026-07-18T10:00:00.000Z',
    '',
  ].join('\n'));
  return root;
}

test('accepts exact build metadata mirrored into the production env file', () => {
  assert.deepEqual(validateBuildMetadata({ root: validFixture() }), []);
});

test('rejects short commits, mismatched build ids and invalid timestamps', () => {
  const root = validFixture();
  write(root, 'public/build-info.json', JSON.stringify({
    buildId: '12345678',
    version: '0.1.0',
    commit: 'abcdef12',
    builtAt: 'not-a-date',
  }));

  const violations = validateBuildMetadata({ root });
  assert.match(violations.join('\n'), /full 40-character/);
  assert.match(violations.join('\n'), /first 8 characters/);
  assert.match(violations.join('\n'), /valid ISO timestamp/);
});

test('rejects env values that do not match the public build metadata', () => {
  const root = validFixture();
  write(root, '.env.production.local', [
    'REACT_APP_BUILD_ID=wrong',
    'REACT_APP_BUILD_COMMIT=wrong',
    'REACT_APP_BUILD_VERSION=wrong',
    'REACT_APP_BUILD_TIME=wrong',
    '',
  ].join('\n'));

  const violations = validateBuildMetadata({ root });
  assert.equal(violations.filter((violation) => /must match/.test(violation)).length, 4);
});
