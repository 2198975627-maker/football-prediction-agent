import test from "node:test";
import assert from "node:assert/strict";
import { assessMatchDataQuality } from "../src/lib/match-data-quality.ts";

function intelligence(overrides = {}) {
  const startsAt = new Date(Date.now() + 60 * 60_000).toISOString();
  const teams = [
    { id: 1, name: "Team A", shortCode: "A", imageUrl: "" },
    { id: 2, name: "Team B", shortCode: "B", imageUrl: "" }
  ];
  const lineups = Array.from({ length: 22 }, (_, index) => ({
    playerId: index + 1,
    teamId: index < 11 ? 1 : 2,
    playerName: `Player ${index + 1}`,
    position: "Player",
    starter: true,
    jerseyNumber: index + 1,
    formationPosition: index % 11,
    statistics: {},
    canonicalStatistics: { minutes: 90, rating: 7 }
  }));
  const matches = Array.from({ length: 10 }, (_, index) => ({
    fixtureId: index + 10,
    startsAt,
    league: "League",
    homeTeam: index % 2 ? "Team A" : "Opponent",
    awayTeam: index % 2 ? "Opponent" : "Team A",
    homeScore: 1,
    awayScore: 0,
    status: "FT",
    source: "test"
  }));
  const playerProfiles = lineups.map((player) => ({
    playerId: player.playerId,
    teamId: player.teamId,
    playerName: player.playerName,
    position: player.position,
    season: 2026,
    appearances: 10,
    statistics: {},
    canonicalStatistics: { minutes: 900 }
  }));
  return {
    ok: true,
    provider: "sportmonks",
    mode: "live",
    fetchedAt: new Date().toISOString(),
    sourceUrl: "https://example.invalid/fixture/1",
    fixture: { id: 1, name: "Team A vs Team B", startsAt, state: "NS", league: "League", venue: "Venue", weather: null },
    teams,
    formations: [{ teamId: 1, formation: "4-3-3" }, { teamId: 2, formation: "4-4-2" }],
    lineups,
    playerProfiles,
    sidelined: [],
    events: [],
    teamStatistics: Array.from({ length: 8 }, (_, index) => ({ teamId: index < 4 ? 1 : 2, type: "Shots", canonicalType: "shots", value: 10 })),
    recentMatches: matches,
    headToHeadMatches: matches.slice(0, 3),
    coverage: { confirmedLineup: true, lineups: 22, sidelined: 0, events: 0, teamStatistics: 8, hasWeather: false, hasFormations: true },
    analysisFeatures: { recentFormSamples: 10, headToHeadSamples: 3, playerSeasonProfiles: 22, injurySourceCount: 2 },
    evidence: [],
    warnings: [],
    ...overrides
  };
}

test("blocks official prediction when required analysis features are absent", () => {
  const data = intelligence({
    lineups: [],
    formations: [],
    teamStatistics: [],
    coverage: { confirmedLineup: false, lineups: 0, sidelined: 0, events: 0, teamStatistics: 0, hasWeather: false, hasFormations: false },
    analysisFeatures: { recentFormSamples: 0, headToHeadSamples: 0, playerSeasonProfiles: 0, injurySourceCount: 1 }
  });
  const quality = assessMatchDataQuality(data, { cacheAgeSeconds: 30 });
  assert.equal(quality.canRunOfficialPrediction, false);
  assert.ok(quality.missingRequired.includes("近期比赛状态"));
  assert.ok(quality.missingRequired.includes("伤停交叉验证"));
});

test("allows official prediction only when all required checks and coverage pass", () => {
  const quality = assessMatchDataQuality(intelligence(), { cacheAgeSeconds: 30 });
  assert.equal(quality.score, 100);
  assert.equal(quality.level, "ready");
  assert.equal(quality.canRunOfficialPrediction, true);
});

test("stale cache blocks official prediction", () => {
  const quality = assessMatchDataQuality(intelligence(), { cacheAgeSeconds: 3600 });
  assert.equal(quality.canRunOfficialPrediction, false);
  assert.ok(quality.missingRequired.includes("数据新鲜度"));
});

test("critical cross-provider conflict blocks official prediction", () => {
  const data = intelligence({
    fusion: {
      primaryProvider: "api-football",
      attemptedProviders: ["api-football", "sportmonks"],
      succeededProviders: ["api-football", "sportmonks"],
      conflicts: [{
        field: "fixture.startsAt",
        severity: "critical",
        values: [{ provider: "api-football", value: "2026-07-20T12:00:00Z" }, { provider: "sportmonks", value: "2026-07-20T14:00:00Z" }],
        resolution: "manual review"
      }]
    }
  });
  const quality = assessMatchDataQuality(data, { cacheAgeSeconds: 30 });
  assert.equal(quality.canRunOfficialPrediction, false);
  assert.ok(quality.missingRequired.includes("来源冲突"));
});
