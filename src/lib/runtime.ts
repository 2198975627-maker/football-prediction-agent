import { getAiProviderStatus } from "./ai-provider";

export type ProviderMode = "mock" | "live";

export const PUBLIC_THESPORTSDB_DEMO_KEY = "123";

function readText(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function readBoolean(name: string, fallback = false) {
  const value = readText(name).toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

function readNumber(name: string, fallback: number, min: number, max: number) {
  const raw = readText(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function readProviderMode(): ProviderMode {
  return readText("PROVIDER_MODE") === "live" ? "live" : "mock";
}

export function getSportsDbApiKey() {
  return readText("THESPORTSDB_API_KEY", PUBLIC_THESPORTSDB_DEMO_KEY);
}

export function getSportsDbApiKeyMode() {
  return getSportsDbApiKey() === PUBLIC_THESPORTSDB_DEMO_KEY ? "public-demo" : "server-env";
}

export function getRuntimeConfig() {
  const appEnv = readText("APP_ENV", process.env.NODE_ENV || "development");
  const providerMode = readProviderMode();
  const liveCostsEnabled = readBoolean("LIVE_COSTS_ENABLED", false);
  const billingMarkupMultiplier = readNumber("BILLING_MARKUP_MULTIPLIER", 2, 1, 20);
  const minimumChargeCents = Math.round(readNumber("MIN_CHARGE_CENTS", 100, 0, 100_000));
  const sportsDbApiKeyMode = getSportsDbApiKeyMode();
  const ai = getAiProviderStatus();

  const productionWarnings: string[] = [];
  if (appEnv === "production" && sportsDbApiKeyMode === "public-demo") {
    productionWarnings.push("THESPORTSDB_API_KEY is not configured; using the public demo key.");
  }
  if (appEnv === "production" && providerMode === "live" && !ai.configured) {
    productionWarnings.push("PROVIDER_MODE=live but no selected AI provider is configured.");
  }
  if (appEnv === "production" && liveCostsEnabled && !ai.pricingConfigured) {
    productionWarnings.push("LIVE_COSTS_ENABLED=true but the selected AI provider pricing is not configured.");
  }
  if (appEnv === "production" && liveCostsEnabled && !readText("STRIPE_SECRET_KEY")) {
    productionWarnings.push("LIVE_COSTS_ENABLED=true but STRIPE_SECRET_KEY is not configured.");
  }

  return {
    appEnv,
    nodeEnv: process.env.NODE_ENV || "development",
    providerMode,
    liveCostsEnabled,
    billingMarkupMultiplier,
    minimumChargeCents,
    currency: readText("STRIPE_PRICE_CURRENCY", "cny").toUpperCase(),
    sportsDbApiKeyMode,
    productionWarnings
  };
}
