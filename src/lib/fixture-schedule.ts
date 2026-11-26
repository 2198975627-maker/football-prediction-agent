import { getAnySportFixturesByDate, isAnySportConfigured } from "./providers/anysport";
import { getApiFootballFixturesByDate, isApiFootballConfigured } from "./providers/api-football";
import { getFootballDataFixturesByDate, getFootballDataFixturesByRange, isFootballDataConfigured } from "./providers/football-data";
import { getOpenLigaDbFixturesByDate, getOpenLigaDbFixturesByRange, isOpenLigaDbConfigured } from "./providers/openligadb-fixtures";
import { getTheSportsDbFixturesByDate, isTheSportsDbFixtureConfigured } from "./providers/thesportsdb-fixtures";
import { normalizeFootballIdentity } from "./match-identities";
import type { FixtureProviderId, FixtureSchedule, ScheduledFixture } from "./fixture-types";

type ScheduleProvider = {
  id: FixtureProviderId;
  configured: () => boolean;
  load: (date: string, forceRefresh?: boolean) => Promise<ScheduledFixture[]>;
  loadRange?: (dateFrom: string, dateTo: string, forceRefresh?: boolean) => Promise<ScheduledFixture[]>;
};

const providers: ScheduleProvider[] = [
  { id: "anysport", configured: isAnySportConfigured, load: getAnySportFixturesByDate },
  { id: "api-football", configured: isApiFootballConfigured, load: getApiFootballFixturesByDate },
  { id: "football-data-org", configured: isFootballDataConfigured, load: getFootballDataFixturesByDate, loadRange: getFootballDataFixturesByRange },
  { id: "openligadb", configured: isOpenLigaDbConfigured, load: getOpenLigaDbFixturesByDate, loadRange: getOpenLigaDbFixturesByRange },
  { id: "thesportsdb", configured: isTheSportsDbFixtureConfigured, load: getTheSportsDbFixturesByDate }
];
const providerPriority = new Map(providers.map((provider, index) => [provider.id, index]));
const DUPLICATE_KICKOFF_TOLERANCE_MS = 6 * 60 * 60_000;

const globalSchedule = globalThis as typeof globalThis & {
  __footballFixtureScheduleCache?: Map<string, { expiresAt: number; schedule: FixtureSchedule }>;
  __footballFixtureScheduleRequests?: Map<string, Promise<FixtureSchedule>>;
};

const scheduleCache = globalSchedule.__footballFixtureScheduleCache ?? new Map();
const inFlightRequests = globalSchedule.__footballFixtureScheduleRequests ?? new Map();
globalSchedule.__footballFixtureScheduleCache = scheduleCache;
globalSchedule.__footballFixtureScheduleRequests = inFlightRequests;

export class FixtureScheduleError extends Error {
  readonly status: number;
  readonly code: string;
  readonly attempts: Array<{ provider: FixtureProviderId; code: string }>;

  constructor(message: string, status = 502, code = "FIXTURE_SCHEDULE_ERROR", attempts: Array<{ provider: FixtureProviderId; code: string }> = []) {
    super(message);
    this.name = "FixtureScheduleError";
    this.status = status;
    this.code = code;
    this.attempts = attempts;
  }
}

function fixtureIdentity(fixture: ScheduledFixture) {
  const teams = [normalizeFootballIdentity(fixture.home.name), normalizeFootballIdentity(fixture.away.name)].sort();
  return `${teams[0]}:${teams[1]}`;
}

function isDuplicateFixture(left: ScheduledFixture, right: ScheduledFixture) {
  return fixtureIdentity(left) === fixtureIdentity(right)
    && Math.abs(Date.parse(left.startsAt) - Date.parse(right.startsAt)) <= DUPLICATE_KICKOFF_TOLERANCE_MS;
}

function localizedCompetition(fixture: ScheduledFixture) {
  const name = fixture.competition.toLowerCase();
  const country = fixture.country.toLowerCase();
  if (country.includes("england") && name.includes("premier league")) return "英超";
  if (country.includes("spain") && (name.includes("la liga") || name.includes("primera division"))) return "西甲";
  if (country.includes("germany") && name.includes("bundesliga") && !name.includes("2.")) return "德甲";
  if (country.includes("italy") && name.includes("serie a")) return "意甲";
  if (country.includes("france") && name.includes("ligue 1")) return "法甲";
  if (country.includes("china") && name.includes("super league")) return "中超联赛";
  if (country.includes("china") && name.includes("fa cup")) return "中国足协杯";
  if (country.includes("saudi") && (name.includes("pro league") || name.includes("professional league"))) return "沙特职业联赛";
  if ((country.includes("united states") || country.includes("usa")) && name.includes("major league soccer")) return "美职联";
  if (name.includes("champions league")) return "欧冠";
  return fixture.competition;
}

function mergeFixtures(rows: ScheduledFixture[]) {
  const prioritized = rows
    .filter((fixture) => fixture.home.name && fixture.away.name && Number.isFinite(Date.parse(fixture.startsAt)))
    .map((fixture) => ({ ...fixture, competition: localizedCompetition(fixture), dataMode: fixture.dataMode ?? "live" as const }))
    .sort((left, right) => (providerPriority.get(left.provider) ?? 99) - (providerPriority.get(right.provider) ?? 99));
  const unique: ScheduledFixture[] = [];
  for (const fixture of prioritized) {
    if (!unique.some((candidate) => isDuplicateFixture(candidate, fixture))) unique.push(fixture);
  }
  return unique
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
    .slice(0, 240);
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "UNKNOWN_ERROR";
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function loadSchedule(date: string, forceRefresh: boolean, days: number): Promise<FixtureSchedule> {
  const dateTo = shiftDate(date, days - 1);
  const available = providers.filter((provider) => provider.configured() && (days === 1 || provider.loadRange));
  if (!available.length) {
    throw new FixtureScheduleError("No fixture data provider is configured.", 503, "NO_FIXTURE_PROVIDER_CONFIGURED");
  }

  const settled = await Promise.allSettled(available.map((provider) => days === 1
    ? provider.load(date, forceRefresh)
    : provider.loadRange!(date, dateTo, forceRefresh)));
  const succeededProviders: FixtureProviderId[] = [];
  const errors: Array<{ provider: FixtureProviderId; code: string }> = [];
  const fixtures: ScheduledFixture[] = [];

  settled.forEach((result, index) => {
    const provider = available[index];
    if (result.status === "fulfilled") {
      succeededProviders.push(provider.id);
      fixtures.push(...result.value);
    } else {
      errors.push({ provider: provider.id, code: errorCode(result.reason) });
    }
  });

  if (!succeededProviders.length) {
    throw new FixtureScheduleError(
      "Configured providers could not load fixtures for this date.",
      errors.some((entry) => entry.code.includes("RATE_LIMIT")) ? 429 : 502,
      "ALL_FIXTURE_PROVIDERS_FAILED",
      errors
    );
  }

  return {
    ok: true,
    date,
    ...(days > 1 ? { dateTo } : {}),
    timezone: "Asia/Shanghai",
    fetchedAt: new Date().toISOString(),
    cached: false,
    dataMode: "live",
    providers: succeededProviders,
    attemptedProviders: available.map((provider) => provider.id),
    providerErrors: errors,
    fixtures: mergeFixtures(fixtures)
  };
}

export function configuredFixtureProviders() {
  return providers.filter((provider) => provider.configured()).map((provider) => provider.id);
}

export async function getFixtureSchedule(date: string, forceRefresh = false, days = 1) {
  const cacheKey = `${date}:${days}`;
  const cached = scheduleCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return { ...cached.schedule, cached: true };

  const existing = inFlightRequests.get(cacheKey);
  if (existing) return existing;

  const pending = loadSchedule(date, forceRefresh, days)
    .then((schedule) => {
      scheduleCache.set(cacheKey, { schedule, expiresAt: Date.now() + 2 * 60_000 });
      return schedule;
    })
    .finally(() => inFlightRequests.delete(cacheKey));
  inFlightRequests.set(cacheKey, pending);
  return pending;
}
