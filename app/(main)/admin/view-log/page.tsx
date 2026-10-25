"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import type { ViewLogEntry } from "@/lib/pii";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });

// Admin → View log: every time a staff member showed a member's masked email or phone (lib/pii.ts), with their reason.
// Super admins and Legal & compliance. Filter by member (account id or payment/order/lead reference) or by staff member.
export default function AdminViewLogPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/reveal");
  const [log, setLog] = useState<ViewLogEntry[] | null>(null);
  const [subject, setSubject] = useState("");
  const [admin, setAdmin] = useState<{ uid: string; name: string } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (q: string) => {
    setError("");
    try { setLog((await call(undefined, q)).log); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load the log"); }
  }, [call]);
  useEffect(() => { if (user) void load(""); }, [user, load]);

  const bySubject = (e: React.FormEvent) => { e.preventDefault(); setAdmin(null); void load(subject.trim() ? `?subject=${encodeURIComponent(subject.trim())}` : ""); };
  const byAdmin = (v: ViewLogEntry) => { setSubject(""); setAdmin({ uid: v.adminUid, name: v.adminName }); void load(`?admin=${encodeURIComponent(v.adminUid)}`); };
  const clear = () => { setSubject(""); setAdmin(null); void load(""); };

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  return (
    <section className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="font-display text-4xl">View log</h1>
      <p className="mt-2 text-sm text-slate">Members&apos; emails and phone numbers are masked in admin pages. Each time someone on the team shows one, it&apos;s written here with their reason. Look for reveals with no clear reason, or one person showing many.</p>

      <form onSubmit={bySubject} className="mt-6 flex flex-wrap gap-2">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Member id, or a payment, order or lead reference" className="min-w-0 flex-1 rounded-xl border border-rule bg-paper px-3 py-2 text-sm" />
        <button className="btn-primary !px-4 !py-2 text-xs">Find</button>
        {(admin || subject) && <button type="button" onClick={clear} className="btn-ghost !px-4 !py-2 text-xs">Show all</button>}
      </form>
      {admin && <p className="mt-3 text-sm">Showing what <b>{admin.name || admin.uid}</b> looked at.</p>}
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}

      {!log ? <p className="mt-8 text-slate">Loading…</p> : log.length === 0 ? <p className="mt-8 text-sm text-slate">Nothing shown yet.</p> : (
        <ul className="mt-6 divide-y divide-rule rounded-xl border border-rule text-sm">
          {log.map((v) => (
            <li key={v.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
              <span className="text-xs text-slate">{when(v.at)}</span>
              <span className="min-w-0">
                <button type="button" onClick={() => byAdmin(v)} className="font-semibold text-crimson-bright hover:text-ink">{v.adminName || v.adminUid}</button>
                {" "}showed the {v.label} on <span className="font-mono text-xs [overflow-wrap:anywhere]">{v.subject}</span>{v.page ? <span className="text-slate"> ({v.page})</span> : null}
                <span className="block text-slate">Why: {v.reason}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
