import { NextResponse } from "next/server";
import { z } from "zod";
import { readLimitedJson, RequestBodyTooLargeError } from "@/src/lib/http-security";
import { checkRateLimit, rateLimitHeaders } from "@/src/lib/rate-limit";
import { assessMatchDataQuality } from "@/src/lib/match-data-quality";
import { trackMatchIntelligence } from "@/src/lib/tracked-fixtures";
import { requestUser } from "@/src/lib/supabase-auth";
import {
  fixtureCacheKey,
  matchIntelligenceCacheKey,
  persistProviderEntityMappings,
  readMatchIntelligenceCache,
  writeMatchIntelligenceCache
} from "@/src/lib/match-intelligence-cache";
import {
  configuredMatchProviders,
  getLiveMatchIntelligence,
  hasConfiguredMatchProvider,
  MatchProviderError
} from "@/src/lib/providers/match-intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  teamA: z.string().trim().min(2).max(100),
  teamB: z.string().trim().min(2).max(100),
  matchDate: z.string().trim().min(10).max(40),
  fixtureId: z.string().trim().regex(/^\d{4,12}$/).optional(),
  forceRefresh: z.boolean().optional().default(false)
});

function cacheMaxAgeMs() {
  const seconds = Number(process.env.MATCH_INTELLIGENCE_CACHE_SECONDS ?? 900);
  return Math.min(86_400, Math.max(60, Number.isFinite(seconds) ? seconds : 900)) * 1000;
}

function cachedResponse(
  cache: NonNullable<Awaited<ReturnType<typeof readMatchIntelligenceCache>>>,
  status: "hit" | "stale"
) {
  return NextResponse.json(
    {
      ...cache.data,
      quality: assessMatchDataQuality(cache.data, { cacheAgeSeconds: cache.ageSeconds }),
      warnings:
        status === "stale"
          ? [...cache.data.warnings, `实时数据源暂不可用，当前返回 ${cache.ageSeconds} 秒前的缓存。`]
          : cache.data.warnings,
      cache: {
        status,
        storage: cache.storage,
        updatedAt: cache.updatedAt,
        ageSeconds: cache.ageSeconds
      }
    },
    { headers: { "Cache-Control": "private, max-age=30" } }
  );
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { keyPrefix: "match-intelligence", limit: 10, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "真实比赛数据请求过于频繁。" },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof RequestBodyTooLargeError ? error.message : "无效 JSON。" },
      { status: error instanceof RequestBodyTooLargeError ? 413 : 400 }
    );
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "比赛数据请求参数无效。", issues: parsed.error.flatten() }, { status: 400 });
  }

  const cacheKey = matchIntelligenceCacheKey(parsed.data);
  const cached = await readMatchIntelligenceCache(cacheKey, cacheMaxAgeMs());
  if (cached && !cached.stale && !parsed.data.forceRefresh) {
    return cachedResponse(cached, "hit");
  }

  const user = await requestUser(request);
  if (!user) {
    if (cached) return cachedResponse(cached, "stale");
    return NextResponse.json(
      { ok: false, code: "AUTH_REQUIRED_FOR_LIVE_FETCH", error: "实时数据未命中缓存，请先登录后同步。" },
      { status: 401 }
    );
  }

  const userLimited = await checkRateLimit(request, {
    keyPrefix: `match-intelligence-live:${user.id}`,
    limit: parsed.data.forceRefresh ? 2 : 6,
    windowMs: 60_000
  });
  if (!userLimited.ok) {
    return NextResponse.json(
      { ok: false, error: "实时数据刷新过于频繁，请稍后重试。" },
      { status: 429, headers: rateLimitHeaders(userLimited) }
    );
  }

  if (!hasConfiguredMatchProvider()) {
    if (cached) return cachedResponse(cached, "stale");
    return NextResponse.json(
      {
        ok: false,
        code: "NO_MATCH_PROVIDER_CONFIGURED",
        error: "尚未配置体育数据 Key。大陆部署可先申请 AnySport，也可使用 API-Football 或 football-data.org。",
        configuredProviders: configuredMatchProviders()
      },
      { status: 503 }
    );
  }

  try {
    const result = await getLiveMatchIntelligence(parsed.data);
    const storage = await writeMatchIntelligenceCache(
      [cacheKey, fixtureCacheKey(result.fixture.id, result.provider)],
      result
    );
    const [mappingsPersisted, fixtureTracked] = await Promise.all([
      persistProviderEntityMappings(result),
      trackMatchIntelligence(result)
    ]);
    return NextResponse.json({
      ...result,
      quality: assessMatchDataQuality(result, { cacheAgeSeconds: 0 }),
      cache: {
        status: cached ? "refreshed" : "miss",
        storage: storage.supabase ? "supabase" : "memory",
        updatedAt: result.fetchedAt,
        ageSeconds: 0
      },
      persistence: {
        entityMappings: mappingsPersisted ? "supabase" : "not-configured",
        fixtureTracking: fixtureTracked ? "scheduled" : "not-configured"
      }
    }, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120"
      }
    });
  } catch (error) {
    if (cached) return cachedResponse(cached, "stale");
    if (error instanceof MatchProviderError) {
      return NextResponse.json(
        { ok: false, code: error.code, error: error.message, providerAttempts: error.attempts },
        { status: error.status }
      );
    }
    return NextResponse.json({ ok: false, error: "真实比赛数据导入失败。" }, { status: 502 });
  }
}
