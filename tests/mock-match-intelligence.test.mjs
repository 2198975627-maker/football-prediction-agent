import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildMockMatchIntelligence } from "../src/lib/mock-match-intelligence.ts";

const input = {
  teamA: "Manchester City",
  teamB: "Real Madrid",
  competition: "Club World Cup",
  homeTeam: "neutral"
};

test("mock intelligence is deterministic, complete, and explicitly labelled", () => {
  const first = buildMockMatchIntelligence(input);
  const second = buildMockMatchIntelligence(input);

  assert.deepEqual(first, second);
  assert.equal(first.mode, "mock");
  assert.match(first.disclaimer, /演示数据/);
  assert.equal(first.teamA.players.length, 8);
  assert.equal(first.teamB.players.length, 8);
  assert.equal(first.keySignals.length, 4);
  assert.equal(first.h2h.meetings, 5);
  assert.ok(first.teamA.players.every((player) => player.heightCm > 160));
  assert.ok(first.teamB.players.every((player) => player.role.length > 0));
  assert.ok(first.teamA.players.every((player) => player.avatarUrl.startsWith("/assets/")));
  assert.ok(first.teamA.players.every((player) => player.heatmap.length === 5));
  assert.ok(first.teamA.players.every((player) => Number.isFinite(player.eventMetrics.xg)));
});

test("Chinese and English aliases produce the same team metrics and probability", () => {
  const english = buildMockMatchIntelligence({ ...input, teamB: "Liverpool" });
  const chinese = buildMockMatchIntelligence({ ...input, teamA: "曼城", teamB: "利物浦" });

  assert.deepEqual(english.probability, chinese.probability);
  assert.equal(english.teamA.attack, chinese.teamA.attack);
  assert.equal(english.teamB.defense, chinese.teamB.defense);
});

test("mock probability is normalized and responds to home advantage", () => {
  const neutral = buildMockMatchIntelligence(input);
  const home = buildMockMatchIntelligence({ ...input, homeTeam: "team_a" });

  assert.equal(neutral.probability.teamA + neutral.probability.draw + neutral.probability.teamB, 100);
  assert.equal(home.probability.teamA + home.probability.draw + home.probability.teamB, 100);
  assert.ok(home.probability.teamA >= neutral.probability.teamA);
  assert.ok(neutral.probability.confidence >= 58 && neutral.probability.confidence <= 82);
});

test("mock analysis UI exposes rich intelligence without weakening live verification gates", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const brief = await readFile(new URL("../src/components/mock-intelligence-brief.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /MockIntelligenceBrief/);
  assert.match(brief, /完整演示比赛情报/);
  assert.match(page, /不代表真实球队事实/);
  assert.match(page, /usingMockIntelligence \? \(/);
  assert.match(page, /未完成正式分析时不展示预测概率/);
  assert.match(styles, /\.mock-intelligence-brief/);
  assert.match(styles, /\.mock-signal-list/);
});
