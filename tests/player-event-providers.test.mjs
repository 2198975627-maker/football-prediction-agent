import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("API-Football free live adapter declares missing coordinates and xG instead of inventing them", async () => {
  const adapter = await source("src/lib/providers/api-football.ts");
  assert.match(adapter, /coverageTier: "free-live-summary"/);
  assert.match(adapter, /capabilities: \["player-summary", "penalties"\]/);
  assert.match(adapter, /missingCapabilities: \["event-stream", "event-coordinates", "xg"/);
  assert.match(adapter, /heatmap: \[\]/);
  assert.match(adapter, /shotsMap: \[\]/);
});

test("API-Football adapter supports direct and official RapidAPI transports without exposing keys", async () => {
  const adapter = await source("src/lib/providers/api-football.ts");
  const environment = await source(".env.example");
  const security = await source("config/security-gates.json");
  assert.match(adapter, /process\.env\.API_FOOTBALL_KEY/);
  assert.match(adapter, /process\.env\.RAPIDAPI_FOOTBALL_KEY/);
  assert.match(adapter, /"x-rapidapi-key": rapidApiKey/);
  assert.match(adapter, /"x-rapidapi-host": host/);
  assert.match(adapter, /api-football-v1\.p\.rapidapi\.com/);
  assert.match(environment, /RAPIDAPI_FOOTBALL_KEY=/);
  assert.match(security, /"RAPIDAPI_FOOTBALL_KEY"/);
  assert.doesNotMatch(environment, /NEXT_PUBLIC_RAPIDAPI/);
});

test("provider registry exposes a runnable free tier and explicit commercial upgrade slots", async () => {
  const registry = await source("src/lib/providers/player-events.ts");
  assert.match(registry, /id: "statsbomb-open"[\s\S]*?executable: true/);
  assert.match(registry, /id: "api-football"[\s\S]*?coverageTier: "free-live-summary"/);
  assert.match(registry, /id: "sportmonks"[\s\S]*?executable: false/);
  assert.match(registry, /id: "statsbomb-paid"[\s\S]*?coverageTier: "commercial-live-events"/);
});

test("player event route uses the shared provider registry", async () => {
  const route = await source("app/api/player-events/route.ts");
  assert.match(route, /getPlayerEventProviderStatuses/);
  assert.match(route, /loadPlayerEventData/);
  assert.doesNotMatch(route, /provider === "statsbomb-open"/);
});
