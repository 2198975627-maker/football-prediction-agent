import { execFile } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { isSupabaseRosterCacheWritable } from "@/src/lib/roster-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const execFileAsync = promisify(execFile);

function readText(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function readNumber(name: string, fallback: number, min: number, max: number) {
  const raw = readText(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isAuthorized(request: Request) {
  const secret = readText("CRON_SECRET");
  const isProduction = process.env.NODE_ENV === "production" || readText("APP_ENV") === "production";

  if (!secret) {
    return !isProduction;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function refreshSummary(stdout: string) {
  const values = Object.fromEntries(
    ["teams", "players", "roster-change-teams"].map((key) => {
      const match = stdout.match(new RegExp(`\\[roster-refresh\\] ${key}=(\\d+)`));
      return [key, match ? Number(match[1]) : null];
    })
  );
  return {
    teams: values.teams,
    players: values.players,
    teamsWithRosterChanges: values["roster-change-teams"]
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
  }

  if (!isSupabaseRosterCacheWritable()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Cloud roster cache is not writable. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before enabling deployment cron."
      },
      { status: 500 }
    );
  }

  const refreshScript = `${process.cwd()}/skills/football-roster-refresh/scripts/refresh-rosters.mjs`;
  const maxTeams = readNumber("ROSTER_REFRESH_MAX_TEAMS", 72, 8, 160);
  const maxPlayersPerTeam = readNumber("ROSTER_REFRESH_MAX_PLAYERS_PER_TEAM", 40, 5, 100);

  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        refreshScript,
        "--max-teams",
        String(maxTeams),
        "--max-players-per-team",
        String(maxPlayersPerTeam)
      ],
      {
        timeout: 55_000,
        maxBuffer: 1024 * 1024
      }
    );

    return NextResponse.json({
      ok: true,
      storage: "supabase",
      maxTeams,
      maxPlayersPerTeam,
      summary: refreshSummary(stdout)
    });
  } catch (error) {
    console.error("Roster refresh cron failed.", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, error: "Roster refresh failed." }, { status: 500 });
  }
}
