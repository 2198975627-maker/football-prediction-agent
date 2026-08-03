-- Run after docs/supabase-match-intelligence.sql.
create table if not exists public.football_payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null check (status in ('pending','paid','processing','refund_pending','consumed','failed','refunded')),
  authorized_cents integer not null check (authorized_cents > 0),
  paid_cents integer not null default 0 check (paid_cents >= 0),
  actual_api_cost_cents integer not null default 0 check (actual_api_cost_cents >= 0),
  charged_cents integer not null default 0 check (charged_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  currency text not null default 'cny',
  stripe_session_id text unique,
  payment_intent_id text,
  prediction_input jsonb not null,
  failure_reason text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  processing_at timestamptz,
  refund_requested_at timestamptz,
  refund_completed_at timestamptz,
  settled_at timestamptz
);

-- Safe to run when upgrading an existing deployment.
alter table public.football_payment_orders drop constraint if exists football_payment_orders_status_check;
alter table public.football_payment_orders add constraint football_payment_orders_status_check
  check (status in ('pending','paid','processing','refund_pending','consumed','failed','refunded'));
alter table public.football_payment_orders add column if not exists refund_requested_at timestamptz;
alter table public.football_payment_orders add column if not exists refund_completed_at timestamptz;

create index if not exists football_payment_orders_user_idx on public.football_payment_orders(user_id, created_at desc);
alter table public.football_payment_orders enable row level security;
drop policy if exists "Users read own football orders" on public.football_payment_orders;
create policy "Users read own football orders" on public.football_payment_orders for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Service manages football orders" on public.football_payment_orders;
create policy "Service manages football orders" on public.football_payment_orders for all to service_role using (true) with check (true);

create table if not exists public.football_webhook_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);
alter table public.football_webhook_events enable row level security;
drop policy if exists "Service manages football webhook events" on public.football_webhook_events;
create policy "Service manages football webhook events" on public.football_webhook_events for all to service_role using (true) with check (true);

create table if not exists public.football_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  order_id uuid references public.football_payment_orders(id) on delete restrict,
  entry_type text not null check (entry_type in ('payment_captured','prediction_charged','unused_authorization_refunded','payment_refunded')),
  amount_cents integer not null,
  currency text not null default 'cny',
  stripe_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists football_ledger_user_idx on public.football_ledger(user_id, created_at desc);
create unique index if not exists football_ledger_stripe_event_idx
  on public.football_ledger(stripe_event_id)
  where stripe_event_id is not null;
alter table public.football_ledger enable row level security;
drop policy if exists "Users read own football ledger" on public.football_ledger;
create policy "Users read own football ledger" on public.football_ledger for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Service inserts football ledger" on public.football_ledger;
create policy "Service inserts football ledger" on public.football_ledger for insert to service_role with check (true);

create or replace function public.prevent_football_ledger_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'football_ledger is append-only';
end;
$$;
drop trigger if exists football_ledger_append_only on public.football_ledger;
create trigger football_ledger_append_only before update or delete on public.football_ledger
for each row execute function public.prevent_football_ledger_mutation();

-- Claim the Stripe event, update the order, and append its ledger entry in one
-- database transaction. Any error rolls everything back so Stripe can retry.
create or replace function public.process_football_checkout_completed(
  p_event_id text,
  p_event_type text,
  p_order_id uuid,
  p_user_id uuid,
  p_session_id text,
  p_payment_intent_id text,
  p_paid_cents integer,
  p_currency text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_events integer;
  updated_orders integer;
begin
  insert into public.football_webhook_events(event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (event_id) do nothing;
  get diagnostics inserted_events = row_count;

  if inserted_events = 0 then
    return 'duplicate';
  end if;

  update public.football_payment_orders
  set status = 'paid',
      paid_cents = p_paid_cents,
      stripe_session_id = p_session_id,
      payment_intent_id = p_payment_intent_id,
      paid_at = now()
  where id = p_order_id
    and user_id = p_user_id
    and (stripe_session_id = p_session_id or stripe_session_id is null)
    and status = 'pending'
    and authorized_cents = p_paid_cents
    and lower(currency) = lower(p_currency);
  get diagnostics updated_orders = row_count;

  if updated_orders <> 1 then
    raise exception 'football payment order mismatch';
  end if;

  insert into public.football_ledger(
    user_id, order_id, entry_type, amount_cents, currency, stripe_event_id
  ) values (
    p_user_id, p_order_id, 'payment_captured', p_paid_cents, lower(p_currency), p_event_id
  );

  return 'processed';
end;
$$;

revoke all on function public.process_football_checkout_completed(text, text, uuid, uuid, text, text, integer, text) from public;
grant execute on function public.process_football_checkout_completed(text, text, uuid, uuid, text, text, integer, text) to service_role;

create or replace function public.settle_football_payment_order(
  p_order_id uuid,
  p_user_id uuid,
  p_actual_api_cost_cents integer,
  p_user_charge_cents integer,
  p_refund_cents integer,
  p_currency text,
  p_metadata jsonb,
  p_job_id uuid,
  p_input jsonb,
  p_provider text,
  p_model text,
  p_quality_score integer,
  p_result jsonb,
  p_report text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_orders integer;
begin
  if p_actual_api_cost_cents < 0 or p_user_charge_cents < 0 or p_refund_cents < 0 then
    raise exception 'football settlement amounts must be non-negative';
  end if;

  update public.football_payment_orders
  set status = case when p_refund_cents > 0 then 'refund_pending' else 'consumed' end,
      actual_api_cost_cents = p_actual_api_cost_cents,
      charged_cents = p_user_charge_cents,
      refunded_cents = 0,
      refund_requested_at = case when p_refund_cents > 0 then now() else null end,
      settled_at = now()
  where id = p_order_id
    and user_id = p_user_id
    and status = 'processing'
    and authorized_cents = p_user_charge_cents + p_refund_cents
    and lower(currency) = lower(p_currency);
  get diagnostics updated_orders = row_count;

  if updated_orders <> 1 then
    raise exception 'football settlement order mismatch';
  end if;

  insert into public.football_prediction_jobs(
    id, user_id, order_id, status, input, provider, model, quality_score,
    result, report, actual_api_cost_cents, charged_cents
  ) values (
    p_job_id, p_user_id, p_order_id, 'completed', p_input, p_provider, p_model,
    p_quality_score, p_result, p_report, p_actual_api_cost_cents, p_user_charge_cents
  );

  insert into public.football_ledger(
    user_id, order_id, entry_type, amount_cents, currency, metadata
  ) values (
    p_user_id, p_order_id, 'prediction_charged', p_user_charge_cents, lower(p_currency), coalesce(p_metadata, '{}'::jsonb)
  );

end;
$$;

revoke all on function public.settle_football_payment_order(uuid, uuid, integer, integer, integer, text, jsonb, uuid, jsonb, text, text, integer, jsonb, text) from public;
grant execute on function public.settle_football_payment_order(uuid, uuid, integer, integer, integer, text, jsonb, uuid, jsonb, text, text, integer, jsonb, text) to service_role;

create or replace function public.complete_football_payment_refund(
  p_order_id uuid,
  p_user_id uuid,
  p_refund_cents integer,
  p_currency text,
  p_stripe_refund_id text,
  p_metadata jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_orders integer;
begin
  if p_refund_cents <= 0 or coalesce(p_stripe_refund_id, '') = '' then
    raise exception 'invalid football refund confirmation';
  end if;

  update public.football_payment_orders
  set status = 'consumed',
      refunded_cents = p_refund_cents,
      refund_completed_at = now()
  where id = p_order_id
    and user_id = p_user_id
    and status = 'refund_pending'
    and authorized_cents = charged_cents + p_refund_cents
    and lower(currency) = lower(p_currency);
  get diagnostics updated_orders = row_count;

  if updated_orders <> 1 then
    raise exception 'football refund confirmation mismatch';
  end if;

  insert into public.football_ledger(
    user_id, order_id, entry_type, amount_cents, currency, stripe_event_id, metadata
  ) values (
    p_user_id, p_order_id, 'unused_authorization_refunded', -p_refund_cents,
    lower(p_currency), p_stripe_refund_id, coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.complete_football_payment_refund(uuid, uuid, integer, text, text, jsonb) from public;
grant execute on function public.complete_football_payment_refund(uuid, uuid, integer, text, text, jsonb) to service_role;

create table if not exists public.football_prediction_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  order_id uuid references public.football_payment_orders(id) on delete restrict,
  status text not null check (status in ('pending','completed','failed')),
  input jsonb not null,
  provider text not null,
  model text not null,
  quality_score integer not null check (quality_score between 0 and 100),
  result jsonb not null,
  report text not null,
  actual_api_cost_cents integer not null default 0,
  charged_cents integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists football_prediction_jobs_user_idx on public.football_prediction_jobs(user_id, created_at desc);
alter table public.football_prediction_jobs enable row level security;
drop policy if exists "Users read own prediction jobs" on public.football_prediction_jobs;
create policy "Users read own prediction jobs" on public.football_prediction_jobs for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Service manages prediction jobs" on public.football_prediction_jobs;
create policy "Service manages prediction jobs" on public.football_prediction_jobs for all to service_role using (true) with check (true);

grant select on public.football_payment_orders, public.football_ledger, public.football_prediction_jobs to authenticated;
grant all on public.football_payment_orders, public.football_webhook_events, public.football_prediction_jobs to service_role;
grant select, insert on public.football_ledger to service_role;

-- Privacy-safe AI usage and cost telemetry. Prompts, API keys and full model
-- responses are deliberately excluded. Rates are stored as a per-call snapshot
-- so later price changes do not rewrite historical costs.
create table if not exists public.football_ai_usage (
  id bigint generated always as identity primary key,
  job_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  order_id uuid references public.football_payment_orders(id) on delete restrict,
  billing_mode text not null check (billing_mode in ('byok','platform')),
  provider text not null check (provider in ('openai','hunyuan')),
  model text not null,
  response_id text,
  status text not null check (status in ('completed','failed')),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  cached_input_tokens bigint not null default 0 check (cached_input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  reasoning_tokens bigint not null default 0 check (reasoning_tokens >= 0),
  total_tokens bigint not null default 0 check (total_tokens >= 0),
  input_rate_cents_per_million numeric(14,6),
  cached_input_rate_cents_per_million numeric(14,6),
  output_rate_cents_per_million numeric(14,6),
  model_cost_cents numeric(16,6),
  sports_data_cost_cents integer not null default 0 check (sports_data_cost_cents >= 0),
  platform_cost_cents integer not null default 0 check (platform_cost_cents >= 0),
  user_charge_cents integer not null default 0 check (user_charge_cents >= 0),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists football_ai_usage_user_idx on public.football_ai_usage(user_id, created_at desc);
create index if not exists football_ai_usage_provider_idx on public.football_ai_usage(provider, model, created_at desc);
alter table public.football_ai_usage enable row level security;
drop policy if exists "Users read own football AI usage" on public.football_ai_usage;
create policy "Users read own football AI usage" on public.football_ai_usage
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Service manages football AI usage" on public.football_ai_usage;
create policy "Service manages football AI usage" on public.football_ai_usage
  for all to service_role using (true) with check (true);
grant select on public.football_ai_usage to authenticated;
grant all on public.football_ai_usage to service_role;
