import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { matchDateSchema } from "../src/lib/schemas.ts";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("pre-match dates must be valid and in the future", () => {
  const future = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const past = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  assert.equal(matchDateSchema.safeParse(future).success, true);
  assert.equal(matchDateSchema.safeParse(past).success, false);
  assert.equal(matchDateSchema.safeParse("not-a-date").success, false);
});

test("live metrics stay hidden while mock intelligence is clearly separated", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /hasAnalysisTeamMetrics \? \(/);
  assert.match(page, /useMockProfiles = usingMockIntelligence && !hasVerifiedTeamMetrics/);
  assert.match(page, /相关演示数字已隐藏/);
  assert.match(page, /完成数据同步和预测后生成正式报告/);
  assert.doesNotMatch(page, /筛选球队后生成 mock report/);
  assert.match(page, /球队元数据已载入 \/ 指标待核验/);
  assert.match(page, /所有指标均标注为 Mock/);
  assert.match(page, /不代表真实球队事实/);
});

test("roster imports keep a full squad window and exclude non-playing staff", async () => {
  const liveRoute = await source("app/api/live-team/route.ts");
  const refreshSkill = await source("skills/football-roster-refresh/scripts/refresh-rosters.mjs");
  assert.match(liveRoute, /const MAX_PLAYERS = 40/);
  for (const role of ["ceo", "director", "operations", "executive"]) {
    assert.match(liveRoute, new RegExp(`"${role}"`));
    assert.match(refreshSkill, new RegExp(`"${role}"`));
  }
  const page = await source("app/page.tsx");
  assert.match(page, /isNonPlayingStaffRole\(player\.role\)/);
});

test("account form is not offered when the account backend is unavailable", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /!accountConfigured \? \(/);
  assert.match(page, /当前部署尚未配置 Supabase 账户服务/);
});

test("primary team workflow stays compact and does not surface placeholder ratings", async () => {
  const page = await source("app/page.tsx");
  const styles = await source("app/globals.css");
  assert.match(page, /className="filter-details"/);
  assert.match(page, /className="data-details"/);
  assert.match(page, /aria-current=\{activeView === item\.id \? "step" : undefined\}/);
  assert.match(page, /className="btn btn-primary empty-report-action"/);
  assert.doesNotMatch(page, /className="team-option-bars"/);
  assert.doesNotMatch(page, /攻防条为演示占位/);
  assert.match(styles, /\.workspace\.view-match \.center-column/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
