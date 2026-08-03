import Stripe from "stripe";
import { serviceClient } from "./supabase-auth";
import { getSupabaseSettings } from "./supabase-config";
import type { AiProvider } from "./ai-provider";
import type { PredictionInput } from "./schemas";
import { calculateAiModelCost } from "./ai-costs";

export type PaymentOrder = {
  id: string;
  user_id: string;
  status: "pending" | "paid" | "processing" | "refund_pending" | "consumed" | "failed" | "refunded";
  authorized_cents: number;
  charged_cents?: number;
  currency: string;
  stripe_session_id: string | null;
  payment_intent_id: string | null;
  prediction_input: unknown;
};

const orderSelect = "id,user_id,status,authorized_cents,charged_cents,currency,stripe_session_id,payment_intent_id,prediction_input";

export function paymentInputSnapshot(input: PredictionInput) {
  return {
    teamA: input.teamA.trim(),
    teamB: input.teamB.trim(),
    matchDate: input.matchDate.trim(),
    competition: input.competition.trim(),
    homeTeam: input.homeTeam,
    analysisDepth: input.analysisDepth,
    billingMode: input.billingMode,
    maxUserChargeCents: input.maxUserChargeCents
  };
}

function orderMatchesInput(stored: unknown, input: PredictionInput) {
  if (!stored || typeof stored !== "object") return false;
  return JSON.stringify(stored) === JSON.stringify(paymentInputSnapshot(input));
}

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe 尚未配置。");
  return new Stripe(key);
}

export function isPaymentConfigured() {
  const { secretKey } = getSupabaseSettings();
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim()
      && process.env.STRIPE_WEBHOOK_SECRET?.trim()
      && secretKey
  );
}

export async function createOrder(userId: string, authorizedCents: number, predictionInput: PredictionInput) {
  const { data, error } = await serviceClient().from("football_payment_orders").insert({
    user_id: userId,
    status: "pending",
    authorized_cents: authorizedCents,
    currency: "cny",
    prediction_input: paymentInputSnapshot(predictionInput)
  }).select(orderSelect).single();
  if (error || !data) throw new Error("无法创建支付订单。");
  return data as PaymentOrder;
}

export async function attachStripeSession(orderId: string, sessionId: string) {
  const { error } = await serviceClient().from("football_payment_orders")
    .update({ stripe_session_id: sessionId })
    .eq("id", orderId)
    .eq("status", "pending");
  if (error) throw new Error("无法保存 Stripe 会话。");
}

export async function failPendingOrder(orderId: string, reason: string) {
  const { error } = await serviceClient().from("football_payment_orders")
    .update({ status: "failed", failure_reason: reason.slice(0, 300) })
    .eq("id", orderId)
    .eq("status", "pending");
  if (error) console.error("Failed to mark pending payment order as failed", { orderId, code: error.code });
}

export async function claimPaidOrder(orderId: string, userId: string, minimumCents: number, input: PredictionInput) {
  const { data: candidate, error: readError } = await serviceClient().from("football_payment_orders")
    .select(orderSelect)
    .eq("id", orderId)
    .eq("user_id", userId)
    .eq("status", "paid")
    .gte("authorized_cents", minimumCents)
    .maybeSingle();
  if (readError || !candidate || !orderMatchesInput(candidate.prediction_input, input)) return null;

  const { data, error } = await serviceClient().from("football_payment_orders")
    .update({ status: "processing", processing_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("user_id", userId)
    .eq("status", "paid")
    .gte("authorized_cents", minimumCents)
    .select(orderSelect)
    .maybeSingle();
  if (error || !data) return null;
  return data as PaymentOrder;
}

export async function releaseOrder(orderId: string, reason: string) {
  const { error } = await serviceClient().from("football_payment_orders")
    .update({ status: "paid", failure_reason: reason.slice(0, 300) })
    .eq("id", orderId)
    .eq("status", "processing");
  if (error) throw new Error("无法释放支付订单。");
}

export async function settleOrder(
  order: PaymentOrder,
  actualApiCostCents: number,
  userChargeCents: number,
  metadata: Record<string, unknown>,
  job: {
    id: string;
    input: unknown;
    provider: string;
    model: string;
    qualityScore: number;
    result: unknown;
    report: string;
  }
): Promise<{ refundPending: boolean }> {
  const refundCents = Math.max(0, order.authorized_cents - userChargeCents);
  const { error } = await serviceClient().rpc("settle_football_payment_order", {
    p_order_id: order.id,
    p_user_id: order.user_id,
    p_actual_api_cost_cents: actualApiCostCents,
    p_user_charge_cents: userChargeCents,
    p_refund_cents: refundCents,
    p_currency: order.currency,
    p_metadata: metadata,
    p_job_id: job.id,
    p_input: job.input,
    p_provider: job.provider,
    p_model: job.model,
    p_quality_score: job.qualityScore,
    p_result: job.result,
    p_report: job.report
  });
  if (error) throw new Error("订单结算失败。");

  if (refundCents === 0) return { refundPending: false };
  if (!order.payment_intent_id) return { refundPending: true };

  try {
    const refund = await stripeClient().refunds.create(
      {
        payment_intent: order.payment_intent_id,
        amount: refundCents,
        metadata: { order_id: order.id, reason: "unused_prediction_authorization" }
      },
      { idempotencyKey: `football-refund-${order.id}-${refundCents}` }
    );
    const { error: finalizeError } = await serviceClient().rpc("complete_football_payment_refund", {
      p_order_id: order.id,
      p_user_id: order.user_id,
      p_refund_cents: refundCents,
      p_currency: order.currency,
      p_stripe_refund_id: refund.id,
      p_metadata: metadata
    });
    return { refundPending: Boolean(finalizeError) };
  } catch (error) {
    console.error("Payment refund remains pending", {
      orderId: order.id,
      error: error instanceof Error ? error.message : "unknown"
    });
    return { refundPending: true };
  }
}

export function modelCostCents(provider: AiProvider, inputTokens: number, outputTokens: number) {
  const cost = calculateAiModelCost(provider, {
    inputTokens,
    cachedInputTokens: 0,
    outputTokens,
    reasoningTokens: 0,
    totalTokens: inputTokens + outputTokens
  });
  if (!cost.pricing.configured) throw new Error(`${provider} model pricing is not configured.`);
  return cost.billedModelCostCents;
}

export async function reconcilePendingRefunds(limit = 10) {
  const { data, error } = await serviceClient().from("football_payment_orders")
    .select(orderSelect)
    .eq("status", "refund_pending")
    .order("refund_requested_at", { ascending: true })
    .limit(Math.min(50, Math.max(1, limit)));
  if (error) throw new Error("无法读取待退款订单。");

  const results = [];
  for (const row of (data ?? []) as PaymentOrder[]) {
    const refundCents = row.authorized_cents - (row.charged_cents ?? 0);
    if (!row.payment_intent_id || refundCents <= 0) {
      results.push({ orderId: row.id, ok: false, error: "invalid refund state" });
      continue;
    }
    try {
      const refund = await stripeClient().refunds.create(
        {
          payment_intent: row.payment_intent_id,
          amount: refundCents,
          metadata: { order_id: row.id, reason: "unused_prediction_authorization" }
        },
        { idempotencyKey: `football-refund-${row.id}-${refundCents}` }
      );
      const { error: finalizeError } = await serviceClient().rpc("complete_football_payment_refund", {
        p_order_id: row.id,
        p_user_id: row.user_id,
        p_refund_cents: refundCents,
        p_currency: row.currency,
        p_stripe_refund_id: refund.id,
        p_metadata: { reconciled: true }
      });
      if (finalizeError) throw new Error("refund confirmation failed");
      results.push({ orderId: row.id, ok: true });
    } catch (refundError) {
      results.push({ orderId: row.id, ok: false, error: refundError instanceof Error ? refundError.message : "unknown" });
    }
  }
  return results;
}
