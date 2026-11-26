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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CostEstimate, PredictionResponse, WorkflowStep } from "@/src/lib/schemas";
import type { TeamKind, TeamSlot, WorkspaceView, PlayerStatus, TeamProfile, FormState, FilterState, ProbabilitySummary, MatchupInsight, KeeperPenaltyInsight, TacticalChain, CoachProfile, ActiveModal, AccountUser, AccountCostSummary, LiveImportStatus, LiveTeamResponse, EventPlayerProfile, PlayerEventDataResponse, OfficialSourcesResponse, MatchIntelligenceResponse, FixtureProvider, ScheduledFixture, FixtureScheduleResponse } from "@/src/lib/workspace-ui-types";
import { StructuredPredictionSummary } from "@/src/components/structured-prediction-summary";
import { MockIntelligenceBrief } from "@/src/components/mock-intelligence-brief";
import { ExperienceGateway, ImmersiveFieldLayer } from "@/src/components/experience-gateway";
import { bilingualTerm, chinesePlayerName, chineseTeamName } from "@/src/lib/football-localization";
import {
  buildMockMatchIntelligence,
  type MockTeamIntelligence
} from "@/src/lib/mock-match-intelligence";

const matchProviderLabels: Record<NonNullable<MatchIntelligenceResponse["provider"]>, string> = {
  anysport: "AnySport",
  "api-football": "API-Football",
  sportmonks: "Sportmonks",
  "football-data-org": "football-data.org"
};

const fixtureProviderLabels: Record<FixtureProvider, string> = {
  anysport: "AnySport",
  "api-football": "API-Football",
  "football-data-org": "football-data.org",
  thesportsdb: "TheSportsDB 免费赛程",
  openligadb: "OpenLigaDB 免费赛程",
  "mock-offline": "本地演示赛程"
};

const fixtureCompetitionFilters = ["", "英超", "西甲", "德甲", "意甲", "法甲", "中超", "沙特联", "美职联", "欧冠"] as const;

function describeTeamImport(data: LiveTeamResponse, teams: TeamProfile[]) {
  const displayTeams = teams.map(localizeTeamMetadata);
  const clubs = displayTeams.filter((team) => team.kind === "club");
  const clubBadges = clubs.filter((team) => Boolean(team.badgeUrl)).length;
  const providerRosters = displayTeams.filter((team) => team.rosterStatus === "provider").length;
  const providerName = data.source?.name?.replace(/\s+Daily Cache$/i, "");
  const source = data.storage === "supabase"
    ? `云端缓存${providerName ? ` · ${providerName}` : ""}`
    : data.storage === "local"
      ? "开发快照"
      : data.source?.name ?? "联网数据源";
  const updated = data.snapshot?.beijingDate ? ` · 更新 ${data.snapshot.beijingDate}` : "";

  return `${source} · ${teams.length} 支 · 俱乐部队徽 ${clubBadges}/${clubs.length} · 正式名单 ${providerRosters} 队${updated}`;
}

function beijingDateValue() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function beijingFixtureDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function fixtureDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00+08:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", weekday: "short"
  }).format(date);
}

function dateTimeLocalValue(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function fixtureTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date)
    : "--:--";
}

function fixtureSearchText(fixture: ScheduledFixture) {
  return [fixture.home.name, fixture.away.name, fixture.competition, fixture.country, fixture.round, fixture.venue]
    .join(" ")
    .toLowerCase();
}

const initialForm: FormState = {
  teamA: "Manchester City",
  teamB: "Real Madrid",
  matchDate: "",
  competition: "俱乐部杯赛",
  homeTeam: "neutral",
  analysisDepth: "standard",
  billingMode: "platform",
  maxUserChargeCents: 300
};

function matchDateIssue(value: string) {
  if (!value.trim()) return "请选择未来的比赛时间。";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "比赛时间格式无效。";
  if (timestamp < Date.now() - 15 * 60_000) return "比赛已经开始或时间已过，请重新选择。";
  return null;
}

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

const workflowEnglish: Record<string, { name: string; detail: string }> = {
  "validate-input": { name: "Input Validation", detail: "Validate fixture parameters and timing." },
  "billing-authorized": { name: "Billing Gate", detail: "Confirm billing mode and spending limit." },
  "team-resolution": { name: "Team Resolution", detail: "Resolve canonical team and fixture IDs." },
  "football-data": { name: "Structured Data", detail: "Load verified team, player and event data." },
  "player-matchups": { name: "Player Matchups", detail: "Compare individual attack, defence, keeper and penalty evidence." },
  "tactical-coach": { name: "Tactics & Coaches", detail: "Assess tactical counters and coaching adjustments." },
  "public-research": { name: "Public Research", detail: "Collect attributable public information." },
  "source-verification": { name: "Source Verification", detail: "Check freshness, conflicts and source confidence." },
  prediction: { name: "Prediction", detail: "Generate evidence-grounded probabilities." },
  settlement: { name: "Cost Settlement", detail: "Record actual model and provider costs." }
};

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
    players: []
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
    players: []
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
    players: []
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
    players: []
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
    players: []
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
    players: []
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
    players: []
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
    players: []
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
    players: []
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
    players: []
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
    players: []
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
    players: []
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
    players: []
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

function preciseCurrency(cents: number) {
  const yuan = cents / 100;
  return `¥${yuan.toFixed(yuan > 0 && yuan < 0.01 ? 4 : 2)}`;
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

const countryDisplayAliases: Record<string, string> = {
  argentina: "阿根廷",
  australia: "澳大利亚",
  belgium: "比利时",
  brazil: "巴西",
  china: "中国",
  colombia: "哥伦比亚",
  croatia: "克罗地亚",
  england: "英格兰",
  france: "法国",
  germany: "德国",
  iran: "伊朗",
  italy: "意大利",
  japan: "日本",
  mexico: "墨西哥",
  morocco: "摩洛哥",
  netherlands: "荷兰",
  portugal: "葡萄牙",
  "saudi arabia": "沙特阿拉伯",
  scotland: "苏格兰",
  senegal: "塞内加尔",
  "south korea": "韩国",
  spain: "西班牙",
  "the netherlands": "荷兰",
  "united states": "美国",
  uruguay: "乌拉圭"
};

const leagueDisplayAliases: Record<string, string> = {
  "american major league soccer": "MLS",
  "chinese super league": "中超",
  "dutch eredivisie": "荷甲",
  "english premier league": "英超",
  "french ligue 1": "法甲",
  "german bundesliga": "德甲",
  "italian serie a": "意甲",
  "japanese j1 league": "J1 League",
  "major league soccer": "MLS",
  "portuguese primeira liga": "葡超",
  "saudi-arabian pro league": "沙特联",
  "saudi pro league": "沙特联",
  "south korean k league 1": "K League 1",
  "spanish la liga": "西甲"
};

const canonicalTeamNameAliases: Record<string, string> = {
  asmonaco: "monaco",
  asromafc: "asroma",
  intermiamicf: "intermiami",
  jeonbukhyundai: "jeonbukhyundaimotors",
  jeonbukhyundaimotorsfc: "jeonbukhyundaimotors",
  lafc: "losangelesfc",
  lilleosc: "lille",
  losangelesfootballclub: "losangelesfc",
  olympiquedemarseille: "marseille",
  olympiquelyonnais: "lyon",
  parissaintgermainfc: "parissaintgermain",
  psv: "psveindhoven",
  roma: "asroma",
  sportinglisbon: "sportingcp",
  ulsanhyundai: "ulsanhd",
  ulsanhyundaifc: "ulsanhd"
};

function canonicalTeamName(name: string) {
  const normalized = name
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

  return canonicalTeamNameAliases[normalized] ?? normalized;
}

// Stable artwork fallbacks keep club cards usable when a provider omits a badge.
const curatedClubBadgeUrls: Record<string, string> = {
  acmilan: "https://r2.thesportsdb.com/images/media/team/badge/wvspur1448806617.png",
  ajax: "https://r2.thesportsdb.com/images/media/team/badge/zg9tii1755495289.png",
  alhilal: "https://r2.thesportsdb.com/images/media/team/badge/w0b80d1661656916.png",
  alnassr: "https://r2.thesportsdb.com/images/media/team/badge/84yvqi1748524565.png",
  arsenal: "https://r2.thesportsdb.com/images/media/team/badge/uyhbfe1612467038.png",
  asroma: "https://r2.thesportsdb.com/images/media/team/badge/jwro2s1760820674.png",
  astonvilla: "https://www.thesportsdb.com/images/media/team/badge/97mehy1784645865.png",
  atleticomadrid: "https://r2.thesportsdb.com/images/media/team/badge/0ulh3q1719984315.png",
  barcelona: "https://r2.thesportsdb.com/images/media/team/badge/wq9sir1639406443.png",
  bayerleverkusen: "https://r2.thesportsdb.com/images/media/team/badge/3x9k851726760113.png",
  bayernmunich: "https://r2.thesportsdb.com/images/media/team/badge/01ogkh1716960412.png",
  beijingguoan: "https://r2.thesportsdb.com/images/media/team/badge/cdkguq1652626854.png",
  benfica: "https://r2.thesportsdb.com/images/media/team/badge/hj4kyc1781152436.png",
  borussiadortmund: "https://r2.thesportsdb.com/images/media/team/badge/tqo8ge1716960353.png",
  chelsea: "https://www.thesportsdb.com/images/media/team/badge/pbf4ul1782638263.png",
  eintrachtfrankfurt: "https://r2.thesportsdb.com/images/media/team/badge/rurwpy1473453269.png",
  feyenoord: "https://r2.thesportsdb.com/images/media/team/badge/uturtx1473534803.png",
  intermiami: "https://r2.thesportsdb.com/images/media/team/badge/m4it3e1602103647.png",
  intermilan: "https://r2.thesportsdb.com/images/media/team/badge/ryhu6d1617113103.png",
  jeonbukhyundaimotors: "https://r2.thesportsdb.com/images/media/team/badge/8jif3b1747853225.png",
  juventus: "https://r2.thesportsdb.com/images/media/team/badge/uxf0gr1742983727.png",
  lagalaxy: "https://r2.thesportsdb.com/images/media/team/badge/ysyysr1420227188.png",
  lille: "https://r2.thesportsdb.com/images/media/team/badge/2giize1534005340.png",
  liverpool: "https://r2.thesportsdb.com/images/media/team/badge/kfaher1737969724.png",
  losangelesfc: "https://r2.thesportsdb.com/images/media/team/badge/7nbj2a1602103638.png",
  lyon: "https://r2.thesportsdb.com/images/media/team/badge/blk9771656932845.png",
  manchestercity: "https://r2.thesportsdb.com/images/media/team/badge/vwpvry1467462651.png",
  manchesterunited: "https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png",
  marseille: "https://r2.thesportsdb.com/images/media/team/badge/c6bazh1779212287.png",
  monaco: "https://r2.thesportsdb.com/images/media/team/badge/exjf5l1678808044.png",
  napoli: "https://r2.thesportsdb.com/images/media/team/badge/l8qyxv1742982541.png",
  newcastleunited: "https://r2.thesportsdb.com/images/media/team/badge/lhwuiz1621593302.png",
  parissaintgermain: "https://r2.thesportsdb.com/images/media/team/badge/rwqrrq1473504808.png",
  porto: "https://r2.thesportsdb.com/images/media/team/badge/xu47rb1628855600.png",
  psveindhoven: "https://r2.thesportsdb.com/images/media/team/badge/xfsz6i1721297428.png",
  rbleipzig: "https://r2.thesportsdb.com/images/media/team/badge/zjgapo1594244951.png",
  realmadrid: "https://r2.thesportsdb.com/images/media/team/badge/vwvwrw1473502969.png",
  realsociedad: "https://r2.thesportsdb.com/images/media/team/badge/vptvpr1473502986.png",
  sevilla: "https://r2.thesportsdb.com/images/media/team/badge/vpsqqx1473502977.png",
  shandongtaishan: "https://r2.thesportsdb.com/images/media/team/badge/vheyu21654266995.png",
  shanghaiport: "https://r2.thesportsdb.com/images/media/team/badge/d9evs91776534441.png",
  shanghaishenhua: "https://r2.thesportsdb.com/images/media/team/badge/p0r1bj1654266974.png",
  sportingcp: "https://www.thesportsdb.com/images/media/team/badge/5hiuk71783137875.png",
  tottenhamhotspur: "https://r2.thesportsdb.com/images/media/team/badge/dfyfhl1604094109.png",
  ulsanhd: "https://r2.thesportsdb.com/images/media/team/badge/0wooic1706533767.png",
  urawareddiamonds: "https://r2.thesportsdb.com/images/media/team/badge/ce3lhk1578239741.png",
  villarreal: "https://r2.thesportsdb.com/images/media/team/badge/vrypqy1473503073.png",
  visselkobe: "https://r2.thesportsdb.com/images/media/team/badge/2axjch1578239819.png",
  yokohamafmarinos: "https://r2.thesportsdb.com/images/media/team/badge/rgeshm1578240000.png"
};

function localizeTeamMetadata(team: TeamProfile): TeamProfile {
  return {
    ...team,
    badgeUrl:
      team.badgeUrl ||
      (team.kind === "club" ? curatedClubBadgeUrls[canonicalTeamName(team.name)] : undefined),
    country: countryDisplayAliases[normalizeCountryName(team.country)] ?? team.country,
    league: leagueDisplayAliases[team.league.trim().toLowerCase()] ?? team.league
  };
}

function getHomeLabel(form: FormState) {
  if (form.homeTeam === "team_a") return `${form.teamA || "球队 A"} 主场`;
  if (form.homeTeam === "team_b") return `${form.teamB || "球队 B"} 主场`;
  return "中立场";
}

function teamKey(team: TeamProfile) {
  return `${canonicalTeamName(team.name)}::${team.kind}`;
}

function isSeniorTeamProfile(team: TeamProfile) {
  const label = `${team.name} ${team.league}`.toLowerCase();
  return !/\b(?:u[- ]?(?:15|16|17|18|19|20|21|22|23)|under[- ]?(?:15|16|17|18|19|20|21|22|23)|youth|reserve)\b/.test(label);
}

function mergeTeamCatalogs(liveTeams: TeamProfile[]) {
  const map = new Map<string, TeamProfile>();
  [...liveTeams, ...baseTeamCatalog].filter(isSeniorTeamProfile).forEach((team) => {
    const localizedTeam = localizeTeamMetadata(team);
    const key = teamKey(localizedTeam);
    if (!map.has(key)) {
      map.set(key, localizedTeam);
    }
  });
  return Array.from(map.values());
}

function mergeLiveTeams(current: TeamProfile[], incoming: TeamProfile[]) {
  const map = new Map<string, TeamProfile>();
  [...current, ...incoming].forEach((team) => {
    const key = teamKey(team);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, team);
      return;
    }

    const rosterScore = (candidate: TeamProfile) => {
      const providerPlayers = candidate.players.filter(
        (player) => player.rosterStatus === "provider" || player.rosterStatus === "user-imported"
      );
      return providerPlayers.length * 10
        + providerPlayers.filter((player) => Boolean(player.avatarUrl?.trim())).length * 2
        + providerPlayers.filter((player) => typeof player.heightCm === "number").length * 2
        + providerPlayers.filter((player) => Boolean(player.nameZh?.trim())).length * 2;
    };
    const keepExistingRoster = rosterScore(existing) > rosterScore(team);
    map.set(key, {
      ...existing,
      ...team,
      badgeUrl: team.badgeUrl || existing.badgeUrl,
      fanartUrl: team.fanartUrl || existing.fanartUrl,
      stadium: team.stadium || existing.stadium,
      stadiumCapacity: team.stadiumCapacity ?? existing.stadiumCapacity,
      coach: team.coach ?? existing.coach,
      players: keepExistingRoster ? existing.players : team.players,
      rosterStatus: keepExistingRoster ? existing.rosterStatus : team.rosterStatus,
      rosterUpdatedAt: keepExistingRoster ? existing.rosterUpdatedAt : team.rosterUpdatedAt
    });
  });
  return Array.from(map.values());
}

function findTeam(name: string, teams: TeamProfile[] = baseTeamCatalog) {
  const key = canonicalTeamName(name);
  return teams.find((team) => canonicalTeamName(team.name) === key);
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
    players: []
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

  if (result.prediction) {
    return {
      teamA: result.prediction.probabilities.teamA,
      draw: result.prediction.probabilities.draw,
      teamB: result.prediction.probabilities.teamB,
      score: result.prediction.likelyScores.join(" / ") || "待生成"
    };
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

function optionalBoundedNumber(value: unknown, min: number, max: number) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
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
    nameZh: String(row.nameZh ?? row.chineseName ?? row["中文名"] ?? "").trim(),
    role,
    status,
    form: boundedNumber(row.form ?? row["状态分"], 70),
    goals: boundedNumber(row.goals ?? row["进球"], 0, 0, 99),
    assists: boundedNumber(row.assists ?? row["助攻"], 0, 0, 99),
    defense: boundedNumber(row.defense ?? row["防守"], 60),
    minutes: boundedNumber(row.minutes ?? row["预计出场"], 75),
    age: optionalBoundedNumber(row.age ?? row["年龄"], 14, 60),
    shirtNumber: optionalBoundedNumber(row.shirtNumber ?? row.number ?? row["号码"], 0, 99),
    heightCm: optionalBoundedNumber(row.heightCm ?? row.height ?? row["身高"], 140, 230),
    metricsStatus: "user-imported",
    rosterStatus: "user-imported",
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
  if (status === "simulated") return <Sparkles size={16} aria-hidden="true" />;
  if (status === "blocked") return <ShieldAlert size={16} aria-hidden="true" />;
  if (status === "missing") return <AlertTriangle size={16} aria-hidden="true" />;
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

function UiBilingual({ zh, en, compact = false }: { zh: string; en: string; compact?: boolean }) {
  return (
    <span className={`ui-bilingual ${compact ? "compact" : ""}`}>
      <span>{zh}</span>
      <small>{en}</small>
    </span>
  );
}

function FootballName({
  name,
  type = "team",
  translation: suppliedTranslation = ""
}: {
  name: string;
  type?: "team" | "player";
  translation?: string;
}) {
  const translation = type === "player" ? chinesePlayerName(name, suppliedTranslation) : chineseTeamName(name);
  return (
    <span className="football-name">
      <span>{name}</span>
      {translation ? <small>{translation}</small> : null}
    </span>
  );
}

function BilingualTerm({ value }: { value: string }) {
  const translation = bilingualTerm(value);
  return (
    <span className="bilingual-term">
      <span>{value}</span>
      {translation ? <small>{translation}</small> : null}
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
  onImportEvents,
  allowMockData = false
}: {
  teamA: TeamProfile;
  teamB: TeamProfile;
  probability: ProbabilitySummary;
  eventData: PlayerEventDataResponse | null;
  eventLoading: boolean;
  onImportEvents: () => void;
  allowMockData?: boolean;
}) {
  const predictionReady = probability.teamA + probability.draw + probability.teamB > 0;
  const drawEnd = probability.teamA + probability.draw;
  const eventSummary = eventData?.summary;
  const metricsAvailable = teamA.metricsStatus === "verified" && teamB.metricsStatus === "verified"
    || allowMockData && teamA.metricsStatus === "mock" && teamB.metricsStatus === "mock";
  const teamAThreat = metricsAvailable ? clampMetric(teamA.attack * 0.42 + teamA.press * 0.25 + teamA.xgFor * 12, 18, 88) : 0;
  const teamBThreat = metricsAvailable ? clampMetric(teamB.attack * 0.42 + teamB.press * 0.25 + teamB.xgFor * 12, 18, 88) : 0;
  const teamABalance = metricsAvailable ? clampMetric((teamA.attack + teamA.defense + teamA.form) / 3) : 0;
  const teamBBalance = metricsAvailable ? clampMetric((teamB.attack + teamB.defense + teamB.form) / 3) : 0;

  return (
    <div className="visual-dashboard">
      <div className="visual-card probability-visual">
        <div
          className="probability-donut"
          style={{
            background: predictionReady
              ? `conic-gradient(var(--green) 0 ${probability.teamA}%, var(--amber) ${probability.teamA}% ${drawEnd}%, var(--blue) ${drawEnd}% 100%)`
              : "var(--surface-soft)"
          }}
        >
          <div>
            <strong>{predictionReady ? `${probability.teamA}%` : "--"}</strong>
            <span>{teamA.name}</span>
          </div>
        </div>
        <div className="visual-legend">
          <span>
            <i className="green" />
            {teamA.name} {predictionReady ? `${probability.teamA}%` : "--"}
          </span>
          <span>
            <i className="amber" />
            平局 {predictionReady ? `${probability.draw}%` : "--"}
          </span>
          <span>
            <i className="blue" />
            {teamB.name} {predictionReady ? `${probability.teamB}%` : "--"}
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
            <span>{metricsAvailable ? teamA.attack : "--"}</span>
          </div>
          <div className="pitch-team-chip right">
            <span>{metricsAvailable ? teamB.attack : "--"}</span>
            <TeamBadge team={teamB} />
          </div>
          <b>{probability.score}</b>
        </div>
        <div className="pitch-data-row">
          <span>进攻势能 {metricsAvailable ? `${teamA.attack} / ${teamB.attack}` : "待核验"}</span>
          <span>压迫 {metricsAvailable ? `${teamA.press} / ${teamB.press}` : "待核验"}</span>
          <span>xG {metricsAvailable ? `${teamA.xgFor.toFixed(2)} / ${teamB.xgFor.toFixed(2)}` : "待核验"}</span>
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
            <b>{metricsAvailable ? teamABalance : "--"}</b>
            <i style={{ width: `${teamABalance}%` }} />
          </div>
          <div>
            <span>对手均衡</span>
            <b>{metricsAvailable ? teamBBalance : "--"}</b>
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

function mockRecentLabel(value: MockTeamIntelligence["recent"][number]) {
  if (value === "W") return "胜";
  if (value === "D") return "平";
  return "负";
}

function applyMockTeamIntelligence(base: TeamProfile, intelligence: MockTeamIntelligence): TeamProfile {
  return {
    ...base,
    metricsStatus: "mock",
    rosterStatus: "placeholder",
    source: "Mock scenario engine",
    attack: intelligence.attack,
    defense: intelligence.defense,
    form: intelligence.form,
    fitness: intelligence.fitness,
    possession: intelligence.possession,
    press: intelligence.press,
    injurySafety: intelligence.injurySafety,
    xgFor: intelligence.xgFor,
    xgAgainst: intelligence.xgAgainst,
    recent: intelligence.recent.map(mockRecentLabel),
    players: intelligence.players.map((player) => ({
      ...player,
      metricsStatus: "mock",
      rosterStatus: "placeholder"
    })),
    coach: {
      name: intelligence.coach.name,
      source: "Mock scenario",
      metricsStatus: "mock",
      flexibility: intelligence.coach.flexibility,
      substitution: intelligence.coach.substitution,
      gameState: intelligence.coach.gameState
    }
  };
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

function isPlayerMetricsVerified(player: PlayerStatus) {
  return player.metricsStatus === "verified" || player.metricsStatus === "user-imported";
}

function isPlayerMetricsAvailable(player: PlayerStatus, allowMock = false) {
  return isPlayerMetricsVerified(player) || allowMock && player.metricsStatus === "mock";
}

function verifiedPlayerHeight(player: PlayerStatus) {
  return typeof player.heightCm === "number" && Number.isFinite(player.heightCm)
    ? player.heightCm
    : null;
}

function playerBioLine(player: PlayerStatus) {
  const values = [
    typeof player.shirtNumber === "number" ? `#${player.shirtNumber}` : null,
    typeof player.age === "number" ? `${player.age} 岁` : null,
    typeof player.heightCm === "number" ? `${player.heightCm}cm` : null
  ].filter(Boolean);
  return values.length ? values.join(" / ") : "号码、年龄、身高待数据源补齐";
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
    const attackerHeight = verifiedPlayerHeight(row.attacker);
    const defenderHeight = verifiedPlayerHeight(row.defender);
    const aerialEdge = attackerHeight !== null && defenderHeight !== null
      ? attackerHeight - defenderHeight
      : null;
    const edge = attackValue - defenseValue;
    const duelNote =
      edge > 8
        ? "进攻端有制造一对一压力的空间。"
        : edge < -8
          ? "防守端对抗和封堵占优。"
          : "对位接近，临场状态会放大影响。";

    return {
      ...row,
      attackValue,
      defenseValue,
      aerialEdge,
      note: aerialEdge === null
        ? `${duelNote} 身高数据缺失，未判断高空优势。`
        : duelNote
    };
  });
}

function buildKeeperPenaltyInsight(teamA: TeamProfile, teamB: TeamProfile, allowMock = false): KeeperPenaltyInsight[] {
  const pairs = [
    {
      keeper: pickPlayer(teamB, ["goal", "门将"], 4),
      shooter: pickPlayer(teamA, ["centre forward", "striker", "前锋"], 7)
    },
    {
      keeper: pickPlayer(teamA, ["goal", "门将"], 4),
      shooter: pickPlayer(teamB, ["centre forward", "striker", "前锋"], 7)
    }
  ];

  return pairs.flatMap(({ keeper, shooter }) => {
    const penaltiesFaced = keeper.penaltiesFaced ?? 0;
    const penaltiesTaken = shooter.penaltiesTaken ?? 0;
    if (!isPlayerMetricsAvailable(keeper, allowMock) || !isPlayerMetricsAvailable(shooter, allowMock) || penaltiesFaced <= 0 || penaltiesTaken <= 0) {
      return [];
    }
    const penaltySave = clampMetric(((keeper.penaltySaves ?? 0) / penaltiesFaced) * 100);
    const penaltyScore = clampMetric(((shooter.penaltiesScored ?? 0) / penaltiesTaken) * 100);
    return [{
      keeper,
      shooter,
      saveValue: keeper.shotsOnTarget ? clampMetric(((keeper.saves ?? 0) / keeper.shotsOnTarget) * 100) : penaltySave,
      shotValue: penaltyScore,
      penaltySave,
      penaltyScore
    }];
  });
}

function buildTacticalChains(teamA: TeamProfile, teamB: TeamProfile): TacticalChain[] {
  const aForwardHeight = verifiedPlayerHeight(pickPlayer(teamA, ["forward", "striker", "前锋"], 0));
  const bDefenderHeight = verifiedPlayerHeight(pickPlayer(teamB, ["defender", "back", "后卫"], 3));
  const aerialHeightReady = aForwardHeight !== null && bDefenderHeight !== null;
  const aAerial = clampMetric(teamA.attack * 0.62 + teamA.press * 0.18 + (aForwardHeight ? (aForwardHeight - 170) * 0.7 : 0));
  const bAerialDef = clampMetric(teamB.defense * 0.7 + (bDefenderHeight ? (bDefenderHeight - 170) * 0.75 : 0));
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
      verdict: !aerialHeightReady
        ? "双方身高数据不完整，暂不判断高空克制。"
        : aAerial > bAerialDef
          ? "传中点可能形成错位。"
          : "防空端能缓冲高球压力。"
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

function buildCoachProfiles(teamA: TeamProfile, teamB: TeamProfile, allowMock = false): CoachProfile[] {
  return [teamA, teamB].flatMap((team) => {
    const coach = team.coach;
    if (
      (coach?.metricsStatus !== "verified" && (!allowMock || coach?.metricsStatus !== "mock"))
      || typeof coach.flexibility !== "number"
      || typeof coach.substitution !== "number"
      || typeof coach.gameState !== "number"
    ) {
      return [];
    }
    return [{
      teamName: team.name,
      flexibility: coach.flexibility,
      substitution: coach.substitution,
      gameState: coach.gameState,
      risk:
        coach.gameState >= 78
          ? "调整空间较大"
          : coach.gameState >= 64
            ? "调整能力中等"
            : "临场变化偏保守"
    }];
  });
}

const nonPlayingRoleFragments = [
  "coach", "manager", "president", "chairman", "assistant", "ceo", "chief",
  "director", "operations", "executive", "owner", "board", "staff", "scout",
  "physio", "doctor", "analyst", "administrator", "coordinator", "secretary"
];

function isNonPlayingStaffRole(role: string) {
  const normalizedRole = role.trim().toLowerCase();
  return nonPlayingRoleFragments.some((fragment) => normalizedRole.includes(fragment));
}

function displayRosterPlayers(team: TeamProfile) {
  return (team.players ?? []).filter(
    (player) => (player.rosterStatus === "provider" || player.rosterStatus === "user-imported")
      && !isNonPlayingStaffRole(player.role)
  );
}

function PlayerCard({ player, onOpen, allowMock = false }: { player: PlayerStatus; onOpen: () => void; allowMock?: boolean }) {
  const verified = isPlayerMetricsAvailable(player, allowMock);
  const mock = allowMock && player.metricsStatus === "mock";
  return (
    <div className={`player-card ${player.status}${mock ? " mock" : ""}`}>
      <div className="player-card-top">
        <div className="player-card-identity">
          <PlayerAvatar player={player} />
          <div>
            <strong><FootballName name={player.name} type="player" translation={player.nameZh} /></strong>
            <BilingualTerm value={player.role} />
          </div>
        </div>
        <button type="button" onClick={onOpen}>
          {mock ? "演示状态" : verified ? statusLabel(player.status) : "状态待核验"}
        </button>
      </div>
      <div className="player-stats">
        <span>状态 {verified ? player.form : "--"}</span>
        <span>进球 {verified ? player.goals : "--"}</span>
        <span>助攻 {verified ? player.assists : "--"}</span>
        <span>防守 {verified ? player.defense : "--"}</span>
      </div>
      {mock ? (
        <span className="data-quality-tag mock">演示球员 · 非真实个人数据</span>
      ) : !verified ? (
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
  const players = displayRosterPlayers(team);

  return (
    <div className="team-roster-preview">
      <div className="team-roster-head">
        <div>
          <strong><UiBilingual zh="球员详情" en="Player Details" /></strong>
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
      {team.coach ? (
        <div className="team-roster-coach">
          {team.coach.photoUrl ? <img src={team.coach.photoUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <UserRoundCheck size={18} aria-hidden="true" />}
          <span>
            <strong><UiBilingual zh="主教练" en="Head Coach" compact /> <FootballName name={team.coach.name} type="player" /></strong>
            <small>
              {[team.coach.nationality, typeof team.coach.age === "number" ? `${team.coach.age} 岁` : null, team.coach.source]
                .filter(Boolean)
                .join(" / ")}
            </small>
          </span>
        </div>
      ) : null}
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
                <strong><FootballName name={player.name} type="player" translation={player.nameZh} /></strong>
                <em><BilingualTerm value={player.role} /></em>
              </span>
              <span className="team-roster-player-data">
                <b>{isPlayerMetricsVerified(player) ? statusLabel(player.status) : "状态待核验"}</b>
                <small>{playerBioLine(player)}</small>
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

function WorkspaceApp() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [activeView, setActiveView] = useState<WorkspaceView>("match");
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
  const [accountCostSummary, setAccountCostSummary] = useState<AccountCostSummary | null>(null);
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
  const [fixtureDate, setFixtureDate] = useState(beijingDateValue);
  const [fixtureSearch, setFixtureSearch] = useState("");
  const [fixtureDayFilter, setFixtureDayFilter] = useState("");
  const [selectedFixture, setSelectedFixture] = useState<ScheduledFixture | null>(null);
  const [fixtureSchedule, setFixtureSchedule] = useState<{
    loading: boolean;
    fixtures: ScheduledFixture[];
    providers: FixtureProvider[];
    fetchedAt: string | null;
    message: string | null;
    error: string | null;
    dataMode: "live" | "mock" | null;
    fallbackReason: string | null;
  }>({ loading: false, fixtures: [], providers: [], fetchedAt: null, message: null, error: null, dataMode: null, fallbackReason: null });
  const fixtureRequestId = useRef(0);
  const autoBadgeImportStarted = useRef(false);
  const workspaceInteractionRef = useRef<HTMLElement>(null);
  const stadiumHeroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = workspaceInteractionRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.matchMedia("(pointer: coarse)").matches) return;

    const surfaceSelector = [
      ".panel", ".fixture-card", ".team-option-shell", ".workflow-item", ".visual-card", ".prob-card",
      ".team-state-card", ".matchup-card", ".keeper-penalty-card", ".coach-card", ".tactical-card"
    ].join(",");
    const magneticSelector = ".step-switcher button, .btn-primary, .account-button, .fixture-refresh-button, .fixture-league-shortcuts button";
    let activeSurface: HTMLElement | null = null;
    let activeMagnetic: HTMLElement | null = null;
    let frame = 0;
    let pendingPointer: { x: number; y: number; target: Element | null } | null = null;

    const resetSurface = (element: HTMLElement | null) => {
      element?.style.setProperty("--spot-opacity", "0");
      element?.classList.remove("pointer-reactive");
    };

    const resetMagnetic = (element: HTMLElement | null) => {
      element?.style.setProperty("--magnet-x", "0px");
      element?.style.setProperty("--magnet-y", "0px");
    };

    const applyPointer = () => {
      frame = 0;
      if (!pendingPointer) return;
      const { x, y, target } = pendingPointer;
      const surface = target?.closest(surfaceSelector) as HTMLElement | null;
      if (surface !== activeSurface) {
        resetSurface(activeSurface);
        activeSurface = surface;
      }
      if (surface) {
        const bounds = surface.getBoundingClientRect();
        surface.classList.add("pointer-reactive");
        surface.style.setProperty("--spot-x", `${x - bounds.left}px`);
        surface.style.setProperty("--spot-y", `${y - bounds.top}px`);
        surface.style.setProperty("--spot-opacity", "1");
      }

      const magnetic = target?.closest(magneticSelector) as HTMLElement | null;
      if (magnetic !== activeMagnetic) {
        resetMagnetic(activeMagnetic);
        activeMagnetic = magnetic;
      }
      if (magnetic) {
        const bounds = magnetic.getBoundingClientRect();
        const offsetX = Math.max(-5, Math.min(5, (x - bounds.left - bounds.width / 2) * 0.09));
        const offsetY = Math.max(-4, Math.min(4, (y - bounds.top - bounds.height / 2) * 0.09));
        magnetic.style.setProperty("--magnet-x", `${offsetX}px`);
        magnetic.style.setProperty("--magnet-y", `${offsetY}px`);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      pendingPointer = {
        x: event.clientX,
        y: event.clientY,
        target: event.target instanceof Element ? event.target : null
      };
      if (!frame) frame = window.requestAnimationFrame(applyPointer);
    };

    const resetPointer = () => {
      pendingPointer = null;
      resetSurface(activeSurface);
      resetMagnetic(activeMagnetic);
      activeSurface = null;
      activeMagnetic = null;
    };

    root.addEventListener("pointermove", handlePointerMove);
    root.addEventListener("pointerleave", resetPointer);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerleave", resetPointer);
      resetPointer();
    };
  }, []);

  useEffect(() => {
    const hero = stadiumHeroRef.current;
    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.matchMedia("(pointer: coarse)").matches) return;

    let frame = 0;
    let pendingPointer: { x: number; y: number } | null = null;

    const applyPointer = () => {
      frame = 0;
      if (!pendingPointer) return;
      const bounds = hero.getBoundingClientRect();
      const xRatio = Math.max(-0.5, Math.min(0.5, (pendingPointer.x - bounds.left) / Math.max(1, bounds.width) - 0.5));
      const yRatio = Math.max(-0.5, Math.min(0.5, (pendingPointer.y - bounds.top) / Math.max(1, bounds.height) - 0.5));
      hero.style.setProperty("--scene-x", `${xRatio * 8}px`);
      hero.style.setProperty("--scene-y", `${yRatio * 5}px`);
      hero.style.setProperty("--scene-x-reverse", `${xRatio * -8}px`);
    };

    const handlePointerMove = (event: PointerEvent) => {
      pendingPointer = { x: event.clientX, y: event.clientY };
      if (!frame) frame = window.requestAnimationFrame(applyPointer);
    };

    const resetPointer = () => {
      pendingPointer = null;
      hero.style.setProperty("--scene-x", "0px");
      hero.style.setProperty("--scene-y", "0px");
      hero.style.setProperty("--scene-x-reverse", "0px");
    };

    hero.addEventListener("pointermove", handlePointerMove);
    hero.addEventListener("pointerleave", resetPointer);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      hero.removeEventListener("pointermove", handlePointerMove);
      hero.removeEventListener("pointerleave", resetPointer);
      resetPointer();
    };
  }, []);

  const loadFixtureSchedule = useCallback(async (date: string, forceRefresh = false) => {
    const requestId = fixtureRequestId.current + 1;
    fixtureRequestId.current = requestId;
    setFixtureSchedule((current) => ({ ...current, loading: true, message: null, error: null }));
    try {
      const response = await fetch(`/api/fixtures?date=${encodeURIComponent(date)}&days=30${forceRefresh ? "&refresh=1" : ""}`, {
        headers: { Accept: "application/json" }
      });
      const data = (await response.json()) as FixtureScheduleResponse;
      if (!response.ok || !data.ok) throw new Error(data.error ?? "赛程加载失败。请检查体育数据 Key 和网络。 ");
      if (fixtureRequestId.current !== requestId) return;
      const fixtures = data.fixtures ?? [];
      const providers = data.providers ?? [];
      const failedProviderCount = data.providerErrors?.length ?? 0;
      const isOfflineDemo = data.dataMode === "mock";
      setFixtureSchedule({
        loading: false,
        fixtures,
        providers,
        fetchedAt: data.fetchedAt ?? null,
        message: `${fixtures.length} 场${isOfflineDemo ? "离线演示赛程" : "真实未来赛程"} · ${providers.map((provider) => fixtureProviderLabels[provider]).join(" + ") || "正式数据源"}${failedProviderCount ? ` · ${failedProviderCount} 个源暂不可用` : ""}${data.fetchedAt ? ` · 更新 ${fixtureTime(data.fetchedAt)}` : ""}${data.cached ? " · 缓存" : ""}`,
        error: null,
        dataMode: data.dataMode ?? "live",
        fallbackReason: data.fallbackReason ?? null
      });
    } catch (loadError) {
      if (fixtureRequestId.current !== requestId) return;
      setFixtureSchedule((current) => ({
        ...current,
        loading: false,
        message: null,
        error: loadError instanceof Error ? loadError.message : "赛程加载失败。",
        dataMode: current.dataMode,
        fallbackReason: current.fallbackReason
      }));
    }
  }, []);

  const workflow = result?.workflow ?? defaultWorkflow;
  const completedSteps = workflow.filter((step) => step.status === "complete" || step.status === "simulated").length;
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
  const hasVerifiedTeamMetrics = teamAProfile.metricsStatus === "verified" && teamBProfile.metricsStatus === "verified";
  const mockIntelligence = useMemo(
    () => buildMockMatchIntelligence({
      teamA: form.teamA,
      teamB: form.teamB,
      competition: form.competition,
      homeTeam: form.homeTeam
    }),
    [form.competition, form.homeTeam, form.teamA, form.teamB]
  );
  const usingMockIntelligence = runtimeMode === "mock";
  const useMockProfiles = usingMockIntelligence && !hasVerifiedTeamMetrics;
  const analysisTeamAProfile = useMemo(
    () => useMockProfiles ? applyMockTeamIntelligence(teamAProfile, mockIntelligence.teamA) : teamAProfile,
    [mockIntelligence.teamA, teamAProfile, useMockProfiles]
  );
  const analysisTeamBProfile = useMemo(
    () => useMockProfiles ? applyMockTeamIntelligence(teamBProfile, mockIntelligence.teamB) : teamBProfile,
    [mockIntelligence.teamB, teamBProfile, useMockProfiles]
  );
  const teamAPlayers = useMemo(
    () => useMockProfiles ? analysisTeamAProfile.players : displayRosterPlayers(analysisTeamAProfile),
    [analysisTeamAProfile, useMockProfiles]
  );
  const teamBPlayers = useMemo(
    () => useMockProfiles ? analysisTeamBProfile.players : displayRosterPlayers(analysisTeamBProfile),
    [analysisTeamBProfile, useMockProfiles]
  );
  const probability = result ? reportProbability : usingMockIntelligence ? mockIntelligence.probability : reportProbability;
  const hasAnalysisTeamMetrics = hasVerifiedTeamMetrics || useMockProfiles;
  const hasAnalysisPlayerMetrics =
    analysisTeamAProfile.players.length >= 5
    && analysisTeamBProfile.players.length >= 5
    && [...analysisTeamAProfile.players, ...analysisTeamBProfile.players]
      .every((player) => isPlayerMetricsAvailable(player, useMockProfiles));
  const matchupInsights = useMemo(
    () => hasAnalysisTeamMetrics && hasAnalysisPlayerMetrics
      ? buildMatchupInsights(analysisTeamAProfile, analysisTeamBProfile)
      : [],
    [analysisTeamAProfile, analysisTeamBProfile, hasAnalysisPlayerMetrics, hasAnalysisTeamMetrics]
  );
  const keeperPenaltyInsights = useMemo(
    () => hasAnalysisTeamMetrics && hasAnalysisPlayerMetrics
      ? buildKeeperPenaltyInsight(analysisTeamAProfile, analysisTeamBProfile, useMockProfiles)
      : [],
    [analysisTeamAProfile, analysisTeamBProfile, hasAnalysisPlayerMetrics, hasAnalysisTeamMetrics, useMockProfiles]
  );
  const tacticalChains = useMemo(
    () => hasAnalysisTeamMetrics && hasAnalysisPlayerMetrics
      ? buildTacticalChains(analysisTeamAProfile, analysisTeamBProfile)
      : [],
    [analysisTeamAProfile, analysisTeamBProfile, hasAnalysisPlayerMetrics, hasAnalysisTeamMetrics]
  );
  const coachProfiles = useMemo(
    () => hasAnalysisTeamMetrics
      ? buildCoachProfiles(analysisTeamAProfile, analysisTeamBProfile, useMockProfiles)
      : [],
    [analysisTeamAProfile, analysisTeamBProfile, hasAnalysisTeamMetrics, useMockProfiles]
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
  const fixtureDateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    fixtureSchedule.fixtures.forEach((fixture) => {
      const date = beijingFixtureDate(fixture.startsAt);
      if (date) counts.set(date, (counts.get(date) ?? 0) + 1);
    });
    return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [fixtureSchedule.fixtures]);
  const fixturesForSelectedDay = useMemo(
    () => fixtureDayFilter
      ? fixtureSchedule.fixtures.filter((fixture) => beijingFixtureDate(fixture.startsAt) === fixtureDayFilter)
      : fixtureSchedule.fixtures,
    [fixtureDayFilter, fixtureSchedule.fixtures]
  );
  const visibleFixtures = useMemo(() => {
    const keyword = fixtureSearch.trim().toLowerCase();
    if (!keyword) return fixturesForSelectedDay;
    return fixturesForSelectedDay.filter((fixture) => fixtureSearchText(fixture).includes(keyword));
  }, [fixturesForSelectedDay, fixtureSearch]);
  const fixtureLeagueGroups = useMemo(() => {
    const groups = new Map<string, { competition: string; country: string; fixtures: ScheduledFixture[] }>();

    visibleFixtures.forEach((fixture) => {
      const competition = fixture.competition || "其他赛事";
      const country = fixture.country || "国际";
      const key = `${country}\u0000${competition}`;
      const group = groups.get(key) ?? { competition, country, fixtures: [] };
      group.fixtures.push(fixture);
      groups.set(key, group);
    });

    return [...groups.values()].sort((left, right) => {
      const leftKickoff = Date.parse(left.fixtures[0]?.startsAt ?? "");
      const rightKickoff = Date.parse(right.fixtures[0]?.startsAt ?? "");
      return leftKickoff - rightKickoff || left.competition.localeCompare(right.competition, "zh-CN");
    });
  }, [visibleFixtures]);
  const fixtureCompetitionCounts = useMemo(
    () => Object.fromEntries(fixtureCompetitionFilters.map((competition) => [
      competition,
      competition
        ? fixturesForSelectedDay.filter((fixture) => fixtureSearchText(fixture).includes(competition.toLowerCase())).length
        : fixturesForSelectedDay.length
    ])),
    [fixturesForSelectedDay]
  );
  const activeFilterCount = [filters.search, filters.league, filters.country, filters.continent, filters.tier]
    .filter((value) => value && value !== "all").length + (filters.mode === "all" ? 0 : 1);
  const filteredClubCount = filteredTeams.filter((team) => team.kind === "club").length;
  const filteredNationalCount = filteredTeams.length - filteredClubCount;
  const selectedTeamCount = new Set([form.teamA.trim(), form.teamB.trim()].filter(Boolean)).size;

  const payload = useMemo(
    () => ({
      ...form,
      matchDate: form.matchDate && Number.isFinite(new Date(form.matchDate).getTime())
        ? new Date(form.matchDate).toISOString()
        : form.matchDate,
      maxUserChargeCents: Number(form.maxUserChargeCents),
      ...(paymentOrderId ? { paymentOrderId } : {}),
      ...(selectedFixture ? { fixtureId: selectedFixture.id, fixtureProvider: selectedFixture.provider } : {})
    }),
    [form, paymentOrderId, selectedFixture]
  );
  const workspaceTabs = useMemo(
    () => [
      { id: "match" as WorkspaceView, icon: CalendarClock, label: "选比赛", english: "Fixtures", meta: fixtureSchedule.loading ? "联网中" : `${fixtureSchedule.fixtures.length} 场` },
      { id: "teams" as WorkspaceView, icon: ListFilter, label: "选球队", english: "Teams", meta: `手动 · ${selectedTeamCount} 支` },
      { id: "analysis" as WorkspaceView, icon: BarChart3, label: "数据分析", english: "Analysis", meta: eventData ? "真实样本" : runtimeMode === "mock" ? "演示情报" : "待获取" },
      { id: "report" as WorkspaceView, icon: FileText, label: "报告", english: "Report", meta: result ? "已生成" : "待生成" }
    ],
    [eventData, fixtureSchedule.fixtures.length, fixtureSchedule.loading, result, runtimeMode, selectedTeamCount]
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
    if (activeView !== "match") return;
    setFixtureDayFilter("");
    void loadFixtureSchedule(fixtureDate);
  }, [activeView, fixtureDate, loadFixtureSchedule]);

  useEffect(() => {
    if (!accountUser) {
      setAccountCostSummary(null);
      return;
    }
    const controller = new AbortController();
    void fetch("/api/costs/summary?days=30", { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        if (data.ok) setAccountCostSummary(data.summary);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [accountUser]);

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
              message: describeTeamImport(cached, cachedTeams),
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
          message: describeTeamImport(data, teams),
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
    if (patch.teamA !== undefined || patch.teamB !== undefined || patch.matchDate !== undefined || patch.competition !== undefined) {
      setSelectedFixture(null);
      setMatchIntelligence(null);
      setMatchIntelligenceStatus((current) => ({ ...current, message: null, error: null }));
    }
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

  function selectScheduledFixture(fixture: ScheduledFixture) {
    updateForm({
      teamA: fixture.home.name,
      teamB: fixture.away.name,
      competition: fixture.competition,
      matchDate: dateTimeLocalValue(fixture.startsAt),
      homeTeam: "team_a"
    });
    setSelectedFixture(fixture);
    setActiveView("match");
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
        message: describeTeamImport(data, teams),
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
    const providerPlayers = displayRosterPlayers(team);
    const detailCount = providerPlayers.length;
    const existingPhotoCount = providerPlayers.filter((player) => Boolean(player.avatarUrl?.trim())).length;
    const existingHeightCount = providerPlayers.filter((player) => typeof player.heightCm === "number").length;
    const existingLocalizedCount = providerPlayers.filter((player) => Boolean(chinesePlayerName(player.name, player.nameZh))).length;
    const metadataComplete = detailCount > 0
      && existingPhotoCount / detailCount >= 0.7
      && existingHeightCount / detailCount >= 0.7
      && existingLocalizedCount / detailCount >= 0.7;
    const currentStatus = teamRosterFetch[key];

    if (metadataComplete || currentStatus?.loading) {
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
      const matchingPlayers = displayRosterPlayers(matchingTeam);
      const photoCount = matchingPlayers.filter((player) => Boolean(player.avatarUrl?.trim())).length;
      const heightCount = matchingPlayers.filter((player) => typeof player.heightCm === "number").length;
      const localizedCount = matchingPlayers.filter((player) => Boolean(chinesePlayerName(player.name, player.nameZh))).length;
      const providerUnavailable = data.notice?.toLowerCase().includes("provider unavailable") || data.source?.apiKeyMode === "cache";
      setTeamRosterFetch((current) => ({
        ...current,
        [key]: {
          loading: false,
          message: photoCount || heightCount || localizedCount
            ? `已补充 ${matchingPlayers.length} 名球员 · 照片 ${photoCount} · 身高 ${heightCount} · 中文名 ${localizedCount}`
            : providerUnavailable
              ? `实时数据源暂不可用，先显示 ${matchingPlayers.length} 名缓存球员`
              : `已补充 ${matchingPlayers.length} 名球员`,
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
          ...(selectedFixture ? { fixtureId: selectedFixture.id, fixtureProvider: selectedFixture.provider } : {}),
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
    setSelectedFixture(null);
    setMatchIntelligence(null);
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
    if (runtimeMode === "mock") {
      setActiveModal({ type: "mockBilling" });
      return;
    }
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
    const dateIssue = matchDateIssue(form.matchDate);
    if (dateIssue) {
      setError(dateIssue);
      return;
    }
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
    const dateIssue = matchDateIssue(form.matchDate);
    if (dateIssue) {
      setError(dateIssue);
      setActiveView("match");
      return;
    }
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
    <main className="app-shell" ref={workspaceInteractionRef}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">
              <Gauge size={21} aria-hidden="true" />
            </div>
            <div>
              <h1><UiBilingual zh="赛前情报" en="Pre-match Intelligence" compact /></h1>
              <p>足球预测 Agent · Football Prediction Agent</p>
            </div>
          </div>
          <div className="topbar-status">
            <span className="status-pill runtime-status" title={runtimeMode === "live" ? "实时数据模式" : "演示数据模式"}>
              <ShieldCheck size={15} aria-hidden="true" />
              {runtimeMode === "live" ? "实时 / Live" : "演示 / Mock"}
            </span>
            <button className="status-pill account-button" type="button" onClick={() => setActiveModal({ type: "account" })}>
              <UserRoundCheck size={15} aria-hidden="true" />
              {accountUser?.email ?? (accountConfigured ? "登录 / Sign in" : "账户待配置 / Setup")}
            </button>
          </div>
        </div>
      </header>

      <section className="stadium-hero" aria-label="match overview">
        <div className="stadium-hero-inner" ref={stadiumHeroRef}>
          <ImmersiveFieldLayer />
          <div className="hero-team">
            <TeamBadge team={teamAProfile} />
            <div>
              <BilingualTerm value={teamAProfile.kind === "club" ? teamAProfile.league : teamAProfile.continent} />
              <strong><FootballName name={form.teamA || "球队 A"} /></strong>
              <small className="team-origin-line">
                <TeamCountryFlag team={teamAProfile} compact />
                <BilingualTerm value={teamAProfile.country} /> / <BilingualTerm value={teamAProfile.tier} />
              </small>
            </div>
          </div>
          <div className="hero-center">
            <span className="hero-competition">{form.competition || "待设置赛事"}</span>
            <div className="hero-pitch">
              <div className="pitch-mini large" aria-hidden="true">
                <div className="pitch-center" />
                <div className="pitch-dot left" />
                <div className="pitch-dot right" />
                <div className="match-ball" />
              </div>
              <b>VS</b>
            </div>
            <div className="match-meta">
              <span>
                <CalendarClock size={13} aria-hidden="true" />
                {form.matchDate || "待设置时间"}
              </span>
              <span>
                <Landmark size={13} aria-hidden="true" />
                {getHomeLabel(form)}
              </span>
            </div>
            <span className={`hero-data-origin ${selectedFixture?.dataMode === "mock" ? "mock" : ""}`}>
              {selectedFixture ? selectedFixture.dataMode === "mock" ? "演示赛程" : "真实赛程" : "手动对阵"}
              <small> / </small>
              {runtimeMode === "mock" ? "模拟分析" : "真实分析"}
            </span>
          </div>
          <div className="hero-team right">
            <div>
              <BilingualTerm value={teamBProfile.kind === "club" ? teamBProfile.league : teamBProfile.continent} />
              <strong><FootballName name={form.teamB || "球队 B"} /></strong>
              <small className="team-origin-line">
                <TeamCountryFlag team={teamBProfile} compact />
                <BilingualTerm value={teamBProfile.country} /> / <BilingualTerm value={teamBProfile.tier} />
              </small>
            </div>
            <TeamBadge team={teamBProfile} />
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
              aria-current={activeView === item.id ? "step" : undefined}
              key={item.id}
            >
              <Icon size={16} aria-hidden="true" />
              <span>
                <UiBilingual zh={item.label} en={item.english} compact />
                <small>{item.meta}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <section className={`workspace view-${activeView}`} aria-label="Agent workspace" key={activeView}>
        {activeView === "teams" ? (
        <div className="panel setup-panel">
          <div className="panel-header">
            <div className="panel-title">
              <ListFilter size={18} aria-hidden="true" />
              <h2><UiBilingual zh="球队选择" en="Team Selection" /></h2>
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
                  <FootballName name={sample.teamA} /> / <FootballName name={sample.teamB} />
                </button>
              ))}
            </div>

            <div className="selection-dock" aria-label="当前对阵">
              <label className="selection-team">
                <UiBilingual zh="球队 A" en="Team A" compact />
                <div>
                  <TeamBadge team={teamAProfile} />
                  <input value={form.teamA} list="team-catalog" onChange={(event) => updateForm({ teamA: event.target.value })} aria-label="球队 A" />
                </div>
                <small>{chineseTeamName(form.teamA)} · {teamAProfile.league} / {teamAProfile.country}</small>
              </label>
              <button className="swap-team-button" type="button" onClick={swapTeams} title="交换球队" aria-label="交换球队 A 和球队 B">
                <ArrowLeftRight size={18} aria-hidden="true" />
              </button>
              <label className="selection-team right">
                <UiBilingual zh="球队 B" en="Team B" compact />
                <div>
                  <TeamBadge team={teamBProfile} />
                  <input value={form.teamB} list="team-catalog" onChange={(event) => updateForm({ teamB: event.target.value })} aria-label="球队 B" />
                </div>
                <small>{chineseTeamName(form.teamB)} · {teamBProfile.league} / {teamBProfile.country}</small>
              </label>
              <datalist id="team-catalog">
                {availableTeams.map((team) => <option value={team.name} key={team.id} />)}
              </datalist>
            </div>

            <div className="team-finder">
              <div className="selector-tabs" role="group" aria-label="球队分类">
                <button
                  className={filters.mode === "all" ? "active" : ""}
                  type="button"
                  onClick={() => updateFilters({ mode: "all" })}
                >
                  <UiBilingual zh="全部" en="All" compact />
                </button>
                <button
                  className={filters.mode === "club" ? "active" : ""}
                  type="button"
                  onClick={() => updateFilters({ mode: "club" })}
                >
                  <UiBilingual zh="俱乐部" en="Clubs" compact />
                </button>
                <button
                  className={filters.mode === "national" ? "active" : ""}
                  type="button"
                  onClick={() => updateFilters({ mode: "national" })}
                >
                  <UiBilingual zh="国家队" en="National Teams" compact />
                </button>
              </div>

              <div className="field search-field">
                <label htmlFor="teamSearch"><UiBilingual zh="搜索球队" en="Search Teams" compact /></label>
                <div>
                  <Search size={16} aria-hidden="true" />
                  <input
                    id="teamSearch"
                    value={filters.search}
                    onChange={(event) => updateFilters({ search: event.target.value })}
                    placeholder="球队、国家或联赛 / Team, country or league"
                  />
                </div>
              </div>
            </div>

            <details className="filter-details" open={activeFilterCount > 1 || undefined}>
              <summary>
                <Filter size={14} aria-hidden="true" />
                <UiBilingual zh="更多筛选" en="More Filters" compact />
                <span>{activeFilterCount ? `已启用 ${activeFilterCount} 项` : "大洲 / 国家 / 联赛 / 等级"}</span>
              </summary>
              <div className="filter-grid">
                <label>
                  <span><Globe2 size={13} aria-hidden="true" />大洲</span>
                  <select value={filters.continent} onChange={(event) => updateFilters({ continent: event.target.value })}>
                    <option value="all">全部</option>
                    {continents.map((value) => <option value={value} key={value}>{value}</option>)}
                  </select>
                </label>
                <label>
                  <span><MapPin size={13} aria-hidden="true" />国家</span>
                  <select value={filters.country} onChange={(event) => updateFilters({ country: event.target.value })}>
                    <option value="all">全部</option>
                    {countries.map((value) => <option value={value} key={value}>{value}</option>)}
                  </select>
                </label>
                <label>
                  <span><Trophy size={13} aria-hidden="true" />联赛</span>
                  <select value={filters.league} onChange={(event) => updateFilters({ league: event.target.value })}>
                    <option value="all">全部</option>
                    {leagues.map((value) => <option value={value} key={value}>{value}</option>)}
                  </select>
                </label>
                <label>
                  <span><Filter size={13} aria-hidden="true" />等级</span>
                  <select value={filters.tier} onChange={(event) => updateFilters({ tier: event.target.value })}>
                    <option value="all">全部</option>
                    {tiers.map((value) => <option value={value} key={value}>{value}</option>)}
                  </select>
                </label>
              </div>
            </details>

            <details className="data-details">
              <summary>
                <Database size={14} aria-hidden="true" />
                数据与同步
                <span>{liveTeams.length ? `已接入 ${liveTeams.length} 支` : "可联网更新"}</span>
              </summary>
              <div className="team-data-tools">
                <div className="live-import-card" aria-live="polite">
                  <div>
                    <strong>球队目录</strong>
                    <span>{liveImport.message ?? `已接入 ${liveTeams.length} 支球队与队徽`}</span>
                  </div>
                  <button className="panel-action-button live-import-button" type="button" onClick={importLiveTeams} disabled={liveImport.loading}>
                    {liveImport.loading ? <RefreshCw className="spin" size={14} aria-hidden="true" /> : <Database size={14} aria-hidden="true" />}
                    {liveImport.loading ? "同步中" : "同步"}
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
                        <strong><FootballName name={team.name} /></strong>
                        <span className="team-meta-line">
                          <TeamCountryFlag team={team} compact />
                          <span className={`team-kind-label ${team.kind}`}>
                            <UiBilingual zh={team.kind === "club" ? "俱乐部" : "国家队"} en={team.kind === "club" ? "Club" : "National Team"} compact />
                          </span>
                          <span className="team-meta-separator" aria-hidden="true">/</span>
                          <BilingualTerm value={team.league} />
                          <span className="team-meta-separator" aria-hidden="true">/</span>
                          <BilingualTerm value={team.country} />
                        </span>
                        {team.source ? (
                          <em>
                            {team.source}
                            {team.stadium ? ` / ${team.stadium}` : ""}
                          </em>
                        ) : null}
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
                <h2><UiBilingual zh="选择比赛" en="Select a Fixture" /></h2>
              </div>
            </div>
            <div className="panel-body">
              <section className="fixture-picker" aria-labelledby="fixture-picker-title">
                <div className="fixture-picker-head">
                  <div>
                    <strong id="fixture-picker-title"><UiBilingual zh="未来 30 天赛程" en="Next 30 Days" /></strong>
                    <span>优先联网加载真实赛程，失败时自动切换离线演示库 · 北京时间</span>
                  </div>
                  <div className="fixture-picker-controls">
                    <label className="fixture-date-control">
                      <CalendarClock size={16} aria-hidden="true" />
                      <input
                        type="date"
                        aria-label="赛程日期"
                        min={beijingDateValue()}
                        value={fixtureDate}
                        onChange={(event) => {
                          setFixtureDate(event.target.value);
                          setFixtureDayFilter("");
                          setSelectedFixture(null);
                        }}
                      />
                    </label>
                    <button
                      className="fixture-refresh-button"
                      type="button"
                      title="刷新当天赛程"
                      aria-label="刷新当天赛程"
                      disabled={fixtureSchedule.loading}
                      onClick={() => void loadFixtureSchedule(fixtureDate, true)}
                    >
                      <RefreshCw className={fixtureSchedule.loading ? "spin" : ""} size={16} aria-hidden="true" />
                      <UiBilingual zh="实时刷新" en="Refresh Live" compact />
                    </button>
                  </div>
                </div>

                <div className="fixture-toolbar">
                  <label className="fixture-search">
                    <Search size={15} aria-hidden="true" />
                    <input
                      type="search"
                      aria-label="搜索比赛"
                      placeholder="搜索球队、赛事或球场 / Search fixtures"
                      value={fixtureSearch}
                      onChange={(event) => setFixtureSearch(event.target.value)}
                    />
                  </label>
                  <span aria-live="polite">
                    {fixtureSchedule.loading ? "正在联网刷新真实赛程…" : fixtureSchedule.message ?? "正在准备近期赛程"}
                  </span>
                </div>
                {fixtureSchedule.fallbackReason ? (
                  <div className="fixture-fallback-note" role="status">
                    <ShieldAlert size={15} aria-hidden="true" />
                    <span><strong>演示降级已启用：</strong>{fixtureSchedule.fallbackReason} 选择后仍只运行模拟分析。</span>
                  </div>
                ) : null}
                {fixtureDateCounts.length ? (
                  <div className="fixture-date-shortcuts" role="group" aria-label="比赛日期筛选">
                    <button
                      className={!fixtureDayFilter ? "active" : ""}
                      type="button"
                      onClick={() => setFixtureDayFilter("")}
                    >
                      <span>全部日期</span>
                      <small>{fixtureSchedule.fixtures.length}</small>
                    </button>
                    {fixtureDateCounts.map(([date, count]) => (
                      <button
                        className={fixtureDayFilter === date ? "active" : ""}
                        type="button"
                        key={date}
                        onClick={() => setFixtureDayFilter(date)}
                      >
                        <span>{fixtureDateLabel(date)}</span>
                        <small>{count}</small>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="fixture-league-shortcuts" role="group" aria-label="赛事快捷筛选">
                  {fixtureCompetitionFilters.map((competition) => (
                    <button
                      className={fixtureSearch === competition ? "active" : ""}
                      type="button"
                      key={competition || "all"}
                      aria-label={`${competition || "全部"} ${fixtureCompetitionCounts[competition] ?? 0} 场`}
                      onClick={() => setFixtureSearch(competition)}
                    >
                      <span>{competition || "全部"}</span>
                      <small>{fixtureCompetitionCounts[competition] ?? 0}</small>
                    </button>
                  ))}
                </div>

                {fixtureSchedule.error ? (
                  <div className="fixture-error" role="alert">
                    <AlertTriangle size={15} aria-hidden="true" />
                    <span>{fixtureSchedule.error}</span>
                  </div>
                ) : null}

                <div className="fixture-list" aria-busy={fixtureSchedule.loading}>
                  {fixtureSchedule.loading && !fixtureSchedule.fixtures.length
                    ? (
                      <div className="fixture-loading-grid">
                        {Array.from({ length: 4 }, (_, index) => <div className="fixture-skeleton" key={index} />)}
                      </div>
                    )
                    : fixtureLeagueGroups.map((league) => (
                      <section className="fixture-league-group" key={`${league.country}:${league.competition}`}>
                        <header className="fixture-league-group-head">
                          <span>
                            <Trophy size={15} aria-hidden="true" />
                            <strong><BilingualTerm value={league.competition} /></strong>
                            <small><BilingualTerm value={league.country} /></small>
                          </span>
                          <UiBilingual zh={`${league.fixtures.length} 场比赛`} en={`${league.fixtures.length} matches`} compact />
                        </header>
                        <div className="fixture-league-grid">
                          {league.fixtures.map((fixture) => {
                            const selected = selectedFixture?.id === fixture.id && selectedFixture.provider === fixture.provider;
                            const homeBadgeImageUrl = proxiedTeamBadgeUrl(fixture.home.badgeUrl);
                            const awayBadgeImageUrl = proxiedTeamBadgeUrl(fixture.away.badgeUrl);
                            return (
                              <button
                                className={`fixture-card ${selected ? "selected" : ""}`}
                                type="button"
                                aria-pressed={selected}
                                key={`${fixture.provider}:${fixture.id}`}
                                onClick={() => selectScheduledFixture(fixture)}
                              >
                                <span className="fixture-kickoff">
                                  <CalendarClock size={14} aria-hidden="true" />
                                  <strong>{fixtureDateLabel(beijingFixtureDate(fixture.startsAt))}</strong>
                                  <span>{fixtureTime(fixture.startsAt)}</span>
                                  <small>{fixture.dataMode === "mock" ? "演示 / Demo" : <BilingualTerm value={fixture.status || "NS"} />}</small>
                                </span>
                                <span className="fixture-card-main">
                                  <span className="fixture-team-row">
                                    <span>
                                      {homeBadgeImageUrl ? <img src={homeBadgeImageUrl} alt="" /> : <i>{fixture.home.shortCode || fixture.home.name.slice(0, 2)}</i>}
                                      <b><FootballName name={fixture.home.name} /></b>
                                    </span>
                                    <em>VS</em>
                                    <span>
                                      {awayBadgeImageUrl ? <img src={awayBadgeImageUrl} alt="" /> : <i>{fixture.away.shortCode || fixture.away.name.slice(0, 2)}</i>}
                                      <b><FootballName name={fixture.away.name} /></b>
                                    </span>
                                  </span>
                                  <span className="fixture-venue">
                                    <MapPin size={13} aria-hidden="true" />
                                    <span>
                                      <UiBilingual zh="比赛场地" en="Venue" compact />
                                      <b>{fixture.venue || "待公布 / Venue TBC"}</b>
                                    </span>
                                  </span>
                                  <small className={`fixture-source-label ${fixture.dataMode === "mock" ? "mock" : "live"}`}>
                                    {fixture.dataMode === "mock" ? "演示赛程 / Mock Fixture" : "真实赛程 / Live Fixture"}
                                    <span> · {[fixture.round, fixtureProviderLabels[fixture.provider]].filter(Boolean).join(" · ")}</span>
                                  </small>
                                </span>
                                {selected ? <CheckCircle2 className="fixture-selected-icon" size={17} aria-hidden="true" /> : null}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  {!fixtureSchedule.loading && fixtureSchedule.fixtures.length > 0 && !visibleFixtures.length ? (
                    <p className="fixture-empty">没有符合搜索条件的比赛。</p>
                  ) : null}
                  {!fixtureSchedule.loading && !fixtureSchedule.error && !fixtureSchedule.fixtures.length ? (
                    <div className="fixture-empty">
                      <CalendarClock size={20} aria-hidden="true" />
                      <strong>未来 30 天暂未发现已收录比赛</strong>
                      <span>可更换起始日期、点击实时刷新，或到“选球队”中手动设置对阵。</span>
                    </div>
                  ) : null}
                </div>
                {selectedFixture ? (
                  <div className="fixture-selection-summary" role="status">
                    <CheckCircle2 size={17} aria-hidden="true" />
                    <span>
                      <small>已选择</small>
                      <strong><FootballName name={selectedFixture.home.name} /> <span aria-hidden="true">vs</span> <FootballName name={selectedFixture.away.name} /></strong>
                    </span>
                    <b>{fixtureDateLabel(beijingFixtureDate(selectedFixture.startsAt))} {fixtureTime(selectedFixture.startsAt)}</b>
                  </div>
                ) : null}
              </section>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="competition"><UiBilingual zh="赛事" en="Competition" compact /></label>
                  <input
                    id="competition"
                    value={form.competition}
                    onChange={(event) => updateForm({ competition: event.target.value })}
                    placeholder="英超 / 欧冠 / 国家队赛事"
                  />
                </div>
                <div className="two-col">
                  <div className="field">
                    <label htmlFor="matchDate"><UiBilingual zh="比赛时间" en="Kick-off Time" compact /></label>
                    <input
                      id="matchDate"
                      type="datetime-local"
                      value={form.matchDate}
                      onChange={(event) => updateForm({ matchDate: event.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="homeTeam"><UiBilingual zh="场地" en="Venue" compact /></label>
                    <select
                      id="homeTeam"
                      value={form.homeTeam}
                      onChange={(event) => updateForm({ homeTeam: event.target.value as FormState["homeTeam"] })}
                    >
                      <option value="team_a">球队 A 主场 / Team A Home</option>
                      <option value="team_b">球队 B 主场 / Team B Home</option>
                      <option value="neutral">中立场 / Neutral</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label><UiBilingual zh="分析深度" en="Analysis Depth" compact /></label>
                  <div className="segmented" role="group" aria-label="分析深度">
                    <button
                      className={`segment ${form.analysisDepth === "standard" ? "active" : ""}`}
                      type="button"
                      onClick={() => updateForm({ analysisDepth: "standard" })}
                    >
                      <UiBilingual zh="标准" en="Standard" compact />
                    </button>
                    <button
                      className={`segment ${form.analysisDepth === "deep" ? "active" : ""}`}
                      type="button"
                      onClick={() => updateForm({ analysisDepth: "deep" })}
                    >
                      <UiBilingual zh="深度" en="Deep" compact />
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label><UiBilingual zh="费用模式" en="Billing Mode" compact /></label>
                  <div className="segmented" role="group" aria-label="费用模式">
                    <button
                      className={`segment ${form.billingMode === "platform" ? "active" : ""}`}
                      type="button"
                      onClick={() => updateForm({ billingMode: "platform" })}
                    >
                      <BadgeDollarSign size={15} aria-hidden="true" />
                      <UiBilingual zh="平台托管" en="Managed" compact />
                    </button>
                    <button
                      className={`segment ${form.billingMode === "byok" ? "active" : ""}`}
                      type="button"
                      onClick={() => updateForm({ billingMode: "byok" })}
                    >
                      <LockKeyhole size={15} aria-hidden="true" />
                      <UiBilingual zh="自带 Key" en="Bring Your Own Key" compact />
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="maxCharge"><UiBilingual zh="最高授权费用" en="Maximum Authorized Charge" compact /></label>
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
                  <UiBilingual zh="估算费用" en="Estimate Cost" compact />
                </button>
                  <button className="btn btn-secondary" type="button" onClick={openBillingModal}>
                    <Eye size={16} aria-hidden="true" />
                    <UiBilingual zh="确认方式" en="Confirm Billing" compact />
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
                  <UiBilingual zh="生成报告" en="Generate Report" compact />
                </button>
              </div>
              </div>
            </div>
          </div>

          <div className="panel intelligence-panel">
            <div className="panel-header">
              <div className="panel-title">
                <Workflow size={18} aria-hidden="true" />
                <h2><UiBilingual zh="执行与成本" en="Workflow & Cost" /></h2>
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
                        <UiBilingual zh={step.name} en={workflowEnglish[step.id]?.name ?? "Workflow Step"} compact />
                      </h3>
                      <p>{step.detail}<small>{workflowEnglish[step.id]?.detail}</small></p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cost-box">
                <div className="cost-box-header">
                <UiBilingual zh={estimate?.providerMode === "mock" ? "本次模拟费用" : "成本预览"} en={estimate?.providerMode === "mock" ? "Mock Cost" : "Cost Preview"} compact />
                  <strong>{estimate ? currency(estimate.estimatedUserChargeCents) : "未估算"}</strong>
                </div>
                <div className="cost-grid">
                  <div>
                    <UiBilingual zh={estimate?.providerMode === "mock" ? "本次 API 成本" : "API 成本"} en="API Cost" compact />
                    <strong>{estimate ? currency(estimate.estimatedApiCostCents) : "—"}</strong>
                  </div>
                  <div>
                    <UiBilingual zh={estimate?.providerMode === "mock" ? "正式模式参考价" : "倍率"} en={estimate?.providerMode === "mock" ? "Live Reference" : "Markup"} compact />
                    <strong>{estimate?.formalModeEstimate ? currency(estimate.formalModeEstimate.estimatedUserChargeCents) : estimate ? `${estimate.markupMultiplier}x` : "—"}</strong>
                  </div>
                  <div>
                    <UiBilingual zh={estimate?.providerMode === "mock" ? "正式 API 参考" : "最低收费"} en={estimate?.providerMode === "mock" ? "Live API Reference" : "Minimum Charge"} compact />
                    <strong>{estimate?.formalModeEstimate ? currency(estimate.formalModeEstimate.estimatedApiCostCents) : estimate ? currency(estimate.minimumChargeCents) : "—"}</strong>
                  </div>
                  <div>
                    <UiBilingual zh="模式" en="Mode" compact />
                    <strong>{estimate?.providerMode === "mock" ? "免费演示" : form.billingMode === "platform" ? "托管" : "BYOK"}</strong>
                  </div>
                </div>
                {estimate?.providerMode === "mock" ? <p className="mock-cost-note">Mock 模式不会调用付费服务、不会创建订单，也不会产生扣费。</p> : null}
              </div>

              <div className="guard-stack">
                <div>
                  <ShieldCheck size={16} aria-hidden="true" />
                  <UiBilingual zh="密钥只在服务端" en="Server-side Keys Only" compact />
                </div>
                <div>
                  <BadgeDollarSign size={16} aria-hidden="true" />
                  <UiBilingual zh="先授权后执行" en="Authorize Before Execution" compact />
                </div>
                <div>
                  <Users size={16} aria-hidden="true" />
                  <UiBilingual zh="不分析隐私八卦" en="No Private Gossip" compact />
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
                <h2><UiBilingual zh="数据可视化" en="Data Visualization" /></h2>
              </div>
              <span className="status-pill compact">
                <Activity size={14} aria-hidden="true" />
                {usingMockIntelligence ? "Mock 情报完整载入" : liveTeams.length ? "球队元数据已载入 / 指标待核验" : "等待数据"}
              </span>
            </div>
            <div className="panel-body">
              <div className="live-sync-bar">
                <div>
                  <strong>{usingMockIntelligence ? "当前展示完整演示情报" : "多源真实比赛数据"}</strong>
                  <span>
                    {usingMockIntelligence
                      ? "所有指标均标注为 Mock；同步正式数据后将由核验结果替换"
                      : "优先使用免费 API-Football，自动回退至 Sportmonks 或 football-data.org"}
                  </span>
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
              {usingMockIntelligence ? (
                <div className="data-quality-note prominent mock" role="note">
                  <Sparkles size={15} aria-hidden="true" />
                  当前为产品演示：比赛情报、球员状态、交锋与概率均由 Mock 情报引擎生成，不代表真实球队事实。
                </div>
              ) : (
                <div className="data-quality-note prominent" role="note">
                  未完成正式分析时不展示预测概率；球队评分、战术和球员对位仅在指标通过来源核验后显示。
                </div>
              )}
              {usingMockIntelligence ? <MockIntelligenceBrief intelligence={mockIntelligence} /> : null}
              <MatchVisualDashboard
                teamA={analysisTeamAProfile}
                teamB={analysisTeamBProfile}
                probability={probability}
                eventData={eventData}
                eventLoading={eventDataStatus.loading}
                onImportEvents={importPlayerEventData}
                allowMockData={useMockProfiles}
              />

              <div className="probability-grid">
                <div className="prob-card">
                  <span>{form.teamA || "球队 A"}</span>
                  <strong>{result || usingMockIntelligence ? `${probability.teamA}%` : "--"}</strong>
                  <div className="prob-track">
                    <div style={{ width: `${probability.teamA}%` }} />
                  </div>
                </div>
                <div className="prob-card draw">
                  <span>平局</span>
                  <strong>{result || usingMockIntelligence ? `${probability.draw}%` : "--"}</strong>
                  <div className="prob-track">
                    <div style={{ width: `${probability.draw}%` }} />
                  </div>
                </div>
                <div className="prob-card alt">
                  <span>{form.teamB || "球队 B"}</span>
                  <strong>{result || usingMockIntelligence ? `${probability.teamB}%` : "--"}</strong>
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

              {hasAnalysisTeamMetrics ? (
                <>
              <div className="team-state-grid">
                <div className="team-state-card">
                  <div className="team-state-head">
                    <TeamBadge team={analysisTeamAProfile} />
                    <div>
                      <strong><FootballName name={analysisTeamAProfile.name} /></strong>
                      <span className="team-meta-line">
                        <TeamCountryFlag team={analysisTeamAProfile} compact />
                        <BilingualTerm value={analysisTeamAProfile.league} /> / <BilingualTerm value={analysisTeamAProfile.country} />
                      </span>
                    </div>
                  </div>
                  <MetricBar label="进攻" value={analysisTeamAProfile.attack} />
                  <MetricBar label="防守" value={analysisTeamAProfile.defense} tone="blue" />
                  <MetricBar label="状态" value={analysisTeamAProfile.form} tone="amber" />
                  <div className="recent-form">
                    {analysisTeamAProfile.recent.map((item, index) => (
                      <span className={item} key={`${item}-${index}`}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="team-state-card">
                  <div className="team-state-head">
                    <TeamBadge team={analysisTeamBProfile} />
                    <div>
                      <strong><FootballName name={analysisTeamBProfile.name} /></strong>
                      <span className="team-meta-line">
                        <TeamCountryFlag team={analysisTeamBProfile} compact />
                        <BilingualTerm value={analysisTeamBProfile.league} /> / <BilingualTerm value={analysisTeamBProfile.country} />
                      </span>
                    </div>
                  </div>
                  <MetricBar label="进攻" value={analysisTeamBProfile.attack} />
                  <MetricBar label="防守" value={analysisTeamBProfile.defense} tone="blue" />
                  <MetricBar label="状态" value={analysisTeamBProfile.form} tone="amber" />
                  <div className="recent-form">
                    {analysisTeamBProfile.recent.map((item, index) => (
                      <span className={item} key={`${item}-${index}`}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="comparison-board">
                <ComparisonRow label="进攻火力" left={analysisTeamAProfile.attack} right={analysisTeamBProfile.attack} />
                <ComparisonRow label="防守稳定" left={analysisTeamAProfile.defense} right={analysisTeamBProfile.defense} />
                <ComparisonRow label="体能余量" left={analysisTeamAProfile.fitness} right={analysisTeamBProfile.fitness} />
                <ComparisonRow label="控球能力" left={analysisTeamAProfile.possession} right={analysisTeamBProfile.possession} />
                <ComparisonRow label="压迫强度" left={analysisTeamAProfile.press} right={analysisTeamBProfile.press} />
                <ComparisonRow label="伤病安全" left={analysisTeamAProfile.injurySafety} right={analysisTeamBProfile.injurySafety} />
              </div>

              <div className="xg-strip">
                <div>
                  <Zap size={15} aria-hidden="true" />
                  <span><FootballName name={analysisTeamAProfile.name} /> xG</span>
                  <strong>{analysisTeamAProfile.xgFor.toFixed(2)}</strong>
                </div>
                <div>
                  <Dumbbell size={15} aria-hidden="true" />
                  <span>xGA</span>
                  <strong>{analysisTeamAProfile.xgAgainst.toFixed(2)} / {analysisTeamBProfile.xgAgainst.toFixed(2)}</strong>
                </div>
                <div>
                  <Swords size={15} aria-hidden="true" />
                  <span><FootballName name={analysisTeamBProfile.name} /> xG</span>
                  <strong>{analysisTeamBProfile.xgFor.toFixed(2)}</strong>
                </div>
              </div>
                </>
              ) : (
                <div className="data-quality-note" role="status">
                  球队攻防评分、近期战绩和 xG 尚未通过正式来源核验，相关演示数字已隐藏。
                </div>
              )}
            </div>
          </div>

          <div className="panel matchup-panel">
            <div className="panel-header">
              <div className="panel-title">
                <Swords size={18} aria-hidden="true" />
                <h2><UiBilingual zh="球员对位与克制链" en="Player Matchups & Tactical Edges" /></h2>
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
                  {eventDataStatus.loading ? <UiBilingual zh="获取中" en="Loading" compact /> : <UiBilingual zh="获取事件数据" en="Load Event Data" compact />}
                </button>
              </div>
            </div>
            <div className="panel-body">
              <div className="data-audit-strip">
                <div>
                  <span>球队数据</span>
                  <strong>{useMockProfiles ? "完整演示" : hasVerifiedTeamMetrics ? "指标已核验" : liveTeams.length ? "仅元数据" : "等待数据"}</strong>
                </div>
                <div>
                  <span>事件对位</span>
                  <strong>{eventData ? "真实样本" : useMockProfiles ? "演示模型" : "简化"}</strong>
                </div>
                <div>
                  <span>门将/点球</span>
                  <strong>{eventData ? "真实样本" : useMockProfiles ? "演示模型" : "简化"}</strong>
                </div>
                <div>
                  <span>教练因素</span>
                  <strong>{useMockProfiles ? "演示模型" : "简化"}</strong>
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
                            <strong><FootballName name={player.name} type="player" /></strong>
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
                          <strong><FootballName name={featuredEventPlayer.name} type="player" /> <UiBilingual zh="事件热区" en="Event Heatmap" compact /></strong>
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

              {!hasAnalysisTeamMetrics || !hasAnalysisPlayerMetrics ? (
                <div className="data-quality-note" role="status">
                  球员对位、点球、战术克制和教练评分等待已核验的真实指标，当前不生成推测数值。
                </div>
              ) : null}
              {hasAnalysisPlayerMetrics && keeperPenaltyInsights.length === 0 ? (
                <div className="data-quality-note" role="status">
                  暂无可核验的点球样本，点球命中率和扑救率保持留空。
                </div>
              ) : null}
              {!useMockProfiles && (analysisTeamAProfile.coach || analysisTeamBProfile.coach) ? (
                <div className="data-quality-note" role="status">
                  当前主教练身份已导入；阵型弹性、换人影响和临场响应没有正式统计时不生成评分。
                </div>
              ) : null}

              <div className="matchup-grid">
                {matchupInsights.map((matchup) => (
                  <div className="matchup-card" key={matchup.id}>
                    <div className="matchup-card-head">
                      <span>{matchup.title}</span>
                      <strong>
                        {matchup.aerialEdge === null
                          ? "身高缺失"
                          : `${matchup.aerialEdge > 0 ? `+${matchup.aerialEdge}` : matchup.aerialEdge}cm`}
                      </strong>
                    </div>
                    <div className="duel-line">
                      <div>
                        <strong><FootballName name={matchup.attacker.name} type="player" translation={matchup.attacker.nameZh} /></strong>
                        <span>{matchup.attacker.role}</span>
                      </div>
                      <b>vs</b>
                      <div>
                        <strong><FootballName name={matchup.defender.name} type="player" translation={matchup.defender.nameZh} /></strong>
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
                      <span>
                        <FootballName name={item.shooter.name} type="player" translation={item.shooter.nameZh} /> 射门 vs{" "}
                        <FootballName name={item.keeper.name} type="player" translation={item.keeper.nameZh} />
                      </span>
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
                    <strong><FootballName name={coach.teamName} /></strong>
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
                <h2><UiBilingual zh="球员状态" en="Player Status" /></h2>
              </div>
              <button className="panel-action-button" type="button" onClick={() => setActiveModal({ type: "importPlayers" })}>
                <Upload size={14} aria-hidden="true" />
                <UiBilingual zh="导入球员数据" en="Import Players" compact />
              </button>
            </div>
            <div className="panel-body player-columns">
              <div>
                <div className="player-column-title">
                  <FootballName name={analysisTeamAProfile.name} />
                  {playerOverrides.teamA ? <span>已导入</span> : null}
                </div>
                {teamAPlayers.length ? teamAPlayers.map((player) => (
                    <PlayerCard
                      player={player}
                      allowMock={useMockProfiles}
                      onOpen={() => setActiveModal({ type: "player", player, team: analysisTeamAProfile })}
                      key={`${analysisTeamAProfile.id}-${player.name}`}
                    />
                  )) : <p className="team-roster-empty">暂无真实球员名单，等待云端数据刷新或手动导入。</p>}
              </div>
              <div>
                <div className="player-column-title">
                  <FootballName name={analysisTeamBProfile.name} />
                  {playerOverrides.teamB ? <span>已导入</span> : null}
                </div>
                {teamBPlayers.length ? teamBPlayers.map((player) => (
                    <PlayerCard
                      player={player}
                      allowMock={useMockProfiles}
                      onOpen={() => setActiveModal({ type: "player", player, team: analysisTeamBProfile })}
                      key={`${analysisTeamBProfile.id}-${player.name}`}
                    />
                  )) : <p className="team-roster-empty">暂无真实球员名单，等待云端数据刷新或手动导入。</p>}
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
                <h2><UiBilingual zh="分析报告" en="Analysis Report" /></h2>
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
                <>
                  {result.prediction ? (
                    <StructuredPredictionSummary
                      prediction={result.prediction}
                      provenance={result.provenance}
                      teamA={form.teamA}
                      teamB={form.teamB}
                    />
                  ) : null}
                  {result.cost.actual ? (
                    <div className="ai-cost-summary" aria-label="本次 AI 用量与成本">
                      <div>
                        <span>分析模型</span>
                        <strong>{result.cost.actual.model}</strong>
                        <small>{result.cost.actual.aiProvider === "openai" ? "OpenAI Responses API" : "腾讯混元兼容 API"}</small>
                      </div>
                      <div>
                        <span>Token 用量</span>
                        <strong>{result.cost.actual.totalTokens.toLocaleString("zh-CN")}</strong>
                        <small>输入 {result.cost.actual.inputTokens.toLocaleString("zh-CN")} / 输出 {result.cost.actual.outputTokens.toLocaleString("zh-CN")}</small>
                      </div>
                      <div>
                        <span>模型成本</span>
                        <strong>{result.cost.actual.modelCostCents === null ? "价格未配置" : preciseCurrency(result.cost.actual.modelCostCents)}</strong>
                        <small>缓存输入 {result.cost.actual.cachedInputTokens.toLocaleString("zh-CN")} Token</small>
                      </div>
                      <div>
                        <span>实际结算</span>
                        <strong>{result.billingMode === "platform" ? currency(result.cost.actual.userChargeCents) : "BYOK"}</strong>
                        <small>体育数据 {currency(result.cost.actual.sportsDataCostCents)}</small>
                      </div>
                    </div>
                  ) : null}
                  <article className="report" aria-live="polite">
                    {reportNodes(result.report)}
                  </article>
                </>
              ) : (
                <div className="empty-report">
                  <FileText size={34} aria-hidden="true" />
                  <strong>赛前报告席位</strong>
                  <span>完成数据同步和预测后生成正式报告</span>
                  <button className="btn btn-primary empty-report-action" type="button" onClick={() => setActiveView("match")}>
                    <Send size={15} aria-hidden="true" />
                    设置比赛并生成
                  </button>
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
                    : activeModal.type === "mockBilling"
                      ? "Mock 免费模式"
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
                      ? !accountConfigured ? "账户服务未配置" : accountUser ? "账户已登录" : "登录或注册"
                    : activeModal.type === "mockBilling"
                      ? "本次不会产生任何费用"
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
                    <strong><FootballName name={activeModal.player.name} type="player" translation={activeModal.player.nameZh} /></strong>
                    <span>
                      {activeModal.player.role} / {activeModal.team.name} / {activeModal.player.metricsStatus === "mock" ? "演示状态" : isPlayerMetricsVerified(activeModal.player) ? statusLabel(activeModal.player.status) : "状态待核验"}
                    </span>
                  </div>
                  <TeamBadge team={activeModal.team} />
                </div>
                <div className="detail-grid">
                  <div>
                    <span>球衣号码</span>
                    <strong>{typeof activeModal.player.shirtNumber === "number" ? `#${activeModal.player.shirtNumber}` : "--"}</strong>
                  </div>
                  <div>
                    <span>年龄</span>
                    <strong>{typeof activeModal.player.age === "number" ? `${activeModal.player.age} 岁` : "--"}</strong>
                  </div>
                  <div>
                    <span>身高</span>
                    <strong>{typeof activeModal.player.heightCm === "number" ? `${activeModal.player.heightCm}cm` : "--"}</strong>
                  </div>
                  <div>
                    <span>数据状态</span>
                    <strong>{activeModal.player.metricsStatus === "mock" ? "Mock 演示" : isPlayerMetricsVerified(activeModal.player) ? "已导入" : "待核验"}</strong>
                  </div>
                </div>
                {isPlayerMetricsAvailable(activeModal.player, usingMockIntelligence) ? (
                  <>
                    <div className="detail-grid">
                      <div>
                        <span>综合状态</span>
                        <strong>{activeModal.player.form}</strong>
                      </div>
                      <div>
                        <span>{activeModal.player.metricsStatus === "mock" ? "近 5 场分钟" : "预计出场时间"}</span>
                        <strong>{activeModal.player.metricsStatus === "mock" ? `${activeModal.player.minutes} 分钟` : `${activeModal.player.minutes}%`}</strong>
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
                    <MetricBar
                      label={activeModal.player.metricsStatus === "mock" ? "出勤负荷" : "出场确定性"}
                      value={activeModal.player.metricsStatus === "mock" ? clampMetric(activeModal.player.minutes / 4.5) : activeModal.player.minutes}
                      tone="blue"
                    />
                    {activeModal.player.eventMetrics ? (
                      <div className="mock-player-events">
                        <div className="mock-player-event-grid">
                          <div><span>射门 / Shots</span><strong>{activeModal.player.eventMetrics.shots}</strong></div>
                          <div><span>xG</span><strong>{activeModal.player.eventMetrics.xg.toFixed(2)}</strong></div>
                          <div><span>抢断 / Tackles</span><strong>{activeModal.player.eventMetrics.tackles}</strong></div>
                          <div><span>拦截 / Interceptions</span><strong>{activeModal.player.eventMetrics.interceptions}</strong></div>
                          <div><span>封堵 / Blocks</span><strong>{activeModal.player.eventMetrics.blocks}</strong></div>
                          <div><span>被过 / Dribbled Past</span><strong>{activeModal.player.eventMetrics.dribbledPast}</strong></div>
                        </div>
                        {activeModal.player.heatmap?.length ? (
                          <div className="mock-player-heatmap" aria-label="演示位置热区">
                            <div className="heatmap-halfway" />
                            <div className="heatmap-circle" />
                            {activeModal.player.heatmap.map((point, index) => (
                              <i
                                key={`${point.x}:${point.y}:${index}`}
                                style={{ left: `${point.x}%`, top: `${point.y}%`, opacity: point.intensity / 100 }}
                              />
                            ))}
                            <span>演示位置热区 / Mock Heatmap</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="data-quality-note" role="note">
                    名单资料可展示，但状态、进球、助攻、防守、伤停和预计出场时间尚未由正式统计源核验。
                  </div>
                )}
                <p className="modal-note">{activeModal.player.note}</p>
              </div>
            ) : activeModal.type === "account" ? (
              <div className="modal-body">
                {!accountConfigured ? (
                  <div className="data-quality-note" role="status">
                    当前部署尚未配置 Supabase 账户服务。登录、注册和平台托管支付暂不可用；网站其余公开功能仍可浏览。
                  </div>
                ) : accountUser ? (
                  <>
                    <div className="confirm-summary"><div><span>当前账户</span><strong>{accountUser.email}</strong></div></div>
                    {accountCostSummary ? (
                      <div className="account-cost-summary">
                        <div><span>近 {accountCostSummary.periodDays} 天分析</span><strong>{accountCostSummary.completedCount} 次</strong></div>
                        <div><span>Token 总量</span><strong>{accountCostSummary.totalTokens.toLocaleString("zh-CN")}</strong></div>
                        <div><span>模型成本</span><strong>{preciseCurrency(accountCostSummary.modelCostCents)}</strong></div>
                        <div><span>实际支付</span><strong>{currency(accountCostSummary.userChargeCents)}</strong></div>
                      </div>
                    ) : null}
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
            ) : activeModal.type === "mockBilling" ? (
              <div className="modal-body">
                <div className="confirm-summary">
                  <div><span>本次 Mock 费用</span><strong>¥0.00</strong></div>
                  <div><span>支付订单</span><strong>不会创建</strong></div>
                  <div><span>正式模式参考价</span><strong>{estimate?.formalModeEstimate ? currency(estimate.formalModeEstimate.estimatedUserChargeCents) : "请先估算"}</strong></div>
                </div>
                <p className="modal-note">正式模式参考价只是演示信息，不是支付授权，也不会调用 Supabase、Stripe、商业体育数据或真实 AI。</p>
                <button className="btn btn-primary full" type="button" onClick={() => setActiveModal(null)}>确认免费演示</button>
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
                    <UiBilingual zh="导入到 A 队" en="Import to Team A" compact />：<FootballName name={teamAProfile.name} />
                  </button>
                  <button
                    className={importTarget === "teamB" ? "active" : ""}
                    type="button"
                    onClick={() => setImportTarget("teamB")}
                  >
                    <UiBilingual zh="导入到 B 队" en="Import to Team B" compact />：<FootballName name={teamBProfile.name} />
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

export default function Home() {
  const [hasEnteredWorkspace, setHasEnteredWorkspace] = useState(false);

  return hasEnteredWorkspace
    ? <WorkspaceApp />
    : <ExperienceGateway onEnter={() => setHasEnteredWorkspace(true)} />;
}
