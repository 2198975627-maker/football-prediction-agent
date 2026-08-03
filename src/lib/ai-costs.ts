import { serviceClient } from "./supabase-auth";
import type { AiProvider } from "./ai-provider";
import type { BillingMode } from "./schemas";

export type AiTokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

export type AiPricingSnapshot = {
  configured: boolean;
  currency: "CNY";
  inputCentsPerMillion: number;
  cachedInputCentsPerMillion: number;
  outputCentsPerMillion: number;
};

export type AiCostCalculation = {
  pricing: AiPricingSnapshot;
  inputCostCents: number | null;
  cachedInputCostCents: number | null;
  outputCostCents: number | null;
  modelCostCents: number | null;
  billedModelCostCents: number;
};

export type AiUsageRecord = {
  jobId: string;
  userId: string;
  orderId?: string | null;
  billingMode: BillingMode;
  provider: AiProvider;
  model: string;
  responseId?: string | null;
  status: "completed" | "failed";
  usage?: Partial<AiTokenUsage>;
  pricing?: AiPricingSnapshot | null;
  modelCostCents?: number | null;
  sportsDataCostCents?: number;
  platformCostCents?: number;
  userChargeCents?: number;
  latencyMs: number;
  errorCode?: string | null;
  metadata?: Record<string, unknown>;
};

function envNumber(name: string) {
  const value = Number(process.env[name]?.trim());
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function roundCost(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function getAiPricingSnapshot(provider: AiProvider): AiPricingSnapshot {
  const prefix = provider === "hunyuan" ? "HUNYUAN" : "OPENAI";
  const inputCentsPerMillion = envNumber(`${prefix}_INPUT_CENTS_PER_MILLION`);
  const outputCentsPerMillion = envNumber(`${prefix}_OUTPUT_CENTS_PER_MILLION`);
  const configuredCachedRate = envNumber(`${prefix}_CACHED_INPUT_CENTS_PER_MILLION`);

  return {
    configured: inputCentsPerMillion > 0 && outputCentsPerMillion > 0,
    currency: "CNY",
    inputCentsPerMillion,
    cachedInputCentsPerMillion: configuredCachedRate > 0 ? configuredCachedRate : inputCentsPerMillion,
    outputCentsPerMillion
  };
}

export function calculateAiModelCost(provider: AiProvider, usage: AiTokenUsage): AiCostCalculation {
  const pricing = getAiPricingSnapshot(provider);
  if (!pricing.configured) {
    return {
      pricing,
      inputCostCents: null,
      cachedInputCostCents: null,
      outputCostCents: null,
      modelCostCents: null,
      billedModelCostCents: 0
    };
  }

  const cachedInputTokens = Math.min(Math.max(0, usage.cachedInputTokens), Math.max(0, usage.inputTokens));
  const uncachedInputTokens = Math.max(0, usage.inputTokens - cachedInputTokens);
  const inputCostCents = uncachedInputTokens / 1_000_000 * pricing.inputCentsPerMillion;
  const cachedInputCostCents = cachedInputTokens / 1_000_000 * pricing.cachedInputCentsPerMillion;
  const outputCostCents = Math.max(0, usage.outputTokens) / 1_000_000 * pricing.outputCentsPerMillion;
  const modelCostCents = inputCostCents + cachedInputCostCents + outputCostCents;

  return {
    pricing,
    inputCostCents: roundCost(inputCostCents),
    cachedInputCostCents: roundCost(cachedInputCostCents),
    outputCostCents: roundCost(outputCostCents),
    modelCostCents: roundCost(modelCostCents),
    billedModelCostCents: Math.max(0, Math.ceil(modelCostCents))
  };
}

function tokenCount(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value ?? 0)) : 0;
}

export async function recordAiUsage(record: AiUsageRecord) {
  const usage = record.usage ?? {};
  const pricing = record.pricing ?? null;
  const { error } = await serviceClient().from("football_ai_usage").insert({
    job_id: record.jobId,
    user_id: record.userId,
    order_id: record.orderId ?? null,
    billing_mode: record.billingMode,
    provider: record.provider,
    model: record.model,
    response_id: record.responseId ?? null,
    status: record.status,
    input_tokens: tokenCount(usage.inputTokens),
    cached_input_tokens: tokenCount(usage.cachedInputTokens),
    output_tokens: tokenCount(usage.outputTokens),
    reasoning_tokens: tokenCount(usage.reasoningTokens),
    total_tokens: tokenCount(usage.totalTokens),
    input_rate_cents_per_million: pricing?.configured ? pricing.inputCentsPerMillion : null,
    cached_input_rate_cents_per_million: pricing?.configured ? pricing.cachedInputCentsPerMillion : null,
    output_rate_cents_per_million: pricing?.configured ? pricing.outputCentsPerMillion : null,
    model_cost_cents: record.modelCostCents ?? null,
    sports_data_cost_cents: Math.max(0, Math.trunc(record.sportsDataCostCents ?? 0)),
    platform_cost_cents: Math.max(0, Math.trunc(record.platformCostCents ?? 0)),
    user_charge_cents: Math.max(0, Math.trunc(record.userChargeCents ?? 0)),
    latency_ms: Math.max(0, Math.trunc(record.latencyMs)),
    error_code: record.errorCode?.slice(0, 100) ?? null,
    metadata: record.metadata ?? {}
  });
  if (error) throw new Error(`AI usage record failed: ${error.code}`);
}

export async function updateAiUsageCharge(jobId: string, userId: string, userChargeCents: number) {
  const { error } = await serviceClient()
    .from("football_ai_usage")
    .update({ user_charge_cents: Math.max(0, Math.trunc(userChargeCents)) })
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .eq("status", "completed");
  if (error) throw new Error(`AI usage settlement update failed: ${error.code}`);
}

export function aiErrorCode(error: unknown) {
  if (error && typeof error === "object") {
    const status = "status" in error ? Number(error.status) : 0;
    if (Number.isInteger(status) && status >= 400 && status <= 599) return `HTTP_${status}`;
    const name = "name" in error && typeof error.name === "string" ? error.name : "AI_PROVIDER_ERROR";
    return name.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100) || "AI_PROVIDER_ERROR";
  }
  return "AI_PROVIDER_ERROR";
}

export async function getUserAiCostSummary(userId: string, days = 30) {
  const boundedDays = Math.min(365, Math.max(1, Math.trunc(days)));
  const since = new Date(Date.now() - boundedDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await serviceClient()
    .from("football_ai_usage")
    .select("status,billing_mode,input_tokens,cached_input_tokens,output_tokens,reasoning_tokens,total_tokens,model_cost_cents,sports_data_cost_cents,platform_cost_cents,user_charge_cents,created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`AI cost summary failed: ${error.code}`);

  const rows = data ?? [];
  const completed = rows.filter((row) => row.status === "completed");
  const sum = (field: keyof (typeof rows)[number]) => completed.reduce((total, row) => total + Number(row[field] ?? 0), 0);

  return {
    periodDays: boundedDays,
    requestCount: rows.length,
    completedCount: completed.length,
    failedCount: rows.length - completed.length,
    inputTokens: sum("input_tokens"),
    cachedInputTokens: sum("cached_input_tokens"),
    outputTokens: sum("output_tokens"),
    reasoningTokens: sum("reasoning_tokens"),
    totalTokens: sum("total_tokens"),
    modelCostCents: roundCost(sum("model_cost_cents")),
    sportsDataCostCents: sum("sports_data_cost_cents"),
    platformCostCents: sum("platform_cost_cents"),
    userChargeCents: sum("user_charge_cents"),
    currency: "CNY" as const,
    limitedToMostRecent: 1000
  };
}
