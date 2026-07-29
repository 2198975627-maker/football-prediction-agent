import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSupabaseSettings, supabaseRestHeaders } from "./supabase-config";

export type RosterSnapshot = {
  schemaVersion?: number;
  generatedAt?: string;
  beijingDate?: string;
  beijingTime?: string;
  provider?: {
    name?: string;
    apiKeyMode?: string;
  };
  totals?: {
    teams?: number;
    clubs?: number;
    nationalTeams?: number;
    players?: number;
  };
  teams?: unknown[];
};

type SupabaseCacheRow = {
  payload: unknown;
  updated_at?: string;
};

type SupabaseConfig = {
  url: string;
  readKey: string;
  table: string;
};

type RosterCacheRead = {
  snapshot: RosterSnapshot;
  changes: unknown | null;
  storage: "supabase" | "local";
  storageUrl: string;
  warning?: string;
};

function readText(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function getSupabaseConfig(): SupabaseConfig | null {
  const { url, secretKey, publishableKey } = getSupabaseSettings();
  const table = readText("SUPABASE_ROSTER_CACHE_TABLE", "football_roster_cache");

  if (!url || (!secretKey && !publishableKey)) {
    return null;
  }

  return {
    url,
    readKey: secretKey || publishableKey,
    table
  };
}

export function isSupabaseRosterCacheConfigured() {
  return Boolean(getSupabaseConfig());
}

export function isSupabaseRosterCacheWritable() {
  const { url, secretKey } = getSupabaseSettings();
  return Boolean(url && secretKey);
}

function rosterCacheReadTimeoutMs() {
  const configured = Number(readText("SUPABASE_ROSTER_CACHE_READ_TIMEOUT_MS", "6000"));
  return Number.isFinite(configured) ? Math.min(Math.max(configured, 1000), 30_000) : 6000;
}

async function readSupabaseItem(config: SupabaseConfig, cacheKey: string) {
  const url = `${config.url}/rest/v1/${encodeURIComponent(config.table)}?cache_key=eq.${encodeURIComponent(cacheKey)}&select=payload,updated_at&limit=1`;
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: supabaseRestHeaders(config.readKey),
    signal: AbortSignal.timeout(rosterCacheReadTimeoutMs())
  });

  if (!response.ok) {
    throw new Error(`Supabase roster cache read failed with ${response.status}.`);
  }

  const rows = (await response.json()) as SupabaseCacheRow[];
  return rows[0]?.payload ?? null;
}

async function readLocalJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function localCacheDir(outputDir?: string) {
  return outputDir ? path.resolve(outputDir) : path.join(process.cwd(), "data", "football-rosters");
}

export async function readRosterCache(outputDir?: string): Promise<RosterCacheRead | null> {
  const config = getSupabaseConfig();
  const isProduction = process.env.NODE_ENV === "production" || readText("APP_ENV") === "production";
  if (config) {
    try {
      const snapshot = (await readSupabaseItem(config, "latest")) as RosterSnapshot | null;
      if (snapshot) {
        const changes = await readSupabaseItem(config, "latest-changes");
        return {
          snapshot,
          changes,
          storage: "supabase",
          storageUrl: `${config.url}/rest/v1/${config.table}`
        };
      }
    } catch (error) {
      if (isProduction) {
        throw error;
      }
      const local = await readRosterCacheFromLocal(outputDir);
      if (local) {
        return {
          ...local,
          warning: error instanceof Error ? error.message : "Supabase roster cache read failed."
        };
      }
      throw error;
    }
  }

  if (isProduction) {
    return null;
  }

  return readRosterCacheFromLocal(outputDir);
}

async function readRosterCacheFromLocal(outputDir?: string): Promise<RosterCacheRead | null> {
  const cacheDir = localCacheDir(outputDir);
  const snapshot = await readLocalJson<RosterSnapshot>(path.join(cacheDir, "latest.json"));

  if (!snapshot) {
    return null;
  }

  return {
    snapshot,
    changes: await readLocalJson(path.join(cacheDir, "latest-changes.json")),
    storage: "local",
    storageUrl: "local:data/football-rosters/latest.json"
  };
}
