---
name: football-roster-refresh
description: Refresh football club and national-team roster data, player lists, badges, and roster-change snapshots from public sports data sources. Use when Codex needs to run or configure the daily Beijing-time roster refresh automation, compare player/personnel changes, update the football prediction app's local roster cache, or troubleshoot scheduled roster import jobs.
---

# Football Roster Refresh

Refresh the app's local football roster cache without calling an AI model.

## Run

From the project root:

```powershell
node .\skills\football-roster-refresh\scripts\refresh-rosters.mjs --output .\data\football-rosters
```

For a quick smoke test:

```powershell
node .\skills\football-roster-refresh\scripts\refresh-rosters.mjs --output .\data\football-rosters-smoke --max-teams 4
```

NPM shortcuts:

```powershell
pnpm roster:refresh
pnpm roster:refresh:cloud
pnpm roster:refresh:dry
```

## Automation

Recommended no-token Windows automation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\skills\football-roster-refresh\scripts\register-windows-task.ps1
```

The registered task runs daily at `00:00` Beijing time when Windows is set to China Standard Time or another UTC+08 timezone.

Codex automation metadata is saved in `automation/codex-automation.json`, but the Windows task is the recommended zero-model-token scheduler.

The website reads the latest cache through `GET /api/roster-cache` before falling back to live import.

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

The cloud Cron route uses `CRON_SECRET` and writes to Supabase. It does not use local computer resources after deployment.

## Outputs

- `data/football-rosters/latest.json` - latest normalized teams and players.
- `data/football-rosters/latest-changes.json` - latest roster/team metadata changes versus the previous snapshot.
- `data/football-rosters/history/YYYY-MM-DD.json` - dated snapshot.
- `data/football-rosters/changes/YYYY-MM-DD.json` - dated change set.
- `data/football-rosters/summary.md` - short human-readable run summary.
- `assets/automation-config.png` - visual automation configuration screenshot.
- Supabase keys `latest`, `latest-changes`, `history:YYYY-MM-DD`, and `changes:YYYY-MM-DD` when cloud cache is configured.

## Safety

- Never log API keys or authorization headers.
- Use `THESPORTSDB_API_KEY` when configured; otherwise the script uses the public demo key.
- Treat public data as a cache, not as authoritative paid event data.
- For paid providers, keep keys server-side and redact them in logs.
