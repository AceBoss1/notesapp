"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { naira } from "@/lib/discounts";

// Referral and affiliate earnings this week (lib/referrals-server.ts weeklyLeaders). There is no monthly cap: a member whose week
// jumps well past their usual week is flagged (and support is emailed once), and finance can hold their earnings for review.
type Row = { uid: string; username: string; displayName: string; thisWeekKobo: number; earlierWeeksKobo: number[]; alert: boolean };

export default function AdminReferralsPage() {
  const { user, loading } = useAdminAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [who, setWho] = useState("");
  const [month, setMonth] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(() => api<{ rows: Row[] }>("/api/admin/referrals").then((r) => setRows(r.rows)).catch((e) => setError(e.message)), []);
  useEffect(() => { if (user) void load(); }, [user, load]);

  async function hold(r: Row) {
    const days = Number(window.prompt(`Hold @${r.username}'s earnings for how many days?`, "14"));
    if (!days) return;
    setError(""); setNote("");
    try {
      const x = await api<{ held: number }>("/api/admin/referrals", { body: { uid: r.uid, days } });
      setNote(`Held ${x.held} earning${x.held === 1 ? "" : "s"} of @${r.username} for ${days} days.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't hold."); }
  }

  // The monthly referrals report: one member's, sent to you; or last month's that are still due, now (super admins).
  async function report(action: "report_preview" | "report_send_now") {
    if (action === "report_send_now" && !window.confirm("Send last month's referrals reports that haven't gone yet? Each member still gets one at most.")) return;
    setError(""); setNote(""); setBusy(action);
    try {
      if (action === "report_preview") {
        const x = await api<{ to: string; active: boolean; month: string }>("/api/admin/referrals", { body: { action, username: who, month: month || undefined } });
        setNote(`Sent @${who.replace(/^@/, "")}'s ${x.month} report to ${x.to}.${x.active ? "" : " They had no activity that month, so they wouldn't get it."}`);
      } else {
        const x = await api<{ sent: number; month: string }>("/api/admin/referrals", { body: { action } });
        setNote(`Sent ${x.sent} ${x.month} report${x.sent === 1 ? "" : "s"}.`);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't send."); }
    setBusy("");
  }

  if (loading || !user) return <section className="mx-auto max-w-4xl px-6 py-10 text-sm text-slate">Loading…</section>;
  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="font-ui text-sm text-crimson">← Admin</Link>
      <h1 className="mt-2 font-display text-4xl text-ink">Referrals</h1>
      <p className="mt-2 text-sm text-slate">Top earners from referral and affiliate links this week. There is no cap; ⚠ marks a week well past the member&apos;s usual (support is emailed once a week). Hold keeps their earnings back while you look.</p>
      {error && <p className="mt-4 rounded-lg bg-crimson/10 px-3 py-2 text-sm text-crimson" role="alert">{error}</p>}
      {note && <p className="mt-4 rounded-lg bg-moss/10 px-3 py-2 text-sm text-moss" role="status">{note}</p>}
      {rows === null ? <p className="mt-6 text-sm text-slate">Loading…</p> : rows.length === 0 ? <p className="mt-6 text-sm text-slate">No referral earnings in the last five weeks.</p> : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="font-ui text-xs text-slate"><tr><th className="py-2">Member</th><th>This week</th><th>Usual week</th><th></th></tr></thead>
            <tbody className="divide-y divide-rule">
              {rows.map((r) => (
                <tr key={r.uid}>
                  <td className="py-2"><Link href={`/u/${r.username}`} className="text-ink hover:text-crimson">{r.alert ? "⚠ " : ""}@{r.username}</Link> <span className="text-slate">{r.displayName}</span></td>
                  <td className={r.alert ? "font-bold text-crimson" : "text-ink"}>{naira(r.thisWeekKobo)}</td>
                  <td className="text-slate">{naira(Math.round(r.earlierWeeksKobo.reduce((a, b) => a + b, 0) / 4))}</td>
                  <td className="text-right"><button type="button" onClick={() => hold(r)} className="rounded-full border border-rule px-3 py-1 font-ui text-xs font-semibold text-ink hover:border-crimson">Hold</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="card mt-10 p-5">
        <h2 className="font-display text-2xl text-ink">Monthly report</h2>
        <p className="mt-1 text-sm text-slate">On the 1st of each month from 8 AM Lagos time, members with referral activity in the month before get one email (and a bell). Send yourself any member&apos;s report to check it.</p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate">Member
            <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="@username" className="mt-1 block w-44 rounded-lg border border-rule px-3 py-2 text-sm text-ink" />
          </label>
          <label className="text-xs text-slate">Month
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 block rounded-lg border border-rule px-3 py-2 text-sm text-ink" />
          </label>
          <button type="button" disabled={!who.trim() || !!busy} onClick={() => report("report_preview")} className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50">{busy === "report_preview" ? "Sending…" : "Send me a preview"}</button>
          <button type="button" disabled={!!busy} onClick={() => report("report_send_now")} className="btn-ghost !px-4 !py-2 text-sm disabled:opacity-50">{busy === "report_send_now" ? "Sending…" : "Send due reports now"}</button>
        </div>
        <p className="mt-2 text-xs text-slate">Month: last month if left empty. &quot;Send due reports now&quot; is for the owner and super admins, if the scheduled run was missed.</p>
      </div>
    </section>
  );
}
