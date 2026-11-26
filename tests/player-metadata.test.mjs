import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  fetchWikidataPlayerMetadata,
  normalizeHeightCm
} from "../src/lib/player-metadata.mjs";

test("height normalization accepts provider and Wikidata unit formats", () => {
  assert.equal(normalizeHeightCm("186 cm"), 186);
  assert.equal(normalizeHeightCm("1.86 m"), 186);
  assert.equal(normalizeHeightCm("6 ft 2 in"), 188);
  assert.equal(normalizeHeightCm("6'2\""), 188);
  assert.equal(normalizeHeightCm("5 ft 10 in (1.79 m)"), 179);
  assert.equal(normalizeHeightCm(1.79), 179);
  assert.equal(normalizeHeightCm("unknown"), null);
  assert.equal(normalizeHeightCm("99 cm"), null);
});

test("Wikidata enrichment batches validated IDs and maps Chinese labels and height", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url, init) => {
    requestedUrl = String(url);
    assert.equal(init.headers["User-Agent"].includes("football-prediction-agent"), true);
    return new Response(JSON.stringify({
      entities: {
        Q1: {
          labels: { "zh-hans": { value: "测试球员" }, en: { value: "Test Player" } },
          claims: {
            P2048: [{ mainsnak: { snaktype: "value", datavalue: { value: { amount: "+1.86", unit: "http://www.wikidata.org/entity/Q11573" } } } }]
          }
        },
        Q2: {
          labels: { zh: { value: "二号球员" } },
          claims: {
            P2048: [{ mainsnak: { snaktype: "value", datavalue: { value: { amount: "+179", unit: "http://www.wikidata.org/entity/Q174728" } } } }]
          }
        }
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const metadata = await fetchWikidataPlayerMetadata(["Q1", "invalid", "Q2", "Q1"]);
    assert.equal(new URL(requestedUrl).searchParams.get("ids"), "Q1|Q2");
    assert.deepEqual(metadata.get("Q1"), {
      wikidataId: "Q1",
      nameZh: "测试球员",
      heightCm: 186,
      sourceUrl: "https://www.wikidata.org/wiki/Q1"
    });
    assert.equal(metadata.get("Q2").heightCm, 179);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("live and scheduled roster imports share metadata parsing and never disable public rosters", () => {
  const route = fs.readFileSync(new URL("../app/api/live-team/route.ts", import.meta.url), "utf8");
  const refresh = fs.readFileSync(new URL("../skills/football-roster-refresh/scripts/refresh-rosters.mjs", import.meta.url), "utf8");
  const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const cache = fs.readFileSync(new URL("../src/lib/roster-cache.ts", import.meta.url), "utf8");
  assert.match(route, /normalizeHeightCm/);
  assert.match(route, /idWikidata/);
  assert.match(route, /nameZh: metadata\?\.nameZh/);
  assert.match(refresh, /DEFAULT_THESPORTSDB_PLAYER_LIMIT = 12/);
  assert.match(refresh, /sportsDbTargets/);
  assert.match(refresh, /localizedPlayers/);
  assert.doesNotMatch(refresh, /apiKeyMode === "public-demo" \? 0/);
  assert.equal((route.match(/function parseHeightCm/g) ?? []).length, 0);
  assert.equal((refresh.match(/function parseHeightCm/g) ?? []).length, 0);
  assert.match(page, /const keepExistingRoster = rosterScore\(existing\) > rosterScore\(team\)/);
  assert.match(page, /existingLocalizedCount \/ detailCount >= 0\.7/);
  assert.match(page, /照片 \$\{photoCount\} · 身高 \$\{heightCount\} · 中文名 \$\{localizedCount\}/);
  assert.doesNotMatch(route, /function placeholderPlayers/);
  assert.doesNotMatch(refresh, /function placeholderPlayers/);
  assert.doesNotMatch(page, /function buildPlayers/);
  assert.match(cache, /rosterStatus !== "placeholder"/);
});
