import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Supabase clients prefer modern keys and keep compatibility aliases", async () => {
  const config = await source("src/lib/supabase-config.ts");
  const auth = await source("src/lib/supabase-auth.ts");
  const cache = await source("src/lib/roster-cache.ts");

  assert.match(config, /env\("SUPABASE_PUBLISHABLE_KEY"\) \|\| env\("SUPABASE_ANON_KEY"\)/);
  assert.match(config, /env\("SUPABASE_SECRET_KEY"\) \|\| env\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(config, /Modern sb_\* keys authenticate/);
  assert.match(auth, /config\.publishableKey/);
  assert.match(auth, /config\.secretKey/);
  assert.match(cache, /getSupabaseSettings/);
  assert.doesNotMatch(cache, /Authorization: `Bearer \$\{key\}`/);
});

test("production gate rejects legacy Supabase JWT keys", async () => {
  const gate = await source("scripts/check-production-env.mjs");

  assert.match(gate, /SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY/);
  assert.match(gate, /SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(gate, /legacy Supabase JWT API keys are not accepted for production/);
});

test("daily roster refresh enriches a bounded rotating set through API-Football", async () => {
  const refresh = await source("skills/football-roster-refresh/scripts/refresh-rosters.mjs");

  assert.match(refresh, /ROSTER_API_FOOTBALL_TEAM_LIMIT/);
  assert.match(refresh, /DEFAULT_API_FOOTBALL_TEAM_LIMIT = 16/);
  assert.match(refresh, /"players\/squads"/);
  assert.match(refresh, /"coachs"/);
  assert.match(refresh, /mergePreviousProviderData/);
  assert.match(refresh, /Current squad entry from API-Football/);
  assert.match(refresh, /metricsStatus: "placeholder"/);
  assert.doesNotMatch(refresh, /x-apisports-key":\s*["'][^"']+["']/);
});

test("roster UI exposes factual bio fields without synthesizing height or penalty odds", async () => {
  const page = await source("app/page.tsx");

  assert.match(page, /playerBioLine/);
  assert.match(page, /shirtNumber/);
  assert.match(page, /heightCm/);
  assert.match(page, /暂无可核验的点球样本/);
  assert.match(page, /主教练 \{team\.coach\.name\}/);
  assert.doesNotMatch(page, /function playerHeight/);
  assert.doesNotMatch(page, /function textSeed/);
  assert.doesNotMatch(page, /penaltySave:\s*clampMetric\(13/);
});
