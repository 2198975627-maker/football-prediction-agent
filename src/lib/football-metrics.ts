export type CanonicalMetricKey =
  | "rating"
  | "minutes"
  | "goals"
  | "assists"
  | "shots"
  | "shots_on_target"
  | "xg"
  | "passes"
  | "passes_accurate"
  | "key_passes"
  | "tackles"
  | "tackles_won"
  | "interceptions"
  | "blocks"
  | "clearances"
  | "dribbles_attempted"
  | "dribbles_completed"
  | "dribbled_past"
  | "duels"
  | "duels_won"
  | "aerials_won"
  | "saves"
  | "shots_faced"
  | "goals_conceded"
  | "penalties_saved"
  | "possession";

export type CanonicalMetrics = Partial<Record<CanonicalMetricKey, number>>;

const rules: Array<{ key: CanonicalMetricKey; patterns: RegExp[] }> = [
  { key: "rating", patterns: [/^rating$/, /average.?rating/] },
  { key: "minutes", patterns: [/minutes?.?played/, /^minutes$/] },
  { key: "goals", patterns: [/^goals?$/, /goals?.?scored/] },
  { key: "assists", patterns: [/^assists?$/] },
  { key: "shots_on_target", patterns: [/shots?.?on.?target/, /shots?.?on.?goal/, /shots?.?on$/] },
  { key: "shots", patterns: [/^shots?$/, /total.?shots/, /shots?.?total/] },
  { key: "xg", patterns: [/^xg$/, /expected.?goals/] },
  { key: "passes_accurate", patterns: [/accurate.?passes/, /passes.?successful/] },
  { key: "key_passes", patterns: [/key.?passes/] },
  { key: "passes", patterns: [/^passes$/, /total.?passes/, /passes?.?total/] },
  { key: "tackles_won", patterns: [/tackles?.?won/, /successful.?tackles/] },
  { key: "tackles", patterns: [/^tackles$/, /total.?tackles/, /tackles?.?total/] },
  { key: "interceptions", patterns: [/interceptions?/] },
  { key: "blocks", patterns: [/^blocks?$/, /blocked.?shots/, /tackles?.?blocks/] },
  { key: "clearances", patterns: [/clearances?/] },
  { key: "dribbles_completed", patterns: [/successful.?dribbles/, /dribbles?.?completed/, /dribbles?.?success/] },
  { key: "dribbles_attempted", patterns: [/dribbles?.?attempt/, /total.?dribbles/] },
  { key: "dribbled_past", patterns: [/dribbled.?past/] },
  { key: "duels_won", patterns: [/duels?.?won/] },
  { key: "duels", patterns: [/^duels$/, /total.?duels/, /duels?.?total/] },
  { key: "aerials_won", patterns: [/aerials?.?won/, /aerial.?duels?.?won/] },
  { key: "penalties_saved", patterns: [/penalt(y|ies).?saved/] },
  { key: "shots_faced", patterns: [/shots?.?faced/] },
  { key: "saves", patterns: [/^saves?$/, /goalkeeper.?saves/] },
  { key: "goals_conceded", patterns: [/goals?.?conceded/] },
  { key: "possession", patterns: [/possession/] }
];

export function canonicalMetricKey(...labels: Array<string | undefined | null>): CanonicalMetricKey | null {
  const value = labels
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return rules.find((rule) => rule.patterns.some((pattern) => pattern.test(value)))?.key ?? null;
}

export function addCanonicalMetric(target: CanonicalMetrics, key: CanonicalMetricKey | null, value: unknown) {
  if (!key) return;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (Number.isFinite(parsed)) target[key] = parsed;
}
