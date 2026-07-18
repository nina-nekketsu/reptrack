# Fresh schema bootstrap and RLS validation

Use this procedure for a **new, disposable Supabase project only**. For an existing project, use a read-only schema comparison followed by separately approved additive migrations.

## Bootstrap

1. Create a disposable Supabase project.
2. Review `supabase/schema_current.sql` and parse it locally (`npm run check:schema`).
3. Apply `supabase/schema_current.sql` once through the project's SQL editor or approved CLI workflow.
4. Configure RepTrack locally with the project URL and anon key through `.env`; never commit or print those values.
5. Create two disposable test users: owner A and non-owner B.
6. Sign in as A and create one exercise, plan, log, settings row, timer state, active-session row, and disabled coach share through the app/API.

## Owner/RLS checks

Run API checks with user A's authenticated session and confirm A can select/insert/update/delete only A's rows in every owner-scoped table. Then repeat with B and confirm B receives zero A rows and cannot insert/update/delete rows carrying A's `user_id`.

## Anon negative checks

Using only the anon client with **no user session**:

- owner-table selects return zero rows;
- owner-table inserts, updates, and deletes are denied;
- `get_coach_data` with a random UUID returns `null`;
- `get_coach_data` with a disabled share token returns `null`.

Do not log tokens. Assert only null/non-null and row counts.

## Coach positive check

Enable A's share in the app, create a current real exercise log, and open the Coach View URL in a signed-out browser. Confirm the returned exercise, last-session sets, PR values, volume history, and freshness timestamp match A's current `exercise_logs` data. Rotate the link; confirm the old URL denies and the new URL works.

## Evidence

Record project identifier, schema file checksum, test timestamp, pass/fail counts, and redacted screenshots. Delete disposable users/project after evidence is accepted. Never store credentials or share tokens in the evidence bundle.
