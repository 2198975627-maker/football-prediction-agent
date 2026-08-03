import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalMatchIdentity,
  canonicalTeamIdentity,
  normalizeFootballIdentity
} from "../src/lib/match-identities.ts";

test("team identities are normalized across provider-specific IDs", () => {
  const sourceTeams = [
    { id: 110, name: "Team A", shortCode: "TMA" },
    { id: 120, name: "Team B", shortCode: "TMB" }
  ];
  const canonicalTeams = [
    { id: 10, name: "Team A", shortCode: "A" },
    { id: 20, name: "Team B", shortCode: "B" }
  ];
  assert.equal(canonicalTeamIdentity(sourceTeams, 110, canonicalTeams), 10);
  assert.equal(canonicalTeamIdentity(sourceTeams, 999, canonicalTeams), 999);
  assert.equal(normalizeFootballIdentity("Atletico-Madrid"), "atleticomadrid");
});

test("the same fixture has one identity despite provider IDs and punctuation", () => {
  const first = canonicalMatchIdentity({ startsAt: "2026-08-10T12:00:00Z", homeTeam: "Team A", awayTeam: "Team B" });
  const second = canonicalMatchIdentity({ startsAt: "2026-08-10T12:03:00Z", homeTeam: "Team-A", awayTeam: "Team B" });
  assert.equal(first, second);
});
