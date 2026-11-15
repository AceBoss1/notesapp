"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import type { BlockedAccount } from "@/lib/email-blocklist-server";

const btn = "rounded-full border border-rule px-3 py-1.5 text-xs hover:border-crimson hover:text-crimson disabled:opacity-40";

// Admin → Throwaway emails (lib/email-blocklist.ts): the domains no one can join with (a domain also blocks its subdomains), and
// finding or suspending accounts that already use one. A domain added here is refused by sign-up and firestore.rules at once.
export default function AdminBlockedEmailsPage() {
  const { user, loading } = useAdminAuth();
  const [builtIn, setBuiltIn] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [accounts, setAccounts] = useState<BlockedAccount[] | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const call = useCallback(async (body?: Record<string, unknown>) => {
    const token = await user!.getIdToken();
    const res = await fetch("/api/admin/blocked-emails", { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Failed");
    return j;
  }, [user]);
  useEffect(() => { if (user) call().then((j) => { setBuiltIn(j.builtIn); setAdded(j.added); }, (e) => setError(e.message)); }, [user, call]);
  const run = async (tag: string, body: Record<string, unknown>, then: (j: Record<string, unknown>) => void) => {
    setBusy(tag); setError(""); setNote("");
    try { then(await call(body)); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } finally { setBusy(""); }
  };
  if (loading || !user) return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate">Loading…</div>;
  const waiting = accounts?.filter((a) => a.username && !a.suspended).length ?? 0;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="eyebrow">Admin · People &amp; trust</p>
      <h1 className="mt-1 font-display text-3xl text-ink">Throwaway emails</h1>
      <p className="mt-2 text-sm text-slate">Nobody can join with an address at these domains or any of their subdomains. A domain added here is refused straight away, by the sign-up forms and by the database rules.</p>
      {error && <p className="mt-4 rounded-xl bg-crimson/10 px-3 py-2 text-sm text-crimson" role="alert">{error}</p>}
      {note && <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800" role="status">{note}</p>}

      <section className="card mt-6 p-5">
        <h2 className="font-ui text-base font-semibold text-ink">Blocked domains</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {builtIn.map((d) => <li key={d} className="rounded-full bg-paper px-3 py-1 text-xs text-ink" title="Built in">{d} · built in</li>)}
          {added.map((d) => (
            <li key={d} className="flex items-center gap-1 rounded-full border border-rule px-3 py-1 text-xs text-ink">{d}
              <button type="button" aria-label={`Remove ${d}`} disabled={!!busy} onClick={() => run(`rm-${d}`, { action: "remove", domain: d }, (j) => setAdded(j.added as string[]))} className="ml-1 text-slate hover:text-crimson">×</button>
            </li>
          ))}
        </ul>
        <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="new-domains">Add domains</label>
        <textarea id="new-domains" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={"temp-mail.example\nanother-throwaway.example"} className="mt-1 w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm" />
        <p className="mt-1 text-xs text-slate">One per line, or separated by commas. Ordinary providers such as Gmail can't be added.</p>
        <button type="button" disabled={!draft.trim() || !!busy} onClick={() => run("add", { action: "add", domains: draft }, (j) => { setAdded(j.added as string[]); setDraft(""); setNote("Added. New sign-ups at these domains are refused from now."); })} className="btn-primary mt-3 !py-2 text-sm">{busy === "add" ? "Adding…" : "Add"}</button>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-ui text-base font-semibold text-ink">Accounts already using one</h2>
        <p className="mt-1 text-sm text-slate">Looks through every account&apos;s sign-in email. Suspended members see this reason: &quot;This account uses a temporary (throwaway) email address…&quot; and can contact support to move to their own address.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!!busy} onClick={() => run("find", { action: "find" }, (j) => setAccounts(j.accounts as BlockedAccount[]))} className={btn}>{busy === "find" ? "Looking…" : "Find accounts"}</button>
          {accounts && waiting > 0 && (
            <button type="button" disabled={!!busy} onClick={() => { if (confirm(`Suspend ${waiting} account${waiting === 1 ? "" : "s"}?`)) void run("suspend", { action: "suspend" }, (j) => { setNote(`Suspended ${j.suspended}.`); void run("find", { action: "find" }, (k) => setAccounts(k.accounts as BlockedAccount[])); }); }} className="rounded-full bg-crimson px-3 py-1.5 text-xs font-semibold text-paper disabled:opacity-40">{busy === "suspend" ? "Suspending…" : `Suspend ${waiting}`}</button>
          )}
        </div>
        {accounts && (accounts.length === 0
          ? <p className="mt-3 text-sm text-slate">No accounts use a blocked domain.</p>
          : <table className="mt-3 w-full text-left text-sm"><thead><tr className="text-xs text-slate"><th className="py-1">Account</th><th>Domain</th><th>Status</th></tr></thead>
              <tbody>{accounts.map((a) => <tr key={a.uid} className="border-t border-rule"><td className="py-1.5">{a.username ? `@${a.username}` : <span className="text-slate">no profile</span>}</td><td>{a.domain}</td><td>{a.suspended ? "Suspended" : a.username ? "Active" : "—"}</td></tr>)}</tbody></table>)}
      </section>
    </div>
  );
}
