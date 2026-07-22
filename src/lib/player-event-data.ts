export type PlayerEventProvider = "statsbomb-open" | "api-football" | "sportmonks" | "statsbomb-paid";
export type PlayerEventCoverageTier = "free-historical" | "free-live-summary" | "commercial-live-events";
export type PlayerEventCapability =
  | "player-summary"
  | "event-stream"
  | "event-coordinates"
  | "xg"
  | "shot-map"
  | "heatmap"
  | "keeper-zones"
  | "penalties"
  | "duel-matchups";

export type HeatmapPoint = {
  x: number;
  y: number;
  count: number;
};

export type ShotPoint = {
  x: number;
  y: number;
  xg: number;
  outcome: string;
  bodyPart: string;
};

export type PlayerEventProfile = {
  playerId: string;
  name: string;
  team: string;
  position: string;
  heightCm: number | null;
  preferredFoot: "left" | "right" | "both" | "unknown";
  shots: number;
  shotsOnTarget: number;
  goals: number;
  xg: number;
  tackles: number;
  tacklesWon: number;
  blocks: number;
  interceptions: number;
  clearances: number;
  dribblesAttempted: number;
  dribblesCompleted: number;
  dribbledPast: number;
  aerialDuelsWon: number;
  aerialDuelsLost: number;
  saves: number;
  shotsFaced: number;
  penaltySaves: number;
  penaltiesFaced: number;
  penaltiesTaken: number;
  penaltiesScored: number;
  heatmap: HeatmapPoint[];
  shotsMap: ShotPoint[];
};

export type KeeperZone = {
  keeperId: string;
  keeperName: string;
  team: string;
  shotsFaced: number;
  saves: number;
  penaltiesFaced: number;
  penaltySaves: number;
  zones: HeatmapPoint[];
};

export type PlayerEventData = {
  ok: true;
  provider: PlayerEventProvider;
  sourceName: string;
  sourceUrl: string;
  mode: "historical-demo" | "live";
  coverageTier: PlayerEventCoverageTier;
  capabilities: PlayerEventCapability[];
  missingCapabilities: PlayerEventCapability[];
  matchId: string;
  matchLabel: string;
  fetchedAt: string;
  teams: string[];
  players: PlayerEventProfile[];
  keeperZones: KeeperZone[];
  summary: {
    totalEvents: number;
    shots: number;
    shotsOnTarget: number;
    goals: number;
    xg: number;
    dribblesAttempted: number;
    dribblesCompleted: number;
    dribbledPast: number;
    tackles: number;
    blocks: number;
    interceptions: number;
    saves: number;
    penaltiesTaken: number;
    penaltiesScored: number;
    penaltySaves: number;
  };
  dataGaps: string[];
  notes: string[];
};

type JsonObject = Record<string, unknown>;

const STATSBOMB_BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data";
const STATSBOMB_GITHUB_API = "https://api.github.com/repos/statsbomb/open-data";
const MAX_STATSBOMB_JSON_BYTES = 20 * 1024 * 1024;
export const DEFAULT_STATSBOMB_MATCH_ID = "3869685";

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonObject) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nestedObject(value: unknown, key: string) {
  return asObject(asObject(value)?.[key]);
}

function nestedName(value: unknown, key: string) {
  return asText(nestedObject(value, key)?.name);
}

function refId(value: unknown) {
  const id = asObject(value)?.id;
  return typeof id === "number" || typeof id === "string" ? String(id) : "";
}

function refName(value: unknown) {
  return asText(asObject(value)?.name);
}

function locationPoint(value: unknown) {
  const location = asArray(value);
  const x = asNumber(location[0], -1);
  const y = asNumber(location[1], -1);
  return x >= 0 && y >= 0 ? { x, y } : null;
}

function isOnTarget(outcome: string) {
  return outcome === "Goal" || outcome.includes("Saved");
}

function emptyPlayer(playerId: string, name: string, team: string, position = ""): PlayerEventProfile {
  return {
    playerId,
    name,
    team,
    position,
    heightCm: null,
    preferredFoot: "unknown",
    shots: 0,
    shotsOnTarget: 0,
    goals: 0,
    xg: 0,
    tackles: 0,
    tacklesWon: 0,
    blocks: 0,
    interceptions: 0,
    clearances: 0,
    dribblesAttempted: 0,
    dribblesCompleted: 0,
    dribbledPast: 0,
    aerialDuelsWon: 0,
    aerialDuelsLost: 0,
    saves: 0,
    shotsFaced: 0,
    penaltySaves: 0,
    penaltiesFaced: 0,
    penaltiesTaken: 0,
    penaltiesScored: 0,
    heatmap: [],
    shotsMap: []
  };
}

function getOrCreatePlayer(players: Map<string, PlayerEventProfile>, playerId: string, name: string, team: string, position = "") {
  const key = playerId || `${team}:${name}`;
  const current = players.get(key);
  if (current) {
    if (!current.position && position) current.position = position;
    return current;
  }

  const created = emptyPlayer(key, name || "Unknown Player", team || "Unknown Team", position);
  players.set(key, created);
  return created;
}

function pushHeatmap(player: PlayerEventProfile, x: number, y: number) {
  const bucketX = Math.round(x / 8) * 8;
  const bucketY = Math.round(y / 8) * 8;
  const existing = player.heatmap.find((point) => point.x === bucketX && point.y === bucketY);
  if (existing) {
    existing.count += 1;
  } else {
    player.heatmap.push({ x: bucketX, y: bucketY, count: 1 });
  }
}

function pushKeeperZone(keeperZones: Map<string, KeeperZone>, keeper: PlayerEventProfile, endLocation: unknown) {
  const point = locationPoint(endLocation);
  const zone = keeperZones.get(keeper.playerId) ?? {
    keeperId: keeper.playerId,
    keeperName: keeper.name,
    team: keeper.team,
    shotsFaced: 0,
    saves: 0,
    penaltiesFaced: 0,
    penaltySaves: 0,
    zones: []
  };

  if (point) {
    const bucketX = Math.round(point.x / 8) * 8;
    const bucketY = Math.round(point.y / 8) * 8;
    const existing = zone.zones.find((item) => item.x === bucketX && item.y === bucketY);
    if (existing) {
      existing.count += 1;
    } else {
      zone.zones.push({ x: bucketX, y: bucketY, count: 1 });
    }
  }

  keeperZones.set(keeper.playerId, zone);
  return zone;
}

async function fetchStatsBombJson<T>(path: string): Promise<T> {
  let rawError = "StatsBomb Open Data raw endpoint failed.";
  try {
    const response = await fetch(`${STATSBOMB_BASE}/${path}`, {
      cache: "force-cache",
      headers: {
        Accept: "application/json",
        "User-Agent": "football-prediction-agent/0.1"
      },
      signal: AbortSignal.timeout(12_000)
    });

    if (response.ok) {
      const bytes = await readLimitedResponseBytes(response, MAX_STATSBOMB_JSON_BYTES);
      return JSON.parse(new TextDecoder().decode(bytes)) as T;
    }
    rawError = `StatsBomb Open Data raw endpoint returned ${response.status}`;
  } catch (error) {
    rawError = `StatsBomb Open Data raw endpoint failed: ${error instanceof Error ? error.message : "network error"}`;
  }

  try {
    return await fetchStatsBombFromGithubApi<T>(path);
  } catch (error) {
    const fallbackError = error instanceof Error ? error.message : "GitHub API fallback failed.";
    throw new Error(`${rawError}; ${fallbackError}`);
  }
}

async function fetchStatsBombFromGithubApi<T>(path: string): Promise<T> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "football-prediction-agent/0.1"
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const metadataResponse = await fetch(`${STATSBOMB_GITHUB_API}/contents/data/${path}?ref=master`, {
    cache: "force-cache",
    headers,
    signal: AbortSignal.timeout(12_000)
  });
  if (!metadataResponse.ok) {
    throw new Error(`GitHub Contents API returned ${metadataResponse.status}.`);
  }

  const metadata = (await metadataResponse.json()) as JsonObject;
  let content = asText(metadata.content);
  let encoding = asText(metadata.encoding);

  if (!content || encoding !== "base64") {
    const gitUrl = asText(metadata.git_url);
    if (!gitUrl) throw new Error("GitHub metadata did not include a blob URL.");

    const blobResponse = await fetch(gitUrl, {
      cache: "force-cache",
      headers,
      signal: AbortSignal.timeout(12_000)
    });
    if (!blobResponse.ok) {
      throw new Error(`GitHub Blob API returned ${blobResponse.status}.`);
    }
    const blob = (await blobResponse.json()) as JsonObject;
    content = asText(blob.content);
    encoding = asText(blob.encoding);
  }

  if (!content || encoding !== "base64") {
    throw new Error("GitHub API did not return base64 content.");
  }

  return JSON.parse(Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf8")) as T;
}

async function fetchOptionalStatsBombJson<T>(path: string) {
  try {
    return { data: await fetchStatsBombJson<T>(path), error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : `StatsBomb Open Data ${path} unavailable.`
    };
  }
}

function inferMatchLabel(teams: Set<string>, matchId: string) {
  const list = Array.from(teams);
  if (matchId === DEFAULT_STATSBOMB_MATCH_ID) return "Argentina vs France, FIFA World Cup 2022 Final";
  return list.length >= 2 ? `${list[0]} vs ${list[1]}` : `StatsBomb match ${matchId}`;
}

export async function getStatsBombOpenEventData(matchId = DEFAULT_STATSBOMB_MATCH_ID): Promise<PlayerEventData> {
  if (!/^\d{4,12}$/.test(matchId)) {
    throw new Error("Invalid StatsBomb match id.");
  }

  const [events, lineupsResult] = await Promise.all([
    fetchStatsBombJson<JsonObject[]>(`events/${matchId}.json`),
    fetchOptionalStatsBombJson<JsonObject[]>(`lineups/${matchId}.json`)
  ]);
  const lineups = lineupsResult.data ?? [];

  const players = new Map<string, PlayerEventProfile>();
  const keeperZones = new Map<string, KeeperZone>();
  const teams = new Set<string>();

  lineups.forEach((teamLineup) => {
    const team = asText(teamLineup.team_name, "Unknown Team");
    teams.add(team);
    asArray(teamLineup.lineup).forEach((rawPlayer) => {
      const player = asObject(rawPlayer);
      if (!player) return;
      const id = String(player.player_id ?? `${team}:${player.player_name ?? ""}`);
      const positions = asArray(player.positions);
      const firstPosition = asObject(positions[0]);
      getOrCreatePlayer(players, id, asText(player.player_name, "Unknown Player"), team, asText(firstPosition?.position));
    });
  });

  events.forEach((event) => {
    const eventType = nestedName(event.type, "name") || refName(event.type);
    const playerRef = asObject(event.player);
    const teamName = refName(event.team);
    if (teamName) teams.add(teamName);
    if (!playerRef) return;

    const player = getOrCreatePlayer(players, refId(playerRef), refName(playerRef), teamName);
    const point = locationPoint(event.location);
    if (point) pushHeatmap(player, point.x, point.y);

    if (eventType === "Shot") {
      const shot = asObject(event.shot);
      const outcome = nestedName(shot?.outcome, "name") || refName(shot?.outcome);
      const shotType = nestedName(shot?.type, "name") || refName(shot?.type);
      const xg = asNumber(shot?.statsbomb_xg);

      player.shots += 1;
      player.xg += xg;
      if (isOnTarget(outcome)) player.shotsOnTarget += 1;
      if (outcome === "Goal") player.goals += 1;
      if (shotType === "Penalty") {
        player.penaltiesTaken += 1;
        if (outcome === "Goal") player.penaltiesScored += 1;
      }
      if (point) {
        player.shotsMap.push({
          x: point.x,
          y: point.y,
          xg,
          outcome,
          bodyPart: nestedName(shot?.body_part, "name") || refName(shot?.body_part)
        });
      }
      return;
    }

    if (eventType === "Dribble") {
      const outcome = nestedName(nestedObject(event, "dribble")?.outcome, "name") || refName(nestedObject(event, "dribble")?.outcome);
      player.dribblesAttempted += 1;
      if (outcome === "Complete") player.dribblesCompleted += 1;
      return;
    }

    if (eventType === "Dribbled Past") {
      player.dribbledPast += 1;
      return;
    }

    if (eventType === "Block") {
      player.blocks += 1;
      return;
    }

    if (eventType === "Interception") {
      player.interceptions += 1;
      return;
    }

    if (eventType === "Clearance") {
      player.clearances += 1;
      return;
    }

    if (eventType === "Duel") {
      const duel = asObject(event.duel);
      const duelType = nestedName(duel?.type, "name") || refName(duel?.type);
      const outcome = nestedName(duel?.outcome, "name") || refName(duel?.outcome);
      if (duelType === "Tackle") {
        player.tackles += 1;
        if (outcome.includes("Success")) player.tacklesWon += 1;
      }
      if (duelType.includes("Aerial")) {
        if (duelType.includes("Lost")) player.aerialDuelsLost += 1;
        if (duelType.includes("Won")) player.aerialDuelsWon += 1;
      }
      return;
    }

    if (eventType === "Goal Keeper") {
      const goalkeeper = asObject(event.goalkeeper);
      const keeperType = nestedName(goalkeeper?.type, "name") || refName(goalkeeper?.type);
      const outcome = nestedName(goalkeeper?.outcome, "name") || refName(goalkeeper?.outcome);
      const zone = pushKeeperZone(keeperZones, player, goalkeeper?.end_location);

      if (keeperType === "Shot Faced") {
        player.shotsFaced += 1;
        zone.shotsFaced += 1;
      }
      if (keeperType === "Shot Saved") {
        player.saves += 1;
        zone.saves += 1;
      }
      if (keeperType.includes("Penalty")) {
        player.penaltiesFaced += 1;
        zone.penaltiesFaced += 1;
        if (keeperType.includes("Saved") || outcome.includes("Saved") || outcome === "Success") {
          player.penaltySaves += 1;
          zone.penaltySaves += 1;
        }
      }
    }
  });

  const playerList = Array.from(players.values())
    .map((player) => ({
      ...player,
      xg: Number(player.xg.toFixed(3)),
      heatmap: player.heatmap.sort((a, b) => b.count - a.count).slice(0, 24),
      shotsMap: player.shotsMap.slice(0, 20)
    }))
    .sort((a, b) => b.xg + b.shots + b.tackles + b.saves - (a.xg + a.shots + a.tackles + a.saves));

  const summary = playerList.reduce(
    (total, player) => ({
      totalEvents: events.length,
      shots: total.shots + player.shots,
      shotsOnTarget: total.shotsOnTarget + player.shotsOnTarget,
      goals: total.goals + player.goals,
      xg: Number((total.xg + player.xg).toFixed(3)),
      dribblesAttempted: total.dribblesAttempted + player.dribblesAttempted,
      dribblesCompleted: total.dribblesCompleted + player.dribblesCompleted,
      dribbledPast: total.dribbledPast + player.dribbledPast,
      tackles: total.tackles + player.tackles,
      blocks: total.blocks + player.blocks,
      interceptions: total.interceptions + player.interceptions,
      saves: total.saves + player.saves,
      penaltiesTaken: total.penaltiesTaken + player.penaltiesTaken,
      penaltiesScored: total.penaltiesScored + player.penaltiesScored,
      penaltySaves: total.penaltySaves + player.penaltySaves
    }),
    {
      totalEvents: events.length,
      shots: 0,
      shotsOnTarget: 0,
      goals: 0,
      xg: 0,
      dribblesAttempted: 0,
      dribblesCompleted: 0,
      dribbledPast: 0,
      tackles: 0,
      blocks: 0,
      interceptions: 0,
      saves: 0,
      penaltiesTaken: 0,
      penaltiesScored: 0,
      penaltySaves: 0
    }
  );

  return {
    ok: true,
    provider: "statsbomb-open",
    sourceName: "StatsBomb Open Data",
    sourceUrl: "https://github.com/statsbomb/open-data",
    mode: "historical-demo",
    coverageTier: "free-historical",
    capabilities: ["player-summary", "event-stream", "event-coordinates", "xg", "shot-map", "heatmap", "keeper-zones", "penalties", "duel-matchups"],
    missingCapabilities: [],
    matchId,
    matchLabel: inferMatchLabel(teams, matchId),
    fetchedAt: new Date().toISOString(),
    teams: Array.from(teams),
    players: playerList,
    keeperZones: Array.from(keeperZones.values()),
    summary,
    dataGaps: [
      ...(lineupsResult.error ? [`Lineup enrichment unavailable: ${lineupsResult.error}`] : []),
      "StatsBomb Open Data is historical, not live.",
      "This open dataset does not include every competition or current fixture.",
      "Height and preferred-foot fields are not present in this source.",
      "Full real-time production coverage requires API-Football, Sportmonks, StatsBomb paid, Opta, or Wyscout."
    ],
    notes: [
      "No OpenAI token is used for this fetch.",
      "Use this as the event-data pipeline demo; switch provider when a production sports-data key is configured."
    ]
  };
}
import { readLimitedResponseBytes } from "./http-security";
