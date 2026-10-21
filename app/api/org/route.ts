import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeRc } from "@/lib/org";
import { startTrial, TrialError } from "@/lib/trials-server";

export const dynamic = "force-dynamic";

// Organisation accounts. Clients can't write any organisation field
// (firestore.rules), so everything goes through here.
//   register     — mark this account an organisation and submit its RC/CAC number
//                  (brand-new accounts at once; older ones wait for admin approval)
//   resubmit     — a rejected organisation sends a corrected number
//   start_trial  — the free 15-day Business trial (lib/trials.ts; verified email, once per RC number)
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "org", me.uid, 10, 3600);
    if (limited) return limited;
    const { action, rcNumber } = await req.json();
    const db = getAdminDb();
    const ref = db.doc(`users/${me.uid}`);
    const user = (await ref.get()).data();
    if (!user) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    if (user.suspended === true) return NextResponse.json({ error: "This account is suspended." }, { status: 403 });
    const now = new Date().toISOString();

    if (action === "register" || action === "resubmit") {
      const rc = normalizeRc(rcNumber);
      if (!rc) return NextResponse.json({ error: "Enter the registration number as it appears on your CAC certificate, e.g. RC1234567 or BN1234567." }, { status: 400 });
      if (action === "register" && user.accountKind === "organisation") return NextResponse.json({ error: "This is already an organisation account." }, { status: 409 });
      if (action === "resubmit" && user.org?.rcStatus !== "rejected") return NextResponse.json({ error: "Nothing to resubmit." }, { status: 409 });
      const fresh = Date.now() - new Date(user.createdAt || 0).getTime() < 24 * 3_600_000;
      const live = action === "resubmit" || fresh;

      // One organisation per registration number.
      const rcRef = db.doc(`orgRc/${rc}`);
      const taken = (await rcRef.get()).data();
      if (taken && taken.uid !== me.uid) {
        return NextResponse.json({ error: "That registration number is already linked to another #NotesApp organisation. If it's yours, contact us and we'll sort it out." }, { status: 409 });
      }
      if (!live) {
        await db.doc(`orgRequests/${me.uid}`).set({ uid: me.uid, rcNumber: rc, status: "pending", requestedAt: now });
        return NextResponse.json({ ok: true, pending: true });
      }
      const batch = db.batch();
      batch.set(rcRef, { uid: me.uid, at: now });
      batch.set(ref, { accountKind: "organisation", org: { rcNumber: rc, rcStatus: "unverified", rcSubmittedAt: now } }, { merge: true });
      await batch.commit();
      return NextResponse.json({ ok: true });
    }

    if (action === "start_trial") {
      // The organisation page's button: the same 15-day Business trial as everyone's (lib/trials.ts), once per registration number.
      if (user.accountKind !== "organisation") return NextResponse.json({ error: "Only organisation accounts start the trial here; everyone else can on Pricing." }, { status: 403 });
      try {
        return NextResponse.json({ ok: true, ...(await startTrial(db, me.uid, "business", { emailVerified: !!me.emailVerified })) });
      } catch (e) {
        if (e instanceof TrialError) return NextResponse.json({ error: e.message }, { status: e.status });
        throw e;
      }
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't update your organisation");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

