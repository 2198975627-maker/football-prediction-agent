create table if not exists public.football_match_intelligence_cache (
  cache_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists football_match_intelligence_updated_at_idx
  on public.football_match_intelligence_cache (updated_at desc);

alter table public.football_match_intelligence_cache enable row level security;

drop policy if exists "Public can read football match cache" on public.football_match_intelligence_cache;
create policy "Public can read football match cache"
  on public.football_match_intelligence_cache
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Service role can manage football match cache" on public.football_match_intelligence_cache;
create policy "Service role can manage football match cache"
  on public.football_match_intelligence_cache
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.football_provider_entities (
  provider text not null,
  entity_type text not null check (entity_type in ('team', 'player', 'fixture')),
  provider_entity_id text not null,
  canonical_key text not null,
  display_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (provider, entity_type, provider_entity_id)
);

create index if not exists football_provider_entities_canonical_idx
  on public.football_provider_entities (canonical_key);

alter table public.football_provider_entities enable row level security;

drop policy if exists "Service role can manage football provider entities" on public.football_provider_entities;
create policy "Service role can manage football provider entities"
  on public.football_provider_entities
  for all
  to service_role
  using (true)
  with check (true);

grant select on public.football_match_intelligence_cache to anon, authenticated;
grant all on public.football_match_intelligence_cache to service_role;
grant all on public.football_provider_entities to service_role;

create table if not exists public.football_tracked_fixtures (
  provider text not null,
  fixture_id text not null,
  team_a text not null,
  team_b text not null,
  starts_at timestamptz not null,
  next_refresh_at timestamptz,
  last_refreshed_at timestamptz,
  refresh_stage text not null default 'scheduled',
  active boolean not null default true,
  last_error text,
  updated_at timestamptz not null default now(),
  primary key (provider, fixture_id)
);

create index if not exists football_tracked_fixtures_due_idx
  on public.football_tracked_fixtures (active, next_refresh_at)
  where active = true;

alter table public.football_tracked_fixtures enable row level security;

drop policy if exists "Service role can manage tracked football fixtures" on public.football_tracked_fixtures;
create policy "Service role can manage tracked football fixtures"
  on public.football_tracked_fixtures
  for all
  to service_role
  using (true)
  with check (true);

grant all on public.football_tracked_fixtures to service_role;
