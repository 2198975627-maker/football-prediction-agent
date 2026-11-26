import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

process.env.PROVIDER_MODE = "mock";

const { runMockPrediction } = await import("../src/lib/workflow.ts");
const { resolveTeams } = await import("../src/lib/mock-providers.ts");
const { buildOfflineFixtureSchedule, mockDemoScenarios } = await import("../src/lib/mock-scenarios.ts");

function input(overrides = {}) {
  return {
    teamA: "Manchester City",
    teamB: "Liverpool",
    matchDate: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    competition: "Premier League",
    homeTeam: "team_a",
    analysisDepth: "standard",
    billingMode: "platform",
    maxUserChargeCents: 300,
    ...overrides
  };
}

test("runMockPrediction returns structured metrics and never charges", () => {
  const result = runMockPrediction(input());

  assert.equal(result.providerMode, "mock");
  assert.equal(result.cost.estimatedApiCostCents, 0);
  assert.equal(result.cost.estimatedUserChargeCents, 0);
  assert.ok(result.cost.formalModeEstimate.estimatedUserChargeCents > 0);
  assert.ok(result.prediction);
  assert.equal(
    result.prediction.probabilities.teamA + result.prediction.probabilities.draw + result.prediction.probabilities.teamB,
    100
  );
  assert.ok(result.prediction.playerMatchups.length >= 2);
  assert.equal(result.provenance.analysis, "mock-engine");
  assert.equal(result.provenance.billing, "free-mock");
  assert.match(result.report, /本次 Mock 实际费用：¥0\.00/);
});

test("mock workflow distinguishes simulated and skipped work", () => {
  const result = runMockPrediction(input());
  const statuses = new Map(result.workflow.map((step) => [step.id, step.status]));

  assert.equal(statuses.get("validate-input"), "complete");
  assert.equal(statuses.get("football-data"), "simulated");
  assert.equal(statuses.get("public-research"), "skipped");
  assert.equal(statuses.get("source-verification"), "skipped");
  assert.equal(statuses.get("settlement"), "skipped");
});

test("same-team input is blocked without inventing a prediction", () => {
  const result = runMockPrediction(input({ teamB: "Manchester City" }));
  assert.equal(result.prediction, null);
  assert.equal(result.workflow.find((step) => step.id === "validate-input")?.status, "blocked");
  assert.match(result.report, /两支球队不能相同/);
});

test("team types are resolved independently", () => {
  const resolved = resolveTeams(input({ teamA: "France", teamB: "Real Madrid", competition: "Club World Cup" }));
  assert.equal(resolved.teamA.type, "national");
  assert.equal(resolved.teamB.type, "club");
});

test("offline scene library covers target competitions with complete mock player fields", async () => {
  const schedule = buildOfflineFixtureSchedule("2026-08-05", 30, "test fallback");
  const competitions = schedule.fixtures.map((fixture) => fixture.competition).join(" ");

  assert.equal(schedule.dataMode, "mock");
  assert.equal(schedule.fixtures.length, mockDemoScenarios.length);
  for (const label of ["英超", "西甲", "德甲", "意甲", "法甲", "中超", "沙特联", "美职联", "国家队"]) {
    assert.match(competitions, new RegExp(label));
  }

  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /downloadReport/);
  assert.match(page, /Mock Heatmap/);
  assert.match(page, /演示赛程 \/ Mock Fixture/);
});

test("fixture API falls back to the local scene library after provider failure", async () => {
  const route = await readFile(new URL("../app/api/fixtures/route.ts", import.meta.url), "utf8");
  assert.match(route, /buildOfflineFixtureSchedule/);
  assert.match(route, /catch \(error\)/);
  assert.match(route, /真实赛事源暂不可用/);
});

test("mock mode cannot create a payment checkout", async () => {
  const checkout = await readFile(new URL("../app/api/payments/checkout/route.ts", import.meta.url), "utf8");
  assert.match(checkout, /PROVIDER_MODE !== "live"/);
  assert.match(checkout, /Mock 模式固定免费，不允许创建支付订单/);
});
