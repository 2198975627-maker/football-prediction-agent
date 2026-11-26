import OpenAI from "openai";

const inferenceEnabled = process.argv.includes("--inference");
const requested = (process.env.AI_PROVIDER || "auto").trim().toLowerCase();
const deepSeekKey = process.env.DEEPSEEK_API_KEY?.trim() || "";
const hunyuanKey = process.env.HUNYUAN_API_KEY?.trim() || "";
const openAiKey = process.env.OPENAI_API_KEY?.trim() || "";

function selectedProvider() {
  if ((requested === "hunyuan" || requested === "auto") && hunyuanKey) {
    return {
      id: "hunyuan",
      apiKey: hunyuanKey,
      baseURL: process.env.HUNYUAN_BASE_URL?.trim() || "https://tokenhub.tencentmaas.com/v1",
      model: process.env.HUNYUAN_MODEL?.trim() || "hy3"
    };
  }
  if ((requested === "deepseek" || requested === "auto") && deepSeekKey) {
    return {
      id: "deepseek",
      apiKey: deepSeekKey,
      baseURL: process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com/v1",
      model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-pro"
    };
  }
  if ((requested === "openai" || requested === "auto") && openAiKey) {
    return {
      id: "openai",
      apiKey: openAiKey,
      baseURL: "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL?.trim() || "gpt-5.6-terra"
    };
  }
  return null;
}

function endpoint(baseURL, path) {
  const url = new URL(baseURL.endsWith("/") ? baseURL : `${baseURL}/`);
  if (url.protocol !== "https:") throw new Error("AI base URL must use HTTPS.");
  return new URL(path.replace(/^\//, ""), url).toString();
}

function safeProviderError(error) {
  if (error instanceof OpenAI.APIError) return `HTTP ${error.status ?? "unknown"} ${error.code ?? error.type ?? "provider_error"}`;
  if (error instanceof Error) return error.message.slice(0, 180);
  return "Unknown provider error";
}

async function checkModels(config) {
  const response = await fetch(endpoint(config.baseURL, "models"), {
    headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`Model-list authentication failed with HTTP ${response.status}.`);
  const payload = await response.json();
  const models = Array.isArray(payload?.data) ? payload.data : [];
  if (!models.some((item) => item?.id === config.model)) {
    throw new Error(`Configured model ${config.model} is not available to this key.`);
  }
}

async function smokeInference(config) {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.id === "openai" ? undefined : config.baseURL });
  if (config.id !== "openai") {
    const responseFormat = config.id === "deepseek"
      ? { type: "json_object" }
      : {
          type: "json_schema",
          json_schema: {
            name: "ai_connection_check",
            strict: true,
            schema: {
              type: "object",
              properties: { ready: { type: "boolean" } },
              required: ["ready"],
              additionalProperties: false
            }
          }
        };
    const completion = await client.chat.completions.create({
      model: config.model,
      max_tokens: 96,
      messages: [
        { role: "system", content: "Return only one JSON object matching this example: {\"ready\":true}." },
        { role: "user", content: "Confirm in JSON that the football analysis AI connection is ready." }
      ],
      response_format: responseFormat
    });
    const content = completion.choices[0]?.message?.content;
    const parsed = content ? JSON.parse(content) : null;
    if (parsed?.ready !== true) throw new Error("Structured-output smoke check did not return ready=true.");
    return completion.usage?.total_tokens ?? null;
  }

  const response = await client.responses.create({
    model: config.model,
    store: false,
    max_output_tokens: 96,
    input: "Confirm that the football analysis AI connection is ready.",
    text: {
      format: {
        type: "json_schema",
        name: "ai_connection_check",
        strict: true,
        schema: {
          type: "object",
          properties: { ready: { type: "boolean" } },
          required: ["ready"],
          additionalProperties: false
        }
      }
    }
  });
  const parsed = JSON.parse(response.output_text);
  if (parsed?.ready !== true) throw new Error("Structured-output smoke check did not return ready=true.");
  return response.usage?.total_tokens ?? null;
}

const config = selectedProvider();
if (!config) {
  const requiredKey = requested === "openai"
    ? "OPENAI_API_KEY"
    : requested === "hunyuan"
      ? "HUNYUAN_API_KEY"
      : requested === "deepseek"
        ? "DEEPSEEK_API_KEY"
        : "DEEPSEEK_API_KEY, HUNYUAN_API_KEY, or OPENAI_API_KEY";
  console.error(`AI connection not configured: ${requiredKey} is missing.`);
  process.exitCode = 1;
} else {
  try {
    await checkModels(config);
    console.log(`AI authentication OK: provider=${config.id}, model=${config.model}. No inference tokens used.`);
    if (inferenceEnabled) {
      const totalTokens = await smokeInference(config);
      console.log(`Structured-output inference OK: provider=${config.id}, model=${config.model}, totalTokens=${totalTokens ?? "unreported"}.`);
    }
  } catch (error) {
    console.error(`AI connection check failed: ${safeProviderError(error)}`);
    process.exitCode = 1;
  }
}
