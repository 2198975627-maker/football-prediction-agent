import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function source(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

test("all configured sports adapters expose date-based fixture normalization", () => {
  const apiFootball = source("../src/lib/providers/api-football.ts");
  const footballData = source("../src/lib/providers/football-data.ts");
  const anySport = source("../src/lib/providers/anysport.ts");
  const sportsDb = source("../src/lib/providers/thesportsdb-fixtures.ts");
  const openLiga = source("../src/lib/providers/openligadb-fixtures.ts");
  assert.match(apiFootball, /normalizeApiFootballFixtures/);
  assert.match(apiFootball, /timezone: "Asia\/Shanghai"/);
  assert.match(apiFootball, /return "中超联赛"/);
  assert.match(footballData, /normalizeFootballDataFixtures/);
  assert.match(footballData, /getFootballDataFixturesByRange/);
  assert.match(footballData, /dateFrom: shiftDate\(cursor, -1\), dateTo: chunkTo/);
  assert.match(footballData, /timeZone: "Asia\/Shanghai"/);
  assert.match(anySport, /normalizeAnySportFixtures/);
  assert.match(anySport, /new Date\(candidate\)\.toISOString\(\)/);
  assert.match(sportsDb, /"4359"/);
  assert.match(sportsDb, /"4668"/);
  assert.match(sportsDb, /"4346"/);
  assert.match(openLiga, /getmatchdata\/bl1/);
  assert.match(openLiga, /getOpenLigaDbFixturesByRange/);
  assert.match(sportsDb, /CACHE_TTL_MS = 5 \* 60_000/);
  assert.match(openLiga, /CACHE_TTL_MS = 30 \* 60_000/);
  assert.match(sportsDb, /fixtureRequests/);
  assert.match(sportsDb, /batchStarts\.length >= 3/);
  assert.match(sportsDb, /THESPORTSDB_LOCAL_RATE_LIMIT/);
  assert.match(openLiga, /seasonRequests/);
});

test("health reports no-key fixture discovery separately from prediction evidence", () => {
  const health = source("../app/api/health/route.ts");
  assert.match(health, /configuredFixtureProviders/);
  assert.match(health, /freePreviewReady/);
  assert.match(health, /freeProviders/);
});

test("fixture schedule aggregates concurrently, deduplicates, caches, and limits output", () => {
  const schedule = source("../src/lib/fixture-schedule.ts");
  assert.match(schedule, /Promise\.allSettled/);
  assert.match(schedule, /fixtureIdentity/);
  assert.match(schedule, /DUPLICATE_KICKOFF_TOLERANCE_MS = 6 \* 60 \* 60_000/);
  assert.match(schedule, /providerPriority/);
  assert.match(schedule, /isDuplicateFixture/);
  assert.match(schedule, /Date\.now\(\) \+ 2 \* 60_000/);
  assert.match(schedule, /\.slice\(0, 240\)/);
  assert.match(schedule, /provider\.loadRange/);
  assert.match(schedule, /const cacheKey = `\$\{date\}:\$\{days\}`/);
});

test("provider-specific fixture IDs cannot collide in match cache or fan out to other providers", () => {
  const cache = source("../src/lib/match-intelligence-cache.ts");
  const resolver = source("../src/lib/providers/match-intelligence.ts");
  assert.match(cache, /fixtureProvider \?\? "unknown"/);
  assert.match(resolver, /input\.fixtureProvider === provider\.id \? input\.fixtureId : undefined/);
  assert.match(resolver, /input\.fixtureProvider \?\? ""/);
});

test("fixture route is rate limited, date bounded, and provider keys stay server-side", () => {
  const route = source("../app/api/fixtures/route.ts");
  const page = source("../app/page.tsx");
  assert.match(route, /checkRateLimit/);
  assert.match(route, /INVALID_FIXTURE_DATE/);
  assert.match(route, /stale-while-revalidate=120/);
  assert.doesNotMatch(page, /API_FOOTBALL_KEY|FOOTBALL_DATA_API_KEY|ANYSPORT_API_KEY/);
  assert.match(page, /fixtureId: selectedFixture\.id/);
  assert.match(page, /fixtureProvider: selectedFixture\.provider/);
});

test("match setup UI exposes a date picker, fixture search, refresh, and empty state", () => {
  const page = source("../app/page.tsx");
  assert.match(page, /aria-label="赛程日期"/);
  assert.match(page, /aria-label="搜索比赛"/);
  assert.match(page, /loadFixtureSchedule\(fixtureDate, true\)/);
  assert.match(page, /fixtureCompetitionCounts/);
  assert.match(page, /fixtureDateCounts/);
  assert.match(page, /fetchedAt/);
  assert.match(page, /未来 30 天暂未发现已收录比赛/);
  assert.match(page, /aria-label="比赛日期筛选"/);
  assert.match(page, /aria-label="赛事快捷筛选"/);
  assert.match(page, /"英超", "西甲", "德甲", "意甲", "法甲", "中超", "沙特联", "美职联", "欧冠"/);
});

test("fixture picker groups matches by league and makes date and venue explicit", () => {
  const page = source("../app/page.tsx");
  const css = source("../app/globals.css");
  assert.match(page, /fixtureLeagueGroups/);
  assert.match(page, /className="fixture-league-group"/);
  assert.match(page, /className="fixture-league-grid"/);
  assert.match(page, /className="fixture-venue"/);
  assert.match(page, /zh="比赛场地" en="Venue"/);
  assert.match(page, /待公布 \/ Venue TBC/);
  assert.match(css, /\.fixture-league-group-head/);
  assert.match(css, /\.fixture-venue/);
});

test("expanded team cards gently emphasize the active crest or national flag", () => {
  const page = source("../app/page.tsx");
  const css = source("../app/globals.css");
  assert.match(page, /team-option-shell \$\{expanded \? "expanded" : ""\}/);
  assert.match(css, /\.team-option-shell\.expanded \.team-option \.team-badge/);
  assert.match(css, /transform: scale\(1\.12\)/);
  assert.match(css, /620ms cubic-bezier\(0\.4, 0, 0\.2, 1\)/);
});
