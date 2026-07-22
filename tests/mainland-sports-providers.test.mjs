import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("AnySport is a server-only executable match provider", async () => {
  const adapter = await source("src/lib/providers/anysport.ts");
  const registry = await source("src/lib/providers/match-intelligence.ts");
  const gates = await source("config/security-gates.json");
  assert.match(adapter, /https:\/\/api\.anysport\.io\/v1/);
  assert.match(adapter, /"X-API-Key": apiKey\(\)/);
  assert.match(adapter, /readLimitedResponseBytes/);
  assert.match(adapter, /AbortSignal\.timeout/);
  assert.match(registry, /id: "anysport"/);
  assert.match(gates, /"ANYSPORT_API_KEY"/);
  assert.match(gates, /"NEXT_PUBLIC_ANYSPORT"/);
});

test("AnySport missing advanced fields are disclosed rather than fabricated", async () => {
  const adapter = await source("src/lib/providers/anysport.ts");
  assert.match(adapter, /完整球员赛季画像、xG 和事件坐标/);
  assert.match(adapter, /playerProfiles: \[\]/);
  assert.match(adapter, /ANYSPORT_LINEUPS_ENABLED/);
});

test("contract-only mainland providers do not claim runtime readiness", async () => {
  const sources = await source("src/lib/sports-data-sources.ts");
  assert.match(sources, /runtimeIntegrated/);
  assert.match(sources, /"credentials-ready"/);
  assert.match(sources, /"nami-sports"/);
  assert.match(sources, /"juhe-football"/);
  assert.match(sources, /"feijing-sports"/);
  assert.match(sources, /"apiballs"/);
});
