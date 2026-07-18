const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scanRepository } = require('./check-prd-static-contracts');

function write(root, relativePath, content = '') {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function validFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reptrack-prd-valid-'));
  write(root, 'src/index.css', ':root { --bg-0: #0b0d10; --go: #73e2a7; } body { background: var(--bg-0); }');
  write(root, 'src/App.js', "export default function App(){ return 'Today'; }");
  write(root, 'src/pages/Today.js', "export default function Today(){ return 'Real data'; }");
  write(root, 'src/components/icons/PlayIcon.js', "export default function PlayIcon(){ return '<svg fill=currentColor />'; }");
  write(root, 'supabase/schema_current.sql', 'create table exercise_logs(id uuid);');
  write(root, 'docs/qa-checklists.md', '# QA');
  write(root, 'public/service-worker.js', "self.addEventListener('fetch', () => {});");
  write(root, 'public/index.html', '<link rel="manifest" href="%PUBLIC_URL%/manifest.json"><link rel="apple-touch-icon" href="%PUBLIC_URL%/reptrack-192.png">');
  write(root, 'public/manifest.json', JSON.stringify({ id: '/reptrack/', start_url: '/reptrack/', scope: '/reptrack/' }));
  write(root, 'public/service-worker.js', "const SHELL_PATHS = ['./', './index.html', './manifest.json', './reptrack-192.png', './reptrack-512.png'];");
  write(root, 'package.json', JSON.stringify({
    homepage: 'https://nina-nekketsu.github.io/reptrack',
    scripts: {
      predeploy: 'node scripts/check-clean.js && npm run build && node scripts/validate-build-metadata.js --require-origin-main',
    },
  }));
  return root;
}

test('accepts a repository that satisfies the static PRD contracts', () => {
  const root = validFixture();
  assert.deepEqual(scanRepository(root), []);
});

test('reports each prohibited legacy or release-safety condition', () => {
  const root = validFixture();
  write(root, 'src/pages/Home.js', "export default function Home(){ return `Today's goal Upper Body Yesterday`; }");
  write(root, 'src/components/DeleteButton.js', "export default function DeleteButton(){ return <button style={{color:'#e94560'}}>🗑️</button>; }");
  write(root, 'src/legacy.css', '.hero { background: linear-gradient(#4c4cff, #7c6af7); }');
  fs.rmSync(path.join(root, 'supabase/schema_current.sql'));
  fs.rmSync(path.join(root, 'docs/qa-checklists.md'));
  fs.rmSync(path.join(root, 'public/service-worker.js'));
  write(root, 'package.json', JSON.stringify({ scripts: { predeploy: 'npm run build' } }));

  const violations = scanRepository(root);
  const rules = new Set(violations.map((violation) => violation.rule));
  assert.deepEqual(rules, new Set([
    'fake-surface',
    'functional-emoji',
    'inline-visual-style',
    'legacy-color',
    'legacy-gradient',
    'missing-schema-current',
    'missing-qa-checklist',
    'missing-service-worker',
    'invalid-subpath-assets',
    'unsafe-predeploy',
  ]));
});

test('rejects GitHub Pages subpath asset drift', () => {
  const root = validFixture();
  write(root, 'package.json', JSON.stringify({
    homepage: 'https://example.com/',
    scripts: {
      predeploy: 'node scripts/check-clean.js && npm run build && node scripts/validate-build-metadata.js',
    },
  }));
  write(root, 'public/manifest.json', JSON.stringify({ id: '/', start_url: '/', scope: '/' }));
  write(root, 'public/index.html', '<link rel="manifest" href="/manifest.json">');
  write(root, 'public/service-worker.js', "const SHELL_PATHS = ['/reptrack/', '/reptrack/index.html'];");

  const violations = scanRepository(root);
  assert.equal(violations.some((item) => item.rule === 'invalid-subpath-assets'), true);
});

test('allows explicitly baselined legacy findings but still reports new findings', () => {
  const root = validFixture();
  write(root, 'docs/contracts/prd-static-baseline.json', JSON.stringify([
    {
      rule: 'legacy-color',
      file: 'src/components/Card.css',
      message: 'Known legacy color before the release QA lane.',
    },
  ]));
  write(root, 'src/components/Card.css', '.card { color: #ffffff; }');
  write(root, 'src/components/NewCard.css', '.new-card { color: #ffffff; }');

  const violations = scanRepository(root);
  assert.equal(violations.filter((item) => item.rule === 'legacy-color').length, 1);
  assert.equal(violations.find((item) => item.rule === 'legacy-color').file, 'src/components/NewCard.css');
});

test('allows color literals only in the token source and local icon source', () => {
  const root = validFixture();
  write(root, 'src/components/Card.css', '.card { color: #ffffff; }');
  const violations = scanRepository(root);
  assert.equal(violations.filter((item) => item.rule === 'legacy-color').length, 1);
  assert.match(violations.find((item) => item.rule === 'legacy-color').file, /Card\.css$/);
});

test('does not treat legitimate plan and exercise names as fake surfaces', () => {
  const root = validFixture();
  write(root, 'src/pages/Workouts.js', "export default function Workouts(){ return 'Upper Body Day Tricep Dips'; }");
  write(root, 'src/pages/productSurfaces.test.js', "test('marker assertion', () => `Today's goal`);");

  const violations = scanRepository(root);
  assert.equal(violations.filter((item) => item.rule === 'fake-surface').length, 0);
});
