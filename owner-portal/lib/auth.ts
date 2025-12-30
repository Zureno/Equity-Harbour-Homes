// owner-portal/lib/auth.ts
import type { NextRequest, NextResponse } from "next/server";

export const OWNER_COOKIE = "eh_owner_session";

// Secret used as the cookie value – must be set in env
const SESSION_VALUE =
  process.env.OWNER_SESSION_SECRET || "eh-owner-session-fallback";

export function isOwnerAuthenticated(req: NextRequest): boolean {
  const value = req.cookies.get(OWNER_COOKIE)?.value;
  return value === SESSION_VALUE;
}

export function setOwnerSessionCookie(res: NextResponse) {
  res.cookies.set(OWNER_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function clearOwnerSessionCookie(res: NextResponse) {
  res.cookies.set(OWNER_COOKIE, "", {
    path: "/",
    maxAge: 0,
  });
}
