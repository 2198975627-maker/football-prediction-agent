import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const script = fs.readFileSync(new URL("../scripts/check-ai-provider.mjs", import.meta.url), "utf8");
const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("AI connection checks authenticate before an opt-in inference", () => {
  assert.match(script, /process\.argv\.includes\("--inference"\)/);
  assert.match(script, /AbortSignal\.timeout\(12_000\)/);
  assert.match(script, /No inference tokens used/);
  assert.match(script, /response_format/);
  assert.match(script, /DEEPSEEK_API_KEY/);
  assert.match(script, /deepseek-v4-pro/);
  assert.match(script, /type: "json_object"/);
  assert.match(script, /store: false/);
  assert.equal(packageJson.scripts["ai:check"].includes("--inference"), false);
  assert.equal(packageJson.scripts["ai:smoke"].includes("--inference"), true);
});

test("AI connection checks never print credentials or full model output", () => {
  assert.doesNotMatch(script, /console\.(?:log|error)\([^\n]*(?:apiKey|content|output_text)/);
  assert.doesNotMatch(script, /JSON\.stringify\(payload\)/);
});
