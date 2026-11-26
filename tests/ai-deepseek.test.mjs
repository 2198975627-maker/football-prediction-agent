import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("DeepSeek provider is wired through Chat Completions, not Responses API", async () => {
  const provider = await source("src/lib/ai-provider.ts");
  assert.match(provider, /"deepseek"/);
  assert.match(provider, /DEEPSEEK_API_KEY/);
  assert.match(provider, /model: env\("DEEPSEEK_MODEL", "deepseek-v4-pro"\)/);
  assert.match(provider, /https:\/\/api\.deepseek\.com\/v1/);
  assert.match(provider, /runDeepseekPrediction/);
  assert.match(provider, /client\.chat\.completions\.create/);
  assert.match(provider, /aiProvider: "deepseek" as const/);
  assert.match(provider, /"deepseek"/);
});

test("DeepSeek pricing uses its own DEEPSEEK_ rate variables", async () => {
  const costs = await source("src/lib/ai-costs.ts");
  const envExample = await source(".env.example");
  assert.match(costs, /provider === "deepseek" \? "DEEPSEEK"/);
  assert.match(envExample, /DEEPSEEK_INPUT_CENTS_PER_MILLION=/);
  assert.match(envExample, /DEEPSEEK_CACHED_INPUT_CENTS_PER_MILLION=/);
  assert.match(envExample, /DEEPSEEK_OUTPUT_CENTS_PER_MILLION=/);
});

test("DeepSeek key stays server-only like the other provider keys", async () => {
  const provider = await source("src/lib/ai-provider.ts");
  const gates = await source("config/security-gates.json");
  assert.match(provider, /DEEPSEEK_API_KEY/);
  assert.match(gates, /"DEEPSEEK_API_KEY"/);
  assert.match(gates, /"NEXT_PUBLIC_DEEPSEEK"/);
  assert.doesNotMatch(provider, /NEXT_PUBLIC_DEEPSEEK_API_KEY/);
});
