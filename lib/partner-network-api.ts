// Shared by /api/partners and /api/partners/portal: who's asking, and errors as JSON.
import { NextResponse, type NextRequest } from "next/server";
import { verifySignedInRequest } from "./firebase-admin";
import { friendlyMessage } from "./api-errors";
import { PartnerError } from "./partner-network-server";

export async function who(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try { const me = await verifySignedInRequest(token); return { uid: me.uid, emailVerified: !!me.emailVerified }; } catch { return null; }
}
export const fail = (err: unknown, fallback: string) => {
  if (err instanceof PartnerError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};
