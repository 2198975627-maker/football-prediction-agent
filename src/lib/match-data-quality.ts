import type { LiveMatchIntelligence } from "./providers/sportmonks";

export type MatchDataQuality = {
  score: number;
  level: "insufficient" | "partial" | "ready";
  canRunPreliminaryAnalysis: boolean;
  canRunOfficialPrediction: boolean;
  checkedAt: string;
  minutesToKickoff: number | null;
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
    required: boolean;
    points: number;
    detail: string;
  }>;
  missingRequired: string[];
};

type QualityOptions = {
  cacheAgeSeconds?: number;
};

function kickoffMinutes(startsAt: string) {
  const timestamp = new Date(startsAt).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.round((timestamp - Date.now()) / 60_000);
}

export function assessMatchDataQuality(
  data: LiveMatchIntelligence,
  options: QualityOptions = {}
): MatchDataQuality {
  const minutesToKickoff = kickoffMinutes(data.fixture.startsAt);
  const lineupRequired = minutesToKickoff !== null && minutesToKickoff <= 120 && minutesToKickoff >= -15;
  const canonicalPlayerMetricCount = data.lineups.reduce(
    (total, player) => total + Object.keys(player.canonicalStatistics ?? {}).length,
    0
  );
  const canonicalTeamMetricCount = data.teamStatistics.filter((stat) => Boolean(stat.canonicalType)).length;
  const cacheFresh = (options.cacheAgeSeconds ?? 0) <= 1800;
  const features = data.analysisFeatures ?? {
    recentFormSamples: 0,
    headToHeadSamples: 0,
    playerSeasonProfiles: 0,
    injurySourceCount: 0
  };
  const criticalConflicts = data.fusion?.conflicts.filter((conflict) => conflict.severity === "critical").length ?? 0;
  const recentMatchCount = data.recentMatches?.length ?? 0;
  const headToHeadMatchCount = data.headToHeadMatches?.length ?? 0;
  const verifiedPlayerProfiles = (data.playerProfiles ?? []).filter((profile) => profile.appearances > 0).length;

  const checks: MatchDataQuality["checks"] = [
    {
      id: "fixture",
      label: "比赛身份",
      passed: data.fixture.id > 0 && Boolean(data.fixture.startsAt),
      required: true,
      points: 10,
      detail: data.fixture.id > 0 ? `fixture ${data.fixture.id}` : "缺少正式比赛 ID"
    },
    {
      id: "participants",
      label: "参赛球队",
      passed: data.teams.length === 2 && data.teams.every((team) => team.id > 0),
      required: true,
      points: 10,
      detail: `已识别 ${data.teams.length} 支球队`
    },
    {
      id: "freshness",
      label: "数据新鲜度",
      passed: cacheFresh,
      required: true,
      points: 10,
      detail: `缓存年龄 ${options.cacheAgeSeconds ?? 0} 秒`
    },
    {
      id: "lineup",
      label: "首发阵容",
      passed: data.coverage.confirmedLineup && data.lineups.filter((player) => player.starter).length >= 20,
      required: lineupRequired,
      points: 15,
      detail: data.coverage.confirmedLineup ? "首发已确认" : lineupRequired ? "临近开赛但首发未确认" : "首发尚未确认"
    },
    {
      id: "formations",
      label: "阵型",
      passed: data.formations.length >= 2,
      required: false,
      points: 5,
      detail: `已获得 ${data.formations.length} 条阵型记录`
    },
    {
      id: "player-fixture-metrics",
      label: "球员比赛指标",
      passed: canonicalPlayerMetricCount >= 30,
      required: false,
      points: 10,
      detail: `已映射 ${canonicalPlayerMetricCount} 个标准指标`
    },
    {
      id: "team-fixture-metrics",
      label: "球队比赛指标",
      passed: canonicalTeamMetricCount >= 8,
      required: false,
      points: 10,
      detail: `已映射 ${canonicalTeamMetricCount} 个标准指标`
    },
    {
      id: "recent-form",
      label: "近期比赛状态",
      passed: features.recentFormSamples >= 10 && recentMatchCount >= 10,
      required: true,
      points: 10,
      detail: `已获得 ${recentMatchCount} 场带比分和对手信息的近期比赛`
    },
    {
      id: "head-to-head",
      label: "历史交锋",
      passed: features.headToHeadSamples >= 3 && headToHeadMatchCount >= 3,
      required: true,
      points: 5,
      detail: `已获得 ${headToHeadMatchCount} 场带比分的正式 H2H`
    },
    {
      id: "player-season-profiles",
      label: "球员赛季画像",
      passed: features.playerSeasonProfiles >= 18 && verifiedPlayerProfiles >= 18,
      required: true,
      points: 10,
      detail: `已获得 ${verifiedPlayerProfiles} 名有出场记录的球员赛季画像`
    },
    {
      id: "injury-verification",
      label: "伤停交叉验证",
      passed: features.injurySourceCount >= 2,
      required: true,
      points: 5,
      detail: `已有 ${features.injurySourceCount} 个伤停来源`
    },
    {
      id: "source-conflicts",
      label: "来源冲突",
      passed: criticalConflicts === 0,
      required: true,
      points: 0,
      detail: criticalConflicts ? `存在 ${criticalConflicts} 个关键冲突` : `已检查 ${data.fusion?.succeededProviders.length ?? 1} 个来源`
    }
  ];

  const score = checks.reduce((total, check) => total + (check.passed ? check.points : 0), 0);
  const missingRequired = checks.filter((check) => check.required && !check.passed).map((check) => check.label);
  const canRunPreliminaryAnalysis = score >= 35 && checks.slice(0, 3).every((check) => check.passed);
  const canRunOfficialPrediction = score >= 75 && missingRequired.length === 0;

  return {
    score,
    level: canRunOfficialPrediction ? "ready" : canRunPreliminaryAnalysis ? "partial" : "insufficient",
    canRunPreliminaryAnalysis,
    canRunOfficialPrediction,
    checkedAt: new Date().toISOString(),
    minutesToKickoff,
    checks,
    missingRequired
  };
}
