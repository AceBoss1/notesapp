import { createHmac, timingSafeEqual } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "./firebase-admin";
import { renderEmailHtml, sendEmail } from "./email";
import { CONTACT_EMAIL, SITE_URL } from "./host";
import { setting } from "./config";
import {
  ANNIVERSARY_DRAFT, ANNIVERSARY_SEED, ANNOUNCEMENT_BATCH, absoluteUrl, announcementPath, bodyHtml, bodyText, checkAnnouncement, firstName, personalise,
  type Announcement,
} from "./announcements";

// Server-only. Admin → Announcements (app/(main)/admin/announcements, /api/admin/announcements): a message to every member, as a bell
// and an email. Stored in announcements/{id}; each member reached gets announcementSends/{id}_{uid} (both server-only), which is
// what makes sending safe to repeat: a member already sent to is never sent to again, whoever runs the batch.
//
// Sending: a draft can be sent to everyone only after a test reached the sender since its last change. "Send to everyone" marks it
// "sending"; the page then asks for batch after batch (ANNOUNCEMENT_BATCH members each, by member id) until it's done, and the
// reminders cron finishes any announcement left half-sent (the page closed). Who gets what:
//   bell:  every member, except suspended accounts and child profiles.
//   email: those members with a confirmed email, not in teen mode, whose email choices allow announcements (announcementsWanted).
// Every email has a one-click unsubscribe link (signed) and List-Unsubscribe headers.

export class AnnouncementError extends Error { constructor(public status: number, message: string) { super(message); } }
const iso = (d = new Date()) => d.toISOString();
const ref = (db: Firestore, id: string) => db.doc(`announcements/${id}`);
const cleanId = (id: unknown) => { const s = String(id ?? ""); if (!/^[\w-]{1,64}$/.test(s)) throw new AnnouncementError(400, "Which announcement?"); return s; };

// ---- members' choice ----
// Announcements are on unless switched off. A member who switched the weekly digest off and never chose here is treated as off:
// they told us they want fewer emails.
export function announcementsWanted(prefs: Record<string, unknown> | undefined): boolean {
  if (prefs?.announcements === false) return false;
  if (prefs?.announcements === true) return true;
  return prefs?.weeklyDigest !== false;
}
export async function getAnnouncementsWanted(db: Firestore, uid: string) {
  return announcementsWanted((await db.doc(`emailPrefs/${uid}`).get()).data());
}
export async function setAnnouncementsWanted(db: Firestore, uid: string, on: boolean, via: "settings" | "link" = "settings") {
  await db.doc(`emailPrefs/${uid}`).set({ announcements: on, updatedAt: iso(), via }, { merge: true });
}
const secret = () => setting("EMAIL_LINK_SECRET") || setting("CRON_SECRET") || "";
export const announcementsToken = (uid: string) => createHmac("sha256", secret()).update(`announcements:${uid}`).digest("base64url").slice(0, 32);
export function validAnnouncementsToken(uid: string, token: string): boolean {
  if (!secret() || !uid || !token) return false;
  const a = Buffer.from(announcementsToken(uid)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const announcementsUnsubscribeUrl = (uid: string) => `${SITE_URL}/api/announcements/unsubscribe?u=${encodeURIComponent(uid)}&t=${announcementsToken(uid)}`;
export const EMAIL_SETTINGS_URL = `${SITE_URL}/profile/account#email`;

// ---- drafts ----
// The one-month anniversary draft, written once (the first time Admin → Announcements opens). Deleting or sending it never brings
// it back.
export async function seedAnniversaryDraft(db: Firestore, byUid: string, now = new Date()): Promise<boolean> {
  const mark = db.doc(`teamSeeds/${ANNIVERSARY_SEED}`);
  return db.runTransaction(async (t) => {
    if ((await t.get(mark)).exists) return false;
    const at = iso(now);
    t.set(ref(db, ANNIVERSARY_SEED), { id: ANNIVERSARY_SEED, ...ANNIVERSARY_DRAFT, status: "draft", createdAt: at, updatedAt: at, createdBy: byUid, seedKey: ANNIVERSARY_SEED } satisfies Announcement);
    t.set(mark, { at, byUid, count: 1 });
    return true;
  });
}
export async function listAnnouncements(db: Firestore): Promise<Announcement[]> {
  const snap = await db.collection("announcements").orderBy("createdAt", "desc").limit(50).get();
  return snap.docs.map((d) => ({ ...(d.data() as Announcement), id: d.id }));
}
export async function getAnnouncement(db: Firestore, id: unknown): Promise<Announcement> {
  const d = await ref(db, cleanId(id)).get();
  if (!d.exists) throw new AnnouncementError(404, "That announcement wasn't found.");
  return { ...(d.data() as Announcement), id: d.id };
}
// Save a new draft (no id) or change one. Once sending starts it can't be changed.
export async function saveAnnouncement(db: Firestore, byUid: string, id: unknown, raw: unknown, now = new Date()): Promise<Announcement> {
  const c = checkAnnouncement(raw);
  if (!c.ok) throw new AnnouncementError(400, c.error);
  const at = iso(now);
  if (id) {
    const r = ref(db, cleanId(id));
    await db.runTransaction(async (t) => {
      const cur = (await t.get(r)).data() as Announcement | undefined;
      if (!cur) throw new AnnouncementError(404, "That announcement wasn't found.");
      if (cur.status !== "draft") throw new AnnouncementError(409, "It's already been sent, so it can't be changed. Make a new one.");
      t.update(r, { ...c.value, updatedAt: at });
    });
    return getAnnouncement(db, id);
  }
  const r = db.collection("announcements").doc();
  await r.set({ id: r.id, ...c.value, status: "draft", createdAt: at, updatedAt: at, createdBy: byUid } satisfies Announcement);
  return getAnnouncement(db, r.id);
}
export async function deleteDraft(db: Firestore, id: unknown) {
  const a = await getAnnouncement(db, id);
  if (a.status !== "draft") throw new AnnouncementError(409, "A sent announcement stays on record.");
  await ref(db, a.id).delete();
}

// ---- the email ----
export type RenderedEmail = { subject: string; text: string; html: string; headers: Record<string, string> };
export function renderAnnouncementEmail(a: Pick<Announcement, "subject" | "preheader" | "body" | "linkLabel" | "linkUrl">, who: { uid: string; name: string }): RenderedEmail {
  const name = firstName(who.name);
  const body = personalise(a.body, name);
  const action = a.linkUrl ? { label: a.linkLabel, url: absoluteUrl(a.linkUrl) } : undefined;
  const unsub = announcementsUnsubscribeUrl(who.uid);
  const footer = `You get this because you're a #NotesApp member. <a href="${unsub}" style="color:#6B5E5A;">Unsubscribe from announcements</a> &middot; <a href="${EMAIL_SETTINGS_URL}" style="color:#6B5E5A;">Email settings</a>`;
  const text = `${bodyText(body)}${action ? `\n\n${action.label}: ${action.url}` : ""}\n\nUnsubscribe from announcements: ${unsub}`;
  return {
    subject: personalise(a.subject, name), text,
    html: renderEmailHtml(bodyText(body), action, undefined, { bodyHtml: bodyHtml(body), preheader: personalise(a.preheader, name), footer }),
    headers: { "List-Unsubscribe": `<${unsub}>, <mailto:${CONTACT_EMAIL}?subject=unsubscribe%20announcements>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}
export type Send = typeof sendEmail;

// "Send me a test": to the admin's own email, any number of times while it's a draft. It must reach you after the last change
// before Send to everyone is allowed.
export async function sendTest(db: Firestore, id: unknown, me: { uid: string; email: string | null; name: string }, send: Send = sendEmail, now = new Date()) {
  const a = await getAnnouncement(db, id);
  if (!me.email) throw new AnnouncementError(400, "Your account has no email address.");
  const e = renderAnnouncementEmail(a, me);
  const ok = await send({ to: me.email, subject: `[Test] ${e.subject}`, text: e.text, html: e.html, headers: e.headers });
  if (!ok) throw new AnnouncementError(502, "Resend didn't accept it: check RESEND_API_KEY and EMAIL_FROM (Admin → Errors has the reply).");
  await ref(db, a.id).update({ testSentAt: iso(now), testSentTo: me.email });
  return { to: me.email };
}

// "Send to everyone": a draft whose test reached you after its last change becomes "sending". Repeating it changes nothing.
export async function startSending(db: Firestore, id: unknown, byUid: string, now = new Date()) {
  const r = ref(db, cleanId(id));
  return db.runTransaction(async (t) => {
    const a = (await t.get(r)).data() as Announcement | undefined;
    if (!a) throw new AnnouncementError(404, "That announcement wasn't found.");
    if (a.status !== "draft") return { status: a.status };
    if (!a.testSentAt || a.testSentAt < a.updatedAt) throw new AnnouncementError(409, "Send yourself a test first (after your last change), and check it.");
    t.update(r, { status: "sending", sendStartedAt: iso(now), sendStartedBy: byUid, cursor: null, counts: { bells: 0, emails: 0, noEmail: 0, skipped: 0 } });
    return { status: "sending" as const };
  });
}

// One batch: the next members by id after the cursor. Each member is claimed with announcementSends/{id}_{uid} (create fails if it's
// there), so two batches running at once, or a batch run twice, never reach anyone twice.
export async function sendBatch(db: Firestore, id: unknown, opts: { send?: Send; now?: Date; size?: number } = {}) {
  const send = opts.send ?? sendEmail, now = opts.now ?? new Date(), size = opts.size ?? ANNOUNCEMENT_BATCH;
  const a = await getAnnouncement(db, id);
  if (a.status === "sent") return { done: true, counts: a.counts };
  if (a.status !== "sending") throw new AnnouncementError(409, "Press Send to everyone first.");
  let q = db.collection("users").orderBy(FieldPath.documentId()).limit(size);
  if (a.cursor) q = q.startAfter(a.cursor);
  const users = await q.get();
  const counts = { bells: 0, emails: 0, noEmail: 0, skipped: 0 };
  if (!users.empty) {
    const uids = users.docs.map((d) => d.id);
    const [prefs, auth] = await Promise.all([
      db.getAll(...uids.map((u) => db.doc(`emailPrefs/${u}`))),
      Promise.all(Array.from({ length: Math.ceil(uids.length / 100) }, (_, i) => getAuth(getAdminApp()).getUsers(uids.slice(i * 100, i * 100 + 100).map((uid) => ({ uid }))))),
    ]);
    const wants = new Map(prefs.map((p) => [p.id, announcementsWanted(p.data())]));
    const email = new Map(auth.flatMap((r) => r.users).filter((u) => u.email && u.emailVerified && !u.disabled).map((u) => [u.uid, u.email!]));
    for (const d of users.docs) {
      const u = d.data();
      if (u.suspended === true || u.kid === true) { counts.skipped++; continue; }
      const mark = db.doc(`announcementSends/${a.id}_${d.id}`);
      try { await mark.create({ announcementId: a.id, uid: d.id, at: iso(now) }); } catch { continue; } // reached already
      const name = String(u.displayName || u.username || "");
      await db.collection("notifications").add({ recipientUid: d.id, type: "announcement", message: personalise(a.bell, firstName(name)).slice(0, 280), linkHref: announcementPath(a.id), read: false, createdAt: iso(now) });
      counts.bells++;
      const to = email.get(d.id);
      let emailed = false, why = "";
      if (!to) why = "no confirmed email";
      else if (u.teen === true) why = "teen mode";
      else if (!wants.get(d.id)) why = "switched off";
      else {
        const e = renderAnnouncementEmail(a, { uid: d.id, name });
        emailed = await send({ to, subject: e.subject, text: e.text, html: e.html, headers: e.headers });
        if (!emailed) why = "not accepted by Resend";
      }
      if (emailed) counts.emails++; else counts.noEmail++;
      await mark.update({ bell: true, email: emailed, ...(why ? { noEmail: why } : {}) });
    }
  }
  const done = users.size < size;
  const last = users.empty ? a.cursor ?? null : users.docs[users.docs.length - 1].id;
  await db.runTransaction(async (t) => {
    const cur = (await t.get(ref(db, a.id))).data() as Announcement;
    const further = cur.cursor && last && cur.cursor > last ? cur.cursor : last; // never move the cursor back
    t.update(ref(db, a.id), {
      cursor: further, "counts.bells": FieldValue.increment(counts.bells), "counts.emails": FieldValue.increment(counts.emails),
      "counts.noEmail": FieldValue.increment(counts.noEmail), "counts.skipped": FieldValue.increment(counts.skipped),
      ...(done ? { status: "sent", sentAt: iso(now) } : {}),
    });
  });
  return { done, batch: counts, counts: (await getAnnouncement(db, a.id)).counts };
}

// The reminders cron: one batch of an announcement left half-sent.
export async function continueAnnouncements(db: Firestore, send: Send = sendEmail): Promise<number> {
  const snap = await db.collection("announcements").where("status", "==", "sending").limit(1).get();
  if (snap.empty) return 0;
  const r = await sendBatch(db, snap.docs[0].id, { send });
  return r.batch?.bells ?? 0;
}

// What /announcements/[id] shows: only an announcement that has gone out.
export async function publicAnnouncement(db: Firestore, id: string) {
  const d = await db.doc(`announcements/${id}`).get().catch(() => null);
  const a = d?.data() as Announcement | undefined;
  if (!a || a.status === "draft") return null;
  return { id: d!.id, title: a.title, body: a.body, linkLabel: a.linkLabel, linkUrl: a.linkUrl, sentAt: a.sentAt ?? a.sendStartedAt ?? a.createdAt };
}
