import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "./api-errors";
import { SocialAuthError } from "./social-auth";

// Shared by the /api/auth/{google,linkedin,methods} routes.
export const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || undefined;
export const noStore = { "Cache-Control": "no-store" };
export function socialAuthFail(err: unknown, fallback: string) {
  if (err instanceof SocialAuthError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status, headers: noStore });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status, headers: noStore });
}
