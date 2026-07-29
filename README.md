# Football Prediction Agent

Security-first football pre-match intelligence and prediction web API agent.

## Public Preview

Production URL:

```text
https://football-prediction-agent.vercel.app
```

The public preview currently provides team selection, roster and player views, source-readiness checks, historical event samples, visual analysis panels, and safe mock prediction output. Select the two teams in the web interface and review the available evidence before starting an analysis.

Current operating mode:

- Prediction provider: `mock`
- Paid model calls: disabled
- Live charging: disabled
- Cloud roster cache: Supabase
- Cloud scheduler: Vercel Cron
- Refresh schedule: every day at `00:00` Beijing time
- Local computer required after deployment: no

The repository does not contain real API keys or payment secrets. Production secrets are stored only in Vercel environment variables.

## Product Shape

The product is a web app plus API-backed agent. A user selects two football teams, match context, and analysis depth. The agent gathers public match intelligence, validates sources, and returns a structured probability report.

The agent must be positioned as:

- Pre-match intelligence analysis
- Public-data synthesis
- Probability estimation with uncertainty

The agent must not be positioned as:

- Betting advice
- Guaranteed prediction
- Arbitrage or gambling strategy

## Prepared Files

- `docs/plugin-skill-registry.md`: approved tools, plugins, and external services.
- `docs/search-import-sources.md`: approved public search, sports-data, and community-post import sources.
- `docs/official-sports-data-strategy.md`: chosen official multi-provider sports-data stack and fusion order.
- `docs/agent-language-spec.md`: system prompt, refusal rules, privacy boundaries, output format.
- `docs/workflow.md`: safe workflow nodes from input to report and billing settlement.
- `docs/api-key-security.md`: API key handling rules for platform mode and user-owned key mode.
- `docs/funds-safety.md`: payment, balance, refund, idempotency, and cost-settlement rules.
- `docs/web-api-security.md`: web/API security checklist based on OWASP-style controls.
- `docs/live-sportmonks-integration.md`: server-only fixture, lineup, injury, event, and statistic integration.
- `skills/*.md`: project skills the agent can execute as internal capabilities.
- `.env.example`: environment variable names only, no secrets.
- `.env.production.example`: production deployment variables, still without secrets.
- `config/search-import-sources.json`: machine-readable source registry for the research Agent.
- `.gitignore`: blocks env files, build output, logs, and dependency folders.
- `vercel.json`: Vercel deployment defaults.
- `Dockerfile`: optional container deployment.

## First Implementation Rule

Before real implementation starts:

1. Keep all secrets server-side.
2. Do not expose provider keys to browser code.
3. Do not perform live model calls until an API key decision is explicit.
4. Do not perform live payment capture until Stripe webhook verification and idempotent ledger updates are implemented.
5. Use mock providers by default during local development.

## Local Skeleton

The current app skeleton is safe-by-default:

- `PROVIDER_MODE=mock`
- No live OpenAI calls
- No automatic live sports-data calls
- No live search calls
- No live payment capture

The team selector can manually import public team records through the server-side `POST /api/live-team` proxy. It currently uses TheSportsDB with `THESPORTSDB_API_KEY` when configured, or the provider's public demo key for local development. The key is never sent to browser code.

The daily cloud roster job can also use `API_FOOTBALL_KEY` or
`RAPIDAPI_FOOTBALL_KEY`. It rotates a bounded set of teams through API-Football's
team, current-squad, and coach endpoints, then preserves earlier provider rosters
in Supabase. The default limit is 16 teams per day, or at most 48 first-time
requests. Player names, photos, ages, numbers, and coach identities are treated
as roster metadata; form, injuries, height, xG, event maps, penalty rates, and
matchup claims stay blank until a suitable source verifies them.

Use modern Supabase `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` values
for cloud auth and cache access. The older `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` names remain compatibility aliases.

The player-event panel can import a safe historical sample through `POST /api/player-events`. The first wired provider is StatsBomb Open Data, using the Argentina vs France 2022 World Cup final as a free event-log demo for shots, xG, dribbles, tackles, blocks, interceptions, keeper actions, penalties, and heatmap points. Production real-time mode should later map selected fixtures to API-Football, Sportmonks, StatsBomb paid, Opta, or Wyscout through the same server-side route.

The official data-source panel can check `POST /api/live-team`, `POST /api/player-events`, and `GET /api/sports-data-sources` readiness. The selected production stack is API-Football + Sportmonks + StatsBomb + football-data.org + TheSportsDB, plus China-access candidates such as 纳米数据, 聚合数据, 飞鲸体育数据, and 全速数据. Every provider is called from server-side routes only.

Run it locally after installing dependencies:

```bash
pnpm install
pnpm run dev
```

Then open `http://localhost:3000`.

Available API routes:

- `GET /api/health`
- `POST /api/estimate`
- `POST /api/predict`
- `POST /api/live-team`
- `POST /api/player-events`
- `GET /api/sports-data-sources`

## Deployment

The project is deployed as a safe public preview. Keep `PROVIDER_MODE=mock` and `LIVE_COSTS_ENABLED=false` until real AI calls, payment authorization, webhook verification, and cost settlement are implemented.

Start with `docs/deployment.md` for Vercel and Docker steps.

Before sharing a public URL, run:

```bash
pnpm run deploy:check
```

Production health endpoint:

```text
https://football-prediction-agent.vercel.app/api/health
```

Confirm `providerMode` is `mock`, `liveCostsEnabled` is `false`, and no unexpected production warnings appear.
