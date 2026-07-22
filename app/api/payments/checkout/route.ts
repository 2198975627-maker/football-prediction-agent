import { NextResponse } from "next/server";
import { predictionInputSchema } from "@/src/lib/schemas";
import { estimateCost } from "@/src/lib/billing";
import { readLimitedJson } from "@/src/lib/http-security";
import { checkRateLimit } from "@/src/lib/rate-limit";
import { requestUser } from "@/src/lib/supabase-auth";
import { attachStripeSession, createOrder, failPendingOrder, isPaymentConfigured, stripeClient } from "@/src/lib/payments";

export async function POST(request: Request) {
  if (!isPaymentConfigured()) return NextResponse.json({ ok: false, error: "支付服务尚未配置。" }, { status: 503 });
  const user = await requestUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "请先登录。" }, { status: 401 });
  const limited = await checkRateLimit(request, { keyPrefix: `checkout:${user.id}`, limit: 5, windowMs: 15 * 60_000 });
  if (!limited.ok) return NextResponse.json({ ok: false, error: "创建支付订单过于频繁。" }, { status: 429 });
  const parsed = predictionInputSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success || parsed.data.billingMode !== "platform") return NextResponse.json({ ok: false, error: "支付请求参数无效。" }, { status: 400 });
  const estimate = estimateCost(parsed.data);
  const amount = estimate.estimatedUserChargeCents;
  if (parsed.data.maxUserChargeCents < amount) return NextResponse.json({ ok: false, error: "费用上限低于预估金额。", estimate }, { status: 402 });
  const order = await createOrder(user.id, amount, parsed.data);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin).replace(/\/+$/, "");
  try {
    const session = await stripeClient().checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { order_id: order.id, user_id: user.id },
      line_items: [{ quantity: 1, price_data: { currency: "cny", unit_amount: amount, product_data: { name: `${parsed.data.teamA} vs ${parsed.data.teamB} 赛前分析额度` } } }],
      success_url: `${appUrl}/?payment=success&order=${order.id}`,
      cancel_url: `${appUrl}/?payment=cancelled&order=${order.id}`
    }, { idempotencyKey: `football-order-${order.id}` });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    await attachStripeSession(order.id, session.id);
    return NextResponse.json({ ok: true, orderId: order.id, checkoutUrl: session.url, estimate });
  } catch (error) {
    await failPendingOrder(order.id, error instanceof Error ? error.message : "checkout failed");
    return NextResponse.json({ ok: false, error: "支付会话创建失败，请稍后重试。" }, { status: 502 });
  }
}
