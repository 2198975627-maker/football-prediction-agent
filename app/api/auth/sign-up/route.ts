import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  authClient,
  authCookieOptions,
  isAuthConfigured
} from "@/src/lib/supabase-auth";
import { readLimitedJson } from "@/src/lib/http-security";
import { checkRateLimit } from "@/src/lib/rate-limit";

const schema = z.object({ email: z.string().email().max(254), password: z.string().min(10).max(128) });

export async function POST(request: Request) {
  if (!isAuthConfigured()) return NextResponse.json({ ok: false, error: "账户服务尚未配置。" }, { status: 503 });
  const limited = await checkRateLimit(request, { keyPrefix: "auth-sign-up", limit: 5, windowMs: 15 * 60_000 });
  if (!limited.ok) return NextResponse.json({ ok: false, error: "注册尝试过于频繁。" }, { status: 429 });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "邮箱或密码格式无效，密码至少10位。" }, { status: 400 });
  const { data, error } = await authClient().auth.signUp(parsed.data);
  if (error) return NextResponse.json({ ok: false, error: "注册失败，请检查邮箱或稍后重试。" }, { status: 400 });
  const response = NextResponse.json({
    ok: true,
    requiresEmailConfirmation: !data.session,
    user: data.user ? { id: data.user.id, email: data.user.email } : null
  });
  if (data.session) {
    response.cookies.set(ACCESS_COOKIE, data.session.access_token, authCookieOptions(data.session.expires_in));
    response.cookies.set(REFRESH_COOKIE, data.session.refresh_token, authCookieOptions(30 * 24 * 60 * 60));
  }
  return response;
}
