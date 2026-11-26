import type { FixtureSchedule, ScheduledFixture } from "./fixture-types";

export type MockTeamProfile = {
  id: string;
  canonicalName: string;
  nameZh: string;
  kind: "club" | "national";
  league: string;
  country: string;
  aliases: string[];
  rating: {
    attack: number;
    defense: number;
    form: number;
    fitness: number;
    possession: number;
    press: number;
  };
};

export type MockDemoScenario = {
  id: string;
  competition: string;
  country: string;
  round: string;
  venue: string;
  teamA: string;
  teamB: string;
};

const teams: MockTeamProfile[] = [
  { id: "mci", canonicalName: "Manchester City", nameZh: "曼城", kind: "club", league: "英超", country: "英格兰", aliases: ["Man City", "曼城"], rating: { attack: 90, defense: 86, form: 84, fitness: 82, possession: 91, press: 88 } },
  { id: "liv", canonicalName: "Liverpool", nameZh: "利物浦", kind: "club", league: "英超", country: "英格兰", aliases: ["利物浦"], rating: { attack: 89, defense: 84, form: 87, fitness: 85, possession: 84, press: 91 } },
  { id: "rma", canonicalName: "Real Madrid", nameZh: "皇家马德里", kind: "club", league: "西甲", country: "西班牙", aliases: ["Real Madrid CF", "皇马", "皇家马德里"], rating: { attack: 92, defense: 86, form: 89, fitness: 84, possession: 87, press: 82 } },
  { id: "bar", canonicalName: "Barcelona", nameZh: "巴塞罗那", kind: "club", league: "西甲", country: "西班牙", aliases: ["FC Barcelona", "巴萨", "巴塞罗那"], rating: { attack: 89, defense: 82, form: 86, fitness: 83, possession: 91, press: 87 } },
  { id: "int", canonicalName: "Inter Milan", nameZh: "国际米兰", kind: "club", league: "意甲", country: "意大利", aliases: ["Internazionale", "国际米兰", "国米"], rating: { attack: 86, defense: 89, form: 87, fitness: 84, possession: 81, press: 83 } },
  { id: "juv", canonicalName: "Juventus", nameZh: "尤文图斯", kind: "club", league: "意甲", country: "意大利", aliases: ["Juventus FC", "尤文图斯", "尤文"], rating: { attack: 82, defense: 87, form: 81, fitness: 84, possession: 78, press: 80 } },
  { id: "bay", canonicalName: "Bayern Munich", nameZh: "拜仁慕尼黑", kind: "club", league: "德甲", country: "德国", aliases: ["FC Bayern München", "Bayern München", "拜仁", "拜仁慕尼黑"], rating: { attack: 91, defense: 84, form: 88, fitness: 86, possession: 88, press: 90 } },
  { id: "bvb", canonicalName: "Borussia Dortmund", nameZh: "多特蒙德", kind: "club", league: "德甲", country: "德国", aliases: ["Dortmund", "多特蒙德", "多特"], rating: { attack: 86, defense: 80, form: 83, fitness: 84, possession: 81, press: 86 } },
  { id: "psg", canonicalName: "Paris Saint-Germain", nameZh: "巴黎圣日耳曼", kind: "club", league: "法甲", country: "法国", aliases: ["PSG", "Paris SG", "巴黎圣日耳曼", "巴黎"], rating: { attack: 92, defense: 85, form: 90, fitness: 86, possession: 89, press: 88 } },
  { id: "om", canonicalName: "Marseille", nameZh: "马赛", kind: "club", league: "法甲", country: "法国", aliases: ["Olympique Marseille", "马赛"], rating: { attack: 82, defense: 80, form: 81, fitness: 83, possession: 77, press: 84 } },
  { id: "shp", canonicalName: "Shanghai Port", nameZh: "上海海港", kind: "club", league: "中超", country: "中国", aliases: ["Shanghai SIPG", "上海海港", "上海上港"], rating: { attack: 83, defense: 78, form: 86, fitness: 82, possession: 80, press: 78 } },
  { id: "sdt", canonicalName: "Shandong Taishan", nameZh: "山东泰山", kind: "club", league: "中超", country: "中国", aliases: ["山东泰山", "山东鲁能"], rating: { attack: 81, defense: 80, form: 82, fitness: 83, possession: 76, press: 80 } },
  { id: "hil", canonicalName: "Al Hilal", nameZh: "利雅得新月", kind: "club", league: "沙特联", country: "沙特阿拉伯", aliases: ["Al-Hilal", "利雅得新月"], rating: { attack: 88, defense: 83, form: 89, fitness: 85, possession: 84, press: 82 } },
  { id: "nas", canonicalName: "Al Nassr", nameZh: "利雅得胜利", kind: "club", league: "沙特联", country: "沙特阿拉伯", aliases: ["Al-Nassr", "利雅得胜利"], rating: { attack: 87, defense: 78, form: 84, fitness: 82, possession: 82, press: 78 } },
  { id: "mia", canonicalName: "Inter Miami", nameZh: "迈阿密国际", kind: "club", league: "美职联", country: "美国", aliases: ["Inter Miami CF", "迈阿密国际"], rating: { attack: 84, defense: 74, form: 81, fitness: 78, possession: 79, press: 72 } },
  { id: "laf", canonicalName: "Los Angeles FC", nameZh: "洛杉矶FC", kind: "club", league: "美职联", country: "美国", aliases: ["LAFC", "洛杉矶FC"], rating: { attack: 82, defense: 79, form: 83, fitness: 84, possession: 76, press: 84 } },
  { id: "arg", canonicalName: "Argentina", nameZh: "阿根廷", kind: "national", league: "国家队", country: "阿根廷", aliases: ["Argentina National Team", "阿根廷", "阿根廷国家队"], rating: { attack: 88, defense: 86, form: 89, fitness: 84, possession: 85, press: 82 } },
  { id: "fra", canonicalName: "France", nameZh: "法国", kind: "national", league: "国家队", country: "法国", aliases: ["France National Team", "法国", "法国国家队"], rating: { attack: 90, defense: 87, form: 86, fitness: 86, possession: 82, press: 85 } }
];

export const mockDemoScenarios: MockDemoScenario[] = [
  { id: "premier-league", competition: "英超 / Premier League", country: "英格兰", round: "演示第 1 轮", venue: "Etihad Stadium", teamA: "Manchester City", teamB: "Liverpool" },
  { id: "la-liga", competition: "西甲 / La Liga", country: "西班牙", round: "演示第 2 轮", venue: "Santiago Bernabeu", teamA: "Real Madrid", teamB: "Barcelona" },
  { id: "serie-a", competition: "意甲 / Serie A", country: "意大利", round: "演示第 3 轮", venue: "San Siro", teamA: "Inter Milan", teamB: "Juventus" },
  { id: "bundesliga", competition: "德甲 / Bundesliga", country: "德国", round: "演示第 4 轮", venue: "Allianz Arena", teamA: "Bayern Munich", teamB: "Borussia Dortmund" },
  { id: "ligue-1", competition: "法甲 / Ligue 1", country: "法国", round: "演示第 5 轮", venue: "Parc des Princes", teamA: "Paris Saint-Germain", teamB: "Marseille" },
  { id: "csl", competition: "中超 / Chinese Super League", country: "中国", round: "演示第 6 轮", venue: "Pudong Football Stadium", teamA: "Shanghai Port", teamB: "Shandong Taishan" },
  { id: "saudi-pro", competition: "沙特联 / Saudi Pro League", country: "沙特阿拉伯", round: "演示第 7 轮", venue: "Kingdom Arena", teamA: "Al Hilal", teamB: "Al Nassr" },
  { id: "mls", competition: "美职联 / Major League Soccer", country: "美国", round: "演示第 8 轮", venue: "Chase Stadium", teamA: "Inter Miami", teamB: "Los Angeles FC" },
  { id: "national", competition: "国家队友谊赛 / International Friendly", country: "国际", round: "演示国家队比赛", venue: "Neutral Demo Stadium", teamA: "Argentina", teamB: "France" }
];

function normalized(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, "");
}

const teamIndex = new Map<string, MockTeamProfile>();
for (const team of teams) {
  for (const alias of [team.canonicalName, team.nameZh, ...team.aliases]) teamIndex.set(normalized(alias), team);
}

export function resolveMockTeam(name: string) {
  return teamIndex.get(normalized(name)) ?? null;
}

export function canonicalMockTeamKey(name: string) {
  return resolveMockTeam(name)?.id ?? normalized(name);
}

export function getMockScenarioForTeams(teamA: string, teamB: string) {
  const a = canonicalMockTeamKey(teamA);
  const b = canonicalMockTeamKey(teamB);
  return mockDemoScenarios.find((scenario) => {
    const sides = [canonicalMockTeamKey(scenario.teamA), canonicalMockTeamKey(scenario.teamB)];
    return sides.includes(a) && sides.includes(b);
  }) ?? null;
}

function teamNumber(id: string) {
  return [...id].reduce((total, char) => total * 31 + char.charCodeAt(0), 17) >>> 0;
}

function kickoffFor(baseDate: string, offset: number) {
  const date = new Date(`${baseDate}T11:35:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  if (date.getTime() < Date.now() + 30 * 60_000) date.setTime(Date.now() + (offset + 1) * 60 * 60_000);
  return date.toISOString();
}

function scenarioFixture(scenario: MockDemoScenario, index: number, baseDate: string, days: number): ScheduledFixture {
  const teamA = resolveMockTeam(scenario.teamA)!;
  const teamB = resolveMockTeam(scenario.teamB)!;
  return {
    id: String(900_000 + index),
    provider: "mock-offline",
    startsAt: kickoffFor(baseDate, days === 1 ? 0 : index + 1),
    status: "DEMO",
    competition: scenario.competition,
    country: scenario.country,
    round: scenario.round,
    venue: scenario.venue,
    dataMode: "mock",
    home: { id: teamNumber(teamA.id), name: teamA.canonicalName, shortCode: teamA.id.toUpperCase(), badgeUrl: "" },
    away: { id: teamNumber(teamB.id), name: teamB.canonicalName, shortCode: teamB.id.toUpperCase(), badgeUrl: "" }
  };
}

export function buildOfflineFixtureSchedule(date: string, days: number, fallbackReason: string): FixtureSchedule {
  return {
    ok: true,
    date,
    timezone: "Asia/Shanghai",
    fetchedAt: new Date().toISOString(),
    cached: false,
    dataMode: "mock",
    fallbackReason,
    providers: ["mock-offline"],
    attemptedProviders: ["mock-offline"],
    providerErrors: [],
    fixtures: mockDemoScenarios.slice(0, Math.max(1, Math.min(days, mockDemoScenarios.length))).map((scenario, index) => scenarioFixture(scenario, index, date, days))
  };
}
