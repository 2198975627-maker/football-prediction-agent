import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { assertBillingGate, estimateCost } from "@/src/lib/billing";
import { readLimitedJson, RequestBodyTooLargeError } from "@/src/lib/http-security";
import { checkRateLimit, rateLimitHeaders } from "@/src/lib/rate-limit";
import { getRuntimeConfig } from "@/src/lib/runtime";
import { predictionInputSchema } from "@/src/lib/schemas";
import { runMockPrediction } from "@/src/lib/workflow";
import { assessMatchDataQuality } from "@/src/lib/match-data-quality";
import {
  fixtureCacheKey,
  matchIntelligenceCacheKey,
  readMatchIntelligenceCache,
  writeMatchIntelligenceCache
} from "@/src/lib/match-intelligence-cache";
import { getLiveMatchIntelligence } from "@/src/lib/providers/match-intelligence";
import { predictionMarkdown } from "@/src/lib/openai-prediction";
import {
  getConfiguredAiProvider,
  isAiPricingConfigured,
  runAiPrediction,
  type AiProviderConfig
} from "@/src/lib/ai-provider";
import {
  aiErrorCode,
  calculateAiModelCost,
  recordAiUsage,
  updateAiUsageCharge
} from "@/src/lib/ai-costs";
import { claimPaidOrder, releaseOrder, settleOrder } from "@/src/lib/payments";
import { requestUser } from "@/src/lib/supabase-auth";
import { baseWorkflowSteps, findSafetyIssue, markComplete } from "@/src/lib/safety";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { keyPrefix: "predict", limit: 10, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "请求过于频繁。" },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return NextResponse.json(
      { ok: false, error: tooLarge ? error.message : "JSON 请求无效。" },
      { status: tooLarge ? 413 : 400 }
    );
  }

  const parsed = predictionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "请求参数无效。", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const safetyIssue = findSafetyIssue(input);
  if (safetyIssue) return NextResponse.json({ ok: false, error: safetyIssue }, { status: 400 });

  const estimate = estimateCost(input);
  const billingGate = assertBillingGate(input, estimate);
  if (!billingGate.ok) {
    return NextResponse.json({ ok: false, error: billingGate.message, estimate }, { status: 402 });
  }

  const config = getRuntimeConfig();
  if (config.providerMode === "mock") {
    return NextResponse.json({ ok: true, result: runMockPrediction(input) });
  }

  let apiKey = "";
  let aiConfig: AiProviderConfig;
  let order = null;
  const user = await requestUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "正式数据预测需要先登录。" }, { status: 401 });
  }
  const userLimited = await checkRateLimit(request, { keyPrefix: `predict-live:${user.id}`, limit: 4, windowMs: 60_000 });
  if (!userLimited.ok) {
    return NextResponse.json({ ok: false, error: "实时预测请求过于频繁。" }, { status: 429, headers: rateLimitHeaders(userLimited) });
  }
  if (input.billingMode === "byok") {
    apiKey = request.headers.get("x-openai-api-key")?.trim() ?? "";
    if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey)) {
      return NextResponse.json({ ok: false, error: "BYOK 模式需要在本次请求中提供有效的 OpenAI API Key。" }, { status: 401 });
    }
    aiConfig = {
      provider: "openai",
      apiKey,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-5.6-terra"
    };
  } else {
    if (!config.liveCostsEnabled) {
      return NextResponse.json({ ok: false, error: "平台实时计费尚未启用。" }, { status: 503 });
    }
    if (!input.paymentOrderId) {
      return NextResponse.json({ ok: false, error: "请先完成预付费。" }, { status: 402 });
    }
    const platformAi = getConfiguredAiProvider();
    if (!platformAi) {
      return NextResponse.json({ ok: false, error: "平台 AI 服务尚未配置。" }, { status: 503 });
    }
    if (!isAiPricingConfigured(platformAi.provider)) {
      return NextResponse.json({ ok: false, error: "平台 AI 价格尚未配置，已禁止真实收费预测。" }, { status: 503 });
    }
    order = await claimPaidOrder(input.paymentOrderId, user.id, estimate.estimatedUserChargeCents, input);
    if (!order) {
      return NextResponse.json({ ok: false, error: "支付订单未确认、金额不足或已被使用。" }, { status: 402 });
    }
    aiConfig = platformAi;
    apiKey = platformAi.apiKey;
  }

  const jobId = randomUUID();
  const safetyIdentifier = createHash("sha256").update(user.id).digest("hex");
  let aiAttempted = false;
  let aiFinished = false;
  let aiStartedAt = Date.now();
  try {
    const cacheKey = matchIntelligenceCacheKey(input);
    let cached = await readMatchIntelligenceCache(cacheKey, 30 * 60_000);
    let matchData = cached && !cached.stale ? cached.data : null;
    const usedPaidSportsData = !matchData;
    if (!matchData) {
      matchData = await getLiveMatchIntelligence(input);
      await writeMatchIntelligenceCache(
        [cacheKey, fixtureCacheKey(matchData.fixture.id, matchData.provider)],
        matchData
      );
      cached = await readMatchIntelligenceCache(cacheKey, 30 * 60_000);
    }

    const quality = assessMatchDataQuality(matchData, { cacheAgeSeconds: cached?.ageSeconds ?? 0 });
    if (!quality.canRunOfficialPrediction) {
      if (order) {
        await releaseOrder(order.id, `data quality blocked: ${quality.missingRequired.join(", ")}`);
        order = null;
      }
      return NextResponse.json({
        ok: false,
        code: "DATA_QUALITY_GATE_BLOCKED",
        error: `真实数据不足，正式预测仍缺：${quality.missingRequired.join("、")}`,
        quality
      }, { status: 422 });
    }

    aiAttempted = true;
    aiStartedAt = Date.now();
    const generated = await runAiPrediction(input, matchData, quality, aiConfig, { safetyIdentifier });
    aiFinished = true;
    const aiCost = calculateAiModelCost(generated.aiProvider, generated.usage);
    const sportsDataCostCents = usedPaidSportsData ? estimate.breakdown.sportsDataCents : 0;
    const combinedApiCostCents = sportsDataCostCents + aiCost.billedModelCostCents;
    const actualApiCostCents = sportsDataCostCents
      + (input.billingMode === "platform" ? aiCost.billedModelCostCents : 0);
    const calculatedCharge = Math.max(
      Math.ceil(actualApiCostCents * config.billingMarkupMultiplier),
      config.minimumChargeCents
    );
    const chargedCents = input.billingMode === "platform"
      ? Math.min(calculatedCharge, input.maxUserChargeCents, order?.authorized_cents ?? calculatedCharge)
      : 0;

    try {
      await recordAiUsage({
        jobId,
        userId: user.id,
        orderId: order?.id ?? null,
        billingMode: input.billingMode,
        provider: generated.aiProvider,
        model: generated.model,
        responseId: generated.responseId,
        status: "completed",
        usage: generated.usage,
        pricing: aiCost.pricing,
        modelCostCents: aiCost.modelCostCents,
        sportsDataCostCents,
        platformCostCents: actualApiCostCents,
        userChargeCents: 0,
        latencyMs: Date.now() - aiStartedAt,
        metadata: {
          matchProvider: matchData.provider,
          dataQualityScore: quality.score,
          sportsDataCacheHit: !usedPaidSportsData,
          plannedUserChargeCents: chargedCents
        }
      });
    } catch (usageError) {
      console.error("Failed to persist completed AI usage", {
        jobId,
        error: usageError instanceof Error ? usageError.message : "unknown"
      });
    }

    let workflow = baseWorkflowSteps();
    workflow = markComplete(workflow, "validate-input", "输入与安全规则已通过。");
    workflow = markComplete(workflow, "billing-authorized", input.billingMode === "platform"
      ? "Stripe 签名支付已确认。"
      : "BYOK Key 仅用于本次内存请求。");
    workflow = markComplete(workflow, "team-resolution", `已定位 fixture ${matchData.fixture.id}。`);
    workflow = markComplete(workflow, "football-data", `已用 ${matchData.fusion?.succeededProviders.length ?? 1} 个结构化来源交叉核验，质量 ${quality.score}/100。`);
    workflow = markComplete(workflow, "player-matchups", "已基于球员比赛指标和赛季画像生成对位分析。");
    workflow = markComplete(workflow, "tactical-coach", "已生成战术克制与阵型影响。");
    workflow = markComplete(workflow, "public-research", "未使用社媒主观帖子作为数字证据。");
    workflow = markComplete(workflow, "source-verification", "数据来源和冲突记录已附加。");
    workflow = markComplete(workflow, "prediction", `由 ${generated.model} 生成结构化概率。`);
    workflow = markComplete(workflow, "settlement", input.billingMode === "platform"
      ? `实际 API 成本 ${actualApiCostCents} 分，用户结算 ${chargedCents} 分。`
      : "费用由用户自己的 OpenAI 账户承担。");
    const report = predictionMarkdown(input, matchData, quality, generated.result);

    let refundPending = false;
    if (order) {
      const settlement = await settleOrder(
        order,
        actualApiCostCents,
        chargedCents,
        { jobId, model: generated.model, aiProvider: generated.aiProvider, usage: generated.usage, provider: matchData.provider },
        {
          id: jobId,
          input,
          provider: matchData.provider,
          model: generated.model,
          qualityScore: quality.score,
          result: generated.result,
          report
        }
      );
      refundPending = settlement.refundPending;
      try {
        await updateAiUsageCharge(jobId, user.id, chargedCents);
      } catch (usageError) {
        console.error("Failed to update settled AI charge", {
          jobId,
          error: usageError instanceof Error ? usageError.message : "unknown"
        });
      }
    }

    return NextResponse.json({
      ok: true,
      result: {
        jobId,
        providerMode: "live",
        billingMode: input.billingMode,
        cost: {
          ...estimate,
          providerMode: "live",
          status: "actual",
          estimatedApiCostCents: combinedApiCostCents,
          estimatedUserChargeCents: chargedCents,
          breakdown: {
            sportsDataCents: sportsDataCostCents,
            searchCents: 0,
            extractionCents: 0,
            modelCents: aiCost.billedModelCostCents
          },
          actual: {
            aiProvider: generated.aiProvider,
            model: generated.model,
            pricingConfigured: aiCost.pricing.configured,
            inputTokens: generated.usage.inputTokens,
            cachedInputTokens: generated.usage.cachedInputTokens,
            outputTokens: generated.usage.outputTokens,
            reasoningTokens: generated.usage.reasoningTokens,
            totalTokens: generated.usage.totalTokens,
            modelCostCents: aiCost.modelCostCents,
            sportsDataCostCents,
            platformCostCents: actualApiCostCents,
            userChargeCents: chargedCents,
            currency: "CNY"
          },
          notes: [
            usedPaidSportsData ? "已计入本次体育数据调用成本。" : "体育数据来自有效缓存，本次未重复计费。",
            aiCost.pricing.configured
              ? "已按模型返回的实际 Token 用量和本次价格快照计算。"
              : "已记录实际 Token 用量；尚未配置 CNY 模型价格，因此不展示模型金额。",
            `计费倍率 ${config.billingMarkupMultiplier}x。`,
            ...(refundPending ? ["未使用额度退款正在处理，可在订单中查询状态。"] : [])
          ]
        },
        workflow,
        report,
        generatedAt: new Date().toISOString(),
        model: generated.model,
        aiProvider: generated.aiProvider,
        dataQualityScore: quality.score
      }
    });
  } catch (error) {
    if (aiAttempted && !aiFinished) {
      try {
        await recordAiUsage({
          jobId,
          userId: user.id,
          orderId: order?.id ?? null,
          billingMode: input.billingMode,
          provider: aiConfig.provider,
          model: aiConfig.model,
          status: "failed",
          latencyMs: Date.now() - aiStartedAt,
          errorCode: aiErrorCode(error)
        });
      } catch (usageError) {
        console.error("Failed to persist failed AI usage", {
          jobId,
          error: usageError instanceof Error ? usageError.message : "unknown"
        });
      }
    }
    if (order) {
      try {
        await releaseOrder(order.id, error instanceof Error ? error.message : "prediction failed");
      } catch (releaseError) {
        console.error("Failed to release payment order", {
          orderId: order.id,
          error: releaseError instanceof Error ? releaseError.message : "unknown"
        });
      }
    }
    return NextResponse.json({ ok: false, error: "实时数据或 AI 分析失败，支付订单未被消耗，可重试。" }, { status: 502 });
  } finally {
    apiKey = "";
  }
}
