import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitHeaders } from "@/src/lib/rate-limit";
import {
  getOfficialCoverageSummary,
  getOfficialSportsProviderStatuses,
  getSportsAnalysisToolStatuses,
  officialFusionPlan
} from "@/src/lib/sports-data-sources";

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { keyPrefix: "sports-data-sources", limit: 60, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  const providerStatuses = getOfficialSportsProviderStatuses();
  const providers = providerStatuses.map(({ requiredEnvKeys, missingEnvKeys, ...provider }) => ({
    ...provider,
    requiredCredentialCount: requiredEnvKeys.length,
    missingCredentialCount: missingEnvKeys.length
  }));
  const analysisTools = getSportsAnalysisToolStatuses();
  const configuredProviders = providers.filter((provider) => provider.configured);
  const runnableProviders = providers.filter((provider) => provider.runtimeStatus === "ready" || provider.runtimeStatus === "open-data-ready");
  const enabledTools = analysisTools.filter((tool) => tool.configured);

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    strategy: "official-multi-source-fusion",
    providers,
    analysisTools,
    configuredProviderCount: configuredProviders.length,
    runnableProviderCount: runnableProviders.length,
    enabledToolCount: enabledTools.length,
    fusionPlan: officialFusionPlan,
    coverage: getOfficialCoverageSummary(providerStatuses),
    warnings: [
      "Provider keys are checked only on the server and are never returned.",
      "Social posts and forum content are reference material only, not primary match data.",
      "Real-time production coverage depends on each provider plan and licensed competitions."
    ]
  });
}
