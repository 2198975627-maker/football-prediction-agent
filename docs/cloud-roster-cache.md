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
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_ROSTER_CACHE_TABLE=football_roster_cache
CRON_SECRET=
ROSTER_REFRESH_MAX_TEAMS=72
ROSTER_REFRESH_MAX_PLAYERS_PER_TEAM=40
ROSTER_API_FOOTBALL_TEAM_LIMIT=16
API_FOOTBALL_KEY=
```

Keep `SUPABASE_SECRET_KEY`, provider keys, and `CRON_SECRET` server-side only.

`SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` remain compatibility aliases.
Production should use modern Supabase `sb_publishable_...` and `sb_secret_...` keys;
legacy JWT API keys are not required.

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

### Free provider limits

The public TheSportsDB demo key is limited to 30 requests per minute. The cloud refresh therefore uses a fixed request budget:

- League and popular-team metadata are refreshed first.
- Missing popular clubs are recovered by name while the request budget allows.
- Club badges and national flags are preferred for the public preview.
- TheSportsDB public-demo mode does not claim real rosters.
- When `API_FOOTBALL_KEY` or `RAPIDAPI_FOOTBALL_KEY` is configured, the job
  rotates up to `ROSTER_API_FOOTBALL_TEAM_LIMIT` teams through team, current-squad,
  and coach endpoints. Previously imported provider rosters are preserved.
- The default limit is 16 teams, so a worst-case first lookup uses 48 requests.
- Squad names, photos, ages, and numbers are displayed as provider metadata.
  Form, injuries, height, event metrics, xG, heatmaps, and matchup claims remain
  hidden until a suitable licensed or open event source verifies them.

## Current Production

- Website: `https://football-prediction-agent.vercel.app`
- Health: `https://football-prediction-agent.vercel.app/api/health`
- Cache API: `https://football-prediction-agent.vercel.app/api/roster-cache`
- Verified storage: Supabase
- Verified scheduled route: `GET /api/cron/refresh-rosters`
