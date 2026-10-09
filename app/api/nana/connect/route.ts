import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { aiStatus, connectKey, disconnectKey } from "@/lib/ai-connect";
import { NanaError } from "@/lib/nana";
import { nanaConfigured } from "@/lib/nana-config";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function who(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const d = token ? await getAuth(getAdminApp()).verifyIdToken(token).catch(() => null) : null;
  if (!d) throw new NanaError("Sign in to connect your AI account.", 401);
  return d.uid;
}
const fail = (err: unknown, fallback: string) => {
  if (err instanceof NanaError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Your own AI account. GET → { connected, last4?, connectedAt?, canConnect, platformAi } · POST { key } connects it (the key is checked and
// kept encrypted; it is never sent back) · DELETE removes it.
export async function GET(req: NextRequest) {
  try {
    const uid = await who(req);
    return NextResponse.json({ ...(await aiStatus(getAdminDb(), uid)), platformAi: nanaConfigured() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) { return fail(err, "Couldn't load your AI account"); }
}
export async function POST(req: NextRequest) {
  try {
    const uid = await who(req);
    const limited = rateLimit(req, "ai-connect", uid, 8, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json({ ...(await connectKey(getAdminDb(), uid, b.key)), platformAi: nanaConfigured() });
  } catch (err) { return fail(err, "Couldn't connect that account"); }
}
export async function DELETE(req: NextRequest) {
  try {
    const uid = await who(req);
    await disconnectKey(getAdminDb(), uid);
    return NextResponse.json({ ...(await aiStatus(getAdminDb(), uid)), platformAi: nanaConfigured() });
  } catch (err) { return fail(err, "Couldn't disconnect"); }
}
