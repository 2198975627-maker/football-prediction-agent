# Sportmonks Live Data Integration

The application has a server-only Sportmonks Football API v3 adapter.

## Implemented

- Resolve selected team names through `GET /teams/search/{query}`.
- Resolve a fixture near the selected date, or accept an explicit `fixtureId`.
- Fetch participants, competition, venue, state, weather, formations, lineups, lineup details, events, statistics, sidelined players, and coaches.
- Normalize provider data into an application-owned schema with source and fetch-time evidence.
- Reject missing credentials, unknown teams, missing fixtures, plan restrictions, provider rate limits, oversized responses, and timeouts without generating fallback facts.

## Server configuration

Create `.env.local` locally or configure the deployment platform's server environment:

```env
SPORTMONKS_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SUPABASE_MATCH_CACHE_TABLE=football_match_intelligence_cache
SUPABASE_PROVIDER_ENTITY_TABLE=football_provider_entities
SUPABASE_TRACKED_FIXTURES_TABLE=football_tracked_fixtures
MATCH_INTELLIGENCE_CACHE_SECONDS=900
```

Never use a `NEXT_PUBLIC_` prefix. The token is sent through the server-side `Authorization` header and is never returned to the browser.

Run `docs/supabase-match-intelligence.sql` in Supabase before enabling persistent match caching. Anonymous credentials can read the public match cache; only the service role can write cache records or provider ID mappings.

## Endpoint

`POST /api/match-intelligence`

```json
{
  "teamA": "Manchester City",
  "teamB": "Real Madrid",
  "matchDate": "2026-07-12 20:00"
}
```

An optional numeric `fixtureId` bypasses automatic fixture resolution. The frontend calls this endpoint from the `同步真实数据` action in the analysis view.

## Data rules

- Missing statistics are unavailable, not zero.
- Predicted lineups must not be presented as confirmed lineups.
- Coverage varies by subscription, competition, and match state.
- The adapter never converts missing fields into synthetic facts.
- Fresh cache entries are returned before a paid provider call; stale cache entries are labeled with their age.
- Team, player, and fixture provider IDs are persisted for later multi-provider matching when the service role is configured.
- Successfully resolved fixtures are tracked for refreshes around 24 hours, 6 hours, and 90 minutes before kickoff, followed by short lineup checks near kickoff.
- A data-quality gate blocks official prediction when required recent form, H2H, player season profiles, lineup freshness, or injury verification is missing.
- Live fields are not yet fed into the probability model. Field mapping, coverage gates, and historical backtesting must be completed first.

## Next production layer

1. Persist provider team, player, and fixture IDs in Supabase.
2. Add pre-match refreshes at 24 hours, 6 hours, and 90 minutes.
3. Map provider statistic type IDs into canonical football metrics.
4. Add a second licensed provider for high-impact fact verification.
5. Backtest and calibrate probabilities before enabling live predictions.
