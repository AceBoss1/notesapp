"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { BUDGETS, BUDGET_LABEL, LIMITS, SERVICE_LABEL, TRACK, type Budget, type Service, type Track } from "@/lib/partner-network";
import { partnersCall } from "./partners-client";

// What a member can do on a partner's page: ask a solutions partner for help (a request lands in their portal, and they reply in
// messages), ask an association to verify them, join a chapter, or join their workplace with its code. Technology, channel and media
// partners: a link to their profile and website only.
type P = { id: string; name: string; track: Track; services: Service[]; username: string };
type Mine = { memberships: { partnerId: string; status: "pending" | "verified" }[]; partners: { id: string }[] };
const field = "mt-1 block w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink outline-none focus:border-crimson";

export default function PartnerActions({ partner: p }: { partner: P }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [mine, setMine] = useState<Mine | null>(null);
  const [f, setF] = useState({ service: (p.services[0] ?? "") as Service | "", budget: "unsure" as Budget, message: "", ref: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const load = (u: User) => partnersCall<{ mine: Mine }>(u, "/api/partners", "GET").then((j) => setMine(j.mine)).catch(() => {});
  useEffect(() => { if (user) void load(user); }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = TRACK[p.track].members;
  const box = "rounded-[22px] border border-rule bg-card p-6";
  if (p.track !== "solutions" && !m) return (
    <div className={box}>
      <p className="font-display text-xl text-ink">{TRACK[p.track].label}</p>
      <p className="mt-2 text-sm text-slate">{TRACK[p.track].who}</p>
      <p className="mt-4"><Link href={`/u/${p.username}`} className="rounded-full bg-crimson px-5 py-2.5 font-ui text-sm font-bold text-paper">Follow on #NotesApp</Link></p>
    </div>
  );
  if (user === undefined) return <div className={box}><p className="text-sm text-slate">Loading…</p></div>;
  if (!user) return (
    <div className={box}>
      <p className="text-ink">{p.track === "solutions" ? `Sign in to ask ${p.name} for help.` : `Sign in to ${m!.kind === "verified-member" ? "ask to be verified as a member" : m!.kind === "staff" ? "join your workplace" : "join this chapter"}.`}</p>
      <p className="mt-4"><Link href={`/login?next=/partners/${p.id}`} className="rounded-full bg-crimson px-5 py-2.5 font-ui text-sm font-bold text-paper">Sign in</Link></p>
    </div>
  );
  if (mine?.partners.some((x) => x.id === p.id)) return <div className={box}><p className="text-ink">This is your partner page.</p><p className="mt-3"><Link href="/partners/portal" className="font-semibold text-crimson underline">Open your partner portal</Link></p></div>;
  const membership = mine?.memberships.find((x) => x.partnerId === p.id);

  const send = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await partnersCall(user, "/api/partners", "POST", body); setMsg({ ok: true, text: ok }); setF({ ...f, message: "", ref: "" }); await load(user); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't send it." }); }
    finally { setBusy(false); }
  };
  const status = msg && <p role="status" className={`mt-3 rounded-xl p-3 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-crimson/10 text-crimson"}`}>{msg.text}</p>;

  if (p.track === "solutions") return (
    <form className={box} onSubmit={(e) => { e.preventDefault(); void send({ action: "lead", partnerId: p.id, ...f }, `Sent. ${p.name} will reply in your NotesApp messages, usually within two working days.`); }}>
      <p className="font-display text-xl text-ink">Ask {p.name} for help</p>
      <label className="mt-4 block text-sm font-semibold text-ink">What you need
        <select required value={f.service} onChange={(e) => setF({ ...f, service: e.target.value as Service })} className={field}>
          {p.services.map((s) => <option key={s} value={s}>{SERVICE_LABEL[s]}</option>)}
        </select>
      </label>
      <label className="mt-3 block text-sm font-semibold text-ink">Budget
        <select value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value as Budget })} className={field}>
          {BUDGETS.map((b) => <option key={b} value={b}>{BUDGET_LABEL[b]}</option>)}
        </select>
      </label>
      <label className="mt-3 block text-sm font-semibold text-ink">Tell them about it
        <textarea required rows={4} minLength={20} maxLength={LIMITS.message} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} className={field} placeholder="What you do, what you'd like set up, and by when." />
      </label>
      <p className="mt-2 text-xs text-slate">Partners agree their own prices with you. #NotesApp isn&apos;t part of that agreement, but tell us if anything goes wrong.</p>
      {status}
      <button type="submit" disabled={busy} className="mt-4 rounded-full bg-crimson px-6 py-2.5 font-ui text-sm font-bold text-paper disabled:opacity-50">{busy ? "Sending…" : "Send request"}</button>
    </form>
  );

  if (membership) return (
    <div className={box}>
      <p className="text-ink">{membership.status === "pending" ? `Your request is waiting for ${p.name} to confirm it.` : m!.kind === "staff" ? `You've joined ${p.name}. They only see how many staff joined, never who.` : `You're a member of ${p.name}.`}</p>
      {status}
      <button type="button" disabled={busy} onClick={() => { if (confirm(`Leave ${p.name}?`)) void send({ action: "leave", partnerId: p.id }, `You've left ${p.name}.`); }} className="mt-4 text-sm text-crimson underline">Leave</button>
    </div>
  );
  return (
    <form className={box} onSubmit={(e) => { e.preventDefault(); void send({ action: "join", partnerId: p.id, ref: f.ref }, m!.kind === "verified-member" ? `Sent. When ${p.name} confirms you, the badge appears on your profile.` : `Welcome to ${p.name}!`); }}>
      <p className="font-display text-xl text-ink">{m!.join}</p>
      <p className="mt-1 text-sm text-slate">{m!.kind === "verified-member" ? `${p.name} checks its register, then a "Verified member" badge appears on your profile.` : m!.kind === "staff" ? `${p.name} sees only how many staff joined, never who, and never what anyone booked.` : `A "Member" badge appears on your profile. You can leave at any time.`}</p>
      <label className="mt-4 block text-sm font-semibold text-ink">{m!.refLabel}
        <input value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} maxLength={LIMITS.ref} required={m!.kind !== "chapter-member"} className={field} />
        <span className="mt-1 block text-xs font-normal text-slate">{m!.refHint}</span>
      </label>
      {status}
      <button type="submit" disabled={busy} className="mt-4 rounded-full bg-crimson px-6 py-2.5 font-ui text-sm font-bold text-paper disabled:opacity-50">{busy ? "Sending…" : m!.join}</button>
    </form>
  );
}
