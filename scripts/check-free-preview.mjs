const issues = [];
const warnings = [];

const providerMode = (process.env.PROVIDER_MODE || "mock").trim().toLowerCase();
const liveCostsEnabled = process.env.LIVE_COSTS_ENABLED === "true";

if (providerMode !== "mock") {
  issues.push("PROVIDER_MODE must remain mock for the free public preview");
}
if (liveCostsEnabled) {
  issues.push("LIVE_COSTS_ENABLED must remain false for the free public preview");
}
if (process.env.NEXT_PUBLIC_APP_URL && !/^https:\/\//i.test(process.env.NEXT_PUBLIC_APP_URL)) {
  warnings.push("NEXT_PUBLIC_APP_URL should use HTTPS after cloud deployment");
}

const publicSecretNames = Object.keys(process.env).filter((name) =>
  name.startsWith("NEXT_PUBLIC_") && /(SECRET|TOKEN|API_KEY|PRIVATE_KEY)/i.test(name)
);
if (publicSecretNames.length) {
  issues.push(`secret-like environment names must not be public: ${publicSecretNames.join(", ")}`);
}

const configuredOptionalProviders = [
  process.env.FOOTBALL_DATA_API_KEY?.trim() ? "football-data-org" : "",
  process.env.API_FOOTBALL_KEY?.trim() || process.env.RAPIDAPI_FOOTBALL_KEY?.trim() ? "api-football" : "",
  process.env.ANYSPORT_API_KEY?.trim() ? "anysport" : ""
].filter(Boolean);

if (!configuredOptionalProviders.length) {
  warnings.push("using no-key fixture discovery only; results are intentionally partial");
}
if (!process.env.UPSTASH_REDIS_REST_URL?.trim() || !process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
  warnings.push("distributed rate limiting is not configured; local limits reset per server instance");
}

const result = {
  ok: issues.length === 0,
  mode: "free-public-preview",
  builtInFixtureProviders: ["thesportsdb", "openligadb"],
  configuredOptionalProviders,
  issues,
  warnings
};

console.log(JSON.stringify(result, null, 2));
if (issues.length) process.exit(1);
