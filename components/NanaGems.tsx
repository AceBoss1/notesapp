"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import { EFFORTS, EFFORT_INFO, GEMS, GEM_INFO, planName, type Effort, type Gem } from "@/lib/nana-gems";
import type { AccountTier } from "@/lib/users";

// Nana's gems on the page (lib/nana-gems.ts): the picker in the chat header, and the allowance and credit card on the Nana page.

export type NanaAccountView = {
  tier: AccountTier; gems: Gem[]; efforts: Effort[]; allowanceKobo: number; usedKobo: number; leftKobo: number; creditKobo: number;
  resetEvery: "day" | "week" | "month"; resetsAt: string; allowanceGems: "all" | "pearl"; ownKey: boolean;
  packs: { id: string; name: string; priceKobo: number; creditKobo: number }[];
};

const CHOICE_KEY = "na-nana-choice";
export function readChoice(): { gem: Gem; effort: Effort } {
  try {
    const v = JSON.parse(localStorage.getItem(CHOICE_KEY) || "{}");
    return { gem: GEMS.includes(v.gem) ? v.gem : "pearl", effort: EFFORTS.includes(v.effort) ? v.effort : "low" };
  } catch { return { gem: "pearl", effort: "low" }; }
}
const saveChoice = (c: { gem: Gem; effort: Effort }) => { try { localStorage.setItem(CHOICE_KEY, JSON.stringify(c)); } catch { /* kept for this visit */ } };

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: kobo % 100 ? 2 : 0 })}`;
const resetText = (iso: string, every: NanaAccountView["resetEvery"]) => {
  const d = new Date(iso), tz = "Africa/Lagos";
  if (every === "month") return `on ${d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: tz })}`;
  const time = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz });
  return every === "week" ? `${d.toLocaleDateString("en-GB", { weekday: "long", timeZone: tz })} at ${time}` : `tomorrow at ${time}`;
};

export function useNanaAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<NanaAccountView | null>(null);
  const load = useCallback(async (u: User | null) => {
    if (!u) return setAccount(null);
    const r = await fetch("/api/nana/account", { headers: { Authorization: `Bearer ${await u.getIdToken()}` } }).catch(() => null);
    if (r?.ok) setAccount(await r.json());
  }, []);
  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); void load(u); }), [load]);
  return { user, account, refresh: () => load(user) };
}

export function GemDot({ gem, className = "h-2.5 w-2.5" }: { gem: Gem; className?: string }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 rotate-45 rounded-[2px] ring-1 ring-ink/15 ${className}`} style={{ background: GEM_INFO[gem].color }} />;
}

function Meter({ a }: { a: NanaAccountView }) {
  const pct = a.allowanceKobo ? Math.round((a.leftKobo / a.allowanceKobo) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs"><span className="font-semibold text-ink">Free allowance</span><span className="text-slate">{naira(a.leftKobo)} of {naira(a.allowanceKobo)} left</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Free allowance left"><div className="h-full rounded-full bg-crimson" style={{ width: `${pct}%` }} /></div>
      <p className="mt-1 text-[11px] text-slate">Refreshes {resetText(a.resetsAt, a.resetEvery)}{a.allowanceGems === "pearl" ? " · covers Pearl" : ""}</p>
    </div>
  );
}

// The chip in Nana's header: which gem and effort the next answer uses. Locked choices say which plan opens them.
export function NanaGemPicker({ account, choice, onChoice }: { account: NanaAccountView; choice: { gem: Gem; effort: Effort }; onChoice: (c: { gem: Gem; effort: Effort }) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", close); window.addEventListener("keydown", close);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", close); };
  }, [open]);
  const gem = account.gems.includes(choice.gem) ? choice.gem : "pearl";
  const effort = account.efforts.includes(choice.effort) ? choice.effort : "low";
  const pick = (c: { gem: Gem; effort: Effort }) => { saveChoice(c); onChoice(c); };
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" aria-label={`Nana model: ${GEM_INFO[gem].name}, ${EFFORT_INFO[effort].name}. Change`}
        className="flex items-center gap-1.5 rounded-full border border-rule bg-paper px-2.5 py-1 font-ui text-[11px] font-semibold text-ink hover:border-crimson">
        <GemDot gem={gem} className="h-2 w-2" />{GEM_INFO[gem].name}<span className="hidden text-slate sm:inline">· {EFFORT_INFO[effort].name}</span><span aria-hidden="true" className="text-slate">▾</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Choose Nana's model" className="absolute right-0 top-full z-30 mt-2 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-rule bg-card p-3 shadow-2xl">
          <p className="px-1 font-ui text-[11px] font-bold uppercase tracking-wider text-slate">Model</p>
          <ul className="mt-1 space-y-1">
            {GEMS.map((g) => {
              const ok = account.gems.includes(g);
              return (
                <li key={g}>
                  <button type="button" disabled={!ok} onClick={() => pick({ gem: g, effort })} aria-pressed={gem === g}
                    className={`flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left ${gem === g ? "bg-crimson/10 ring-1 ring-crimson/30" : ok ? "hover:bg-paper" : "opacity-60"}`}>
                    <GemDot gem={g} className="mt-1 h-3 w-3" />
                    <span className="min-w-0 flex-1"><span className="block font-ui text-sm font-bold text-ink">{GEM_INFO[g].name}</span><span className="block text-[11px] leading-snug text-slate">{GEM_INFO[g].blurb}</span></span>
                    {!ok && <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold text-crimson ring-1 ring-rule">{planName(GEM_INFO[g].from)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 px-1 font-ui text-[11px] font-bold uppercase tracking-wider text-slate">Effort</p>
          <div className="mt-1 grid grid-cols-3 gap-1 rounded-xl bg-paper p-1">
            {EFFORTS.map((e) => {
              const ok = account.efforts.includes(e);
              return (
                <button key={e} type="button" disabled={!ok} onClick={() => pick({ gem, effort: e })} aria-pressed={effort === e} title={ok ? EFFORT_INFO[e].blurb : `${planName(EFFORT_INFO[e].from)} plan`}
                  className={`rounded-lg px-1 py-1.5 font-ui text-[11px] font-semibold ${effort === e ? "bg-card text-ink shadow-sm ring-1 ring-rule" : ok ? "text-slate hover:text-ink" : "text-slate/50"}`}>
                  {EFFORT_INFO[e].name}{!ok && <span aria-hidden="true"> 🔒</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-3 border-t border-rule pt-3">
            {account.ownKey ? <p className="text-xs text-slate">You&apos;re using your own AI account: no allowance, no limits from us.</p> : (
              <>
                <Meter a={account} />
                <div className="mt-2 flex items-center justify-between gap-2 text-xs"><span><span className="font-semibold text-ink">Nana credit</span> <span className="text-slate">{naira(account.creditKobo)}</span></span><Link href="/nana#credit" className="font-semibold text-crimson hover:underline" onClick={() => setOpen(false)}>Top up</Link></div>
              </>
            )}
            {account.tier !== "enterprise" && <Link href="/pricing" onClick={() => setOpen(false)} className="mt-2 block text-[11px] text-slate hover:text-crimson">Emerald comes with Business, Ruby with Enterprise · See plans →</Link>}
          </div>
        </div>
      )}
    </div>
  );
}

// The Nana page's card: your allowance, your credit, the gems by plan, and the credit packs (card or wallet).
export function NanaAllowance() {
  const { user, account, refresh } = useNanaAccount();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function buy(p: NanaAccountView["packs"][number]) {
    if (!user) return;
    setBusy(p.id); setError("");
    try { await startCheckout(user, { kind: "nana_credit", packId: p.id }, { amountKobo: p.priceKobo }); void refresh(); }
    catch (e) { if (e instanceof Error && e.message) setError(e.message); }
    finally { setBusy(""); }
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="card p-5">
        <p className="font-ui text-sm font-bold text-ink">{account ? `Your Nana · ${planName(account.tier)}` : "Your Nana"}</p>
        {!user ? <p className="mt-2 text-sm text-slate"><Link href="/login?next=/nana%23credit" className="font-semibold text-crimson underline">Sign in</Link> to see your free allowance and Nana credit.</p>
          : !account ? <p className="mt-2 text-sm text-slate">Loading…</p>
          : account.ownKey ? <p className="mt-2 text-sm text-slate">You&apos;re using your own AI account, so there&apos;s no allowance and no limit from us. Disconnect it below to use your allowance instead.</p>
          : (
            <div className="mt-3 space-y-3">
              <Meter a={account} />
              <div className="flex items-baseline justify-between gap-2 text-xs"><span className="font-semibold text-ink">Nana credit</span><span className="font-ui text-lg font-bold text-ink">{naira(account.creditKobo)}</span></div>
              <p className="text-[11px] text-slate">Your free allowance is used first, then your credit. Credit never expires.</p>
            </div>
          )}
        <ul className="mt-4 space-y-2 border-t border-rule pt-4">
          {GEMS.map((g) => (
            <li key={g} className="flex items-start gap-2.5 text-sm">
              <GemDot gem={g} className="mt-1.5 h-3 w-3" />
              <span className="min-w-0 flex-1"><span className="font-bold text-ink">{GEM_INFO[g].name}</span> <span className="text-slate">· {GEM_INFO[g].blurb}</span></span>
              <span className="shrink-0 text-[11px] font-semibold text-slate">{g === "pearl" ? "Every plan" : g === "emerald" ? "Business +" : "Enterprise"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-slate">Effort: Quick on every plan, Balanced from Business, Thorough on Enterprise. Dearer gems and more effort use your allowance faster.</p>
      </div>
      <div className="card p-5">
        <p className="font-ui text-sm font-bold text-ink">Buy Nana credit</p>
        <p className="mt-1 text-sm text-slate">For when your free allowance runs out. Anyone can buy it, on any plan; it never expires and carries over.</p>
        {error && <p className="mt-2 text-xs text-red-700" role="alert">{error}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(account?.packs ?? []).map((p) => (
            <div key={p.id} className="flex flex-col rounded-xl border border-rule bg-paper p-4">
              <p className="font-ui text-xs font-bold uppercase tracking-wider text-slate">{p.name}</p>
              <p className="mt-1 font-display text-2xl text-ink">{naira(p.priceKobo)}</p>
              <p className="text-xs text-slate">{naira(p.creditKobo)} of Nana credit</p>
              <button type="button" disabled={!user || !!busy} onClick={() => buy(p)} className="btn-primary mt-3 !px-3 !py-2 text-xs disabled:opacity-50">{busy === p.id ? "Opening…" : "Buy"}</button>
            </div>
          ))}
          {!account && <p className="text-xs text-slate sm:col-span-3">{user ? "Loading the packs…" : "Sign in to buy credit."}</p>}
        </div>
        <p className="mt-3 text-[11px] text-slate">Pay by card or from your NotesApp Credit wallet. A general question someone has asked before may come from Nana&apos;s answer bank: instant and free.</p>
      </div>
    </div>
  );
}
