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
  const costs = await source("src/lib/ai-costs.ts");
  const route = await source("app/api/predict/route.ts");
  const health = await source("app/api/health/route.ts");
  assert.match(provider, /isAiPricingConfigured/);
  assert.match(route, /Platform AI pricing|平台 AI 价格/);
  assert.match(route, /calculateAiModelCost\(generated\.aiProvider/);
  assert.match(costs, /CACHED_INPUT_CENTS_PER_MILLION/);
  assert.match(health, /aiPricingConfigured/);
});

test("BYOK remains an explicit OpenAI-only request path", async () => {
  const route = await source("app/api/predict/route.ts");
  assert.match(route, /x-openai-api-key/);
  assert.match(route, /provider: "openai"/);
});

test("real AI usage is recorded without prompts, keys, or full responses", async () => {
  const route = await source("app/api/predict/route.ts");
  const costs = await source("src/lib/ai-costs.ts");
  const sql = await source("docs/supabase-production.sql");
  assert.match(route, /recordAiUsage/);
  assert.match(route, /updateAiUsageCharge/);
  assert.match(route, /safetyIdentifier/);
  assert.match(costs, /football_ai_usage/);
  assert.match(costs, /input_tokens/);
  assert.match(costs, /model_cost_cents/);
  assert.doesNotMatch(costs, /prompt\s*:/i);
  assert.doesNotMatch(sql, /api_key|prompt_text|response_text/i);
  assert.ok(route.indexOf("settleOrder(") < route.indexOf("updateAiUsageCharge("));
});

test("OpenAI production analysis uses the balanced GPT-5.6 family role", async () => {
  const provider = await source("src/lib/ai-provider.ts");
  const prediction = await source("src/lib/openai-prediction.ts");
  assert.match(provider, /gpt-5\.6-terra/);
  assert.match(prediction, /gpt-5\.6-terra/);
  assert.match(prediction, /responses\.create/);
  assert.match(prediction, /store: false/);
  assert.match(prediction, /safety_identifier/);
});
