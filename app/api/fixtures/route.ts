import { NextResponse } from "next/server";
import { FixtureScheduleError, getFixtureSchedule } from "@/src/lib/fixture-schedule";
import { checkRateLimit, rateLimitHeaders } from "@/src/lib/rate-limit";
import { buildOfflineFixtureSchedule } from "@/src/lib/mock-scenarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return false;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return timestamp >= todayUtc && timestamp <= todayUtc + 370 * 86_400_000;
}

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { keyPrefix: "fixture-schedule", limit: 20, windowMs: 5 * 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, code: "RATE_LIMITED", error: "赛程刷新过于频繁，请稍后再试。" },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.trim() ?? "";
  const days = Number(url.searchParams.get("days") ?? "1");
  const forceRefresh = url.searchParams.get("refresh") === "1";
  if (!validDate(date) || !Number.isInteger(days) || days < 1 || days > 30) {
    return NextResponse.json(
      { ok: false, code: "INVALID_FIXTURE_DATE", error: "日期必须是允许范围内的 YYYY-MM-DD。" },
      { status: 400, headers: rateLimitHeaders(limited) }
    );
  }

  if (forceRefresh) {
    const refreshLimited = await checkRateLimit(request, {
      keyPrefix: "fixture-schedule-force-refresh",
      limit: 3,
      windowMs: 5 * 60_000
    });
    if (!refreshLimited.ok) {
      return NextResponse.json(
        { ok: false, code: "REFRESH_RATE_LIMITED", error: "强制刷新次数已达上限，请稍后再试。" },
        { status: 429, headers: rateLimitHeaders(refreshLimited) }
      );
    }
  }

  try {
    const schedule = await getFixtureSchedule(date, forceRefresh, days);
    const delivered = schedule.fixtures.length
      ? schedule
      : buildOfflineFixtureSchedule(date, days, "真实赛事源当前没有返回可展示比赛，已载入本地演示赛程。");
    return NextResponse.json(delivered, {
      headers: {
        ...rateLimitHeaders(limited),
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120"
      }
    });
  } catch (error) {
    const known = error instanceof FixtureScheduleError;
    const reason = known
      ? `真实赛事源暂不可用（${error.code}），已载入本地演示赛程。`
      : "真实赛事源暂不可用，已载入本地演示赛程。";
    return NextResponse.json(buildOfflineFixtureSchedule(date, days, reason), {
      headers: { ...rateLimitHeaders(limited), "Cache-Control": "public, max-age=30, stale-while-revalidate=120" }
    });
  }
}
