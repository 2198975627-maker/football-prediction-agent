"use client";

import {
  AlertTriangle,
  Activity,
  ArrowLeftRight,
  BadgeDollarSign,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  ClipboardCopy,
  Database,
  Download,
  Dumbbell,
  Eye,
  FileText,
  Filter,
  Gauge,
  Globe2,
  Goal,
  Landmark,
  ListFilter,
  LockKeyhole,
  MapPin,
  Radar,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Swords,
  X,
  Trophy,
  Upload,
  UserRoundCheck,
  Users,
  Workflow,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CostEstimate, PredictionResponse, WorkflowStep } from "@/src/lib/schemas";

type TeamKind = "club" | "national";
type TeamSlot = "teamA" | "teamB";
type TeamMode = "all" | TeamKind;
type WorkspaceView = "teams" | "match" | "analysis" | "report";

type PlayerStatus = {
  name: string;
  role: string;
  status: "ready" | "doubt" | "injured" | "suspended";
  form: number;
  goals: number;
  assists: number;
  defense: number;
  minutes: number;
  avatarUrl?: string;
  metricsStatus?: "verified" | "placeholder" | "user-imported";
  rosterStatus?: "provider" | "placeholder" | "user-imported";
  note: string;
};

type TeamProfile = {
  id: string;
  name: string;
  kind: TeamKind;
  league: string;
  country: string;
  continent: string;
  tier: string;
  badge: string;
  badgeUrl?: string;
  fanartUrl?: string;
  stadium?: string;
  stadiumCapacity?: number | null;
  source?: string;
  sourceTeamId?: string;
  metricsStatus?: "verified" | "placeholder";
  rosterStatus?: "provider" | "placeholder";
  attack: number;
  defense: number;
  form: number;
  fitness: number;
  possession: number;
  press: number;
  injurySafety: number;
  xgFor: number;
  xgAgainst: number;
  recent: string[];
  players: PlayerStatus[];
};

type FormState = {
  teamA: string;
  teamB: string;
  matchDate: string;
  competition: string;
  homeTeam: "team_a" | "team_b" | "neutral";
  analysisDepth: "standard" | "deep";
  billingMode: "byok" | "platform";
  maxUserChargeCents: number;
};

type FilterState = {
  mode: TeamMode;
  search: string;
  league: string;
  country: string;
  continent: string;
  tier: string;
};

type ProbabilitySummary = {
  teamA: number;
  draw: number;
  teamB: number;
  score: string;
};

type MatchupInsight = {
  id: string;
  title: string;
  attacker: PlayerStatus;
  defender: PlayerStatus;
  attackValue: number;
  defenseValue: number;
  aerialEdge: number;
  note: string;
};

type KeeperPenaltyInsight = {
  keeper: PlayerStatus;
  shooter: PlayerStatus;
  saveValue: number;
  shotValue: number;
  penaltySave: number;
  penaltyScore: number;
};

type TacticalChain = {
  id: string;
  trigger: string;
  attackLabel: string;
  defenseLabel: string;
  attackValue: number;
  defenseValue: number;
  verdict: string;
};

type CoachProfile = {
  teamName: string;
  flexibility: number;
  substitution: number;
  gameState: number;
  risk: string;
};

type ActiveModal =
  | { type: "player"; player: PlayerStatus; team: TeamProfile }
  | { type: "payment" }
  | { type: "byok" }
  | { type: "account" }
  | { type: "importPlayers" }
  | null;

type AccountUser = { id: string; email?: string };

type LiveImportStatus = {
  loading: boolean;
  message: string | null;
  error: string | null;
};

type LiveTeamResponse = {
  ok: boolean;
  error?: string;
  importedAt?: string;
  rawCount?: number;
  storage?: "supabase" | "local";
  notice?: string;
  warning?: string;
  source?: {
    name: string;
    url: string;
    apiKeyMode: string;
  };
  snapshot?: {
    generatedAt?: string;
    beijingDate?: string;
    totals?: {
      teams?: number;
      clubs?: number;
      nationalTeams?: number;
      players?: number;
    };
  };
  changes?: unknown;
  teams?: TeamProfile[];
};

type EventHeatmapPoint = {
  x: number;
  y: number;
  count: number;
};

type EventShotPoint = {
  x: number;
  y: number;
  xg: number;
  outcome: string;
  bodyPart: string;
};

type EventPlayerProfile = {
  playerId: string;
  name: string;
  team: string;
  position: string;
  heightCm: number | null;
  preferredFoot: "left" | "right" | "both" | "unknown";
  shots: number;
  shotsOnTarget: number;
  goals: number;
  xg: number;
  tackles: number;
  tacklesWon: number;
  blocks: number;
  interceptions: number;
  clearances: number;
  dribblesAttempted: number;
  dribblesCompleted: number;
  dribbledPast: number;
  saves: number;
  shotsFaced: number;
  penaltySaves: number;
  penaltiesFaced: number;
  penaltiesTaken: number;
  penaltiesScored: number;
  heatmap: EventHeatmapPoint[];
  shotsMap: EventShotPoint[];
};

type EventKeeperZone = {
  keeperId: string;
  keeperName: string;
  team: string;
  shotsFaced: number;
  saves: number;
  penaltiesFaced: number;
  penaltySaves: number;
  zones: EventHeatmapPoint[];
};

type PlayerEventDataResponse = {
  ok: boolean;
  error?: string;
  provider?: string;
  sourceName?: string;
  sourceUrl?: string;
  mode?: "historical-demo" | "live";
  coverageTier?: "free-historical" | "free-live-summary" | "commercial-live-events";
  capabilities?: string[];
  missingCapabilities?: string[];
  matchId?: string;
  matchLabel?: string;
  fetchedAt?: string;
  teams?: string[];
  players?: EventPlayerProfile[];
  keeperZones?: EventKeeperZone[];
  summary?: {
    totalEvents: number;
    shots: number;
    shotsOnTarget: number;
    goals: number;
    xg: number;
    dribblesAttempted: number;
    dribblesCompleted: number;
    dribbledPast: number;
    tackles: number;
    blocks: number;
    interceptions: number;
    saves: number;
    penaltiesTaken: number;
    penaltiesScored: number;
    penaltySaves: number;
  };
  dataGaps?: string[];
  notes?: string[];
};

type OfficialSourceProvider = {
  id: string;
  name: string;
  role: string;
  configured: boolean;
  runtimeStatus: "ready" | "needs-key" | "open-data-ready" | "prepared" | "contract-needed";
  costModel: string;
  capabilities: string[];
  bestFor: string[];
  limitations: string[];
  missingEnvKeys: string[];
  docsUrl: string;
};

type SportsAnalysisTool = {
  id: string;
  name: string;
  role: string;
  configured: boolean;
  runtimeStatus: "prepared" | "enabled";
  packageNames: string[];
  capabilities: string[];
  bestFor: string[];
  limitations: string[];
  docsUrl: string;
};

type OfficialFusionStage = {
  id: string;
  name: string;
  description: string;
  providers: string[];
  requiredCapabilities: string[];
};

type OfficialSourcesResponse = {
  ok: boolean;
  error?: string;
  strategy?: string;
  generatedAt?: string;
  configuredProviderCount?: number;
  enabledToolCount?: number;
  providers?: OfficialSourceProvider[];
  analysisTools?: SportsAnalysisTool[];
  fusionPlan?: OfficialFusionStage[];
  warnings?: string[];
};

type MatchIntelligenceResponse = {
  ok: boolean;
  error?: string;
  code?: string;
  provider?: "api-football" | "sportmonks" | "football-data-org";
  fetchedAt?: string;
  fixture?: {
    id: number;
    name: string;
    startsAt: string;
    state: string;
    league: string;
    venue: string;
  };
  teams?: Array<{ id: number; name: string; shortCode: string; imageUrl: string }>;
  lineups?: Array<{ playerId: number; teamId: number; playerName: string; starter: boolean }>;
  sidelined?: Array<{ playerId: number | null; playerName: string; category: string }>;
  events?: Array<{ id: number | null; type: string; minute: number | null }>;
  teamStatistics?: Array<{ teamId: number | null; type: string; value: number | string | boolean | null }>;
  coverage?: {
    confirmedLineup: boolean;
    lineups: number;
    sidelined: number;
    events: number;
    teamStatistics: number;
    hasWeather: boolean;
    hasFormations: boolean;
  };
  cache?: {
    status: "hit" | "miss" | "refreshed" | "stale";
    storage: "memory" | "supabase";
    updatedAt: string;
    ageSeconds: number;
  };
  quality?: {
    score: number;
    level: "insufficient" | "partial" | "ready";
    canRunPreliminaryAnalysis: boolean;
    canRunOfficialPrediction: boolean;
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
  warnings?: string[];
};

const matchProviderLabels: Record<NonNullable<MatchIntelligenceResponse["provider"]>, string> = {
  "api-football": "API-Football",
  sportmonks: "Sportmonks",
  "football-data-org": "football-data.org"
};

const initialForm: FormState = {
  teamA: "Manchester City",
  teamB: "Real Madrid",
  matchDate: "2026-07-12 20:00",
  competition: "俱乐部杯赛",
  homeTeam: "neutral",
  analysisDepth: "standard",
  billingMode: "platform",
  maxUserChargeCents: 300
};

const initialFilters: FilterState = {
  mode: "all",
  search: "",
  league: "all",
  country: "all",
  continent: "all",
  tier: "all"
};

const ENGLAND_FLAG = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
const SCOTLAND_FLAG = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
const WALES_FLAG = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}";

const countryFlagAliases: Record<string, string> = {
  "英格兰": ENGLAND_FLAG,
  "england": ENGLAND_FLAG,
  "苏格兰": SCOTLAND_FLAG,
  "scotland": SCOTLAND_FLAG,
  "威尔士": WALES_FLAG,
  "wales": WALES_FLAG,
  "英国": "GB",
  "united kingdom": "GB",
  "great britain": "GB",
  "西班牙": "ES",
  "spain": "ES",
  "espana": "ES",
  "españa": "ES",
  "德国": "DE",
  "germany": "DE",
  "deutschland": "DE",
  "法国": "FR",
  "france": "FR",
  "阿根廷": "AR",
  "argentina": "AR",
  "巴西": "BR",
  "brazil": "BR",
  "日本": "JP",
  "japan": "JP",
  "中国": "CN",
  "china": "CN",
  "意大利": "IT",
  "italy": "IT",
  "葡萄牙": "PT",
  "portugal": "PT",
  "荷兰": "NL",
  "netherlands": "NL",
  "holland": "NL",
  "沙特阿拉伯": "SA",
  "沙特": "SA",
  "saudi arabia": "SA",
  "韩国": "KR",
  "south korea": "KR",
  "korea republic": "KR",
  "republic of korea": "KR",
  "美国": "US",
  "united states": "US",
  "usa": "US",
  "us": "US",
  "比利时": "BE",
  "belgium": "BE",
  "克罗地亚": "HR",
  "croatia": "HR",
  "乌拉圭": "UY",
  "uruguay": "UY",
  "哥伦比亚": "CO",
  "colombia": "CO",
  "墨西哥": "MX",
  "mexico": "MX",
  "摩洛哥": "MA",
  "morocco": "MA",
  "塞内加尔": "SN",
  "senegal": "SN",
  "澳大利亚": "AU",
  "australia": "AU",
  "伊朗": "IR",
  "iran": "IR",
  "土耳其": "TR",
  "turkey": "TR",
  "turkiye": "TR",
  "türkiye": "TR",
  "希腊": "GR",
  "greece": "GR",
  "瑞士": "CH",
  "switzerland": "CH",
  "奥地利": "AT",
  "austria": "AT",
  "丹麦": "DK",
  "denmark": "DK",
  "瑞典": "SE",
  "sweden": "SE",
  "挪威": "NO",
  "norway": "NO",
  "塞尔维亚": "RS",
  "serbia": "RS",
  "波兰": "PL",
  "poland": "PL",
  "智利": "CL",
  "chile": "CL",
  "秘鲁": "PE",
  "peru": "PE",
  "厄瓜多尔": "EC",
  "ecuador": "EC",
  "巴拉圭": "PY",
  "paraguay": "PY",
  "玻利维亚": "BO",
  "bolivia": "BO",
  "委内瑞拉": "VE",
  "venezuela": "VE",
  "卡塔尔": "QA",
  "qatar": "QA",
  "泰国": "TH",
  "thailand": "TH",
  "越南": "VN",
  "vietnam": "VN",
  "加拿大": "CA",
  "canada": "CA",
  "哥斯达黎加": "CR",
  "costa rica": "CR",
  "牙买加": "JM",
  "jamaica": "JM",
  "埃及": "EG",
  "egypt": "EG",
  "尼日利亚": "NG",
  "nigeria": "NG",
  "加纳": "GH",
  "ghana": "GH",
  "喀麦隆": "CM",
  "cameroon": "CM",
  "南非": "ZA",
  "south africa": "ZA",
  "突尼斯": "TN",
  "tunisia": "TN",
  "阿尔及利亚": "DZ",
  "algeria": "DZ",
  "俄罗斯": "RU",
  "russia": "RU",
  "乌克兰": "UA",
  "ukraine": "UA",
  "捷克": "CZ",
  "czech republic": "CZ",
  "czechia": "CZ",
  "斯洛伐克": "SK",
  "slovakia": "SK",
  "斯洛文尼亚": "SI",
  "slovenia": "SI",
  "罗马尼亚": "RO",
  "romania": "RO",
  "匈牙利": "HU",
  "hungary": "HU",
  "爱尔兰": "IE",
  "ireland": "IE",
  "冰岛": "IS",
  "iceland": "IS",
  "芬兰": "FI",
  "finland": "FI",
  "以色列": "IL",
  "israel": "IL",
  "印度": "IN",
  "india": "IN",
  "印度尼西亚": "ID",
  "indonesia": "ID",
  "马来西亚": "MY",
  "malaysia": "MY",
  "新加坡": "SG",
  "singapore": "SG",
  "阿联酋": "AE",
  "united arab emirates": "AE",
  "uae": "AE",
  "伊拉克": "IQ",
  "iraq": "IQ",
  "叙利亚": "SY",
  "syria": "SY",
  "约旦": "JO",
  "jordan": "JO",
  "黎巴嫩": "LB",
  "lebanon": "LB",
  "新西兰": "NZ",
  "new zealand": "NZ",
  "中国香港": "HK",
  "香港": "HK",
  "hong kong": "HK",
  "中国澳门": "MO",
  "澳门": "MO",
  "macau": "MO",
  "macao": "MO",
  "中华台北": "TW",
  "中国台北": "TW",
  "chinese taipei": "TW"
};

const fifaCodeFlagAliases: Record<string, string> = {
  AFG: "AF",
  ALB: "AL",
  ALG: "DZ",
  AND: "AD",
  ANG: "AO",
  ARG: "AR",
  ARM: "AM",
  AUS: "AU",
  AUT: "AT",
  AZE: "AZ",
  BEL: "BE",
  BEN: "BJ",
  BOL: "BO",
  BIH: "BA",
  BRA: "BR",
  BUL: "BG",
  CAN: "CA",
  CHI: "CN",
  CHN: "CN",
  CHL: "CL",
  CMR: "CM",
  COL: "CO",
  CRC: "CR",
  CRO: "HR",
  CZE: "CZ",
  DEN: "DK",
  ECU: "EC",
  EGY: "EG",
  ENG: ENGLAND_FLAG,
  ESP: "ES",
  FIN: "FI",
  FRA: "FR",
  GER: "DE",
  GHA: "GH",
  GRE: "GR",
  HUN: "HU",
  IRL: "IE",
  IRN: "IR",
  IRQ: "IQ",
  ISL: "IS",
  ISR: "IL",
  ITA: "IT",
  JAM: "JM",
  JPN: "JP",
  KOR: "KR",
  MAR: "MA",
  MEX: "MX",
  NED: "NL",
  NGA: "NG",
  NOR: "NO",
  NZL: "NZ",
  PAR: "PY",
  PER: "PE",
  POL: "PL",
  POR: "PT",
  QAT: "QA",
  ROU: "RO",
  RSA: "ZA",
  RUS: "RU",
  SCO: SCOTLAND_FLAG,
  SEN: "SN",
  SRB: "RS",
  SUI: "CH",
  SVK: "SK",
  SVN: "SI",
  SWE: "SE",
  TUN: "TN",
  TUR: "TR",
  UAE: "AE",
  UKR: "UA",
  URU: "UY",
  USA: "US",
  VEN: "VE",
  WAL: WALES_FLAG
};

function normalizeCountryName(country: string) {
  return country
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
}

function flagEmojiFromCode(countryCode: string) {
  if (!/^[A-Z]{2}$/.test(countryCode)) return "";

  return Array.from(countryCode)
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

function countryFlag(country: string) {
  const alias = countryFlagAliases[normalizeCountryName(country)];
  if (!alias) return "";
  return /^[A-Z]{2}$/.test(alias) ? flagEmojiFromCode(alias) : alias;
}

function flagImageCodeFromAlias(alias: string) {
  if (/^[A-Z]{2}$/.test(alias)) return alias.toLowerCase();
  if (alias === ENGLAND_FLAG) return "gb-eng";
  if (alias === SCOTLAND_FLAG) return "gb-sct";
  if (alias === WALES_FLAG) return "gb-wls";
  return "";
}

function countryFlagImageCode(country: string) {
  const alias = countryFlagAliases[normalizeCountryName(country)];
  return alias ? flagImageCodeFromAlias(alias) : "";
}

function flagFromFifaCode(code: string) {
  const alias = fifaCodeFlagAliases[code.trim().toUpperCase()];
  if (!alias) return "";
  return /^[A-Z]{2}$/.test(alias) ? flagEmojiFromCode(alias) : alias;
}

function flagImageCodeFromFifaCode(code: string) {
  const alias = fifaCodeFlagAliases[code.trim().toUpperCase()];
  return alias ? flagImageCodeFromAlias(alias) : "";
}

function teamFlag(team: TeamProfile) {
  return countryFlag(team.country) || (team.kind === "national" ? countryFlag(team.name) || flagFromFifaCode(team.badge) : "");
}

function teamFlagImageCode(team: TeamProfile) {
  return (
    countryFlagImageCode(team.country) ||
    (team.kind === "national" ? countryFlagImageCode(team.name) || flagImageCodeFromFifaCode(team.badge) : "")
  );
}

function flagImageUrl(flagCode: string, width = 80) {
  return `/api/flag?code=${encodeURIComponent(flagCode)}&w=${width}`;
}

function proxiedTeamBadgeUrl(url: string | undefined) {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    if (["r2.thesportsdb.com", "www.thesportsdb.com", "media.api-sports.io", "cdn.sportmonks.com", "crests.football-data.org"].includes(parsed.hostname)) {
      return `/api/team-badge?url=${encodeURIComponent(url)}`;
    }
  } catch {
    return "";
  }

  return "";
}

const defaultWorkflow: WorkflowStep[] = [
  { id: "validate-input", name: "输入校验", status: "pending", detail: "等待比赛参数。" },
  { id: "billing-authorized", name: "计费安全门", status: "pending", detail: "等待费用模式和上限。" },
  { id: "team-resolution", name: "球队识别", status: "pending", detail: "等待标准球队 ID。" },
  { id: "football-data", name: "结构化数据", status: "pending", detail: "等待球队、球员和事件数据源。" },
  { id: "player-matchups", name: "球员对位", status: "pending", detail: "等待逐人攻防、门将和点球模型。" },
  { id: "tactical-coach", name: "战术教练", status: "pending", detail: "等待打法克制链和教练调整模型。" },
  { id: "public-research", name: "公开资料搜索", status: "pending", detail: "等待公开来源。" },
  { id: "source-verification", name: "来源验证", status: "pending", detail: "等待可信度标记。" },
  { id: "prediction", name: "综合预测", status: "pending", detail: "等待概率生成。" },
  { id: "settlement", name: "成本结算", status: "pending", detail: "等待成本记录。" }
];

function buildPlayers(seed: number): PlayerStatus[] {
  const readiness: PlayerStatus["status"][] = ["ready", "ready", "ready", "doubt", "ready"];
  const roles = [
    ["核心前锋", "Forward", 7, 2, 36],
    ["组织中场", "Midfielder", 2, 6, 58],
    ["防守中场", "Midfielder", 1, 2, 78],
    ["中后卫", "Defender", 1, 1, 86],
    ["门将", "Goalkeeper", 0, 0, 72]
  ] as const;

  return roles.map(([name, role, goals, assists, defense], index) => ({
    name,
    role,
    status: readiness[(seed + index) % readiness.length],
    form: 62 + ((seed + index * 7) % 31),
    goals: Math.max(0, goals + ((seed + index) % 3) - 1),
    assists: Math.max(0, assists + ((seed + index * 2) % 3) - 1),
    defense: Math.min(95, defense + ((seed + index * 5) % 9)),
    minutes: 68 + ((seed + index * 9) % 28),
    note:
      index === 3 && seed % 2 === 0
        ? "轻微疲劳，需关注赛前名单"
        : index === 0
          ? "近期参与进攻权重高"
          : "状态稳定，可作为模型特征"
  }));
}

const teamCatalog: TeamProfile[] = [
  {
    id: "club-mci",
    name: "Manchester City",
    kind: "club",
    league: "英超",
    country: "英格兰",
    continent: "欧洲",
    tier: "顶级",
    badge: "MC",
    attack: 91,
    defense: 84,
    form: 86,
    fitness: 78,
    possession: 89,
    press: 82,
    injurySafety: 76,
    xgFor: 2.28,
    xgAgainst: 0.94,
    recent: ["胜", "胜", "平", "胜", "负"],
    players: buildPlayers(11)
  },
  {
    id: "club-rma",
    name: "Real Madrid",
    kind: "club",
    league: "西甲",
    country: "西班牙",
    continent: "欧洲",
    tier: "顶级",
    badge: "RM",
    attack: 88,
    defense: 82,
    form: 84,
    fitness: 81,
    possession: 83,
    press: 78,
    injurySafety: 72,
    xgFor: 2.12,
    xgAgainst: 1.01,
    recent: ["胜", "平", "胜", "胜", "平"],
    players: buildPlayers(17)
  },
  {
    id: "club-ars",
    name: "Arsenal",
    kind: "club",
    league: "英超",
    country: "英格兰",
    continent: "欧洲",
    tier: "顶级",
    badge: "ARS",
    attack: 84,
    defense: 86,
    form: 82,
    fitness: 80,
    possession: 82,
    press: 87,
    injurySafety: 75,
    xgFor: 1.95,
    xgAgainst: 0.89,
    recent: ["胜", "胜", "胜", "平", "负"],
    players: buildPlayers(23)
  },
  {
    id: "club-liv",
    name: "Liverpool",
    kind: "club",
    league: "英超",
    country: "英格兰",
    continent: "欧洲",
    tier: "顶级",
    badge: "LIV",
    attack: 86,
    defense: 79,
    form: 81,
    fitness: 74,
    possession: 79,
    press: 91,
    injurySafety: 70,
    xgFor: 2.03,
    xgAgainst: 1.12,
    recent: ["胜", "负", "胜", "平", "胜"],
    players: buildPlayers(31)
  },
  {
    id: "club-bay",
    name: "Bayern Munich",
    kind: "club",
    league: "德甲",
    country: "德国",
    continent: "欧洲",
    tier: "顶级",
    badge: "FCB",
    attack: 89,
    defense: 80,
    form: 83,
    fitness: 77,
    possession: 84,
    press: 85,
    injurySafety: 74,
    xgFor: 2.21,
    xgAgainst: 1.05,
    recent: ["胜", "胜", "胜", "负", "平"],
    players: buildPlayers(37)
  },
  {
    id: "club-psg",
    name: "Paris Saint-Germain",
    kind: "club",
    league: "法甲",
    country: "法国",
    continent: "欧洲",
    tier: "一线",
    badge: "PSG",
    attack: 85,
    defense: 77,
    form: 80,
    fitness: 82,
    possession: 81,
    press: 76,
    injurySafety: 79,
    xgFor: 1.97,
    xgAgainst: 1.16,
    recent: ["平", "胜", "胜", "胜", "负"],
    players: buildPlayers(43)
  },
  {
    id: "nat-arg",
    name: "Argentina",
    kind: "national",
    league: "国家队",
    country: "阿根廷",
    continent: "南美洲",
    tier: "顶级",
    badge: "ARG",
    attack: 86,
    defense: 83,
    form: 88,
    fitness: 79,
    possession: 80,
    press: 75,
    injurySafety: 77,
    xgFor: 1.88,
    xgAgainst: 0.91,
    recent: ["胜", "胜", "胜", "平", "胜"],
    players: buildPlayers(47)
  },
  {
    id: "nat-fra",
    name: "France",
    kind: "national",
    league: "国家队",
    country: "法国",
    continent: "欧洲",
    tier: "顶级",
    badge: "FRA",
    attack: 87,
    defense: 84,
    form: 85,
    fitness: 80,
    possession: 77,
    press: 78,
    injurySafety: 73,
    xgFor: 1.93,
    xgAgainst: 0.95,
    recent: ["胜", "平", "胜", "胜", "负"],
    players: buildPlayers(53)
  },
  {
    id: "nat-bra",
    name: "Brazil",
    kind: "national",
    league: "国家队",
    country: "巴西",
    continent: "南美洲",
    tier: "顶级",
    badge: "BRA",
    attack: 84,
    defense: 78,
    form: 76,
    fitness: 75,
    possession: 82,
    press: 73,
    injurySafety: 68,
    xgFor: 1.74,
    xgAgainst: 1.08,
    recent: ["平", "负", "胜", "胜", "平"],
    players: buildPlayers(59)
  },
  {
    id: "nat-eng",
    name: "England",
    kind: "national",
    league: "国家队",
    country: "英格兰",
    continent: "欧洲",
    tier: "顶级",
    badge: "ENG",
    attack: 83,
    defense: 82,
    form: 79,
    fitness: 82,
    possession: 78,
    press: 80,
    injurySafety: 74,
    xgFor: 1.82,
    xgAgainst: 0.98,
    recent: ["胜", "平", "负", "胜", "胜"],
    players: buildPlayers(61)
  },
  {
    id: "nat-jpn",
    name: "Japan",
    kind: "national",
    league: "国家队",
    country: "日本",
    continent: "亚洲",
    tier: "竞争级",
    badge: "JPN",
    attack: 76,
    defense: 75,
    form: 81,
    fitness: 85,
    possession: 74,
    press: 82,
    injurySafety: 80,
    xgFor: 1.48,
    xgAgainst: 1.02,
    recent: ["胜", "胜", "平", "胜", "胜"],
    players: buildPlayers(67)
  },
  {
    id: "nat-chn",
    name: "China",
    kind: "national",
    league: "国家队",
    country: "中国",
    continent: "亚洲",
    tier: "发展级",
    badge: "CHN",
    attack: 61,
    defense: 64,
    form: 58,
    fitness: 73,
    possession: 60,
    press: 62,
    injurySafety: 76,
    xgFor: 0.92,
    xgAgainst: 1.46,
    recent: ["负", "平", "胜", "负", "平"],
    players: buildPlayers(71)
  }
];

type CatalogTeamSeed = {
  id: string;
  name: string;
  kind: TeamKind;
  league: string;
  country: string;
  continent: string;
  tier: string;
  badge: string;
};

const expandedTeamSeeds: CatalogTeamSeed[] = [
  { id: "club-che", name: "Chelsea", kind: "club", league: "英超", country: "英格兰", continent: "欧洲", tier: "一线", badge: "CHE" },
  { id: "club-mun", name: "Manchester United", kind: "club", league: "英超", country: "英格兰", continent: "欧洲", tier: "一线", badge: "MU" },
  { id: "club-tot", name: "Tottenham Hotspur", kind: "club", league: "英超", country: "英格兰", continent: "欧洲", tier: "一线", badge: "TOT" },
  { id: "club-new", name: "Newcastle United", kind: "club", league: "英超", country: "英格兰", continent: "欧洲", tier: "竞争级", badge: "NEW" },
  { id: "club-avl", name: "Aston Villa", kind: "club", league: "英超", country: "英格兰", continent: "欧洲", tier: "竞争级", badge: "AVL" },
  { id: "club-bar", name: "Barcelona", kind: "club", league: "西甲", country: "西班牙", continent: "欧洲", tier: "顶级", badge: "BAR" },
  { id: "club-atm", name: "Atletico Madrid", kind: "club", league: "西甲", country: "西班牙", continent: "欧洲", tier: "一线", badge: "ATM" },
  { id: "club-sev", name: "Sevilla", kind: "club", league: "西甲", country: "西班牙", continent: "欧洲", tier: "竞争级", badge: "SEV" },
  { id: "club-rso", name: "Real Sociedad", kind: "club", league: "西甲", country: "西班牙", continent: "欧洲", tier: "竞争级", badge: "RSO" },
  { id: "club-vil", name: "Villarreal", kind: "club", league: "西甲", country: "西班牙", continent: "欧洲", tier: "竞争级", badge: "VIL" },
  { id: "club-int", name: "Inter Milan", kind: "club", league: "意甲", country: "意大利", continent: "欧洲", tier: "顶级", badge: "INT" },
  { id: "club-acm", name: "AC Milan", kind: "club", league: "意甲", country: "意大利", continent: "欧洲", tier: "一线", badge: "ACM" },
  { id: "club-juv", name: "Juventus", kind: "club", league: "意甲", country: "意大利", continent: "欧洲", tier: "一线", badge: "JUV" },
  { id: "club-nap", name: "Napoli", kind: "club", league: "意甲", country: "意大利", continent: "欧洲", tier: "一线", badge: "NAP" },
  { id: "club-rom", name: "AS Roma", kind: "club", league: "意甲", country: "意大利", continent: "欧洲", tier: "竞争级", badge: "ROM" },
  { id: "club-dor", name: "Borussia Dortmund", kind: "club", league: "德甲", country: "德国", continent: "欧洲", tier: "一线", badge: "BVB" },
  { id: "club-rbl", name: "RB Leipzig", kind: "club", league: "德甲", country: "德国", continent: "欧洲", tier: "一线", badge: "RBL" },
  { id: "club-lev", name: "Bayer Leverkusen", kind: "club", league: "德甲", country: "德国", continent: "欧洲", tier: "顶级", badge: "B04" },
  { id: "club-efr", name: "Eintracht Frankfurt", kind: "club", league: "德甲", country: "德国", continent: "欧洲", tier: "竞争级", badge: "SGE" },
  { id: "club-om", name: "Marseille", kind: "club", league: "法甲", country: "法国", continent: "欧洲", tier: "一线", badge: "OM" },
  { id: "club-mon", name: "Monaco", kind: "club", league: "法甲", country: "法国", continent: "欧洲", tier: "一线", badge: "ASM" },
  { id: "club-lyo", name: "Lyon", kind: "club", league: "法甲", country: "法国", continent: "欧洲", tier: "竞争级", badge: "LYO" },
  { id: "club-lil", name: "Lille", kind: "club", league: "法甲", country: "法国", continent: "欧洲", tier: "竞争级", badge: "LIL" },
  { id: "club-ben", name: "Benfica", kind: "club", league: "葡超", country: "葡萄牙", continent: "欧洲", tier: "一线", badge: "BEN" },
  { id: "club-por", name: "Porto", kind: "club", league: "葡超", country: "葡萄牙", continent: "欧洲", tier: "一线", badge: "POR" },
  { id: "club-scp", name: "Sporting CP", kind: "club", league: "葡超", country: "葡萄牙", continent: "欧洲", tier: "一线", badge: "SCP" },
  { id: "club-aja", name: "Ajax", kind: "club", league: "荷甲", country: "荷兰", continent: "欧洲", tier: "一线", badge: "AJA" },
  { id: "club-psv", name: "PSV Eindhoven", kind: "club", league: "荷甲", country: "荷兰", continent: "欧洲", tier: "一线", badge: "PSV" },
  { id: "club-fey", name: "Feyenoord", kind: "club", league: "荷甲", country: "荷兰", continent: "欧洲", tier: "一线", badge: "FEY" },
  { id: "club-hil", name: "Al Hilal", kind: "club", league: "沙特联", country: "沙特阿拉伯", continent: "亚洲", tier: "一线", badge: "HIL" },
  { id: "club-nas", name: "Al Nassr", kind: "club", league: "沙特联", country: "沙特阿拉伯", continent: "亚洲", tier: "一线", badge: "NAS" },
  { id: "club-shp", name: "Shanghai Port", kind: "club", league: "中超", country: "中国", continent: "亚洲", tier: "竞争级", badge: "SIPG" },
  { id: "club-sdt", name: "Shandong Taishan", kind: "club", league: "中超", country: "中国", continent: "亚洲", tier: "竞争级", badge: "SDT" },
  { id: "club-bjg", name: "Beijing Guoan", kind: "club", league: "中超", country: "中国", continent: "亚洲", tier: "竞争级", badge: "BJG" },
  { id: "club-shs", name: "Shanghai Shenhua", kind: "club", league: "中超", country: "中国", continent: "亚洲", tier: "竞争级", badge: "SHS" },
  { id: "club-vko", name: "Vissel Kobe", kind: "club", league: "J1 League", country: "日本", continent: "亚洲", tier: "竞争级", badge: "VK" },
  { id: "club-ura", name: "Urawa Red Diamonds", kind: "club", league: "J1 League", country: "日本", continent: "亚洲", tier: "竞争级", badge: "URD" },
  { id: "club-yfm", name: "Yokohama F. Marinos", kind: "club", league: "J1 League", country: "日本", continent: "亚洲", tier: "竞争级", badge: "YFM" },
  { id: "club-uls", name: "Ulsan HD", kind: "club", league: "K League 1", country: "韩国", continent: "亚洲", tier: "竞争级", badge: "ULS" },
  { id: "club-jbk", name: "Jeonbuk Hyundai Motors", kind: "club", league: "K League 1", country: "韩国", continent: "亚洲", tier: "竞争级", badge: "JEO" },
  { id: "club-mia", name: "Inter Miami", kind: "club", league: "MLS", country: "美国", continent: "北美洲", tier: "竞争级", badge: "MIA" },
  { id: "nat-esp", name: "Spain", kind: "national", league: "国家队", country: "西班牙", continent: "欧洲", tier: "顶级", badge: "ESP" },
  { id: "nat-ger", name: "Germany", kind: "national", league: "国家队", country: "德国", continent: "欧洲", tier: "顶级", badge: "GER" },
  { id: "nat-por", name: "Portugal", kind: "national", league: "国家队", country: "葡萄牙", continent: "欧洲", tier: "顶级", badge: "POR" },
  { id: "nat-ned", name: "Netherlands", kind: "national", league: "国家队", country: "荷兰", continent: "欧洲", tier: "顶级", badge: "NED" },
  { id: "nat-ita", name: "Italy", kind: "national", league: "国家队", country: "意大利", continent: "欧洲", tier: "一线", badge: "ITA" },
  { id: "nat-bel", name: "Belgium", kind: "national", league: "国家队", country: "比利时", continent: "欧洲", tier: "一线", badge: "BEL" },
  { id: "nat-cro", name: "Croatia", kind: "national", league: "国家队", country: "克罗地亚", continent: "欧洲", tier: "一线", badge: "CRO" },
  { id: "nat-uru", name: "Uruguay", kind: "national", league: "国家队", country: "乌拉圭", continent: "南美洲", tier: "一线", badge: "URU" },
  { id: "nat-col", name: "Colombia", kind: "national", league: "国家队", country: "哥伦比亚", continent: "南美洲", tier: "一线", badge: "COL" },
  { id: "nat-mex", name: "Mexico", kind: "national", league: "国家队", country: "墨西哥", continent: "北美洲", tier: "竞争级", badge: "MEX" },
  { id: "nat-usa", name: "United States", kind: "national", league: "国家队", country: "美国", continent: "北美洲", tier: "竞争级", badge: "USA" },
  { id: "nat-mar", name: "Morocco", kind: "national", league: "国家队", country: "摩洛哥", continent: "非洲", tier: "一线", badge: "MAR" },
  { id: "nat-sen", name: "Senegal", kind: "national", league: "国家队", country: "塞内加尔", continent: "非洲", tier: "竞争级", badge: "SEN" },
  { id: "nat-kor", name: "South Korea", kind: "national", league: "国家队", country: "韩国", continent: "亚洲", tier: "竞争级", badge: "KOR" },
  { id: "nat-aus", name: "Australia", kind: "national", league: "国家队", country: "澳大利亚", continent: "亚洲", tier: "竞争级", badge: "AUS" },
  { id: "nat-irn", name: "Iran", kind: "national", league: "国家队", country: "伊朗", continent: "亚洲", tier: "竞争级", badge: "IRN" }
];

function createCatalogTeam(seedTeam: CatalogTeamSeed, index: number): TeamProfile {
  const seed = Array.from(seedTeam.name).reduce((total, char) => total + char.charCodeAt(0), index * 13);
  const tierBoost = seedTeam.tier === "顶级" ? 10 : seedTeam.tier === "一线" ? 6 : seedTeam.tier === "竞争级" ? 2 : 0;
  const base = seedTeam.kind === "national" ? 64 : 66;

  return {
    ...seedTeam,
    attack: Math.min(92, base + tierBoost + (seed % 13)),
    defense: Math.min(90, base + tierBoost + ((seed >> 2) % 12)),
    form: Math.min(88, 60 + tierBoost + ((seed >> 3) % 18)),
    fitness: Math.min(90, 62 + tierBoost + ((seed >> 4) % 18)),
    possession: Math.min(90, 60 + tierBoost + ((seed >> 5) % 19)),
    press: Math.min(90, 58 + tierBoost + ((seed >> 6) % 20)),
    injurySafety: Math.min(88, 62 + ((seed >> 7) % 20)),
    xgFor: Number((1.05 + tierBoost / 18 + (seed % 72) / 100).toFixed(2)),
    xgAgainst: Number((0.78 + ((seed >> 3) % 76) / 100).toFixed(2)),
    recent: Array.from({ length: 5 }, (_, recentIndex) => ["胜", "平", "负", "胜", "胜"][(seed + recentIndex) % 5]),
    players: buildPlayers(seed)
  };
}

const expandedTeamCatalog = expandedTeamSeeds.map(createCatalogTeam);
const baseTeamCatalog = [...teamCatalog, ...expandedTeamCatalog];

const sampleMatches = [
  { teamA: "Manchester City", teamB: "Real Madrid", competition: "俱乐部杯赛" },
  { teamA: "Argentina", teamB: "France", competition: "国家队赛事" },
  { teamA: "Arsenal", teamB: "Liverpool", competition: "英超" }
];

const samplePlayerCsv = `name,role,status,form,goals,assists,defense,minutes,note
核心前锋,Forward,ready,88,10,4,42,86,近期进攻参与度高
组织中场,Midfielder,ready,82,2,8,64,84,传球和节奏控制稳定
防守中场,Midfielder,doubt,74,1,3,81,62,轻微疲劳，赛前待评估
中后卫,Defender,ready,79,1,1,88,91,防空和解围稳定
门将,Goalkeeper,ready,83,0,0,76,100,扑救状态良好`;

function currency(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`;
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function getHomeLabel(form: FormState) {
  if (form.homeTeam === "team_a") return `${form.teamA || "球队 A"} 主场`;
  if (form.homeTeam === "team_b") return `${form.teamB || "球队 B"} 主场`;
  return "中立场";
}

function teamKey(team: TeamProfile) {
  return `${team.name.toLowerCase()}::${team.kind}`;
}

function mergeTeamCatalogs(liveTeams: TeamProfile[]) {
  const map = new Map<string, TeamProfile>();
  [...liveTeams, ...baseTeamCatalog].forEach((team) => {
    const key = teamKey(team);
    if (!map.has(key)) {
      map.set(key, team);
    }
  });
  return Array.from(map.values());
}

function mergeLiveTeams(current: TeamProfile[], incoming: TeamProfile[]) {
  const map = new Map<string, TeamProfile>();
  [...current, ...incoming].forEach((team) => {
    map.set(teamKey(team), team);
  });
  return Array.from(map.values());
}

function findTeam(name: string, teams: TeamProfile[] = baseTeamCatalog) {
  return teams.find((team) => team.name.toLowerCase() === name.trim().toLowerCase());
}

function fallbackTeam(name: string, slot: TeamSlot): TeamProfile {
  const seed = Array.from(name || slot).reduce((total, char) => total + char.charCodeAt(0), 0);
  return {
    id: `custom-${slot}`,
    name: name || (slot === "teamA" ? "球队 A" : "球队 B"),
    kind: "club",
    league: "待识别",
    country: "待识别",
    continent: "待识别",
    tier: "待识别",
    badge: slot === "teamA" ? "A" : "B",
    attack: 60 + (seed % 24),
    defense: 58 + (seed % 22),
    form: 56 + (seed % 28),
    fitness: 62 + (seed % 24),
    possession: 58 + (seed % 28),
    press: 55 + (seed % 29),
    injurySafety: 64 + (seed % 22),
    xgFor: 1.12 + (seed % 80) / 100,
    xgAgainst: 0.92 + (seed % 72) / 100,
    recent: ["待", "待", "待", "待", "待"],
    players: buildPlayers(seed)
  };
}

function getTeamProfile(name: string, slot: TeamSlot, teams: TeamProfile[] = baseTeamCatalog) {
  return findTeam(name, teams) ?? fallbackTeam(name, slot);
}

function extractNumber(report: string, label: string) {
  const match = report.match(new RegExp(`${label}[^0-9]*(\\d+)%`));
  return match ? Number(match[1]) : null;
}

function extractSummary(result: PredictionResponse | null, form: FormState): ProbabilitySummary {
  if (!result) {
    return { teamA: 0, draw: 0, teamB: 0, score: "待生成" };
  }

  const teamA = extractNumber(result.report, `${form.teamA} 胜率`) ?? 0;
  const draw = extractNumber(result.report, "平局概率") ?? 0;
  const teamB = extractNumber(result.report, `${form.teamB} 胜率`) ?? Math.max(0, 100 - teamA - draw);
  const score = result.report.match(/倾向比分：([^\n]+)/)?.[1]?.trim() ?? "待生成";

  return { teamA, draw, teamB, score };
}

function statusLabel(status: PlayerStatus["status"]) {
  const labels = {
    ready: "可出场",
    doubt: "待评估",
    injured: "伤缺",
    suspended: "停赛"
  };
  return labels[status];
}

function normalizePlayerStatus(value: unknown): PlayerStatus["status"] | null {
  const text = String(value ?? "").trim().toLowerCase();
  const map: Record<string, PlayerStatus["status"]> = {
    ready: "ready",
    "可出场": "ready",
    "健康": "ready",
    doubt: "doubt",
    doubtful: "doubt",
    "待评估": "doubt",
    "出场成疑": "doubt",
    injured: "injured",
    injury: "injured",
    "伤缺": "injured",
    "受伤": "injured",
    suspended: "suspended",
    "停赛": "suspended"
  };

  return map[text] ?? null;
}

function boundedNumber(value: unknown, fallback: number, min = 0, max = 100) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeImportedPlayer(row: Record<string, unknown>, index: number): PlayerStatus {
  const status = normalizePlayerStatus(row.status ?? row["状态"]) ?? "ready";
  const name = String(row.name ?? row["姓名"] ?? "").trim();
  const role = String(row.role ?? row["位置"] ?? "").trim();

  if (!name) {
    throw new Error(`第 ${index + 1} 行缺少 name/姓名。`);
  }

  if (!role) {
    throw new Error(`第 ${index + 1} 行缺少 role/位置。`);
  }

  return {
    name,
    role,
    status,
    form: boundedNumber(row.form ?? row["状态分"], 70),
    goals: boundedNumber(row.goals ?? row["进球"], 0, 0, 99),
    assists: boundedNumber(row.assists ?? row["助攻"], 0, 0, 99),
    defense: boundedNumber(row.defense ?? row["防守"], 60),
    minutes: boundedNumber(row.minutes ?? row["预计出场"], 75),
    note: String(row.note ?? row["备注"] ?? "导入数据，等待真实来源验证。").trim()
  };
}

function parsePlayerImport(raw: string): PlayerStatus[] {
  const text = raw.trim();

  if (!text) {
    throw new Error("请先粘贴 CSV/JSON 数据，或上传文件。");
  }

  if (text.startsWith("[") || text.startsWith("{")) {
    const parsed = JSON.parse(text) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { players?: unknown }).players)
        ? (parsed as { players: unknown[] }).players
        : null;

    if (!rows) {
      throw new Error("JSON 需要是球员数组，或包含 players 数组。");
    }

    return rows.map((row, index) => normalizeImportedPlayer(row as Record<string, unknown>, index));
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV 至少需要表头和一行球员数据。");
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? ""]));
    return normalizeImportedPlayer(row, index);
  });
}

function renderWorkflowIcon(status: WorkflowStep["status"]) {
  if (status === "complete") return <CheckCircle2 size={16} aria-hidden="true" />;
  if (status === "blocked") return <ShieldAlert size={16} aria-hidden="true" />;
  return <CircleDashed size={16} aria-hidden="true" />;
}

function reportNodes(report: string) {
  return report.split("\n").map((line, index) => {
    if (line.startsWith("# ")) {
      return (
        <h3 className="report-title" key={`${line}-${index}`}>
          {line.replace("# ", "")}
        </h3>
      );
    }

    if (line.startsWith("## ")) {
      return (
        <h4 className="report-heading" key={`${line}-${index}`}>
          {line.replace("## ", "")}
        </h4>
      );
    }

    if (line.startsWith("- ")) {
      return (
        <p className="report-line report-bullet" key={`${line}-${index}`}>
          {line.replace("- ", "")}
        </p>
      );
    }

    if (/^\d+\.\s/.test(line)) {
      return (
        <p className="report-line report-numbered" key={`${line}-${index}`}>
          {line}
        </p>
      );
    }

    if (!line.trim()) {
      return <div className="report-gap" key={`gap-${index}`} />;
    }

    return (
      <p className="report-line" key={`${line}-${index}`}>
        {line}
      </p>
    );
  });
}

function TeamBadge({ team }: { team: TeamProfile }) {
  const [failedImageUrl, setFailedImageUrl] = useState("");
  const flag = teamFlag(team);
  const flagCode = teamFlagImageCode(team);
  const showNationalFlag = team.kind === "national" && Boolean(flagCode || flag);
  const showClubFlagCorner = team.kind === "club" && Boolean(flagCode || flag);
  const badgeImageUrl = proxiedTeamBadgeUrl(team.badgeUrl);
  const showClubBadgeImage = team.kind === "club" && Boolean(badgeImageUrl) && failedImageUrl !== badgeImageUrl;

  return (
    <div className={`team-badge ${team.kind} ${flag ? "has-country-flag" : ""} ${showNationalFlag ? "flag-as-main" : ""}`}>
      {showNationalFlag ? (
        <span className="flag-main" role="img" aria-label={`${team.country}旗帜`}>
          {flagCode ? <img src={flagImageUrl(flagCode, 80)} alt={`${team.country || team.name}旗帜`} loading="eager" decoding="async" /> : flag}
        </span>
      ) : showClubBadgeImage ? (
        <img
          src={badgeImageUrl}
          alt={`${team.name}队徽`}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedImageUrl(badgeImageUrl)}
        />
      ) : (
        <span className="badge-text">{team.badge}</span>
      )}
      {showClubFlagCorner ? (
        <i className="flag-corner" role="img" aria-label={`${team.country}旗帜`}>
          {flagCode ? <img src={flagImageUrl(flagCode, 40)} alt={`${team.country || team.name}旗帜`} loading="eager" decoding="async" /> : flag}
        </i>
      ) : null}
    </div>
  );
}

function TeamCountryFlag({ team, compact = false }: { team: TeamProfile; compact?: boolean }) {
  const flag = teamFlag(team);
  const flagCode = teamFlagImageCode(team);
  if (!flagCode && !flag) return null;

  return (
    <i className={`country-flag ${compact ? "compact" : ""}`} role="img" aria-label={`${team.country || team.name}旗帜`}>
      {flagCode ? <img src={flagImageUrl(flagCode, 40)} alt={`${team.country || team.name}旗帜`} loading="eager" decoding="async" /> : flag}
    </i>
  );
}

function playerInitials(name: string) {
  const tokens = name.trim().split(/[\s.-]+/).filter(Boolean);
  if (tokens.length >= 2) return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "P";
}

function PlayerAvatar({ player, size = "md" }: { player: PlayerStatus; size?: "sm" | "md" | "lg" }) {
  const [failedImageUrl, setFailedImageUrl] = useState("");
  const src = player.avatarUrl?.trim();

  return (
    <span className={`player-avatar ${size}`}>
      {src && failedImageUrl !== src ? (
        <img
          src={src}
          alt={`${player.name}照片`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedImageUrl(src)}
        />
      ) : (
        <b>{playerInitials(player.name)}</b>
      )}
    </span>
  );
}

function MetricBar({ label, value, tone = "green" }: { label: string; value: number; tone?: "green" | "blue" | "amber" }) {
  return (
    <div className="metric-bar">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className={`metric-track ${tone}`}>
        <i style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ComparisonRow({
  label,
  left,
  right
}: {
  label: string;
  left: number;
  right: number;
}) {
  const total = Math.max(left + right, 1);
  const leftWidth = Math.max(6, (left / total) * 100);
  const rightWidth = Math.max(6, (right / total) * 100);

  return (
    <div className="comparison-row">
      <div className="comparison-head">
        <strong>{left}</strong>
        <span>{label}</span>
        <strong>{right}</strong>
      </div>
      <div className="comparison-track">
        <i className="left" style={{ width: `${leftWidth}%` }} />
        <i className="right" style={{ width: `${rightWidth}%` }} />
      </div>
    </div>
  );
}

function MatchVisualDashboard({
  teamA,
  teamB,
  probability,
  eventData,
  eventLoading,
  onImportEvents
}: {
  teamA: TeamProfile;
  teamB: TeamProfile;
  probability: ProbabilitySummary;
  eventData: PlayerEventDataResponse | null;
  eventLoading: boolean;
  onImportEvents: () => void;
}) {
  const drawEnd = probability.teamA + probability.draw;
  const eventSummary = eventData?.summary;
  const metricsVerified = teamA.metricsStatus === "verified" && teamB.metricsStatus === "verified";
  const teamAThreat = metricsVerified ? clampMetric(teamA.attack * 0.42 + teamA.press * 0.25 + teamA.xgFor * 12, 18, 88) : 0;
  const teamBThreat = metricsVerified ? clampMetric(teamB.attack * 0.42 + teamB.press * 0.25 + teamB.xgFor * 12, 18, 88) : 0;
  const teamABalance = metricsVerified ? clampMetric((teamA.attack + teamA.defense + teamA.form) / 3) : 0;
  const teamBBalance = metricsVerified ? clampMetric((teamB.attack + teamB.defense + teamB.form) / 3) : 0;

  return (
    <div className="visual-dashboard">
      <div className="visual-card probability-visual">
        <div
          className="probability-donut"
          style={{
            background: `conic-gradient(var(--green) 0 ${probability.teamA}%, var(--amber) ${probability.teamA}% ${drawEnd}%, var(--blue) ${drawEnd}% 100%)`
          }}
        >
          <div>
            <strong>{probability.teamA}%</strong>
            <span>{teamA.name}</span>
          </div>
        </div>
        <div className="visual-legend">
          <span>
            <i className="green" />
            {teamA.name} {probability.teamA}%
          </span>
          <span>
            <i className="amber" />
            平局 {probability.draw}%
          </span>
          <span>
            <i className="blue" />
            {teamB.name} {probability.teamB}%
          </span>
        </div>
      </div>

      <div className="visual-card pitch-visual-card">
        <div className="pitch-visual">
          <div className="pitch-half left" style={{ width: `${teamAThreat}%` }} />
          <div className="pitch-half right" style={{ width: `${teamBThreat}%` }} />
          <div className="pitch-axis" />
          <div className="pitch-team-chip left">
            <TeamBadge team={teamA} />
            <span>{metricsVerified ? teamA.attack : "--"}</span>
          </div>
          <div className="pitch-team-chip right">
            <span>{metricsVerified ? teamB.attack : "--"}</span>
            <TeamBadge team={teamB} />
          </div>
          <b>{probability.score}</b>
        </div>
        <div className="pitch-data-row">
          <span>进攻势能 {metricsVerified ? `${teamA.attack} / ${teamB.attack}` : "待核验"}</span>
          <span>压迫 {metricsVerified ? `${teamA.press} / ${teamB.press}` : "待核验"}</span>
          <span>xG {metricsVerified ? `${teamA.xgFor.toFixed(2)} / ${teamB.xgFor.toFixed(2)}` : "待核验"}</span>
        </div>
      </div>

      <div className="visual-card data-visual-card">
        <div className="data-visual-head">
          <div>
            <span>事件数据</span>
            <strong>{eventSummary ? `${eventSummary.totalEvents} 条` : "待获取"}</strong>
          </div>
          <button type="button" onClick={onImportEvents} disabled={eventLoading}>
            {eventLoading ? <RefreshCw className="spin" size={14} aria-hidden="true" /> : <Database size={14} aria-hidden="true" />}
            {eventLoading ? "获取中" : "获取"}
          </button>
        </div>
        <div className="data-visual-bars">
          <div>
            <span>综合均衡</span>
            <b>{metricsVerified ? teamABalance : "--"}</b>
            <i style={{ width: `${teamABalance}%` }} />
          </div>
          <div>
            <span>对手均衡</span>
            <b>{metricsVerified ? teamBBalance : "--"}</b>
            <i className="blue" style={{ width: `${teamBBalance}%` }} />
          </div>
          <div>
            <span>{eventSummary ? "射门 / 防守事件" : "事件样本"}</span>
            <b>
              {eventSummary
                ? `${eventSummary.shots} / ${eventSummary.tackles + eventSummary.blocks + eventSummary.interceptions}`
                : "未载入"}
            </b>
            <i className="amber" style={{ width: `${eventSummary ? 82 : 22}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function eventImpactScore(player: EventPlayerProfile) {
  return (
    player.xg * 12 +
    player.goals * 8 +
    player.shotsOnTarget * 4 +
    player.shots * 2 +
    player.tacklesWon * 3 +
    player.blocks * 2.5 +
    player.interceptions * 2.5 +
    player.dribblesCompleted * 2 +
    player.saves * 3 -
    player.dribbledPast * 1.5
  );
}

function formatEventNumber(value: number | undefined, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "0.00";
}

function preferredFootLabel(value: EventPlayerProfile["preferredFoot"]) {
  if (value === "left") return "左脚";
  if (value === "right") return "右脚";
  if (value === "both") return "双脚";
  return "未知";
}

function clampMetric(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function textSeed(text: string) {
  return Array.from(text).reduce((total, char) => total + char.charCodeAt(0), 0);
}

function playerHeight(player: PlayerStatus) {
  const role = player.role.toLowerCase();
  const base = role.includes("goal") ? 190 : role.includes("def") || player.defense > 78 ? 186 : role.includes("forward") ? 182 : 178;
  return base + (textSeed(player.name) % 9) - 4;
}

function pickPlayer(team: TeamProfile, roleHints: string[], fallbackIndex: number) {
  const player = team.players.find((item) => {
    const role = item.role.toLowerCase();
    return roleHints.some((hint) => role.includes(hint));
  });
  return player ?? team.players[fallbackIndex % team.players.length] ?? team.players[0];
}

function buildMatchupInsights(teamA: TeamProfile, teamB: TeamProfile): MatchupInsight[] {
  const aForward = pickPlayer(teamA, ["forward", "winger", "striker", "前锋"], 0);
  const bForward = pickPlayer(teamB, ["forward", "winger", "striker", "前锋"], 0);
  const aDefender = pickPlayer(teamA, ["defender", "back", "中后卫", "后卫"], 3);
  const bDefender = pickPlayer(teamB, ["defender", "back", "中后卫", "后卫"], 3);
  const aMid = pickPlayer(teamA, ["mid", "中场"], 1);
  const bMid = pickPlayer(teamB, ["mid", "中场"], 1);

  const rows = [
    {
      id: "a-attack",
      title: `${teamA.name} 前场冲击`,
      attacker: aForward,
      defender: bDefender
    },
    {
      id: "b-attack",
      title: `${teamB.name} 前场冲击`,
      attacker: bForward,
      defender: aDefender
    },
    {
      id: "midfield",
      title: "中场压制对位",
      attacker: aMid,
      defender: bMid
    }
  ];

  return rows.map((row) => {
    const attackValue = clampMetric(row.attacker.form * 0.56 + row.attacker.goals * 2.4 + row.attacker.assists * 2.1);
    const defenseValue = clampMetric(row.defender.defense * 0.72 + row.defender.minutes * 0.18);
    const aerialEdge = playerHeight(row.attacker) - playerHeight(row.defender);
    const edge = attackValue - defenseValue;

    return {
      ...row,
      attackValue,
      defenseValue,
      aerialEdge,
      note:
        edge > 8
          ? "进攻端有制造一对一压力的空间。"
          : edge < -8
            ? "防守端对抗和封堵占优。"
            : "对位接近，临场状态会放大影响。"
    };
  });
}

function buildKeeperPenaltyInsight(teamA: TeamProfile, teamB: TeamProfile): KeeperPenaltyInsight[] {
  const pairs = [
    {
      keeper: pickPlayer(teamB, ["goal", "门将"], 4),
      shooter: pickPlayer(teamA, ["forward", "winger", "striker", "前锋"], 0)
    },
    {
      keeper: pickPlayer(teamA, ["goal", "门将"], 4),
      shooter: pickPlayer(teamB, ["forward", "winger", "striker", "前锋"], 0)
    }
  ];

  return pairs.map(({ keeper, shooter }) => {
    const seed = textSeed(`${keeper.name}:${shooter.name}`);
    return {
      keeper,
      shooter,
      saveValue: clampMetric(keeper.defense * 0.66 + keeper.form * 0.22 + (seed % 8)),
      shotValue: clampMetric(shooter.form * 0.58 + shooter.goals * 3.2 + shooter.minutes * 0.12),
      penaltySave: clampMetric(13 + (seed % 22), 5, 45),
      penaltyScore: clampMetric(66 + ((seed >> 2) % 23), 50, 92)
    };
  });
}

function buildTacticalChains(teamA: TeamProfile, teamB: TeamProfile): TacticalChain[] {
  const aAerial = clampMetric(teamA.attack * 0.45 + teamA.press * 0.18 + playerHeight(pickPlayer(teamA, ["forward", "striker", "前锋"], 0)) * 0.18 - 25);
  const bAerialDef = clampMetric(teamB.defense * 0.5 + playerHeight(pickPlayer(teamB, ["defender", "back", "后卫"], 3)) * 0.2 - 24);
  const bPress = clampMetric(teamB.press * 0.62 + teamB.form * 0.2);
  const aBuild = clampMetric(teamA.possession * 0.54 + teamA.fitness * 0.16);
  const aTransition = clampMetric(teamA.fitness * 0.4 + teamA.attack * 0.35);
  const bLineRecovery = clampMetric(teamB.defense * 0.4 + teamB.fitness * 0.32);

  return [
    {
      id: "aerial",
      trigger: "传中/吊顶战术",
      attackLabel: `${teamA.name} 高空冲击`,
      defenseLabel: `${teamB.name} 防空`,
      attackValue: aAerial,
      defenseValue: bAerialDef,
      verdict: aAerial > bAerialDef ? "传中点可能形成错位。" : "防空端能缓冲高球压力。"
    },
    {
      id: "press",
      trigger: "高位压迫",
      attackLabel: `${teamB.name} 压迫`,
      defenseLabel: `${teamA.name} 后场出球`,
      attackValue: bPress,
      defenseValue: aBuild,
      verdict: bPress > aBuild ? "后场出球会被重点考验。" : "控球出球能化解部分压迫。"
    },
    {
      id: "transition",
      trigger: "身后反击",
      attackLabel: `${teamA.name} 冲刺转换`,
      defenseLabel: `${teamB.name} 回追`,
      attackValue: aTransition,
      defenseValue: bLineRecovery,
      verdict: aTransition > bLineRecovery ? "防线身后空间需要重点保护。" : "回追和站位能降低反击威胁。"
    }
  ];
}

function buildCoachProfiles(teamA: TeamProfile, teamB: TeamProfile): CoachProfile[] {
  return [teamA, teamB].map((team) => {
    const seed = textSeed(team.name);
    const flexibility = clampMetric(54 + (seed % 31) + (team.form - 70) * 0.25);
    const substitution = clampMetric(50 + ((seed >> 2) % 34) + (team.fitness - 70) * 0.2);
    const gameState = clampMetric((flexibility + substitution + team.press * 0.45) / 2.45);

    return {
      teamName: team.name,
      flexibility,
      substitution,
      gameState,
      risk:
        gameState >= 78
          ? "调整空间较大"
          : gameState >= 64
            ? "调整能力中等"
            : "临场变化偏保守"
    };
  });
}

function PlayerCard({ player, onOpen }: { player: PlayerStatus; onOpen: () => void }) {
  const verified = player.metricsStatus === "verified" || player.metricsStatus === "user-imported";
  return (
    <div className={`player-card ${player.status}`}>
      <div className="player-card-top">
        <div className="player-card-identity">
          <PlayerAvatar player={player} />
          <div>
            <strong>{player.name}</strong>
            <span>{player.role}</span>
          </div>
        </div>
        <button type="button" onClick={onOpen}>
          {statusLabel(player.status)}
        </button>
      </div>
      <div className="player-stats">
        <span>状态 {verified ? player.form : "--"}</span>
        <span>进球 {verified ? player.goals : "--"}</span>
        <span>助攻 {verified ? player.assists : "--"}</span>
        <span>防守 {verified ? player.defense : "--"}</span>
      </div>
      {!verified ? (
        <span className="data-quality-tag">暂无核验统计</span>
      ) : null}
      <div className="player-meter">
        <i style={{ width: verified ? `${player.form}%` : "0%" }} />
      </div>
      <p>{player.note}</p>
    </div>
  );
}

function TeamRosterPreview({
  team,
  status,
  onOpenPlayer
}: {
  team: TeamProfile;
  status?: LiveImportStatus;
  onOpenPlayer: (player: PlayerStatus) => void;
}) {
  const players = team.players ?? [];

  return (
    <div className="team-roster-preview">
      <div className="team-roster-head">
        <div>
          <strong>球员详情</strong>
          <span>
            {status?.loading
              ? "正在补拉球员照片和真实名单"
              : players.length
                ? `${players.length} 名球员 / 点击球员看完整状态`
                : "暂无球员名单"}
          </span>
        </div>
        {team.metricsStatus === "verified" ? (
          <div className="team-roster-metrics">
            <span>进攻 {team.attack}</span>
            <span>防守 {team.defense}</span>
            <span>体能 {team.fitness}</span>
          </div>
        ) : null}
      </div>
      {team.metricsStatus !== "verified" ? (
        <div className="data-quality-note" role="note">
          名单和照片来自 {team.source || "公开元数据源"}；未核验的状态、进球、助攻和攻防评分不会展示。
        </div>
      ) : null}
      {status?.error ? <p className="team-roster-status error">{status.error}</p> : null}
      {status?.message ? <p className="team-roster-status">{status.message}</p> : null}

      {players.length ? (
        <div className="team-roster-grid">
          {players.map((player) => (
            <button className={`team-roster-player ${player.status}`} type="button" key={`${team.id}-${player.name}-${player.role}`} onClick={() => onOpenPlayer(player)}>
              <PlayerAvatar player={player} size="sm" />
              <span className="team-roster-player-main">
                <strong>{player.name}</strong>
                <em>{player.role}</em>
              </span>
              <span className="team-roster-player-data">
                <b>{statusLabel(player.status)}</b>
                <small>{player.metricsStatus === "verified" || player.metricsStatus === "user-imported" ? `状态 ${player.form} / 出场 ${player.minutes}%` : "暂无核验状态"}</small>
                <small>{player.metricsStatus === "verified" || player.metricsStatus === "user-imported" ? `进球 ${player.goals} / 助攻 ${player.assists} / 防守 ${player.defense}` : "统计待正式数据源补齐"}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="team-roster-empty">还没有该队球员数据。可以先联网导入，或在球员状态区手动导入名单。</p>
      )}
    </div>
  );
}

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [activeView, setActiveView] = useState<WorkspaceView>("teams");
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"estimate" | "predict" | "payment" | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [accountConfigured, setAccountConfigured] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [byokKey, setByokKey] = useState("");
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [runtimeMode, setRuntimeMode] = useState<"mock" | "live">("mock");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [expandedTeamKey, setExpandedTeamKey] = useState<string | null>(null);
  const [teamRosterFetch, setTeamRosterFetch] = useState<Record<string, LiveImportStatus>>({});
  const [playerOverrides, setPlayerOverrides] = useState<Partial<Record<TeamSlot, PlayerStatus[]>>>({});
  const [importTarget, setImportTarget] = useState<TeamSlot>("teamA");
  const [importText, setImportText] = useState(samplePlayerCsv);
  const [importError, setImportError] = useState<string | null>(null);
  const [liveTeams, setLiveTeams] = useState<TeamProfile[]>([]);
  const [liveImport, setLiveImport] = useState<LiveImportStatus>({
    loading: false,
    message: null,
    error: null
  });
  const [officialSources, setOfficialSources] = useState<OfficialSourcesResponse | null>(null);
  const [officialSourceStatus, setOfficialSourceStatus] = useState<LiveImportStatus>({
    loading: false,
    message: null,
    error: null
  });
  const [eventData, setEventData] = useState<PlayerEventDataResponse | null>(null);
  const [eventDataStatus, setEventDataStatus] = useState<LiveImportStatus>({
    loading: false,
    message: null,
    error: null
  });
  const [matchIntelligence, setMatchIntelligence] = useState<MatchIntelligenceResponse | null>(null);
  const [matchIntelligenceStatus, setMatchIntelligenceStatus] = useState<LiveImportStatus>({
    loading: false,
    message: null,
    error: null
  });
  const autoBadgeImportStarted = useRef(false);

  const workflow = result?.workflow ?? defaultWorkflow;
  const completedSteps = workflow.filter((step) => step.status === "complete").length;
  const reportProbability = extractSummary(result, form);
  const availableTeams = useMemo(() => mergeTeamCatalogs(liveTeams), [liveTeams]);
  const baseTeamAProfile = useMemo(() => getTeamProfile(form.teamA, "teamA", availableTeams), [form.teamA, availableTeams]);
  const baseTeamBProfile = useMemo(() => getTeamProfile(form.teamB, "teamB", availableTeams), [form.teamB, availableTeams]);
  const teamAProfile = useMemo(
    () => ({ ...baseTeamAProfile, players: playerOverrides.teamA ?? baseTeamAProfile.players }),
    [baseTeamAProfile, playerOverrides.teamA]
  );
  const teamBProfile = useMemo(
    () => ({ ...baseTeamBProfile, players: playerOverrides.teamB ?? baseTeamBProfile.players }),
    [baseTeamBProfile, playerOverrides.teamB]
  );
  const probability = reportProbability;
  const hasVerifiedTeamMetrics = teamAProfile.metricsStatus === "verified" && teamBProfile.metricsStatus === "verified";
  const matchupInsights = useMemo(
    () => hasVerifiedTeamMetrics ? buildMatchupInsights(teamAProfile, teamBProfile) : [],
    [hasVerifiedTeamMetrics, teamAProfile, teamBProfile]
  );
  const keeperPenaltyInsights = useMemo(
    () => hasVerifiedTeamMetrics ? buildKeeperPenaltyInsight(teamAProfile, teamBProfile) : [],
    [hasVerifiedTeamMetrics, teamAProfile, teamBProfile]
  );
  const tacticalChains = useMemo(
    () => hasVerifiedTeamMetrics ? buildTacticalChains(teamAProfile, teamBProfile) : [],
    [hasVerifiedTeamMetrics, teamAProfile, teamBProfile]
  );
  const coachProfiles = useMemo(
    () => hasVerifiedTeamMetrics ? buildCoachProfiles(teamAProfile, teamBProfile) : [],
    [hasVerifiedTeamMetrics, teamAProfile, teamBProfile]
  );
  const readyOfficialSources = useMemo(
    () => (officialSources?.providers ?? []).filter((provider) => ["ready", "open-data-ready"].includes(provider.runtimeStatus)),
    [officialSources]
  );
  const enabledAnalysisTools = useMemo(
    () => (officialSources?.analysisTools ?? []).filter((tool) => tool.configured),
    [officialSources]
  );
  const topEventPlayers = useMemo(
    () =>
      [...(eventData?.players ?? [])]
        .filter((player) => eventImpactScore(player) > 0)
        .sort((left, right) => eventImpactScore(right) - eventImpactScore(left))
        .slice(0, 6),
    [eventData]
  );
  const featuredEventPlayer = topEventPlayers.find((player) => player.heatmap.length > 0) ?? topEventPlayers[0] ?? null;
  const featuredHeatmapMax = Math.max(1, ...(featuredEventPlayer?.heatmap ?? []).map((point) => point.count));

  const leagues = useMemo(() => unique(availableTeams.map((team) => team.league)), [availableTeams]);
  const countries = useMemo(() => unique(availableTeams.map((team) => team.country)), [availableTeams]);
  const continents = useMemo(() => unique(availableTeams.map((team) => team.continent)), [availableTeams]);
  const tiers = useMemo(() => unique(availableTeams.map((team) => team.tier)), [availableTeams]);

  const filteredTeams = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    return availableTeams.filter((team) => {
      if (filters.mode !== "all" && team.kind !== filters.mode) return false;
      if (filters.league !== "all" && team.league !== filters.league) return false;
      if (filters.country !== "all" && team.country !== filters.country) return false;
      if (filters.continent !== "all" && team.continent !== filters.continent) return false;
      if (filters.tier !== "all" && team.tier !== filters.tier) return false;

      if (!keyword) return true;
      return [team.name, team.league, team.country, team.continent, team.tier]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [availableTeams, filters]);
  const activeFilterCount = [filters.search, filters.league, filters.country, filters.continent, filters.tier]
    .filter((value) => value && value !== "all").length + (filters.mode === "all" ? 0 : 1);
  const filteredClubCount = filteredTeams.filter((team) => team.kind === "club").length;
  const filteredNationalCount = filteredTeams.length - filteredClubCount;

  const payload = useMemo(
    () => ({
      ...form,
      maxUserChargeCents: Number(form.maxUserChargeCents),
      ...(paymentOrderId ? { paymentOrderId } : {})
    }),
    [form, paymentOrderId]
  );
  const workspaceTabs = useMemo(
    () => [
      { id: "teams" as WorkspaceView, icon: ListFilter, label: "选球队", meta: `${filteredTeams.length} 支` },
      { id: "match" as WorkspaceView, icon: CalendarClock, label: "比赛设置", meta: estimate ? currency(estimate.estimatedUserChargeCents) : "未估算" },
      { id: "analysis" as WorkspaceView, icon: BarChart3, label: "数据分析", meta: eventData ? "真实样本" : "待获取" },
      { id: "report" as WorkspaceView, icon: FileText, label: "报告", meta: result ? "已生成" : "待生成" }
    ],
    [eventData, estimate, filteredTeams.length, result]
  );

  useEffect(() => {
    void Promise.all([
      fetch("/api/auth/me").then((response) => response.json()),
      fetch("/api/health").then((response) => response.json())
    ]).then(([auth, health]) => {
      setAccountConfigured(Boolean(auth.configured));
      setAccountUser(auth.user ?? null);
      setRuntimeMode(health.providerMode === "live" ? "live" : "mock");
    }).catch(() => undefined);
    const order = new URLSearchParams(window.location.search).get("order");
    const payment = new URLSearchParams(window.location.search).get("payment");
    if (order && payment === "success") {
      setPaymentOrderId(order);
      setAccountMessage("支付已返回，系统将以Stripe Webhook最终确认结果为准。");
    }
  }, []);

  useEffect(() => {
    if (autoBadgeImportStarted.current) return;
    autoBadgeImportStarted.current = true;

    const controller = new AbortController();

    async function importBadgesOnLoad() {
      setLiveImport({ loading: true, message: "正在自动载入球队队徽和国旗", error: null });

      try {
        const cacheResponse = await fetch("/api/roster-cache", {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal
        });

        if (cacheResponse.ok) {
          const cached = (await cacheResponse.json()) as LiveTeamResponse;
          const cachedTeams = cached.teams ?? [];
          if (cached.ok && cachedTeams.length) {
            setLiveTeams((current) => mergeLiveTeams(current, cachedTeams));
            setLiveImport({
              loading: false,
              message: `${cached.storage === "supabase" ? "云端缓存" : "每日缓存"} · 已载入 ${cachedTeams.length} 支球队${cached.snapshot?.beijingDate ? `（${cached.snapshot.beijingDate}）` : ""}`,
              error: null
            });
            return;
          }
        }

        const response = await fetch("/api/live-team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "popular", includePlayers: false }),
          signal: controller.signal
        });
        const data = (await response.json()) as LiveTeamResponse;

        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "自动载入队徽失败。");
        }

        const teams = data.teams ?? [];
        setLiveTeams((current) => mergeLiveTeams(current, teams));
        setLiveImport({
          loading: false,
          message: `${data.source?.name ?? "数据源"} · 已自动载入 ${teams.length} 支球队队徽`,
          error: null
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setLiveImport({
          loading: false,
          message: null,
          error: err instanceof Error ? err.message : "自动载入队徽失败，可手动联网导入。"
        });
      }
    }

    void importBadgesOnLoad();

    return () => controller.abort();
  }, []);

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
    if (patch.teamA !== undefined || patch.teamB !== undefined) {
      setPlayerOverrides((current) => {
        const next = { ...current };
        if (patch.teamA !== undefined) delete next.teamA;
        if (patch.teamB !== undefined) delete next.teamB;
        return next;
      });
    }
    setResult(null);
    setError(null);
    setEventData(null);
    setEventDataStatus((current) => ({ ...current, message: null, error: null }));
  }

  function updateFilters(patch: Partial<FilterState>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function getLiveImportPayload() {
    const search = filters.search.trim();

    if (search.length >= 2) {
      return { mode: "search", query: search, includePlayers: true };
    }

    if (filters.league !== "all") {
      return { mode: "league", league: filters.league, includePlayers: false };
    }

    if (filters.country !== "all") {
      return { mode: "country", country: filters.country, includePlayers: false };
    }

    return { mode: "popular", includePlayers: false };
  }

  async function importLiveTeams() {
    setLiveImport({ loading: true, message: null, error: null });

    try {
      const response = await fetch("/api/live-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getLiveImportPayload())
      });
      const data = (await response.json()) as LiveTeamResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "联网导入失败。");
      }

      const teams = data.teams ?? [];
      if (!teams.length) {
        throw new Error("没有查到可导入的真实球队。");
      }

      setLiveTeams((current) => mergeLiveTeams(current, teams));
      setLiveImport({
        loading: false,
        message: `${data.source?.name ?? "数据源"} · 已导入 ${teams.length} 支球队`,
        error: null
      });
    } catch (err) {
      setLiveImport({
        loading: false,
        message: null,
        error: err instanceof Error ? err.message : "联网导入失败。"
      });
    }
  }

  async function ensureTeamRosterDetails(team: TeamProfile) {
    const key = teamKey(team);
    const hasPlayerPhotos = team.players.some((player) => Boolean(player.avatarUrl?.trim()));
    const currentStatus = teamRosterFetch[key];

    if (hasPlayerPhotos || currentStatus?.loading || currentStatus?.message) {
      return;
    }

    setTeamRosterFetch((current) => ({
      ...current,
      [key]: { loading: true, message: null, error: null }
    }));

    try {
      const response = await fetch("/api/live-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "search", query: team.name, includePlayers: true })
      });
      const data = (await response.json()) as LiveTeamResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "球员详情补拉失败。");
      }

      const teams = data.teams ?? [];
      const matchingTeam =
        teams.find((item) => teamKey(item) === key) ??
        teams.find((item) => item.name.toLowerCase() === team.name.toLowerCase()) ??
        teams[0];

      if (!matchingTeam?.players?.length) {
        throw new Error("未获取到该队球员照片，可稍后重试或导入球员数据。");
      }

      setLiveTeams((current) => mergeLiveTeams(current, teams));
      const photoCount = matchingTeam.players.filter((player) => Boolean(player.avatarUrl?.trim())).length;
      const providerUnavailable = data.notice?.toLowerCase().includes("provider unavailable") || data.source?.apiKeyMode === "cache";
      setTeamRosterFetch((current) => ({
        ...current,
        [key]: {
          loading: false,
          message: photoCount
            ? `已补充 ${matchingTeam.players.length} 名球员，含 ${photoCount} 张照片`
            : providerUnavailable
              ? `实时数据源暂不可用，先显示 ${matchingTeam.players.length} 名缓存球员`
              : `已补充 ${matchingTeam.players.length} 名球员`,
          error: null
        }
      }));
    } catch (err) {
      setTeamRosterFetch((current) => ({
        ...current,
        [key]: {
          loading: false,
          message: null,
          error: err instanceof Error ? err.message : "球员详情补拉失败。"
        }
      }));
    }
  }

  function toggleTeamDetails(team: TeamProfile) {
    const key = teamKey(team);
    setExpandedTeamKey((current) => (current === key ? null : key));
    if (expandedTeamKey !== key) {
      void ensureTeamRosterDetails(team);
    }
  }

  async function checkOfficialSources() {
    setOfficialSourceStatus({ loading: true, message: null, error: null });

    try {
      const response = await fetch("/api/sports-data-sources", {
        method: "GET",
        headers: { Accept: "application/json" }
      });
      const data = (await response.json()) as OfficialSourcesResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "正式数据源检查失败。");
      }

      setOfficialSources(data);
      setOfficialSourceStatus({
        loading: false,
        message: `已检查 ${data.providers?.length ?? 0} 个数据源 + ${data.analysisTools?.length ?? 0} 个 Python 工具`,
        error: null
      });
    } catch (err) {
      setOfficialSourceStatus({
        loading: false,
        message: null,
        error: err instanceof Error ? err.message : "正式数据源检查失败。"
      });
    }
  }

  async function importPlayerEventData() {
    setEventDataStatus({ loading: true, message: null, error: null });

    try {
      const canUseLiveSummary = matchIntelligence?.provider === "api-football" && Boolean(matchIntelligence.fixture?.id);
      const response = await fetch("/api/player-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(canUseLiveSummary
          ? { provider: "api-football", fixtureId: String(matchIntelligence?.fixture?.id) }
          : { provider: "statsbomb-open", matchId: "3869685" })
      });
      const data = (await response.json()) as PlayerEventDataResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "事件数据获取失败。");
      }

      setEventData(data);
      setActiveView("analysis");
      setEventDataStatus({
        loading: false,
        message: `${data.sourceName ?? "事件数据源"} / ${data.matchLabel ?? data.matchId ?? "样本比赛"} / ${
          data.coverageTier === "free-live-summary" ? "免费实时汇总" : data.coverageTier === "commercial-live-events" ? "商业完整事件" : "免费历史事件"
        }`,
        error: null
      });
    } catch (err) {
      setEventDataStatus({
        loading: false,
        message: null,
        error: err instanceof Error ? err.message : "事件数据获取失败。"
      });
    }
  }

  async function syncLiveMatchIntelligence() {
    setMatchIntelligenceStatus({ loading: true, message: "正在定位比赛并同步官方数据", error: null });

    try {
      const response = await fetch("/api/match-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamA: form.teamA,
          teamB: form.teamB,
          matchDate: form.matchDate,
          forceRefresh: Boolean(matchIntelligence)
        })
      });
      const data = (await response.json()) as MatchIntelligenceResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "真实比赛数据同步失败。");
      }

      setMatchIntelligence(data);
      setMatchIntelligenceStatus({
        loading: false,
        message: `${data.provider ? matchProviderLabels[data.provider] : "正式数据源"} 已同步 fixture ${data.fixture?.id ?? "-"}，阵容 ${data.coverage?.lineups ?? 0} 人，事件 ${data.coverage?.events ?? 0} 条，缓存 ${data.cache?.status ?? "miss"}`,
        error: null
      });
    } catch (syncError) {
      setMatchIntelligence(null);
      setMatchIntelligenceStatus({
        loading: false,
        message: null,
        error: syncError instanceof Error ? syncError.message : "真实比赛数据同步失败。"
      });
    }
  }

  function selectTeam(slot: TeamSlot, team: TeamProfile) {
    updateForm({
      [slot]: team.name,
      competition: form.competition || (team.kind === "club" ? team.league : "国家队赛事")
    } as Partial<FormState>);
  }

  function swapTeams() {
    setForm((current) => ({ ...current, teamA: current.teamB, teamB: current.teamA }));
    setPlayerOverrides((current) => ({ teamA: current.teamB, teamB: current.teamA }));
    setResult(null);
    setError(null);
    setEventData(null);
    setEventDataStatus((current) => ({ ...current, message: null, error: null }));
  }

  async function copyReport() {
    if (!result) return;
    await navigator.clipboard.writeText(result.report);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1600);
  }

  function downloadReport() {
    if (!result) return;
    const blob = new Blob([result.report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${form.teamA}-vs-${form.teamB}-report.md`.replace(/[\\/:*?"<>|]/g, "-");
    link.click();
    URL.revokeObjectURL(url);
  }

  function openBillingModal() {
    setActiveModal(form.billingMode === "platform" ? { type: "payment" } : { type: "byok" });
  }

  async function submitAccount(mode: "sign-in" | "sign-up") {
    setAccountMessage("处理中...");
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: accountEmail, password: accountPassword })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) return setAccountMessage(data.error ?? "账户操作失败。");
    setAccountPassword("");
    if (mode === "sign-up" && data.requiresEmailConfirmation) return setAccountMessage("注册成功，请先到邮箱完成确认。 ");
    setAccountUser(data.user ?? null);
    setAccountMessage("登录成功。");
  }

  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    setAccountUser(null);
    setPaymentOrderId(null);
    setAccountMessage("已退出登录。");
  }

  async function createCheckout() {
    setLoading("payment");
    setError(null);
    try {
      const response = await fetch("/api/payments/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error ?? "无法创建支付订单。");
      window.location.assign(data.checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "无法创建支付订单。");
      setLoading(null);
    }
  }

  function applyPlayerImport() {
    try {
      const importedPlayers = parsePlayerImport(importText);
      setPlayerOverrides((current) => ({ ...current, [importTarget]: importedPlayers }));
      setImportError(null);
      setResult(null);
      setActiveModal(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "球员数据解析失败。");
    }
  }

  async function readImportFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setImportText(text);
    setImportError(null);
  }

  async function requestEstimate() {
    setLoading("estimate");
    setError(null);
    setEstimate(null);

    try {
      const response = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "费用估算失败。");
      }

      setEstimate(data.estimate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "费用估算失败。");
    } finally {
      setLoading(null);
    }
  }

  async function requestPrediction() {
    setLoading("predict");
    setError(null);

    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(form.billingMode === "byok" && byokKey ? { "x-openai-api-key": byokKey } : {}) },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        if (data.estimate) {
          setEstimate(data.estimate);
        }
        throw new Error(data.error ?? "预测生成失败。");
      }

      setResult(data.result);
      setEstimate(data.result.cost);
      setActiveView("report");
    } catch (err) {
      setError(err instanceof Error ? err.message : "预测生成失败。");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">
              <Gauge size={21} aria-hidden="true" />
            </div>
            <div>
              <h1>赛前情报分析 Agent</h1>
              <p>球队筛选、球员状态、公开情报与概率预测</p>
            </div>
          </div>
          <div className="topbar-status">
            <span className="status-pill">
              <ShieldCheck size={15} aria-hidden="true" />
              {runtimeMode === "live" ? "Live 模式" : "Mock 模式"}
            </span>
            <span className="status-pill muted">
              <LockKeyhole size={15} aria-hidden="true" />
              {runtimeMode === "live" ? "质量门控计费" : "无真实扣费"}
            </span>
            <button className="status-pill account-button" type="button" onClick={() => setActiveModal({ type: "account" })}>
              <UserRoundCheck size={15} aria-hidden="true" />
              {accountUser?.email ?? (accountConfigured ? "登录" : "账户待配置")}
            </button>
          </div>
        </div>
      </header>

      <section className="stadium-hero" aria-label="match overview">
        <div className="stadium-lights" aria-hidden="true" />
        <div className="stadium-hero-inner">
          <div className="hero-team">
            <TeamBadge team={teamAProfile} />
            <div>
              <span>{teamAProfile.kind === "club" ? teamAProfile.league : teamAProfile.continent}</span>
              <strong>{form.teamA || "球队 A"}</strong>
              <small className="team-origin-line">
                <TeamCountryFlag team={teamAProfile} compact />
                {teamAProfile.country} / {teamAProfile.tier}
              </small>
            </div>
          </div>
          <div className="hero-pitch">
            <div className="pitch-mini large" aria-hidden="true">
              <div className="pitch-center" />
              <div className="pitch-dot left" />
              <div className="pitch-dot right" />
              <div className="match-ball" />
            </div>
            <b>VS</b>
          </div>
          <div className="hero-team right">
            <div>
              <span>{teamBProfile.kind === "club" ? teamBProfile.league : teamBProfile.continent}</span>
              <strong>{form.teamB || "球队 B"}</strong>
              <small className="team-origin-line">
                <TeamCountryFlag team={teamBProfile} compact />
                {teamBProfile.country} / {teamBProfile.tier}
              </small>
            </div>
            <TeamBadge team={teamBProfile} />
          </div>
          <div className="match-meta">
            <span>
              <Trophy size={14} aria-hidden="true" />
              {form.competition || "赛事"}
            </span>
            <span>
              <CalendarClock size={14} aria-hidden="true" />
              {form.matchDate || "时间"}
            </span>
            <span>
              <Landmark size={14} aria-hidden="true" />
              {getHomeLabel(form)}
            </span>
          </div>
        </div>
      </section>

      <nav className="step-switcher" aria-label="工作区步骤">
        {workspaceTabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={activeView === item.id ? "active" : ""}
              type="button"
              onClick={() => setActiveView(item.id)}
              key={item.id}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{item.label}</span>
              <b>{item.meta}</b>
            </button>
          );
        })}
      </nav>

      <section className={`workspace view-${activeView}`} aria-label="Agent workspace">
        {activeView === "teams" ? (
        <div className="panel setup-panel">
          <div className="panel-header">
            <div className="panel-title">
              <ListFilter size={18} aria-hidden="true" />
              <h2>球队选择</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                updateForm(initialForm);
                setFilters(initialFilters);
              }}
              title="重置"
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="panel-body">
            <div className="sample-row" aria-label="示例对阵">
              {sampleMatches.map((sample) => (
                <button
                  className="sample-chip"
                  key={`${sample.teamA}-${sample.teamB}`}
                  type="button"
                  onClick={() =>
                    updateForm({
                      teamA: sample.teamA,
                      teamB: sample.teamB,
                      competition: sample.competition
                    })
                  }
                >
                  {sample.teamA} / {sample.teamB}
                </button>
              ))}
            </div>

            <div className="selection-dock" aria-label="当前对阵">
              <label className="selection-team">
                <span>球队 A</span>
                <div>
                  <TeamBadge team={teamAProfile} />
                  <input value={form.teamA} list="team-catalog" onChange={(event) => updateForm({ teamA: event.target.value })} aria-label="球队 A" />
                </div>
                <small>{teamAProfile.league} / {teamAProfile.country}</small>
              </label>
              <button className="swap-team-button" type="button" onClick={swapTeams} title="交换球队" aria-label="交换球队 A 和球队 B">
                <ArrowLeftRight size={18} aria-hidden="true" />
              </button>
              <label className="selection-team right">
                <span>球队 B</span>
                <div>
                  <TeamBadge team={teamBProfile} />
                  <input value={form.teamB} list="team-catalog" onChange={(event) => updateForm({ teamB: event.target.value })} aria-label="球队 B" />
                </div>
                <small>{teamBProfile.league} / {teamBProfile.country}</small>
              </label>
              <datalist id="team-catalog">
                {availableTeams.map((team) => <option value={team.name} key={team.id} />)}
              </datalist>
            </div>

            <div className="selector-tabs" role="group" aria-label="球队分类">
              <button
                className={filters.mode === "all" ? "active" : ""}
                type="button"
                onClick={() => updateFilters({ mode: "all" })}
              >
                全部
              </button>
              <button
                className={filters.mode === "club" ? "active" : ""}
                type="button"
                onClick={() => updateFilters({ mode: "club" })}
              >
                俱乐部
              </button>
              <button
                className={filters.mode === "national" ? "active" : ""}
                type="button"
                onClick={() => updateFilters({ mode: "national" })}
              >
                国家队
              </button>
            </div>

            <div className="field search-field">
              <label htmlFor="teamSearch">输入搜索</label>
              <div>
                <Search size={16} aria-hidden="true" />
                <input
                  id="teamSearch"
                  value={filters.search}
                  onChange={(event) => updateFilters({ search: event.target.value })}
                  placeholder="输入球队、国家、联赛或大洲"
                />
              </div>
            </div>

            <div className="filter-grid">
              <label>
                <span>
                  <Globe2 size={13} aria-hidden="true" />
                  大洲
                </span>
                <select value={filters.continent} onChange={(event) => updateFilters({ continent: event.target.value })}>
                  <option value="all">全部</option>
                  {continents.map((value) => (
                    <option value={value} key={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>
                  <MapPin size={13} aria-hidden="true" />
                  国家
                </span>
                <select value={filters.country} onChange={(event) => updateFilters({ country: event.target.value })}>
                  <option value="all">全部</option>
                  {countries.map((value) => (
                    <option value={value} key={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>
                  <Trophy size={13} aria-hidden="true" />
                  联赛
                </span>
                <select value={filters.league} onChange={(event) => updateFilters({ league: event.target.value })}>
                  <option value="all">全部</option>
                  {leagues.map((value) => (
                    <option value={value} key={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>
                  <Filter size={13} aria-hidden="true" />
                  等级
                </span>
                <select value={filters.tier} onChange={(event) => updateFilters({ tier: event.target.value })}>
                  <option value="all">全部</option>
                  {tiers.map((value) => (
                    <option value={value} key={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="live-import-card" aria-live="polite">
              <div>
                <strong>真实数据源</strong>
                <span>{liveImport.message ?? `TheSportsDB · 已接入 ${liveTeams.length} 支`}</span>
              </div>
              <button className="panel-action-button live-import-button" type="button" onClick={importLiveTeams} disabled={liveImport.loading}>
                {liveImport.loading ? (
                  <RefreshCw className="spin" size={14} aria-hidden="true" />
                ) : (
                  <Database size={14} aria-hidden="true" />
                )}
                {liveImport.loading ? "导入中" : "联网导入"}
              </button>
            </div>
            {liveImport.error ? <p className="error-text live-import-error">{liveImport.error}</p> : null}

            <details className="source-details">
              <summary>
                <Database size={14} aria-hidden="true" />
                高级数据源
                <span>{officialSources ? `${readyOfficialSources.length}/${officialSources.providers?.length ?? 0} 可用` : "检查正式源"}</span>
              </summary>
            <div className="official-source-panel" aria-live="polite">
              <div className="official-source-head">
                <div>
                  <strong>正式数据源管线</strong>
                  <span>
                    {officialSourceStatus.message ??
                      `StatsBomb + FBref + Understat + SoFIFA + soccerdata + mplsoccer，全量管线预留`}
                  </span>
                </div>
                <button className="panel-action-button" type="button" onClick={checkOfficialSources} disabled={officialSourceStatus.loading}>
                  {officialSourceStatus.loading ? (
                    <RefreshCw className="spin" size={14} aria-hidden="true" />
                  ) : (
                    <ShieldCheck size={14} aria-hidden="true" />
                  )}
                  {officialSourceStatus.loading ? "检查中" : "检查正式源"}
                </button>
              </div>

              {officialSourceStatus.error ? <p className="error-text live-import-error">{officialSourceStatus.error}</p> : null}

              {officialSources ? (
                <>
                  <div className="official-source-summary">
                    <div>
                      <span>当前可用</span>
                      <strong>
                        {readyOfficialSources.length}/{officialSources.providers?.length ?? 0}
                      </strong>
                    </div>
                    <div>
                      <span>融合阶段</span>
                      <strong>{officialSources.fusionPlan?.length ?? 0}</strong>
                    </div>
                    <div>
                      <span>Python 工具</span>
                      <strong>
                        {enabledAnalysisTools.length}/{officialSources.analysisTools?.length ?? 0}
                      </strong>
                    </div>
                    <div>
                      <span>核心策略</span>
                      <strong>多源校验</strong>
                    </div>
                  </div>

                  <div className="official-provider-list">
                    {officialSources.providers?.map((provider) => (
                      <div className={provider.configured ? "ready" : "pending"} key={provider.id}>
                        <div>
                          <strong>{provider.name}</strong>
                          <span>{provider.bestFor.slice(0, 2).join(" / ")}</span>
                        </div>
                        <b>
                          {provider.configured
                            ? "可用"
                            : provider.runtimeStatus === "prepared"
                              ? "已加入"
                              : provider.runtimeStatus === "contract-needed"
                                ? "需合同"
                                : "缺 Key"}
                        </b>
                      </div>
                    ))}
                  </div>

                  <div className="official-provider-list">
                    {officialSources.analysisTools?.map((tool) => (
                      <div className={tool.configured ? "ready" : "pending"} key={tool.id}>
                        <div>
                          <strong>{tool.name}</strong>
                          <span>{tool.bestFor.slice(0, 2).join(" / ")}</span>
                        </div>
                        <b>{tool.configured ? "已启用" : "已加入"}</b>
                      </div>
                    ))}
                  </div>

                  <div className="official-fusion-list">
                    {officialSources.fusionPlan?.slice(0, 4).map((stage) => (
                      <div key={stage.id}>
                        <Workflow size={14} aria-hidden="true" />
                        <span>
                          <strong>{stage.name}</strong>
                          {stage.providers.join(" → ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            </details>

            <div className="team-results">
              <div className="team-results-head">
                <span>
                  {filteredTeams.length} 支球队
                  <small>{filteredClubCount} 俱乐部 / {filteredNationalCount} 国家队</small>
                </span>
                {activeFilterCount ? (
                  <button type="button" onClick={() => setFilters(initialFilters)}>
                    清除 {activeFilterCount} 项筛选
                  </button>
                ) : (
                  <small>{liveTeams.length ? "点击球队查看球员" : "可直接设为 A/B"}</small>
                )}
              </div>
              {filteredTeams.map((team) => {
                const currentTeamKey = teamKey(team);
                const expanded = expandedTeamKey === currentTeamKey;
                const rosterStatus = teamRosterFetch[currentTeamKey];

                return (
                  <div className={`team-option-shell ${expanded ? "expanded" : ""}`} data-team-id={team.id} key={team.id}>
                    <div
                      className="team-option"
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      onClick={() => toggleTeamDetails(team)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleTeamDetails(team);
                        }
                      }}
                    >
                      <TeamBadge team={team} />
                      <div className="team-option-main">
                        <strong>{team.name}</strong>
                        <span className="team-meta-line">
                          <TeamCountryFlag team={team} compact />
                          {team.kind === "club" ? "俱乐部" : "国家队"} / {team.league} / {team.country}
                        </span>
                        {team.source ? (
                          <em>
                            {team.source}
                            {team.stadium ? ` / ${team.stadium}` : ""}
                          </em>
                        ) : null}
                        <div className="team-option-bars">
                          <i style={{ width: `${team.attack}%` }} />
                          <i style={{ width: `${team.defense}%` }} />
                        </div>
                        <small className="team-metric-disclaimer">攻防条为演示占位</small>
                      </div>
                      <div className="team-option-actions">
                        <button data-slot="teamA" type="button" onClick={(event) => { event.stopPropagation(); selectTeam("teamA", team); }}>
                          A
                        </button>
                        <button data-slot="teamB" type="button" onClick={(event) => { event.stopPropagation(); selectTeam("teamB", team); }}>
                          B
                        </button>
                      </div>
                    </div>
                    {expanded ? (
                      <TeamRosterPreview team={team} status={rosterStatus} onOpenPlayer={(player) => setActiveModal({ type: "player", player, team })} />
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="manual-inputs legacy-manual-inputs">
              <div className="two-col">
                <div className="field">
                  <label htmlFor="teamA">球队 A</label>
                  <input
                    id="teamA"
                    value={form.teamA}
                    onChange={(event) => updateForm({ teamA: event.target.value })}
                    placeholder="Manchester City"
                  />
                </div>
                <div className="field">
                  <label htmlFor="teamB">球队 B</label>
                  <input
                    id="teamB"
                    value={form.teamB}
                    onChange={(event) => updateForm({ teamB: event.target.value })}
                    placeholder="Real Madrid"
                  />
                </div>
              </div>
            </div>
            <div className="step-actions">
              <button className="btn btn-primary" type="button" onClick={() => setActiveView("match")}>
                <CalendarClock size={16} aria-hidden="true" />
                下一步：设置比赛
              </button>
            </div>
          </div>
        </div>
        ) : null}

        {activeView === "match" ? (
        <div className="center-column">
          <div className="panel match-panel">
            <div className="panel-header">
              <div className="panel-title">
                <CalendarClock size={18} aria-hidden="true" />
                <h2>比赛参数</h2>
              </div>
            </div>
            <div className="panel-body">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="competition">赛事</label>
                  <input
                    id="competition"
                    value={form.competition}
                    onChange={(event) => updateForm({ competition: event.target.value })}
                    placeholder="英超 / 欧冠 / 国家队赛事"
                  />
                </div>
                <div className="two-col">
                  <div className="field">
                    <label htmlFor="matchDate">比赛时间</label>
                    <input
                      id="matchDate"
                      value={form.matchDate}
                      onChange={(event) => updateForm({ matchDate: event.target.value })}
                      placeholder="2026-07-12 20:00"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="homeTeam">场地</label>
                    <select
                      id="homeTeam"
                      value={form.homeTeam}
                      onChange={(event) => updateForm({ homeTeam: event.target.value as FormState["homeTeam"] })}
                    >
                      <option value="team_a">球队 A 主场</option>
                      <option value="team_b">球队 B 主场</option>
                      <option value="neutral">中立场</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>分析深度</label>
                  <div className="segmented" role="group" aria-label="分析深度">
                    <button
                      className={`segment ${form.analysisDepth === "standard" ? "active" : ""}`}
                      type="button"
                      onClick={() => updateForm({ analysisDepth: "standard" })}
                    >
                      标准
                    </button>
                    <button
                      className={`segment ${form.analysisDepth === "deep" ? "active" : ""}`}
                      type="button"
                      onClick={() => updateForm({ analysisDepth: "deep" })}
                    >
                      深度
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label>费用模式</label>
                  <div className="segmented" role="group" aria-label="费用模式">
                    <button
                      className={`segment ${form.billingMode === "platform" ? "active" : ""}`}
                      type="button"
                      onClick={() => updateForm({ billingMode: "platform" })}
                    >
                      <BadgeDollarSign size={15} aria-hidden="true" />
                      平台托管
                    </button>
                    <button
                      className={`segment ${form.billingMode === "byok" ? "active" : ""}`}
                      type="button"
                      onClick={() => updateForm({ billingMode: "byok" })}
                    >
                      <LockKeyhole size={15} aria-hidden="true" />
                      自带 Key
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="maxCharge">最高授权费用</label>
                  <div className="money-input">
                    <span>¥</span>
                    <input
                      id="maxCharge"
                      type="number"
                      min={0}
                      max={500}
                      step={0.01}
                      value={form.maxUserChargeCents / 100}
                      onChange={(event) =>
                        updateForm({ maxUserChargeCents: Math.round(Number(event.target.value) * 100) })
                      }
                    />
                  </div>
                </div>

                <div className="notice">
                  <AlertTriangle size={17} aria-hidden="true" />
                  <span>{runtimeMode === "live" ? "实时模式会先检查数据质量、登录和支付，再调用AI。" : "当前部署仍是Mock模式，不会产生真实费用。"}</span>
                </div>

                {error ? <p className="error-text">{error}</p> : null}

                {loading === "predict" ? (
                  <div className="scan-status" aria-live="polite">
                    <div>
                      <Radar size={16} aria-hidden="true" />
                      正在扫描球队状态、球员风险和公开情报
                    </div>
                    <i />
                  </div>
                ) : null}

                <div className="actions">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={requestEstimate}
                    disabled={loading !== null}
                  >
                    {loading === "estimate" ? (
                      <RefreshCw className="spin" size={16} aria-hidden="true" />
                    ) : (
                      <BadgeDollarSign size={16} aria-hidden="true" />
                    )}
                  估算费用
                </button>
                  <button className="btn btn-secondary" type="button" onClick={openBillingModal}>
                    <Eye size={16} aria-hidden="true" />
                    确认方式
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={requestPrediction}
                    disabled={loading !== null}
                  >
                    {loading === "predict" ? (
                      <RefreshCw className="spin" size={16} aria-hidden="true" />
                    ) : (
                      <Send size={16} aria-hidden="true" />
                    )}
                  生成报告
                </button>
              </div>
              </div>
            </div>
          </div>

          <div className="panel intelligence-panel">
            <div className="panel-header">
              <div className="panel-title">
                <Workflow size={18} aria-hidden="true" />
                <h2>执行与成本</h2>
              </div>
              <span className="mini-stat">
                {completedSteps}/{workflow.length}
              </span>
            </div>
            <div className="panel-body">
              <div className="workflow-list">
                {workflow.map((step, index) => (
                  <div className={`workflow-item ${step.status}`} key={step.id}>
                    <div className="workflow-index">{renderWorkflowIcon(step.status)}</div>
                    <div>
                      <h3>
                        <span>{index + 1}</span>
                        {step.name}
                      </h3>
                      <p>{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cost-box">
                <div className="cost-box-header">
                  <span>成本预览</span>
                  <strong>{estimate ? currency(estimate.estimatedUserChargeCents) : "未估算"}</strong>
                </div>
                <div className="cost-grid">
                  <div>
                    <span>API 成本</span>
                    <strong>{estimate ? currency(estimate.estimatedApiCostCents) : "—"}</strong>
                  </div>
                  <div>
                    <span>倍率</span>
                    <strong>{estimate ? `${estimate.markupMultiplier}x` : "—"}</strong>
                  </div>
                  <div>
                    <span>最低收费</span>
                    <strong>{estimate ? currency(estimate.minimumChargeCents) : "—"}</strong>
                  </div>
                  <div>
                    <span>模式</span>
                    <strong>{form.billingMode === "platform" ? "托管" : "BYOK"}</strong>
                  </div>
                </div>
              </div>

              <div className="guard-stack">
                <div>
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>密钥只在服务端</span>
                </div>
                <div>
                  <BadgeDollarSign size={16} aria-hidden="true" />
                  <span>先授权后执行</span>
                </div>
                <div>
                  <Users size={16} aria-hidden="true" />
                  <span>不分析隐私八卦</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        ) : null}

        {activeView === "analysis" || activeView === "report" ? (
        <div className={`right-column ${activeView === "report" ? "report-only" : ""}`}>
          {activeView === "analysis" ? (
          <>
          <div className="panel data-panel">
            <div className="panel-header">
              <div className="panel-title">
                <BarChart3 size={18} aria-hidden="true" />
                <h2>数据可视化</h2>
              </div>
              <span className="status-pill compact">
                <Activity size={14} aria-hidden="true" />
                {liveTeams.length ? "元数据已联网 / 指标演示" : "Mock 数据"}
              </span>
            </div>
            <div className="panel-body">
              <div className="live-sync-bar">
                <div>
                  <strong>多源真实比赛数据</strong>
                  <span>优先使用免费 API-Football，自动回退至 Sportmonks 或 football-data.org</span>
                </div>
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={matchIntelligenceStatus.loading}
                  onClick={() => void syncLiveMatchIntelligence()}
                >
                  <RefreshCw size={15} className={matchIntelligenceStatus.loading ? "spin" : ""} aria-hidden="true" />
                  {matchIntelligenceStatus.loading ? "同步中" : matchIntelligence ? "强制刷新" : "同步真实数据"}
                </button>
              </div>
              {matchIntelligenceStatus.error ? (
                <div className="inline-alert error" role="alert">{matchIntelligenceStatus.error}</div>
              ) : null}
              {matchIntelligence ? (
                <>
                <div className="live-coverage-grid">
                  <div>
                    <span>比赛 · {matchIntelligence.provider ? matchProviderLabels[matchIntelligence.provider] : "正式源"}</span>
                    <strong>{matchIntelligence.fixture?.name || "已定位"}</strong>
                    <small>{matchIntelligence.fixture?.startsAt || "时间待确认"}</small>
                  </div>
                  <div>
                    <span>阵容</span>
                    <strong>{matchIntelligence.coverage?.lineups ?? 0} 人</strong>
                    <small>{matchIntelligence.coverage?.confirmedLineup ? "官方首发已确认" : "首发尚未确认"}</small>
                  </div>
                  <div>
                    <span>伤停</span>
                    <strong>{matchIntelligence.coverage?.sidelined ?? 0} 人</strong>
                    <small>结构化名单</small>
                  </div>
                  <div>
                    <span>事件 / 统计</span>
                    <strong>{matchIntelligence.coverage?.events ?? 0} / {matchIntelligence.coverage?.teamStatistics ?? 0}</strong>
                    <small>
                      {matchIntelligence.cache
                        ? `缓存 ${matchIntelligence.cache.status} · ${matchIntelligence.cache.ageSeconds}s`
                        : "取决于套餐与比赛状态"}
                    </small>
                  </div>
                </div>
                {matchIntelligence.quality ? (
                  <div className={`quality-gate ${matchIntelligence.quality.level}`}>
                    <div className="quality-gate-head">
                      <div>
                        <span>真实数据质量门</span>
                        <strong>{matchIntelligence.quality.score}/100</strong>
                      </div>
                      <b>
                        {matchIntelligence.quality.canRunOfficialPrediction
                          ? "允许正式预测"
                          : matchIntelligence.quality.canRunPreliminaryAnalysis
                            ? "仅允许预分析"
                            : "禁止进入预测"}
                      </b>
                    </div>
                    <div className="quality-checks">
                      {matchIntelligence.quality.checks.map((check) => (
                        <span className={check.passed ? "passed" : check.required ? "missing" : "optional"} key={check.id} title={check.detail}>
                          {check.passed ? <CheckCircle2 size={13} aria-hidden="true" /> : <CircleDashed size={13} aria-hidden="true" />}
                          {check.label}
                        </span>
                      ))}
                    </div>
                    {matchIntelligence.quality.missingRequired.length ? (
                      <p>正式预测仍缺：{matchIntelligence.quality.missingRequired.join("、")}</p>
                    ) : null}
                  </div>
                ) : null}
                </>
              ) : null}
              <div className="data-quality-note prominent" role="note">
                未完成正式分析时不展示预测概率；球队评分、战术和球员对位仅在指标通过来源核验后显示。
              </div>
              <MatchVisualDashboard
                teamA={teamAProfile}
                teamB={teamBProfile}
                probability={probability}
                eventData={eventData}
                eventLoading={eventDataStatus.loading}
                onImportEvents={importPlayerEventData}
              />

              <div className="probability-grid">
                <div className="prob-card">
                  <span>{form.teamA || "球队 A"}</span>
                  <strong>{probability.teamA}%</strong>
                  <div className="prob-track">
                    <div style={{ width: `${probability.teamA}%` }} />
                  </div>
                </div>
                <div className="prob-card draw">
                  <span>平局</span>
                  <strong>{probability.draw}%</strong>
                  <div className="prob-track">
                    <div style={{ width: `${probability.draw}%` }} />
                  </div>
                </div>
                <div className="prob-card alt">
                  <span>{form.teamB || "球队 B"}</span>
                  <strong>{probability.teamB}%</strong>
                  <div className="prob-track">
                    <div style={{ width: `${probability.teamB}%` }} />
                  </div>
                </div>
              </div>

              <div className="score-line">
                <Goal size={17} aria-hidden="true" />
                <span>倾向比分</span>
                <strong>{probability.score}</strong>
              </div>

              <div className="team-state-grid">
                <div className="team-state-card">
                  <div className="team-state-head">
                    <TeamBadge team={teamAProfile} />
                    <div>
                      <strong>{teamAProfile.name}</strong>
                      <span className="team-meta-line">
                        <TeamCountryFlag team={teamAProfile} compact />
                        {teamAProfile.league} / {teamAProfile.country}
                      </span>
                    </div>
                  </div>
                  <MetricBar label="进攻" value={teamAProfile.attack} />
                  <MetricBar label="防守" value={teamAProfile.defense} tone="blue" />
                  <MetricBar label="状态" value={teamAProfile.form} tone="amber" />
                  <div className="recent-form">
                    {teamAProfile.recent.map((item, index) => (
                      <span className={item} key={`${item}-${index}`}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="team-state-card">
                  <div className="team-state-head">
                    <TeamBadge team={teamBProfile} />
                    <div>
                      <strong>{teamBProfile.name}</strong>
                      <span className="team-meta-line">
                        <TeamCountryFlag team={teamBProfile} compact />
                        {teamBProfile.league} / {teamBProfile.country}
                      </span>
                    </div>
                  </div>
                  <MetricBar label="进攻" value={teamBProfile.attack} />
                  <MetricBar label="防守" value={teamBProfile.defense} tone="blue" />
                  <MetricBar label="状态" value={teamBProfile.form} tone="amber" />
                  <div className="recent-form">
                    {teamBProfile.recent.map((item, index) => (
                      <span className={item} key={`${item}-${index}`}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="comparison-board">
                <ComparisonRow label="进攻火力" left={teamAProfile.attack} right={teamBProfile.attack} />
                <ComparisonRow label="防守稳定" left={teamAProfile.defense} right={teamBProfile.defense} />
                <ComparisonRow label="体能余量" left={teamAProfile.fitness} right={teamBProfile.fitness} />
                <ComparisonRow label="控球能力" left={teamAProfile.possession} right={teamBProfile.possession} />
                <ComparisonRow label="压迫强度" left={teamAProfile.press} right={teamBProfile.press} />
                <ComparisonRow label="伤病安全" left={teamAProfile.injurySafety} right={teamBProfile.injurySafety} />
              </div>

              <div className="xg-strip">
                <div>
                  <Zap size={15} aria-hidden="true" />
                  <span>{teamAProfile.name} xG</span>
                  <strong>{teamAProfile.xgFor.toFixed(2)}</strong>
                </div>
                <div>
                  <Dumbbell size={15} aria-hidden="true" />
                  <span>xGA</span>
                  <strong>{teamAProfile.xgAgainst.toFixed(2)} / {teamBProfile.xgAgainst.toFixed(2)}</strong>
                </div>
                <div>
                  <Swords size={15} aria-hidden="true" />
                  <span>{teamBProfile.name} xG</span>
                  <strong>{teamBProfile.xgFor.toFixed(2)}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="panel matchup-panel">
            <div className="panel-header">
              <div className="panel-title">
                <Swords size={18} aria-hidden="true" />
                <h2>球员对位与克制链</h2>
              </div>
              <div className="matchup-tools">
                <span className="status-pill compact">
                  <Radar size={14} aria-hidden="true" />
                  {eventData?.coverageTier === "free-live-summary"
                    ? "免费实时汇总"
                    : eventData?.coverageTier === "commercial-live-events"
                      ? "商业完整事件"
                      : eventData
                        ? "免费历史事件"
                        : "简化预览"}
                </span>
                <button className="panel-action-button" type="button" onClick={importPlayerEventData} disabled={eventDataStatus.loading}>
                  {eventDataStatus.loading ? (
                    <RefreshCw className="spin" size={14} aria-hidden="true" />
                  ) : (
                    <Database size={14} aria-hidden="true" />
                  )}
                  {eventDataStatus.loading ? "获取中" : "获取事件数据"}
                </button>
              </div>
            </div>
            <div className="panel-body">
              <div className="data-audit-strip">
                <div>
                  <span>球队数据</span>
                  <strong>{liveTeams.length ? "真实导入" : "Mock"}</strong>
                </div>
                <div>
                  <span>事件对位</span>
                  <strong>{eventData ? "真实样本" : "简化"}</strong>
                </div>
                <div>
                  <span>门将/点球</span>
                  <strong>{eventData ? "真实样本" : "简化"}</strong>
                </div>
                <div>
                  <span>教练因素</span>
                  <strong>简化</strong>
                </div>
              </div>

              {eventDataStatus.error ? <p className="event-data-error">{eventDataStatus.error}</p> : null}
              {eventDataStatus.message ? <p className="event-data-message">{eventDataStatus.message}</p> : null}

              {eventData ? (
                <div className="event-data-board">
                  <div className="event-data-head">
                    <div>
                      <strong>{eventData.matchLabel ?? "事件数据样本"}</strong>
                      <span>
                        {eventData.sourceName ?? "事件数据源"} /{" "}
                        {eventData.mode === "historical-demo" ? "历史样本，不代表当前所选比赛" : "实时数据"}
                      </span>
                    </div>
                    {eventData.sourceUrl ? (
                      <a href={eventData.sourceUrl} target="_blank" rel="noreferrer">
                        查看来源
                      </a>
                    ) : null}
                  </div>

                  <div className="event-capability-row" aria-label="事件数据覆盖能力">
                    {(eventData.capabilities ?? []).map((capability) => (
                      <span className="available" key={capability}>{capability}</span>
                    ))}
                    {(eventData.missingCapabilities ?? []).map((capability) => (
                      <span className="missing" key={capability}>{capability} 缺失</span>
                    ))}
                  </div>

                  <div className="event-summary-grid">
                    <div className="event-stat-card">
                      <span>总事件</span>
                      <strong>{eventData.capabilities?.includes("event-stream") ? eventData.summary?.totalEvents ?? 0 : "—"}</strong>
                      <small>{eventData.capabilities?.includes("event-stream") ? "结构化 event log" : "当前源仅提供汇总"}</small>
                    </div>
                    <div className="event-stat-card">
                      <span>射门 / 射正 / xG</span>
                      <strong>
                        {eventData.summary?.shots ?? 0} / {eventData.summary?.shotsOnTarget ?? 0} /{" "}
                        {eventData.capabilities?.includes("xg") ? formatEventNumber(eventData.summary?.xg) : "—"}
                      </strong>
                      <small>含点球与运动战射门</small>
                    </div>
                    <div className="event-stat-card">
                      <span>防守事件</span>
                      <strong>
                        {(eventData.summary?.tackles ?? 0) +
                          (eventData.summary?.blocks ?? 0) +
                          (eventData.summary?.interceptions ?? 0)}
                      </strong>
                      <small>抢断 + 封堵 + 拦截</small>
                    </div>
                    <div className="event-stat-card">
                      <span>突破 / 被过</span>
                      <strong>
                        {eventData.summary?.dribblesCompleted ?? 0} / {eventData.summary?.dribbledPast ?? 0}
                      </strong>
                      <small>完成过人 / 防守被过</small>
                    </div>
                    <div className="event-stat-card">
                      <span>门将 / 点球</span>
                      <strong>
                        {eventData.summary?.saves ?? 0} / {eventData.summary?.penaltySaves ?? 0}
                      </strong>
                      <small>扑救 / 扑点</small>
                    </div>
                  </div>

                  <div className="event-player-grid">
                    {topEventPlayers.map((player) => (
                      <div className="event-player-card" key={`${player.playerId}-${player.team}`}>
                        <div className="event-player-card-head">
                          <div>
                            <strong>{player.name}</strong>
                            <span>
                              {player.team} / {player.position || "位置未知"} /{" "}
                              {player.heightCm ? `${player.heightCm}cm` : "身高缺失"} / {preferredFootLabel(player.preferredFoot)}
                            </span>
                          </div>
                          <b>xG {formatEventNumber(player.xg)}</b>
                        </div>
                        <div className="event-player-stats">
                          <span>
                            射门 <strong>{player.shots}</strong>
                          </span>
                          <span>
                            射正 <strong>{player.shotsOnTarget}</strong>
                          </span>
                          <span>
                            抢断 <strong>{player.tackles}</strong>
                          </span>
                          <span>
                            封堵 <strong>{player.blocks}</strong>
                          </span>
                          <span>
                            拦截 <strong>{player.interceptions}</strong>
                          </span>
                          <span>
                            被过 <strong>{player.dribbledPast}</strong>
                          </span>
                          <span>
                            成功过人 <strong>{player.dribblesCompleted}</strong>
                          </span>
                          <span>
                            扑救 <strong>{player.saves}</strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {featuredEventPlayer ? (
                    <div className="event-heatmap-card">
                      <div className="event-heatmap-head">
                        <div>
                          <strong>{featuredEventPlayer.name} 事件热区</strong>
                          <span>按 StatsBomb 120x80 球场坐标聚合</span>
                        </div>
                        <span>{featuredEventPlayer.heatmap.length} 个热点</span>
                      </div>
                      <div className="event-heatmap" aria-label={`${featuredEventPlayer.name} event heatmap`}>
                        {featuredEventPlayer.heatmap.map((point, index) => {
                          const heat = point.count / featuredHeatmapMax;
                          return (
                            <i
                              key={`${point.x}-${point.y}-${index}`}
                              style={{
                                left: `${Math.min(100, Math.max(0, (point.x / 120) * 100))}%`,
                                top: `${Math.min(100, Math.max(0, (point.y / 80) * 100))}%`,
                                opacity: 0.35 + heat * 0.55,
                                transform: `translate(-50%, -50%) scale(${0.75 + heat * 1.45})`
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {eventData.dataGaps?.length ? (
                    <div className="event-gap-list">
                      <strong>仍需补齐的数据</strong>
                      {eventData.dataGaps.map((gap) => (
                        <span key={gap}>{gap}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!hasVerifiedTeamMetrics ? (
                <div className="data-quality-note" role="status">
                  球员对位、点球、战术克制和教练评分等待已核验的真实指标，当前不生成推测数值。
                </div>
              ) : null}

              <div className="matchup-grid">
                {matchupInsights.map((matchup) => (
                  <div className="matchup-card" key={matchup.id}>
                    <div className="matchup-card-head">
                      <span>{matchup.title}</span>
                      <strong>{matchup.aerialEdge > 0 ? `+${matchup.aerialEdge}` : matchup.aerialEdge}cm</strong>
                    </div>
                    <div className="duel-line">
                      <div>
                        <strong>{matchup.attacker.name}</strong>
                        <span>{matchup.attacker.role}</span>
                      </div>
                      <b>vs</b>
                      <div>
                        <strong>{matchup.defender.name}</strong>
                        <span>{matchup.defender.role}</span>
                      </div>
                    </div>
                    <ComparisonRow label="突破威胁 / 抢断封堵" left={matchup.attackValue} right={matchup.defenseValue} />
                    <p>{matchup.note}</p>
                  </div>
                ))}
              </div>

              <div className="keeper-penalty-grid">
                {keeperPenaltyInsights.map((item, index) => (
                  <div className="keeper-card" key={`${index}-${item.keeper.name}-${item.shooter.name}`}>
                    <div>
                      <Goal size={15} aria-hidden="true" />
                      <span>{item.shooter.name} 射门 vs {item.keeper.name}</span>
                    </div>
                    <ComparisonRow label="射门质量 / 扑救覆盖" left={item.shotValue} right={item.saveValue} />
                    <div className="penalty-row">
                      <span>点球命中 {item.penaltyScore}%</span>
                      <span>门将扑点 {item.penaltySave}%</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="tactical-chain-list">
                {tacticalChains.map((chain) => (
                  <div className="tactical-chain" key={chain.id}>
                    <div className="tactical-chain-head">
                      <strong>{chain.trigger}</strong>
                      <span>{chain.verdict}</span>
                    </div>
                    <ComparisonRow label={`${chain.attackLabel} / ${chain.defenseLabel}`} left={chain.attackValue} right={chain.defenseValue} />
                  </div>
                ))}
              </div>

              <div className="coach-grid">
                {coachProfiles.map((coach) => (
                  <div className="coach-card" key={coach.teamName}>
                    <strong>{coach.teamName}</strong>
                    <span>{coach.risk}</span>
                    <MetricBar label="阵型弹性" value={coach.flexibility} />
                    <MetricBar label="换人影响" value={coach.substitution} tone="blue" />
                    <MetricBar label="局势响应" value={coach.gameState} tone="amber" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel player-panel">
            <div className="panel-header">
              <div className="panel-title">
                <UserRoundCheck size={18} aria-hidden="true" />
                <h2>球员状态</h2>
              </div>
              <button className="panel-action-button" type="button" onClick={() => setActiveModal({ type: "importPlayers" })}>
                <Upload size={14} aria-hidden="true" />
                导入球员数据
              </button>
            </div>
            <div className="panel-body player-columns">
              <div>
                <div className="player-column-title">
                  {teamAProfile.name}
                  {playerOverrides.teamA ? <span>已导入</span> : null}
                </div>
                {teamAProfile.players.map((player) => (
                  <PlayerCard
                    player={player}
                    onOpen={() => setActiveModal({ type: "player", player, team: teamAProfile })}
                    key={`${teamAProfile.id}-${player.name}`}
                  />
                ))}
              </div>
              <div>
                <div className="player-column-title">
                  {teamBProfile.name}
                  {playerOverrides.teamB ? <span>已导入</span> : null}
                </div>
                {teamBProfile.players.map((player) => (
                  <PlayerCard
                    player={player}
                    onOpen={() => setActiveModal({ type: "player", player, team: teamBProfile })}
                    key={`${teamBProfile.id}-${player.name}`}
                  />
                ))}
              </div>
            </div>
          </div>
          </>
          ) : null}

          {activeView === "report" ? (
          <div className="panel report-panel">
            <div className="panel-header">
              <div className="panel-title">
                <FileText size={18} aria-hidden="true" />
                <h2>分析报告</h2>
              </div>
              <div className="report-actions">
                <button type="button" onClick={copyReport} disabled={!result}>
                  <ClipboardCopy size={14} aria-hidden="true" />
                  {copyState === "copied" ? "已复制" : "复制"}
                </button>
                <button type="button" onClick={downloadReport} disabled={!result}>
                  <Download size={14} aria-hidden="true" />
                  导出
                </button>
                <span className="status-pill compact">
                  <Sparkles size={14} aria-hidden="true" />
                  {result ? "已生成" : "待生成"}
                </span>
              </div>
            </div>
            <div className="panel-body">
              {result ? (
                <article className="report" aria-live="polite">
                  {reportNodes(result.report)}
                </article>
              ) : (
                <div className="empty-report">
                  <FileText size={34} aria-hidden="true" />
                  <strong>赛前报告席位</strong>
                  <span>筛选球队后生成 mock report</span>
                </div>
              )}
            </div>
          </div>
          ) : null}
        </div>
        ) : null}
      </section>

      {activeModal ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setActiveModal(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span>
                  {activeModal.type === "player"
                    ? "球员详情"
                    : activeModal.type === "account"
                      ? "用户账户"
                    : activeModal.type === "payment"
                      ? "平台托管确认"
                      : activeModal.type === "byok"
                        ? "自带 Key 模式"
                        : "数据导入"}
                </span>
                <h3>
                  {activeModal.type === "player"
                    ? activeModal.player.name
                    : activeModal.type === "account"
                      ? accountUser ? "账户已登录" : "登录或注册"
                    : activeModal.type === "payment"
                      ? "先确认费用，再启动预测"
                      : activeModal.type === "byok"
                        ? "密钥仅用于本次请求"
                        : "导入球员数据"}
                </h3>
              </div>
              <button type="button" onClick={() => setActiveModal(null)} aria-label="关闭弹窗">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {activeModal.type === "player" ? (
              <div className="modal-body">
                <div className="player-detail-head">
                  <PlayerAvatar player={activeModal.player} size="lg" />
                  <div>
                    <strong>{activeModal.player.name}</strong>
                    <span>
                      {activeModal.player.role} / {activeModal.team.name} / {statusLabel(activeModal.player.status)}
                    </span>
                  </div>
                  <TeamBadge team={activeModal.team} />
                </div>
                <div className="detail-grid">
                  <div>
                    <span>综合状态</span>
                    <strong>{activeModal.player.form}</strong>
                  </div>
                  <div>
                    <span>预计出场时间</span>
                    <strong>{activeModal.player.minutes}%</strong>
                  </div>
                  <div>
                    <span>进球</span>
                    <strong>{activeModal.player.goals}</strong>
                  </div>
                  <div>
                    <span>助攻</span>
                    <strong>{activeModal.player.assists}</strong>
                  </div>
                  <div>
                    <span>防守贡献</span>
                    <strong>{activeModal.player.defense}</strong>
                  </div>
                  <div>
                    <span>风险等级</span>
                    <strong>{activeModal.player.status === "ready" ? "低" : "中"}</strong>
                  </div>
                </div>
                <MetricBar label="状态趋势" value={activeModal.player.form} />
                <MetricBar label="出场确定性" value={activeModal.player.minutes} tone="blue" />
                <p className="modal-note">{activeModal.player.note}</p>
              </div>
            ) : activeModal.type === "account" ? (
              <div className="modal-body">
                {accountUser ? (
                  <>
                    <div className="confirm-summary"><div><span>当前账户</span><strong>{accountUser.email}</strong></div></div>
                    <button className="btn btn-secondary full" type="button" onClick={() => void signOut()}>退出登录</button>
                  </>
                ) : (
                  <>
                    <label className="field"><span>邮箱</span><input type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} autoComplete="email" /></label>
                    <label className="field"><span>密码</span><input type="password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} autoComplete="current-password" /></label>
                    <div className="two-col">
                      <button className="btn btn-primary" type="button" onClick={() => void submitAccount("sign-in")}>登录</button>
                      <button className="btn btn-secondary" type="button" onClick={() => void submitAccount("sign-up")}>注册</button>
                    </div>
                  </>
                )}
                {accountMessage ? <p className="modal-note">{accountMessage}</p> : null}
              </div>
            ) : activeModal.type === "payment" ? (
              <div className="modal-body">
                <div className="confirm-summary">
                  <div>
                    <span>费用模式</span>
                    <strong>平台托管</strong>
                  </div>
                  <div>
                    <span>授权上限</span>
                    <strong>{currency(form.maxUserChargeCents)}</strong>
                  </div>
                  <div>
                    <span>预估费用</span>
                    <strong>{estimate ? currency(estimate.estimatedUserChargeCents) : "请先估算"}</strong>
                  </div>
                </div>
                <p className="modal-note">
                  平台只接受Stripe签名Webhook确认。未使用的预付金额会按实际API成本结算后原路退回。
                </p>
                <button className="btn btn-primary full" type="button" disabled={loading === "payment" || !accountUser} onClick={() => void createCheckout()}>
                  {loading === "payment" ? "正在创建订单" : accountUser ? "前往安全支付" : "请先登录"}
                </button>
              </div>
            ) : activeModal.type === "byok" ? (
              <div className="modal-body">
                <label className="field">
                  <span>用户 API Key</span>
                  <input type="password" value={byokKey} onChange={(event) => setByokKey(event.target.value)} placeholder="sk-...（仅保存在当前页面内存）" autoComplete="off" />
                </label>
                <p className="modal-note">
                  Key仅通过本次HTTPS请求发往本站服务端，再直接用于OpenAI调用；不落库、不写日志，刷新页面即清空。
                </p>
                <button className="btn btn-primary full" type="button" onClick={() => setActiveModal(null)}>
                  确认本次使用
                </button>
              </div>
            ) : (
              <div className="modal-body">
                <div className="import-target-row" role="group" aria-label="导入目标">
                  <button
                    className={importTarget === "teamA" ? "active" : ""}
                    type="button"
                    onClick={() => setImportTarget("teamA")}
                  >
                    导入到 A 队：{teamAProfile.name}
                  </button>
                  <button
                    className={importTarget === "teamB" ? "active" : ""}
                    type="button"
                    onClick={() => setImportTarget("teamB")}
                  >
                    导入到 B 队：{teamBProfile.name}
                  </button>
                </div>

                <label className="import-file">
                  <Database size={16} aria-hidden="true" />
                  <span>选择 CSV / JSON 文件</span>
                  <input
                    type="file"
                    accept=".csv,.json,text/csv,application/json"
                    onChange={(event) => void readImportFile(event.target.files?.[0] ?? null)}
                  />
                </label>

                <label className="field">
                  <span>粘贴球员数据</span>
                  <textarea
                    className="import-textarea"
                    value={importText}
                    onChange={(event) => {
                      setImportText(event.target.value);
                      setImportError(null);
                    }}
                  />
                </label>

                <div className="import-help">
                  <strong>字段格式</strong>
                  <span>name, role, status, form, goals, assists, defense, minutes, note</span>
                  <span>status 可用：ready / doubt / injured / suspended，也支持中文“可出场、待评估、伤缺、停赛”。</span>
                </div>

                {importError ? <p className="error-text">{importError}</p> : null}

                <div className="modal-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => setImportText(samplePlayerCsv)}>
                    使用示例
                  </button>
                  <button className="btn btn-primary" type="button" onClick={applyPlayerImport}>
                    导入并刷新
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
