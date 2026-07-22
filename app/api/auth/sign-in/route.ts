import { NextResponse } from "next/server";
import { z } from "zod";
import { ACCESS_COOKIE, REFRESH_COOKIE, authClient, authCookieOptions, isAuthConfigured } from "@/src/lib/supabase-auth";
import { readLimitedJson } from "@/src/lib/http-security";
import { checkRateLimit } from "@/src/lib/rate-limit";

const schema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) });

export async function POST(request: Request) {
  if (!isAuthConfigured()) return NextResponse.json({ ok: false, error: "账户服务尚未配置。" }, { status: 503 });
  const limited = await checkRateLimit(request, { keyPrefix: "auth-sign-in", limit: 8, windowMs: 15 * 60_000 });
  if (!limited.ok) return NextResponse.json({ ok: false, error: "登录尝试过于频繁。" }, { status: 429 });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "邮箱或密码无效。" }, { status: 400 });
  const { data, error } = await authClient().auth.signInWithPassword(parsed.data);
  if (error || !data.session) return NextResponse.json({ ok: false, error: "邮箱或密码错误，或邮箱尚未确认。" }, { status: 401 });
  const response = NextResponse.json({ ok: true, user: { id: data.user.id, email: data.user.email } });
  response.cookies.set(ACCESS_COOKIE, data.session.access_token, authCookieOptions(data.session.expires_in));
  response.cookies.set(REFRESH_COOKIE, data.session.refresh_token, authCookieOptions(30 * 24 * 60 * 60));
  return response;
}
