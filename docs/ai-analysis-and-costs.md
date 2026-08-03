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

## Mainland configuration

```env
AI_PROVIDER=hunyuan
HUNYUAN_API_KEY=your_server_key
HUNYUAN_BASE_URL=https://tokenhub.tencentmaas.com/v1
HUNYUAN_MODEL=hy3
HUNYUAN_INPUT_CENTS_PER_MILLION=
HUNYUAN_CACHED_INPUT_CENTS_PER_MILLION=
HUNYUAN_OUTPUT_CENTS_PER_MILLION=
```

Use current TokenHub contract prices. A positive input and output rate is
required before platform-paid predictions are allowed.

## Safe activation sequence

1. Keep `PROVIDER_MODE=mock` and `LIVE_COSTS_ENABLED=false` while configuring.
2. Apply the Supabase SQL and verify `football_ai_usage` exists.
3. Configure one AI provider and its current CNY prices.
4. Configure at least two structured sports-data providers.
5. Verify Supabase authentication, Stripe webhook delivery, and refunds.
6. Run `pnpm production:check` with the intended production variables.
7. Set `PROVIDER_MODE=live` for BYOK testing while keeping platform charging off.
8. Run one low-value BYOK prediction and verify token telemetry.
9. Only then set `LIVE_COSTS_ENABLED=true` and run a low-value platform order.

## Cost meanings

- `model_cost_cents`: calculated from model-reported token usage and the stored
  rate snapshot. It is nullable when prices have not been configured.
- `sports_data_cost_cents`: the configured cost attributed to uncached sports
  data for the request.
- `platform_cost_cents`: cost borne by the platform. In BYOK mode this excludes
  the user's direct OpenAI charge.
- `user_charge_cents`: the amount settled by this product. It is zero for BYOK.

The prediction response displays per-request usage. The account dialog displays
the authenticated user's rolling 30-day totals.
