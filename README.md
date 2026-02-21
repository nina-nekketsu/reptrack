# RepTrack 3

A mobile-first workout tracking app built with React. Runs as a static site on GitHub Pages. Optionally syncs data to Supabase so your logs follow you across devices.

## Features

- Log exercises with sets, reps, and weight
- Workout plans with editable exercise prescriptions
- Session timer, progressive overload hints, personal records
- Works fully offline — data is stored in localStorage
- Optional Supabase sync: sign in once and your data is wherever you are
- **Coach View**: share a private read-only link with your coach (no login required on their end)

---

## Local development

```bash
npm install
npm start
```

The app runs without any credentials. It shows a brief setup screen with the option to skip and continue locally.

---

## Setting up Supabase sync

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a free project.

### 2. Run the schema

Open the SQL editor in your Supabase project and paste the contents of `supabase/schema.sql`. Run it. This creates five tables with Row Level Security (RLS) enabled — users can only see and modify their own rows.

### 3. Add credentials to `.env`

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Fill in your values from **Project Settings → API** in the Supabase dashboard:

```env
REACT_APP_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **Never commit `.env` to git.** It is already in `.gitignore`.

### 4. Restart the dev server

```bash
npm start
```

You will see a sign-in screen. Create an account (email + password) or sign in. On login, remote data is pulled into localStorage. Changes you make (logging sessions, editing plans) are synced back to Supabase automatically.

---

## GitHub Pages deploy

### One-time setup

1. Make sure `package.json` has the correct `homepage` value:
   ```json
   "homepage": "https://<your-github-username>.github.io/<repo-name>"
   ```

2. Add your Supabase credentials as **repository secrets** (or environment variables in your Actions workflow):
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`

### Manual deploy

```bash
npm run build
npm run deploy
```

This runs `gh-pages -d build` and pushes the `build/` folder to the `gh-pages` branch.

### Cache busting & update prompt

`npm run build` now runs `node scripts/write-build-info.js` via the `prebuild` hook. That script writes the same metadata object to `public/build-info.json` and to `.env.production.local`, so `react-scripts build` injects `REACT_APP_BUILD_ID`, `REACT_APP_BUILD_COMMIT`, `REACT_APP_BUILD_VERSION`, and `REACT_APP_BUILD_TIME` into the bundle. The UI surfaces the current `Build: <shortsha> · <date>` stamp in the Profile footer and inside the Exercise Log modal, and `UpdateBanner` fetches `${PUBLIC_URL}/build-info.json?ts=<timestamp>` to show a reload button whenever the remote build ID is newer than the running build. `npm run deploy` enforces `deploy:check-clean`, runs `npm run build` through `predeploy`, and finally pushes `gh-pages -d build`. The published build info is available at `https://nina-nekketsu.github.io/reptrack/build-info.json`, which the app uses to detect stale caches.

### Hard refresh when caches block updates

If the banner never shows up and the app seems stuck on an old version:
1. On desktop, open DevTools (F12) and use the refresh menu (Cmd/Ctrl+Shift+R or **Empty Cache and Hard Reload**) while the tab is active.
2. On mobile or when the simple hard reload doesn’t help, clear the site data for `https://nina-nekketsu.github.io/reptrack` (Settings → Site Settings → Storage → Clear site data) and reload the page.
3. As a last resort you can open a new private/incognito window or append `?ts=<timestamp>` to the URL to bypass caches.

### GitHub Actions (recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Build
        env:
          REACT_APP_SUPABASE_URL: ${{ secrets.REACT_APP_SUPABASE_URL }}
          REACT_APP_SUPABASE_ANON_KEY: ${{ secrets.REACT_APP_SUPABASE_ANON_KEY }}
        run: npm run build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./build
```

---

## Architecture

| Concern | Where |
|---------|-------|
| Supabase client init | `src/lib/supabase.js` — returns `null` when env vars are absent |
| Auth state + initial sync | `src/context/AuthContext.js` |
| Sign in / sign up UI | `src/components/AuthScreen.js` |
| Setup instructions screen | `src/components/SetupScreen.js` |
| Sync upsert helpers | `src/utils/exerciseHelpers.js` — `upsertSession`, `upsertPlan`, `upsertExercise` |
| Schema + RLS | `supabase/schema.sql` |

### Sync flow

1. **On login**: `AuthContext` calls `pullRemoteData(userId)` — fetches exercises, sessions, plans from Supabase and merges into localStorage.
2. **On local changes**: write to localStorage first (instant UI), then fire-and-forget upsert to Supabase in the background.
3. **Offline**: app works normally. Changes accumulate in localStorage. Next login will pull the latest remote state.

> Note: this is a last-write-wins sync model, not a full CRDT/conflict-resolution system. It works well for single-user use where you typically log from one device at a time.

---

## Database tables

| Table | Description |
|-------|-------------|
| `exercises` | Exercise library (name, muscle group, type) |
| `exercise_sessions` | One row per logged session |
| `exercise_sets` | Individual sets within a session |
| `workout_plans` | Named workout plans |
| `plan_exercises` | Exercises within a plan (with prescribed sets/reps) |
| `coach_shares` | One share record per user (token, enabled flag) |

All tables have RLS policies: `auth.uid() = user_id`.

---

## Coach View (share link feature)

Lets a logged-in user generate a private link so a coach can view their training logs without creating an account.

### How it works

1. User opens **Profile → Coach sharing** and toggles it ON.
2. A UUID v4 token is created in `coach_shares`. The UI shows a link like:
   ```
   https://nina-nekketsu.github.io/reptrack/#/coach/<token>
   ```
3. The coach opens the link — no login needed. They see exercises, last session sets, PRs, and a volume graph.
4. The user can rotate the token at any time, instantly revoking the old link.

### Security model

- The `coach_shares` table has strict RLS: only the authenticated owner can read/write it.
- The anon key **cannot** enumerate users or read their training data directly.
- Coach data is served via a `SECURITY DEFINER` Supabase RPC (`get_coach_data`). This function runs as the database owner and bypasses RLS only for the specific token lookup. It returns `null` for invalid or disabled tokens.
- Tokens are raw UUID v4 (128-bit random) — practically unguessable.

### Setup

After running `supabase/schema.sql`, also run `supabase/coach_share.sql` in the Supabase SQL editor:

```sql
-- In Supabase dashboard → SQL editor
-- Paste and run the contents of supabase/coach_share.sql
```

That creates:
- `coach_shares` table with RLS
- `get_coach_data(uuid)` RPC function (SECURITY DEFINER)
- Indexes for fast token lookups

No frontend env changes needed — it uses the same `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`.

---

## Tech stack

- [React](https://react.dev) (CRA)
- [React Router v7](https://reactrouter.com) (HashRouter for GitHub Pages compatibility)
- [Supabase JS client v2](https://supabase.com/docs/reference/javascript)
- Deployed on [GitHub Pages](https://pages.github.com) via `gh-pages`
