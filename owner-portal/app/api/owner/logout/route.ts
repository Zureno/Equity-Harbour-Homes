// owner-portal/app/api/owner/logout/route.ts
import { NextResponse } from "next/server";
import { clearOwnerSessionCookie } from "@/lib/auth";

export async function POST() {
  // Again, let TS infer the type
  const res = NextResponse.json({ ok: true });
  clearOwnerSessionCookie(res);
  return res;
}
