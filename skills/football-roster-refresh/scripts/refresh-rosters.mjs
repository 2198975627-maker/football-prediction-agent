#!/usr/bin/env node

import process from "node:process";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json";
const API_FOOTBALL_DIRECT_BASE_URL = "https://v3.football.api-sports.io";
const PUBLIC_THESPORTSDB_DEMO_KEY = "123";
const REQUEST_TIMEOUT_MS = 12_000;
const DEFAULT_API_FOOTBALL_TEAM_LIMIT = 16;

const DEFAULT_LEAGUES = [
  "English Premier League",
  "Spanish La Liga",
  "German Bundesliga",
  "Italian Serie A",
  "French Ligue 1",
  "Portuguese Primeira Liga",
  "Dutch Eredivisie",
  "Chinese Super League",
  "Japanese J1 League",
  "South Korean K League 1",
  "Saudi-Arabian Pro League",
  "American Major League Soccer"
];

const DEFAULT_NATIONAL_TEAMS = [
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
  "Colombia",
  "Mexico",
  "United States",
  "Morocco",
  "Senegal",
  "South Korea",
  "Japan",
  "Australia",
  "Iran",
  "China"
];

const FALLBACK_CLUB_GROUPS = [
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
    league: "Chinese Super League",
    country: "China",
    teams: ["Shanghai Port", "Shandong Taishan", "Beijing Guoan", "Shanghai Shenhua"]
  },
  {
    league: "J1 League",
    country: "Japan",
    teams: ["Vissel Kobe", "Urawa Red Diamonds", "Yokohama F. Marinos"]
  },
  {
    league: "K League 1",
    country: "South Korea",
    teams: ["Ulsan HD", "Jeonbuk Hyundai Motors"]
  },
  {
    league: "Major League Soccer",
    country: "United States",
    teams: ["Inter Miami", "Los Angeles FC", "LA Galaxy"]
  }
];

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

function parseArgs(argv) {
  const args = {
    maxTeams: 120,
    maxPlayersPerTeam: 80,
    concurrency: 4,
    apiFootballTeamLimit: Math.min(
      40,
      Math.max(0, Number(readEnv("ROSTER_API_FOOTBALL_TEAM_LIMIT", String(DEFAULT_API_FOOTBALL_TEAM_LIMIT))) || 0)
    ),
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    const next = argv[index + 1];
    if (item === "--max-teams" && next) {
      args.maxTeams = Math.max(1, Number(next) || args.maxTeams);
      index += 1;
    } else if (item === "--max-players-per-team" && next) {
      args.maxPlayersPerTeam = Math.max(1, Number(next) || args.maxPlayersPerTeam);
      index += 1;
    } else if (item === "--concurrency" && next) {
      args.concurrency = Math.min(8, Math.max(1, Number(next) || args.concurrency));
      index += 1;
    } else if (item === "--api-football-team-limit" && next) {
      args.apiFootballTeamLimit = Math.min(40, Math.max(0, Number(next) || 0));
      index += 1;
    } else if (item === "--dry-run") {
      args.dryRun = true;
    }
  }

  return args;
}

function beijingDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${value.year}-${value.month}-${value.day}`,
    time: `${value.hour}:${value.minute}:${value.second}`,
    isoLike: `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}+08:00`
  };
}

function toText(value, maxLength = 120) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function readEnv(name, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function makeUrl(apiKey, endpoint, params) {
  const search = new URLSearchParams(params);
  return `${BASE_URL}/${encodeURIComponent(apiKey)}/${endpoint}?${search.toString()}`;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Provider returned ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function getApiFootballConfig() {
  const directKey = readEnv("API_FOOTBALL_KEY");
  if (directKey) {
    return {
      authMode: "direct",
      baseUrl: API_FOOTBALL_DIRECT_BASE_URL,
      headers: { "x-apisports-key": directKey }
    };
  }

  const rapidApiKey = readEnv("RAPIDAPI_FOOTBALL_KEY");
  if (!rapidApiKey) return null;
  const host = readEnv("RAPIDAPI_FOOTBALL_HOST", "api-football-v1.p.rapidapi.com");
  if (!/^[a-z0-9.-]+$/i.test(host)) {
    throw new Error("RAPIDAPI_FOOTBALL_HOST is invalid.");
  }
  return {
    authMode: "rapidapi",
    baseUrl: `https://${host}/v3`,
    headers: {
      "x-rapidapi-key": rapidApiKey,
      "x-rapidapi-host": host
    }
  };
}

async function fetchApiFootball(config, endpoint, params) {
  const url = new URL(`${config.baseUrl}/${endpoint.replace(/^\/+/, "")}`);
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      url.searchParams.set(name, String(value));
    }
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "football-prediction-agent/0.1",
        ...config.headers
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`API-Football returned ${response.status}`);
    }
    const payload = await response.json();
    const errors = payload?.errors;
    if (
      (Array.isArray(errors) && errors.length)
      || (errors && typeof errors === "object" && Object.keys(errors).length)
    ) {
      throw new Error("API-Football rejected the request or the daily quota is exhausted.");
    }
    return Array.isArray(payload?.response) ? payload.response : [];
  } finally {
    clearTimeout(timer);
  }
}

function getSupabaseConfig() {
  const url = readEnv("SUPABASE_URL").replace(/\/+$/, "");
  const secretKey = readEnv("SUPABASE_SECRET_KEY") || readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey = readEnv("SUPABASE_PUBLISHABLE_KEY") || readEnv("SUPABASE_ANON_KEY");
  const table = readEnv("SUPABASE_ROSTER_CACHE_TABLE", "football_roster_cache");

  if (!url || (!secretKey && !publishableKey)) {
    return null;
  }

  return {
    url,
    table,
    readKey: secretKey || publishableKey,
    writeKey: secretKey || null,
    writeMode: secretKey ? "secret-key" : "read-only"
  };
}

function supabaseHeaders(key) {
  const headers = {
    apikey: key,
    "Content-Type": "application/json"
  };
  if (key.startsWith("eyJ") && key.split(".").length === 3) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

async function readSupabaseCacheItem(config, cacheKey) {
  const url = `${config.url}/rest/v1/${encodeURIComponent(config.table)}?cache_key=eq.${encodeURIComponent(cacheKey)}&select=payload,updated_at&limit=1`;
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: supabaseHeaders(config.readKey)
  });

  if (!response.ok) {
    throw new Error(`Supabase read failed with ${response.status}`);
  }

  const rows = await response.json();
  return rows[0]?.payload ?? null;
}

async function writeSupabaseCacheItem(config, cacheKey, payload) {
  if (!config.writeKey) {
    throw new Error("Supabase roster cache writes require SUPABASE_SECRET_KEY.");
  }

  const url = `${config.url}/rest/v1/${encodeURIComponent(config.table)}?on_conflict=cache_key`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseHeaders(config.writeKey),
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify([
      {
        cache_key: cacheKey,
        payload,
        updated_at: new Date().toISOString()
      }
    ])
  });

  if (!response.ok) {
    throw new Error(`Supabase write failed with ${response.status}`);
  }
}

async function readPreviousCloudSnapshot() {
  const config = getSupabaseConfig();
  if (!config) return null;

  try {
    return await readSupabaseCacheItem(config, "latest");
  } catch (error) {
    console.warn(`[roster-refresh] cloud previous snapshot unavailable: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

async function writeCloudCache(snapshot, changes, required) {
  const config = getSupabaseConfig();
  if (!config?.writeKey) {
    if (required) {
      throw new Error("Supabase roster cache is required but SUPABASE_URL and SUPABASE_SECRET_KEY are not configured.");
    }
    return false;
  }

  try {
    const date = snapshot.beijingDate || new Date().toISOString().slice(0, 10);
    await writeSupabaseCacheItem(config, "latest", snapshot);
    await writeSupabaseCacheItem(config, "latest-changes", changes);
    await writeSupabaseCacheItem(config, `history:${date}`, snapshot);
    await writeSupabaseCacheItem(config, `changes:${date}`, changes);
    console.log(`[roster-refresh] cloud-cache=supabase (${config.writeMode})`);
    return true;
  } catch (error) {
    if (required) {
      throw error;
    }
    console.warn(`[roster-refresh] cloud cache write skipped: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

function hash(input) {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) >>> 0;
  }
  return value;
}

function score(seed, offset, min = 58, max = 90) {
  return min + ((seed + offset * 17) % (max - min + 1));
}

function inferContinent(country) {
  if (europe.has(country)) return "欧洲";
  if (southAmerica.has(country)) return "南美洲";
  if (asia.has(country)) return "亚洲";
  if (northAmerica.has(country)) return "北美洲";
  if (africa.has(country)) return "非洲";
  return "待识别";
}

function inferTier(league) {
  const top = ["Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1", "Champions League", "World Cup"];
  if (top.some((item) => league.includes(item))) return "顶级";
  if (league.includes("Cup") || league.includes("League")) return "一线";
  return "竞争级";
}

function inferKind(teamName, country, league) {
  const normalizedTeam = teamName.toLowerCase();
  const normalizedCountry = country.toLowerCase();
  const nationalLeague = ["fifa", "world cup", "nations", "international", "euro", "conmebol", "afc"];
  if (normalizedTeam === normalizedCountry) return "national";
  if (nationalLeague.some((item) => league.toLowerCase().includes(item))) return "national";
  return "club";
}

function initials(name) {
  const tokens = name.split(/[\s-]+/).filter(Boolean);
  const text = tokens.length >= 2 ? `${tokens[0][0]}${tokens[1][0]}` : name.slice(0, 3);
  return text.toUpperCase();
}

function normalizedTeamName(value) {
  const normalized = toText(value, 100)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  const aliases = {
    asmonaco: "monaco",
    asromafc: "asroma",
    intermiamicf: "intermiami",
    jeonbukhyundai: "jeonbukhyundaimotors",
    jeonbukhyundaimotorsfc: "jeonbukhyundaimotors",
    lafc: "losangelesfc",
    lilleosc: "lille",
    losangelesfootballclub: "losangelesfc",
    olympiquedemarseille: "marseille",
    olympiquelyonnais: "lyon",
    parissaintgermainfc: "parissaintgermain",
    psv: "psveindhoven",
    roma: "asroma",
    sportinglisbon: "sportingcp",
    ulsanhyundai: "ulsanhd",
    ulsanhyundaifc: "ulsanhd"
  };

  return aliases[normalized] ?? normalized;
}

function teamRecordScore(team) {
  return [
    team.idTeam && !String(team.idTeam).startsWith("fallback-") ? 8 : 0,
    team.strBadge ? 6 : 0,
    team.strLogo ? 3 : 0,
    team.strFanart1 ? 2 : 0,
    team.strStadium ? 1 : 0
  ].reduce((total, value) => total + value, 0);
}

function finiteNumber(value) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseHeightCm(value) {
  const text = toText(value, 30).toLowerCase();
  if (!text) return null;
  const amount = Number(text.replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(amount)) return null;
  if (text.includes("ft") || text.includes("'")) return null;
  const centimeters = text.includes("m") && !text.includes("cm") && amount < 3 ? amount * 100 : amount;
  return centimeters >= 140 && centimeters <= 230 ? Math.round(centimeters) : null;
}

function ageFromBirthDate(value) {
  const birthDate = new Date(toText(value, 30));
  if (!Number.isFinite(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birthDate.getUTCMonth()
    || (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 14 && age <= 60 ? age : null;
}

function normalizePlayer(player, index, maxPlayersPerTeam) {
  const role = toText(player.strPosition, 60) || "Player";
  const shirtNumber = finiteNumber(player.strNumber);
  return {
    id: toText(player.idPlayer, 40) || `player-${index + 1}`,
    name: toText(player.strPlayer, 100) || `Player ${index + 1}`,
    role,
    status: "ready",
    form: 70,
    goals: 0,
    assists: 0,
    defense: role.toLowerCase().includes("def") || role.toLowerCase().includes("back") || role.toLowerCase().includes("goal") ? 76 : 58,
    minutes: 70,
    avatarUrl: toText(player.strCutout || player.strThumb, 400),
    age: ageFromBirthDate(player.dateBorn || player.strBirthDate),
    shirtNumber: shirtNumber !== null && shirtNumber >= 0 && shirtNumber <= 99 ? Math.round(shirtNumber) : null,
    heightCm: parseHeightCm(player.strHeight),
    metricsStatus: "placeholder",
    rosterStatus: player.idPlayer ? "provider" : "placeholder",
    note: "Roster entry refreshed from TheSportsDB; performance metrics require an official statistics provider.",
    source: {
      provider: "TheSportsDB",
      providerPlayerId: toText(player.idPlayer, 40)
    }
  };
}

function normalizeApiFootballPlayer(player, index) {
  const role = toText(player?.position, 60) || "Player";
  const age = finiteNumber(player?.age);
  const shirtNumber = finiteNumber(player?.number);
  return {
    id: toText(player?.id, 40) || `api-football-player-${index + 1}`,
    name: toText(player?.name, 100) || `Player ${index + 1}`,
    role,
    status: "ready",
    form: 0,
    goals: 0,
    assists: 0,
    defense: 0,
    minutes: 0,
    avatarUrl: toText(player?.photo, 400),
    age: age !== null && age >= 14 && age <= 60 ? Math.round(age) : null,
    shirtNumber: shirtNumber !== null && shirtNumber >= 0 && shirtNumber <= 99 ? Math.round(shirtNumber) : null,
    heightCm: null,
    metricsStatus: "placeholder",
    rosterStatus: player?.id ? "provider" : "placeholder",
    note: "Current squad entry from API-Football. Match form, event metrics, height, and availability remain hidden until separately verified.",
    source: {
      provider: "API-Football",
      providerPlayerId: toText(player?.id, 40)
    }
  };
}

function normalizeApiFootballCoach(coach) {
  if (!coach?.id || !coach?.name) return null;
  const age = finiteNumber(coach.age);
  return {
    id: toText(coach.id, 40),
    name: toText(coach.name, 100),
    age: age !== null && age >= 20 && age <= 100 ? Math.round(age) : null,
    nationality: toText(coach.nationality, 80),
    photoUrl: toText(coach.photo, 400),
    source: "API-Football"
  };
}

function placeholderPlayers(teamName) {
  return ["Forward", "Midfielder", "Defensive Midfielder", "Defender", "Goalkeeper"].map((role, index) =>
    normalizePlayer({ strPlayer: `${teamName} ${role}`, strPosition: role }, index)
  );
}

function normalizeTeam(team, players = []) {
  const name = toText(team.strTeam, 100) || "Unknown Team";
  const league = toText(team.strLeague, 100) || "Unknown League";
  const country = toText(team.strCountry, 80) || "Unknown";
  const seed = hash(`${team.idTeam}:${name}:${league}:${country}`);
  const kind = inferKind(name, country, league);
  const normalizedPlayers = players.length ? players : placeholderPlayers(name);

  return {
    id: `daily-${toText(team.idTeam, 40) || seed}`,
    source: team.idTeam?.startsWith("fallback-") ? "Curated Fallback" : "TheSportsDB",
    sourceTeamId: toText(team.idTeam, 40),
    metricsStatus: "placeholder",
    rosterStatus: players.length ? "provider" : "placeholder",
    name,
    kind,
    league,
    country,
    continent: inferContinent(country),
    tier: inferTier(league),
    badge: toText(team.strTeamShort, 8) || initials(name),
    badgeUrl: toText(team.strBadge || team.strLogo, 500),
    fanartUrl: toText(team.strFanart1, 500),
    stadium: toText(team.strStadium, 100),
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
    recent: ["胜", "平", "负", "胜", "胜"],
    players: normalizedPlayers
  };
}

function uniqueTeams(teams) {
  const map = new Map();
  teams.forEach((team) => {
    const key = team.idTeam || `${team.strTeam ?? ""}:${team.strCountry ?? ""}:${team.strLeague ?? ""}`;
    if (key.trim()) map.set(key, team);
  });
  return Array.from(map.values());
}

function isNationalTeamRecord(team) {
  const name = toText(team.strTeam, 100).toLowerCase();
  const country = toText(team.strCountry, 80).toLowerCase();
  const league = toText(team.strLeague, 100);
  return name === country || DEFAULT_NATIONAL_TEAMS.some((teamName) => teamName.toLowerCase() === name) || inferKind(name, country, league) === "national";
}

function isSeniorTeamRecord(team) {
  const label = `${toText(team.strTeam, 100)} ${toText(team.strLeague, 100)}`.toLowerCase();
  return !/\b(?:u[- ]?(?:15|16|17|18|19|20|21|22|23)|under[- ]?(?:15|16|17|18|19|20|21|22|23)|youth|reserve)\b/.test(label);
}

function balancedTeams(teams, maxTeams) {
  const unique = uniqueTeams(teams).filter(
    (team) => (team.strSport === "Soccer" || !team.strSport) && isSeniorTeamRecord(team)
  );
  const nationalTeams = unique.filter(isNationalTeamRecord);
  const clubTeams = unique.filter((team) => !isNationalTeamRecord(team));
  const nationalTarget =
    maxTeams >= 16
      ? Math.min(nationalTeams.length, Math.max(8, Math.floor(maxTeams * 0.25)))
      : Math.min(nationalTeams.length, Math.max(1, Math.floor(maxTeams * 0.25)));
  const clubTarget = Math.max(0, maxTeams - nationalTarget);
  const selectedClubs = clubTeams.slice(0, clubTarget);
  const selectedNationalTeams = nationalTeams.slice(0, maxTeams - selectedClubs.length);
  return uniqueTeams([...selectedClubs, ...selectedNationalTeams]).slice(0, maxTeams);
}

function fallbackTeams(maxTeams) {
  const clubTeams = FALLBACK_CLUB_GROUPS.flatMap((group) =>
    group.teams.map((team) => ({
      idTeam: `fallback-club-${team.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      strTeam: team,
      strSport: "Soccer",
      strLeague: group.league,
      strCountry: group.country
    }))
  );
  const nationalTeams = DEFAULT_NATIONAL_TEAMS.map((team) => ({
    idTeam: `fallback-national-${team.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    strTeam: team,
    strSport: "Soccer",
    strLeague: "FIFA World Cup",
    strCountry: team
  }));

  return balancedTeams([...clubTeams, ...nationalTeams], maxTeams);
}

function prioritizedTeams(providerTeams, maxTeams) {
  const providerByName = new Map();
  providerTeams.forEach((team) => {
    const key = normalizedTeamName(team.strTeam);
    if (!key) return;
    const current = providerByName.get(key);
    if (!current || teamRecordScore(team) > teamRecordScore(current)) {
      providerByName.set(key, team);
    }
  });

  const preferred = fallbackTeams(maxTeams).map((team) => providerByName.get(normalizedTeamName(team.strTeam)) ?? team);
  const preferredNames = new Set(preferred.map((team) => normalizedTeamName(team.strTeam)));
  const remaining = providerTeams.filter((team) => !preferredNames.has(normalizedTeamName(team.strTeam)));
  return balancedTeams([...preferred, ...remaining], maxTeams);
}

async function fetchTeams(apiKey, maxTeams) {
  const isPublicDemo = apiKey === PUBLIC_THESPORTSDB_DEMO_KEY;
  const leagueUrls = DEFAULT_LEAGUES.map((league) => makeUrl(apiKey, "search_all_teams.php", { l: league }));
  const nationalUrls = isPublicDemo
    ? []
    : DEFAULT_NATIONAL_TEAMS.map((team) => makeUrl(apiKey, "searchteams.php", { t: team }));
  const initialSettled = await Promise.allSettled([...leagueUrls, ...nationalUrls].map((url) => fetchJson(url)));
  const initialTeams = initialSettled.flatMap((result) => (result.status === "fulfilled" ? result.value.teams ?? [] : []));
  const initialNames = new Set(initialTeams.map((team) => normalizedTeamName(team.strTeam)));
  const missingPopularClubs = FALLBACK_CLUB_GROUPS.flatMap((group) => group.teams).filter(
    (team) => !initialNames.has(normalizedTeamName(team))
  );
  const publicSearchBudget = Math.max(0, 28 - leagueUrls.length);
  const popularClubSearches = isPublicDemo ? missingPopularClubs.slice(0, publicSearchBudget) : missingPopularClubs;
  const missingSettled = await Promise.allSettled(
    popularClubSearches.map((team) => fetchJson(makeUrl(apiKey, "searchteams.php", { t: team })))
  );
  const recoveredTeams = missingSettled.flatMap((result) => (result.status === "fulfilled" ? result.value.teams ?? [] : []));
  const teams = prioritizedTeams([...initialTeams, ...recoveredTeams], maxTeams);

  if (teams.length) {
    return teams;
  }

  console.warn("[roster-refresh] provider returned no teams; using curated fallback catalog");
  return fallbackTeams(maxTeams);
}

async function fetchPlayers(apiKey, team, maxPlayersPerTeam) {
  if (!team.idTeam || team.idTeam.startsWith("fallback-")) return [];
  const url = makeUrl(apiKey, "lookup_all_players.php", { id: team.idTeam });
  const data = await fetchJson(url);
  const blockedRoles = ["coach", "manager", "president", "chairman", "assistant"];
  return (data.player ?? [])
    .filter((player) => {
      const role = toText(player.strPosition, 60).toLowerCase();
      return !blockedRoles.some((blocked) => role.includes(blocked));
    })
    .slice(0, maxPlayersPerTeam)
    .map((player, index) => normalizePlayer(player, index, maxPlayersPerTeam));
}

async function fetchApiFootballTeamData(config, team, maxPlayersPerTeam) {
  const matches = await fetchApiFootball(config, "teams", { search: team.strTeam });
  const expectedName = normalizedTeamName(team.strTeam);
  const expectedKind = inferKind(team.strTeam, team.strCountry || "", team.strLeague || "");
  const exactMatches = matches.filter((row) => normalizedTeamName(row?.team?.name) === expectedName);
  const matched =
    exactMatches.find((row) => Boolean(row?.team?.national) === (expectedKind === "national"))
    || exactMatches[0];
  const providerTeamId = finiteNumber(matched?.team?.id);
  if (!providerTeamId) return null;

  const [squadResult, coachResult] = await Promise.allSettled([
    fetchApiFootball(config, "players/squads", { team: providerTeamId }),
    fetchApiFootball(config, "coachs", { team: providerTeamId })
  ]);
  const squadRows = squadResult.status === "fulfilled" ? squadResult.value : [];
  const coachRows = coachResult.status === "fulfilled" ? coachResult.value : [];
  const players = (squadRows[0]?.players ?? [])
    .slice(0, maxPlayersPerTeam)
    .map((player, index) => normalizeApiFootballPlayer(player, index));

  if (squadResult.status === "rejected") {
    console.warn(`[roster-refresh] API-Football squad unavailable for ${team.strTeam}: ${squadResult.reason instanceof Error ? squadResult.reason.message : squadResult.reason}`);
  }
  if (coachResult.status === "rejected") {
    console.warn(`[roster-refresh] API-Football coach unavailable for ${team.strTeam}: ${coachResult.reason instanceof Error ? coachResult.reason.message : coachResult.reason}`);
  }

  return {
    providerTeamId: String(providerTeamId),
    badgeUrl: toText(matched?.team?.logo, 500),
    country: toText(matched?.team?.country, 80),
    players,
    coach: normalizeApiFootballCoach(coachRows[0])
  };
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function key(value) {
  return toText(value, 160).toLowerCase();
}

function teamKey(team) {
  return `${key(team.name)}::${team.kind}`;
}

function playerKey(player) {
  return key(player.name);
}

function hasProviderRoster(team) {
  return team?.rosterStatus === "provider"
    && Array.isArray(team.players)
    && team.players.some((player) => player?.rosterStatus === "provider");
}

function snapshotTeamLookup(snapshot) {
  return new Map(
    (snapshot?.teams ?? []).map((team) => [
      `${normalizedTeamName(team.name)}::${team.kind}`,
      team
    ])
  );
}

function previousTeamFor(rawTeam, previousTeams) {
  const name = toText(rawTeam.strTeam, 100);
  const country = toText(rawTeam.strCountry, 80);
  const league = toText(rawTeam.strLeague, 100);
  return previousTeams.get(`${normalizedTeamName(name)}::${inferKind(name, country, league)}`) ?? null;
}

function mergePreviousProviderData(team, previousTeam) {
  if (!previousTeam) return team;
  const merged = {
    ...team,
    providerTeamIds: {
      ...(previousTeam.providerTeamIds ?? {}),
      ...(team.providerTeamIds ?? {})
    },
    coach: team.coach ?? previousTeam.coach ?? null
  };

  if (!hasProviderRoster(merged) && hasProviderRoster(previousTeam)) {
    merged.players = previousTeam.players;
    merged.rosterStatus = "provider";
    merged.rosterUpdatedAt = previousTeam.rosterUpdatedAt ?? previousTeam.generatedAt ?? null;
    merged.source = previousTeam.source || merged.source;
  }
  return merged;
}

function diffSnapshots(previous, current) {
  const previousTeams = new Map((previous?.teams ?? []).map((team) => [teamKey(team), team]));
  const currentTeams = new Map(current.teams.map((team) => [teamKey(team), team]));
  const addedTeams = [];
  const removedTeams = [];
  const metadataChanges = [];
  const rosterChanges = [];

  currentTeams.forEach((team, id) => {
    const oldTeam = previousTeams.get(id);
    if (!oldTeam) {
      addedTeams.push({ name: team.name, kind: team.kind, league: team.league, country: team.country });
      return;
    }

    const metadata = {};
    ["league", "country", "badgeUrl", "stadium"].forEach((field) => {
      if ((oldTeam[field] ?? "") !== (team[field] ?? "")) {
        metadata[field] = { before: oldTeam[field] ?? "", after: team[field] ?? "" };
      }
    });
    if (Object.keys(metadata).length) {
      metadataChanges.push({ team: team.name, kind: team.kind, changes: metadata });
    }

    const oldPlayers = new Map((oldTeam.players ?? []).map((player) => [playerKey(player), player]));
    const newPlayers = new Map((team.players ?? []).map((player) => [playerKey(player), player]));
    const addedPlayers = [];
    const removedPlayers = [];
    const changedPlayers = [];

    newPlayers.forEach((player, playerId) => {
      const oldPlayer = oldPlayers.get(playerId);
      if (!oldPlayer) {
        addedPlayers.push({ name: player.name, role: player.role });
      } else if ((oldPlayer.role ?? "") !== (player.role ?? "") || (oldPlayer.avatarUrl ?? "") !== (player.avatarUrl ?? "")) {
        changedPlayers.push({
          name: player.name,
          before: { role: oldPlayer.role ?? "", avatarUrl: oldPlayer.avatarUrl ?? "" },
          after: { role: player.role ?? "", avatarUrl: player.avatarUrl ?? "" }
        });
      }
    });

    oldPlayers.forEach((player, playerId) => {
      if (!newPlayers.has(playerId)) {
        removedPlayers.push({ name: player.name, role: player.role });
      }
    });

    if (addedPlayers.length || removedPlayers.length || changedPlayers.length) {
      rosterChanges.push({ team: team.name, kind: team.kind, addedPlayers, removedPlayers, changedPlayers });
    }
  });

  previousTeams.forEach((team, id) => {
    if (!currentTeams.has(id)) {
      removedTeams.push({ name: team.name, kind: team.kind, league: team.league, country: team.country });
    }
  });

  return {
    previousGeneratedAt: previous?.generatedAt ?? null,
    addedTeams,
    removedTeams,
    metadataChanges,
    rosterChanges,
    totals: {
      addedTeams: addedTeams.length,
      removedTeams: removedTeams.length,
      metadataChanges: metadataChanges.length,
      teamsWithRosterChanges: rosterChanges.length,
      addedPlayers: rosterChanges.reduce((total, item) => total + item.addedPlayers.length, 0),
      removedPlayers: rosterChanges.reduce((total, item) => total + item.removedPlayers.length, 0),
      changedPlayers: rosterChanges.reduce((total, item) => total + item.changedPlayers.length, 0)
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.THESPORTSDB_API_KEY?.trim() || PUBLIC_THESPORTSDB_DEMO_KEY;
  const apiKeyMode = apiKey === PUBLIC_THESPORTSDB_DEMO_KEY ? "public-demo" : "server-env";
  const apiFootball = getApiFootballConfig();
  const beijing = beijingDateParts();
  const startedAt = new Date().toISOString();

  console.log(`[roster-refresh] start ${startedAt}`);
  console.log(`[roster-refresh] provider TheSportsDB (${apiKeyMode})`);
  console.log(`[roster-refresh] API-Football ${apiFootball ? `${apiFootball.authMode}, limit=${args.apiFootballTeamLimit}` : "not configured"}`);
  console.log("[roster-refresh] storage cloud-only");

  const previous = await readPreviousCloudSnapshot();
  const previousTeams = snapshotTeamLookup(previous);
  const rawTeams = await fetchTeams(apiKey, args.maxTeams);
  const playerLookupLimit = apiKeyMode === "public-demo" ? 0 : Math.min(40, rawTeams.length);
  const missingRosterIndices = rawTeams
    .map((team, index) => ({ index, previousTeam: previousTeamFor(team, previousTeams) }))
    .filter(({ previousTeam }) => !hasProviderRoster(previousTeam))
    .map(({ index }) => index);
  const coveredRosterCount = rawTeams.length - missingRosterIndices.length;
  const orderedMissingIndices = missingRosterIndices.length
    ? Array.from(
        { length: missingRosterIndices.length },
        (_, offset) => missingRosterIndices[(coveredRosterCount + offset) % missingRosterIndices.length]
      )
    : [];
  const refreshFallbackStart = hash(beijing.date) % Math.max(1, rawTeams.length);
  const refreshFallbackIndices = Array.from(
    { length: rawTeams.length },
    (_, offset) => (refreshFallbackStart + offset) % rawTeams.length
  );
  const apiFootballTargets = new Set(
    [...orderedMissingIndices, ...refreshFallbackIndices]
      .filter((index, position, values) => values.indexOf(index) === position)
      .slice(0, apiFootball ? args.apiFootballTeamLimit : 0)
  );

  const teams = await mapConcurrent(rawTeams, args.concurrency, async (team, index) => {
    const previousTeam = previousTeamFor(team, previousTeams);
    try {
      const players = index < playerLookupLimit ? await fetchPlayers(apiKey, team, args.maxPlayersPerTeam) : [];
      let normalized = normalizeTeam(team, players);
      if (!players.length && apiFootball && apiFootballTargets.has(index)) {
        try {
          const providerData = await fetchApiFootballTeamData(apiFootball, team, args.maxPlayersPerTeam);
          if (providerData) {
            normalized = {
              ...normalized,
              source: normalized.source === "TheSportsDB" ? "TheSportsDB + API-Football" : "API-Football + Curated Catalog",
              badgeUrl: normalized.badgeUrl || providerData.badgeUrl,
              rosterStatus: providerData.players.length ? "provider" : normalized.rosterStatus,
              players: providerData.players.length ? providerData.players : normalized.players,
              coach: providerData.coach,
              providerTeamIds: {
                apiFootball: providerData.providerTeamId
              },
              rosterUpdatedAt: providerData.players.length ? new Date().toISOString() : null
            };
          }
        } catch (error) {
          console.warn(`[roster-refresh] API-Football enrichment failed for ${team.strTeam ?? team.idTeam}: ${error instanceof Error ? error.message : error}`);
        }
      }
      return mergePreviousProviderData(normalized, previousTeam);
    } catch (error) {
      console.warn(`[roster-refresh] player fetch failed for ${team.strTeam ?? team.idTeam}: ${error instanceof Error ? error.message : error}`);
      return mergePreviousProviderData(normalizeTeam(team, []), previousTeam);
    }
  });

  const apiFootballRosterCount = teams.filter((team) =>
    team.players.some((player) => player?.source?.provider === "API-Football")
  ).length;
  const providerRosterCount = teams.filter(hasProviderRoster).length;
  const providerPlayerCount = teams.reduce(
    (total, team) => total + team.players.filter((player) => player.rosterStatus === "provider").length,
    0
  );
  const snapshot = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    beijingDate: beijing.date,
    beijingTime: beijing.isoLike,
    provider: {
      name: apiFootballRosterCount ? "TheSportsDB + API-Football" : "TheSportsDB",
      apiKeyMode,
      rosterAuthMode: apiFootball?.authMode ?? "not-configured",
      apiFootballTeamLimit: args.apiFootballTeamLimit
    },
    totals: {
      teams: teams.length,
      clubs: teams.filter((team) => team.kind === "club").length,
      nationalTeams: teams.filter((team) => team.kind === "national").length,
      players: teams.reduce((total, team) => total + team.players.length, 0),
      providerRosters: providerRosterCount,
      providerPlayers: providerPlayerCount
    },
    teams
  };

  const changes = {
    schemaVersion: 1,
    generatedAt: snapshot.generatedAt,
    beijingDate: beijing.date,
    ...diffSnapshots(previous, snapshot)
  };

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          snapshot: snapshot.totals,
          coverage: {
            badges: snapshot.teams.filter((team) => Boolean(team.badgeUrl)).length,
            providerRosters: providerRosterCount,
            apiFootballRosters: apiFootballRosterCount,
            providerPlayers: providerPlayerCount,
            featuredTeams: ["Manchester City", "Real Madrid"].map((name) => {
              const team = snapshot.teams.find((item) => normalizedTeamName(item.name) === normalizedTeamName(name));
              return { name, present: Boolean(team), badge: Boolean(team?.badgeUrl) };
            })
          },
          changes: changes.totals
        },
        null,
        2
      )
    );
    return;
  }

  await writeCloudCache(snapshot, changes, true);

  console.log(`[roster-refresh] teams=${snapshot.totals.teams} players=${snapshot.totals.players}`);
  console.log(`[roster-refresh] badges=${snapshot.teams.filter((team) => Boolean(team.badgeUrl)).length}`);
  console.log(`[roster-refresh] provider-rosters=${providerRosterCount}`);
  console.log(`[roster-refresh] api-football-rosters=${apiFootballRosterCount}`);
  console.log(`[roster-refresh] provider-players=${providerPlayerCount}`);
  console.log(`[roster-refresh] roster-change-teams=${changes.totals.teamsWithRosterChanges}`);
  console.log(`[roster-refresh] done ${snapshot.generatedAt}`);
}

main().catch((error) => {
  console.error(`[roster-refresh] failed: ${error instanceof Error ? error.stack || error.message : error}`);
  process.exitCode = 1;
});
