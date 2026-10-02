import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ORG_TRIAL_DAYS, ORG_TRIAL_TIER, normalizeRc } from "@/lib/org";

export const dynamic = "force-dynamic";

// Organisation accounts. Clients can't write any organisation field
// (firestore.rules), so everything goes through here.
//   register     — mark this account an organisation and submit its RC/CAC number
//                  (brand-new accounts at once; older ones wait for admin approval)
//   resubmit     — a rejected organisation sends a corrected number
//   start_trial  — the free 30-day Business trial (verified email, once per RC number)
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "org", me.uid, 10, 3600);
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
      if (user.accountKind !== "organisation") return NextResponse.json({ error: "Only organisation accounts get the trial." }, { status: 403 });
      if (!me.emailVerified) return NextResponse.json({ error: "Verify your email first (check your inbox), then start the trial." }, { status: 403 });
      if (user.org?.rcStatus === "rejected") return NextResponse.json({ error: "Fix your registration number first." }, { status: 403 });
      const rc = user.org?.rcNumber as string;
      const used = db.doc(`orgTrials/${rc}`);
      if ((await used.get()).exists || user.trialUsedAt) return NextResponse.json({ error: "The free trial has already been used for this organisation." }, { status: 409 });
      if (user.accountTier && !["standard", "basic"].includes(user.accountTier)) return NextResponse.json({ error: "Your account is already on a paid plan." }, { status: 409 });
      const until = new Date(Date.now() + ORG_TRIAL_DAYS * 86_400_000).toISOString();
      const batch = db.batch();
      batch.set(used, { uid: me.uid, rcNumber: rc, startedAt: now, until });
      batch.set(ref, { accountTier: ORG_TRIAL_TIER, trialTier: ORG_TRIAL_TIER, trialUntil: until, trialUsedAt: now }, { merge: true });
      await batch.commit();
      return NextResponse.json({ ok: true, until });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't update your organisation");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

