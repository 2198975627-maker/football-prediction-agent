import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitHeaders } from "@/src/lib/rate-limit";
import { readLimitedJson, RequestBodyTooLargeError } from "@/src/lib/http-security";
import {
  getPlayerEventProviderStatuses,
  loadPlayerEventData,
  PlayerEventProviderError
} from "@/src/lib/providers/player-events";

type PlayerEventsBody = {
  provider?: string;
  matchId?: string;
  fixtureId?: string;
};

export async function GET() {
  return NextResponse.json({ ok: true, providers: getPlayerEventProviderStatuses() });
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { keyPrefix: "player-events", limit: 20, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "请求过于频繁，请稍后重试。" },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  let body: PlayerEventsBody;
  try {
    body = ((await readLimitedJson(request)) ?? {}) as PlayerEventsBody;
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return NextResponse.json(
      { ok: false, error: tooLarge ? error.message : "JSON 请求无效。" },
      { status: tooLarge ? 413 : 400 }
    );
  }

  try {
    const data = await loadPlayerEventData(body.provider?.trim() || "auto", {
      matchId: body.matchId,
      fixtureId: body.fixtureId
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof PlayerEventProviderError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "球员事件数据获取失败。" },
      { status: 502 }
    );
  }
}
