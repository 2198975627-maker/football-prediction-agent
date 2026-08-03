import test from "node:test";
import assert from "node:assert/strict";
import { compactPredictionEvidence, groundPredictionEvidence } from "../src/lib/openai-prediction.ts";

const input = {
  teamA: "Team A",
  teamB: "Team B",
  matchDate: "2026-08-10",
  competition: "League",
  homeTeam: "team_a",
  analysisDepth: "standard",
  billingMode: "platform",
  maxUserChargeCents: 999,
  paymentOrderId: "8e5f7ca0-6758-4df3-a7a8-78ba3fbfcd6e"
};

const data = {
  fixture: { id: 1, startsAt: "2026-08-10T12:00:00Z" },
  teams: [],
  formations: [],
  coverage: { confirmedLineup: false },
  lineups: [],
  playerProfiles: [],
  sidelined: [],
  events: [{
    id: 1, type: "Shot", minute: 12, extraMinute: null, teamId: 1, playerId: 2,
    playerName: "Player A", relatedPlayerId: null, relatedPlayerName: "", result: "Saved"
  }],
  teamStatistics: [],
  recentMatches: [],
  headToHeadMatches: [],
  analysisFeatures: { recentFormSamples: 0, headToHeadSamples: 0 },
  evidence: [{ field: "events", source: "api-football", fetchedAt: "2026-08-03T00:00:00Z" }],
  fusion: { conflicts: [] }
};

const quality = { score: 55, checks: [], missingRequired: [] };

test("AI evidence excludes billing and payment fields while retaining match events", () => {
  const evidence = compactPredictionEvidence(input, data, quality);
  assert.equal(evidence.request.billingMode, undefined);
  assert.equal(evidence.request.maxUserChargeCents, undefined);
  assert.equal(evidence.request.paymentOrderId, undefined);
  assert.equal(evidence.events.length, 1);
  assert.equal(evidence.events[0].playerName, "Player A");
  assert.ok(evidence.allowedEvidenceReferences.includes("api-football"));
});

test("ungrounded model citations are removed and disclosed", () => {
  const result = groundPredictionEvidence({
    probabilities: { teamA: 40, draw: 30, teamB: 30 },
    likelyScores: ["1-1"],
    confidence: 55,
    summary: "A sufficiently long cautious test prediction summary.",
    factors: [{ title: "Form", direction: "neutral", evidence: ["events", "invented-source"] }],
    playerMatchups: [],
    tacticalChains: [],
    uncertainties: ["Lineups unconfirmed"]
  }, data);
  assert.deepEqual(result.factors[0].evidence, ["events"]);
  assert.match(result.uncertainties.at(-1), /1 条无法在输入中核验/);
});
