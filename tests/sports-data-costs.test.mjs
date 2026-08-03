import test from "node:test";
import assert from "node:assert/strict";
import { getSportsDataPricing } from "../src/lib/sports-data-costs.ts";

test("sports pricing requires every attempted provider to be explicit", () => {
  const previousApi = process.env.API_FOOTBALL_MATCH_REFRESH_COST_CENTS;
  const previousSportmonks = process.env.SPORTMONKS_MATCH_REFRESH_COST_CENTS;
  try {
    process.env.API_FOOTBALL_MATCH_REFRESH_COST_CENTS = "0";
    delete process.env.SPORTMONKS_MATCH_REFRESH_COST_CENTS;
    const incomplete = getSportsDataPricing(["api-football", "sportmonks"]);
    assert.equal(incomplete.configured, false);
    assert.deepEqual(incomplete.missingVariables, ["SPORTMONKS_MATCH_REFRESH_COST_CENTS"]);

    process.env.SPORTMONKS_MATCH_REFRESH_COST_CENTS = "7";
    const configured = getSportsDataPricing(["api-football", "sportmonks", "api-football"]);
    assert.equal(configured.configured, true);
    assert.equal(configured.totalCostCents, 7);
    assert.equal(configured.costs.length, 2);
  } finally {
    if (previousApi === undefined) delete process.env.API_FOOTBALL_MATCH_REFRESH_COST_CENTS;
    else process.env.API_FOOTBALL_MATCH_REFRESH_COST_CENTS = previousApi;
    if (previousSportmonks === undefined) delete process.env.SPORTMONKS_MATCH_REFRESH_COST_CENTS;
    else process.env.SPORTMONKS_MATCH_REFRESH_COST_CENTS = previousSportmonks;
  }
});
