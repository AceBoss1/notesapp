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
    </section>
  );
}
