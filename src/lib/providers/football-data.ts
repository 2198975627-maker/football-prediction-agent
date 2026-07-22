import { readLimitedResponseBytes } from "../http-security";
import type { LiveMatchIntelligence } from "./sportmonks";

type JsonObject = Record<string, unknown>;
type ResolveInput = { teamA: string; teamB: string; matchDate: string; fixtureId?: string };

const BASE_URL = "https://api.football-data.org/v4";
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

export class FootballDataError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 502, code = "FOOTBALL_DATA_ERROR") {
    super(message);
    this.name = "FootballDataError";
    this.status = status;
    this.code = code;
  }
}

function object(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeName(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\b(fc|cf|afc|club|football|futbol)\b/g, "").replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

function dateOnly(value: string) {
  const date = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (!date) throw new FootballDataError("比赛日期必须包含 YYYY-MM-DD。", 400, "INVALID_MATCH_DATE");
  return date;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function key() {
  const value = process.env.FOOTBALL_DATA_API_KEY?.trim();
  if (!value) throw new FootballDataError("尚未配置 football-data.org 免费 Key。", 503, "FOOTBALL_DATA_NOT_CONFIGURED");
  return value;
}

async function request(path: string, search: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}/${path.replace(/^\/+/, "")}`);
  Object.entries(search).forEach(([name, value]) => value && url.searchParams.set(name, value));
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "X-Auth-Token": key(), "User-Agent": "football-prediction-agent/0.1" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new FootballDataError("football-data.org 网络请求失败。");
  }
  if (!response.ok) {
    const code = response.status === 401 || response.status === 403 ? "FOOTBALL_DATA_UNAUTHORIZED"
      : response.status === 429 ? "FOOTBALL_DATA_RATE_LIMIT" : "FOOTBALL_DATA_UPSTREAM_ERROR";
    throw new FootballDataError(`football-data.org 返回 ${response.status}。`, response.status === 429 ? 429 : 502, code);
  }
  try {
    const bytes = await readLimitedResponseBytes(response, MAX_RESPONSE_BYTES);
    return JSON.parse(new TextDecoder().decode(bytes)) as JsonObject;
  } catch {
    throw new FootballDataError("football-data.org 返回了无效或过大的响应。", 502, "FOOTBALL_DATA_INVALID_RESPONSE");
  }
}

function teamMatches(team: JsonObject | null, query: string) {
  if (!team) return false;
  const expected = normalizeName(query);
  return [team.name, team.shortName, team.tla].some((candidate) => {
    const normalized = normalizeName(text(candidate));
    return Boolean(normalized && (normalized === expected || normalized.includes(expected) || expected.includes(normalized)));
  });
}

async function resolveFixture(input: ResolveInput) {
  if (input.fixtureId) {
    const payload = await request(`matches/${input.fixtureId}`);
    const fixture = object(payload);
    if (!fixture) throw new FootballDataError("比赛详情为空。", 404, "FIXTURE_EMPTY");
    return fixture;
  }
  const date = dateOnly(input.matchDate);
  const payload = await request("matches", { dateFrom: shiftDate(date, -2), dateTo: shiftDate(date, 2) });
  const matches = array(payload.matches).map(object).filter((match): match is JsonObject => Boolean(match));
  const fixture = matches.find((match) => {
    const home = object(match.homeTeam);
    const away = object(match.awayTeam);
    return (teamMatches(home, input.teamA) && teamMatches(away, input.teamB))
      || (teamMatches(home, input.teamB) && teamMatches(away, input.teamA));
  });
  if (!fixture) throw new FootballDataError("football-data.org 免费赛事中没有找到这场比赛。", 404, "FIXTURE_NOT_FOUND");
  return fixture;
}

async function sampleCount(path: string, search: Record<string, string>) {
  try {
    const payload = await request(path, search);
    return array(payload.matches).length;
  } catch {
    return 0;
  }
}

export function isFootballDataConfigured() {
  return Boolean(process.env.FOOTBALL_DATA_API_KEY?.trim());
}

export async function getFootballDataMatchIntelligence(input: ResolveInput): Promise<LiveMatchIntelligence> {
  const fixture = await resolveFixture(input);
  const fixtureId = number(fixture.id);
  if (!fixtureId) throw new FootballDataError("比赛 ID 无效。", 404, "FIXTURE_ID_MISSING");
  const home = object(fixture.homeTeam) ?? {};
  const away = object(fixture.awayTeam) ?? {};
  const competition = object(fixture.competition);
  const teams = [home, away].map((team) => ({
    id: number(team.id) ?? 0,
    name: text(team.name, "Unknown Team"),
    shortCode: text(team.tla),
    imageUrl: text(team.crest)
  }));
  const [homeRecent, awayRecent, headToHead] = await Promise.all([
    teams[0].id ? sampleCount(`teams/${teams[0].id}/matches`, { status: "FINISHED", limit: "5" }) : 0,
    teams[1].id ? sampleCount(`teams/${teams[1].id}/matches`, { status: "FINISHED", limit: "5" }) : 0,
    sampleCount(`matches/${fixtureId}/head2head`, { limit: "10" })
  ]);
  const fetchedAt = new Date().toISOString();
  return {
    ok: true,
    provider: "football-data-org",
    mode: "live",
    fetchedAt,
    sourceUrl: `${BASE_URL}/matches/${fixtureId}`,
    fixture: {
      id: fixtureId,
      name: `${teams[0].name} - ${teams[1].name}`,
      startsAt: text(fixture.utcDate),
      state: text(fixture.status),
      league: text(competition?.name),
      venue: text(fixture.venue),
      weather: null
    },
    teams,
    formations: [],
    lineups: [],
    sidelined: [],
    events: [],
    teamStatistics: [],
    coverage: { confirmedLineup: false, lineups: 0, sidelined: 0, events: 0, teamStatistics: 0, hasWeather: false, hasFormations: false },
    analysisFeatures: { recentFormSamples: homeRecent + awayRecent, headToHeadSamples: headToHead, playerSeasonProfiles: 0, injurySourceCount: 0 },
    evidence: ["fixture", "participants", "recent-form", "head-to-head"].map((field) => ({
      field, source: "football-data.org v4", sourceFixtureId: fixtureId, fetchedAt, confidence: "official-basic" as const
    })),
    warnings: [
      "football-data.org 免费层主要提供赛程、赛果和积分信息，不包含球员级事件。",
      "该来源只能支持基础赛前上下文，不能单独通过正式预测质量门。"
    ]
  };
}
