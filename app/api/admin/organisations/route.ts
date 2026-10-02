import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, getUserEmail, verifyAdminRequest } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
const site = () => process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin: every organisation account + pending conversion requests.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    const db = getAdminDb();
    const [orgs, reqs] = await Promise.all([
      db.collection("users").where("accountKind", "==", "organisation").get(),
      db.collection("orgRequests").where("status", "==", "pending").get(),
    ]);
    const pick = (d: FirebaseFirestore.QueryDocumentSnapshot) => {
      const u = d.data();
      return { uid: d.id, username: u.username, displayName: u.displayName, accountTier: u.accountTier, trialUntil: u.trialUntil || null, org: u.org || null };
    };
    const requests = await Promise.all(
      reqs.docs.map(async (d) => {
        const u = (await db.doc(`users/${d.id}`).get()).data();
        return { uid: d.id, username: u?.username, displayName: u?.displayName, ...d.data() };
      })
    );
    return NextResponse.json({ organisations: orgs.docs.map(pick), requests });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load organisations");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

// verify / reject an organisation's registration; approve / decline a conversion request.
export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    const { action, uid, note } = await req.json();
    const db = getAdminDb();
    const ref = db.doc(`users/${String(uid)}`);
    const user = (await ref.get()).data();
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    const now = new Date().toISOString();
    const email = await getUserEmail(String(uid));

    if (action === "verify") {
      if (user.accountKind !== "organisation") return NextResponse.json({ error: "Not an organisation." }, { status: 409 });
      await ref.update({ "org.rcStatus": "verified", "org.rcVerifiedAt": now, "org.rcNote": "" });
      if (email) await sendEmail({ to: email, subject: "Your organisation is verified on #NotesApp", text: `We've confirmed ${user.displayName}'s registration (${user.org?.rcNumber}). The "unverified" notice is gone from your channel and posts${["business", "enterprise"].includes(user.accountTier) ? ", and your verified ✔ now shows" : ""}.\n\n${site()}/u/${user.username}\n\n#NotesApp` }).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    if (action === "reject") {
      const why = String(note || "").trim().slice(0, 300);
      if (!why) return NextResponse.json({ error: "Give a reason — it's sent to the organisation." }, { status: 400 });
      await ref.update({ "org.rcStatus": "rejected", "org.rcNote": why });
      await db.doc(`orgRc/${user.org?.rcNumber}`).delete().catch(() => {});
      if (email) await sendEmail({ to: email, subject: "We couldn't verify your organisation", text: `We couldn't confirm ${user.displayName}'s registration: ${why}\n\nYou can send a corrected number from ${site()}/organisation.\n\n#NotesApp` }).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    if (action === "approve_conversion" || action === "decline_conversion") {
      const rq = db.doc(`orgRequests/${String(uid)}`);
      const r = (await rq.get()).data();
      if (!r || r.status !== "pending") return NextResponse.json({ error: "No pending request." }, { status: 404 });
      if (action === "approve_conversion") {
        const taken = (await db.doc(`orgRc/${r.rcNumber}`).get()).data();
        if (taken && taken.uid !== uid) return NextResponse.json({ error: "That registration number belongs to another organisation." }, { status: 409 });
        const batch = db.batch();
        batch.set(db.doc(`orgRc/${r.rcNumber}`), { uid, at: now });
        batch.set(ref, { accountKind: "organisation", org: { rcNumber: r.rcNumber, rcStatus: "unverified", rcSubmittedAt: r.requestedAt } }, { merge: true });
        batch.update(rq, { status: "approved", resolvedAt: now });
        await batch.commit();
      } else {
        await rq.update({ status: "declined", resolvedAt: now, note: String(note || "").slice(0, 300) });
      }
      if (email) await sendEmail({ to: email, subject: action === "approve_conversion" ? "Your account is now an organisation" : "Organisation request not approved", text: action === "approve_conversion" ? `Your account is now an organisation account. Finish setup at ${site()}/organisation.\n\n#NotesApp` : `We couldn't approve the conversion${note ? `: ${String(note).slice(0, 300)}` : "."}\n\n#NotesApp` }).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't update the organisation");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
