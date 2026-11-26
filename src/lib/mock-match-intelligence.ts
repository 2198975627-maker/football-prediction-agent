import { canonicalMockTeamKey, getMockScenarioForTeams, resolveMockTeam } from "./mock-scenarios.ts";

export type MockHomeTeam = "team_a" | "team_b" | "neutral";

export type MockPlayerIntelligence = {
  name: string;
  nameZh: string;
  role: string;
  status: "ready" | "doubt" | "injured" | "suspended";
  form: number;
  goals: number;
  assists: number;
  defense: number;
  minutes: number;
  age: number;
  shirtNumber: number;
  heightCm: number;
  preferredFoot: "left" | "right" | "both";
  shotsOnTarget: number;
  saves: number;
  penaltiesTaken: number;
  penaltiesScored: number;
  penaltiesFaced: number;
  penaltySaves: number;
  note: string;
  avatarUrl: string;
  starter: boolean;
  eventMetrics: {
    shots: number;
    xg: number;
    tackles: number;
    interceptions: number;
    blocks: number;
    dribbledPast: number;
  };
  heatmap: Array<{ x: number; y: number; intensity: number }>;
};

export type MockTeamIntelligence = {
  name: string;
  attack: number;
  defense: number;
  form: number;
  fitness: number;
  possession: number;
  press: number;
  injurySafety: number;
  xgFor: number;
  xgAgainst: number;
  recent: Array<"W" | "D" | "L">;
  recentPoints: number;
  recentGoalsFor: number;
  recentGoalsAgainst: number;
  formation: string;
  buildStyle: string;
  defensiveBlock: string;
  setPieceProfile: string;
  restDays: number;
  travelLoad: "low" | "medium" | "high";
  unavailable: number;
  doubts: number;
  players: MockPlayerIntelligence[];
  coach: {
    name: string;
    flexibility: number;
    substitution: number;
    gameState: number;
  };
};

export type MockMatchIntelligence = {
  mode: "mock";
  label: string;
  disclaimer: string;
  competition: string;
  venue: string;
  teamA: MockTeamIntelligence;
  teamB: MockTeamIntelligence;
  probability: {
    teamA: number;
    draw: number;
    teamB: number;
    score: string;
    confidence: number;
  };
  h2h: {
    meetings: number;
    teamAWins: number;
    draws: number;
    teamBWins: number;
    goalsTeamA: number;
    goalsTeamB: number;
  };
  keySignals: Array<{
    id: string;
    label: string;
    detail: string;
    edge: "team_a" | "team_b" | "balanced";
    importance: "high" | "medium";
  }>;
  scenarioId: string | null;
};

type MockMatchInput = {
  teamA: string;
  teamB: string;
  competition?: string;
  homeTeam?: MockHomeTeam;
};

type PlayerTemplate = {
  number: number;
  role: string;
  nameZh: string;
  height: number;
  attackWeight: number;
  defenseWeight: number;
};

const playerTemplates: PlayerTemplate[] = [
  { number: 1, role: "Goalkeeper", nameZh: "演示门将", height: 191, attackWeight: 0.05, defenseWeight: 1 },
  { number: 2, role: "Right Back", nameZh: "演示右后卫", height: 181, attackWeight: 0.35, defenseWeight: 0.82 },
  { number: 4, role: "Centre Back", nameZh: "演示中后卫", height: 188, attackWeight: 0.12, defenseWeight: 1 },
  { number: 6, role: "Defensive Midfielder", nameZh: "演示后腰", height: 184, attackWeight: 0.3, defenseWeight: 0.78 },
  { number: 8, role: "Central Midfielder", nameZh: "演示中场", height: 179, attackWeight: 0.58, defenseWeight: 0.52 },
  { number: 10, role: "Attacking Midfielder", nameZh: "演示前腰", height: 177, attackWeight: 0.86, defenseWeight: 0.2 },
  { number: 7, role: "Right Winger", nameZh: "演示边锋", height: 175, attackWeight: 0.94, defenseWeight: 0.16 },
  { number: 9, role: "Centre Forward", nameZh: "演示中锋", height: 186, attackWeight: 1, defenseWeight: 0.1 }
];

const formations = ["4-3-3", "4-2-3-1", "3-4-2-1", "4-4-2"];
const buildStyles = ["控球推进", "快速转换", "边路宽度", "中路渗透"];
const defensiveBlocks = ["高位压迫", "中位封锁", "紧凑低位", "混合压迫"];
const setPieceProfiles = ["前点冲击", "后点包抄", "二点控制", "短角球变化"];

function hashText(value: string) {
  let hash = 2166136261;
  for (const char of value.trim().toLowerCase()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rounded(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function metric(random: () => number, min: number, max: number) {
  return Math.round(min + random() * (max - min));
}

function recentForm(random: () => number): Array<"W" | "D" | "L"> {
  return Array.from({ length: 5 }, () => {
    const value = random();
    return value > 0.66 ? "W" : value > 0.34 ? "D" : "L";
  });
}

function formPoints(recent: Array<"W" | "D" | "L">) {
  return recent.reduce((total, result) => total + (result === "W" ? 3 : result === "D" ? 1 : 0), 0);
}

function shortTeamName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.map((word) => word[0]?.toUpperCase()).join("").slice(0, 3);
  return initials || "TM";
}

function buildPlayers(seedName: string, random: () => number, attack: number, defense: number, form: number) {
  const shortName = shortTeamName(seedName);
  return playerTemplates.map((template, index): MockPlayerIntelligence => {
    const isKeeper = template.number === 1;
    const playerForm = clamp(Math.round(form + (random() - 0.5) * 18), 54, 94);
    const availabilityRoll = random();
    const status = availabilityRoll < 0.07
      ? "injured"
      : availabilityRoll < 0.16
        ? "doubt"
        : "ready";
    const attackingOutput = attack * template.attackWeight * (0.75 + random() * 0.45);
    const defensiveOutput = defense * template.defenseWeight * (0.75 + random() * 0.4);
    const penaltiesTaken = template.number === 9 || template.number === 10 ? metric(random, 2, 6) : 0;
    const penaltiesScored = penaltiesTaken ? Math.max(0, penaltiesTaken - metric(random, 0, 1)) : 0;
    const penaltiesFaced = isKeeper ? metric(random, 3, 8) : 0;
    const penaltySaves = isKeeper ? metric(random, 0, Math.min(3, penaltiesFaced)) : 0;
    const shots = isKeeper ? 0 : clamp(Math.round(attackingOutput / 8 + random() * 3), 0, 14);
    const xg = isKeeper ? 0 : rounded(shots * (0.08 + random() * 0.08), 2);
    const tackles = isKeeper ? 0 : clamp(Math.round(defensiveOutput / 14 + random() * 2), 0, 9);
    const interceptions = isKeeper ? 0 : clamp(Math.round(defensiveOutput / 18 + random()), 0, 7);
    const blocks = isKeeper ? metric(random, 0, 2) : clamp(Math.round(defensiveOutput / 28 + random()), 0, 5);
    const dribbledPast = isKeeper ? 0 : metric(random, 0, 3);
    const roleX = isKeeper ? 8 : template.number === 4 ? 28 : template.number <= 6 ? 45 : template.number <= 8 ? 68 : 84;

    return {
      name: `${shortName} Scenario ${template.number}`,
      nameZh: template.nameZh,
      role: template.role,
      status,
      form: playerForm,
      goals: isKeeper ? 0 : clamp(Math.round((attackingOutput - 48) / 8), 0, 11),
      assists: isKeeper ? 0 : clamp(Math.round((attackingOutput - 42) / 10 + random() * 2), 0, 9),
      defense: clamp(Math.round(defensiveOutput), 12, 94),
      minutes: status === "injured" ? metric(random, 120, 260) : metric(random, 330, 450),
      age: metric(random, 21, 32),
      shirtNumber: template.number,
      heightCm: template.height + metric(random, -3, 3),
      preferredFoot: index % 3 === 0 ? "left" : index % 3 === 1 ? "right" : "both",
      shotsOnTarget: isKeeper ? metric(random, 16, 30) : clamp(Math.round(attackingOutput / 5), 1, 20),
      saves: isKeeper ? metric(random, 12, 26) : 0,
      penaltiesTaken,
      penaltiesScored,
      penaltiesFaced,
      penaltySaves,
      avatarUrl: "/assets/mock-player-portrait.png",
      starter: true,
      eventMetrics: { shots, xg, tackles, interceptions, blocks, dribbledPast },
      heatmap: Array.from({ length: 5 }, () => ({
        x: clamp(roleX + metric(random, -8, 8), 4, 96),
        y: metric(random, 15, 85),
        intensity: metric(random, 45, 100)
      })),
      note: status === "injured"
        ? "演示伤停：用于展示缺阵对阵容深度的影响。"
        : status === "doubt"
          ? "演示待定：赛前状态存在不确定性。"
          : "演示状态：近五场角色贡献保持稳定。"
    };
  });
}

function buildTeam(name: string, opponent: string) {
  const identity = resolveMockTeam(name);
  const seedName = identity?.canonicalName ?? name;
  const random = createRandom(hashText(`${canonicalMockTeamKey(name)}|${canonicalMockTeamKey(opponent)}`));
  const attack = identity?.rating.attack ?? metric(random, 70, 91);
  const defense = identity?.rating.defense ?? metric(random, 68, 90);
  const form = identity?.rating.form ?? metric(random, 66, 91);
  const fitness = identity?.rating.fitness ?? metric(random, 69, 89);
  const possession = identity?.rating.possession ?? metric(random, 46, 66);
  const press = identity?.rating.press ?? metric(random, 65, 91);
  const recent = recentForm(random);
  const xgFor = rounded(1.15 + (attack - 65) * 0.045 + random() * 0.22, 2);
  const xgAgainst = rounded(clamp(1.78 - (defense - 65) * 0.035 + random() * 0.18, 0.58, 1.75), 2);
  const unavailable = metric(random, 0, 2);
  const doubts = metric(random, 0, 2);
  const injurySafety = clamp(92 - unavailable * 12 - doubts * 6, 52, 94);
  const recentPoints = formPoints(recent);

  return {
    name,
    attack,
    defense,
    form,
    fitness,
    possession,
    press,
    injurySafety,
    xgFor,
    xgAgainst,
    recent,
    recentPoints,
    recentGoalsFor: clamp(Math.round(xgFor * 5 + random() * 2), 3, 15),
    recentGoalsAgainst: clamp(Math.round(xgAgainst * 5 + random() * 2), 2, 12),
    formation: formations[metric(random, 0, formations.length - 1)],
    buildStyle: buildStyles[metric(random, 0, buildStyles.length - 1)],
    defensiveBlock: defensiveBlocks[metric(random, 0, defensiveBlocks.length - 1)],
    setPieceProfile: setPieceProfiles[metric(random, 0, setPieceProfiles.length - 1)],
    restDays: metric(random, 3, 7),
    travelLoad: (["low", "medium", "high"] as const)[metric(random, 0, 2)],
    unavailable,
    doubts,
    players: buildPlayers(seedName, random, attack, defense, form),
    coach: {
      name: `${shortTeamName(name)} Scenario Coach`,
      flexibility: metric(random, 64, 89),
      substitution: metric(random, 62, 88),
      gameState: metric(random, 63, 90)
    }
  } satisfies MockTeamIntelligence;
}

function likelyScore(teamA: number, draw: number, teamB: number) {
  if (teamA >= teamB + 12) return "2-1";
  if (teamB >= teamA + 12) return "1-2";
  if (draw >= 28) return "1-1";
  return teamA >= teamB ? "2-1 / 1-1" : "1-2 / 1-1";
}

function probability(teamA: MockTeamIntelligence, teamB: MockTeamIntelligence, homeTeam: MockHomeTeam) {
  const rating = (team: MockTeamIntelligence) =>
    team.attack * 0.28 + team.defense * 0.23 + team.form * 0.18 + team.fitness * 0.11
    + team.press * 0.08 + team.injurySafety * 0.07 + team.recentPoints * 0.35;
  const homeShift = homeTeam === "team_a" ? 4.2 : homeTeam === "team_b" ? -4.2 : 0;
  const difference = rating(teamA) - rating(teamB) + homeShift;
  const draw = clamp(Math.round(27 - Math.abs(difference) * 0.28), 19, 29);
  const available = 100 - draw;
  const share = 1 / (1 + Math.exp(-difference / 8.5));
  const a = clamp(Math.round(available * share), 16, 67);
  const b = 100 - draw - a;
  const confidence = clamp(Math.round(58 + Math.abs(difference) * 1.1), 58, 82);
  return { teamA: a, draw, teamB: b, score: likelyScore(a, draw, b), confidence };
}

function buildHeadToHead(teamA: string, teamB: string) {
  const random = createRandom(hashText([teamA, teamB].sort().join("|")));
  const teamAWins = metric(random, 1, 3);
  const draws = metric(random, 0, Math.min(2, 5 - teamAWins));
  const teamBWins = 5 - teamAWins - draws;
  return {
    meetings: 5,
    teamAWins,
    draws,
    teamBWins,
    goalsTeamA: metric(random, 4, 10),
    goalsTeamB: metric(random, 4, 10)
  };
}

function signalEdge(left: number, right: number): "team_a" | "team_b" | "balanced" {
  if (left >= right + 5) return "team_a";
  if (right >= left + 5) return "team_b";
  return "balanced";
}

export function buildMockMatchIntelligence(input: MockMatchInput): MockMatchIntelligence {
  const homeTeam = input.homeTeam ?? "neutral";
  const teamA = buildTeam(input.teamA.trim() || "Team A", input.teamB.trim() || "Team B");
  const teamB = buildTeam(input.teamB.trim() || "Team B", input.teamA.trim() || "Team A");
  const predicted = probability(teamA, teamB, homeTeam);
  const availabilityA = teamA.injurySafety + teamA.fitness;
  const availabilityB = teamB.injurySafety + teamB.fitness;
  const aerialA = teamA.players.find((player) => player.shirtNumber === 9)?.heightCm ?? 0;
  const aerialB = teamB.players.find((player) => player.shirtNumber === 4)?.heightCm ?? 0;
  const scenario = getMockScenarioForTeams(teamA.name, teamB.name);

  return {
    mode: "mock",
    label: "完整演示情报",
    disclaimer: "以下指标为结构化演示数据，仅用于体验产品流程，不代表所选球队的真实近况。",
    competition: input.competition?.trim() || "演示赛事",
    venue: homeTeam === "team_a" ? `${teamA.name} 主场` : homeTeam === "team_b" ? `${teamB.name} 主场` : "中立场",
    teamA,
    teamB,
    probability: predicted,
    h2h: buildHeadToHead(canonicalMockTeamKey(teamA.name), canonicalMockTeamKey(teamB.name)),
    scenarioId: scenario?.id ?? null,
    keySignals: [
      {
        id: "form",
        label: "近期走势",
        detail: `${teamA.name} ${teamA.recentPoints} 分 / ${teamB.name} ${teamB.recentPoints} 分（近 5 场演示样本）`,
        edge: signalEdge(teamA.recentPoints, teamB.recentPoints),
        importance: "high"
      },
      {
        id: "availability",
        label: "阵容可用性",
        detail: `${teamA.name} ${teamA.unavailable} 缺阵 ${teamA.doubts} 待定；${teamB.name} ${teamB.unavailable} 缺阵 ${teamB.doubts} 待定`,
        edge: signalEdge(availabilityA, availabilityB),
        importance: "high"
      },
      {
        id: "pressing",
        label: "压迫与出球",
        detail: `${teamA.name} 压迫 ${teamA.press} / ${teamB.name} 控球 ${teamB.possession}；反向 ${teamB.press} / ${teamA.possession}`,
        edge: signalEdge(teamA.press - teamB.possession, teamB.press - teamA.possession),
        importance: "medium"
      },
      {
        id: "aerial",
        label: "高空对位",
        detail: `${teamA.name} 演示中锋 ${aerialA}cm，对位 ${teamB.name} 演示中卫 ${aerialB}cm`,
        edge: signalEdge(aerialA, aerialB),
        importance: "medium"
      }
    ]
  };
}
