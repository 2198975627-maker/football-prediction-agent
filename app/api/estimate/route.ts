import { NextResponse } from "next/server";
import { estimateCost } from "@/src/lib/billing";
import { readLimitedJson, RequestBodyTooLargeError } from "@/src/lib/http-security";
import { checkRateLimit, rateLimitHeaders } from "@/src/lib/rate-limit";
import { predictionInputSchema } from "@/src/lib/schemas";
import { findSafetyIssue } from "@/src/lib/safety";

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { keyPrefix: "estimate", limit: 60, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof RequestBodyTooLargeError ? error.message : "Invalid JSON payload." },
      { status: error instanceof RequestBodyTooLargeError ? 413 : 400 }
    );
  }
  const parsed = predictionInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid request payload.",
        issues: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const safetyIssue = findSafetyIssue(parsed.data);

  if (safetyIssue) {
    return NextResponse.json(
      {
        ok: false,
        error: safetyIssue
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    estimate: estimateCost(parsed.data)
  });
}
