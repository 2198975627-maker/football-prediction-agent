create table if not exists public.football_roster_cache (
  cache_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists football_roster_cache_updated_at_idx
  on public.football_roster_cache (updated_at desc);

alter table public.football_roster_cache enable row level security;

drop policy if exists "Public can read football roster cache" on public.football_roster_cache;

create policy "Public can read football roster cache"
  on public.football_roster_cache
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Server role can manage football roster cache" on public.football_roster_cache;

create policy "Server role can manage football roster cache"
  on public.football_roster_cache
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

grant select on public.football_roster_cache to anon, authenticated;
grant all on public.football_roster_cache to service_role;
