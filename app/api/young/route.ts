import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { exportMine, graduate, graduationStatus } from "@/lib/young-server";
import { YoungError } from "@/lib/young";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const fail = (err: unknown, fallback: string) => {
  if (err instanceof YoungError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};
async function who(req: NextRequest) {
  const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
  if (!me) throw new YoungError("Sign in first.", 401);
  return me;
}

// Turning 18 (lib/young.ts). GET → whether the "You're 18 now" screen is due; GET ?export=1 → everything from teen mode as a file.
// POST { search, messages, replies, realName, offers, consent, deleteChildhood } → the account becomes theirs.
export async function GET(req: NextRequest) {
  try {
    const me = await who(req);
    const db = getAdminDb();
    if (req.nextUrl.searchParams.get("export")) {
      return new NextResponse(JSON.stringify(await exportMine(db, me.uid), null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="my-notesapp-data.json"', "Cache-Control": "no-store" } });
    }
    return NextResponse.json(await graduationStatus(db, me.uid), { headers: { "Cache-Control": "no-store" } });
  } catch (err) { return fail(err, "Couldn't load that"); }
}

export async function POST(req: NextRequest) {
  try {
    const me = await who(req);
    const limited = await rateLimit(req, "graduate", me.uid, 10, 3600);
    if (limited) return limited;
    return NextResponse.json(await graduate(getAdminDb(), me.uid, (await req.json().catch(() => ({}))) as Record<string, unknown>));
  } catch (err) { return fail(err, "Couldn't save that"); }
}
