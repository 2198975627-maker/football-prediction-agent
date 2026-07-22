import { NextResponse } from "next/server";
import { getRuntimeConfig } from "@/src/lib/runtime";
import { checkRateLimit, rateLimitHeaders } from "@/src/lib/rate-limit";
import { isAuthConfigured } from "@/src/lib/supabase-auth";
import { isPaymentConfigured } from "@/src/lib/payments";
import { configuredMatchProviders } from "@/src/lib/providers/match-intelligence";
import { getPlayerEventProviderStatuses } from "@/src/lib/providers/player-events";
import { getApiFootballAuthMode } from "@/src/lib/providers/api-football";
import { getAiProviderStatus } from "@/src/lib/ai-provider";

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { keyPrefix: "health", limit: 120, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  const config = getRuntimeConfig();
  const matchProviders = configuredMatchProviders();
  const ai = getAiProviderStatus();
  const aiConfigured = ai.configured;
  const authConfigured = isAuthConfigured();
  const paymentConfigured = isPaymentConfigured();
  const playerEventProviders = getPlayerEventProviderStatuses();

  return NextResponse.json({
    ok: true,
    appEnv: config.appEnv,
    nodeEnv: config.nodeEnv,
    providerMode: config.providerMode,
    liveCostsEnabled: config.liveCostsEnabled,
    billingMarkupMultiplier: config.billingMarkupMultiplier,
    minimumChargeCents: config.minimumChargeCents,
    sportsData: {
      theSportsDb: {
        apiKeyMode: config.sportsDbApiKeyMode
      },
      apiFootballAuthMode: getApiFootballAuthMode(),
      configuredMatchProviderCount: matchProviders.length,
      configuredMatchProviders: matchProviders,
      mainland: {
        anySport: Boolean(process.env.ANYSPORT_API_KEY?.trim()),
        anySportLineups: process.env.ANYSPORT_LINEUPS_ENABLED === "true",
        namiCredentials: Boolean(process.env.NAMI_SPORTS_USER?.trim() && process.env.NAMI_SPORTS_SECRET?.trim()),
        juheCredentials: Boolean(process.env.JUHE_FOOTBALL_API_KEY?.trim()),
        feijingCredentials: Boolean(process.env.FEIJING_SPORTS_API_KEY?.trim()),
        apiBallsCredentials: Boolean(process.env.APIBALLS_API_KEY?.trim())
      }
    },
    playerEvents: {
      freeReady: playerEventProviders.filter((provider) => provider.executable && provider.costTier !== "paid" && provider.costTier !== "contract").map((provider) => provider.id),
      liveReady: playerEventProviders.filter((provider) => provider.executable && provider.live).map((provider) => provider.id),
      commercialUpgradeReady: playerEventProviders.filter((provider) => provider.coverageTier === "commercial-live-events").map((provider) => ({
        id: provider.id,
        status: provider.runtimeStatus
      }))
    },
    readiness: { aiConfigured, aiProvider: ai.activeProvider, aiModel: ai.model, aiPricingConfigured: ai.pricingConfigured, authConfigured, paymentConfigured },
    productionWarningCount: config.productionWarnings.length,
    paidTrafficReady: config.providerMode === "live" && config.liveCostsEnabled && aiConfigured && ai.pricingConfigured && authConfigured && paymentConfigured && matchProviders.length >= 2,
    timestamp: new Date().toISOString()
  });
}
