# Deployment Guide

This app can run as a safe mock preview or a gated live build. Live prediction and charging remain disabled until the production environment, database migrations, Stripe webhook, and at least two match providers pass `pnpm production:check`.

## Mainland China deployment

For a mainland-first product, follow `docs/mainland-production.md`. Use a mainland cloud region only after ICP filing, select a mainland-supported AI provider, and use an approved WeChat Pay or Alipay merchant integration. Vercel, OpenAI, and Stripe remain optional overseas adapters rather than the mainland default.

## Optional overseas deployment: Vercel

Current public preview:

```text
https://football-prediction-agent.vercel.app
```

1. Push this folder to a GitHub repository.
2. Import the repository in Vercel as a Next.js project.
3. Use these commands:
   - Install: `pnpm install --frozen-lockfile`
   - Build: `pnpm run build`
   - Start: Vercel handles this automatically.
4. Add environment variables from `.env.production.example`.
5. Keep these values for the first public preview:
   - `APP_ENV=production`
   - `PROVIDER_MODE=mock`
   - `LIVE_COSTS_ENABLED=false`
6. Open `https://your-domain/api/health` after deployment and check:
   - `ok` is `true`
   - `providerMode` is `mock`
   - `liveCostsEnabled` is `false`
   - `productionWarnings` is empty or only warns about the TheSportsDB demo key.

The current production deployment uses Supabase for the cloud roster cache and Vercel Cron for the daily refresh. The refresh runs at `0 16 * * *` UTC, which is `00:00` Beijing time. It does not use the local computer and does not call an AI model.

## Docker deployment

Build and run:

```bash
docker build -t football-prediction-agent .
docker run --env-file .env.production -p 3000:3000 football-prediction-agent
```

Then open `http://localhost:3000`.

## Implemented production paths

- The web UI is production-buildable.
- `POST /api/live-team` imports public team records through a server-side proxy.
- `POST /api/player-events` imports a free StatsBomb Open Data historical event sample through a server-side proxy.
- API-Football supports both direct dashboard authentication and the official RapidAPI transport.
- football-data.org provides live fixtures, results, teams, standings, recent matches, and head-to-head context.
- OpenAI Responses API analysis uses Structured Outputs, an evidence-only prompt, and `store: false`.
- Supabase Auth uses server-managed HTTP-only access and refresh cookies.
- Stripe Checkout, signed idempotent webhooks, prepaid orders, actual-token settlement, refunds, and an append-only ledger are implemented.
- `GET /api/sports-data-sources` reports official provider readiness without exposing keys.
- The TheSportsDB key stays server-side.
- Upstash-backed distributed rate limiting is used when configured, with a local fallback for development.
- Security response headers are configured in `next.config.mjs`.

## External activation still required

- Add a usable API-Football direct or RapidAPI key. The legacy RapidAPI listing may no longer be publicly available; confirm the current product in the account before relying on that channel.
- Create an OpenAI API project and set `OPENAI_API_KEY`.
- Create a Supabase project and execute all SQL migrations listed in `docs/production-launch.md`.
- Complete Stripe business verification, configure secrets, and verify a real low-value webhook flow.
- Configure at least two structured match providers before enabling paid official predictions.
- Create Upstash Redis for production-wide rate limiting.
- Add a custom domain if required; the default Vercel production domain is already active.

Follow `docs/production-launch.md` before setting `PROVIDER_MODE=live` or `LIVE_COSTS_ENABLED=true`.
