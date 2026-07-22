import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitHeaders } from "@/src/lib/rate-limit";
import { readLimitedJson, RequestBodyTooLargeError } from "@/src/lib/http-security";
import { readRosterCache } from "@/src/lib/roster-cache";
import { getSportsDbApiKey, getSportsDbApiKeyMode } from "@/src/lib/runtime";

type LiveTeamMode = "search" | "league" | "country" | "popular";

type SportsDbTeam = {
  idTeam?: string;
  strTeam?: string;
  strTeamShort?: string;
  strAlternate?: string;
  strSport?: string;
  strLeague?: string;
  strCountry?: string;
  strBadge?: string;
  strLogo?: string;
  strFanart1?: string;
  strStadium?: string;
  intStadiumCapacity?: string;
};

type SportsDbPlayer = {
  idPlayer?: string;
  strPlayer?: string;
  strPosition?: string;
  strThumb?: string;
  strCutout?: string;
};

const BASE_URL = "https://www.thesportsdb.com/api/v1/json";
const MAX_TEAMS = 24;
const MAX_POPULAR_TEAMS = 96;
const MAX_PLAYERS = 8;
const REQUEST_TIMEOUT_MS = 10_000;

const popularLeagues = [
  "English Premier League",
  "Spanish La Liga",
  "German Bundesliga",
  "Italian Serie A",
  "French Ligue 1",
  "UEFA Champions League"
];

const popularNationalTeams = [
  "Argentina",
  "Brazil",
  "France",
  "England",
  "Spain",
  "Germany",
  "Portugal",
  "Netherlands",
  "Italy",
  "Belgium",
  "Croatia",
  "Uruguay",
  "Japan",
  "South Korea",
  "Morocco",
  "China"
];

const fallbackClubGroups = [
  {
    league: "English Premier League",
    country: "England",
    teams: ["Arsenal", "Aston Villa", "Chelsea", "Liverpool", "Manchester City", "Manchester United", "Newcastle United", "Tottenham Hotspur"]
  },
  {
    league: "Spanish La Liga",
    country: "Spain",
    teams: ["Real Madrid", "Barcelona", "Atletico Madrid", "Real Sociedad", "Sevilla", "Villarreal", "Athletic Bilbao"]
  },
  {
    league: "German Bundesliga",
    country: "Germany",
    teams: ["Bayern Munich", "Borussia Dortmund", "Bayer Leverkusen", "RB Leipzig", "Eintracht Frankfurt"]
  },
  {
    league: "Italian Serie A",
    country: "Italy",
    teams: ["Inter Milan", "AC Milan", "Juventus", "Napoli", "AS Roma", "Lazio", "Atalanta"]
  },
  {
    league: "French Ligue 1",
    country: "France",
    teams: ["Paris Saint-Germain", "Marseille", "Monaco", "Lyon", "Lille", "Nice"]
  },
  {
    league: "Primeira Liga",
    country: "Portugal",
    teams: ["Benfica", "Porto", "Sporting CP"]
  },
  {
    league: "Chinese Super League",
    country: "China",
    teams: ["Shanghai Port", "Shandong Taishan", "Beijing Guoan", "Shanghai Shenhua"]
  },
  {
    league: "J1 League",
    country: "Japan",
    teams: ["Vissel Kobe", "Urawa Red Diamonds", "Yokohama F. Marinos"]
  }
];

const leagueAliases: Record<string, string> = {
  "英超": "English Premier League",
  "西甲": "Spanish La Liga",
  "德甲": "German Bundesliga",
  "意甲": "Italian Serie A",
  "法甲": "French Ligue 1",
  "欧冠": "UEFA Champions League",
  "国家队": "FIFA World Cup"
};

const countryAliases: Record<string, string> = {
  "英格兰": "England",
  "英国": "England",
  "西班牙": "Spain",
  "德国": "Germany",
  "法国": "France",
  "阿根廷": "Argentina",
  "巴西": "Brazil",
  "日本": "Japan",
  "中国": "China",
  "葡萄牙": "Portugal",
  "意大利": "Italy",
  "荷兰": "Netherlands"
};

const teamAliases: Record<string, string> = {
  "曼城": "Manchester City",
  "皇马": "Real Madrid",
  "皇家马德里": "Real Madrid",
  "阿森纳": "Arsenal",
  "利物浦": "Liverpool",
  "拜仁": "Bayern Munich",
  "拜仁慕尼黑": "Bayern Munich",
  "巴黎": "Paris Saint-Germain",
  "巴黎圣日耳曼": "Paris Saint-Germain",
  "法国队": "France",
  "日本队": "Japan",
  "中国队": "China",
  "巴西队": "Brazil",
  "阿根廷队": "Argentina"
};

const europe = new Set([
  "England",
  "Spain",
  "Germany",
  "France",
  "Italy",
  "Portugal",
  "Netherlands",
  "Belgium",
  "Scotland",
  "Turkey",
  "Greece",
  "Switzerland",
  "Austria",
  "Denmark",
  "Sweden",
  "Norway",
  "Croatia",
  "Serbia",
  "Poland"
]);
const southAmerica = new Set(["Argentina", "Brazil", "Uruguay", "Chile", "Colombia", "Peru", "Ecuador", "Paraguay", "Bolivia", "Venezuela"]);
const asia = new Set(["Japan", "China", "South Korea", "Korea Republic", "Saudi Arabia", "Qatar", "Iran", "Australia", "Thailand", "Vietnam"]);
const northAmerica = new Set(["United States", "USA", "Mexico", "Canada", "Costa Rica", "Jamaica"]);
const africa = new Set(["Morocco", "Egypt", "Senegal", "Nigeria", "Ghana", "Cameroon", "South Africa", "Tunisia", "Algeria"]);

function toText(value: unknown, maxLength = 80) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function alias(value: string, aliases: Record<string, string>) {
  return aliases[value] ?? value;
}

function makeUrl(apiKey: string, endpoint: string, params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return `${BASE_URL}/${encodeURIComponent(apiKey)}/${endpoint}?${search.toString()}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = windowlessTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Provider returned ${response.status}.`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function windowlessTimeout(callback: () => void, delay: number) {
  return setTimeout(callback, delay);
}

function hash(input: string) {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) >>> 0;
  }
  return value;
}

function score(seed: number, offset: number, min = 58, max = 90) {
  return min + ((seed + offset * 17) % (max - min + 1));
}

function inferContinent(country: string) {
  if (europe.has(country)) return "欧洲";
  if (southAmerica.has(country)) return "南美洲";
  if (asia.has(country)) return "亚洲";
  if (northAmerica.has(country)) return "北美洲";
  if (africa.has(country)) return "非洲";
  return "待识别";
}

function inferTier(league: string) {
  const top = ["Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1", "Champions League", "World Cup"];
  if (top.some((item) => league.includes(item))) return "顶级";
  if (league.includes("Cup") || league.includes("League")) return "一线";
  return "竞争级";
}

function inferKind(teamName: string, country: string, league: string): "club" | "national" {
  const normalizedTeam = teamName.toLowerCase();
  const normalizedCountry = country.toLowerCase();
  const nationalLeague = ["FIFA", "World Cup", "Nations", "International", "Euro", "CONMEBOL", "AFC"];
  if (normalizedTeam === normalizedCountry) return "national";
  if (nationalLeague.some((item) => league.toLowerCase().includes(item.toLowerCase()))) return "national";
  return "club";
}

function initials(name: string) {
  const tokens = name.split(/[\s-]+/).filter(Boolean);
  const text = tokens.length >= 2 ? `${tokens[0][0]}${tokens[1][0]}` : name.slice(0, 3);
  return text.toUpperCase();
}

function recent(seed: number) {
  const values = ["胜", "平", "负", "胜", "胜"];
  return Array.from({ length: 5 }, (_, index) => values[(seed + index) % values.length]);
}

function normalizePlayer(player: SportsDbPlayer, teamSeed: number, index: number) {
  const name = toText(player.strPlayer, 60) || `Player ${index + 1}`;
  const role = toText(player.strPosition, 40) || "Player";
  const seed = hash(`${name}:${teamSeed}:${index}`);
  return {
    name,
    role,
    status: "ready" as const,
    form: score(seed, 1, 62, 88),
    goals: role.toLowerCase().includes("wing") || role.toLowerCase().includes("forward") || role.toLowerCase().includes("striker") ? seed % 9 : seed % 3,
    assists: role.toLowerCase().includes("mid") || role.toLowerCase().includes("wing") ? seed % 7 : seed % 3,
    defense: role.toLowerCase().includes("back") || role.toLowerCase().includes("def") || role.toLowerCase().includes("goal") ? score(seed, 2, 70, 91) : score(seed, 2, 42, 74),
    minutes: score(seed, 3, 55, 92),
    avatarUrl: player.strCutout || player.strThumb || "",
    metricsStatus: "placeholder" as const,
    rosterStatus: player.idPlayer ? ("provider" as const) : ("placeholder" as const),
    note: "TheSportsDB 球员名单；状态、进球、助攻等指标暂为可视化占位，需接入官方统计源后替换。"
  };
}

async function fetchPlayers(apiKey: string, teamId: string, teamSeed: number) {
  const url = makeUrl(apiKey, "lookup_all_players.php", { id: teamId });
  const data = await fetchJson<{ player?: SportsDbPlayer[] | null }>(url);
  const blockedRoles = ["coach", "manager", "president", "chairman", "assistant"];
  const players = (data.player ?? [])
    .filter((player) => {
      const role = toText(player.strPosition, 50).toLowerCase();
      return !blockedRoles.some((blocked) => role.includes(blocked));
    })
    .slice(0, MAX_PLAYERS)
    .map((player, index) => normalizePlayer(player, teamSeed, index));

  return players;
}

function placeholderPlayers(teamName: string, seed: number) {
  const roles = ["Forward", "Midfielder", "Defensive Midfielder", "Defender", "Goalkeeper"];
  return roles.map((role, index) => normalizePlayer({ strPlayer: `${teamName} ${role}`, strPosition: role }, seed, index));
}

function normalizeTeam(team: SportsDbTeam, players: ReturnType<typeof placeholderPlayers> = [], source = "TheSportsDB") {
  const name = toText(team.strTeam, 80) || "Unknown Team";
  const league = toText(team.strLeague, 80) || "Unknown League";
  const country = toText(team.strCountry, 60) || "Unknown";
  const seed = hash(`${team.idTeam}:${name}:${league}:${country}`);
  const kind = inferKind(name, country, league);

  return {
    id: `${source === "TheSportsDB" ? "live" : "curated"}-${team.idTeam || seed}`,
    source,
    sourceTeamId: team.idTeam || "",
    metricsStatus: "placeholder" as const,
    rosterStatus: players.length ? ("provider" as const) : ("placeholder" as const),
    name,
    kind,
    league,
    country,
    continent: inferContinent(country),
    tier: inferTier(league),
    badge: toText(team.strTeamShort, 8) || initials(name),
    badgeUrl: team.strBadge || team.strLogo || "",
    fanartUrl: team.strFanart1 || "",
    stadium: toText(team.strStadium, 80),
    stadiumCapacity: Number(team.intStadiumCapacity || 0) || null,
    attack: score(seed, 1, 62, 92),
    defense: score(seed, 2, 60, 90),
    form: score(seed, 3, 58, 88),
    fitness: score(seed, 4, 62, 90),
    possession: score(seed, 5, 58, 88),
    press: score(seed, 6, 57, 88),
    injurySafety: score(seed, 7, 64, 88),
    xgFor: Number((1.1 + (seed % 118) / 100).toFixed(2)),
    xgAgainst: Number((0.72 + ((seed >> 3) % 96) / 100).toFixed(2)),
    recent: recent(seed),
    players: players.length ? players : placeholderPlayers(name, seed)
  };
}

function shouldIncludePlayers(mode: LiveTeamMode, requested: boolean) {
  return requested || mode === "search";
}

function uniqueProviderTeams(teams: SportsDbTeam[]) {
  const map = new Map<string, SportsDbTeam>();
  teams.forEach((team) => {
    const key = team.idTeam || `${team.strTeam ?? ""}:${team.strCountry ?? ""}:${team.strLeague ?? ""}`;
    if (key.trim()) {
      map.set(key, team);
    }
  });
  return Array.from(map.values());
}

async function fetchTeamsUrl(url: string) {
  const data = await fetchJson<{ teams?: SportsDbTeam[] | null }>(url);
  return data.teams ?? [];
}

async function fetchPopularTeams(apiKey: string) {
  const leagueUrls = popularLeagues.map((league) => makeUrl(apiKey, "search_all_teams.php", { l: league }));
  const nationalUrls = popularNationalTeams.map((team) => makeUrl(apiKey, "searchteams.php", { t: team }));
  const settled = await Promise.allSettled([...leagueUrls, ...nationalUrls].map((url) => fetchTeamsUrl(url)));
  const teams = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  return uniqueProviderTeams(teams)
    .filter((team) => team.strSport === "Soccer" || !team.strSport)
    .slice(0, MAX_POPULAR_TEAMS);
}

function fallbackPopularTeams(): SportsDbTeam[] {
  const clubTeams = fallbackClubGroups.flatMap((group) =>
    group.teams.map((team) => ({
      idTeam: `curated-${team.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      strTeam: team,
      strSport: "Soccer",
      strLeague: group.league,
      strCountry: group.country
    }))
  );
  const nationalTeams = popularNationalTeams.map((team) => ({
    idTeam: `curated-national-${team.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    strTeam: team,
    strSport: "Soccer",
    strLeague: "FIFA World Cup",
    strCountry: team === "South Korea" ? "South Korea" : team
  }));

  return uniqueProviderTeams([...clubTeams, ...nationalTeams]).slice(0, MAX_POPULAR_TEAMS);
}

function fallbackTeamsForMode(mode: LiveTeamMode, body: Record<string, unknown>): SportsDbTeam[] {
  const fallback = fallbackPopularTeams();

  if (mode === "search") {
    const query = alias(toText(body.query), teamAliases).toLowerCase();
    const matches = fallback.filter((team) => {
      const name = toText(team.strTeam).toLowerCase();
      const alternate = toText(team.strAlternate).toLowerCase();
      return name.includes(query) || query.includes(name) || alternate.includes(query);
    });

    if (matches.length) {
      return matches.slice(0, MAX_TEAMS);
    }

    return [
      {
        idTeam: `curated-search-${query.replace(/[^a-z0-9]+/g, "-")}`,
        strTeam: toText(body.query, 80) || "Unknown Team",
        strSport: "Soccer",
        strLeague: "Unknown League",
        strCountry: "Unknown"
      }
    ];
  }

  if (mode === "league") {
    const league = alias(toText(body.league), leagueAliases).toLowerCase();
    return fallback.filter((team) => toText(team.strLeague).toLowerCase() === league).slice(0, MAX_TEAMS);
  }

  if (mode === "country") {
    const country = alias(toText(body.country), countryAliases).toLowerCase();
    return fallback.filter((team) => toText(team.strCountry).toLowerCase() === country).slice(0, MAX_TEAMS);
  }

  return fallback.slice(0, MAX_POPULAR_TEAMS);
}

async function cachedTeamsForMode(mode: LiveTeamMode, body: Record<string, unknown>) {
  const cache = await readRosterCache().catch(() => null);
  const teams = (cache?.snapshot.teams ?? []) as Array<{ name?: string; league?: string; country?: string; kind?: string }>;

  if (!teams.length) {
    return [];
  }

  if (mode === "search") {
    const query = alias(toText(body.query), teamAliases).toLowerCase();
    return teams.filter((team) => {
      const name = toText(team.name).toLowerCase();
      return name.includes(query) || query.includes(name);
    });
  }

  if (mode === "league") {
    const league = toText(body.league).toLowerCase();
    const englishLeague = alias(toText(body.league), leagueAliases).toLowerCase();
    return teams.filter((team) => {
      const teamLeague = toText(team.league).toLowerCase();
      return teamLeague === league || teamLeague === englishLeague;
    });
  }

  if (mode === "country") {
    const country = toText(body.country).toLowerCase();
    const englishCountry = alias(toText(body.country), countryAliases).toLowerCase();
    return teams.filter((team) => {
      const teamCountry = toText(team.country).toLowerCase();
      return teamCountry === country || teamCountry === englishCountry;
    });
  }

  return teams;
}

export async function POST(request: Request) {
  try {
    const limited = await checkRateLimit(request, { keyPrefix: "live-team", limit: 30, windowMs: 60_000 });
    if (!limited.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: rateLimitHeaders(limited) }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = ((await readLimitedJson(request)) ?? {}) as Record<string, unknown>;
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: error instanceof RequestBodyTooLargeError ? error.message : "Invalid JSON payload." },
        { status: error instanceof RequestBodyTooLargeError ? 413 : 400 }
      );
    }
    const mode = toText(body.mode, 20) as LiveTeamMode;
    const includePlayers = Boolean(body.includePlayers);
    const apiKey = getSportsDbApiKey();
    const apiKeyMode = getSportsDbApiKeyMode();

    if (!["search", "league", "country", "popular"].includes(mode)) {
      return NextResponse.json({ ok: false, error: "Invalid import mode." }, { status: 400 });
    }

    let url = "";
    if (mode === "search") {
      const query = alias(toText(body.query), teamAliases);
      if (query.length < 2) {
        return NextResponse.json({ ok: false, error: "Search query is required." }, { status: 400 });
      }
      url = makeUrl(apiKey, "searchteams.php", { t: query });
    }

    if (mode === "league") {
      const league = alias(toText(body.league), leagueAliases) || "English Premier League";
      url = makeUrl(apiKey, "search_all_teams.php", { l: league });
    }

    if (mode === "country") {
      const country = alias(toText(body.country), countryAliases) || "England";
      url = makeUrl(apiKey, "search_all_teams.php", { s: "Soccer", c: country });
    }

    let providerError: string | null = null;
    let sourceName = "TheSportsDB";
    let rawTeams: SportsDbTeam[] = [];

    try {
      const providerPopularTeams = mode === "popular" ? await fetchPopularTeams(apiKey) : [];
      rawTeams =
        mode === "popular"
          ? providerPopularTeams.length
            ? providerPopularTeams
            : fallbackPopularTeams()
          : ((await fetchJson<{ teams?: SportsDbTeam[] | null }>(url)).teams ?? [])
              .filter((team) => team.strSport === "Soccer" || !team.strSport)
              .slice(0, MAX_TEAMS);
    } catch (error) {
      providerError = error instanceof Error ? error.message : "Provider unavailable.";
      const cachedTeams = await cachedTeamsForMode(mode, body);
      if (cachedTeams.length) {
        return NextResponse.json({
          ok: true,
          source: {
            name: "Daily Roster Cache",
            url: "local-or-cloud:roster-cache",
            apiKeyMode: "cache"
          },
          importedAt: new Date().toISOString(),
          rawCount: cachedTeams.length,
          teams: cachedTeams,
          notice: `Live provider unavailable (${providerError}); returned cached roster data instead.`
        });
      }

      rawTeams = fallbackTeamsForMode(mode, body);
      sourceName = "Curated Fallback Catalog";
    }

    if (!rawTeams.length) {
      const cachedTeams = await cachedTeamsForMode("popular", body);
      if (cachedTeams.length) {
        return NextResponse.json({
          ok: true,
          source: {
            name: "Daily Roster Cache",
            url: "local-or-cloud:roster-cache",
            apiKeyMode: "cache"
          },
          importedAt: new Date().toISOString(),
          rawCount: cachedTeams.length,
          teams: cachedTeams,
          notice: "No live teams matched; returned cached roster data instead."
        });
      }

      rawTeams = fallbackTeamsForMode(mode, body);
      sourceName = "Curated Fallback Catalog";
    }

    const withPlayers = shouldIncludePlayers(mode, includePlayers);

    const teams = await Promise.all(
      rawTeams.map(async (team, index) => {
        const seed = hash(`${team.idTeam}:${team.strTeam}:${index}`);
        if (!withPlayers || !team.idTeam || index >= 4) {
          return normalizeTeam(team, [], team.idTeam?.startsWith("curated-") ? "Curated Popular Catalog" : "TheSportsDB");
        }

        try {
          const players = await fetchPlayers(apiKey, team.idTeam, seed);
          return normalizeTeam(team, players);
        } catch {
          return normalizeTeam(team);
        }
      })
    );

    return NextResponse.json({
      ok: true,
      source: {
        name: sourceName,
        url: "https://www.thesportsdb.com/api.php",
        apiKeyMode
      },
      importedAt: new Date().toISOString(),
      rawCount: rawTeams.length,
      teams,
      notice:
        providerError
          ? `Live provider unavailable (${providerError}); using fallback metadata. Performance metrics remain demo placeholders.`
          : apiKeyMode === "public-demo"
          ? "Using TheSportsDB public demo key for metadata and visuals. Performance metrics are demo placeholders."
          : "Using server-side TheSportsDB metadata and visuals. Performance metrics are demo placeholders."
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Provider request timed out." : "Live team import failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
