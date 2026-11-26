# Real AI Analysis And Cost Telemetry

## What is implemented

- OpenAI Responses API with Structured Outputs and `store: false`.
- Tencent Hunyuan through its OpenAI-compatible TokenHub endpoint.
- Platform-managed keys and per-request OpenAI BYOK.
- Stable hashed `safety_identifier` values for OpenAI requests.
- Input, cached-input, output, reasoning, and total-token collection.
- Per-call pricing snapshots and model-cost calculation in CNY cents.
- Separate sports-data cost, platform cost, and user charge fields.
- Success and failure telemetry in `football_ai_usage`.
- Authenticated 30-day user totals at `GET /api/costs/summary`.

The telemetry table never stores API keys, prompts, full evidence payloads, or
full model responses. Model prices are configuration, not source-code constants.

## Required database migration

Run the latest `docs/supabase-production.sql` in Supabase SQL Editor. It creates
`football_ai_usage`, its indexes, row-level security policies, and grants.

## OpenAI configuration

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_server_key
OPENAI_MODEL=gpt-5.6-terra
OPENAI_INPUT_CENTS_PER_MILLION=
OPENAI_CACHED_INPUT_CENTS_PER_MILLION=
OPENAI_OUTPUT_CENTS_PER_MILLION=
```

GPT-5.6 Terra is the balanced production role for this workload. Enter the
current rates from the provider contract in CNY cents per one million tokens.
Do not copy old example prices into production.

## DeepSeek configuration

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_server_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_INPUT_CENTS_PER_MILLION=880
DEEPSEEK_CACHED_INPUT_CENTS_PER_MILLION=29
DEEPSEEK_OUTPUT_CENTS_PER_MILLION=2641
```

These are the DeepSeek V4 Pro (`deepseek-v4-pro`, 1M context) peak-hour public rates checked on 2026-11-16 ($1.32 input / $0.044 cached input / $3.96 output per 1M tokens, converted at 1 USD ≈ 6.67 CNY; off-peak is 440 / 15 / 1321),
expressed in CNY cents per one million tokens. Recheck the official model-price
page before production activation or use the rates in your own contract. A
positive input and output rate is required before platform-paid predictions are
allowed.

The project also retains optional Hunyuan and OpenAI adapters.

Validate the server-only key and model without consuming inference tokens:

```bash
pnpm ai:check
```

After that succeeds, run one deliberately small structured-output inference:

```bash
pnpm ai:smoke
```

The smoke command consumes a small number of tokens. Neither command prints the
API key, prompt payloads, or model response.

## Safe activation sequence

1. Keep `PROVIDER_MODE=mock` and `LIVE_COSTS_ENABLED=false` while configuring.
2. Apply the Supabase SQL and verify `football_ai_usage` exists.
3. Configure one AI provider and its current CNY prices.
4. Configure at least two structured sports-data providers.
5. Configure each active provider's `*_MATCH_REFRESH_COST_CENTS`. Use the
   contracted or internally allocated cost of one complete match refresh;
   explicitly enter `0` only when the refresh is genuinely free.
6. Verify Supabase authentication, Stripe webhook delivery, and refunds.
7. Run `pnpm production:check` with the intended production variables.
8. Set `PROVIDER_MODE=live` for BYOK testing while keeping platform charging off.
9. Run one low-value BYOK prediction and verify token telemetry.
10. Only then set `LIVE_COSTS_ENABLED=true` and run a low-value platform order.

## Cost meanings

- `model_cost_cents`: calculated from model-reported token usage and the stored
  rate snapshot. It is nullable when prices have not been configured.
- `sports_data_cost_cents`: the sum of configured per-refresh costs for every
  provider attempted by an uncached request. Cached data has zero refresh cost.
- `platform_cost_cents`: cost borne by the platform. In BYOK mode this excludes
  the user's direct OpenAI charge.
- `user_charge_cents`: the amount settled by this product. It is zero for BYOK.

The prediction response displays per-request usage. The account dialog displays
the authenticated user's rolling 30-day totals.
