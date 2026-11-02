import { createHmac, timingSafeEqual } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getUserEmail } from "./firebase-admin";
import { notifyBell, sendEmail } from "./email";
import { SITE_URL } from "./host";
import { COMPANY_INFO } from "./site";
import { setting } from "@/lib/config";
import { referralLink, type Earning } from "./referrals";
import { summary } from "./referrals-server";
import {
  MAX_ROWS, emptyActivity, hasActivity, inSendWindow, monthTotals, renderReportHtml, renderReportText, reportBell, reportMonth, reportRows,
  reportSubject, reportTip, type MonthActivity, type ReferralReport, type ReportMonth,
} from "./referral-report";

// Server-only. The monthly referrals and affiliate report (template and rules in lib/referral-report.ts).
//
// When: the 1st of each month from 08:00 Lagos time, by the reminders cron (/api/cron/reminders, every ~15 min), about the
// month before. A run sends to the next PER_RUN members due; the month's run is marked done in referralReportRuns/{YYYY-MM}
// once nobody is left, and stops trying three days after it starts (SEND_WINDOW_MS).
// Who: only members with activity that month, found from the month's own records rather than by reading every member:
//   referrals            referredAt in the month  → a friend joined with their link or code
//   referrals            paidSince in the month   → a friend's first real plan payment (a paid conversion)
//   referralEarnings     createdAt in the month   → a plan payment or an affiliate sale earned them a share
//   referralEarnings     releaseAfter in the month→ an earning cleared its hold (became available)
//   referralWithdrawals  at in the month          → they took earnings out (cash or Credit)
// Each is a range on one field (Firestore's automatic single-field indexes: no deploy), and reads only that month's documents,
// so a month with 40 active referrers reads about their records and nothing about the other members.
// Link visits aren't recorded anywhere (/r/<username> only sets a cookie), so they aren't in the report.
// Not to: members who turned it off (emailPrefs/{uid}.referralReport === false), suspended accounts, or anyone without an email.
// Once: referralReports/{uid}_{YYYY-MM} is created (create(), so two overlapping runs can't both claim it) before the email goes,
// so a re-run never sends twice. Members with no activity get no email and no marker.

const PER_RUN = 40;
const MARKERS = "referralReports";
const RUNS = "referralReportRuns";
export const REFERRALS_PATH = "/profile/referrals";
export const EMAIL_SETTINGS_PATH = "/profile/account#email";

// ---- the member's choice (emailPrefs/{uid}, shared with the weekly digest) ----
export async function reportWanted(db: Firestore, uid: string): Promise<boolean> {
  return (await db.doc(`emailPrefs/${uid}`).get()).data()?.referralReport !== false;
}
export async function setReportWanted(db: Firestore, uid: string, on: boolean, via: "settings" | "link" = "settings"): Promise<void> {
  await db.doc(`emailPrefs/${uid}`).set({ referralReport: on, updatedAt: new Date().toISOString(), via }, { merge: true });
}

// One-click "turn off the monthly report" links, signed like the digest's (a different purpose, so one can't stand in for the other).
const secret = () => setting("EMAIL_LINK_SECRET") || setting("CRON_SECRET") || "";
export function reportToken(uid: string): string {
  return createHmac("sha256", secret()).update(`referral-report:${uid}`).digest("base64url").slice(0, 32);
}
export function validReportToken(uid: string, token: string): boolean {
  if (!secret() || !uid || !token) return false;
  const a = Buffer.from(reportToken(uid)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const reportUnsubscribeUrl = (uid: string) =>
  secret() ? `${SITE_URL}/api/referrals/report/unsubscribe?u=${encodeURIComponent(uid)}&t=${reportToken(uid)}` : `${SITE_URL}${EMAIL_SETTINGS_PATH}`;

// ---- the month's activity, for everyone who had any ----
export async function monthActivity(db: Firestore, month: ReportMonth, now = new Date()): Promise<Map<string, MonthActivity>> {
  const range = (col: string, field: string) => db.collection(col).where(field, ">=", month.start).where(field, "<", month.end).get();
  const [joined, converted, earned, cleared, taken] = await Promise.all([
    range("referrals", "referredAt"), range("referrals", "paidSince"), range("referralEarnings", "createdAt"),
    range("referralEarnings", "releaseAfter"), range("referralWithdrawals", "at"),
  ]);
  const by = new Map<string, MonthActivity>();
  const of = (uid: unknown) => {
    const k = String(uid ?? "");
    if (!by.has(k)) by.set(k, emptyActivity());
    return by.get(k)!;
  };
  for (const d of joined.docs) {
    const r = d.data();
    if (r.referredBy) of(r.referredBy).signups.push({ at: String(r.referredAt), paying: !!r.paidSince && String(r.paidSince) <= now.toISOString() });
  }
  for (const d of converted.docs) if (d.data().referredBy) of(d.data().referredBy).conversions++;
  for (const d of earned.docs) { const e = d.data() as Earning; if (e.uid) of(e.uid).earnings.push(e); }
  for (const d of cleared.docs) {
    const e = d.data() as Earning;
    // Only holds that ended by now count (a hold ending later this month is still pending when an admin previews mid-month).
    if (e.uid && e.status !== "reversed" && e.releaseAfter <= now.toISOString()) of(e.uid).clearedKobo += Number(e.kobo) || 0;
  }
  for (const d of taken.docs) {
    const w = d.data();
    if (w.uid) of(w.uid).withdrawals.push({ kobo: Number(w.kobo) || 0, bonusKobo: Number(w.bonusKobo) || 0, method: String(w.method ?? ""), at: String(w.at) });
  }
  by.delete("");
  for (const [uid, a] of by) if (!hasActivity(a)) by.delete(uid);
  return by;
}

// ---- one member's report ----
export async function buildReport(db: Firestore, uid: string, month: ReportMonth, a: MonthActivity, now = new Date()): Promise<ReferralReport | null> {
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u || u.suspended === true || u.teen === true || u.kid === true || !u.username) return null;
  const s = await summary(db, uid, now);
  const username = String(u.username);
  const rows = reportRows(a, now);
  const base = {
    name: String(u.displayName || username), username, month: { id: month.id, label: month.label },
    asOf: now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }),
    totals: monthTotals(a),
    allTime: { availableKobo: s.availableKobo, pendingKobo: s.pendingKobo, withdrawnKobo: s.paidOutKobo, friendsJoined: s.friendsJoined },
    rows: rows.slice(0, MAX_ROWS), moreRows: Math.max(0, rows.length - MAX_ROWS),
    link: referralLink(SITE_URL, username), code: username.toUpperCase(),
    referralsUrl: `${SITE_URL}${REFERRALS_PATH}`, affiliatesUrl: `${SITE_URL}/affiliates`, settingsUrl: `${SITE_URL}${EMAIL_SETTINGS_PATH}`,
    unsubscribeUrl: reportUnsubscribeUrl(uid), site: SITE_URL, company: `${COMPANY_INFO.legalName} · RC ${COMPANY_INFO.rcNumber}`,
  };
  return { ...base, tip: reportTip(base) };
}

export type ReportDeps = { send?: typeof sendEmail; emailOf?: (uid: string) => Promise<string | null>; bell?: typeof notifyBell };

export function reportEmail(to: string, r: ReferralReport, preview?: string) {
  return {
    to, subject: `${preview ? `[Preview for @${preview}] ` : ""}${reportSubject(r)}`, text: renderReportText(r), html: renderReportHtml(r),
    // One-click unsubscribe in Gmail, Yahoo and Apple Mail (RFC 8058), when the link is signed.
    ...(!preview && r.unsubscribeUrl.includes("/unsubscribe?") ? { headers: { "List-Unsubscribe": `<${r.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
  };
}

// ---- the monthly send (called by the reminders cron; `force` lets an admin send outside the window) ----
export async function monthlyReferralReports(db: Firestore, now = new Date(), deps: ReportDeps & { force?: boolean } = {}): Promise<number> {
  const send = deps.send ?? sendEmail, emailOf = deps.emailOf ?? getUserEmail, bell = deps.bell ?? notifyBell;
  const month = reportMonth(now);
  if (!deps.force && !inSendWindow(month, now)) return 0;
  const runRef = db.doc(`${RUNS}/${month.id}`);
  if ((await runRef.get()).data()?.done === true) return 0;

  const active = await monthActivity(db, month, now);
  const uids = Array.from(active.keys()).sort();
  const [markers, prefs] = uids.length
    ? await Promise.all([db.getAll(...uids.map((u) => db.doc(`${MARKERS}/${u}_${month.id}`))), db.getAll(...uids.map((u) => db.doc(`emailPrefs/${u}`)))])
    : [[], []];
  const done = new Set(markers.filter((m) => m.exists).map((m) => m.id.slice(0, -(month.id.length + 1))));
  const optedOut = new Set(prefs.filter((p) => p.data()?.referralReport === false).map((p) => p.id));
  const due = uids.filter((u) => !done.has(u) && !optedOut.has(u));
  const batch = due.slice(0, PER_RUN);

  let sent = 0;
  for (const uid of batch) {
    const marker = db.doc(`${MARKERS}/${uid}_${month.id}`);
    try { await marker.create({ uid, month: month.id, status: "claimed", at: now.toISOString() }); }
    catch (e) { if ((e as { code?: number }).code === 6) continue; throw e; } // another run has it (ALREADY_EXISTS)
    const r = await buildReport(db, uid, month, active.get(uid)!, now).catch(() => null);
    if (!r) { await marker.update({ status: "skipped" }); continue; }
    const to = await emailOf(uid);
    if (!to) { await marker.update({ status: "no-email" }); continue; }
    const ok = await send(reportEmail(to, r)).catch(() => false);
    await bell({ uid, type: "referral", linkHref: REFERRALS_PATH, message: reportBell(r) }).catch(() => {});
    await marker.update({ status: ok ? "sent" : "failed", earnedKobo: r.totals.earnedKobo, sentAt: new Date().toISOString() });
    if (ok) sent++;
  }
  await runRef.set({
    month: month.id, active: uids.length, ...(sent ? { sent: FieldValue.increment(sent) } : {}),
    done: due.length <= batch.length, updatedAt: now.toISOString(),
  }, { merge: true });
  return sent;
}

// ---- Admin → Referrals: one member's report, sent to the admin ----
export async function previewReport(db: Firestore, uid: string, month: ReportMonth, now = new Date()): Promise<{ report: ReferralReport | null; active: boolean }> {
  const a = (await monthActivity(db, month, now)).get(uid);
  return { report: await buildReport(db, uid, month, a ?? emptyActivity(), now), active: !!a };
}
