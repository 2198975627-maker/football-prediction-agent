import { readLimitedResponseBytes } from "../http-security";
import { addCanonicalMetric, canonicalMetricKey, type CanonicalMetricKey, type CanonicalMetrics } from "../football-metrics";

type JsonObject = Record<string, unknown>;

export type LiveMatchIntelligence = {
  ok: true;
  provider: "sportmonks" | "api-football" | "football-data-org" | "anysport";
  mode: "live";
  fetchedAt: string;
  sourceUrl: string;
  fixture: {
    id: number;
    name: string;
    startsAt: string;
    state: string;
    league: string;
    venue: string;
    weather: JsonObject | null;
  };
  teams: Array<{
    id: number;
    name: string;
    shortCode: string;
    imageUrl: string;
  }>;
  formations: Array<{ teamId: number | null; formation: string }>;
  lineups: Array<{
    playerId: number;
    teamId: number;
    playerName: string;
    position: string;
    starter: boolean;
    jerseyNumber: number | null;
    formationPosition: number | null;
    statistics: Record<string, number | string | boolean | null>;
    canonicalStatistics: CanonicalMetrics;
  }>;
  playerProfiles?: Array<{
    playerId: number;
    teamId: number;
    playerName: string;
    position: string;
    season: number | null;
    appearances: number;
    statistics: Record<string, number | string | boolean | null>;
    canonicalStatistics: CanonicalMetrics;
  }>;
  sidelined: Array<{
    playerId: number | null;
    playerName: string;
    category: string;
    startDate: string;
    endDate: string;
  }>;
  events: Array<{
    id: number | null;
    type: string;
    minute: number | null;
    extraMinute: number | null;
    teamId: number | null;
    playerId: number | null;
    playerName: string;
    relatedPlayerId: number | null;
    relatedPlayerName: string;
    result: string;
  }>;
  teamStatistics: Array<{
    teamId: number | null;
    type: string;
    canonicalType: CanonicalMetricKey | null;
    value: number | string | boolean | null;
  }>;
  recentMatches?: Array<{
    fixtureId: number;
    startsAt: string;
    league: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    source: string;
  }>;
  headToHeadMatches?: Array<{
    fixtureId: number;
    startsAt: string;
    league: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    source: string;
  }>;
  coverage: {
    confirmedLineup: boolean;
    lineups: number;
    sidelined: number;
    events: number;
    teamStatistics: number;
    hasWeather: boolean;
    hasFormations: boolean;
  };
  analysisFeatures: {
    recentFormSamples: number;
    headToHeadSamples: number;
    playerSeasonProfiles: number;
    injurySourceCount: number;
  };
  evidence: Array<{
    field: string;
    source: string;
    sourceFixtureId: number;
    fetchedAt: string;
    confidence: "official-provider" | "official-basic";
  }>;
  warnings: string[];
  fusion?: {
    primaryProvider: "sportmonks" | "api-football" | "football-data-org" | "anysport";
    attemptedProviders: Array<"sportmonks" | "api-football" | "football-data-org" | "anysport">;
    succeededProviders: Array<"sportmonks" | "api-football" | "football-data-org" | "anysport">;
    conflicts: Array<{
      field: string;
      severity: "info" | "warning" | "critical";
      values: Array<{ provider: string; value: string }>;
      resolution: string;
    }>;
  };
};

type ResolveInput = {
  teamA: string;
  teamB: string;
  matchDate: string;
  fixtureId?: string;
};

const BASE_URL = "https://api.sportmonks.com/v3/football";
const MAX_RESPONSE_BYTES = 12 * 1024 * 1024;

export class SportmonksError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 502, code = "SPORTMONKS_ERROR") {
    super(message);
    this.name = "SportmonksError";
    this.status = status;
    this.code = code;
  }
}

function object(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonObject) : null;
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

function relationName(value: unknown) {
  const item = object(value);
  return text(item?.name) || text(item?.developer_name) || text(item?.short_name);
}

function scalar(value: unknown): number | string | boolean | null {
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return value;
  const item = object(value);
  if (item && "value" in item) return scalar(item.value);
  return null;
}

function normalizedName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|afc|club|football|futbol)\b/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "")
    .trim();
}

function dateOnly(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  if (!match) throw new SportmonksError("比赛日期必须包含 YYYY-MM-DD。", 400, "INVALID_MATCH_DATE");
  return match[0];
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function token() {
  const value = process.env.SPORTMONKS_API_KEY?.trim();
  if (!value) {
    throw new SportmonksError("Sportmonks 尚未配置。请在服务端设置 SPORTMONKS_API_KEY。", 503, "SPORTMONKS_NOT_CONFIGURED");
  }
  return value;
}

async function request(path: string, search: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}/${path.replace(/^\/+/, "")}`);
  Object.entries(search).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: token(),
        "User-Agent": "football-prediction-agent/0.1"
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000)
    });
  } catch (error) {
    throw new SportmonksError(
      error instanceof Error && error.name === "TimeoutError" ? "Sportmonks 请求超时。" : "Sportmonks 网络请求失败。"
    );
  }

  if (!response.ok) {
    const code = response.status === 401 ? "SPORTMONKS_UNAUTHORIZED" : response.status === 403 ? "SPORTMONKS_PLAN_LIMIT" : response.status === 429 ? "SPORTMONKS_RATE_LIMIT" : "SPORTMONKS_UPSTREAM_ERROR";
    const message =
      response.status === 401
        ? "Sportmonks Key 无效。"
        : response.status === 403
          ? "当前 Sportmonks 套餐不包含所请求的数据。"
          : response.status === 429
            ? "Sportmonks 请求额度暂时耗尽。"
            : `Sportmonks 返回 ${response.status}。`;
    throw new SportmonksError(message, response.status === 429 ? 429 : 502, code);
  }

  try {
    const bytes = await readLimitedResponseBytes(response, MAX_RESPONSE_BYTES);
    return JSON.parse(new TextDecoder().decode(bytes)) as JsonObject;
  } catch (error) {
    if (error instanceof SyntaxError) throw new SportmonksError("Sportmonks 返回了无效 JSON。", 502, "SPORTMONKS_INVALID_JSON");
    throw new SportmonksError("Sportmonks 响应过大或无法读取。", 502, "SPORTMONKS_RESPONSE_REJECTED");
  }
}

function dataArray(payload: JsonObject) {
  return array(payload.data).map(object).filter((item): item is JsonObject => Boolean(item));
}

async function resolveTeam(query: string) {
  const payload = await request(`teams/search/${encodeURIComponent(query)}`, {
    include: "country",
    per_page: "20"
  });
  const candidates = dataArray(payload).filter((item) => number(item.sport_id) === 1 && item.placeholder !== true);
  const expected = normalizedName(query);
  const ranked = candidates
    .map((item) => {
      const name = text(item.name);
      const normalized = normalizedName(name);
      const score = normalized === expected ? 100 : normalized.includes(expected) || expected.includes(normalized) ? 70 : 0;
      return { item, score };
    })
    .sort((left, right) => right.score - left.score);

  const best = ranked[0]?.item;
  const id = number(best?.id);
  if (!best || !id || ranked[0].score === 0) {
    throw new SportmonksError(`未能在 Sportmonks 中可靠识别球队“${query}”。`, 404, "TEAM_NOT_FOUND");
  }
  return best;
}

function participantIds(fixture: JsonObject) {
  return array(fixture.participants)
    .map((item) => number(object(item)?.id))
    .filter((id): id is number => id !== null);
}

async function resolveFixture(input: ResolveInput) {
  if (input.fixtureId) {
    const id = number(input.fixtureId);
    if (!id) throw new SportmonksError("fixtureId 无效。", 400, "INVALID_FIXTURE_ID");
    return id;
  }

  const [teamA, teamB] = await Promise.all([resolveTeam(input.teamA), resolveTeam(input.teamB)]);
  const teamAId = number(teamA.id);
  const teamBId = number(teamB.id);
  if (!teamAId || !teamBId) throw new SportmonksError("球队 ID 解析失败。", 404, "TEAM_ID_NOT_FOUND");

  const matchDate = dateOnly(input.matchDate);
  const payload = await request(`fixtures/between/${shiftDate(matchDate, -2)}/${shiftDate(matchDate, 2)}/${teamAId}`, {
    include: "participants;league;state;venue",
    per_page: "50"
  });
  const fixtures = dataArray(payload);
  const fixture = fixtures.find((item) => participantIds(item).includes(teamBId));
  const fixtureId = number(fixture?.id);
  if (!fixtureId) {
    throw new SportmonksError("日期附近没有找到这两支球队的比赛，请检查赛事日期或直接提供 fixtureId。", 404, "FIXTURE_NOT_FOUND");
  }
  return fixtureId;
}

function normalizeTeam(item: JsonObject) {
  return {
    id: number(item.id) ?? 0,
    name: text(item.name, "Unknown Team"),
    shortCode: text(item.short_code),
    imageUrl: text(item.image_path)
  };
}

function normalizeLineup(item: JsonObject) {
  const statistics: Record<string, number | string | boolean | null> = {};
  const canonicalStatistics: CanonicalMetrics = {};
  array(item.details)
    .map(object)
    .filter((detail): detail is JsonObject => Boolean(detail))
    .forEach((detail) => {
      const typeObject = object(detail.type);
      const type = relationName(detail.type) || `type_${number(detail.type_id) ?? "unknown"}`;
      const value = scalar(detail.data);
      statistics[type] = value;
      addCanonicalMetric(
        canonicalStatistics,
        canonicalMetricKey(text(typeObject?.developer_name), text(typeObject?.code), text(typeObject?.name), type),
        value
      );
    });
  return {
    playerId: number(item.player_id) ?? number(object(item.player)?.id) ?? 0,
    teamId: number(item.team_id) ?? 0,
    playerName: text(item.player_name) || text(object(item.player)?.display_name) || text(object(item.player)?.name, "Unknown Player"),
    position: relationName(item.detailedPosition) || relationName(item.position),
    starter: number(item.type_id) === 11,
    jerseyNumber: number(item.jersey_number),
    formationPosition: number(item.formation_position),
    statistics,
    canonicalStatistics
  };
}

function normalizeFixture(payload: JsonObject, fixtureId: number): LiveMatchIntelligence {
  const item = object(payload.data);
  if (!item) throw new SportmonksError("Sportmonks 比赛详情为空。", 404, "FIXTURE_EMPTY");
  const fetchedAt = new Date().toISOString();
  const teams = array(item.participants).map(object).filter((team): team is JsonObject => Boolean(team)).map(normalizeTeam);
  const lineups = array(item.lineups).map(object).filter((lineup): lineup is JsonObject => Boolean(lineup)).map(normalizeLineup);
  const formations = array(item.formations)
    .map(object)
    .filter((formation): formation is JsonObject => Boolean(formation))
    .map((formation) => ({
      teamId: number(formation.participant_id) ?? number(formation.team_id),
      formation: text(formation.formation)
    }));
  const sidelined = array(item.sidelined)
    .map(object)
    .filter((entry): entry is JsonObject => Boolean(entry))
    .map((entry) => {
      const player = object(entry.player);
      return {
        playerId: number(entry.player_id) ?? number(player?.id),
        playerName: text(player?.display_name) || text(player?.name) || text(entry.player_name, "Unknown Player"),
        category: relationName(entry.sideline) || text(entry.category) || text(entry.reason),
        startDate: text(entry.start_date),
        endDate: text(entry.end_date)
      };
    });
  const events = array(item.events)
    .map(object)
    .filter((event): event is JsonObject => Boolean(event))
    .map((event) => ({
      id: number(event.id),
      type: relationName(event.type) || text(event.type),
      minute: number(event.minute),
      extraMinute: number(event.extra_minute),
      teamId: number(event.participant_id) ?? number(event.team_id),
      playerId: number(event.player_id),
      playerName: text(event.player_name),
      relatedPlayerId: number(event.related_player_id),
      relatedPlayerName: text(event.related_player_name),
      result: text(event.result)
    }));
  const teamStatistics = array(item.statistics)
    .map(object)
    .filter((stat): stat is JsonObject => Boolean(stat))
    .map((stat) => {
      const typeObject = object(stat.type);
      const type = relationName(stat.type) || `type_${number(stat.type_id) ?? "unknown"}`;
      return {
        teamId: number(stat.participant_id) ?? number(stat.team_id),
        type,
        canonicalType: canonicalMetricKey(text(typeObject?.developer_name), text(typeObject?.code), text(typeObject?.name), type),
        value: scalar(stat.data) ?? scalar(stat.value)
      };
    });
  const state = object(item.state);
  const league = object(item.league);
  const venue = object(item.venue);
  const weather = object(item.weatherReport);
  const confirmedLineup = item.lineup_confirmed === true || lineups.some((lineup) => lineup.starter);
  const evidenceFields = ["fixture", "participants", "formations", "lineups", "sidelined", "events", "statistics"];

  return {
    ok: true,
    provider: "sportmonks",
    mode: "live",
    fetchedAt,
    sourceUrl: `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}`,
    fixture: {
      id: fixtureId,
      name: text(item.name),
      startsAt: text(item.starting_at),
      state: text(state?.name) || text(state?.short_name),
      league: text(league?.name),
      venue: text(venue?.name),
      weather
    },
    teams,
    formations,
    lineups,
    sidelined,
    events,
    teamStatistics,
    coverage: {
      confirmedLineup,
      lineups: lineups.length,
      sidelined: sidelined.length,
      events: events.length,
      teamStatistics: teamStatistics.length,
      hasWeather: Boolean(weather),
      hasFormations: formations.length > 0
    },
    analysisFeatures: {
      recentFormSamples: 0,
      headToHeadSamples: 0,
      playerSeasonProfiles: 0,
      injurySourceCount: sidelined.length ? 1 : 0
    },
    evidence: evidenceFields.map((field) => ({
      field,
      source: "Sportmonks Football API v3" as const,
      sourceFixtureId: fixtureId,
      fetchedAt,
      confidence: "official-provider" as const
    })),
    warnings: [
      ...(confirmedLineup ? [] : ["首发可能尚未确认，不能把预计阵容当作官方首发。"]),
      ...(events.length ? [] : ["当前套餐或比赛尚未返回事件数据。"]),
      ...(teamStatistics.length ? [] : ["当前套餐或比赛尚未返回球队统计。"]),
      "字段覆盖取决于 Sportmonks 套餐、联赛和比赛状态。"
    ]
  };
}

export function isSportmonksConfigured() {
  return Boolean(process.env.SPORTMONKS_API_KEY?.trim());
}

export async function getSportmonksMatchIntelligence(input: ResolveInput) {
  const fixtureId = await resolveFixture(input);
  const payload = await request(`fixtures/${fixtureId}`, {
    include: "participants;league;season;venue;state;weatherReport;formations;lineups.player;lineups.position;lineups.detailedPosition;lineups.details.type;events.type;statistics.type;sidelined.player;coaches"
  });
  return normalizeFixture(payload, fixtureId);
}
