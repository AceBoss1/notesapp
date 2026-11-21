"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { PromoStatus, PromoTier } from "@/lib/promos";

type Mine = { plan: { tier: PromoTier; until: string } | null; tournament: boolean };
type Data = PromoStatus & { mine?: Mine };
const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;
const NAME: Record<PromoTier, string> = { enterprise: "Enterprise", business: "Business", pro: "Pro" };

// The offer page for a promo code (lib/promos.ts; API /api/promos): what's left of each free plan, claim one (one per account), pitch for a
// venture slot (the pitch form on /ventures carries the code), and sign up for the Arcade tournament while sign-ups are open.
export default function PromoOffer({ code }: { code: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const load = useCallback(async (u: User | null) => {
    const headers: Record<string, string> = u ? { Authorization: `Bearer ${await u.getIdToken()}` } : {};
    const r = await fetch(`/api/promos?code=${encodeURIComponent(code)}${u ? "&mine=1" : ""}`, { headers });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setData(j); else setMsg({ ok: false, text: j.error || "Couldn't load the offer." });
  }, [code]);
  useEffect(() => { if (user !== undefined) void load(user); }, [user, load]);

  async function post(tag: string, body: Record<string, unknown>, ok: (j: Record<string, unknown>) => string) {
    if (!user) return;
    setBusy(tag); setMsg(null);
    try {
      const r = await fetch("/api/promos", { method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ code, ...body }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Something went wrong.");
      setMsg({ ok: true, text: ok(j) });
      await load(user);
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong." }); } finally { setBusy(""); }
  }

  const next = encodeURIComponent(`/offers/${code}`);
  const signIn = (
    <div className="mt-3 flex flex-wrap gap-2">
      <Link href={`/login?next=${next}`} className="rounded-full bg-crimson px-5 py-2.5 font-ui text-sm font-semibold text-paper">Sign in</Link>
      <Link href={`/signup?next=${next}`} className="rounded-full border border-rule px-5 py-2.5 font-ui text-sm font-semibold text-ink">Create an account</Link>
    </div>
  );

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-ui text-xs font-bold uppercase tracking-[0.18em] text-crimson">Code · {code}</p>
      <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">Happy 34th birthday, Davido</h1>
      <p className="mt-3 max-w-2xl text-slate">#NotesApp&apos;s birthday initiatives: free plans while they last, venture slots for Nigerian founders, and an Arcade tournament. {data?.postPath && <Link href={data.postPath} className="text-crimson underline">Read the post</Link>}</p>
      {msg && <p className={`mt-4 rounded-xl border px-4 py-3 text-sm ${msg.ok ? "border-green-700/30 bg-green-50 text-green-900" : "border-crimson/30 bg-crimson/5 text-crimson"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      {!data ? <p className="mt-8 text-sm text-slate">Loading…</p> : !data.live ? <p className="mt-8 text-ink">This offer isn&apos;t open.</p> : (
        <>
          <h2 className="mt-10 font-display text-2xl text-ink">Free plans · one per account</h2>
          {data.mine?.plan && <p className="mt-2 text-sm text-ink">You claimed <b>{NAME[data.mine.plan.tier]}</b>, until {new Date(data.mine.plan.until).toDateString()}. Enjoy it!</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {data.plans.map((p) => (
              <div key={p.tier} className="flex flex-col rounded-[18px] border border-rule bg-card p-5">
                <p className="font-display text-xl text-ink">{p.label}</p>
                <p className="text-xs text-slate">{p.valueText}</p>
                <p className="mt-3 text-sm text-ink"><b>{p.left.toLocaleString()}</b> of {p.slots.toLocaleString()} left</p>
                <div className="mt-auto pt-4">
                  {user && !data.mine?.plan && (
                    <button type="button" disabled={p.left === 0 || !!busy} onClick={() => { if (confirm(`Claim ${p.label} with ${code}? It's one claim per account.`)) void post(p.tier, { action: "claim", tier: p.tier }, (j) => `${NAME[p.tier]} is yours until ${new Date(String(j.until)).toDateString()}. Happy birthday from #NotesApp!`); }}
                      className="w-full rounded-full bg-crimson px-4 py-2 font-ui text-sm font-semibold text-paper disabled:opacity-40">
                      {p.left === 0 ? "All claimed" : busy === p.tier ? "Claiming…" : "Claim"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!user && signIn}
          <p className="mt-2 text-xs text-slate">Plans are for publisher accounts (Free Basic or higher) with a verified email. When it ends, your account goes back to the plan you pay for, or Free Basic; everything you published stays.</p>

          {data.ventures && (
            <>
              <h2 className="mt-10 font-display text-2xl text-ink">Venture slots</h2>
              <p className="mt-2 text-sm text-ink"><b>{data.ventures.left}</b> of {data.ventures.slots} slots open · up to {naira(data.ventures.maxKoboPerVenture)} support each</p>
              <p className="mt-1 text-sm text-slate">Pitch your business idea to NotesApp Ventures with the code. The team picks {data.ventures.slots}; support is subject to selection and terms. Every pitch is kept confidential.</p>
              {data.ventures.left > 0 && <Link href={`/ventures?code=${encodeURIComponent(code)}#apply`} className="mt-3 inline-block rounded-full bg-crimson px-5 py-2.5 font-ui text-sm font-semibold text-paper">Pitch your idea</Link>}
            </>
          )}

          {data.tournament && (
            <>
              <h2 className="mt-10 font-display text-2xl text-ink">{data.tournament.name}</h2>
              <p className="mt-2 text-sm text-slate">Free entry for signed-in members aged 18 and over. {data.tournament.open ? `Sign-ups are open today only (${new Date(data.tournament.lagosDate + "T12:00:00+01:00").toDateString()}, Lagos time).` : "Sign-ups are closed."} {data.tournament.entries.toLocaleString()} signed up. It runs tonight from {new Date(data.tournament.playFrom).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" })} (Lagos time); the game is Naija Run, the same street for everyone, best of {data.tournament.tries} tries, and the leaderboard updates live as people play.</p>
              {data.mine?.tournament ? <p className="mt-3 text-sm font-semibold text-ink">You&apos;re signed up. ✓</p>
                : data.tournament.open && (user
                  ? <button type="button" disabled={!!busy} onClick={() => void post("t", { action: "tournament" }, () => "You're signed up. It runs tonight from 10 PM, Lagos time.")} className="mt-3 rounded-full bg-crimson px-5 py-2.5 font-ui text-sm font-semibold text-paper disabled:opacity-40">{busy === "t" ? "Signing up…" : "Sign me up"}</button>
                  : signIn)}
              <p className="mt-3 flex flex-wrap gap-2">
                <Link href="/arcade/tournament" className="rounded-full border border-crimson px-5 py-2.5 font-ui text-sm font-semibold text-crimson">{data.tournament.playing ? "Play now: best of 3 tries" : "The tournament page and leaderboard"}</Link>
                <Link href="/arcade/run" className="rounded-full border border-rule px-5 py-2.5 font-ui text-sm font-semibold text-ink">Practise on Naija Run</Link>
              </p>
            </>
          )}
          <p className="mt-10 text-xs text-slate">NotesApp birthday initiatives. Venture support is subject to selection and terms.</p>
        </>
      )}
    </section>
  );
}
