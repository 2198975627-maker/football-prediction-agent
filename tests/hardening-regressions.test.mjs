import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("platform payment is claimed before a live sports provider can be called", async () => {
  const route = await source("app/api/predict/route.ts");
  assert.ok(route.indexOf("claimPaidOrder(") < route.indexOf("getLiveMatchIntelligence(input)"));
  assert.match(route, /claimPaidOrder\([^\n]+, input\)/);
});

test("anonymous match intelligence can only receive an existing cache entry", async () => {
  const route = await source("app/api/match-intelligence/route.ts");
  assert.match(route, /const user = await requestUser\(request\)/);
  assert.match(route, /AUTH_REQUIRED_FOR_LIVE_FETCH/);
  assert.ok(route.indexOf("requestUser(request)") < route.indexOf("getLiveMatchIntelligence(parsed.data)"));
});

test("refunds are recorded as pending before Stripe and finalized separately", async () => {
  const payments = await source("src/lib/payments.ts");
  const sql = await source("docs/supabase-production.sql");
  assert.ok(payments.indexOf('rpc("settle_football_payment_order"') < payments.indexOf("refunds.create("));
  assert.match(payments, /rpc\("complete_football_payment_refund"/);
  assert.match(sql, /'refund_pending'/);
  assert.match(sql, /create or replace function public\.complete_football_payment_refund/);
});

test("unverified frontend metrics do not create preview probabilities or matchup cards", async () => {
  const page = await source("app/page.tsx");
  assert.doesNotMatch(page, /function buildPreviewProbability/);
  assert.match(page, /hasVerifiedTeamMetrics \? buildMatchupInsights/);
  assert.match(page, /暂无核验统计/);
});

test("AI evidence includes concrete recent and head-to-head matches", async () => {
  const adapter = await source("src/lib/providers/api-football.ts");
  const prompt = await source("src/lib/openai-prediction.ts");
  assert.match(adapter, /recentMatches/);
  assert.match(adapter, /headToHeadMatches/);
  assert.match(prompt, /recentMatches: \(data\.recentMatches/);
  assert.match(prompt, /headToHeadMatches: \(data\.headToHeadMatches/);
});

test("production roster refresh remains cloud-only", async () => {
  const refresh = await source("skills/football-roster-refresh/scripts/refresh-rosters.mjs");
  const cache = await source("src/lib/roster-cache.ts");
  const packageJson = await source("package.json");

  assert.match(refresh, /storage cloud-only/);
  assert.match(refresh, /writeCloudCache\(snapshot, changes, true\)/);
  assert.doesNotMatch(refresh, /\bwriteFile\b|\bmkdir\b|latest\.json/);
  assert.match(cache, /if \(isProduction\) \{\s+throw error;/);
  assert.doesNotMatch(packageJson, /roster:refresh/);
});

test("Supabase roster cache reads have a bounded timeout", async () => {
  const cache = await source("src/lib/roster-cache.ts");

  assert.match(cache, /SUPABASE_ROSTER_CACHE_READ_TIMEOUT_MS/);
  assert.match(cache, /AbortSignal\.timeout\(rosterCacheReadTimeoutMs\(\)\)/);
});

test("roster UI localizes provider filters and refresh excludes youth teams", async () => {
  const page = await source("app/page.tsx");
  const refresh = await source("skills/football-roster-refresh/scripts/refresh-rosters.mjs");

  assert.match(page, /countryDisplayAliases/);
  assert.match(page, /leagueDisplayAliases/);
  assert.match(page, /localizeTeamMetadata\(team\)/);
  assert.match(page, /filter\(isSeniorTeamProfile\)/);
  assert.match(refresh, /function isSeniorTeamRecord/);
  assert.match(refresh, /isSeniorTeamRecord\(team\)/);
});

test("club badge fallbacks and canonical names prevent initials and duplicate teams", async () => {
  const page = await source("app/page.tsx");
  const refresh = await source("skills/football-roster-refresh/scripts/refresh-rosters.mjs");

  assert.match(page, /function canonicalTeamName/);
  assert.match(page, /\.normalize\("NFKD"\)/);
  assert.match(page, /const curatedClubBadgeUrls/);
  assert.match(page, /asroma: "https:\/\/r2\.thesportsdb\.com/);
  assert.match(page, /losangelesfc: "https:\/\/r2\.thesportsdb\.com/);
  assert.match(page, /curatedClubBadgeUrls\[canonicalTeamName\(team\.name\)\]/);
  assert.match(page, /return `\$\{canonicalTeamName\(team\.name\)\}::\$\{team\.kind\}`/);
  assert.match(refresh, /"Japanese J1 League"/);
  assert.match(refresh, /roma: "asroma"/);
});
