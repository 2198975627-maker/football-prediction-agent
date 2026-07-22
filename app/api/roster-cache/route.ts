import { NextResponse } from "next/server";
import { readRosterCache } from "@/src/lib/roster-cache";
import { checkRateLimit, rateLimitHeaders } from "@/src/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { keyPrefix: "roster-cache", limit: 60, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  try {
    const cache = await readRosterCache();

    if (!cache) {
      return NextResponse.json(
        {
          ok: false,
          error: "Roster cache not found. Run pnpm roster:refresh or configure Supabase roster cache before using the daily cache."
        },
        { status: 404 }
      );
    }

    const { snapshot, changes } = cache;
    const teams = snapshot.teams ?? [];

    return NextResponse.json({
      ok: true,
      source: {
        name: `${snapshot.provider?.name ?? "Roster"} Daily Cache`,
        url: cache.storageUrl,
        apiKeyMode: snapshot.provider?.apiKeyMode ?? "cache"
      },
      storage: cache.storage,
      importedAt: snapshot.generatedAt ?? new Date().toISOString(),
      rawCount: snapshot.totals?.teams ?? teams.length,
      snapshot: {
        generatedAt: snapshot.generatedAt,
        beijingDate: snapshot.beijingDate,
        beijingTime: snapshot.beijingTime,
        totals: snapshot.totals
      },
      teams,
      changes,
      warning: cache.warning,
      notice:
        cache.storage === "supabase"
          ? "Loaded from the cloud roster cache. The refresh script does not call an AI model."
          : "Loaded from the local roster cache. The refresh script does not call an AI model."
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Roster cache could not be read."
      },
      { status: 500 }
    );
  }
}
