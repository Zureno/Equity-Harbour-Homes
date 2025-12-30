// owner-portal/app/api/owner/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { setOwnerSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  const expected = process.env.OWNER_PORTAL_PASSWORD;

  // If the env var is missing, that’s a server misconfig
  if (!expected) {
    console.error("OWNER_PORTAL_PASSWORD is not set on the server.");
    return NextResponse.json(
      { error: "Server is misconfigured (missing password)." },
      { status: 500 }
    );
  }

  if (!password || password !== expected) {
    return NextResponse.json(
      { error: "Invalid password" },
      { status: 401 }
    );
  }

  // ✅ Let TS infer the type here – DON'T annotate it
  const res = NextResponse.json({ ok: true });
  setOwnerSessionCookie(res);
  return res;
}
