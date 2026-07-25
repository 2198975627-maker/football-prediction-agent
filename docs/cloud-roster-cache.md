# Cloud Roster Cache

Production roster refresh is cloud-only:

- Vercel Cron triggers the website API route.
- The route collects provider data on the cloud runtime.
- Supabase stores the latest snapshot, changes, and dated history.
- The user's computer is not part of the refresh workflow.

The JSON files under `data/football-rosters` are bundled development samples only.
They are never refreshed automatically and are never used as a production fallback.

## Supabase Setup

Run the SQL in:

```text
skills/football-roster-refresh/references/supabase-cache.sql
```

Then set these server-side environment variables on the deployment platform:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ROSTER_CACHE_TABLE=football_roster_cache
CRON_SECRET=
ROSTER_REFRESH_MAX_TEAMS=72
ROSTER_REFRESH_MAX_PLAYERS_PER_TEAM=40
```

Keep `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` server-side only.

## Vercel Cron

`vercel.json` calls:

```text
GET /api/cron/refresh-rosters
```

Schedule:

```text
0 16 * * *
```

That is `00:00` Beijing time.

## Runtime Behavior

- `/api/cron/refresh-rosters` refreshes roster data and writes it to Supabase.
- `/api/roster-cache` reads Supabase in production.
- Local development may read the bundled sample when Supabase is not configured.
- The browser never sees Supabase service keys.
- No Windows Task Scheduler or Codex desktop automation is used.
- The refresh job does not call an AI model, so it does not spend OpenAI tokens.
