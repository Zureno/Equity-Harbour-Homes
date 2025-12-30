// owner-portal/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { isOwnerAuthenticated } from "./lib/auth";  // ✅ relative to project root

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Paths that do NOT require auth
  const publicPaths = [
    "/login",
    "/api/owner/login",
    "/api/owner/logout",
    "/favicon.ico",
  ];

  if (pathname.startsWith("/_next") || publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Everything else requires owner session
  if (!isOwnerAuthenticated(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes except static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
