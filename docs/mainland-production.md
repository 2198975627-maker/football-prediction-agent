# Mainland China Production Architecture

This document defines the preferred production path for users in mainland China. The product must not require end users to use a VPN.

## Recommended topology

1. Host the public Next.js application on Tencent Cloud in a mainland China region after ICP filing.
2. Put the custom domain, HTTPS certificate, CDN, API routes, scheduled jobs, database, and Redis in the same cloud account where practical.
3. Keep sports-provider credentials on the backend. Browsers never call overseas sports APIs directly.
4. Use a mainland-supported model provider as the platform AI path. Tencent TokenHub is integrated through its OpenAI-compatible API and is the preferred first adapter for the Tencent Cloud deployment.
5. Use WeChat Pay API v3 and Alipay web payment for mainland checkout. Keep Stripe only as an optional overseas payment adapter.
6. Keep all prediction language informational: probability analysis, no guaranteed results, no betting execution, and no inducement to gamble.

## Deployment phases

### Phase A: pre-filing preview

- Use a Tencent Cloud Hong Kong instance or private test URL.
- Do not accept public payments.
- Keep `LIVE_COSTS_ENABLED=false`.
- Test sports-provider connectivity from the selected server region before buying a long-term plan.

### Phase B: mainland public launch

- Register and real-name-verify the domain.
- Buy an eligible mainland cloud resource.
- Complete ICP filing before opening the public domain.
- Configure HTTPS, CDN, database backups, Redis rate limits, logging, and cron jobs.
- Complete the payment-provider merchant review and webhook verification.
- Enable paid predictions only after a low-value end-to-end test succeeds.

## Provider policy

### AI

- Mainland default: Tencent TokenHub with the Hunyuan `hy3` model. Configure `AI_PROVIDER=hunyuan`, `HUNYUAN_API_KEY`, and the current input/output prices.
- The server calls `https://tokenhub.tencentmaas.com/v1`; the API key is never sent to the browser.
- Paid traffic remains blocked until both `HUNYUAN_INPUT_CENTS_PER_MILLION` and `HUNYUAN_OUTPUT_CENTS_PER_MILLION` are positive values. This avoids charging from stale or guessed model prices.
- Overseas optional: OpenAI, only where the account, server location, and end-user offering comply with OpenAI's supported-country policy.
- Do not proxy an unsupported OpenAI offering into mainland production.

### Sports data

- Follow `docs/mainland-sports-data.md`. The runnable mainland-friendly adapter is AnySport; Nami, Juhe, Feijing, and APIBalls remain explicit credential/contract slots until their vendor-specific API material is supplied.
- football-data.org remains the basic live fixture source.
- StatsBomb Open Data remains historical event data only.
- API-Football can be enabled only after its key and server-region connectivity are verified.
- Cache all provider responses and expose source timestamps and coverage gaps to users.

### Payments

- Mainland desktop: WeChat Native QR and Alipay computer web payment.
- Mainland mobile: use the payment product approved for the actual browser or app context.
- Payment webhooks must be signature-verified, idempotent, and settled against the server-side order amount.
- Never enable a payment method before the merchant account and product category are approved.

## Required product-owner actions

- Decide whether the filing and merchant accounts use an individual or company entity.
- Own and real-name-verify the domain.
- Complete ICP filing and any additional licenses required by the actual paid information-service model.
- Complete WeChat Pay and/or Alipay merchant onboarding.
- Create Tencent Cloud model, database, Redis, and server credentials.

Code alone cannot accept legal terms, pass identity or business verification, own a domain, or authorize financial accounts.
