import type { PredictionInput } from "./schemas";
import { canonicalMockTeamKey, resolveMockTeam } from "./mock-scenarios.ts";

export type ResolvedTeam = {
  id: string;
  name: string;
  type: "club" | "national";
  confidence: number;
};

export type FootballDataPack = {
  teamA: ResolvedTeam;
  teamB: ResolvedTeam;
  form: {
    teamA: string;
    teamB: string;
  };
  injuries: {
    teamA: string[];
    teamB: string[];
  };
  h2h: string;
  commonOpponent: string;
};

export type PublicSourcePack = {
  sources: Array<{
    title: string;
    sourceType: "official" | "sports-media" | "weather";
    confidence: "high" | "medium";
    summary: string;
  }>;
};

function stableNumber(value: string) {
  return Array.from(value).reduce((total, char) => total + char.charCodeAt(0), 0);
}

function normalizeTeamName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bfc\b/gi, "FC");
}

export function resolveTeams(input: PredictionInput) {
  const teamA = normalizeTeamName(input.teamA);
  const teamB = normalizeTeamName(input.teamB);
  const competitionIsNational = /国家队|national|world cup|世界杯|欧洲杯|亚洲杯|美洲杯/i.test(input.competition);
  const resolveOne = (name: string) => {
    const known = resolveMockTeam(name);
    const explicitNationalName = /国家队|national team$/i.test(name);
    const type = known?.kind ?? (explicitNationalName || competitionIsNational ? "national" : "club");
    return {
      id: `mock-${canonicalMockTeamKey(name)}`,
      name,
      type,
      confidence: known ? 0.99 : competitionIsNational || explicitNationalName ? 0.82 : 0.7
    } satisfies ResolvedTeam;
  };

  return {
    teamA: resolveOne(teamA),
    teamB: resolveOne(teamB)
  };
}

export function collectFootballData(input: PredictionInput): FootballDataPack {
  const { teamA, teamB } = resolveTeams(input);
  const aSeed = stableNumber(teamA.id);
  const bSeed = stableNumber(teamB.id);
  const aGoals = 5 + (aSeed % 9);
  const bGoals = 5 + (bSeed % 9);
  const aConceded = 3 + (bSeed % 7);
  const bConceded = 3 + (aSeed % 7);

  return {
    teamA,
    teamB,
    form: {
      teamA: `近 5 场模拟数据：进 ${aGoals} 球，失 ${aConceded} 球，状态指数 ${
        62 + (aSeed % 24)
      }/100。`,
      teamB: `近 5 场模拟数据：进 ${bGoals} 球，失 ${bConceded} 球，状态指数 ${
        62 + (bSeed % 24)
      }/100。`
    },
    injuries: {
      teamA: ["mock: 1 名轮换球员出场成疑", "mock: 核心前场球员可用"],
      teamB: ["mock: 1 名后卫轻伤待评估", "mock: 主力门将可用"]
    },
    h2h: "mock: 最近 5 次交锋胜负接近，未出现明显单边优势。",
    commonOpponent: "mock: 两队近期共同对手表现接近，不能单独作为强弱判断。"
  };
}

export function collectPublicSources(input: PredictionInput): PublicSourcePack {
  return {
    sources: [
      {
        title: `${input.teamA} 赛前训练与阵容动态`,
        sourceType: "official",
        confidence: "high",
        summary: "mock: 官方赛前信息未显示重大新增伤停。"
      },
      {
        title: `${input.teamB} 主教练发布会摘要`,
        sourceType: "sports-media",
        confidence: "medium",
        summary: "mock: 主教练强调防守组织和转换效率。"
      },
      {
        title: "比赛日天气与场地",
        sourceType: "weather",
        confidence: "medium",
        summary: "mock: 天气条件对比赛节奏影响较小。"
      }
    ]
  };
}
