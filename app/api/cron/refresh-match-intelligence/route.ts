import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { fixtureCacheKey, persistProviderEntityMappings, writeMatchIntelligenceCache } from "@/src/lib/match-intelligence-cache";
import { getLiveMatchIntelligenceFromProvider, hasConfiguredMatchProvider } from "@/src/lib/providers/match-intelligence";
import {
  isTrackedFixtureStorageWritable,
  listDueTrackedFixtures,
  markTrackedFixtureError,
  trackMatchIntelligence
} from "@/src/lib/tracked-fixtures";

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
  if (!hasConfiguredMatchProvider() || !isTrackedFixtureStorageWritable()) {
    return NextResponse.json(
      { ok: false, error: "A configured match provider and writable Supabase tracked-fixture storage are required." },
      { status: 503 }
    );
  }

  const due = await listDueTrackedFixtures(8);
  const results = [];
  for (const fixture of due) {
    try {
      const data = await getLiveMatchIntelligenceFromProvider(fixture.provider, {
        teamA: fixture.team_a,
        teamB: fixture.team_b,
        matchDate: fixture.starts_at,
        fixtureId: fixture.fixture_id
      });
      await Promise.all([
        writeMatchIntelligenceCache([fixtureCacheKey(data.fixture.id, data.provider)], data),
        persistProviderEntityMappings(data),
        trackMatchIntelligence(data)
      ]);
      results.push({ fixtureId: fixture.fixture_id, ok: true, nextStage: "scheduled" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Refresh failed.";
      await markTrackedFixtureError(fixture.provider, fixture.fixture_id, message);
      results.push({ fixtureId: fixture.fixture_id, ok: false, error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results
  });
}
