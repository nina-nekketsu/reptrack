# Coach-share token rotation and Hayato handoff

This runbook covers RepTrack's **per-athlete share token**. The retired `coach_api_config`/global API-key script is unsafe and must not be run: it selected an arbitrary `auth.users` row and printed key material in SQL output.

## Safety boundary

- A token rotation immediately invalidates the old coach URL.
- Do not paste tokens into tickets, logs, bridge notes, chat, screenshots, or source control.
- Do not apply SQL to production without Lloyd's explicit approval for the exact target and statements immediately beforehand.
- For an existing Supabase project, first compare the live schema read-only against `supabase/schema_current.sql`. Apply only the reviewed additive migration, never the full snapshot.

## Preferred rotation path

1. Sign in as the athlete in RepTrack.
2. Open the Coach sharing controls.
3. Choose **Rotate link** and acknowledge that the previous link will stop working.
4. Copy the new private URL directly to the approved password-protected channel or secret store. Do not record the token in this repository.
5. Verify the previous URL returns the denial screen.
6. Verify the new URL renders the athlete's current real `exercise_logs` data and a freshness timestamp.

The app resolves the athlete explicitly from `coach_shares.user_id`. It does not use `auth.users limit 1`. Rotation creates a new UUID token and records `rotated_at`; the `get_coach_data(uuid)` RPC grants only token-scoped read access.

## Existing-project migration

The review-only migration is:

`supabase/migrations/20260718123000_coach_share_flat_jsonb.sql`

It is additive: it adds `rotated_at` if absent, adds indexes, and replaces `get_coach_data(uuid)` so it reads the flat JSONB `exercise_logs` model. It does not emit any token or secret.

Before approval, capture a redacted read-only diff of tables, columns, policies, functions, and grants. After approval and application, run the negative and positive checks in `schema-bootstrap-and-rls-validation.md`.

## Hayato handoff

Hayato receives a single athlete-approved coach-share URL/token through the approved secret channel. The token is equivalent to a private read-only link and must remain outside prompts, notes, source, and shell history. Hayato calls `get_coach_data` through the normal Coach View URL/API contract; no global API key or arbitrary-user lookup remains.

If Hayato loses access, rotate the athlete's token and update the secret-channel entry. Never restore the obsolete global-key SQL.

## Rollback

If the corrected RPC misbehaves, disable the affected `coach_shares` row (`enabled = false`) first. That revokes the link without deleting athlete data. Database rollback SQL must be generated from the pre-change function definition and separately approved; do not restore the obsolete normalized-table function.
