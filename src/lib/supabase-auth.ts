import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseSettings } from "./supabase-config";

export const ACCESS_COOKIE = "football_access";
export const REFRESH_COOKIE = "football_refresh";

function settings() {
  const { url, publishableKey, secretKey } = getSupabaseSettings();
  if (!url || !publishableKey) return null;
  return { url, publishableKey, secretKey };
}

function client(key: string) {
  const config = settings();
  if (!config) throw new Error("Supabase Auth 尚未配置。");
  return createClient(config.url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export function isAuthConfigured() { return Boolean(settings()); }
export function authClient() {
  const config = settings();
  if (!config) throw new Error("Supabase Auth 尚未配置。");
  return client(config.publishableKey);
}

export function serviceClient() {
  const config = settings();
  if (!config?.secretKey) throw new Error("Supabase secret key is not configured.");
  return client(config.secretKey);
}

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  const pair = cookies.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  if (!pair) return "";
  try {
    return decodeURIComponent(pair.slice(name.length + 1));
  } catch {
    return "";
  }
}

export async function requestUser(request: Request): Promise<User | null> {
  if (!isAuthConfigured()) return null;
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : cookieValue(request, ACCESS_COOKIE);
  if (token) {
    const { data, error } = await authClient().auth.getUser(token);
    if (!error && data.user) return data.user;
  }

  // Bearer clients own token refresh. Cookie sessions can be renewed server-side.
  if (authorization.startsWith("Bearer ")) return null;
  const refreshToken = cookieValue(request, REFRESH_COOKIE);
  if (!refreshToken) return null;
  const { data, error } = await authClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session || !data.user) return null;

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, data.session.access_token, authCookieOptions(data.session.expires_in));
  cookieStore.set(REFRESH_COOKIE, data.session.refresh_token, authCookieOptions(30 * 24 * 60 * 60));
  return data.user;
}

export function authCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}
