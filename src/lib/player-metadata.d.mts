export type WikidataPlayerMetadata = {
  wikidataId: string;
  nameZh: string;
  heightCm: number | null;
  sourceUrl: string;
};

export function normalizeHeightCm(value: unknown): number | null;

export function fetchWikidataPlayerMetadata(
  ids: unknown[],
  options?: { timeoutMs?: number }
): Promise<Map<string, WikidataPlayerMetadata>>;
