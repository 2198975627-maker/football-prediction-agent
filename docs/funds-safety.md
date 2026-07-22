# Funds Safety

The product has two billing modes:

1. BYOK mode: user pays provider directly with their own key.
2. Platform mode: user prepays or maintains balance; platform calls providers and charges after actual cost is known.

## Platform Billing Formula

```text
final_charge = max(actual_api_cost * 2, minimum_charge)
```

Initial default:

- `minimum_charge = 1 CNY`
- `markup_multiplier = 2`

## Payment Flow

```text
User requests prediction
  -> server estimates max cost
  -> user confirms max charge
  -> Stripe Checkout or balance authorization
  -> webhook confirms payment
  -> prediction job runs
  -> actual API cost is calculated
  -> ledger records final charge
  -> unused funds are returned to balance or released
```

## Required Ledger Entries

All balance mutations must be append-only:

- `payment_authorized`
- `payment_captured`
- `prediction_reserved`
- `provider_cost_recorded`
- `prediction_charged`
- `refund_issued`
- `adjustment`

Never update a user's balance without a matching ledger record.

## Webhook Safety

- Verify Stripe webhook signatures.
- Use idempotency keys.
- Store processed event IDs.
- Do not fulfill access from client redirect alone.
- Treat client payment status as untrusted until webhook confirmation.

## Cost Safety

Before each expensive provider call:

- Check job status.
- Check remaining cost cap.
- Check user balance/reservation.
- Stop if the cap would be exceeded.

## Refund And Failure Rules

- If provider calls fail before meaningful analysis begins, do not charge analysis fees.
- If partial provider costs were incurred, record actual cost and charge only according to published terms.
- If final report fails after provider calls complete, keep provider-cost evidence and allow manual refund review.
- Never silently retry expensive calls without checking the cap.

## Abuse Controls

- Require login for platform billing.
- Rate limit prediction creation.
- Block repeated failed payment attempts.
- Limit maximum outstanding jobs per user.
- Alert on unusual spend velocity.

