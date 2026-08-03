type TeamIdentity = {
  id: number;
  name: string;
  shortCode: string;
};

type MatchIdentity = {
  startsAt: string;
  homeTeam: string;
  awayTeam: string;
};

export function normalizeFootballIdentity(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

export function canonicalTeamIdentity(
  sourceTeams: TeamIdentity[],
  teamId: number,
  canonicalTeams: TeamIdentity[]
) {
  const sourceTeam = sourceTeams.find((team) => team.id === teamId);
  if (!sourceTeam) return teamId;
  const sourceNames = new Set([
    normalizeFootballIdentity(sourceTeam.name),
    normalizeFootballIdentity(sourceTeam.shortCode)
  ].filter(Boolean));
  const canonical = canonicalTeams.find((team) =>
    sourceNames.has(normalizeFootballIdentity(team.name))
    || sourceNames.has(normalizeFootballIdentity(team.shortCode))
  );
  return canonical?.id ?? teamId;
}

export function canonicalMatchIdentity(entry: MatchIdentity) {
  const day = Number.isFinite(new Date(entry.startsAt).getTime()) ? entry.startsAt.slice(0, 10) : "unknown-date";
  return [
    day,
    normalizeFootballIdentity(entry.homeTeam),
    normalizeFootballIdentity(entry.awayTeam)
  ].join(":");
}
