import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getUserEmail, verifyAdminRequest } from "@/lib/firebase-admin";
import { setting } from "@/lib/config";
import { checkAnnouncement } from "@/lib/announcements";
import {
  AnnouncementError, deleteDraft, getAnnouncement, listAnnouncements, renderAnnouncementEmail, saveAnnouncement, seedAnniversaryDraft, sendBatch, sendTest, startSending,
} from "@/lib/announcements-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin → Announcements (app/(main)/admin/announcements). Owner and super admins only: it reaches every member.
// GET → { announcements, ready } (and writes the one-month anniversary draft the first time). POST { action }:
//   "save"       { id?, title, bell, subject, preheader, body, linkLabel, linkUrl } → the draft (new without id)
//   "preview"    { the same fields } → { subject, preheader, html, text } as you'd get it (nothing saved)
//   "send_test"  { id } → emails it to you; needed after every change before sending to everyone
//   "send_all"   { id } → starts sending (the page then asks for batches)
//   "send_batch" { id } → the next batch of members: { done, counts }
//   "delete"     { id } → a draft only
async function admin(req: NextRequest) {
  return verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), "super");
}
const ready = () => ({ emailReady: !!setting("RESEND_API_KEY"), linkSecret: !!(setting("EMAIL_LINK_SECRET") || setting("CRON_SECRET")) });
const err = (e: unknown) => {
  if (e instanceof AnnouncementError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("[announcements]", e);
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
};

export async function GET(req: NextRequest) {
  let uid: string;
  try { uid = await admin(req); } catch { return NextResponse.json({ error: "Owner and super admins only." }, { status: 403 }); }
  const db = getAdminDb();
  try {
    await seedAnniversaryDraft(db, uid).catch(() => false);
    return NextResponse.json({ announcements: await listAnnouncements(db), ready: ready() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return err(e); }
}

export async function POST(req: NextRequest) {
  let uid: string;
  try { uid = await admin(req); } catch { return NextResponse.json({ error: "Owner and super admins only." }, { status: 403 }); }
  const db = getAdminDb();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const me = (await db.doc(`users/${uid}`).get()).data();
    const name = String(me?.displayName || me?.username || "");
    switch (b.action) {
      case "save": return NextResponse.json({ announcement: await saveAnnouncement(db, uid, b.id, b) });
      case "preview": {
        const c = checkAnnouncement(b);
        if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
        const e = renderAnnouncementEmail(c.value, { uid, name });
        return NextResponse.json({ subject: e.subject, preheader: c.value.preheader, html: e.html, text: e.text });
      }
      case "send_test": return NextResponse.json(await sendTest(db, b.id, { uid, name, email: await getUserEmail(uid) }));
      case "send_all": {
        if (!ready().linkSecret) return NextResponse.json({ error: "Set EMAIL_LINK_SECRET (or CRON_SECRET) in Vercel first: the unsubscribe links are signed with it." }, { status: 409 });
        return NextResponse.json(await startSending(db, b.id, uid));
      }
      case "send_batch": return NextResponse.json(await sendBatch(db, b.id));
      case "delete": await deleteDraft(db, b.id); return NextResponse.json({ ok: true });
      case "get": return NextResponse.json({ announcement: await getAnnouncement(db, b.id) });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) { return err(e); }
}
