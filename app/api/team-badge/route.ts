import { NextResponse } from "next/server";
import { readLimitedResponseBytes } from "@/src/lib/http-security";
import { checkRateLimit, rateLimitHeaders } from "@/src/lib/rate-limit";

const ALLOWED_BADGE_HOSTS = new Set([
  "r2.thesportsdb.com",
  "www.thesportsdb.com",
  "media.api-sports.io",
  "cdn.sportmonks.com",
  "crests.football-data.org",
  ...((process.env.BADGE_PROXY_HOSTS ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean))
]);
const MAX_BADGE_URL_LENGTH = 600;
const MAX_BADGE_BYTES = 2 * 1024 * 1024;

function parseBadgeUrl(rawUrl: string | null) {
  if (!rawUrl || rawUrl.length > MAX_BADGE_URL_LENGTH) return null;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    if (!ALLOWED_BADGE_HOSTS.has(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { keyPrefix: "team-badge", limit: 120, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many image requests." },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  const requestUrl = new URL(request.url);
  const badgeUrl = parseBadgeUrl(requestUrl.searchParams.get("url"));

  if (!badgeUrl) {
    return NextResponse.json({ ok: false, error: "Invalid badge URL." }, { status: 400 });
  }

  let currentUrl = badgeUrl;
  let response: Response | null = null;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    response = await fetch(currentUrl, {
      cache: "force-cache",
      redirect: "manual",
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" },
      signal: AbortSignal.timeout(8000)
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    const redirected = location ? parseBadgeUrl(new URL(location, currentUrl).toString()) : null;
    if (!redirected) return NextResponse.json({ ok: false, error: "Badge redirect is not allowed." }, { status: 400 });
    currentUrl = redirected;
  }

  if (!response) return NextResponse.json({ ok: false, error: "Badge image is unavailable." }, { status: 502 });

  if (!response.ok) {
    return NextResponse.json({ ok: false, error: "Badge image is unavailable." }, { status: response.status });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/") || contentType.includes("svg")) {
    return NextResponse.json({ ok: false, error: "Badge URL did not return an image." }, { status: 415 });
  }

  let body: Uint8Array;
  try {
    body = await readLimitedResponseBytes(response, MAX_BADGE_BYTES);
  } catch {
    return NextResponse.json({ ok: false, error: "Badge image is too large." }, { status: 413 });
  }

  const headers = new Headers({
    "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff"
  });

  headers.set("Content-Length", String(body.byteLength));

  return new Response(Uint8Array.from(body).buffer, { headers });
}
