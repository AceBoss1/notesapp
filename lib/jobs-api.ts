import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "./api-errors";
import { verifySignedInRequest } from "./firebase-admin";
import { JobsError } from "./jobs";

// Shared bits for the Notes Jobs API routes.
export const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
export async function signedIn(req: NextRequest, verified = true) {
  const me = await verifySignedInRequest(bearer(req)).catch(() => { throw new JobsError("Sign in first.", 401); });
  if (verified && !me.emailVerified) throw new JobsError("Verify your email first.", 403);
  return me;
}
export const optionalUid = async (req: NextRequest) => (bearer(req) ? (await verifySignedInRequest(bearer(req)).catch(() => null))?.uid ?? null : null);
export function jobsFail(err: unknown, fallback: string) {
  if (err instanceof JobsError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
}
