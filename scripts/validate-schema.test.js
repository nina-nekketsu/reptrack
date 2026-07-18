const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  collectSourceContracts,
  validateCanonicalSchema,
} = require('./validate-schema');

const ROOT = path.resolve(__dirname, '..');

test('canonical schema defines every table and RPC used by source', () => {
  const contracts = collectSourceContracts(path.join(ROOT, 'src'));
  assert.deepEqual([...contracts.tables].sort(), [
    'active_sessions',
    'coach_shares',
    'coach_workout_sessions',
    'exercise_logs',
    'exercises',
    'user_settings',
    'workout_plans',
    'workout_timer_state',
  ]);
  assert.deepEqual([...contracts.rpcs].sort(), [
    'get_coach_data',
    'merge_active_session',
  ]);

  assert.deepEqual(validateCanonicalSchema(ROOT), []);
});

test('canonical schema uses flat JSONB logs and owner-scoped security', () => {
  const violations = validateCanonicalSchema(ROOT);
  assert.equal(violations.some((item) => item.rule === 'flat-log-contract'), false);
  assert.equal(violations.some((item) => item.rule === 'missing-rls'), false);
  assert.equal(violations.some((item) => item.rule === 'unsafe-security-definer'), false);
});

test('canonical schema excludes obsolete normalized and secret-printing contracts', () => {
  const violations = validateCanonicalSchema(ROOT);
  assert.equal(violations.some((item) => item.rule === 'obsolete-schema'), false);
  assert.equal(violations.some((item) => item.rule === 'secret-output'), false);
  assert.equal(violations.some((item) => item.rule === 'arbitrary-user'), false);
});

test('coach-share migration and operator runbooks are additive and secret-safe', () => {
  const migration = fs.readFileSync(
    path.join(ROOT, 'supabase/migrations/20260718123000_coach_share_flat_jsonb.sql'),
    'utf8',
  );
  const rotation = fs.readFileSync(
    path.join(ROOT, 'docs/operations/coach-share-key-rotation.md'),
    'utf8',
  );
  const bootstrap = fs.readFileSync(
    path.join(ROOT, 'docs/operations/schema-bootstrap-and-rls-validation.md'),
    'utf8',
  );

  assert.match(migration, /alter table if exists public\.coach_shares[\s\S]*add column if not exists rotated_at/i);
  assert.match(migration, /from public\.exercise_logs/i);
  assert.match(migration, /join share s on s\.user_id = l\.user_id/i);
  assert.doesNotMatch(migration, /auth\.users\s+limit\s+1|select\s+api_key/i);
  assert.doesNotMatch(migration, /\b(drop table|truncate|delete from)\b/i);
  assert.match(rotation, /previous link will stop working/i);
  assert.match(rotation, /Hayato handoff/i);
  assert.match(bootstrap, /anon negative checks/i);
  assert.match(bootstrap, /returns `null`/i);
});
