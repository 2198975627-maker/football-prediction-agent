import type { PredictionInput } from "./schemas";

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
  const nationalHint = /国家队|中国|法国|德国|英格兰|西班牙|阿根廷|巴西|葡萄牙|意大利/.test(
    `${teamA} ${teamB} ${input.competition}`
  );

  return {
    teamA: {
      id: `mock-${stableNumber(teamA)}`,
      name: teamA,
      type: nationalHint ? "national" : "club",
      confidence: 0.88
    } satisfies ResolvedTeam,
    teamB: {
      id: `mock-${stableNumber(teamB)}`,
      name: teamB,
      type: nationalHint ? "national" : "club",
      confidence: 0.88
    } satisfies ResolvedTeam
  };
}

export function collectFootballData(input: PredictionInput): FootballDataPack {
  const { teamA, teamB } = resolveTeams(input);
  const aSeed = stableNumber(teamA.name);
  const bSeed = stableNumber(teamB.name);
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
