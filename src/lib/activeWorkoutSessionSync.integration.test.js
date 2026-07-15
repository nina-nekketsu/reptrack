import fs from 'fs';
import path from 'path';

const repoSource = (relativePath) => fs.readFileSync(
  path.join(__dirname, '..', '..', relativePath),
  'utf8'
);

describe('active workout session sync integration', () => {
  test('pullAll and pushAll include the dedicated session transport', () => {
    const syncSource = repoSource('src/lib/sync.js');

    expect(syncSource).toMatch(/pullActiveWorkoutSession\(supabase,\s*userId\)/);
    expect(syncSource).toMatch(/pushDedicatedActiveWorkoutSession\(supabase,\s*userId\)/);
    expect(syncSource).toMatch(/pushAll[\s\S]*Promise\.all\(\[[\s\S]*pushDedicatedActiveWorkoutSession\(supabase,\s*userId\)/);
    expect(syncSource).not.toMatch(/settings\.activeWorkoutSession\s*=/);
  });

  test('the additive migration provides an RLS-protected row and atomic LWW merge', () => {
    const migration = repoSource('supabase/migrations/001_active_sessions.sql');

    expect(migration).toMatch(/create table if not exists public\.active_sessions/i);
    expect(migration).toMatch(/user_id\s+uuid\s+primary key/i);
    expect(migration).toMatch(/session\s+jsonb\s+not null/i);
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/auth\.uid\(\)\s*=\s*user_id/i);
    expect(migration).toMatch(/create or replace function public\.merge_active_session/i);
    expect(migration).toMatch(/pg_advisory_xact_lock\s*\(/i);
    expect(migration).toMatch(/incoming_status\s*:=\s*coalesce\(p_session->>'status',\s*'active'\)/i);
    expect(migration).toMatch(/stored_status\s*:=\s*coalesce\(current_session->>'status',\s*'active'\)/i);
    expect(migration).toMatch(/incoming_status\s*=\s*'ended'\s+and\s+stored_status\s*=\s*'active'/i);
  });
});
