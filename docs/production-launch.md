# Production Launch

## External accounts

These steps require the product owner's email, acceptance of provider terms, payment identity, and domain ownership. They cannot be completed safely by source code alone.

For mainland China users, read `docs/mainland-production.md` first. Do not enable the OpenAI/Stripe production path merely because its code is present; use providers supported for the production region and merchant entity.

1. Register API-Football and configure either the direct server key in `API_FOOTBALL_KEY` or the official RapidAPI credential in `RAPIDAPI_FOOTBALL_KEY`. See `docs/rapidapi-api-football.md`.
2. Register football-data.org and copy the free token into `FOOTBALL_DATA_API_KEY`.
   For mainland deployment, AnySport can be configured in `ANYSPORT_API_KEY`; see `docs/mainland-sports-data.md`.
3. Create a Supabase project. Enable email authentication and run:
   - `docs/supabase-match-intelligence.sql`
   - `docs/supabase-production.sql`

   Re-run `docs/supabase-production.sql` after pulling payment changes. The current
   migration installs the atomic Stripe webhook and prediction-settlement database
   functions. Do not enable live charging until both functions exist in Supabase.
   - `skills/football-roster-refresh/references/supabase-cache.sql`
4. Create a Stripe account, complete business verification, and create a webhook for `https://YOUR_DOMAIN/api/payments/webhook` listening to `checkout.session.completed`.
5. Choose the platform AI provider:
   - Mainland: create a Tencent TokenHub key and configure `AI_PROVIDER=hunyuan`, `HUNYUAN_API_KEY`, `HUNYUAN_MODEL=hy3`, and current TokenHub token prices.
   - Overseas: configure `AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-5.6-terra`, and current OpenAI token prices. The OpenAI path uses the Responses API with Structured Outputs, `store: false`, and a privacy-preserving safety identifier.
6. Create Upstash Redis and configure both REST variables for distributed rate limiting.

## Required production switches

```env
APP_ENV=production
PROVIDER_MODE=live
LIVE_COSTS_ENABLED=true
NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN
```

Keep `LIVE_COSTS_ENABLED=false` until Stripe webhook delivery has been verified in the Stripe dashboard and a real low-value test order has completed end to end.

## Data and prediction gates

- At least two match providers must be configured.
- Critical fixture-time conflicts block prediction.
- Official prediction requires recent form, H2H, player season profiles, confirmed lineups near kickoff, fresh cache, and two injury sources.
- AI receives only the structured evidence pack. It cannot invent missing facts or silently browse social media.
- BYOK keys are held only in the current browser memory and sent in one HTTPS request. They are never stored by the server.

## Payment lifecycle

1. Authenticated user creates a Stripe Checkout session.
2. Stripe webhook signature is verified and the event ID is stored idempotently.
3. A paid order is atomically changed to `processing` before the model call.
4. Actual model token cost is calculated server-side and multiplied by `BILLING_MARKUP_MULTIPLIER`.
   The pricing snapshot, input/output/cache/reasoning token counts, model cost,
   sports-data cost, and user charge are written to `football_ai_usage`.
5. Unused prepaid authorization is refunded through Stripe.
6. The append-only ledger stores payment, charge, and refund entries.

## Deploy to Vercel

1. Import this directory as a Next.js project.
2. Add all variables from `.env.production.example` in Vercel Project Settings.
3. Run `pnpm production:check` locally with the production variables loaded.
4. Deploy a preview first and test `/api/health`.
5. Add the custom domain in Vercel and update `NEXT_PUBLIC_APP_URL` and the Stripe webhook URL.
6. Confirm the Vercel plan supports the cron frequency in `vercel.json`; otherwise move the 15-minute trigger to an external scheduler.

Do not paste secret keys into browser fields, source files, screenshots, chat messages, or any `NEXT_PUBLIC_*` variable.
