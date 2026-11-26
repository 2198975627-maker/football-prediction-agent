export type FixtureProviderId =
  | "anysport"
  | "api-football"
  | "football-data-org"
  | "thesportsdb"
  | "openligadb"
  | "mock-offline";

export type ScheduledTeam = {
  id: number;
  name: string;
  shortCode: string;
  badgeUrl: string;
};

export type ScheduledFixture = {
  id: string;
  provider: FixtureProviderId;
  startsAt: string;
  status: string;
  competition: string;
  country: string;
  round: string;
  venue: string;
  dataMode?: "live" | "mock";
  home: ScheduledTeam;
  away: ScheduledTeam;
};

export type FixtureSchedule = {
  ok: true;
  date: string;
  dateTo?: string;
  timezone: "Asia/Shanghai";
  fetchedAt: string;
  cached: boolean;
  dataMode?: "live" | "mock";
  fallbackReason?: string;
  providers: FixtureProviderId[];
  attemptedProviders: FixtureProviderId[];
  providerErrors: Array<{ provider: FixtureProviderId; code: string }>;
  fixtures: ScheduledFixture[];
};
