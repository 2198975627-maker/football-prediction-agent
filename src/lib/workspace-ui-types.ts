export type TeamKind = "club" | "national";
export type TeamSlot = "teamA" | "teamB";
export type TeamMode = "all" | TeamKind;
export type WorkspaceView = "teams" | "match" | "analysis" | "report";

export type PlayerStatus = {
  name: string;
  nameZh?: string;
  role: string;
  status: "ready" | "doubt" | "injured" | "suspended";
  form: number;
  goals: number;
  assists: number;
  defense: number;
  minutes: number;
  avatarUrl?: string;
  age?: number | null;
  shirtNumber?: number | null;
  heightCm?: number | null;
  preferredFoot?: "left" | "right" | "both" | "unknown";
  shotsOnTarget?: number | null;
  saves?: number | null;
  penaltiesTaken?: number | null;
  penaltiesScored?: number | null;
  penaltiesFaced?: number | null;
  penaltySaves?: number | null;
  metricsStatus?: "verified" | "placeholder" | "user-imported" | "mock";
  rosterStatus?: "provider" | "placeholder" | "user-imported";
  note: string;
  starter?: boolean;
  eventMetrics?: {
    shots: number;
    xg: number;
    tackles: number;
    interceptions: number;
    blocks: number;
    dribbledPast: number;
  };
  heatmap?: Array<{ x: number; y: number; intensity: number }>;
};

export type TeamProfile = {
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
  rosterUpdatedAt?: string | null;
  coach?: {
    id?: string;
    name: string;
    age?: number | null;
    nationality?: string;
    photoUrl?: string;
    source?: string;
    metricsStatus?: "verified" | "placeholder" | "mock";
    flexibility?: number | null;
    substitution?: number | null;
    gameState?: number | null;
  } | null;
  metricsStatus?: "verified" | "placeholder" | "mock";
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

export type FormState = {
  teamA: string;
  teamB: string;
  matchDate: string;
  competition: string;
  homeTeam: "team_a" | "team_b" | "neutral";
  analysisDepth: "standard" | "deep";
  billingMode: "byok" | "platform";
  maxUserChargeCents: number;
};

export type FilterState = {
  mode: TeamMode;
  search: string;
  league: string;
  country: string;
  continent: string;
  tier: string;
};

export type ProbabilitySummary = {
  teamA: number;
  draw: number;
  teamB: number;
  score: string;
};

export type MatchupInsight = {
  id: string;
  title: string;
  attacker: PlayerStatus;
  defender: PlayerStatus;
  attackValue: number;
  defenseValue: number;
  aerialEdge: number | null;
  note: string;
};

export type KeeperPenaltyInsight = {
  keeper: PlayerStatus;
  shooter: PlayerStatus;
  saveValue: number;
  shotValue: number;
  penaltySave: number;
  penaltyScore: number;
};

export type TacticalChain = {
  id: string;
  trigger: string;
  attackLabel: string;
  defenseLabel: string;
  attackValue: number;
  defenseValue: number;
  verdict: string;
};

export type CoachProfile = {
  teamName: string;
  flexibility: number;
  substitution: number;
  gameState: number;
  risk: string;
};

export type ActiveModal =
  | { type: "player"; player: PlayerStatus; team: TeamProfile }
  | { type: "payment" }
  | { type: "byok" }
  | { type: "mockBilling" }
  | { type: "account" }
  | { type: "importPlayers" }
  | null;

export type AccountUser = { id: string; email?: string };

export type AccountCostSummary = {
  periodDays: number;
  requestCount: number;
  completedCount: number;
  failedCount: number;
  totalTokens: number;
  modelCostCents: number;
  platformCostCents: number;
  userChargeCents: number;
};

export type LiveImportStatus = {
  loading: boolean;
  message: string | null;
  error: string | null;
};

export type LiveTeamResponse = {
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

export type EventHeatmapPoint = {
  x: number;
  y: number;
  count: number;
};

export type EventShotPoint = {
  x: number;
  y: number;
  xg: number;
  outcome: string;
  bodyPart: string;
};

export type EventPlayerProfile = {
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

export type EventKeeperZone = {
  keeperId: string;
  keeperName: string;
  team: string;
  shotsFaced: number;
  saves: number;
  penaltiesFaced: number;
  penaltySaves: number;
  zones: EventHeatmapPoint[];
};

export type PlayerEventDataResponse = {
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

export type OfficialSourceProvider = {
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

export type SportsAnalysisTool = {
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

export type OfficialFusionStage = {
  id: string;
  name: string;
  description: string;
  providers: string[];
  requiredCapabilities: string[];
};

export type OfficialSourcesResponse = {
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

export type MatchIntelligenceResponse = {
  ok: boolean;
  error?: string;
  code?: string;
  provider?: "anysport" | "api-football" | "sportmonks" | "football-data-org";
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

export type FixtureProvider = "anysport" | "api-football" | "football-data-org" | "thesportsdb" | "openligadb" | "mock-offline";
export type ScheduledFixture = {
  id: string;
  provider: FixtureProvider;
  startsAt: string;
  status: string;
  competition: string;
  country: string;
  round: string;
  venue: string;
  dataMode?: "live" | "mock";
  home: { id: number; name: string; shortCode: string; badgeUrl: string };
  away: { id: number; name: string; shortCode: string; badgeUrl: string };
};

export type FixtureScheduleResponse = {
  ok: boolean;
  error?: string;
  code?: string;
  date?: string;
  fetchedAt?: string;
  cached?: boolean;
  dataMode?: "live" | "mock";
  fallbackReason?: string;
  providers?: FixtureProvider[];
  providerErrors?: Array<{ provider: FixtureProvider; code: string }>;
  fixtures?: ScheduledFixture[];
};
