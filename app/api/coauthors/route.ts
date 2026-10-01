import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { CoAuthorInvite, MAX_CO_AUTHORS, MIN_CO_PERCENT, MIN_LEAD_PERCENT, inviteId, leadPercent } from "@/lib/coauthors";

export const dynamic = "force-dynamic";

type Db = ReturnType<typeof getAdminDb>;

// Rebuild the note's public co-author list from the ACCEPTED invites.
async function syncNote(db: Db, noteId: string) {
  const snap = await db.collection("coAuthorInvites").where("noteId", "==", noteId).where("status", "==", "accepted").get();
  const accepted = snap.docs.map((d) => d.data() as CoAuthorInvite).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  await db.doc(`notes/${noteId}`).update(
    accepted.length
      ? { coAuthorUids: accepted.map((i) => i.inviteeUid), coAuthors: accepted.map((i) => i.inviteeName) }
      : { coAuthorUids: FieldValue.delete(), coAuthors: FieldValue.delete() }
  );
}

async function notify(db: Db, recipientUid: string, message: string, linkHref: string, actor?: { username: string; displayName: string }) {
  await db.collection("notifications").add({
    recipientUid,
    type: "coauthor",
    message,
    read: false,
    createdAt: new Date().toISOString(),
    linkHref,
    ...(actor ? { actorUsername: actor.username, actorDisplayName: actor.displayName } : {}),
  });
}

// POST { action: "invite" | "respond" | "revoke", ... } — all co-author state
// changes go through here so consent and the percentage rules can't be skipped.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const me = await verifySignedInRequest(idToken).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "coauthors", me.uid, 40, 3600);
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    const meDoc = (await db.doc(`users/${me.uid}`).get()).data();
    if (!meDoc || meDoc.suspended) return NextResponse.json({ error: "This account can't do that." }, { status: 403 });

    // ---------------------------------------------------------- invite
    if (body.action === "invite") {
      const noteRef = db.doc(`notes/${String(body.noteId)}`);
      const note = (await noteRef.get()).data();
      if (!note || note.authorUid !== me.uid) return NextResponse.json({ error: "You can only add co-authors to your own post." }, { status: 403 });
      if (note.status !== "draft") return NextResponse.json({ error: "Co-authors can only be added while the post is a draft." }, { status: 409 });

      const username = String(body.username || "").toLowerCase().replace(/^@/, "");
      const percent = Number(body.percent);
      if (!Number.isInteger(percent) || percent < MIN_CO_PERCENT) {
        return NextResponse.json({ error: `A co-author's share must be a whole number, at least ${MIN_CO_PERCENT}%.` }, { status: 400 });
      }
      const res = (await db.doc(`usernames/${username}`).get()).data();
      const inviteeUid = res?.uid as string | undefined;
      const invitee = inviteeUid ? (await db.doc(`users/${inviteeUid}`).get()).data() : null;
      if (!inviteeUid || !invitee) return NextResponse.json({ error: "No member with that username." }, { status: 404 });
      if (inviteeUid === me.uid) return NextResponse.json({ error: "You're already the lead author." }, { status: 400 });
      if (invitee.suspended) return NextResponse.json({ error: "That member can't be invited right now." }, { status: 409 });

      const existing = (await db.collection("coAuthorInvites").where("noteId", "==", noteRef.id).get()).docs.map((d) => d.data() as CoAuthorInvite);
      const live = existing.filter((i) => i.status === "pending" || i.status === "accepted");
      if (live.some((i) => i.inviteeUid === inviteeUid)) return NextResponse.json({ error: "They're already invited." }, { status: 409 });
      if (live.length >= MAX_CO_AUTHORS) return NextResponse.json({ error: `A post can have at most ${MAX_CO_AUTHORS} co-authors.` }, { status: 409 });
      if (leadPercent(live) - percent < MIN_LEAD_PERCENT) {
        return NextResponse.json({ error: `You must keep at least ${MIN_LEAD_PERCENT}%. You have ${leadPercent(live) - MIN_LEAD_PERCENT}% left to give.` }, { status: 400 });
      }

      const invite: CoAuthorInvite = {
        noteId: noteRef.id,
        noteTitle: String(note.title || "Untitled"),
        leadUid: me.uid,
        leadName: meDoc.displayName,
        leadUsername: meDoc.username,
        inviteeUid,
        inviteeUsername: invitee.username,
        inviteeName: invitee.displayName,
        percent,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      await db.doc(`coAuthorInvites/${inviteId(noteRef.id, inviteeUid)}`).set(invite);
      await notify(db, inviteeUid, `${meDoc.displayName} invited you to co-author "${invite.noteTitle}" for ${percent}% of its earnings`, "/invites", { username: meDoc.username, displayName: meDoc.displayName });
      return NextResponse.json({ ok: true });
    }

    // --------------------------------------------------------- respond
    if (body.action === "respond") {
      const ref = db.doc(`coAuthorInvites/${String(body.inviteId)}`);
      const inv = (await ref.get()).data() as CoAuthorInvite | undefined;
      if (!inv || inv.inviteeUid !== me.uid) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
      if (inv.status !== "pending") return NextResponse.json({ error: `This invite is already ${inv.status}.` }, { status: 409 });
      const note = (await db.doc(`notes/${inv.noteId}`).get()).data();
      if (!note || note.status !== "draft") {
        await ref.update({ status: "expired", respondedAt: new Date().toISOString() });
        return NextResponse.json({ error: "This post was already published or removed, so the invite expired." }, { status: 409 });
      }
      const accept = !!body.accept;
      await ref.update({ status: accept ? "accepted" : "declined", respondedAt: new Date().toISOString() });
      if (accept) await syncNote(db, inv.noteId);
      await notify(db, inv.leadUid, `${meDoc.displayName} ${accept ? "accepted" : "declined"} your co-author invite for "${inv.noteTitle}"`, "/write", { username: meDoc.username, displayName: meDoc.displayName });
      return NextResponse.json({ ok: true });
    }

    // ---------------------------------------------------------- revoke
    if (body.action === "revoke") {
      const ref = db.doc(`coAuthorInvites/${String(body.inviteId)}`);
      const inv = (await ref.get()).data() as CoAuthorInvite | undefined;
      if (!inv || inv.leadUid !== me.uid) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
      const note = (await db.doc(`notes/${inv.noteId}`).get()).data();
      if (!note || note.status !== "draft") return NextResponse.json({ error: "The split is locked once the post is published." }, { status: 409 });
      if (inv.status !== "pending" && inv.status !== "accepted") return NextResponse.json({ error: `This invite is already ${inv.status}.` }, { status: 409 });
      await ref.update({ status: "revoked", respondedAt: new Date().toISOString() });
      await syncNote(db, inv.noteId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't update co-authors");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
