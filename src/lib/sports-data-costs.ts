export type SportsDataProvider = "sportmonks" | "api-football" | "football-data-org" | "anysport";

const providerCostVariables: Record<SportsDataProvider, string> = {
  "api-football": "API_FOOTBALL_MATCH_REFRESH_COST_CENTS",
  sportmonks: "SPORTMONKS_MATCH_REFRESH_COST_CENTS",
  "football-data-org": "FOOTBALL_DATA_MATCH_REFRESH_COST_CENTS",
  anysport: "ANYSPORT_MATCH_REFRESH_COST_CENTS"
};

function configuredCost(name: string) {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function getSportsDataPricing(providers: SportsDataProvider[]) {
  const uniqueProviders = [...new Set(providers)];
  const costs = uniqueProviders.map((provider) => {
    const variable = providerCostVariables[provider];
    return { provider, variable, costCents: configuredCost(variable) };
  });
  const missingVariables = costs.filter((entry) => entry.costCents === null).map((entry) => entry.variable);
  return {
    configured: missingVariables.length === 0,
    totalCostCents: costs.reduce((total, entry) => total + (entry.costCents ?? 0), 0),
    costs,
    missingVariables
  };
}
