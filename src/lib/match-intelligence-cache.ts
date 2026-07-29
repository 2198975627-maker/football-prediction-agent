import type { LiveMatchIntelligence } from "./providers/sportmonks";
import { getSupabaseSettings, supabaseRestHeaders } from "./supabase-config";

type CacheInput = {
  teamA: string;
  teamB: string;
  matchDate: string;
  fixtureId?: string;
};

type CacheEntry = {
  payload: LiveMatchIntelligence;
  updatedAt: string;
};

type CacheRead = {
  data: LiveMatchIntelligence;
  storage: "memory" | "supabase";
  updatedAt: string;
  ageSeconds: number;
  stale: boolean;
};

type SupabaseConfig = {
  url: string;
  readKey: string;
  writeKey: string | null;
  cacheTable: string;
  entityTable: string;
};

const globalCache = globalThis as typeof globalThis & {
  __footballMatchIntelligenceCache?: Map<string, CacheEntry>;
};

const memoryCache = globalCache.__footballMatchIntelligenceCache ?? new Map<string, CacheEntry>();
globalCache.__footballMatchIntelligenceCache = memoryCache;

function env(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function supabaseConfig(): SupabaseConfig | null {
  const { url, secretKey, publishableKey } = getSupabaseSettings();
  if (!url || (!secretKey && !publishableKey)) return null;

  return {
    url,
    readKey: secretKey || publishableKey,
    writeKey: secretKey || null,
    cacheTable: env("SUPABASE_MATCH_CACHE_TABLE", "football_match_intelligence_cache"),
    entityTable: env("SUPABASE_PROVIDER_ENTITY_TABLE", "football_provider_entities")
  };
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "")
    .slice(0, 120);
}

function matchDate(value: string) {
  return value.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? value.slice(0, 10);
}

export function matchIntelligenceCacheKey(input: CacheInput) {
  if (input.fixtureId) return `match:v2:fixture:${input.fixtureId}`;
  const teams = [normalize(input.teamA), normalize(input.teamB)].sort();
  return `match:v2:${teams[0]}:${teams[1]}:${matchDate(input.matchDate)}`;
}

export function fixtureCacheKey(fixtureId: number, provider = "sportmonks") {
  return `${provider}:fixture:${fixtureId}`;
}

function toRead(entry: CacheEntry, storage: CacheRead["storage"], maxAgeMs: number): CacheRead {
  const ageMs = Math.max(0, Date.now() - new Date(entry.updatedAt).getTime());
  return {
    data: entry.payload,
    storage,
    updatedAt: entry.updatedAt,
    ageSeconds: Math.round(ageMs / 1000),
    stale: ageMs > maxAgeMs
  };
}

export async function readMatchIntelligenceCache(cacheKey: string, maxAgeMs: number): Promise<CacheRead | null> {
  const memory = memoryCache.get(cacheKey);
  if (memory) return toRead(memory, "memory", maxAgeMs);

  const config = supabaseConfig();
  if (!config) return null;

  const url = `${config.url}/rest/v1/${encodeURIComponent(config.cacheTable)}?cache_key=eq.${encodeURIComponent(cacheKey)}&select=payload,updated_at&limit=1`;
  try {
    const response = await fetch(url, {
      headers: supabaseRestHeaders(config.readKey),
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as Array<{ payload?: LiveMatchIntelligence; updated_at?: string }>;
    if (!rows[0]?.payload) return null;
    const entry = { payload: rows[0].payload, updatedAt: rows[0].updated_at || rows[0].payload.fetchedAt };
    memoryCache.set(cacheKey, entry);
    return toRead(entry, "supabase", maxAgeMs);
  } catch {
    return null;
  }
}

export async function writeMatchIntelligenceCache(cacheKeys: string[], data: LiveMatchIntelligence) {
  const updatedAt = new Date().toISOString();
  const uniqueKeys = Array.from(new Set(cacheKeys));
  uniqueKeys.forEach((cacheKey) => memoryCache.set(cacheKey, { payload: data, updatedAt }));

  const config = supabaseConfig();
  if (!config?.writeKey) return { memory: true, supabase: false };

  const url = `${config.url}/rest/v1/${encodeURIComponent(config.cacheTable)}?on_conflict=cache_key`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...supabaseRestHeaders(config.writeKey),
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(uniqueKeys.map((cacheKey) => ({ cache_key: cacheKey, payload: data, updated_at: updatedAt }))),
      signal: AbortSignal.timeout(5000)
    });
    return { memory: true, supabase: response.ok };
  } catch {
    return { memory: true, supabase: false };
  }
}

function entityRows(data: LiveMatchIntelligence) {
  const teamNames = new Map(data.teams.map((team) => [team.id, team.name]));
  return [
    ...data.teams.map((team) => ({
      provider: data.provider,
      entity_type: "team",
      provider_entity_id: String(team.id),
      canonical_key: `team:${normalize(team.name)}`,
      display_name: team.name,
      metadata: { shortCode: team.shortCode, imageUrl: team.imageUrl }
    })),
    ...data.lineups
      .filter((player) => player.playerId > 0)
      .map((player) => ({
        provider: data.provider,
        entity_type: "player",
        provider_entity_id: String(player.playerId),
        canonical_key: `player:${player.teamId}:${normalize(player.playerName)}`,
        display_name: player.playerName,
        metadata: { teamId: player.teamId, teamName: teamNames.get(player.teamId) || "", position: player.position }
      })),
    {
      provider: data.provider,
      entity_type: "fixture",
      provider_entity_id: String(data.fixture.id),
      canonical_key: `fixture:${data.provider}:${data.fixture.id}`,
      display_name: data.fixture.name,
      metadata: { startsAt: data.fixture.startsAt, teams: data.teams.map((team) => team.id) }
    }
  ];
}

export async function persistProviderEntityMappings(data: LiveMatchIntelligence) {
  const config = supabaseConfig();
  if (!config?.writeKey) return false;

  const url = `${config.url}/rest/v1/${encodeURIComponent(config.entityTable)}?on_conflict=provider,entity_type,provider_entity_id`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...supabaseRestHeaders(config.writeKey),
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(entityRows(data).map((row) => ({ ...row, updated_at: new Date().toISOString() }))),
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
}
