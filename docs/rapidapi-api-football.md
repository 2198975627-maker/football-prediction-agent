# API-Football through RapidAPI

The application supports two mutually exclusive API-Football transports while keeping one normalization pipeline.

## Direct dashboard transport

```env
API_FOOTBALL_KEY=
```

Requests use `https://v3.football.api-sports.io` with the server-only `x-apisports-key` header.

## RapidAPI transport

```env
RAPIDAPI_FOOTBALL_KEY=
RAPIDAPI_FOOTBALL_HOST=api-football-v1.p.rapidapi.com
```

Requests use `https://api-football-v1.p.rapidapi.com/v3` with server-only `x-rapidapi-key` and `x-rapidapi-host` headers.

The direct key takes precedence when both keys are configured. Neither key may use a `NEXT_PUBLIC_` prefix or be returned by an API route.

## Runtime verification

`GET /api/health` reports `sportsData.apiFootballAuthMode` as `direct`, `rapidapi`, or `null` without exposing credentials.

After adding a key, verify in this order:

1. Call the provider status endpoint and confirm the plan and remaining quota.
2. Resolve one fixture by team and date.
3. Fetch fixture details, lineups, injuries, recent form, head-to-head, and player season profiles.
4. Fetch `fixtures/players` only for a completed or live fixture known to contain player statistics.
5. Confirm cache hits before repeating a request so the free quota is not wasted.

RapidAPI subscriptions can have overage billing. Review the plan limits in the RapidAPI account before enabling production traffic.
