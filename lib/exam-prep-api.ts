import { NextRequest, NextResponse } from "next/server";
import { verifySignedInRequest, getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { friendlyMessage } from "@/lib/api-errors";
import { PrepError } from "@/lib/exam-prep-server";

// Shared by the /api/exam-prep routes. Server-only.
export const db = () => getAdminDb();
export const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || undefined;
// Signed in, or not: free practice, free mocks and pay links work without an account.
export const maybeUser = (req: NextRequest) => verifySignedInRequest(bearer(req)).catch(() => null);
export async function needUser(req: NextRequest) {
  const u = await maybeUser(req);
  if (!u) throw new PrepError("Sign in first.", 401);
  return u;
}
export const limit = async (req: NextRequest, bucket: string, uid: string | null, max: number, windowSec: number) => rateLimit(req, `prep-${bucket}`, uid ?? `ip:${clientIp(req)}`, max, windowSec);
export const ok = (data: unknown, cache = "no-store") => NextResponse.json(data, { headers: { "Cache-Control": cache } });
export function fail(err: unknown) {
  if (err instanceof PrepError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, "Something went wrong");
  if (f.status >= 500) console.error("[exam-prep]", err);
  return NextResponse.json({ error: f.message }, { status: f.status });
}
export const body = async (req: NextRequest) => (await req.json().catch(() => ({}))) as Record<string, unknown>;
