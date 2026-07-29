export type SupabaseKeyMode =
  | "modern-publishable"
  | "modern-secret"
  | "legacy-jwt"
  | "custom"
  | "missing";

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export function classifySupabaseKey(key: string | null | undefined): SupabaseKeyMode {
  const value = key?.trim() || "";
  if (!value) return "missing";
  if (value.startsWith("sb_publishable_")) return "modern-publishable";
  if (value.startsWith("sb_secret_")) return "modern-secret";
  if (value.startsWith("eyJ") && value.split(".").length === 3) return "legacy-jwt";
  return "custom";
}

export function getSupabaseSettings() {
  const url = env("SUPABASE_URL").replace(/\/+$/, "");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");

  return {
    url,
    publishableKey,
    secretKey,
    publishableKeyMode: classifySupabaseKey(publishableKey),
    secretKeyMode: classifySupabaseKey(secretKey)
  };
}

export function supabaseRestHeaders(key: string, includeJson = true) {
  const headers: Record<string, string> = { apikey: key };

  // Legacy anon/service_role keys are JWTs. Modern sb_* keys authenticate
  // through the apikey header and must not be presented as bearer JWTs.
  if (classifySupabaseKey(key) === "legacy-jwt") {
    headers.Authorization = `Bearer ${key}`;
  }
  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}
