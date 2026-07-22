import { readLimitedResponseBytes } from "../http-security";
import { addCanonicalMetric, canonicalMetricKey, type CanonicalMetrics } from "../football-metrics";
import type { LiveMatchIntelligence } from "./sportmonks";
import type { PlayerEventData, PlayerEventProfile } from "../player-event-data";

type JsonObject = Record<string, unknown>;
type ResolveInput = { teamA: string; teamB: string; matchDate: string; fixtureId?: string };

const DIRECT_BASE_URL = "https://v3.football.api-sports.io";
const RAPIDAPI_DEFAULT_HOST = "api-football-v1.p.rapidapi.com";
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

type ApiFootballTransport = {
  authMode: "direct" | "rapidapi";
  baseUrl: string;
  headers: Record<string, string>;
};

export class ApiFootballError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 502, code = "API_FOOTBALL_ERROR") {
    super(message);
    this.name = "ApiFootballError";
    this.status = status;
    this.code = code;
  }
}

function object(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : null;
}

function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
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
  if (!date) throw new ApiFootballError("比赛日期必须包含 YYYY-MM-DD。", 400, "INVALID_MATCH_DATE");
  return date;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function matchEvidence(value: unknown): NonNullable<LiveMatchIntelligence["recentMatches"]>[number] | null {
  const row = object(value);
  if (!row) return null;
  const fixture = object(row.fixture);
  const league = object(row.league);
  const teams = object(row.teams);
  const goals = object(row.goals);
  const home = object(teams?.home);
  const away = object(teams?.away);
  const status = object(fixture?.status);
  const fixtureId = number(fixture?.id);
  if (!fixtureId || !home || !away) return null;
  return {
    fixtureId,
    startsAt: text(fixture?.date),
    league: text(league?.name),
    homeTeam: text(home.name, "Unknown Team"),
    awayTeam: text(away.name, "Unknown Team"),
    homeScore: number(goals?.home),
    awayScore: number(goals?.away),
    status: text(status?.short) || text(status?.long),
    source: "API-Football v3"
  };
}

function transport(): ApiFootballTransport {
  const directKey = process.env.API_FOOTBALL_KEY?.trim();
  if (directKey) {
    return {
      authMode: "direct",
      baseUrl: DIRECT_BASE_URL,
      headers: { "x-apisports-key": directKey }
    };
  }

  const rapidApiKey = process.env.RAPIDAPI_FOOTBALL_KEY?.trim();
  if (rapidApiKey) {
    const host = process.env.RAPIDAPI_FOOTBALL_HOST?.trim() || RAPIDAPI_DEFAULT_HOST;
    if (!/^[a-z0-9.-]+$/i.test(host)) {
      throw new ApiFootballError("RapidAPI Football Host 配置无效。", 503, "RAPIDAPI_FOOTBALL_HOST_INVALID");
    }
    return {
      authMode: "rapidapi",
      baseUrl: `https://${host}/v3`,
      headers: {
        "x-rapidapi-key": rapidApiKey,
        "x-rapidapi-host": host
      }
    };
  }

  throw new ApiFootballError(
    "尚未配置 API-Football Key。可设置 API_FOOTBALL_KEY 或 RAPIDAPI_FOOTBALL_KEY。",
    503,
    "API_FOOTBALL_NOT_CONFIGURED"
  );
}

async function request(path: string, search: Record<string, string> = {}) {
  const selected = transport();
  const url = new URL(`${selected.baseUrl}/${path.replace(/^\/+/, "")}`);
  Object.entries(search).forEach(([name, value]) => value && url.searchParams.set(name, value));
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", ...selected.headers, "User-Agent": "football-prediction-agent/0.1" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000)
    });
  } catch {
    throw new ApiFootballError("API-Football 网络请求失败。");
  }
  if (!response.ok) {
    const code = response.status === 401 || response.status === 403 ? "API_FOOTBALL_UNAUTHORIZED"
      : response.status === 429 ? "API_FOOTBALL_RATE_LIMIT" : "API_FOOTBALL_UPSTREAM_ERROR";
    throw new ApiFootballError(`API-Football 返回 ${response.status}。`, response.status === 429 ? 429 : 502, code);
  }
  try {
    const bytes = await readLimitedResponseBytes(response, MAX_RESPONSE_BYTES);
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as JsonObject;
    const errors = object(payload.errors);
    if (errors && Object.keys(errors).length) throw new ApiFootballError("API-Football 拒绝了请求，请检查免费套餐权限或额度。", 502, "API_FOOTBALL_PROVIDER_ERROR");
    return payload;
  } catch (error) {
    if (error instanceof ApiFootballError) throw error;
    throw new ApiFootballError("API-Football 返回了无效或过大的响应。", 502, "API_FOOTBALL_INVALID_RESPONSE");
  }
}

function responses(payload: JsonObject) {
  return array(payload.response).map(object).filter((item): item is JsonObject => Boolean(item));
}

function nameMatches(name: string, query: string) {
  const actual = normalizeName(name);
  const expected = normalizeName(query);
  return actual === expected || actual.includes(expected) || expected.includes(actual);
}

async function findTeam(query: string) {
  const payload = await request("teams", { search: query });
  const candidates = responses(payload).map((entry) => object(entry.team)).filter((team): team is JsonObject => Boolean(team));
  const team = candidates.find((entry) => nameMatches(text(entry.name), query));
  if (!team || !number(team.id)) throw new ApiFootballError(`API-Football 未能识别球队“${query}”。`, 404, "TEAM_NOT_FOUND");
  return team;
}

async function resolveFixtureId(input: ResolveInput) {
  if (input.fixtureId) {
    const id = number(input.fixtureId);
    if (!id) throw new ApiFootballError("fixtureId 无效。", 400, "INVALID_FIXTURE_ID");
    return id;
  }
  const [teamA, teamB] = await Promise.all([findTeam(input.teamA), findTeam(input.teamB)]);
  const date = dateOnly(input.matchDate);
  const payload = await request("fixtures", {
    team: String(number(teamA.id)), from: shiftDate(date, -2), to: shiftDate(date, 2), timezone: "UTC"
  });
  const fixture = responses(payload).find((entry) => {
    const teams = object(entry.teams);
    const home = object(teams?.home);
    const away = object(teams?.away);
    const ids = [number(home?.id), number(away?.id)];
    return ids.includes(number(teamB.id));
  });
  const id = number(object(fixture?.fixture)?.id);
  if (!id) throw new ApiFootballError("API-Football 日期附近没有找到这两支球队的比赛。", 404, "FIXTURE_NOT_FOUND");
  return id;
}

function scalarStatistics(value: unknown, prefix = "", result: Record<string, number | string | boolean | null> = {}) {
  const item = object(value);
  if (!item) return result;
  Object.entries(item).forEach(([key, nested]) => {
    const label = prefix ? `${prefix}_${key}` : key;
    if (typeof nested === "number" || typeof nested === "string" || typeof nested === "boolean" || nested === null) {
      result[label] = nested;
    } else if (object(nested)) scalarStatistics(nested, label, result);
  });
  return result;
}

function normalizePlayerStatistics(statistics: JsonObject | null) {
  const raw = scalarStatistics(statistics);
  const canonical: CanonicalMetrics = {};
  Object.entries(raw).forEach(([label, value]) => addCanonicalMetric(canonical, canonicalMetricKey(label), value));
  return { raw, canonical };
}

async function optionalRequest(path: string, search: Record<string, string>) {
  try { return await request(path, search); } catch { return null; }
}

export function isApiFootballConfigured() {
  return Boolean(process.env.API_FOOTBALL_KEY?.trim() || process.env.RAPIDAPI_FOOTBALL_KEY?.trim());
}

export function getApiFootballAuthMode() {
  if (process.env.API_FOOTBALL_KEY?.trim()) return "direct" as const;
  if (process.env.RAPIDAPI_FOOTBALL_KEY?.trim()) return "rapidapi" as const;
  return null;
}

function sourceBaseUrl() {
  try {
    return transport().baseUrl;
  } catch {
    return DIRECT_BASE_URL;
  }
}

export async function getApiFootballMatchIntelligence(input: ResolveInput): Promise<LiveMatchIntelligence> {
  const fixtureId = await resolveFixtureId(input);
  const fixturePayload = await request("fixtures", { id: String(fixtureId), timezone: "UTC" });
  const item = responses(fixturePayload)[0];
  if (!item) throw new ApiFootballError("API-Football 比赛详情为空。", 404, "FIXTURE_EMPTY");
  const fixture = object(item.fixture) ?? {};
  const status = object(fixture.status);
  const league = object(item.league);
  const venue = object(fixture.venue);
  const rawTeams = object(item.teams) ?? {};
  const teams = [object(rawTeams.home), object(rawTeams.away)].filter((team): team is JsonObject => Boolean(team)).map((team) => ({
    id: number(team.id) ?? 0, name: text(team.name, "Unknown Team"), shortCode: "", imageUrl: text(team.logo)
  }));

  const season = number(league?.season);
  const [injuryPayload, h2hPayload, recentA, recentB, profilesA, profilesB] = await Promise.all([
    optionalRequest("injuries", { fixture: String(fixtureId) }),
    teams.length === 2 ? optionalRequest("fixtures/headtohead", { h2h: `${teams[0].id}-${teams[1].id}`, last: "10" }) : null,
    teams[0]?.id ? optionalRequest("fixtures", { team: String(teams[0].id), last: "5", status: "FT" }) : null,
    teams[1]?.id ? optionalRequest("fixtures", { team: String(teams[1].id), last: "5", status: "FT" }) : null,
    teams[0]?.id && season ? optionalRequest("players", { team: String(teams[0].id), season: String(season), page: "1" }) : null,
    teams[1]?.id && season ? optionalRequest("players", { team: String(teams[1].id), season: String(season), page: "1" }) : null
  ]);

  const formations: LiveMatchIntelligence["formations"] = [];
  const lineups: LiveMatchIntelligence["lineups"] = [];
  array(item.lineups).map(object).filter((entry): entry is JsonObject => Boolean(entry)).forEach((entry) => {
    const team = object(entry.team);
    const teamId = number(team?.id) ?? 0;
    const formation = text(entry.formation);
    if (formation) formations.push({ teamId, formation });
    const append = (value: unknown, starter: boolean) => array(value).map(object).filter((row): row is JsonObject => Boolean(row)).forEach((row) => {
      const player = object(row.player) ?? {};
      lineups.push({
        playerId: number(player.id) ?? 0, teamId, playerName: text(player.name, "Unknown Player"),
        position: text(player.pos), starter, jerseyNumber: number(player.number), formationPosition: number(text(player.grid).split(":")[1]),
        statistics: {}, canonicalStatistics: {}
      });
    });
    append(entry.startXI, true);
    append(entry.substitutes, false);
  });

  const playerRows = array(item.players).map(object).filter((entry): entry is JsonObject => Boolean(entry));
  playerRows.forEach((teamEntry) => {
    const teamId = number(object(teamEntry.team)?.id) ?? 0;
    array(teamEntry.players).map(object).filter((entry): entry is JsonObject => Boolean(entry)).forEach((entry) => {
      const player = object(entry.player) ?? {};
      const stat = object(array(entry.statistics)[0]);
      const normalized = normalizePlayerStatistics(stat);
      const existing = lineups.find((row) => row.playerId === number(player.id) && row.teamId === teamId);
      if (existing) {
        existing.statistics = normalized.raw;
        existing.canonicalStatistics = normalized.canonical;
      }
    });
  });

  const events = array(item.events).map(object).filter((event): event is JsonObject => Boolean(event)).map((event) => {
    const time = object(event.time); const team = object(event.team); const player = object(event.player); const assist = object(event.assist);
    return {
      id: null, type: [text(event.type), text(event.detail)].filter(Boolean).join(": "), minute: number(time?.elapsed),
      extraMinute: number(time?.extra), teamId: number(team?.id), playerId: number(player?.id), playerName: text(player?.name),
      relatedPlayerId: number(assist?.id), relatedPlayerName: text(assist?.name), result: text(event.comments)
    };
  });

  const teamStatistics: LiveMatchIntelligence["teamStatistics"] = [];
  array(item.statistics).map(object).filter((entry): entry is JsonObject => Boolean(entry)).forEach((entry) => {
    const teamId = number(object(entry.team)?.id);
    array(entry.statistics).map(object).filter((stat): stat is JsonObject => Boolean(stat)).forEach((stat) => {
      const type = text(stat.type); const value = typeof stat.value === "string" ? stat.value.replace("%", "") : stat.value;
      teamStatistics.push({ teamId, type, canonicalType: canonicalMetricKey(type), value: number(value) ?? (text(value) || null) });
    });
  });

  const sidelined = injuryPayload ? responses(injuryPayload).map((entry) => {
    const player = object(entry.player); const injuryFixture = object(entry.fixture);
    return { playerId: number(player?.id), playerName: text(player?.name, "Unknown Player"), category: text(entry.reason) || text(entry.type), startDate: text(injuryFixture?.date), endDate: "" };
  }) : [];
  const playerProfiles: NonNullable<LiveMatchIntelligence["playerProfiles"]> = [];
  [profilesA, profilesB].forEach((payload, index) => {
    if (!payload) return;
    responses(payload).forEach((entry) => {
      const player = object(entry.player) ?? {};
      const stat = object(array(entry.statistics)[0]);
      const normalized = normalizePlayerStatistics(stat);
      const games = object(stat?.games);
      playerProfiles.push({
        playerId: number(player.id) ?? 0,
        teamId: teams[index]?.id ?? number(object(stat?.team)?.id) ?? 0,
        playerName: text(player.name, "Unknown Player"),
        position: text(games?.position),
        season,
        appearances: number(games?.appearences) ?? 0,
        statistics: normalized.raw,
        canonicalStatistics: normalized.canonical
      });
    });
  });
  const fetchedAt = new Date().toISOString();
  const confirmedLineup = lineups.filter((player) => player.starter).length >= 20;
  const recentFormSamples = (recentA ? responses(recentA).length : 0) + (recentB ? responses(recentB).length : 0);
  const headToHeadSamples = h2hPayload ? responses(h2hPayload).length : 0;
  const recentMatches = [recentA, recentB]
    .flatMap((payload) => payload ? responses(payload) : [])
    .map(matchEvidence)
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .filter((row, index, rows) => rows.findIndex((candidate) => candidate.fixtureId === row.fixtureId) === index);
  const headToHeadMatches = (h2hPayload ? responses(h2hPayload) : [])
    .map(matchEvidence)
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const playerSeasonProfiles = playerProfiles.filter((profile) => profile.appearances > 0).length;

  return {
    ok: true, provider: "api-football", mode: "live", fetchedAt, sourceUrl: `${sourceBaseUrl()}/fixtures?id=${fixtureId}`,
    fixture: {
      id: fixtureId, name: teams.map((team) => team.name).join(" - "), startsAt: text(fixture.date),
      state: text(status?.long) || text(status?.short), league: text(league?.name), venue: text(venue?.name), weather: null
    },
    teams, formations, lineups, playerProfiles, sidelined, events, teamStatistics, recentMatches, headToHeadMatches,
    coverage: {
      confirmedLineup, lineups: lineups.length, sidelined: sidelined.length, events: events.length,
      teamStatistics: teamStatistics.length, hasWeather: false, hasFormations: formations.length >= 2
    },
    analysisFeatures: { recentFormSamples, headToHeadSamples, playerSeasonProfiles, injurySourceCount: injuryPayload ? 1 : 0 },
    evidence: [
      "fixture", "participants", "formations", "lineups", "events", "statistics",
      ...(injuryPayload ? ["injuries"] : []),
      ...(recentA || recentB ? ["recent-form"] : []),
      ...(h2hPayload ? ["head-to-head"] : [])
    ].map((field) => ({
      field, source: "API-Football v3", sourceFixtureId: fixtureId, fetchedAt, confidence: "official-provider" as const
    })),
    warnings: [
      ...(confirmedLineup ? [] : ["首发尚未确认，不能把预计阵容当作官方首发。"]),
      ...(!h2hPayload ? ["历史交锋接口未返回数据或当前套餐不可用。"] : []),
      ...(!recentA || !recentB ? ["至少一支球队的近期比赛接口未返回数据或当前套餐不可用。"] : []),
      ...(sidelined.length ? ["伤停目前只有一个结构化来源，正式预测仍需第二来源交叉验证。"] : ["当前比赛未返回结构化伤停。"]),
      "免费套餐可能限制每日请求量；结果已进入服务端缓存，避免重复消耗额度。"
    ]
  };
}

function nestedNumber(value: JsonObject | null, group: string, field: string) {
  return number(object(value?.[group])?.[field]) ?? 0;
}

export function normalizeApiFootballPlayerEventPayload(payload: JsonObject, fixtureId: string): PlayerEventData {
  const teamEntries = responses(payload);
  const teams: string[] = [];
  const players: PlayerEventProfile[] = [];
  const keeperZones: PlayerEventData["keeperZones"] = [];

  teamEntries.forEach((teamEntry) => {
    const team = object(teamEntry.team);
    const teamName = text(team?.name, "Unknown Team");
    teams.push(teamName);
    array(teamEntry.players).map(object).filter((entry): entry is JsonObject => Boolean(entry)).forEach((entry) => {
      const player = object(entry.player) ?? {};
      const statistics = object(array(entry.statistics)[0]);
      const duelsTotal = nestedNumber(statistics, "duels", "total");
      const aerialWon = nestedNumber(statistics, "duels", "won");
      const saves = nestedNumber(statistics, "goals", "saves");
      const penaltiesFaced = nestedNumber(statistics, "penalty", "commited");
      const penaltySaves = nestedNumber(statistics, "penalty", "saved");
      const profile: PlayerEventProfile = {
        playerId: String(player.id ?? `${teamName}:${text(player.name)}`),
        name: text(player.name, "Unknown Player"),
        team: teamName,
        position: text(object(statistics?.games)?.position),
        heightCm: null,
        preferredFoot: "unknown",
        shots: nestedNumber(statistics, "shots", "total"),
        shotsOnTarget: nestedNumber(statistics, "shots", "on"),
        goals: nestedNumber(statistics, "goals", "total"),
        xg: 0,
        tackles: nestedNumber(statistics, "tackles", "total"),
        tacklesWon: nestedNumber(statistics, "tackles", "won"),
        blocks: nestedNumber(statistics, "tackles", "blocks"),
        interceptions: nestedNumber(statistics, "tackles", "interceptions"),
        clearances: 0,
        dribblesAttempted: nestedNumber(statistics, "dribbles", "attempts"),
        dribblesCompleted: nestedNumber(statistics, "dribbles", "success"),
        dribbledPast: nestedNumber(statistics, "dribbles", "past"),
        aerialDuelsWon: aerialWon,
        aerialDuelsLost: Math.max(0, duelsTotal - aerialWon),
        saves,
        shotsFaced: 0,
        penaltySaves,
        penaltiesFaced,
        penaltiesTaken: nestedNumber(statistics, "penalty", "scored") + nestedNumber(statistics, "penalty", "missed"),
        penaltiesScored: nestedNumber(statistics, "penalty", "scored"),
        heatmap: [],
        shotsMap: []
      };
      players.push(profile);
      if (saves || penaltySaves || penaltiesFaced) {
        keeperZones.push({
          keeperId: profile.playerId,
          keeperName: profile.name,
          team: teamName,
          shotsFaced: 0,
          saves,
          penaltiesFaced,
          penaltySaves,
          zones: []
        });
      }
    });
  });

  const summary = players.reduce((total, player) => ({
    ...total,
    shots: total.shots + player.shots,
    shotsOnTarget: total.shotsOnTarget + player.shotsOnTarget,
    goals: total.goals + player.goals,
    dribblesAttempted: total.dribblesAttempted + player.dribblesAttempted,
    dribblesCompleted: total.dribblesCompleted + player.dribblesCompleted,
    dribbledPast: total.dribbledPast + player.dribbledPast,
    tackles: total.tackles + player.tackles,
    blocks: total.blocks + player.blocks,
    interceptions: total.interceptions + player.interceptions,
    saves: total.saves + player.saves,
    penaltiesTaken: total.penaltiesTaken + player.penaltiesTaken,
    penaltiesScored: total.penaltiesScored + player.penaltiesScored,
    penaltySaves: total.penaltySaves + player.penaltySaves
  }), {
    totalEvents: 0,
    shots: 0,
    shotsOnTarget: 0,
    goals: 0,
    xg: 0,
    dribblesAttempted: 0,
    dribblesCompleted: 0,
    dribbledPast: 0,
    tackles: 0,
    blocks: 0,
    interceptions: 0,
    saves: 0,
    penaltiesTaken: 0,
    penaltiesScored: 0,
    penaltySaves: 0
  });

  return {
    ok: true,
    provider: "api-football",
    sourceName: getApiFootballAuthMode() === "rapidapi" ? "API-Football v3 via RapidAPI" : "API-Football v3",
    sourceUrl: `${sourceBaseUrl()}/fixtures/players?fixture=${fixtureId}`,
    mode: "live",
    coverageTier: "free-live-summary",
    capabilities: ["player-summary", "penalties"],
    missingCapabilities: ["event-stream", "event-coordinates", "xg", "shot-map", "heatmap", "keeper-zones", "duel-matchups"],
    matchId: fixtureId,
    matchLabel: teams.length >= 2 ? `${teams[0]} vs ${teams[1]}` : `Fixture ${fixtureId}`,
    fetchedAt: new Date().toISOString(),
    teams,
    players,
    keeperZones,
    summary,
    dataGaps: [
      "API-Football fixture player statistics are aggregated and do not include event coordinates.",
      "xG, shot maps, touch heatmaps, goalkeeper zones, and direct attacker-defender pairings require a licensed event-coordinate provider.",
      "Missing values are unavailable, not zero-valued evidence."
    ],
    notes: [
      "This free live layer can support player totals and form checks without pretending to be a complete event stream.",
      "The server key is used only by the backend and is never returned to the browser."
    ]
  };
}

export async function getApiFootballPlayerEventData(fixtureId: string) {
  if (!/^\d{4,12}$/.test(fixtureId)) {
    throw new ApiFootballError("fixtureId 无效。", 400, "INVALID_FIXTURE_ID");
  }
  const payload = await request("fixtures/players", { fixture: fixtureId });
  if (!responses(payload).length) {
    throw new ApiFootballError("API-Football 尚未返回这场比赛的球员统计。", 404, "PLAYER_STATISTICS_EMPTY");
  }
  return normalizeApiFootballPlayerEventPayload(payload, fixtureId);
}
