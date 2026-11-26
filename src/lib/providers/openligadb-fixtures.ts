import { readLimitedResponseBytes } from "../http-security";
import type { ScheduledFixture } from "../fixture-types";

type JsonObject = Record<string, unknown>;

const BASE_URL = "https://api.openligadb.de";
const MAX_RESPONSE_BYTES = 6 * 1024 * 1024;
const CACHE_TTL_MS = 30 * 60_000;

const globalOpenLigaDb = globalThis as typeof globalThis & {
  __openLigaDbSeasonCache?: Map<string, { expiresAt: number; payload: unknown }>;
  __openLigaDbSeasonRequests?: Map<string, Promise<unknown>>;
};
const seasonCache = globalOpenLigaDb.__openLigaDbSeasonCache ?? new Map();
const seasonRequests = globalOpenLigaDb.__openLigaDbSeasonRequests ?? new Map();
globalOpenLigaDb.__openLigaDbSeasonCache = seasonCache;
globalOpenLigaDb.__openLigaDbSeasonRequests = seasonRequests;

export class OpenLigaDbFixtureError extends Error {
  readonly code: string;

  constructor(message: string, code = "OPENLIGADB_FIXTURE_ERROR") {
    super(message);
    this.name = "OpenLigaDbFixtureError";
    this.code = code;
  }
}

function object(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : null;
}

function array(value: unknown) { return Array.isArray(value) ? value : []; }
function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function number(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function seasonForDate(date: string) {
  const [year, month] = date.split("-").map(Number);
  return String(month >= 7 ? year : year - 1);
}

function beijingDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

async function request(season: string) {
  const url = `${BASE_URL}/getmatchdata/bl1/${season}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "football-prediction-agent/0.1" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000)
    });
  } catch {
    throw new OpenLigaDbFixtureError("OpenLigaDB network request failed.", "OPENLIGADB_NETWORK_ERROR");
  }
  if (!response.ok) {
    throw new OpenLigaDbFixtureError(`OpenLigaDB returned ${response.status}.`, "OPENLIGADB_UPSTREAM_ERROR");
  }
  const bytes = await readLimitedResponseBytes(response, MAX_RESPONSE_BYTES);
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

export function normalizeOpenLigaDbFixtures(payload: unknown, date: string): ScheduledFixture[] {
  return array(payload).map(object).filter((row): row is JsonObject => Boolean(row)).map((row) => {
    const home = object(row.team1);
    const away = object(row.team2);
    const group = object(row.group);
    const location = object(row.location);
    const id = number(row.matchID);
    const kickoff = text(row.matchDateTimeUTC) || text(row.matchDateTime);
    if (!id || !kickoff || !home || !away || !Number.isFinite(Date.parse(kickoff))) return null;
    if (beijingDate(kickoff) !== date) return null;
    return {
      id: String(id),
      provider: "openligadb" as const,
      startsAt: new Date(kickoff).toISOString(),
      status: row.matchIsFinished === true ? "FT" : "NS",
      competition: "德甲",
      country: "Germany",
      round: text(group?.groupName) || (number(group?.groupOrderID) ? `Matchday ${number(group?.groupOrderID)}` : ""),
      venue: text(location?.locationStadium),
      home: {
        id: number(home.teamId) ?? 0,
        name: text(home.teamName, "Unknown Team"),
        shortCode: text(home.shortName),
        badgeUrl: text(home.teamIconUrl)
      },
      away: {
        id: number(away.teamId) ?? 0,
        name: text(away.teamName, "Unknown Team"),
        shortCode: text(away.shortName),
        badgeUrl: text(away.teamIconUrl)
      }
    };
  }).filter((fixture): fixture is NonNullable<typeof fixture> => fixture !== null);
}

export function isOpenLigaDbConfigured() {
  return true;
}

async function loadSeason(season: string, forceRefresh: boolean) {
  const cached = seasonCache.get(season);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.payload;
  const existing = seasonRequests.get(season);
  if (existing) return existing;

  const pending = request(season)
    .then((payload) => {
      seasonCache.set(season, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
      return payload;
    })
    .finally(() => seasonRequests.delete(season));
  seasonRequests.set(season, pending);
  return pending;
}

export async function getOpenLigaDbFixturesByDate(date: string, forceRefresh = false) {
  return normalizeOpenLigaDbFixtures(await loadSeason(seasonForDate(date), forceRefresh), date);
}

function datesInRange(dateFrom: string, dateTo: string) {
  const dates: string[] = [];
  const cursor = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function getOpenLigaDbFixturesByRange(dateFrom: string, dateTo: string, forceRefresh = false) {
  const dates = datesInRange(dateFrom, dateTo);
  const seasons = [...new Set(dates.map(seasonForDate))];
  const payloads = await Promise.all(seasons.map((season) => loadSeason(season, forceRefresh)));
  return payloads.flatMap((payload) => dates.flatMap((date) => normalizeOpenLigaDbFixtures(payload, date)));
}
