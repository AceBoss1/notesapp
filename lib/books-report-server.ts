import { createHmac, timingSafeEqual } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getUserEmail } from "./firebase-admin";
import { notifyBell, sendEmail } from "./email";
import { SITE_URL } from "./host";
import { COMPANY_INFO } from "./site";
import { setting } from "@/lib/config";
import { catalog, context, type Ctx } from "./books-server";
import { DEFAULT_CATEGORIES, debtors, openKobo, pnl, type Entry, type Party } from "./books";
import { stockState } from "./inventory";
import {
  inSendWindow, previousMonth, renderReportHtml, renderReportText, reportBell, reportFrom, reportMonth, reportSubject, type BooksReport, type ReportMonth,
} from "./books-report";

// Server-only. The monthly Business books summary (template and rules in lib/books-report.ts), sent exactly as the monthly referrals
// report is (lib/referral-report-server.ts):
//
// When: the 1st of each month from 08:00 Lagos time, by the reminders cron (/api/cron/reminders, every ~15 min), about the month before.
// A run sends to the next PER_RUN sellers due; the month's run is marked done in bookReportRuns/{YYYY-MM} once nobody is left, and stops
// trying three days after it starts (SEND_WINDOW_MS).
// Who: sellers with at least one entry that month (not voided), found from the month's own entries: bookEntries where `on` is in the
// month (a range on one field, so Firestore's automatic index; no deploy), reading only ownerUid and voidedAt. No entries, no email.
// Not to: sellers who turned it off (emailPrefs/{uid}.booksReport === false), suspended accounts, accounts that can't use Books any more,
// or anyone without an email. Staff never get it; it goes to the books' owner.
// Once: bookReports/{uid}_{YYYY-MM} is created (create(), so two overlapping runs can't both claim it) before the email goes, so a re-run
// never sends twice.
const PER_RUN = 40;
const MARKERS = "bookReports";
const RUNS = "bookReportRuns";
export const BOOKS_PATH = "/profile/books";
export const EMAIL_SETTINGS_PATH = "/profile/account#email";

// ---- the seller's choice (emailPrefs/{uid}, shared with the weekly digest), on unless switched off ----
export async function booksReportWanted(db: Firestore, uid: string): Promise<boolean> {
  return (await db.doc(`emailPrefs/${uid}`).get()).data()?.booksReport !== false;
}
export async function setBooksReportWanted(db: Firestore, uid: string, on: boolean, via: "settings" | "link" = "settings"): Promise<void> {
  await db.doc(`emailPrefs/${uid}`).set({ booksReport: on, updatedAt: new Date().toISOString(), via }, { merge: true });
}

// One-click "turn off the monthly books email" links, signed like the digest's (their own purpose, so one can't stand in for another).
const secret = () => setting("EMAIL_LINK_SECRET") || setting("CRON_SECRET") || "";
export function booksReportToken(uid: string): string {
  return createHmac("sha256", secret()).update(`books-report:${uid}`).digest("base64url").slice(0, 32);
}
export function validBooksReportToken(uid: string, token: string): boolean {
  if (!secret() || !uid || !token) return false;
  const a = Buffer.from(booksReportToken(uid)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const booksReportUnsubscribeUrl = (uid: string) =>
  secret() ? `${SITE_URL}/api/books/report/unsubscribe?u=${encodeURIComponent(uid)}&t=${booksReportToken(uid)}` : `${SITE_URL}${EMAIL_SETTINGS_PATH}`;

// ---- who had entries in the month ----
export async function activeSellers(db: Firestore, month: ReportMonth): Promise<Map<string, number>> {
  const s = await db.collection("bookEntries").where("on", ">=", month.start).where("on", "<=", month.end).select("ownerUid", "voidedAt").get();
  const by = new Map<string, number>();
  for (const d of s.docs) {
    const o = String(d.data().ownerUid ?? "");
    if (o && !d.data().voidedAt) by.set(o, (by.get(o) ?? 0) + 1);
  }
  return by;
}

const entriesIn = async (db: Firestore, owner: string, start: string, end: string): Promise<Entry[]> => {
  const base = db.collection("bookEntries").where("ownerUid", "==", owner);
  try { return (await base.where("on", ">=", start).where("on", "<=", end).get()).docs.map((d) => ({ ...(d.data() as Omit<Entry, "id">), id: d.id })); }
  catch (e) { if ((e as { code?: number }).code !== 9) throw e; return (await base.get()).docs.map((d) => ({ ...(d.data() as Omit<Entry, "id">), id: d.id })).filter((x) => x.on >= start && x.on <= end); }
};

// ---- one seller's report ----
export async function buildBooksReport(db: Firestore, uid: string, month: ReportMonth, entries: number, now = new Date()): Promise<BooksReport | null> {
  let c: Ctx;
  try { c = await context(db, uid, uid, now); } catch { return null; } // suspended, or no longer on a plan with Books
  const u = c.profile as { displayName?: string; username?: string; teen?: boolean; kid?: boolean };
  if (u.teen === true || u.kid === true) return null;
  const before = previousMonth(month);
  const [es, prev, parties, open, cat, st] = await Promise.all([
    entriesIn(db, uid, month.start, month.end), entriesIn(db, uid, before.start, before.end),
    db.collection("bookParties").where("ownerUid", "==", uid).get().then((s) => s.docs.map((d) => ({ ...(d.data() as Omit<Party, "id">), id: d.id }))),
    db.collection("bookEntries").where("ownerUid", "==", uid).where("open", "==", true).get().then((s) => s.docs.map((d) => ({ ...(d.data() as Omit<Entry, "id">), id: d.id })).filter((e) => openKobo(e) > 0)),
    catalog(c), db.doc(`bookSettings/${uid}`).get(),
  ]);
  const cats = [...DEFAULT_CATEGORIES, ...((st.data()?.categories as { id: string; label: string }[] | undefined) ?? [])];
  const owed = debtors(parties, open, c.today);
  const low = cat.filter((x) => x.stock !== null && stockState(x.stock, x.lowAt) !== "ok").sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0)).map((x) => ({ title: x.title, stock: x.stock ?? 0 }));
  const shop = String(u.displayName || (u.username ? `@${u.username}` : "Your shop"));
  return reportFrom(pnl(es, cats), prev.length ? pnl(prev, cats) : null, {
    name: shop.split(/\s+/)[0].replace(/['’]s$/i, ""), shop, month: { id: month.id, label: month.label }, entries,
    asOf: now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }),
    owed: { totalKobo: owed.reduce((n, d) => n + d.openKobo, 0), overdueKobo: owed.reduce((n, d) => n + d.overdueKobo, 0), people: owed.length, late: owed.filter((d) => d.overdueKobo > 0).map((d) => ({ name: d.party.name, kobo: d.overdueKobo, daysLate: d.daysLate })) },
    low, pnlUrl: `${SITE_URL}${BOOKS_PATH}?tab=pnl&period=month&back=1`, booksUrl: `${SITE_URL}${BOOKS_PATH}`, settingsUrl: `${SITE_URL}${EMAIL_SETTINGS_PATH}`,
    unsubscribeUrl: booksReportUnsubscribeUrl(uid), site: SITE_URL, company: `${COMPANY_INFO.legalName} · RC ${COMPANY_INFO.rcNumber}`,
  }, st.data()?.hideProfitInEmail !== true);
}

export function booksReportEmail(to: string, r: BooksReport, preview?: string) {
  return {
    to, subject: `${preview ? `[Preview for ${preview}] ` : ""}${reportSubject(r)}`, text: renderReportText(r), html: renderReportHtml(r),
    // One-click unsubscribe in Gmail, Yahoo and Apple Mail (RFC 8058), when the link is signed.
    ...(!preview && r.unsubscribeUrl.includes("/unsubscribe?") ? { headers: { "List-Unsubscribe": `<${r.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
  };
}

export type BooksReportDeps = { send?: typeof sendEmail; emailOf?: (uid: string) => Promise<string | null>; bell?: typeof notifyBell; force?: boolean };

// ---- the monthly send (called by the reminders cron; `force` lets an admin or a test send outside the window) ----
export async function monthlyBooksReports(db: Firestore, now = new Date(), deps: BooksReportDeps = {}): Promise<number> {
  const send = deps.send ?? sendEmail, emailOf = deps.emailOf ?? getUserEmail, bell = deps.bell ?? notifyBell;
  const month = reportMonth(now);
  if (!deps.force && !inSendWindow(month, now)) return 0;
  const runRef = db.doc(`${RUNS}/${month.id}`);
  if ((await runRef.get()).data()?.done === true) return 0;

  const active = await activeSellers(db, month);
  const uids = Array.from(active.keys()).sort();
  const [markers, prefs] = uids.length
    ? await Promise.all([db.getAll(...uids.map((u) => db.doc(`${MARKERS}/${u}_${month.id}`))), db.getAll(...uids.map((u) => db.doc(`emailPrefs/${u}`)))])
    : [[], []];
  const done = new Set(markers.filter((m) => m.exists).map((m) => m.id.slice(0, -(month.id.length + 1))));
  const optedOut = new Set(prefs.filter((p) => p.data()?.booksReport === false).map((p) => p.id));
  const due = uids.filter((u) => !done.has(u) && !optedOut.has(u));
  const batch = due.slice(0, PER_RUN);

  let sent = 0;
  for (const uid of batch) {
    const marker = db.doc(`${MARKERS}/${uid}_${month.id}`);
    try { await marker.create({ uid, month: month.id, status: "claimed", at: now.toISOString() }); }
    catch (e) { if ((e as { code?: number }).code === 6) continue; throw e; } // another run has it (ALREADY_EXISTS)
    const r = await buildBooksReport(db, uid, month, active.get(uid) ?? 0, now).catch((e) => { console.error("books report failed", uid, e); return null; });
    if (!r) { await marker.update({ status: "skipped" }); continue; }
    const to = await emailOf(uid);
    if (!to) { await marker.update({ status: "no-email" }); continue; }
    const ok = await send(booksReportEmail(to, r)).catch(() => false);
    await bell({ uid, type: "books", linkHref: `${BOOKS_PATH}?tab=pnl&period=month&back=1`, message: reportBell(r) }).catch(() => {});
    await marker.update({ status: ok ? "sent" : "failed", salesKobo: r.sales.totalKobo, sentAt: new Date().toISOString() });
    if (ok) sent++;
  }
  await runRef.set({
    month: month.id, active: uids.length, ...(sent ? { sent: FieldValue.increment(sent) } : {}),
    done: due.length <= batch.length, updatedAt: now.toISOString(),
  }, { merge: true });
  return sent;
}
