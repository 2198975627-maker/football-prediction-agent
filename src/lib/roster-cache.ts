import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

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
  writeKey: string | null;
  table: string;
};

type RosterCacheRead = {
  snapshot: RosterSnapshot;
  changes: unknown | null;
  storage: "supabase" | "local";
  storageUrl: string;
  warning?: string;
};

type RosterCacheWriteInput = {
  snapshot: RosterSnapshot;
  changes: unknown;
  outputDir?: string;
  writeLocal?: boolean;
};

function readText(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function getSupabaseConfig(): SupabaseConfig | null {
  const url = readText("SUPABASE_URL").replace(/\/+$/, "");
  const serviceRoleKey = readText("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = readText("SUPABASE_ANON_KEY");
  const table = readText("SUPABASE_ROSTER_CACHE_TABLE", "football_roster_cache");

  if (!url || (!serviceRoleKey && !anonKey)) {
    return null;
  }

  return {
    url,
    readKey: serviceRoleKey || anonKey,
    writeKey: serviceRoleKey || null,
    table
  };
}

export function isSupabaseRosterCacheConfigured() {
  return Boolean(getSupabaseConfig());
}

export function isSupabaseRosterCacheWritable() {
  return Boolean(readText("SUPABASE_URL") && readText("SUPABASE_SERVICE_ROLE_KEY"));
}

function supabaseHeaders(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
}

async function readSupabaseItem(config: SupabaseConfig, cacheKey: string) {
  const url = `${config.url}/rest/v1/${encodeURIComponent(config.table)}?cache_key=eq.${encodeURIComponent(cacheKey)}&select=payload,updated_at&limit=1`;
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: supabaseHeaders(config.readKey)
  });

  if (!response.ok) {
    throw new Error(`Supabase roster cache read failed with ${response.status}.`);
  }

  const rows = (await response.json()) as SupabaseCacheRow[];
  return rows[0]?.payload ?? null;
}

async function writeSupabaseItem(config: SupabaseConfig, cacheKey: string, payload: unknown) {
  if (!config.writeKey) {
    throw new Error("Supabase roster cache writes require SUPABASE_SERVICE_ROLE_KEY.");
  }

  const url = `${config.url}/rest/v1/${encodeURIComponent(config.table)}?on_conflict=cache_key`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseHeaders(config.writeKey),
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify([
      {
        cache_key: cacheKey,
        payload,
        updated_at: new Date().toISOString()
      }
    ])
  });

  if (!response.ok) {
    throw new Error(`Supabase roster cache write failed with ${response.status}.`);
  }
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

async function atomicWriteJson(filePath: string, data: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

function localCacheDir(outputDir?: string) {
  return outputDir ? path.resolve(outputDir) : path.join(process.cwd(), "data", "football-rosters");
}

export async function readRosterCache(outputDir?: string): Promise<RosterCacheRead | null> {
  const config = getSupabaseConfig();
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

export async function writeRosterCache({ snapshot, changes, outputDir, writeLocal = true }: RosterCacheWriteInput) {
  const destinations: string[] = [];
  const config = getSupabaseConfig();
  const date = snapshot.beijingDate || new Date().toISOString().slice(0, 10);

  if (config?.writeKey) {
    await writeSupabaseItem(config, "latest", snapshot);
    await writeSupabaseItem(config, "latest-changes", changes);
    await writeSupabaseItem(config, `history:${date}`, snapshot);
    await writeSupabaseItem(config, `changes:${date}`, changes);
    destinations.push("supabase");
  }

  if (writeLocal) {
    const cacheDir = localCacheDir(outputDir);
    await atomicWriteJson(path.join(cacheDir, "latest.json"), snapshot);
    await atomicWriteJson(path.join(cacheDir, "latest-changes.json"), changes);
    await atomicWriteJson(path.join(cacheDir, "history", `${date}.json`), snapshot);
    await atomicWriteJson(path.join(cacheDir, "changes", `${date}.json`), changes);
    destinations.push("local");
  }

  return destinations;
}
