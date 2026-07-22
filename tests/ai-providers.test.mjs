import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("TokenHub credentials remain server-only and use the mainland endpoint", async () => {
  const provider = await source("src/lib/ai-provider.ts");
  const gates = await source("config/security-gates.json");
  assert.match(provider, /https:\/\/tokenhub\.tencentmaas\.com\/v1/);
  assert.match(provider, /HUNYUAN_API_KEY/);
  assert.match(provider, /model: env\("HUNYUAN_MODEL", "hy3"\)/);
  assert.match(gates, /"HUNYUAN_API_KEY"/);
  assert.match(gates, /"NEXT_PUBLIC_HUNYUAN"/);
});

test("paid AI traffic requires provider-specific positive prices", async () => {
  const provider = await source("src/lib/ai-provider.ts");
  const route = await source("app/api/predict/route.ts");
  const health = await source("app/api/health/route.ts");
  assert.match(provider, /isAiPricingConfigured/);
  assert.match(route, /Platform AI pricing|平台 AI 价格/);
  assert.match(route, /modelCostCents\(generated\.aiProvider/);
  assert.match(health, /aiPricingConfigured/);
});

test("BYOK remains an explicit OpenAI-only request path", async () => {
  const route = await source("app/api/predict/route.ts");
  assert.match(route, /x-openai-api-key/);
  assert.match(route, /provider: "openai"/);
});
