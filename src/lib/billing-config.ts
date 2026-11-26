function readNumber(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function getBillingRuntimeConfig() {
  return {
    billingMarkupMultiplier: readNumber("BILLING_MARKUP_MULTIPLIER", 2, 1, 20),
    minimumChargeCents: Math.round(readNumber("MIN_CHARGE_CENTS", 100, 0, 100_000))
  };
}
