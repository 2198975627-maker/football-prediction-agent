import type { LiveMatchIntelligence } from "./providers/sportmonks";

export type TrackedFixture = {
  provider: LiveMatchIntelligence["provider"];
  fixture_id: string;
  team_a: string;
  team_b: string;
  starts_at: string;
  next_refresh_at: string | null;
  last_refreshed_at: string | null;
  refresh_stage: string;
  active: boolean;
  last_error: string | null;
};

function env(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function config() {
  const url = env("SUPABASE_URL").replace(/\/+$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const table = env("SUPABASE_TRACKED_FIXTURES_TABLE", "football_tracked_fixtures");
  return url && key ? { url, key, table } : null;
}

function headers(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
}

function nextRefresh(startsAt: string, provider: LiveMatchIntelligence["provider"]) {
  const kickoff = new Date(startsAt).getTime();
  if (!Number.isFinite(kickoff)) return { active: false, nextRefreshAt: null, stage: "invalid-date" };
  const now = Date.now();
  const minutes = (kickoff - now) / 60_000;

  if (minutes > 24 * 60) return { active: true, nextRefreshAt: new Date(kickoff - 24 * 60 * 60_000).toISOString(), stage: "await-24h" };
  if (minutes > 6 * 60) return { active: true, nextRefreshAt: new Date(kickoff - 6 * 60 * 60_000).toISOString(), stage: "await-6h" };
  if (minutes > 90) return { active: true, nextRefreshAt: new Date(kickoff - 90 * 60_000).toISOString(), stage: "await-90m" };
  const pollingMinutes = provider === "api-football" ? 30 : 15;
  if (minutes > 15) return { active: true, nextRefreshAt: new Date(Math.min(kickoff - 15 * 60_000, now + pollingMinutes * 60_000)).toISOString(), stage: "lineup-watch" };
  if (minutes > -15) return { active: true, nextRefreshAt: new Date(now + (provider === "api-football" ? 10 : 5) * 60_000).toISOString(), stage: "final-lineup" };
  return { active: false, nextRefreshAt: null, stage: "kickoff-passed" };
}

export function isTrackedFixtureStorageWritable() {
  return Boolean(config());
}

export async function trackMatchIntelligence(data: LiveMatchIntelligence) {
  const settings = config();
  if (!settings || data.teams.length < 2) return false;
  const schedule = nextRefresh(data.fixture.startsAt, data.provider);
  const row = {
    provider: data.provider,
    fixture_id: String(data.fixture.id),
    team_a: data.teams[0].name,
    team_b: data.teams[1].name,
    starts_at: data.fixture.startsAt,
    next_refresh_at: schedule.nextRefreshAt,
    last_refreshed_at: data.fetchedAt,
    refresh_stage: schedule.stage,
    active: schedule.active,
    last_error: null,
    updated_at: new Date().toISOString()
  };
  const url = `${settings.url}/rest/v1/${encodeURIComponent(settings.table)}?on_conflict=provider,fixture_id`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { ...headers(settings.key), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([row]),
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function listDueTrackedFixtures(limit = 8): Promise<TrackedFixture[]> {
  const settings = config();
  if (!settings) return [];
  const now = encodeURIComponent(new Date().toISOString());
  const url = `${settings.url}/rest/v1/${encodeURIComponent(settings.table)}?active=eq.true&next_refresh_at=lte.${now}&select=provider,fixture_id,team_a,team_b,starts_at,next_refresh_at,last_refreshed_at,refresh_stage,active,last_error&order=next_refresh_at.asc&limit=${Math.min(20, Math.max(1, limit))}`;
  const response = await fetch(url, {
    headers: headers(settings.key),
    cache: "no-store",
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error(`Tracked fixture read failed with ${response.status}.`);
  return (await response.json()) as TrackedFixture[];
}

export async function markTrackedFixtureError(provider: TrackedFixture["provider"], fixtureId: string, message: string) {
  const settings = config();
  if (!settings) return false;
  const url = `${settings.url}/rest/v1/${encodeURIComponent(settings.table)}?provider=eq.${encodeURIComponent(provider)}&fixture_id=eq.${encodeURIComponent(fixtureId)}`;
  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: { ...headers(settings.key), Prefer: "return=minimal" },
      body: JSON.stringify({
        last_error: message.slice(0, 300),
        next_refresh_at: new Date(Date.now() + 30 * 60_000).toISOString(),
        updated_at: new Date().toISOString()
      }),
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
}
