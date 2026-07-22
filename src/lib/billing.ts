import type { CostBreakdown, CostEstimate, PredictionInput } from "./schemas";
import { getRuntimeConfig } from "./runtime";

function sumBreakdown(breakdown: CostBreakdown) {
  return (
    breakdown.sportsDataCents +
    breakdown.searchCents +
    breakdown.extractionCents +
    breakdown.modelCents
  );
}

export function estimateCost(input: PredictionInput): CostEstimate {
  const config = getRuntimeConfig();
  const breakdown: CostBreakdown =
    input.analysisDepth === "deep"
      ? {
          sportsDataCents: 58,
          searchCents: 42,
          extractionCents: 36,
          modelCents: 82
        }
      : {
          sportsDataCents: 24,
          searchCents: 18,
          extractionCents: 0,
          modelCents: 34
        };

  const estimatedApiCostCents = sumBreakdown(breakdown);
  const estimatedUserChargeCents = Math.max(
    Math.round(estimatedApiCostCents * config.billingMarkupMultiplier),
    config.minimumChargeCents
  );

  return {
    providerMode: config.providerMode,
    estimatedApiCostCents,
    estimatedUserChargeCents,
    minimumChargeCents: config.minimumChargeCents,
    markupMultiplier: config.billingMarkupMultiplier,
    currency: "CNY",
    breakdown,
    notes: [
      config.providerMode === "mock" ? "当前为 mock provider，不会产生真实 API 费用。" : "实时模式最终按服务端记录的实际模型用量结算。",
      `真实平台托管模式上线后，最终收费 = max(实际 API 成本 x ${config.billingMarkupMultiplier}, 最低单次费用)。`,
      "客户端提交的费用不会被信任，最终费用必须由服务端 provider 记录计算。"
    ]
  };
}

export function formatCny(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`;
}

export function assertBillingGate(input: PredictionInput, estimate: CostEstimate) {
  if (input.billingMode === "platform" && input.maxUserChargeCents < estimate.estimatedUserChargeCents) {
    return {
      ok: false,
      message: `平台托管模式需要先授权至少 ${formatCny(
        estimate.estimatedUserChargeCents
      )} 的费用上限。`
    };
  }

  return { ok: true, message: "Billing gate passed." };
}
