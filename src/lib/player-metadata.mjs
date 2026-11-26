const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php";
const WIKIDATA_ENTITY_PATTERN = /^Q\d{1,18}$/;
const MAX_WIKIDATA_ENTITIES = 50;
const METRE_UNIT = "Q11573";
const CENTIMETRE_UNIT = "Q174728";
const FOOT_UNIT = "Q3710";
const INCH_UNIT = "Q218593";

function finiteNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function boundedHeight(value) {
  return Number.isFinite(value) && value >= 140 && value <= 230 ? Math.round(value) : null;
}

export function normalizeHeightCm(value) {
  if (typeof value === "number") {
    return boundedHeight(value < 3 ? value * 100 : value);
  }

  const text = String(value ?? "").trim().toLowerCase().replace(",", ".");
  if (!text) return null;

  const centimetres = finiteNumber(text.match(/(\d{3}(?:\.\d+)?)\s*cm\b/)?.[1]);
  if (centimetres !== null) return boundedHeight(centimetres);

  const metres = finiteNumber(text.match(/(\d(?:\.\d+)?)\s*(?:m|metre|meter)s?\b/)?.[1]);
  if (metres !== null) return boundedHeight(metres * 100);

  const feetAndInches = text.match(/(\d+)\s*(?:ft|')\s*(\d{1,2})?\s*(?:in|")?/);
  if (feetAndInches) {
    const feet = Number(feetAndInches[1]);
    const inches = Number(feetAndInches[2] ?? 0);
    return boundedHeight(feet * 30.48 + inches * 2.54);
  }

  const amount = finiteNumber(text.match(/\d+(?:\.\d+)?/)?.[0]);
  if (amount === null) return null;
  return boundedHeight(amount < 3 ? amount * 100 : amount);
}

function entityUnitId(unit) {
  return String(unit ?? "").split("/").pop() ?? "";
}

function wikidataHeightCm(entity) {
  const statement = entity?.claims?.P2048?.find(
    (item) => item?.mainsnak?.snaktype === "value" && item?.mainsnak?.datavalue?.value
  );
  const quantity = statement?.mainsnak?.datavalue?.value;
  const amount = finiteNumber(quantity?.amount);
  if (amount === null) return null;

  const unit = entityUnitId(quantity?.unit);
  if (unit === METRE_UNIT) return boundedHeight(amount * 100);
  if (unit === CENTIMETRE_UNIT) return boundedHeight(amount);
  if (unit === FOOT_UNIT) return boundedHeight(amount * 30.48);
  if (unit === INCH_UNIT) return boundedHeight(amount * 2.54);
  return normalizeHeightCm(amount);
}

function simplifiedChineseLabel(entity) {
  const labels = entity?.labels ?? {};
  return ["zh-hans", "zh-cn", "zh-sg", "zh"]
    .map((language) => String(labels?.[language]?.value ?? "").trim())
    .find((label) => /[\u3400-\u9fff]/.test(label)) ?? "";
}

export async function fetchWikidataPlayerMetadata(ids, options = {}) {
  const uniqueIds = Array.from(
    new Set((ids ?? []).map((id) => String(id ?? "").trim()).filter((id) => WIKIDATA_ENTITY_PATTERN.test(id)))
  ).slice(0, MAX_WIKIDATA_ENTITIES);
  if (!uniqueIds.length) return new Map();

  const url = new URL(WIKIDATA_API_URL);
  url.search = new URLSearchParams({
    action: "wbgetentities",
    format: "json",
    formatversion: "2",
    props: "labels|claims",
    languages: "zh-hans|zh-cn|zh-sg|zh|en",
    languagefallback: "1",
    maxlag: "5",
    ids: uniqueIds.join("|")
  }).toString();

  const response = await fetch(url, {
    cache: "force-cache",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "User-Agent": "football-prediction-agent/0.1 (player metadata enrichment)"
    },
    signal: AbortSignal.timeout(Math.min(15_000, Math.max(1_000, Number(options.timeoutMs) || 8_000)))
  });
  if (!response.ok) {
    throw new Error(`Wikidata metadata returned ${response.status}.`);
  }

  const payload = await response.json();
  const entities = payload?.entities ?? {};
  return new Map(
    uniqueIds.map((id) => {
      const entity = entities[id];
      return [
        id,
        {
          wikidataId: id,
          nameZh: simplifiedChineseLabel(entity),
          heightCm: wikidataHeightCm(entity),
          sourceUrl: `https://www.wikidata.org/wiki/${id}`
        }
      ];
    })
  );
}
