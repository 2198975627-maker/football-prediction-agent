import { z } from "zod";

export const analysisDepthSchema = z.enum(["standard", "deep"]);
export const billingModeSchema = z.enum(["byok", "platform"]);
export const homeTeamSchema = z.enum(["team_a", "team_b", "neutral"]);

export const predictionInputSchema = z.object({
  teamA: z.string().trim().min(2).max(80),
  teamB: z.string().trim().min(2).max(80),
  matchDate: z.string().trim().min(4).max(40),
  competition: z.string().trim().min(2).max(100),
  homeTeam: homeTeamSchema,
  analysisDepth: analysisDepthSchema,
  billingMode: billingModeSchema,
  maxUserChargeCents: z.coerce.number().int().min(0).max(50000),
  paymentOrderId: z.string().uuid().optional()
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
  actual?: {
    aiProvider: "openai" | "hunyuan";
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
  status: "blocked" | "pending" | "complete";
  detail: string;
};

export type PredictionResponse = {
  jobId: string;
  providerMode: "mock" | "live";
  billingMode: BillingMode;
  cost: CostEstimate;
  workflow: WorkflowStep[];
  report: string;
  generatedAt: string;
  model?: string;
  aiProvider?: "openai" | "hunyuan";
  dataQualityScore?: number;
};
