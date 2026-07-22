# Cloud Roster Cache

This app supports two roster-cache modes:

- Local file cache for development: `data/football-rosters/latest.json`.
- Supabase cloud cache for deployment: table `football_roster_cache`.

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
- `/api/roster-cache` reads Supabase first, then falls back to local JSON.
- The browser never sees Supabase service keys.
- The refresh script does not call an AI model, so it does not spend OpenAI tokens.
