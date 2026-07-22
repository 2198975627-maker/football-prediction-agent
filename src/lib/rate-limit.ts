type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number; backend: "upstash" | "memory" }
  | { ok: false; remaining: 0; resetAt: number; retryAfterSeconds: number; backend: "upstash" | "memory" };

const globalRateLimit = globalThis as typeof globalThis & {
  __footballPredictionRateLimit?: Map<string, RateLimitBucket>;
};

const buckets = globalRateLimit.__footballPredictionRateLimit ?? new Map<string, RateLimitBucket>();
globalRateLimit.__footballPredictionRateLimit = buckets;

function getClientIp(request: Request) {
  const trustProxy = process.env.TRUST_PROXY_HEADERS === "true"
    || Boolean(process.env.VERCEL)
    || Boolean(request.headers.get("cf-ray"));
  if (!trustProxy) return "untrusted-proxy";
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function cleanupExpired(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function checkMemoryRateLimit(request: Request, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  cleanupExpired(now);

  const key = `${options.keyPrefix}:${getClientIp(request)}`;
  const current = buckets.get(key);
  const bucket =
    current && current.resetAt > now
      ? current
      : {
          count: 0,
          resetAt: now + options.windowMs
        };

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > options.limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      backend: "memory"
    };
  }

  return {
    ok: true,
    remaining: Math.max(0, options.limit - bucket.count),
    resetAt: bucket.resetAt,
    backend: "memory"
  };
}

async function checkUpstashRateLimit(request: Request, options: RateLimitOptions): Promise<RateLimitResult | null> {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!baseUrl || !token) return null;

  const key = `rate-limit:${options.keyPrefix}:${getClientIp(request)}`;
  const script = [
    "local current = redis.call('INCR', KEYS[1])",
    "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
    "local ttl = redis.call('PTTL', KEYS[1])",
    "return {current, ttl}"
  ].join("\n");

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(["EVAL", script, "1", key, String(options.windowMs)]),
      signal: AbortSignal.timeout(2500),
      cache: "no-store"
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as { result?: [number, number] };
    const count = Number(payload.result?.[0]);
    const ttl = Number(payload.result?.[1]);
    if (!Number.isFinite(count) || !Number.isFinite(ttl)) return null;

    const resetAt = Date.now() + Math.max(1000, ttl);
    if (count > options.limit) {
      return {
        ok: false,
        remaining: 0,
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)),
        backend: "upstash"
      };
    }

    return {
      ok: true,
      remaining: Math.max(0, options.limit - count),
      resetAt,
      backend: "upstash"
    };
  } catch {
    return null;
  }
}

export async function checkRateLimit(request: Request, options: RateLimitOptions): Promise<RateLimitResult> {
  const upstashConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
  const distributed = await checkUpstashRateLimit(request, options);
  if (distributed) return distributed;
  const failClosed = process.env.RATE_LIMIT_FAIL_CLOSED === "true"
    || (process.env.NODE_ENV === "production" && upstashConfigured);
  if (failClosed) {
    return {
      ok: false,
      remaining: 0,
      resetAt: Date.now() + options.windowMs,
      retryAfterSeconds: Math.max(1, Math.ceil(options.windowMs / 1000)),
      backend: "memory"
    };
  }
  return checkMemoryRateLimit(request, options);
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "X-RateLimit-Backend": result.backend,
    ...(result.ok ? {} : { "Retry-After": String(result.retryAfterSeconds) })
  };
}
