import { ApiFootballError, getApiFootballMatchIntelligence, isApiFootballConfigured } from "./api-football";
import { FootballDataError, getFootballDataMatchIntelligence, isFootballDataConfigured } from "./football-data";
import { AnySportError, getAnySportMatchIntelligence, isAnySportConfigured } from "./anysport";
import { getSportmonksMatchIntelligence, isSportmonksConfigured, SportmonksError, type LiveMatchIntelligence } from "./sportmonks";

type ResolveInput = { teamA: string; teamB: string; matchDate: string; fixtureId?: string };
export type MatchProviderId = LiveMatchIntelligence["provider"];

type ProviderAttempt = {
  id: MatchProviderId;
  configured: () => boolean;
  load: (input: ResolveInput) => Promise<LiveMatchIntelligence>;
};

const providers: ProviderAttempt[] = [
  { id: "anysport", configured: isAnySportConfigured, load: getAnySportMatchIntelligence },
  { id: "api-football", configured: isApiFootballConfigured, load: getApiFootballMatchIntelligence },
  { id: "sportmonks", configured: isSportmonksConfigured, load: getSportmonksMatchIntelligence },
  { id: "football-data-org", configured: isFootballDataConfigured, load: getFootballDataMatchIntelligence }
];

const globalRequests = globalThis as typeof globalThis & {
  __footballMatchRequests?: Map<string, Promise<LiveMatchIntelligence>>;
};
const inFlightRequests = globalRequests.__footballMatchRequests ?? new Map<string, Promise<LiveMatchIntelligence>>();
globalRequests.__footballMatchRequests = inFlightRequests;

function normalized(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

function richness(data: LiveMatchIntelligence) {
  return data.lineups.length * 3
    + (data.playerProfiles?.length ?? 0) * 2
    + data.events.length
    + data.teamStatistics.length
    + data.sidelined.length * 2
    + data.analysisFeatures.recentFormSamples
    + data.analysisFeatures.headToHeadSamples;
}

function conflict(
  field: string,
  severity: "info" | "warning" | "critical",
  values: Array<{ provider: string; value: string }>,
  resolution: string
) {
  const distinct = new Set(values.map((entry) => normalized(entry.value)));
  return distinct.size > 1 ? { field, severity, values, resolution } : null;
}

function mergeUnique<T>(rows: T[], key: (row: T) => string) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const value = key(row);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function fuseMatchIntelligence(
  attemptedProviders: MatchProviderId[],
  results: LiveMatchIntelligence[]
): LiveMatchIntelligence {
  if (!results.length) throw new MatchProviderError("没有可融合的比赛数据。", 502, "NO_FUSION_RESULTS");
  const ranked = [...results].sort((left, right) => richness(right) - richness(left));
  const primary = ranked[0];
  const conflicts: NonNullable<LiveMatchIntelligence["fusion"]>["conflicts"] = [];
  const fixtureTimes = results.map((data) => ({ provider: data.provider, value: data.fixture.startsAt }));
  const validTimes = fixtureTimes.map((entry) => new Date(entry.value).getTime()).filter(Number.isFinite);
  if (validTimes.length > 1 && Math.max(...validTimes) - Math.min(...validTimes) > 5 * 60_000) {
    conflicts.push({ field: "fixture.startsAt", severity: "critical", values: fixtureTimes, resolution: "保留主数据源时间并阻止正式预测，等待人工确认。" });
  }
  const leagueConflict = conflict(
    "fixture.league",
    "warning",
    results.map((data) => ({ provider: data.provider, value: data.fixture.league })),
    "保留数据最完整来源的赛事名称。"
  );
  if (leagueConflict) conflicts.push(leagueConflict);

  const formationValues = results.filter((data) => data.formations.length >= 2).map((data) => ({
    provider: data.provider,
    value: data.formations.map((formation) => formation.formation).sort().join(" / ")
  }));
  const formationConflict = formationValues.length > 1
    ? conflict("formations", "warning", formationValues, "首发确认前保留冲突；正式预测使用最新官方阵型。")
    : null;
  if (formationConflict) conflicts.push(formationConflict);

  const injuryEntries = new Map<string, Array<{ provider: string; value: string }>>();
  results.forEach((data) => data.sidelined.forEach((entry) => {
    const key = normalized(entry.playerName);
    const values = injuryEntries.get(key) ?? [];
    values.push({ provider: data.provider, value: entry.category || "sidelined" });
    injuryEntries.set(key, values);
  }));
  injuryEntries.forEach((values, player) => {
    const injuryConflict = values.length > 1
      ? conflict(`injury.${player}`, "warning", values, "保留全部伤停描述，并要求第二来源或官方名单确认。")
      : null;
    if (injuryConflict) conflicts.push(injuryConflict);
  });

  const playerProfiles = mergeUnique(
    results.flatMap((data) => data.playerProfiles ?? []),
    (profile) => `${profile.teamId}:${normalized(profile.playerName)}:${profile.season ?? ""}`
  );
  const sidelined = mergeUnique(
    results.flatMap((data) => data.sidelined),
    (entry) => `${normalized(entry.playerName)}:${normalized(entry.category)}`
  );
  const recentMatches = mergeUnique(
    results.flatMap((data) => data.recentMatches ?? []),
    (entry) => `${entry.source}:${entry.fixtureId}`
  );
  const headToHeadMatches = mergeUnique(
    results.flatMap((data) => data.headToHeadMatches ?? []),
    (entry) => `${entry.source}:${entry.fixtureId}`
  );
  const injurySourceCount = results.filter((data) => data.evidence.some((entry) => entry.field === "injuries" || entry.field === "sidelined")).length;
  const criticalConflicts = conflicts.filter((entry) => entry.severity === "critical").length;

  return {
    ...primary,
    playerProfiles,
    sidelined,
    recentMatches,
    headToHeadMatches,
    coverage: { ...primary.coverage, sidelined: sidelined.length },
    analysisFeatures: {
      recentFormSamples: Math.max(...results.map((data) => data.analysisFeatures.recentFormSamples)),
      headToHeadSamples: Math.max(...results.map((data) => data.analysisFeatures.headToHeadSamples)),
      playerSeasonProfiles: playerProfiles.filter((profile) => profile.appearances > 0).length,
      injurySourceCount
    },
    evidence: mergeUnique(results.flatMap((data) => data.evidence), (entry) => `${entry.source}:${entry.field}`),
    warnings: mergeUnique([
      ...results.flatMap((data) => data.warnings),
      `已用 ${results.length}/${attemptedProviders.length} 个已配置数据源交叉核验；阵容、事件和球队统计采用信息最完整的主来源。`,
      ...(criticalConflicts ? [`检测到 ${criticalConflicts} 个关键字段冲突，正式预测已被阻止。`] : [])
    ], (message) => message),
    fusion: {
      primaryProvider: primary.provider,
      attemptedProviders,
      succeededProviders: results.map((data) => data.provider),
      conflicts
    }
  };
}

export class MatchProviderError extends Error {
  readonly status: number;
  readonly code: string;
  readonly attempts: string[];

  constructor(message: string, status = 502, code = "MATCH_PROVIDER_ERROR", attempts: string[] = []) {
    super(message);
    this.name = "MatchProviderError";
    this.status = status;
    this.code = code;
    this.attempts = attempts;
  }
}

export function configuredMatchProviders() {
  return providers.filter((provider) => provider.configured()).map((provider) => provider.id);
}

export function hasConfiguredMatchProvider() {
  return configuredMatchProviders().length > 0;
}

export async function getLiveMatchIntelligenceFromProvider(providerId: MatchProviderId, input: ResolveInput) {
  const provider = providers.find((candidate) => candidate.id === providerId);
  if (!provider?.configured()) {
    throw new MatchProviderError(`${providerId} 尚未配置或不可用。`, 503, "MATCH_PROVIDER_NOT_CONFIGURED");
  }
  return provider.load(input);
}

async function loadLiveMatchIntelligence(input: ResolveInput) {
  const available = providers.filter((provider) => provider.configured());
  if (!available.length) {
    throw new MatchProviderError(
      "尚未配置体育数据 Key。大陆部署可先配置 ANYSPORT_API_KEY，也可使用 API_FOOTBALL_KEY 或 FOOTBALL_DATA_API_KEY。",
      503,
      "NO_MATCH_PROVIDER_CONFIGURED"
    );
  }

  const settled = await Promise.allSettled(available.map((provider) => provider.load(input)));
  const successful = settled
    .filter((result): result is PromiseFulfilledResult<LiveMatchIntelligence> => result.status === "fulfilled")
    .map((result) => result.value);
  if (successful.length) return fuseMatchIntelligence(available.map((provider) => provider.id), successful);

  const attempts: string[] = [];
  let lastStatus = 502;
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") return;
    const error = result.reason;
    const known = error instanceof ApiFootballError || error instanceof SportmonksError || error instanceof FootballDataError || error instanceof AnySportError;
    attempts.push(`${available[index].id}:${known ? error.code : "UNKNOWN_ERROR"}`);
    if (known) lastStatus = error.status;
  });

  throw new MatchProviderError(
    "已配置的数据源均未能定位或读取这场比赛，请检查日期、球队名称、套餐覆盖和调用额度。",
    lastStatus === 429 ? 429 : lastStatus === 404 ? 404 : 502,
    "ALL_MATCH_PROVIDERS_FAILED",
    attempts
  );
}

export async function getLiveMatchIntelligence(input: ResolveInput) {
  const key = [input.fixtureId ?? "", normalized(input.teamA), normalized(input.teamB), input.matchDate.slice(0, 16)].join(":");
  const existing = inFlightRequests.get(key);
  if (existing) return existing;
  const pending = loadLiveMatchIntelligence(input).finally(() => inFlightRequests.delete(key));
  inFlightRequests.set(key, pending);
  return pending;
}
