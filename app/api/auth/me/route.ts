import { NextResponse } from "next/server";
import { isAuthConfigured, requestUser } from "@/src/lib/supabase-auth";

export async function GET(request: Request) {
  if (!isAuthConfigured()) return NextResponse.json({ ok: true, configured: false, user: null });
  const user = await requestUser(request);
  return NextResponse.json({ ok: true, configured: true, user: user ? { id: user.id, email: user.email } : null });
}
