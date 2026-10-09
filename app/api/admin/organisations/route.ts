import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, getUserEmail, verifyAdminRequest } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
const site = () => process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin: every organisation account + pending conversion requests.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req), ["support", "growth"]);
    const db = getAdminDb();
    const [orgs, reqs] = await Promise.all([
      db.collection("users").where("accountKind", "==", "organisation").get(),
      db.collection("orgRequests").where("status", "==", "pending").get(),
    ]);
    const pick = (d: FirebaseFirestore.QueryDocumentSnapshot) => {
      const u = d.data();
      return { uid: d.id, username: u.username, displayName: u.displayName, accountTier: u.accountTier, trialUntil: u.trialUntil || null, org: u.org || null, gold: u.goldBadge?.kind || null };
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
    const adminUid0 = await verifyAdminRequest(bearer(req), ["support", "growth"]);
    const body = await req.json();
    const { action, uid, note } = body;
    const db = getAdminDb();

    // ---- move existing posts into an organisation's channel (and back) ----
    if (action === "move_posts" || action === "undo_move") {
      const ids: string[] = Array.isArray(body.noteIds) ? body.noteIds.map(String).slice(0, 200) : [];
      if (!ids.length) return NextResponse.json({ error: "Choose at least one post." }, { status: 400 });
      const stamp = new Date().toISOString();
      if (action === "undo_move") {
        let restored = 0;
        for (const id of ids) {
          const r = db.doc(`notes/${id}`);
          const n = (await r.get()).data();
          if (!n?.movedFrom) continue;
          const f = n.movedFrom;
          await r.update({
            author: f.author, author_role: f.author_role, author_avatar: f.author_avatar,
            authorUid: f.authorUid ?? FieldValue.delete(), authorUsername: f.authorUsername ?? FieldValue.delete(),
            writerUid: FieldValue.delete(), writerUsername: FieldValue.delete(), movedFrom: FieldValue.delete(),
          });
          restored++;
        }
        return NextResponse.json({ ok: true, restored });
      }
      const org = (await db.doc(`users/${String(body.orgUid)}`).get()).data();
      if (!org || org.accountKind !== "organisation") return NextResponse.json({ error: "Pick an organisation account." }, { status: 400 });
      const writerUsername = String(body.writerUsername || "").replace(/^@/, "").toLowerCase();
      const writerUid = writerUsername ? ((await db.doc(`usernames/${writerUsername}`).get()).data()?.uid as string | undefined) : undefined;
      let moved = 0;
      for (const id of ids) {
        const r = db.doc(`notes/${id}`);
        const n = (await r.get()).data();
        if (!n || n.authorUid === String(body.orgUid)) continue;
        await r.update({
          // remember the original byline so the move can be undone
          movedFrom: {
            author: n.author ?? "", author_role: n.author_role ?? "", author_avatar: n.author_avatar ?? "",
            ...(n.authorUid ? { authorUid: n.authorUid } : {}), ...(n.authorUsername ? { authorUsername: n.authorUsername } : {}), at: stamp, by: adminUid0,
          },
          author: org.displayName, author_role: "Organisation channel", author_avatar: org.avatar,
          authorUid: String(body.orgUid), authorUsername: org.username,
          ...(writerUsername ? { writerUsername, ...(writerUid ? { writerUid } : {}) } : {}),
        });
        moved++;
      }
      return NextResponse.json({ ok: true, moved });
    }

    // ---- gold badge (endorsed by #NotesApp) for an organisation, granted by an admin ----
    if (action === "grant_gold" || action === "revoke_gold") {
      const uref = db.doc(`users/${String(uid)}`);
      const u = (await uref.get()).data();
      if (!u || u.accountKind !== "organisation") return NextResponse.json({ error: "Not an organisation." }, { status: 409 });
      if (action === "revoke_gold") await uref.update({ goldBadge: FieldValue.delete(), goldUntil: FieldValue.delete() });
      else await uref.update({ goldBadge: { kind: "endorsement", track: "corporate", grantedAt: new Date().toISOString(), note: String(note || "Granted by an admin").slice(0, 200) }, goldUntil: FieldValue.delete() });
      return NextResponse.json({ ok: true });
    }

    const ref = db.doc(`users/${String(uid)}`);
    const user = (await ref.get()).data();
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    const now = new Date().toISOString();
    const email = await getUserEmail(String(uid));

    if (action === "verify") {
      if (user.accountKind !== "organisation") return NextResponse.json({ error: "Not an organisation." }, { status: 409 });
      await ref.update({ "org.rcStatus": "verified", "org.rcVerifiedAt": now, "org.rcNote": "" });
      if (email) await sendEmail({ to: email, bell: { uid: String(uid), type: "org", linkHref: "/organisation" }, subject: "Your organisation is verified on #NotesApp", text: `We've confirmed ${user.displayName}'s registration (${user.org?.rcNumber}). The "unverified" notice is gone from your channel and posts${["business", "enterprise"].includes(user.accountTier) ? ", and your verified ✔ now shows" : ""}.\n\n${site()}/u/${user.username}\n\n#NotesApp` }).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    if (action === "reject") {
      const why = String(note || "").trim().slice(0, 300);
      if (!why) return NextResponse.json({ error: "Give a reason — it's sent to the organisation." }, { status: 400 });
      await ref.update({ "org.rcStatus": "rejected", "org.rcNote": why });
      await db.doc(`orgRc/${user.org?.rcNumber}`).delete().catch(() => {});
      if (email) await sendEmail({ to: email, bell: { uid: String(uid), type: "org", linkHref: "/organisation" }, subject: "We couldn't verify your organisation", text: `We couldn't confirm ${user.displayName}'s registration: ${why}\n\nYou can send a corrected number from ${site()}/organisation.\n\n#NotesApp` }).catch(() => {});
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
      if (email) await sendEmail({ to: email, bell: { uid: String(uid), type: "org", linkHref: "/organisation" }, subject: action === "approve_conversion" ? "Your account is now an organisation" : "Organisation request not approved", text: action === "approve_conversion" ? `Your account is now an organisation account. Finish setup at ${site()}/organisation.\n\n#NotesApp` : `We couldn't approve the conversion${note ? `: ${String(note).slice(0, 300)}` : "."}\n\n#NotesApp` }).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't update the organisation");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
