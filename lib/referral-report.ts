// The monthly referrals and affiliate report (lib/referral-report-server.ts sends it). Pure: no database here.
// On the 1st of each month from 08:00 Lagos time, each member with activity in the month before gets one email: what they
// brought and earned that month, their balances, a table of the month's sign-ups and sales, their link and code, and a tip.
// Members with no activity get nothing. Buyers are never named, as on the Referrals page.
import { naira } from "./discounts";
import { CREDIT_BONUS, MIN_CASH_KOBO, PLAN_MONTHS, PLAN_SHARE, isAvailable, type Earning, type EarningSource } from "./referrals";

export const LAGOS_OFFSET_MS = 3_600_000; // UTC+1, no daylight saving
export const SEND_HOUR_LAGOS = 8;
export const SEND_WINDOW_MS = 72 * 3_600_000; // a missed cron run still sends within three days
export const MAX_ROWS = 30;

// ---- which month ----
export type ReportMonth = { id: string; label: string; start: string; end: string; sendFrom: number };

function monthOf(y: number, m0: number): ReportMonth {
  const start = Date.UTC(y, m0, 1) - LAGOS_OFFSET_MS, end = Date.UTC(y, m0 + 1, 1) - LAGOS_OFFSET_MS;
  const d = new Date(Date.UTC(y, m0, 15));
  return {
    id: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    label: d.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    start: new Date(start).toISOString(), end: new Date(end).toISOString(),
    sendFrom: end + SEND_HOUR_LAGOS * 3_600_000, // the 1st of the next month, 08:00 Lagos
  };
}
// The calendar month (Lagos time) before the one `now` is in: the one reported on during `now`'s month.
export function reportMonth(now = new Date()): ReportMonth {
  const lagos = new Date(now.getTime() + LAGOS_OFFSET_MS);
  return monthOf(lagos.getUTCFullYear(), lagos.getUTCMonth() - 1);
}
// "2026-10" → that month (admin previews of an earlier month).
export function monthById(id: string): ReportMonth | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(id);
  return m ? monthOf(Number(m[1]), Number(m[2]) - 1) : null;
}
export const inSendWindow = (month: ReportMonth, now: Date) => now.getTime() >= month.sendFrom && now.getTime() < month.sendFrom + SEND_WINDOW_MS;

// ---- one member's month ----
export type MonthActivity = {
  signups: { at: string; paying: boolean }[]; // friends who joined with the member's link or code that month
  conversions: number; // friends whose first real plan payment was that month
  earnings: Earning[]; // plan payments and affiliate sales that month (refunded ones too, shown as refunded)
  clearedKobo: number; // earnings whose hold ended that month
  withdrawals: { kobo: number; bonusKobo: number; method: string; at: string }[];
};
export const emptyActivity = (): MonthActivity => ({ signups: [], conversions: 0, earnings: [], clearedKobo: 0, withdrawals: [] });
export const hasActivity = (a: MonthActivity) =>
  a.signups.length > 0 || a.conversions > 0 || a.earnings.length > 0 || a.clearedKobo > 0 || a.withdrawals.length > 0;

export type RowStatus = "joined" | "paying" | "pending" | "available" | "paid" | "refunded";
export type ReportRow = { at: string; kind: "signup" | EarningSource; what: string; amountKobo: number | null; commissionKobo: number | null; status: RowStatus };
export type ReferralReport = {
  name: string; username: string; month: { id: string; label: string }; asOf: string;
  totals: { signups: number; conversions: number; sales: number; planPayments: number; earnedKobo: number; clearedKobo: number; withdrawnKobo: number };
  allTime: { availableKobo: number; pendingKobo: number; withdrawnKobo: number; friendsJoined: number };
  rows: ReportRow[]; moreRows: number;
  link: string; code: string; referralsUrl: string; affiliatesUrl: string; settingsUrl: string; unsubscribeUrl: string; site: string; company: string; tip: string;
};

const SOURCE: Record<EarningSource, string> = { plan: "Plan payment", store: "Shop sale", digital: "Download sale", course: "Course sale" };
export const earningStatus = (e: Pick<Earning, "status" | "releaseAfter">, now: Date): RowStatus =>
  e.status === "reversed" ? "refunded" : e.status === "withdrawn" ? "paid" : isAvailable(e, now) ? "available" : "pending";

// The table: sign-ups and earnings, newest first. Only what was bought and when, never who bought it or joined.
export function reportRows(a: MonthActivity, now: Date): ReportRow[] {
  const rows: ReportRow[] = [
    ...a.signups.map((s): ReportRow => ({ at: s.at, kind: "signup", what: "A friend joined with your link or code", amountKobo: null, commissionKobo: null, status: s.paying ? "paying" : "joined" })),
    ...a.earnings.map((e): ReportRow => ({ at: e.createdAt, kind: e.source, what: `${SOURCE[e.source]}: ${e.title}`, amountKobo: e.baseKobo, commissionKobo: e.kobo, status: earningStatus(e, now) })),
  ];
  return rows.sort((x, y) => y.at.localeCompare(x.at));
}

export function monthTotals(a: MonthActivity): ReferralReport["totals"] {
  const live = a.earnings.filter((e) => e.status !== "reversed");
  return {
    signups: a.signups.length, conversions: a.conversions,
    sales: live.filter((e) => e.source !== "plan").length, planPayments: live.filter((e) => e.source === "plan").length,
    earnedKobo: live.reduce((s, e) => s + e.kobo, 0), clearedKobo: a.clearedKobo,
    withdrawnKobo: a.withdrawals.reduce((s, w) => s + w.kobo, 0),
  };
}

// One short tip, chosen from where the member is.
export function reportTip(r: Pick<ReferralReport, "totals" | "allTime" | "code" | "affiliatesUrl">): string {
  if (r.allTime.availableKobo >= MIN_CASH_KOBO) return `You have ${naira(r.allTime.availableKobo)} ready. Take it as cash to your bank, or as NotesApp Credit with ${Math.round(CREDIT_BONUS * 100)}% more.`;
  if (r.totals.signups > 0 && r.totals.conversions === 0) return `Friends who joined get their first month of Pro or Business free. A friendly reminder before it ends helps: you earn ${Math.round(PLAN_SHARE * 100)}% of their plan for ${PLAN_MONTHS} months from their first payment.`;
  if (r.totals.sales === 0) return `Products on the affiliate marketplace (${r.affiliatesUrl}) pay a share of every sale through your link. Pick one your followers would like and share it with a line on why.`;
  return `Your code ${r.code} works like your link: friends type it under "Have a discount code?" when they choose a plan. Put it in your bio.`;
}

// ---- the email ----
export const reportSubject = (r: Pick<ReferralReport, "month" | "totals">) =>
  `Your referrals report for ${r.month.label}${r.totals.earnedKobo > 0 ? `: ${naira(r.totals.earnedKobo)} earned` : ""}`;

// The bell: the month in one line.
export function reportBell(r: Pick<ReferralReport, "month" | "totals">): string {
  const t = r.totals, bits: string[] = [];
  if (t.signups) bits.push(`${t.signups} sign-up${t.signups === 1 ? "" : "s"}`);
  if (t.conversions) bits.push(`${t.conversions} paying`);
  if (t.sales) bits.push(`${t.sales} affiliate sale${t.sales === 1 ? "" : "s"}`);
  bits.push(`${naira(t.earnedKobo)} earned`);
  return `Your referrals in ${r.month.label}: ${bits.join(", ")}.`;
}

const STATUS_LABEL: Record<RowStatus, string> = { joined: "Joined", paying: "Paying", pending: "Pending", available: "Available", paid: "Paid", refunded: "Refunded" };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

export function renderReportText(r: ReferralReport): string {
  const t = r.totals, a = r.allTime;
  const lines = [
    `Dear ${r.name},`, "", `Here's your referrals and affiliate report for ${r.month.label}.`, "",
    `${r.month.label}:`,
    `- Friends who joined: ${t.signups}`, `- Paid conversions: ${t.conversions}`, `- Affiliate sales: ${t.sales}`,
    ...(t.planPayments ? [`- Plan payments you earned on: ${t.planPayments}`] : []),
    `- Earned this month: ${naira(t.earnedKobo)}`,
    ...(t.clearedKobo ? [`- Cleared the hold this month: ${naira(t.clearedKobo)}`] : []),
    ...(t.withdrawnKobo ? [`- Taken out this month: ${naira(t.withdrawnKobo)}`] : []),
    "", `All time (as of ${r.asOf}):`, `- Available: ${naira(a.availableKobo)}`, `- Pending: ${naira(a.pendingKobo)}`, `- Withdrawn: ${naira(a.withdrawnKobo)}`, "",
  ];
  if (r.rows.length) {
    lines.push("This month's sign-ups and sales:");
    for (const x of r.rows) lines.push(`- ${day(x.at)} · ${x.what}${x.amountKobo !== null ? ` · ${naira(x.amountKobo)}` : ""}${x.commissionKobo !== null ? ` · you earn ${naira(x.commissionKobo)}` : ""} · ${STATUS_LABEL[x.status]}`);
    if (r.moreRows) lines.push(`- and ${r.moreRows} more on your Referrals page`);
    lines.push("");
  }
  lines.push(`Your link: ${r.link}`, `Your code: ${r.code}`, `See your referrals: ${r.referralsUrl}`, "", `Tip: ${r.tip}`, "",
    `Turn off the monthly referrals report: ${r.unsubscribeUrl}`, `Email settings: ${r.settingsUrl}`, `Sent by #NotesApp · ${r.company}`);
  return lines.join("\n");
}

const C = { ink: "#1A1210", body: "#3B302C", muted: "#6B5E5A", rule: "#E8DDD6", paper: "#FBF6F2", crimson: "#7A0328", link: "#A6093D", moss: "#1F7A4D", amber: "#8A5A00" };
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const CHIP: Record<RowStatus, [string, string]> = {
  joined: ["#F3ECE8", C.body], paying: ["#E3F1EA", C.moss], pending: ["#FBF0DC", C.amber], available: ["#E3F1EA", C.moss], paid: ["#F3E3E8", C.crimson], refunded: ["#F3ECE8", C.muted],
};

const tile = (label: string, value: string, width: string) =>
  `<td width="${width}" valign="top" style="padding:5px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${C.paper}" style="background:${C.paper};border:1px solid ${C.rule};border-radius:8px;padding:12px 12px 10px;">
<p style="margin:0;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${C.muted};">${label}</p>
<p style="margin:4px 0 0;font-family:${SERIF};font-size:22px;line-height:1.2;color:${C.ink};">${value}</p></td></tr></table></td>`;

export function renderReportHtml(r: ReferralReport): string {
  const t = r.totals, a = r.allTime;
  const heading = (s: string) => `<p style="margin:22px 0 6px;padding-bottom:8px;border-bottom:1px solid ${C.rule};font-family:${SANS};font-size:13px;font-weight:800;letter-spacing:1px;color:${C.ink};">${s}</p>`;
  const row = (x: ReportRow) => `<tr>
<td valign="top" style="padding:10px 8px 10px 0;border-bottom:1px solid ${C.rule};font-family:${SANS};font-size:13px;color:${C.muted};white-space:nowrap;">${esc(day(x.at))}</td>
<td valign="top" style="padding:10px 8px;border-bottom:1px solid ${C.rule};font-family:${SANS};font-size:14px;line-height:1.4;color:${C.ink};">${esc(x.what)}${x.amountKobo !== null ? `<br><span style="font-size:12px;color:${C.muted};">Paid ${naira(x.amountKobo)}</span>` : ""}
<br><span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:999px;background:${CHIP[x.status][0]};font-size:11px;font-weight:700;color:${CHIP[x.status][1]};">${STATUS_LABEL[x.status]}</span></td>
<td valign="top" align="right" style="padding:10px 0 10px 8px;border-bottom:1px solid ${C.rule};font-family:${SANS};font-size:14px;font-weight:700;color:${x.status === "refunded" ? C.muted : C.ink};white-space:nowrap;">${x.commissionKobo !== null ? (x.status === "refunded" ? `<s>${naira(x.commissionKobo)}</s>` : naira(x.commissionKobo)) : "&ndash;"}</td></tr>`;
  const button = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;"><tr><td bgcolor="${C.crimson}" style="background:${C.crimson};border-radius:999px;"><a href="${esc(r.referralsUrl)}" style="display:inline-block;padding:12px 26px;font-family:${SANS};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">See your referrals</a></td></tr></table>`;
  const extra = [t.planPayments ? `${t.planPayments} plan payment${t.planPayments === 1 ? "" : "s"} earned on` : "", t.clearedKobo ? `${naira(t.clearedKobo)} cleared the hold` : "", t.withdrawnKobo ? `${naira(t.withdrawnKobo)} taken out` : ""].filter(Boolean);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(reportSubject(r))}</title>
<style>@media only screen and (max-width:480px){.na-pad{padding-left:16px !important;padding-right:16px !important;}.na-tile3{display:block !important;width:100% !important;}}</style></head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(reportBell(r))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.paper}" style="background:${C.paper};"><tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td height="6" bgcolor="${C.crimson}" style="background:${C.crimson};font-size:0;line-height:0;border-radius:8px 8px 0 0;">&nbsp;</td></tr>
<tr><td class="na-pad" bgcolor="#ffffff" style="background:#ffffff;padding:24px 28px 0;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};">
  <a href="${esc(r.site)}" style="text-decoration:none;"><img src="${esc(r.site)}/images/brand/email-logo.png" width="160" alt="#NotesApp" style="display:block;border:0;height:auto;width:160px;"></a>
  <p style="margin:22px 0 4px;font-family:${SANS};font-size:12px;font-weight:800;letter-spacing:1px;color:${C.crimson};">REFERRALS &amp; AFFILIATES</p>
  <p style="margin:0 0 14px;font-family:${SERIF};font-size:30px;line-height:1.15;color:${C.ink};">Your ${esc(r.month.label)} report</p>
  <p style="margin:0;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};">Dear ${esc(r.name)}, here&rsquo;s your referrals and affiliate report for ${esc(r.month.label)}.</p>
</td></tr>
<tr><td class="na-pad" bgcolor="#ffffff" style="background:#ffffff;padding:0 23px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};">
  <div style="padding:0 5px;">${heading(esc(r.month.label.toUpperCase()))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>${tile("Friends joined", String(t.signups), "50%")}${tile("Paid conversions", String(t.conversions), "50%")}</tr>
    <tr>${tile("Affiliate sales", String(t.sales), "50%")}${tile("Earned this month", naira(t.earnedKobo), "50%")}</tr>
  </table>
  ${extra.length ? `<p style="margin:6px 5px 0;font-family:${SANS};font-size:13px;color:${C.muted};">Also this month: ${extra.join(" &middot; ")}.</p>` : ""}
  <div style="padding:0 5px;">${heading(`ALL TIME <span style="font-weight:400;letter-spacing:0;color:${C.muted};">&middot; as of ${esc(r.asOf)}</span>`)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    ${tile("Available", naira(a.availableKobo), "33%").replace("<td ", '<td class="na-tile3" ')}${tile("Pending", naira(a.pendingKobo), "33%").replace("<td ", '<td class="na-tile3" ')}${tile("Withdrawn", naira(a.withdrawnKobo), "34%").replace("<td ", '<td class="na-tile3" ')}
  </tr></table>
</td></tr>
<tr><td class="na-pad" bgcolor="#ffffff" style="background:#ffffff;padding:0 28px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};">
  ${r.rows.length ? `${heading("SIGN-UPS AND SALES THIS MONTH")}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:4px 8px 6px 0;font-family:${SANS};font-size:11px;font-weight:700;color:${C.muted};">DATE</td><td style="padding:4px 8px 6px;font-family:${SANS};font-size:11px;font-weight:700;color:${C.muted};">WHAT</td><td align="right" style="padding:4px 0 6px 8px;font-family:${SANS};font-size:11px;font-weight:700;color:${C.muted};">YOU EARN</td></tr>
    ${r.rows.map(row).join("")}
  </table>
  ${r.moreRows ? `<p style="margin:8px 0 0;font-family:${SANS};font-size:13px;color:${C.muted};">And ${r.moreRows} more on your Referrals page.</p>` : ""}
  <p style="margin:8px 0 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.muted};">Buyers and friends are never named. Pending earnings wait for the payment to clear; available ones are ready to take.</p>` : ""}
  ${heading("YOUR LINK AND CODE")}
  <p style="margin:0 0 6px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.ink};"><a href="${esc(r.link)}" style="color:${C.link};font-weight:600;word-break:break-all;">${esc(r.link)}</a></p>
  <p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.ink};">Code: <strong style="font-family:Menlo,Consolas,monospace;color:${C.crimson};letter-spacing:1px;">${esc(r.code)}</strong></p>
  ${button}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 26px;"><tr><td bgcolor="${C.paper}" style="background:${C.paper};border-left:4px solid ${C.crimson};border-radius:0 8px 8px 0;padding:14px 16px;font-family:${SANS};font-size:14px;line-height:1.55;color:${C.body};"><strong style="color:${C.crimson};">Tip:</strong> ${esc(r.tip)}</td></tr></table>
</td></tr>
<tr><td class="na-pad" bgcolor="#ffffff" style="background:#ffffff;padding:16px 28px 22px;border:1px solid ${C.rule};border-radius:0 0 8px 8px;font-family:${SANS};font-size:12px;line-height:1.7;color:${C.muted};">
  <strong style="color:${C.crimson};">#NotesApp</strong> &middot; ${esc(r.company)}<br>
  You get this once a month, only when something happened with your referrals. <a href="${esc(r.unsubscribeUrl)}" style="color:${C.muted};">Turn off the monthly report</a> &middot; <a href="${esc(r.settingsUrl)}" style="color:${C.muted};">Email settings</a> &middot; <a href="${esc(r.site)}/help/referrals" style="color:${C.muted};">Help</a>
</td></tr>
</table></td></tr></table></body></html>`;
}
