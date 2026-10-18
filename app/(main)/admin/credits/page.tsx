"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import type { CreditKind, Member, TopUpLog } from "@/lib/admin-credits";

type Super = { uid: string; name: string; email: string; allowed: boolean };
type Data = { canTopUp: boolean; owner: boolean; supers: Super[]; log: TopUpLog[] };
const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
const KINDS: { key: CreditKind; label: string; note: string }[] = [
  { key: "nana", label: "Nana credit", note: "Used after their free Nana allowance; never expires." },
  { key: "wallet", label: "NotesApp Credit", note: "Wallet money for boosts, badges, gifts, shop items and sessions." },
];

// Admin → Credits: add Nana credit or wallet credit to a member by hand (lib/admin-credits.ts). Only the owner, and the super admins the
// owner allows here, can add; other super admins see the log. Every top-up needs a reason and rings the member's bell.
export default function AdminCreditsPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/credits");
  const [data, setData] = useState<Data | null>(null);
  const [q, setQ] = useState("");
  const [members, setMembers] = useState<Member[] | null>(null);
  const [picked, setPicked] = useState<Member | null>(null);
  const [kind, setKind] = useState<CreditKind>("nana");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [allow, setAllow] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(""); setMsg("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(""); }
  }, []);
  const load = useCallback(() => run("load", async () => { const d: Data = await call(); setData(d); setAllow(d.supers.filter((s) => s.allowed).map((s) => s.uid)); }), [call, run]);
  useEffect(() => { if (user) void load(); }, [user, load]);

  const search = (e: React.FormEvent) => { e.preventDefault(); void run("search", async () => { setMembers((await call(undefined, `?q=${encodeURIComponent(q)}`)).members); }); };
  const n = Number(amount);
  const ready = !!picked && Number.isFinite(n) && n >= 1 && reason.trim().length >= 5;
  const add = () => {
    if (!picked || !ready) return;
    const who = picked.username ? `@${picked.username}` : picked.displayName;
    if (!confirm(`Add ₦${n.toLocaleString("en-NG")} of ${kind === "nana" ? "Nana credit" : "NotesApp Credit"} to ${who}?\n\nReason: ${reason.trim()}`)) return;
    void run("add", async () => {
      const r = await call({ action: "topup", uid: picked.uid, kind, naira: n, reason });
      setPicked(r.member); setMembers((m) => m?.map((x) => (x.uid === r.member.uid ? r.member : x)) ?? null);
      setData((d) => (d ? { ...d, log: [r.log, ...d.log] } : d));
      setAmount(""); setReason(""); setMsg(`Added ${naira(r.log.kobo)} to ${who}. They've been notified.`);
    });
  };

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-4xl">Credits</h1>
      <p className="mt-2 text-sm text-slate">Add Nana credit or NotesApp Credit to a member&apos;s account by hand: goodwill, a refund that can&apos;t go back to their card, or an emergency. Every top-up needs a reason, tells the member, and is logged below for good.</p>
      {error && <p className="mt-4 text-sm text-crimson" role="alert">{error}</p>}
      {msg && <p className="mt-4 text-sm text-emerald-800" role="status">{msg}</p>}
      {data && !data.canTopUp && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-ink">Only the owner, and the super admins they allow, can add credit. You can see the log.</p>}

      {data?.canTopUp && (
        <div className="card mt-6 p-5">
          <h2 className="font-ui text-lg font-bold text-ink">Find a member</h2>
          <form onSubmit={search} className="mt-3 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email, @username or name" aria-label="Search members" className="min-w-0 flex-1 rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-crimson" />
            <button disabled={!!busy || q.trim().length < 2} className="btn-primary !px-4 !py-2 text-xs">{busy === "search" ? "Searching…" : "Search"}</button>
          </form>
          {members && (members.length ? (
            <ul className="mt-3 divide-y divide-rule rounded-xl border border-rule">
              {members.map((m) => (
                <li key={m.uid}>
                  <button type="button" onClick={() => { setPicked(m); setMsg(""); }} aria-pressed={picked?.uid === m.uid}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${picked?.uid === m.uid ? "bg-crimson/5" : "hover:bg-paper"}`}>
                    {m.avatar ? <img src={m.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <span className="h-9 w-9 shrink-0 rounded-full bg-rule" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{m.displayName || m.username}{m.username && <span className="font-normal text-slate"> @{m.username}</span>}</span>
                      <span className="block truncate text-xs text-slate">{m.email || "no email"} · Nana {naira(m.nanaKobo)} · Wallet {naira(m.walletKobo)}</span>
                    </span>
                    {picked?.uid === m.uid && <span className="shrink-0 text-xs font-bold text-crimson">Selected</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-slate">No one found. Try their full email or exact username.</p>)}

          {picked && (
            <div className="mt-5 border-t border-rule pt-5">
              <p className="text-sm text-ink">Adding to <strong>{picked.displayName || picked.username}</strong>{picked.username && <> (@{picked.username})</>}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {KINDS.map((k) => (
                  <button key={k.key} type="button" onClick={() => setKind(k.key)} aria-pressed={kind === k.key}
                    className={`rounded-xl border p-3 text-left ${kind === k.key ? "border-crimson bg-crimson/5" : "border-rule hover:border-crimson/50"}`}>
                    <span className="block font-ui text-sm font-bold text-ink">{k.label}</span>
                    <span className="block text-xs text-slate">{k.note} Now {naira(k.key === "nana" ? picked.nanaKobo : picked.walletKobo)}.</span>
                  </button>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">Amount, ₦
                <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" aria-label="Amount in naira" className="w-32 rounded-lg border border-rule bg-paper px-3 py-2 text-right text-sm outline-none focus:border-crimson" />
              </label>
              <label className="mt-3 block text-sm">Reason <span className="text-xs text-slate">(goes in the log; the member doesn&apos;t see it)</span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} className="mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-crimson" />
              </label>
              <button disabled={!!busy || !ready} onClick={add} className="btn-primary mt-3 !px-5 !py-2 text-xs">{busy === "add" ? "Adding…" : ready ? `Add ₦${n.toLocaleString("en-NG")}` : "Add"}</button>
            </div>
          )}
        </div>
      )}

      {data?.owner && (
        <div className="card mt-6 p-5">
          <h2 className="font-ui text-lg font-bold text-ink">Who else can add credit</h2>
          <p className="mt-1 text-sm text-slate">Only you, for now. In an emergency, switch on a super admin here; switch them off when it&apos;s over.</p>
          {data.supers.length ? (
            <ul className="mt-3 space-y-2">
              {data.supers.map((s) => (
                <li key={s.uid}>
                  <label className="flex items-center gap-3 text-sm">
                    <input type="checkbox" checked={allow.includes(s.uid)} onChange={(e) => setAllow((a) => (e.target.checked ? [...a, s.uid] : a.filter((x) => x !== s.uid)))} className="h-4 w-4 accent-crimson" />
                    <span className="min-w-0"><span className="font-semibold text-ink">{s.name}</span> <span className="text-slate [overflow-wrap:anywhere]">{s.email}</span></span>
                  </label>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-slate">There are no other super admins. Add one in Team access first.</p>}
          {data.supers.length > 0 && (
            <button disabled={!!busy} onClick={() => run("allow", async () => { const r = await call({ action: "allow", uids: allow }); setAllow(r.allowed); setMsg(r.allowed.length ? `${r.allowed.length} super admin${r.allowed.length === 1 ? "" : "s"} can add credit.` : "Only you can add credit."); })}
              className="btn-ghost mt-3 !px-4 !py-2 text-xs">{busy === "allow" ? "Saving…" : "Save"}</button>
          )}
        </div>
      )}

      <h2 className="mt-10 font-display text-2xl">Log</h2>
      {data && (data.log.length ? (
        <ul className="mt-3 divide-y divide-rule rounded-xl border border-rule bg-card text-sm">
          {data.log.map((l) => (
            <li key={l.id} className="px-3 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span><strong>{naira(l.kobo)}</strong> {l.kind === "nana" ? "Nana credit" : "NotesApp Credit"} → {l.member}</span>
                <span className="text-xs text-slate">{when(l.at)}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate [overflow-wrap:anywhere]">{l.reason} · by {l.byEmail}</p>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-slate">Nothing added yet.</p>)}
    </section>
  );
}
