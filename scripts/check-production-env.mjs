const required = [
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CRON_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN"
];

const requiredAlternatives = [
  {
    label: "SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY",
    names: ["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"]
  },
  {
    label: "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
    names: ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
  }
];

const providers = [
  (process.env.API_FOOTBALL_KEY?.trim() || process.env.RAPIDAPI_FOOTBALL_KEY?.trim()) ? "api-football" : "",
  process.env.SPORTMONKS_API_KEY?.trim() ? "sportmonks" : "",
  process.env.FOOTBALL_DATA_API_KEY?.trim() ? "football-data-org" : "",
  process.env.ANYSPORT_API_KEY?.trim() ? "anysport" : ""
].filter(Boolean);
const missing = [
  ...required.filter((name) => !process.env[name]?.trim()),
  ...requiredAlternatives
    .filter(({ names }) => !names.some((name) => process.env[name]?.trim()))
    .map(({ label }) => label)
];
const issues = [];
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim() || "";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const isLegacyJwt = (value) => value.startsWith("eyJ") && value.split(".").length === 3;
if (isLegacyJwt(supabasePublishableKey) || isLegacyJwt(supabaseSecretKey)) {
  issues.push("legacy Supabase JWT API keys are not accepted for production; use sb_publishable_ and sb_secret_ keys");
}
const requestedAiProvider = (process.env.AI_PROVIDER?.trim() || "auto").toLowerCase();
if (!["auto", "openai", "hunyuan"].includes(requestedAiProvider)) issues.push("AI_PROVIDER must be auto, openai, or hunyuan");
const activeAiProvider = requestedAiProvider === "hunyuan"
  ? (process.env.HUNYUAN_API_KEY?.trim() ? "hunyuan" : null)
  : requestedAiProvider === "openai"
    ? (process.env.OPENAI_API_KEY?.trim() ? "openai" : null)
    : process.env.HUNYUAN_API_KEY?.trim()
      ? "hunyuan"
      : process.env.OPENAI_API_KEY?.trim()
        ? "openai"
        : null;
if (!activeAiProvider) missing.push(requestedAiProvider === "hunyuan" ? "HUNYUAN_API_KEY" : requestedAiProvider === "openai" ? "OPENAI_API_KEY" : "HUNYUAN_API_KEY or OPENAI_API_KEY");
if (activeAiProvider) {
  const prefix = activeAiProvider === "hunyuan" ? "HUNYUAN" : "OPENAI";
  const inputRate = Number(process.env[`${prefix}_INPUT_CENTS_PER_MILLION`]);
  const outputRate = Number(process.env[`${prefix}_OUTPUT_CENTS_PER_MILLION`]);
  if (!Number.isFinite(inputRate) || inputRate <= 0 || !Number.isFinite(outputRate) || outputRate <= 0) {
    issues.push(`${prefix} input and output prices must be positive CNY cents per million tokens`);
  }
}
if (process.env.PROVIDER_MODE !== "live") issues.push("PROVIDER_MODE must be live");
if (process.env.LIVE_COSTS_ENABLED !== "true") issues.push("LIVE_COSTS_ENABLED must be true");
if (providers.length < 2) issues.push("at least two structured match providers are required for injury cross-checking");
if (process.env.NEXT_PUBLIC_APP_URL && !/^https:\/\//i.test(process.env.NEXT_PUBLIC_APP_URL)) issues.push("NEXT_PUBLIC_APP_URL must use HTTPS in production");

if (missing.length || issues.length) {
  console.error(JSON.stringify({ ok: false, missing, issues, activeAiProvider, configuredProviderCount: providers.length }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, activeAiProvider, configuredProviderCount: providers.length, message: "Production environment gate passed. Secret values were not printed." }, null, 2));
