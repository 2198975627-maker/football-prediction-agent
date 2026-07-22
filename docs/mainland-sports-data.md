# Mainland Sports Data Setup

All credentials in this document are server-only. Never put them in a `NEXT_PUBLIC_*` variable or call these providers directly from browser JavaScript.

## Runnable provider: AnySport

AnySport has a documented REST API, Chinese responses, and a seven-day free plan. The current adapter uses:

- `GET /v1/matches` for fixture resolution, goals, cards, substitutions, formations, and team statistics.
- `GET /v1/head2head` for recent form and historical meetings.
- `GET /v1/lineups` only when the account includes Basic or above and `ANYSPORT_LINEUPS_ENABLED=true`.

Create an account at `https://dashboard.anysport.io`, then configure:

```env
ANYSPORT_API_KEY=your_server_key
ANYSPORT_LINEUPS_ENABLED=false
```

Keep the lineups switch false on the free plan. After configuration, restart the server and inspect `/api/health`. The expected fields are:

```json
{
  "sportsData": {
    "configuredMatchProviders": ["anysport"],
    "mainland": {
      "anySport": true,
      "anySportLineups": false
    }
  }
}
```

AnySport does not replace a licensed event-coordinate provider. Missing xG, shot coordinates, touch heatmaps, and direct player-versus-player events remain missing rather than being synthesized.

## Contract and fallback providers

The following credentials are recognized by the server and displayed in provider readiness, but their live adapters remain disabled until the vendor supplies the contract-specific base URL, authentication method, response samples, and commercial-use terms:

```env
NAMI_SPORTS_USER=
NAMI_SPORTS_SECRET=
JUHE_FOOTBALL_API_KEY=
FEIJING_SPORTS_API_KEY=
APIBALLS_API_KEY=
```

- Nami Data: broad real-time, statistics, lineup, and media products; access is opened through business onboarding.
- Juhe Football: documented fixtures and standings fallback. Its own documentation warns that data is collected from the web and may contain delay or error, so it is not treated as authoritative player-event evidence.
- Feijing and APIBalls: commercial candidates. Do not guess endpoint paths or field meanings from marketing pages.

Credentials for a non-integrated provider appear as `credentials-ready`, not `ready`. This distinction prevents the UI from claiming that a source is already feeding predictions.

## Production recommendation

Use at least two independently licensed structured sources. A practical mainland rollout is AnySport for basic context plus Nami, Feijing, or APIBalls after receiving official API samples and commercial authorization. Keep StatsBomb Open Data limited to historical demonstrations.
