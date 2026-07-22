import test from "node:test";
import assert from "node:assert/strict";
import { addCanonicalMetric, canonicalMetricKey } from "../src/lib/football-metrics.ts";

test("maps specific shot metrics before generic shots", () => {
  assert.equal(canonicalMetricKey("SHOTS_ON_TARGET", "Shots On Target"), "shots_on_target");
  assert.equal(canonicalMetricKey("TOTAL_SHOTS", "Total Shots"), "shots");
});

test("maps defensive and goalkeeper metrics", () => {
  assert.equal(canonicalMetricKey("INTERCEPTIONS"), "interceptions");
  assert.equal(canonicalMetricKey("TACKLES_WON"), "tackles_won");
  assert.equal(canonicalMetricKey("GOALKEEPER_SAVES"), "saves");
  assert.equal(canonicalMetricKey("PENALTIES_SAVED"), "penalties_saved");
});

test("maps expected goals and preserves missing values", () => {
  assert.equal(canonicalMetricKey("EXPECTED_GOALS", "xG"), "xg");
  assert.equal(canonicalMetricKey("UNRECOGNISED_PROVIDER_FIELD"), null);

  const metrics = {};
  addCanonicalMetric(metrics, "xg", "1.42");
  addCanonicalMetric(metrics, "shots", null);
  assert.deepEqual(metrics, { xg: 1.42 });
});

test("maps API-Football nested statistic labels", () => {
  assert.equal(canonicalMetricKey("shots_total"), "shots");
  assert.equal(canonicalMetricKey("shots_on"), "shots_on_target");
  assert.equal(canonicalMetricKey("tackles_total"), "tackles");
  assert.equal(canonicalMetricKey("tackles_blocks"), "blocks");
  assert.equal(canonicalMetricKey("dribbles_attempts"), "dribbles_attempted");
  assert.equal(canonicalMetricKey("dribbles_success"), "dribbles_completed");
  assert.equal(canonicalMetricKey("duels_total"), "duels");
});
