import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { friendlyMessage } from "@/lib/api-errors";
import { quarterOf } from "@/lib/ventures";
import { VenturesError, callSettings, myPitches, selfCheck, sendPitch, withdrawPitch } from "@/lib/ventures-server";

export const dynamic = "force-dynamic";

// NotesApp Ventures, Rewrite the Playbook (lib/ventures.ts).
// GET → { call, quarter, mine } (rolling; mine: the signed-in member's pitches with the team's advice, or [] signed out)
// POST { action: "apply", kind, sector, stage, region, countries, title, oneLiner, problem, solution, whyYou, traction, teamSize, links,
//        emergingMarkets: true, agree: true } → { pitch }
//      { action: "withdraw", id }
//      { action: "selfcheck", …the pitch fields } → { read }: Nana's three tests on a draft, privately (nothing kept; own Nana allowance)
async function who(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try { const me = await verifySignedInRequest(token); return { uid: me.uid, emailVerified: !!me.emailVerified }; } catch { return null; }
}
const fail = (err: unknown, fallback: string) => {
  if (err instanceof VenturesError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

export async function GET(req: NextRequest) {
  try {
    const me = await who(req);
    const limited = await rateLimit(req, "ventures-read", me?.uid ?? clientIp(req), 120, 600);
    if (limited) return limited;
    const db = getAdminDb();
    const [call, mine] = await Promise.all([callSettings(db), me ? myPitches(db, me.uid) : Promise.resolve([])]);
    return NextResponse.json({ call, quarter: quarterOf(new Date()), mine, signedIn: !!me }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load Ventures");
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await who(req);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "ventures-write", me.uid, 20, 3600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    if (body.action === "apply") return NextResponse.json({ pitch: await sendPitch(db, me, body) });
    if (body.action === "selfcheck") {
      const slow = await rateLimit(req, "ventures-selfcheck", me.uid, 6, 3600);
      if (slow) return slow;
      return NextResponse.json({ read: await selfCheck(db, me, body) });
    }
    if (body.action === "withdraw") { await withdrawPitch(db, me.uid, body.id); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err, "Couldn't send your pitch");
  }
}
