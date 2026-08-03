import { NextResponse } from "next/server";
import { getUserAiCostSummary } from "@/src/lib/ai-costs";
import { checkRateLimit, rateLimitHeaders } from "@/src/lib/rate-limit";
import { requestUser } from "@/src/lib/supabase-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requestUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "请先登录。" }, { status: 401 });

  const limited = await checkRateLimit(request, { keyPrefix: `cost-summary:${user.id}`, limit: 30, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "成本统计请求过于频繁。" },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
  try {
    return NextResponse.json({ ok: true, summary: await getUserAiCostSummary(user.id, days) });
  } catch (error) {
    console.error("Failed to load AI cost summary", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json({ ok: false, error: "成本统计暂时不可用。" }, { status: 503 });
  }
}
