import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { reconcilePendingRefunds } from "@/src/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  const production = process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
  if (!secret) return !production;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
  }
  const results = await reconcilePendingRefunds(12);
  return NextResponse.json({
    ok: true,
    processed: results.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results
  });
}
