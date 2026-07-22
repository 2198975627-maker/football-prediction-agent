import { NextResponse } from "next/server";
import { requestUser, serviceClient } from "@/src/lib/supabase-auth";

export async function GET(request: Request) {
  const user = await requestUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "请先登录。" }, { status: 401 });
  const orderId = new URL(request.url).searchParams.get("order") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ ok: false, error: "订单ID无效。" }, { status: 400 });
  const { data } = await serviceClient().from("football_payment_orders").select("id,status,authorized_cents,paid_cents,charged_cents,currency,created_at").eq("id", orderId).eq("user_id", user.id).maybeSingle();
  return data ? NextResponse.json({ ok: true, order: data }) : NextResponse.json({ ok: false, error: "订单不存在。" }, { status: 404 });
}
