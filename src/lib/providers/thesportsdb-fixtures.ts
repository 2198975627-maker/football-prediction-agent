import { readLimitedResponseBytes } from "../http-security";
import type { ScheduledFixture } from "../fixture-types";

type JsonObject = Record<string, unknown>;

const BASE_URL = "https://www.thesportsdb.com/api/v1/json";
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const PRIORITY_LEAGUES = [
  "4328", // English Premier League
  "4335", // Spanish La Liga
  "4331", // German Bundesliga
  "4332", // Italian Serie A
  "4334", // French Ligue 1
  "4359", // Chinese Super League
  "4668", // Saudi Pro League
  "4346"  // Major League Soccer
] as const;
const CACHE_TTL_MS = 5 * 60_000;

const globalSportsDb = globalThis as typeof globalThis & {
  __theSportsDbFixtureCache?: Map<string, { expiresAt: number; fixtures: ScheduledFixture[] }>;
  __theSportsDbFixtureRequests?: Map<string, Promise<ScheduledFixture[]>>;
  __theSportsDbBatchStarts?: number[];
};
const fixtureCache = globalSportsDb.__theSportsDbFixtureCache ?? new Map();
const fixtureRequests = globalSportsDb.__theSportsDbFixtureRequests ?? new Map();
const batchStarts = globalSportsDb.__theSportsDbBatchStarts ?? [];
globalSportsDb.__theSportsDbFixtureCache = fixtureCache;
globalSportsDb.__theSportsDbFixtureRequests = fixtureRequests;
globalSportsDb.__theSportsDbBatchStarts = batchStarts;

export class TheSportsDbFixtureError extends Error {
  readonly code: string;

  constructor(message: string, code = "THESPORTSDB_FIXTURE_ERROR") {
    super(message);
    this.name = "TheSportsDbFixtureError";
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

function apiKey() {
  return process.env.THESPORTSDB_API_KEY?.trim() || "123";
}

async function request(date: string, leagueId: string) {
  const url = new URL(`${BASE_URL}/${apiKey()}/eventsday.php`);
  url.searchParams.set("d", date);
  url.searchParams.set("s", "Soccer");
  url.searchParams.set("l", leagueId);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "football-prediction-agent/0.1" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new TheSportsDbFixtureError("TheSportsDB network request failed.", "THESPORTSDB_NETWORK_ERROR");
  }
  if (!response.ok) {
    throw new TheSportsDbFixtureError(
      `TheSportsDB returned ${response.status}.`,
      response.status === 429 ? "THESPORTSDB_RATE_LIMIT" : "THESPORTSDB_UPSTREAM_ERROR"
    );
  }
  const bytes = await readLimitedResponseBytes(response, MAX_RESPONSE_BYTES);
  return JSON.parse(new TextDecoder().decode(bytes)) as JsonObject;
}

function startsAt(row: JsonObject) {
  const timestamp = text(row.strTimestamp);
  if (timestamp && Number.isFinite(Date.parse(timestamp))) return new Date(timestamp).toISOString();
  const date = text(row.dateEvent);
  const time = text(row.strTime, "00:00:00").slice(0, 8);
  const candidate = `${date}T${time || "00:00:00"}Z`;
  return Number.isFinite(Date.parse(candidate)) ? new Date(candidate).toISOString() : "";
}

export function normalizeTheSportsDbFixtures(payload: JsonObject): ScheduledFixture[] {
  return array(payload.events).map(object).filter((row): row is JsonObject => Boolean(row)).map((row) => {
    const id = number(row.idEvent);
    const kickoff = startsAt(row);
    const homeName = text(row.strHomeTeam);
    const awayName = text(row.strAwayTeam);
    if (!id || !kickoff || !homeName || !awayName) return null;
    return {
      id: String(id),
      provider: "thesportsdb" as const,
      startsAt: kickoff,
      status: text(row.strStatus, "NS"),
      competition: text(row.strLeague, "Unknown Competition"),
      country: text(row.strCountry),
      round: text(row.intRound),
      venue: text(row.strVenue),
      home: {
        id: number(row.idHomeTeam) ?? 0,
        name: homeName,
        shortCode: "",
        badgeUrl: text(row.strHomeTeamBadge)
      },
      away: {
        id: number(row.idAwayTeam) ?? 0,
        name: awayName,
        shortCode: "",
        badgeUrl: text(row.strAwayTeamBadge)
      }
    };
  }).filter((fixture): fixture is NonNullable<typeof fixture> => fixture !== null);
}

export function isTheSportsDbFixtureConfigured() {
  return true;
}

async function loadFixtures(date: string) {
  const cutoff = Date.now() - 60_000;
  while (batchStarts.length && batchStarts[0] < cutoff) batchStarts.shift();
  if (batchStarts.length >= 3) {
    throw new TheSportsDbFixtureError(
      "TheSportsDB free request budget is temporarily exhausted.",
      "THESPORTSDB_LOCAL_RATE_LIMIT"
    );
  }
  batchStarts.push(Date.now());

  const settled = await Promise.allSettled(PRIORITY_LEAGUES.map((leagueId) => request(date, leagueId)));
  const successful = settled
    .filter((result): result is PromiseFulfilledResult<JsonObject> => result.status === "fulfilled")
    .flatMap((result) => normalizeTheSportsDbFixtures(result.value));
  if (!settled.some((result) => result.status === "fulfilled")) {
    throw new TheSportsDbFixtureError("TheSportsDB priority league requests all failed.");
  }
  return successful;
}

export async function getTheSportsDbFixturesByDate(date: string, forceRefresh = false) {
  const cached = fixtureCache.get(date);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.fixtures;
  const existing = fixtureRequests.get(date);
  if (existing) return existing;

  const pending = loadFixtures(date)
    .then((fixtures) => {
      fixtureCache.set(date, { fixtures, expiresAt: Date.now() + CACHE_TTL_MS });
      return fixtures;
    })
    .finally(() => fixtureRequests.delete(date));
  fixtureRequests.set(date, pending);
  return pending;
}
