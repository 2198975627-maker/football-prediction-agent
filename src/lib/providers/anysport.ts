import { canonicalMetricKey } from "../football-metrics";
import { readLimitedResponseBytes } from "../http-security";
import type { LiveMatchIntelligence } from "./sportmonks";

type JsonObject = Record<string, unknown>;
type ResolveInput = { teamA: string; teamB: string; matchDate: string; fixtureId?: string };

const BASE_URL = "https://api.anysport.io/v1";
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

export class AnySportError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 502, code = "ANYSPORT_ERROR") {
    super(message);
    this.name = "AnySportError";
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
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace("%", "")) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeName(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\b(fc|cf|afc|club|football|futbol)\b/g, "").replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

function dateOnly(value: string) {
  const date = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (!date) throw new AnySportError("比赛日期必须包含 YYYY-MM-DD。", 400, "INVALID_MATCH_DATE");
  return date;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function apiKey() {
  const value = process.env.ANYSPORT_API_KEY?.trim();
  if (!value) throw new AnySportError("尚未配置 AnySport API Key。", 503, "ANYSPORT_NOT_CONFIGURED");
  return value;
}

async function request(path: string, search: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}/${path.replace(/^\/+/, "")}`);
  Object.entries(search).forEach(([name, value]) => value && url.searchParams.set(name, value));
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "X-API-Key": apiKey(), "User-Agent": "football-prediction-agent/0.1" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new AnySportError("AnySport 网络请求失败或超时。", 502, "ANYSPORT_NETWORK_ERROR");
  }
  if (!response.ok) {
    const code = response.status === 401 ? "ANYSPORT_UNAUTHORIZED"
      : response.status === 403 ? "ANYSPORT_PLAN_REQUIRED"
        : response.status === 429 ? "ANYSPORT_RATE_LIMIT" : "ANYSPORT_UPSTREAM_ERROR";
    const status = response.status === 429 ? 429 : response.status === 403 ? 403 : 502;
    throw new AnySportError(`AnySport 返回 ${response.status}。`, status, code);
  }
  try {
    const bytes = await readLimitedResponseBytes(response, MAX_RESPONSE_BYTES);
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as JsonObject;
    if (payload.success === false) throw new AnySportError("AnySport 返回业务错误。", 502, "ANYSPORT_API_ERROR");
    return payload;
  } catch (error) {
    if (error instanceof AnySportError) throw error;
    throw new AnySportError("AnySport 返回了无效或过大的响应。", 502, "ANYSPORT_INVALID_RESPONSE");
  }
}

function fixtureMatches(fixture: JsonObject, teamA: string, teamB: string) {
  const home = normalizeName(text(fixture.home));
  const away = normalizeName(text(fixture.away));
  const a = normalizeName(teamA);
  const b = normalizeName(teamB);
  const matches = (candidate: string, expected: string) => Boolean(candidate && expected && (candidate === expected || candidate.includes(expected) || expected.includes(candidate)));
  return (matches(home, a) && matches(away, b)) || (matches(home, b) && matches(away, a));
}

async function resolveFixture(input: ResolveInput) {
  const payload = input.fixtureId
    ? await request("matches", { match_id: input.fixtureId, lang: "zh", limit: "5" })
    : await request("matches", {
      from: shiftDate(dateOnly(input.matchDate), -2),
      to: shiftDate(dateOnly(input.matchDate), 2),
      lang: "zh",
      limit: "200"
    });
  const fixtures = array(payload.data).map(object).filter((item): item is JsonObject => Boolean(item));
  const fixture = input.fixtureId ? fixtures[0] : fixtures.find((item) => fixtureMatches(item, input.teamA, input.teamB));
  if (!fixture) throw new AnySportError("AnySport 没有找到这场比赛。", 404, "FIXTURE_NOT_FOUND");
  return fixture;
}

function sideTeamId(fixture: JsonObject, side: string) {
  return side === "away" ? number(fixture.away_id) : number(fixture.home_id);
}

function parseMinute(value: unknown) {
  const raw = text(value);
  const [minute, extra] = raw.split("+").map(Number);
  return { minute: Number.isFinite(minute) ? minute : null, extraMinute: Number.isFinite(extra) ? extra : null };
}

function positionName(value: unknown) {
  const position = number(value);
  if (position === 1) return "Goalkeeper";
  if (position && position <= 5) return "Defender";
  if (position && position <= 9) return "Midfielder";
  if (position) return "Forward";
  return "Unknown";
}

function lineupPlayers(team: JsonObject, teamId: number, starter: boolean) {
  const field = starter ? "starting_lineups" : "substitutes";
  return array(team[field]).map(object).filter((player): player is JsonObject => Boolean(player)).map((player) => ({
    playerId: number(player.player_id) ?? 0,
    teamId,
    playerName: text(player.player_name, "Unknown Player"),
    position: positionName(player.player_position),
    starter,
    jerseyNumber: number(player.player_number),
    formationPosition: number(player.player_position),
    statistics: {},
    canonicalStatistics: {}
  }));
}

async function optionalContext(fixture: JsonObject) {
  const fixtureId = number(fixture.match_id);
  const homeId = number(fixture.home_id);
  const awayId = number(fixture.away_id);
  const [headToHead, lineup] = await Promise.all([
    homeId && awayId ? request("head2head", { team1_id: String(homeId), team2_id: String(awayId), lang: "zh" }).catch(() => null) : null,
    fixtureId && process.env.ANYSPORT_LINEUPS_ENABLED === "true"
      ? request("lineups", { match_id: String(fixtureId), lang: "zh" }).catch(() => null)
      : null
  ]);
  return { headToHead, lineup };
}

export function isAnySportConfigured() {
  return Boolean(process.env.ANYSPORT_API_KEY?.trim());
}

export async function getAnySportMatchIntelligence(input: ResolveInput): Promise<LiveMatchIntelligence> {
  const fixture = await resolveFixture(input);
  const fixtureId = number(fixture.match_id);
  if (!fixtureId) throw new AnySportError("AnySport 比赛 ID 无效。", 404, "FIXTURE_ID_MISSING");
  const teams = [
    { id: number(fixture.home_id) ?? 0, name: text(fixture.home, "Unknown Home"), shortCode: "", imageUrl: text(fixture.home_badge) },
    { id: number(fixture.away_id) ?? 0, name: text(fixture.away, "Unknown Away"), shortCode: "", imageUrl: text(fixture.away_badge) }
  ];
  const context = await optionalContext(fixture);
  const lineupData = object(context.lineup?.data) ?? object(fixture.lineups);
  const homeLineup = object(lineupData?.home) ?? {};
  const awayLineup = object(lineupData?.away) ?? {};
  const lineups = [
    ...lineupPlayers(homeLineup, teams[0].id, true),
    ...lineupPlayers(homeLineup, teams[0].id, false),
    ...lineupPlayers(awayLineup, teams[1].id, true),
    ...lineupPlayers(awayLineup, teams[1].id, false)
  ];
  const formations = [
    { teamId: teams[0].id, formation: text(homeLineup.formation) || text(fixture.home_formation) },
    { teamId: teams[1].id, formation: text(awayLineup.formation) || text(fixture.away_formation) }
  ].filter((entry) => entry.formation);

  const events: LiveMatchIntelligence["events"] = [];
  array(fixture.goals).map(object).filter((item): item is JsonObject => Boolean(item)).forEach((item) => {
    const time = parseMinute(item.time);
    events.push({ id: null, type: text(item.type, "goal"), ...time, teamId: sideTeamId(fixture, text(item.team)), playerId: number(item.player_id), playerName: text(item.player), relatedPlayerId: null, relatedPlayerName: "", result: "" });
  });
  array(fixture.cards).map(object).filter((item): item is JsonObject => Boolean(item)).forEach((item) => {
    const time = parseMinute(item.time);
    events.push({ id: null, type: text(item.type, "card"), ...time, teamId: sideTeamId(fixture, text(item.team)), playerId: number(item.player_id), playerName: text(item.player), relatedPlayerId: null, relatedPlayerName: "", result: "" });
  });
  array(fixture.subs).map(object).filter((item): item is JsonObject => Boolean(item)).forEach((item) => {
    const time = parseMinute(item.time);
    events.push({ id: null, type: "substitution", ...time, teamId: sideTeamId(fixture, text(item.team)), playerId: number(item.player_in_id), playerName: text(item.player_in), relatedPlayerId: number(item.player_out_id), relatedPlayerName: text(item.player_out), result: "" });
  });

  const teamStatistics: LiveMatchIntelligence["teamStatistics"] = [];
  array(fixture.stats).map(object).filter((item): item is JsonObject => Boolean(item)).forEach((item) => {
    const type = text(item.type);
    teamStatistics.push({ teamId: teams[0].id, type, canonicalType: canonicalMetricKey(type), value: number(item.home) ?? (text(item.home) || null) });
    teamStatistics.push({ teamId: teams[1].id, type, canonicalType: canonicalMetricKey(type), value: number(item.away) ?? (text(item.away) || null) });
  });

  const sidelined = [homeLineup, awayLineup].flatMap((team, index) => array(team.missing_players).map(object)
    .filter((player): player is JsonObject => Boolean(player)).map((player) => ({
      playerId: number(player.player_id),
      playerName: text(player.player_name, "Unknown Player"),
      category: text(player.reason, "missing"),
      startDate: "",
      endDate: "",
      teamId: teams[index].id
    }))).map(({ teamId: _teamId, ...entry }) => entry);

  const h2hData = object(context.headToHead?.data);
  const recentFormSamples = array(h2hData?.team1_matches).length + array(h2hData?.team2_matches).length;
  const headToHeadSamples = array(h2hData?.history).length;
  const confirmedLineup = lineups.filter((player) => player.starter).length >= 20;
  const fetchedAt = new Date().toISOString();
  const startsAt = `${text(fixture.date)}T${text(fixture.time, "00:00")}:00Z`;

  return {
    ok: true,
    provider: "anysport",
    mode: "live",
    fetchedAt,
    sourceUrl: `${BASE_URL}/matches?match_id=${fixtureId}`,
    fixture: {
      id: fixtureId,
      name: `${teams[0].name} - ${teams[1].name}`,
      startsAt,
      state: text(fixture.status),
      league: text(fixture.league),
      venue: text(fixture.stadium),
      weather: null
    },
    teams,
    formations,
    lineups,
    playerProfiles: [],
    sidelined,
    events,
    teamStatistics,
    coverage: {
      confirmedLineup,
      lineups: lineups.length,
      sidelined: sidelined.length,
      events: events.length,
      teamStatistics: teamStatistics.length,
      hasWeather: false,
      hasFormations: formations.length >= 2
    },
    analysisFeatures: { recentFormSamples, headToHeadSamples, playerSeasonProfiles: 0, injurySourceCount: sidelined.length ? 1 : 0 },
    evidence: ["fixture", "participants", "formations", "events", "statistics", "recent-form", "head-to-head", ...(lineups.length ? ["lineups", "sidelined"] : [])].map((field) => ({
      field,
      source: "AnySport REST API v1",
      sourceFixtureId: fixtureId,
      fetchedAt,
      confidence: "official-provider" as const
    })),
    warnings: [
      "AnySport 免费层可提供赛程、赛果、H2H、比赛事件和球队统计；球队、球员及独立阵容接口取决于套餐。",
      ...(process.env.ANYSPORT_LINEUPS_ENABLED === "true" ? [] : ["未启用 AnySport 阵容套餐调用；如已购买 Basic 以上套餐，可设置 ANYSPORT_LINEUPS_ENABLED=true。"]),
      ...(confirmedLineup ? [] : ["首发尚未确认或当前套餐未返回完整阵容。"]),
      "AnySport 不提供本项目所需的完整球员赛季画像、xG 和事件坐标，仍需其他授权数据源补齐。"
    ]
  };
}
