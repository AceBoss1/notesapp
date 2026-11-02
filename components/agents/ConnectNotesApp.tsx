"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ABILITIES, ASK_LABEL, MONEY_NOTE, READ_SCOPES, grantCounts, type Ask, type GrantPolicy } from "@/lib/agents/scopes";
import type { AgentUrls } from "@/lib/agents/urls";
import { AgentShell, CopyButton, Glyph, Initials, Switch } from "./ui";

// Connect NotesApp: an outside AI assistant asks to work on the member's account; the member checks the code, chooses what it may see and
// do, and connects (or cancels). Opened by an assistant's OAuth sign-in (?response_type=code&client_id=…), by a pairing code (?code=…,
// from /link) or by an open request (?id=…). Every address shown comes from the server for the domain being viewed.
type View = {
  request: { id: string; kind: "oauth" | "device"; agentName: string; maker: string; fromHost: string; code: string; expiresAt: string; status: string; connectedBefore: boolean };
  defaults: GrantPolicy; choices: { accessDays: number[]; actionsPerDay: number[]; discountNaira: number[] };
  linkCodeMinutes: number; logDays: number; urls: AgentUrls;
  me: { allowed: boolean; name: string; username: string; avatar: string } | null;
};
const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const sel = "rounded-lg border border-rule bg-card px-2.5 py-1.5 font-ui text-xs font-semibold text-ink";

export default function ConnectNotesApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [id, setId] = useState("");
  const [code, setCode] = useState("");
  const [view, setView] = useState<View | null>(null);
  const [policy, setPolicy] = useState<GrantPolicy | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"connected" | "cancelled" | null>(null);
  const [typed, setTyped] = useState("");
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Open the request named in the address (or start the OAuth one).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("id")) { setId(q.get("id")!); return; }
    if (q.get("code")) { setCode(q.get("code")!); return; }
    if (q.get("response_type") && q.get("client_id")) {
      fetch("/api/agents/authorize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", params: Object.fromEntries(q) }) })
        .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); window.history.replaceState(null, "", `/connect?id=${j.id}`); setId(j.id); })
        .catch((e) => setError(e.message || "This connect link didn't work. Ask your assistant to try again."));
    }
  }, []);

  const load = useCallback(async () => {
    if (!id && !code) return;
    const headers: Record<string, string> = user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {};
    const r = await fetch(`/api/agents/authorize?${id ? `id=${encodeURIComponent(id)}` : `code=${encodeURIComponent(code)}`}`, { headers });
    const j = await r.json();
    if (!r.ok) { setError(j.error || "That didn't work."); return; }
    setView(j); setPolicy((p) => p ?? j.defaults); setError("");
    if (!id) { setId(j.request.id); window.history.replaceState(null, "", `/connect?id=${j.request.id}`); }
  }, [id, code, user]);
  useEffect(() => { if (user !== undefined) void load(); }, [user, load]);

  const counts = useMemo(() => (policy ? grantCounts(policy) : { sees: 0, does: 0, asks: 0 }), [policy]);
  const name = view?.request.agentName ?? "Your assistant";

  async function answer(action: "approve" | "deny") {
    if (!user || !view) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/agents/authorize", { method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ action, id: view.request.id, policy }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "That didn't work.");
      if (j.redirect) { window.location.href = j.redirect; return; }
      setDone(action === "approve" ? "connected" : "cancelled");
    } catch (e) { setError(e instanceof Error ? e.message : "That didn't work."); }
    finally { setBusy(false); }
  }

  // No request yet: type the code the assistant shows.
  if (!id && !code && !error) {
    return (
      <AgentShell>
        <main className="mx-auto max-w-md px-4 py-10">
          <div className="card p-6 text-center">
            <p className="eyebrow">Connect NotesApp</p>
            <h1 className="mt-2 font-display text-3xl">Type the code your assistant shows</h1>
            <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); setCode(typed); }}>
              <input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} placeholder="K7QM-4F2D" maxLength={9} aria-label="Code" className="min-w-0 flex-1 rounded-xl border border-rule bg-paper px-3 py-2.5 text-center font-mono text-lg tracking-widest" />
              <button className="btn-primary !px-5" disabled={typed.replace(/[^A-Za-z0-9]/g, "").length !== 8}>Next</button>
            </form>
          </div>
        </main>
      </AgentShell>
    );
  }

  const next = `/connect?id=${view?.request.id ?? id}`;
  return (
    <AgentShell>
      <main className="mx-auto grid max-w-[1120px] gap-5 px-4 pb-8 pt-5 lg:grid-cols-[1fr,340px] lg:items-start lg:gap-8 lg:px-8 lg:pb-14 lg:pt-9">
        <div className="min-w-0 space-y-4">
          {/* ---- who is asking ---- */}
          <section className="card px-5 py-6 text-center lg:px-9 lg:py-8">
            <div className="mb-3.5 flex items-center justify-center gap-2.5">
              <Initials name={name} size={56} rounded="rounded-2xl" />
              <span className="flex items-center gap-1 text-rule" aria-hidden="true"><i className="h-1.5 w-1.5 rounded-full bg-rule" /><i className="h-1.5 w-1.5 rounded-full bg-rule" /><i className="h-1.5 w-1.5 rounded-full bg-rule" /><svg viewBox="0 0 24 24" className="mx-0.5 h-4 w-4 text-crimson" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg><i className="h-1.5 w-1.5 rounded-full bg-rule" /><i className="h-1.5 w-1.5 rounded-full bg-rule" /><i className="h-1.5 w-1.5 rounded-full bg-rule" /></span>
              <Image src="/images/brand/icon-192.png" alt="" width={56} height={56} className="h-14 w-14 rounded-2xl" />
            </div>
            <p className="eyebrow justify-center">Connect NotesApp</p>
            {error && !view ? (
              <><h1 className="mt-2 font-display text-[27px] leading-tight lg:text-[34px]">This connect request can&apos;t be used</h1><p className="mt-3 text-sm text-slate" role="alert">{error}</p><p className="mt-4 text-sm"><Link href="/connect" className="font-semibold text-crimson">Type a code instead</Link></p></>
            ) : !view ? <p className="mt-4 text-sm text-slate">Loading…</p> : (
              <>
                <h1 className="mt-2 font-display text-[27px] leading-tight lg:text-[34px]">{name} wants to work on your NotesApp account</h1>
                <p className="mx-auto mt-3 max-w-md text-[13px] text-slate">
                  {view.request.maker ? `${name} is an AI assistant made by ${view.request.maker}. ` : `${name} is an AI assistant. `}
                  {view.request.fromHost && <>It asked from <span className="font-mono font-semibold text-ink">{view.request.fromHost}</span>. </>}
                  {view.request.connectedBefore ? "You've connected it before; this replaces that connection." : "You haven't connected it before."}
                </p>
                <p className="mt-4 font-ui text-[13px] font-bold">Check {name} is showing this code</p>
                <div className="mt-1.5 inline-flex gap-1 sm:gap-1.5" aria-label={`Code ${view.request.code}`}>
                  {view.request.code.split("").map((c, i) => c === "-" ? <span key={i} className="inline-flex w-2.5 items-center justify-center text-slate">-</span> : <b key={i} className="inline-flex h-10 w-[30px] items-center justify-center rounded-[10px] border border-rule bg-paper font-mono text-[19px] font-medium sm:h-11 sm:w-[34px] sm:text-[22px]">{c}</b>)}
                </div>
                <p className="mt-2 text-xs text-slate">If the codes don&apos;t match, close this page. Someone else may be trying to connect.</p>
                {user ? (
                  <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[13px]"><Initials name={view.me?.name || user.displayName || "You"} size={26} /> Signed in as <b>{view.me?.name || user.displayName}</b>{view.me?.username && <span className="text-slate">(@{view.me.username})</span>} · <button type="button" className="font-semibold text-crimson" onClick={() => auth.signOut().then(() => { window.location.href = `/login?next=${encodeURIComponent(next)}`; })}>Not you?</button></p>
                ) : user === null ? (
                  <p className="mt-5"><Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-primary">Sign in to continue</Link></p>
                ) : null}
              </>
            )}
          </section>

          {view && user && view.me && !view.me.allowed && <p className="card border-l-4 border-crimson p-5 text-sm text-slate">Your plan doesn&apos;t include connecting AI assistants yet. See <Link href="/pricing" className="text-crimson underline">Pricing</Link>.</p>}
          {done === "connected" && <p className="card border-l-4 border-moss p-5 text-sm" role="status"><b>Connected.</b> Go back to {name}: it can start now. You can pause or disconnect it any time in <Link href="/console?tab=agents" className="font-semibold text-crimson">Console → Connected agents</Link>.</p>}
          {done === "cancelled" && <p className="card p-5 text-sm" role="status">Cancelled. {name} wasn&apos;t connected.</p>}
          {error && view && <p className="card border-l-4 border-crimson p-4 text-sm text-red-800" role="alert">{error}</p>}

          {view && policy && user && view.me?.allowed && !done && (
            <>
              {/* ---- what it can see ---- */}
              <section className="card px-[18px] pb-1.5 pt-[18px] lg:px-[26px] lg:pt-[22px]">
                <h2 className="font-ui text-base font-extrabold">What {name} can see</h2>
                <p className="mb-1.5 mt-1 text-[13px] text-slate">Read only. Switch off anything it doesn&apos;t need.</p>
                {READ_SCOPES.map((s, i) => {
                  const on = policy.scopes.includes(s.id);
                  return (
                    <div key={s.id} className={`flex items-start gap-3 py-[13px] ${i ? "border-t border-rule" : ""}`}>
                      <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-field text-crimson ${on ? "" : "opacity-55"}`}><Glyph icon={s.icon} /></span>
                      <span className="min-w-0 flex-1"><b className={`block font-ui text-sm ${on ? "" : "opacity-55"}`}>{s.label}</b><span className="mt-0.5 block text-[12.5px] text-slate">{s.id === "read:messages" ? `Conversations are private to the people in them. Leave this off unless you want ${name} to answer customers.` : s.about}</span></span>
                      <Switch on={on} label={s.label} onChange={(v) => setPolicy({ ...policy, scopes: v ? [...policy.scopes, s.id] : policy.scopes.filter((x) => x !== s.id) })} />
                    </div>
                  );
                })}
              </section>

              {/* ---- what it can do ---- */}
              <section className="card px-[18px] pb-1.5 pt-[18px] lg:px-[26px] lg:pt-[22px]">
                <h2 className="font-ui text-base font-extrabold">What {name} can do</h2>
                <p className="mb-1.5 mt-1 text-[13px] text-slate">For each one, choose whether {name} asks you first. Requests go to Nana&apos;s inbox and your phone.</p>
                {ABILITIES.map((a, i) => {
                  const r = policy.abilities[a.id];
                  return (
                    <div key={a.id} className={`flex items-start gap-3 py-[13px] ${i ? "border-t border-rule" : ""}`}>
                      <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-field text-crimson ${r.on ? "" : "opacity-55"}`}><Glyph icon={a.icon} /></span>
                      <span className="min-w-0 flex-1">
                        <b className={`block font-ui text-sm ${r.on ? "" : "opacity-55"}`}>{a.label}</b>
                        <span className="mt-0.5 block text-[12.5px] text-slate">{a.about}</span>
                        {r.on && (
                          <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate">Asks you first?
                            <select className={sel} value={r.ask} disabled={a.choices.length < 2} onChange={(e) => setPolicy({ ...policy, abilities: { ...policy.abilities, [a.id]: { ...r, ask: e.target.value as Ask } } })}>
                              {a.choices.map((c) => <option key={c} value={c}>{ASK_LABEL[c]}</option>)}
                            </select>
                          </label>
                        )}
                      </span>
                      <Switch on={r.on} label={a.label} onChange={(v) => setPolicy({ ...policy, abilities: { ...policy.abilities, [a.id]: { ...r, on: v } } })} />
                    </div>
                  );
                })}
                <div className="-mx-2.5 mb-3 mt-1 flex items-start gap-3 rounded-xl border border-dashed border-amber-300 bg-paper px-2.5 py-3">
                  <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-amber-100 text-amber-800"><Glyph icon="lock" /></span>
                  <span className="min-w-0 flex-1"><b className="block font-ui text-sm">{MONEY_NOTE.label}</b><span className="mt-0.5 block text-[12.5px] text-slate">{MONEY_NOTE.about}</span></span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-ui text-[11px] font-bold text-amber-900">Never</span>
                </div>
              </section>

              {/* ---- limits ---- */}
              <section className="card px-[18px] pb-1.5 pt-[18px] lg:px-[26px] lg:pt-[22px]">
                <h2 className="font-ui text-base font-extrabold">Limits</h2>
                <p className="mb-1.5 mt-1 text-[13px] text-slate">{name} stops and asks you when it reaches one.</p>
                {[
                  { k: "spend", t: "Money it can spend", d: "Agents can't spend or move your money.", c: <span className="rounded-full bg-field px-2.5 py-1 font-mono text-[11px] text-slate">₦0 · fixed</span> },
                  { k: "discount", t: "Biggest discount it may offer", d: "Discount codes in replies to customers.", c: <select className={sel} value={policy.limits.discountCapKobo / 100} onChange={(e) => setPolicy({ ...policy, limits: { ...policy.limits, discountCapKobo: Number(e.target.value) * 100 } })} aria-label="Biggest discount">{view.choices.discountNaira.map((n) => <option key={n} value={n}>{n ? `Up to ${naira(n)}` : "None"}</option>)}</select> },
                  { k: "actions", t: "Actions a day", d: "Reading counts too. Resets at midnight, Lagos time.", c: <select className={sel} value={policy.limits.actionsPerDay} onChange={(e) => setPolicy({ ...policy, limits: { ...policy.limits, actionsPerDay: Number(e.target.value) } })} aria-label="Actions a day">{view.choices.actionsPerDay.map((n) => <option key={n} value={n}>{n.toLocaleString("en-GB")}</option>)}</select> },
                  { k: "days", t: "Access lasts", d: `Then ${name} has to ask again.`, c: <select className={sel} value={policy.limits.accessDays} onChange={(e) => setPolicy({ ...policy, limits: { ...policy.limits, accessDays: Number(e.target.value) } })} aria-label="Access lasts">{view.choices.accessDays.map((n) => <option key={n} value={n}>{n} days</option>)}</select> },
                ].map((row, i) => (
                  <div key={row.k} className={`flex items-center gap-3 py-[13px] ${i ? "border-t border-rule" : ""}`}>
                    <span className="min-w-0 flex-1"><b className="block font-ui text-sm">{row.t}</b><span className="mt-0.5 block text-[12.5px] text-slate">{row.d}</span></span>{row.c}
                  </div>
                ))}
              </section>

              <section className="card flex flex-col gap-4 p-[18px] sm:flex-row sm:items-center lg:p-6">
                <div className="flex gap-3">
                  <button type="button" className="btn-primary" disabled={busy} onClick={() => answer("approve")}>Connect {name}</button>
                  <button type="button" className="btn-ghost" disabled={busy} onClick={() => answer("deny")}>Cancel</button>
                </div>
                <p className="text-xs text-slate">You can pause or disconnect {name} any time in Console → Connected agents. Everything it does is logged there for {Math.round(view.logDays / 30.4)} months. What {name} keeps on its side is covered by {view.request.maker ? `${view.request.maker}'s` : "its maker's"} own terms. <Link href="/help/connect-an-ai-assistant" className="font-semibold text-crimson">How agents work on NotesApp</Link></p>
              </section>
            </>
          )}
        </div>

        {/* ---- the side column ---- */}
        {view && (
          <aside className="space-y-4">
            {policy && (
              <section className="card p-[18px]">
                <h3 className="font-ui text-sm font-bold">If you connect now</h3>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[[counts.sees, "things it sees"], [counts.does, "things it does"], [counts.asks, "ask you first"]].map(([n, l]) => <div key={String(l)} className="rounded-xl border border-rule bg-paper px-1 py-2.5"><b className="block font-display text-2xl font-medium">{n}</b><span className="text-[11px] text-slate">{l}</span></div>)}
                </div>
                <p className="mt-3 text-xs text-slate">{name} can read {counts.sees ? "what you switched on" : "nothing"}, {counts.does ? "work within the rules above" : "change nothing"}, and asks you before {policy.abilities.publish.on ? "publishing" : "anything that matters"}{policy.abilities.bookings.on && policy.abilities.bookings.ask !== "never" ? " or replying to new bookings" : ""}.</p>
              </section>
            )}
            <section className="card p-[18px]">
              <h3 className="font-ui text-sm font-bold">Connecting a different assistant?</h3>
              <ol className="mt-3 space-y-3 text-[13px]">
                <li className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-field font-ui text-[11px] font-bold text-crimson">1</span><span>In your assistant, add a connector (some call it an MCP server) with this address:</span></li>
              </ol>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-rule bg-paper px-3 py-2.5"><span className="truncate font-mono text-xs">{view.urls.mcp}</span><CopyButton value={view.urls.mcp} className="rounded-full bg-crimson/10 px-2.5 py-1" /></div>
              <ol start={2} className="mt-3 space-y-3 text-[13px]">
                <li className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-field font-ui text-[11px] font-bold text-crimson">2</span><span>It sends you to this page, or shows an 8-character code.</span></li>
                <li className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-field font-ui text-[11px] font-bold text-crimson">3</span><span>Got a code? Type it at <a href={view.urls.link} className="font-mono font-semibold">{view.urls.linkLabel}</a>. Codes last {view.linkCodeMinutes} minutes and work once.</span></li>
              </ol>
            </section>
            <p className="flex gap-2 rounded-xl2 border border-crimson/20 bg-crimson/5 p-4 text-[13px]"><svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-crimson" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg>NotesApp never asks for your password inside another app. If an assistant asks for it, don&apos;t type it there.</p>
          </aside>
        )}
      </main>
    </AgentShell>
  );
}
