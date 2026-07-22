import { NextResponse } from "next/server";
import { readLimitedResponseBytes } from "@/src/lib/http-security";
import { checkRateLimit, rateLimitHeaders } from "@/src/lib/rate-limit";

const ALLOWED_WIDTHS = new Set(["40", "80"]);
const MAX_FLAG_BYTES = 512 * 1024;

function parseFlagCode(code: string | null) {
  const normalized = code?.trim().toLowerCase() ?? "";
  if (/^[a-z]{2}$/.test(normalized)) return normalized;
  if (/^gb-(eng|sct|wls)$/.test(normalized)) return normalized;
  return "";
}

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { keyPrefix: "flag", limit: 180, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many image requests." },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  const requestUrl = new URL(request.url);
  const code = parseFlagCode(requestUrl.searchParams.get("code"));
  const requestedWidth = requestUrl.searchParams.get("w") ?? "";
  const width = ALLOWED_WIDTHS.has(requestedWidth) ? requestedWidth : "40";

  if (!code) {
    return NextResponse.json({ ok: false, error: "Invalid flag code." }, { status: 400 });
  }

  const response = await fetch(`https://flagcdn.com/w${width}/${code}.png`, {
    cache: "force-cache",
    headers: { Accept: "image/png,image/*;q=0.8" },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    return NextResponse.json({ ok: false, error: "Flag image is unavailable." }, { status: response.status });
  }

  let body: Uint8Array;
  try {
    body = await readLimitedResponseBytes(response, MAX_FLAG_BYTES);
  } catch {
    return NextResponse.json({ ok: false, error: "Flag image is too large." }, { status: 413 });
  }

  return new Response(Uint8Array.from(body).buffer, {
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
      "Content-Type": response.headers.get("content-type") ?? "image/png",
      "Content-Length": String(body.byteLength),
      "X-Content-Type-Options": "nosniff"
    }
  });
}
