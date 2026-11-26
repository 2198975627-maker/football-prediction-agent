import { z } from "zod";

export const analysisDepthSchema = z.enum(["standard", "deep"]);
export const billingModeSchema = z.enum(["byok", "platform"]);
export const homeTeamSchema = z.enum(["team_a", "team_b", "neutral"]);
export const fixtureProviderSchema = z.enum([
  "anysport", "api-football", "sportmonks", "football-data-org", "thesportsdb", "openligadb", "mock-offline"
]);
export const matchDateSchema = z.string().trim().min(1).max(40).superRefine((value, context) => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    context.addIssue({ code: "custom", message: "比赛时间格式无效。" });
    return;
  }
  if (timestamp < Date.now() - 15 * 60_000) {
    context.addIssue({ code: "custom", message: "比赛已经开始或时间已过。" });
  }
  if (timestamp > Date.now() + 370 * 24 * 60 * 60_000) {
    context.addIssue({ code: "custom", message: "比赛时间不能超过未来 370 天。" });
  }
});

export const predictionInputSchema = z.object({
  teamA: z.string().trim().min(2).max(80),
  teamB: z.string().trim().min(2).max(80),
  matchDate: matchDateSchema,
  competition: z.string().trim().min(2).max(100),
  homeTeam: homeTeamSchema,
  analysisDepth: analysisDepthSchema,
  billingMode: billingModeSchema,
  maxUserChargeCents: z.coerce.number().int().min(0).max(50000),
  paymentOrderId: z.string().uuid().optional(),
  fixtureId: z.string().trim().regex(/^\d{1,12}$/).optional(),
  fixtureProvider: fixtureProviderSchema.optional()
});

export type PredictionInput = z.infer<typeof predictionInputSchema>;
export type AnalysisDepth = z.infer<typeof analysisDepthSchema>;
export type BillingMode = z.infer<typeof billingModeSchema>;

export type CostBreakdown = {
  sportsDataCents: number;
  searchCents: number;
  extractionCents: number;
  modelCents: number;
};

export type CostEstimate = {
  providerMode: "mock" | "live";
  status?: "estimate" | "actual";
  estimatedApiCostCents: number;
  estimatedUserChargeCents: number;
  minimumChargeCents: number;
  markupMultiplier: number;
  currency: "CNY";
  breakdown: CostBreakdown;
  notes: string[];
  formalModeEstimate?: {
    estimatedApiCostCents: number;
    estimatedUserChargeCents: number;
    minimumChargeCents: number;
    markupMultiplier: number;
    breakdown: CostBreakdown;
  };
  actual?: {
    aiProvider: "openai" | "hunyuan" | "deepseek";
    model: string;
    pricingConfigured: boolean;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    totalTokens: number;
    modelCostCents: number | null;
    sportsDataCostCents: number;
    platformCostCents: number;
    userChargeCents: number;
    currency: "CNY";
  };
};

export type WorkflowStep = {
  id: string;
  name: string;
  status: "blocked" | "pending" | "complete" | "simulated" | "missing" | "skipped";
  detail: string;
};

export type StructuredPrediction = {
  probabilities: {
    teamA: number;
    draw: number;
    teamB: number;
  };
  likelyScores: string[];
  confidence: number;
  summary: string;
  factors: Array<{
    title: string;
    direction: "team_a" | "team_b" | "neutral";
    evidence: string[];
  }>;
  playerMatchups: Array<{
    matchup: string;
    finding: string;
    evidence: string[];
  }>;
  tacticalChains: Array<{
    pattern: string;
    effect: string;
    evidence: string[];
  }>;
  uncertainties: string[];
};

export type PredictionProvenance = {
  fixture: "live" | "mock" | "manual";
  analysis: "live-ai" | "mock-engine";
  rosters: "live" | "mock" | "mixed" | "missing";
  billing: "charged" | "byok" | "free-mock";
};

export type PredictionResponse = {
  jobId: string;
  providerMode: "mock" | "live";
  billingMode: BillingMode;
  cost: CostEstimate;
  workflow: WorkflowStep[];
  prediction: StructuredPrediction | null;
  provenance: PredictionProvenance;
  report: string;
  generatedAt: string;
  model?: string;
  aiProvider?: "openai" | "hunyuan" | "deepseek";
  dataQualityScore?: number;
};
