---
name: football-roster-refresh
description: Operate the cloud-only football club and national-team roster refresh, player lists, badges, and roster-change snapshots. Use when Codex needs to configure or troubleshoot the daily Beijing-time deployment cron and Supabase cache.
---

# Football Roster Refresh

Refresh the deployed app's Supabase roster cache without calling an AI model.

## Automation

Only the deployment platform may run the refresh script. Do not create a Windows
scheduled task, Codex desktop automation, or local package script for roster refresh.

## Cloud Cache

For deployed websites, create the Supabase table in `references/supabase-cache.sql`, then set these server-side environment variables:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ROSTER_CACHE_TABLE=football_roster_cache
CRON_SECRET=
ROSTER_REFRESH_MAX_TEAMS=72
ROSTER_REFRESH_MAX_PLAYERS_PER_TEAM=40
```

Vercel Cron is configured in `vercel.json` to call `GET /api/cron/refresh-rosters` at `16:00 UTC`, which is `00:00` Beijing time.

The cloud Cron route uses `CRON_SECRET` and writes to Supabase. It never writes
roster snapshots to the deployed filesystem or the user's computer.

## Outputs

- Supabase keys `latest`, `latest-changes`, `history:YYYY-MM-DD`, and `changes:YYYY-MM-DD` when cloud cache is configured.
- `data/football-rosters/*.json` files are development samples and are not refreshed.

## Safety

- Never log API keys or authorization headers.
- Never configure a local recurring refresh.
- Use `THESPORTSDB_API_KEY` when configured; otherwise the script uses the public demo key.
- Treat public data as a cache, not as authoritative paid event data.
- For paid providers, keep keys server-side and redact them in logs.
