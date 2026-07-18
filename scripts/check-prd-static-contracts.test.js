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
  write(root, 'package.json', JSON.stringify({ scripts: { predeploy: 'node scripts/check-clean.js && npm run build' } }));
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
    'unsafe-predeploy',
  ]));
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
