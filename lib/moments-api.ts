import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "./firebase-admin";
import { r2PublicUrl, deleteMediaObject } from "./r2";
import { MomentError, type MomentDeps } from "./moments-server";
import { MessageError } from "./messages-server";
import { MESSAGES_LIVE, MOMENTS_LIVE } from "./moments-rules";
import { friendlyMessage } from "./api-errors";

// Shared by the Moments and Messages routes: checks the feature is switched on, the caller is signed in with a verified
// email and not suspended, and turns our own errors into responses.
export const momentDeps: MomentDeps = { publicUrl: r2PublicUrl, remove: deleteMediaObject };

export type Caller = { uid: string; username: string };

export async function authed(req: NextRequest, feature: "moments" | "messages", write = false): Promise<Caller> {
  if (!(feature === "moments" ? MOMENTS_LIVE : MESSAGES_LIVE)) throw new MomentError(404, "Not found.");
  const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
  if (write && !me.emailVerified) throw new MomentError(403, "Verify your email first.");
  const user = (await getAdminDb().doc(`users/${me.uid}`).get()).data();
  if (!user || user.suspended === true) throw new MomentError(403, "Your account can't do that right now.");
  return { uid: me.uid, username: String(user.username ?? "") };
}

export function fail(err: unknown, fallback: string): NextResponse {
  if (err instanceof MomentError || err instanceof MessageError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof Error && /Missing auth token|verifyIdToken|ID token/i.test(err.message)) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
}
