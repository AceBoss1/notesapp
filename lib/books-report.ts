// The monthly Business books summary (docs/BUSINESS-BOOKS.md, step 9; lib/books-report-server.ts sends it). Pure: no database here.
// On the 1st of each month from 08:00 Lagos time, each seller who had entries in the month before gets one email: sales (walk-in and
// online apart), expenses, profit and the change on the month before, best sellers, money owed and how much of it is late, what's running
// low, and a link to the P&L. A month with no entries sends nothing. Same timing and rules as the referrals report (lib/referral-report.ts).
import { firstName, naira, type Pnl } from "./books";

export const LAGOS_OFFSET_MS = 3_600_000; // UTC+1, no daylight saving
export const SEND_HOUR_LAGOS = 8;
export const SEND_WINDOW_MS = 72 * 3_600_000; // a missed cron run still sends within three days
export const MAX_LATE = 5;
export const MAX_LOW = 6;
export const MAX_BEST = 5;

// ---- which month ----
// start and end are Lagos business days (YYYY-MM-DD), as bookEntries.on is.
export type ReportMonth = { id: string; label: string; start: string; end: string; sendFrom: number };
function monthOf(y: number, m0: number): ReportMonth {
  const d = new Date(Date.UTC(y, m0, 15));
  const yy = d.getUTCFullYear(), mm = d.getUTCMonth();
  const startMs = Date.UTC(yy, mm, 1), endMs = Date.UTC(yy, mm + 1, 1);
  return {
    id: `${yy}-${String(mm + 1).padStart(2, "0")}`,
    label: d.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    start: new Date(startMs).toISOString().slice(0, 10), end: new Date(endMs - 86_400_000).toISOString().slice(0, 10),
    sendFrom: endMs - LAGOS_OFFSET_MS + SEND_HOUR_LAGOS * 3_600_000, // the 1st of the next month, 08:00 Lagos
  };
}
// The calendar month (Lagos time) before the one `now` is in.
export function reportMonth(now = new Date()): ReportMonth {
  const lagos = new Date(now.getTime() + LAGOS_OFFSET_MS);
  return monthOf(lagos.getUTCFullYear(), lagos.getUTCMonth() - 1);
}
export function monthById(id: string): ReportMonth | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(id);
  return m ? monthOf(Number(m[1]), Number(m[2]) - 1) : null;
}
export const previousMonth = (m: ReportMonth): ReportMonth => monthOf(Number(m.id.slice(0, 4)), Number(m.id.slice(5, 7)) - 2);
export const inSendWindow = (month: ReportMonth, now: Date) => now.getTime() >= month.sendFrom && now.getTime() < month.sendFrom + SEND_WINDOW_MS;

// ---- one seller's report ----
export type BooksReport = {
  name: string; shop: string; month: { id: string; label: string }; asOf: string; entries: number;
  sales: { totalKobo: number; walkinKobo: number; onlineKobo: number; importedKobo: number; count: number; onlineCount: number };
  refundsKobo: number; costKobo: number; expensesKobo: number; // expenses include our commission on online orders
  profitKobo: number | null; // null when the seller turned "show profit in emails" off
  change: number | null; // profit against the month before, a whole percent
  best: { title: string; units: number; salesKobo: number }[];
  owed: { totalKobo: number; overdueKobo: number; people: number; late: { name: string; kobo: number; daysLate: number }[] };
  low: { title: string; stock: number }[];
  noCostItems: number;
  pnlUrl: string; booksUrl: string; settingsUrl: string; unsubscribeUrl: string; site: string; company: string;
};
export function reportFrom(p: Pnl, before: Pnl | null, extra: Pick<BooksReport, "name" | "shop" | "month" | "asOf" | "entries" | "owed" | "low" | "pnlUrl" | "booksUrl" | "settingsUrl" | "unsubscribeUrl" | "site" | "company">, showProfit = true): BooksReport {
  const change = before && before.netKobo > 0 ? Math.round(((p.netKobo - before.netKobo) / before.netKobo) * 100) : null;
  return {
    ...extra,
    sales: { totalKobo: p.salesKobo, walkinKobo: p.walkinKobo, onlineKobo: p.onlineKobo, importedKobo: p.importedKobo, count: p.sales, onlineCount: p.onlineSales },
    refundsKobo: p.refundsKobo, costKobo: p.costKobo, expensesKobo: p.expensesKobo + p.commissionKobo,
    profitKobo: showProfit ? p.netKobo : null, change: showProfit ? change : null,
    best: p.best.slice(0, MAX_BEST).map((b) => ({ title: b.title, units: b.units, salesKobo: b.salesKobo })),
    noCostItems: p.noCostItems,
    owed: { ...extra.owed, late: extra.owed.late.slice(0, MAX_LATE).map((l) => ({ ...l, name: firstName(l.name) })) },
    low: extra.low.slice(0, MAX_LOW),
  };
}

export const reportSubject = (r: Pick<BooksReport, "month" | "shop" | "profitKobo" | "sales">) =>
  `${r.shop}'s books for ${r.month.label}: ${naira(r.sales.totalKobo)} in sales${r.profitKobo !== null ? `, ${naira(r.profitKobo)} profit` : ""}`;
export function reportBell(r: Pick<BooksReport, "month" | "sales" | "profitKobo" | "owed">): string {
  const bits = [`${naira(r.sales.totalKobo)} in sales`];
  if (r.profitKobo !== null) bits.push(`${naira(r.profitKobo)} profit`);
  if (r.owed.overdueKobo) bits.push(`${naira(r.owed.overdueKobo)} owed is late`);
  return `Your books for ${r.month.label}: ${bits.join(", ")}.`;
}

export function renderReportText(r: BooksReport): string {
  const lines = [
    `Hello ${r.name},`, "", `Here's ${r.shop}'s month in Business books: ${r.month.label}.`, "",
    `Sales: ${naira(r.sales.totalKobo)} (${r.sales.count} ${r.sales.count === 1 ? "sale" : "sales"})`,
    `- Walk-in: ${naira(r.sales.walkinKobo)}`, `- Online store: ${naira(r.sales.onlineKobo)}${r.sales.onlineCount ? ` (${r.sales.onlineCount} ${r.sales.onlineCount === 1 ? "order" : "orders"})` : ""}`,
    ...(r.sales.importedKobo ? [`- Imported: ${naira(r.sales.importedKobo)}`] : []),
    ...(r.refundsKobo ? [`Refunds: ${naira(r.refundsKobo)}`] : []),
    `Cost of what you sold: ${naira(r.costKobo)}`, `Expenses: ${naira(r.expensesKobo)}`,
    ...(r.profitKobo !== null ? [`Profit: ${naira(r.profitKobo)}${r.change !== null ? ` (${r.change >= 0 ? "up" : "down"} ${Math.abs(r.change)}% on the month before)` : ""}`] : []),
    "",
  ];
  if (r.best.length) { lines.push("Best sellers:"); r.best.forEach((b, i) => lines.push(`${i + 1}. ${b.title}: ${b.units} sold, ${naira(b.salesKobo)}`)); lines.push(""); }
  lines.push(`Money owed to you: ${naira(r.owed.totalKobo)} from ${r.owed.people} ${r.owed.people === 1 ? "person" : "people"}${r.owed.overdueKobo ? `, ${naira(r.owed.overdueKobo)} of it late` : ""}`);
  for (const l of r.owed.late) lines.push(`- ${l.name}: ${naira(l.kobo)}, ${l.daysLate} ${l.daysLate === 1 ? "day" : "days"} late`);
  lines.push("");
  if (r.low.length) { lines.push("Running low:"); for (const x of r.low) lines.push(`- ${x.title}: ${x.stock <= 0 ? "sold out" : `${x.stock} left`}`); lines.push(""); }
  lines.push(`Profit and loss for ${r.month.label}: ${r.pnlUrl}`, `Open Business books: ${r.booksUrl}`, "",
    `Sales recorded, expenses recorded and stock are always counted apart: stock is never added to sales or profit.`, "",
    `Turn off the monthly books email: ${r.unsubscribeUrl}`, `Email settings: ${r.settingsUrl}`, `Sent by #NotesApp · ${r.company}`);
  return lines.join("\n");
}

const C = { ink: "#1A1210", body: "#3B302C", muted: "#6B5E5A", rule: "#E8DDD6", paper: "#FBF6F2", crimson: "#7A0328", link: "#A6093D", moss: "#1F7A4D", red: "#B42318" };
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const tile = (label: string, value: string, width: string, sub = "", tone = C.ink) =>
  `<td width="${width}" valign="top" style="padding:5px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${C.paper}" style="background:${C.paper};border:1px solid ${C.rule};border-radius:8px;padding:12px 12px 10px;">
<p style="margin:0;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${C.muted};">${label}</p>
<p style="margin:4px 0 0;font-family:${SERIF};font-size:22px;line-height:1.2;color:${tone};">${value}</p>${sub ? `<p style="margin:3px 0 0;font-family:${SANS};font-size:12px;color:${C.muted};">${sub}</p>` : ""}</td></tr></table></td>`;

export function renderReportHtml(r: BooksReport): string {
  const heading = (s: string) => `<p style="margin:22px 0 6px;padding-bottom:8px;border-bottom:1px solid ${C.rule};font-family:${SANS};font-size:13px;font-weight:800;letter-spacing:1px;color:${C.ink};">${s}</p>`;
  const row = (left: string, right: string, sub = "", tone = C.ink) => `<tr><td valign="top" style="padding:9px 8px 9px 0;border-bottom:1px solid ${C.rule};font-family:${SANS};font-size:14px;line-height:1.4;color:${C.ink};">${left}${sub ? `<br><span style="font-size:12px;color:${C.muted};">${sub}</span>` : ""}</td><td valign="top" align="right" style="padding:9px 0 9px 8px;border-bottom:1px solid ${C.rule};font-family:${SANS};font-size:14px;font-weight:700;color:${tone};white-space:nowrap;">${right}</td></tr>`;
  const button = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;"><tr><td bgcolor="${C.crimson}" style="background:${C.crimson};border-radius:999px;"><a href="${esc(r.pnlUrl)}" style="display:inline-block;padding:12px 26px;font-family:${SANS};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">See ${esc(r.month.label)}&rsquo;s profit and loss</a></td></tr></table>`;
  const profit = r.profitKobo !== null
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0;"><tr><td bgcolor="${C.crimson}" style="background:${C.crimson};border-radius:12px;padding:18px 20px;">
<p style="margin:0;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:1px;color:#F3D9E0;">PROFIT IN ${esc(r.month.label.toUpperCase())}</p>
<p style="margin:6px 0 0;font-family:${SERIF};font-size:34px;line-height:1.1;color:#ffffff;">${naira(r.profitKobo)}</p>
<p style="margin:6px 0 0;font-family:${SANS};font-size:13px;color:#F3D9E0;">${naira(r.sales.totalKobo - r.refundsKobo)} sales &minus; ${naira(r.costKobo)} cost of what you sold &minus; ${naira(r.expensesKobo)} expenses${r.change !== null ? ` &middot; ${r.change >= 0 ? "&#9650;" : "&#9660;"} ${Math.abs(r.change)}% on the month before` : ""}</p></td></tr></table>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(reportSubject(r))}</title>
<style>@media only screen and (max-width:480px){.na-pad{padding-left:16px !important;padding-right:16px !important;}.na-tile{display:block !important;width:100% !important;}}</style></head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(reportBell(r))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.paper}" style="background:${C.paper};"><tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td height="6" bgcolor="${C.crimson}" style="background:${C.crimson};font-size:0;line-height:0;border-radius:8px 8px 0 0;">&nbsp;</td></tr>
<tr><td class="na-pad" bgcolor="#ffffff" style="background:#ffffff;padding:24px 28px 0;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};">
  <a href="${esc(r.site)}" style="text-decoration:none;"><img src="${esc(r.site)}/images/brand/email-logo.png" width="160" alt="#NotesApp" style="display:block;border:0;height:auto;width:160px;"></a>
  <p style="margin:22px 0 4px;font-family:${SANS};font-size:12px;font-weight:800;letter-spacing:1px;color:${C.crimson};">BUSINESS BOOKS &middot; ${esc(r.shop.toUpperCase())}</p>
  <p style="margin:0 0 14px;font-family:${SERIF};font-size:30px;line-height:1.15;color:${C.ink};">Your ${esc(r.month.label)}</p>
  <p style="margin:0;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};">Hello ${esc(r.name)}, here&rsquo;s your shop&rsquo;s month: ${r.entries} ${r.entries === 1 ? "entry" : "entries"} in your books.</p>
  ${profit}
</td></tr>
<tr><td class="na-pad" bgcolor="#ffffff" style="background:#ffffff;padding:0 23px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};">
  <div style="padding:0 5px;">${heading("SALES AND EXPENSES")}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>${tile("Sales", naira(r.sales.totalKobo), "50%", `${r.sales.count} ${r.sales.count === 1 ? "sale" : "sales"}`).replace("<td ", '<td class="na-tile" ')}${tile("Expenses", naira(r.expensesKobo), "50%", "incl. our commission on online orders").replace("<td ", '<td class="na-tile" ')}</tr>
    <tr>${tile("Walk-in", naira(r.sales.walkinKobo), "50%").replace("<td ", '<td class="na-tile" ')}${tile("Online store", naira(r.sales.onlineKobo), "50%", r.sales.onlineCount ? `${r.sales.onlineCount} ${r.sales.onlineCount === 1 ? "order" : "orders"}` : "").replace("<td ", '<td class="na-tile" ')}</tr>
  </table>
  ${r.noCostItems ? `<p style="margin:6px 5px 0;font-family:${SANS};font-size:13px;color:${C.muted};">${r.noCostItems} ${r.noCostItems === 1 ? "item has" : "items have"} no cost price yet, so profit may be a little high.</p>` : ""}
</td></tr>
<tr><td class="na-pad" bgcolor="#ffffff" style="background:#ffffff;padding:0 28px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};">
  ${r.best.length ? `${heading("BEST SELLERS")}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${r.best.map((b) => row(esc(b.title), `${b.units} sold`, naira(b.salesKobo))).join("")}</table>` : ""}
  ${heading(`MONEY OWED TO YOU <span style="font-weight:400;letter-spacing:0;color:${C.muted};">&middot; as of ${esc(r.asOf)}</span>`)}
  <p style="margin:0 0 4px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.ink};"><strong>${naira(r.owed.totalKobo)}</strong> from ${r.owed.people} ${r.owed.people === 1 ? "person" : "people"}${r.owed.overdueKobo ? `, <strong style="color:${C.red};">${naira(r.owed.overdueKobo)} late</strong>` : ""}.</p>
  ${r.owed.late.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${r.owed.late.map((l) => row(esc(l.name), naira(l.kobo), `${l.daysLate} ${l.daysLate === 1 ? "day" : "days"} late`, C.red)).join("")}</table>` : ""}
  ${r.low.length ? `${heading("RUNNING LOW")}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${r.low.map((x) => row(esc(x.title), x.stock <= 0 ? "Sold out" : `${x.stock} left`, "", x.stock <= 0 ? C.red : C.ink)).join("")}</table>` : ""}
  ${button}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 26px;"><tr><td bgcolor="${C.paper}" style="background:${C.paper};border-left:4px solid ${C.crimson};border-radius:0 8px 8px 0;padding:14px 16px;font-family:${SANS};font-size:14px;line-height:1.55;color:${C.body};"><strong style="color:${C.crimson};">Honest numbers:</strong> sales recorded, expenses recorded and stock are always counted apart. What you hold in stock is never added to sales or profit.</td></tr></table>
</td></tr>
<tr><td class="na-pad" bgcolor="#ffffff" style="background:#ffffff;padding:16px 28px 22px;border:1px solid ${C.rule};border-radius:0 0 8px 8px;font-family:${SANS};font-size:12px;line-height:1.7;color:${C.muted};">
  <strong style="color:${C.crimson};">#NotesApp</strong> &middot; ${esc(r.company)}<br>
  You get this once a month, only when your books had entries. <a href="${esc(r.unsubscribeUrl)}" style="color:${C.muted};">Turn off the monthly books email</a> &middot; <a href="${esc(r.settingsUrl)}" style="color:${C.muted};">Email settings</a> &middot; <a href="${esc(r.site)}/help/business-books" style="color:${C.muted};">Help</a>
</td></tr>
</table></td></tr></table></body></html>`;
}
