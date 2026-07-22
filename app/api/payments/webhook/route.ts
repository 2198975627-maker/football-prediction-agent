import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { serviceClient } from "@/src/lib/supabase-auth";
import { stripeClient } from "@/src/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ ok: false, error: "Webhook 尚未配置。" }, { status: 503 });
  }

  const body = await request.text();
  if (body.length > 1_000_000) {
    return NextResponse.json({ ok: false, error: "Webhook 请求过大。" }, { status: 413 });
  }

  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ ok: false, error: "Webhook 签名无效。" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.order_id;
  const userId = session.metadata?.user_id;
  const paidCents = session.amount_total ?? 0;
  if (!orderId || !userId || session.payment_status !== "paid" || paidCents <= 0) {
    return NextResponse.json({ ok: false, error: "Webhook 支付元数据无效。" }, { status: 400 });
  }

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
  const { data, error } = await serviceClient().rpc("process_football_checkout_completed", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_order_id: orderId,
    p_user_id: userId,
    p_session_id: session.id,
    p_payment_intent_id: paymentIntentId,
    p_paid_cents: paidCents,
    p_currency: session.currency ?? "cny"
  });

  if (error) {
    console.error("Stripe webhook transaction failed", { eventId: event.id, code: error.code });
    return NextResponse.json({ ok: false, error: "Webhook 入账事务失败。" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, duplicate: data === "duplicate" });
}
