# Skill: Cost Guard

## Purpose

Prevent accidental overspending and enforce user-approved cost caps.

## Before Each Provider Call

Check:

- Job is authorized.
- User has balance/reservation or BYOK is active.
- Estimated next call stays within cap.
- Rate limit has not been exceeded.

## After Each Provider Call

Record:

- Provider
- Endpoint/model
- Input units
- Output units
- Estimated or actual cost
- Timestamp
- Job ID

## Settlement

```text
final_charge = max(actual_api_cost * 2, minimum_charge)
```

## Safety

The agent may read cost budget state, but only server code may mutate ledger records.

