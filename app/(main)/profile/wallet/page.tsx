"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import PageHero from "@/components/PageHero";
import { BONUS_DAYS, TOPUP_MAX_KOBO, TOPUP_MIN_KOBO, TOPUP_PRESETS_NAIRA, WALLET_LIVE, bonusFor, nairaOf, type BonusLot, type WalletTx } from "@/lib/wallet";

type Summary = { creditKobo: number; bonusKobo: number; bonusLots: BonusLot[]; activity: (WalletTx & { id: string })[] };
const FILTERS = [["all", "All"], ["topup", "Top-ups"], ["spend", "Spent"], ["bonus", "Bonus"], ["held", "Held"], ["refund", "Refunds"]] as const;
type Filter = (typeof FILTERS)[number][0];

const when = (iso: string) => new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", hour12: true, minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const signed = (kobo: number) => (kobo > 0 ? `+${nairaOf(kobo)}` : kobo < 0 ? `−${nairaOf(-kobo)}` : nairaOf(0));

function TopUp({ user, onDone }: { user: User; onDone: () => void }) {
  const [naira, setNaira] = useState(10_000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kobo = Math.round(naira * 100);
  const ok = Number.isInteger(naira) && kobo >= TOPUP_MIN_KOBO && kobo <= TOPUP_MAX_KOBO;
  const bonus = ok ? bonusFor(kobo) : 0;
  async function pay() {
    if (!ok) return setError("Top up a whole amount from ₦1,000 to ₦500,000.");
    setBusy(true); setError(null);
    try { await startCheckout(user, { kind: "wallet_topup", amountNaira: naira }); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't start the top-up."); setBusy(false); }
  }
  return (
    <div className="card p-5" id="top-up">
      <h2 className="font-ui text-sm font-bold text-ink">Top up</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TOPUP_PRESETS_NAIRA.map((a) => {
          const b = bonusFor(a * 100);
          return (
            <button key={a} type="button" onClick={() => setNaira(a)} className={`rounded-2xl border-2 p-3 text-center ${naira === a ? "border-crimson bg-crimson/5" : "border-rule bg-card"}`}>
              <b className="block text-lg text-ink">{nairaOf(a * 100)}</b>
              <span className={`text-[11px] ${b ? "font-semibold text-green-700" : "text-slate"}`}>{b ? `+ 🎁 ${nairaOf(b)} bonus` : "no bonus"}</span>
            </button>
          );
        })}
      </div>
      <label className="mt-4 block text-xs text-slate">Or type an amount (₦1,000 to ₦500,000)
        <span className="mt-1 flex items-center rounded-xl border border-rule bg-paper px-3 py-2">
          <span className="mr-1 text-slate">₦</span>
          <input inputMode="numeric" value={naira ? String(naira) : ""} onChange={(e) => setNaira(Number(e.target.value.replace(/[^\d]/g, "")) || 0)} className="w-full bg-transparent text-base text-ink outline-none" aria-label="Amount in naira" />
        </span>
      </label>
      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between"><dt>NotesApp Credit added</dt><dd className="font-semibold">{ok ? nairaOf(kobo) : "—"}</dd></div>
        <div className="flex justify-between text-green-700"><dt>🎁 Bonus Credits</dt><dd className="font-semibold">{bonus ? `+${nairaOf(bonus)}` : "none at this amount"}</dd></div>
      </dl>
      {error && <p className="mt-2 text-xs text-crimson" role="alert">{error}</p>}
      <button type="button" onClick={pay} disabled={busy || !ok} className="btn-primary mt-4 w-full !py-3 disabled:opacity-50">{busy ? "Opening Paystack…" : `Pay ${ok ? nairaOf(kobo) : ""} with Paystack`}</button>
      <p className="mt-2 text-center text-[11px] text-slate">Card, bank transfer or USSD</p>
      <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] text-slate">
        <li>Credit can&apos;t be withdrawn or sent to other members.</li>
        <li>Bonus Credits last {BONUS_DAYS} days and are spent first, on boosts, badges and advert banners only.</li>
        <li>Bonus amounts can change and are always shown before you pay. <button type="button" onClick={onDone} className="underline">Refresh balance</button></li>
      </ul>
    </div>
  );
}

export default function WalletPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  async function load(u: User) {
    try {
      const r = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${await u.getIdToken()}` }, cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't load your wallet.");
      setData(j); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your wallet."); }
  }
  useEffect(() => { if (user) void load(user); }, [user]);

  const rows = useMemo(() => (data?.activity ?? []).filter((a) =>
    filter === "all" ? true : filter === "bonus" ? a.bonusKobo !== 0 : filter === "held" ? a.held : filter === "refund" ? a.type === "refund" || a.type === "topup_refund" : a.type === filter), [data, filter]);

  if (!WALLET_LIVE) return <p className="px-6 py-24 text-center text-slate">The wallet isn&apos;t open yet.</p>;
  if (user === null) return <p className="px-6 py-24 text-center text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to see your wallet.</p>;

  return (
    <>
      <PageHero compact max="max-w-6xl" eyebrow="NotesApp Credit" title={<>Wallet</>}>
        <p>Top up once, then pay for boosts, badges, adverts, gifts, shop items and sessions without entering your card each time.</p>
      </PageHero>
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {error && <p className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>}
        <div className="grid gap-5 lg:grid-cols-[1fr,1.1fr]">
          <div className="space-y-5">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-crimson-deep via-crimson to-[#b0123f] p-5 text-white shadow-xl lg:p-7">
              <p className="font-ui text-[11px] font-bold uppercase tracking-widest opacity-80">NotesApp Credit</p>
              <p className="mt-1 font-display text-4xl font-bold lg:text-5xl">{data ? nairaOf(data.creditKobo) : "…"}</p>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/15 px-4 py-3">
                <span><span className="block text-[11px] font-semibold uppercase tracking-wider opacity-80">🎁 Bonus Credits</span><b className="text-xl">{data ? nairaOf(data.bonusKobo) : "…"}</b></span>
                <span className="text-right text-[11px] opacity-90">Spent first on boosts,<br />badges and adverts</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-bold">
                <a href="#top-up" className="rounded-full bg-white py-2.5 text-center text-crimson">+ Top up</a>
                <a href="#activity" className="rounded-full border border-white/50 py-2.5 text-center">Activity</a>
              </div>
            </div>
            {user && <TopUp user={user} onDone={() => void load(user)} />}
            <div className="card p-5">
              <h2 className="font-ui text-sm font-bold text-ink">Where you can use it</h2>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {[["🚀", "Boosts", "bonus ok"], ["✔", "Verification badge", "bonus ok"], ["📣", "Advert banners", "bonus ok"], ["🎁", "Gifts to creators", "credit only"], ["🛍", "Shop items", "held until delivered"], ["📅", "Paid sessions", "held until it happens"]].map(([i, t, n]) => (
                  <li key={t} className="rounded-2xl border border-rule bg-card p-3"><span className="text-lg">{i}</span><b className="block leading-tight text-ink">{t}</b><span className="text-[11px] text-slate">{n}</span></li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-slate">Coming: paid calls and Notesville Naira in Notes Life.</p>
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-900">NotesApp Credit can&apos;t be cashed out or sent to other members. Sellers and publishers are still paid to their bank accounts. See the <Link href="/help/notesapp-credit-wallet" className="underline">help article</Link>.</p>
            </div>
          </div>
          <div className="space-y-5">
            <div className="card p-5" id="activity">
              <div className="flex items-center justify-between"><h2 className="font-ui text-sm font-bold text-ink">Activity</h2></div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                {FILTERS.map(([id, label]) => <button key={id} type="button" onClick={() => setFilter(id)} className={`rounded-full px-3 py-1 ${filter === id ? "bg-ink text-white" : "border border-rule"}`}>{label}</button>)}
              </div>
              {!data ? <p className="mt-4 text-sm text-slate">Loading…</p> : rows.length === 0 ? (
                <p className="mt-4 text-sm text-slate">{data.activity.length ? "Nothing here with this filter." : "Nothing yet. Top up to get started."}</p>
              ) : (
                <ul className="mt-3 divide-y divide-rule">
                  {rows.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 py-3">
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-sm text-ink">{a.label}</b>
                        <span className="text-[11px] text-slate">
                          {when(a.at)}
                          {a.bonusKobo !== 0 && a.creditKobo !== 0 && <> · {nairaOf(Math.abs(a.creditKobo))} credit + 🎁 {nairaOf(Math.abs(a.bonusKobo))} bonus</>}
                          {a.bonusKobo !== 0 && a.creditKobo === 0 && a.type !== "bonus_expired" && <> · 🎁 Bonus Credits</>}
                          {a.held && <> · 🔒 Held until {a.kind === "booking" ? "the session happens" : "delivered"}</>}
                        </span>
                      </span>
                      <b className={`shrink-0 text-sm ${a.creditKobo + a.bonusKobo > 0 ? "text-green-700" : "text-ink"}`}>{signed(a.creditKobo + a.bonusKobo)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card p-5 text-sm">
              <h2 className="font-ui text-sm font-bold text-ink">Bonus Credits</h2>
              {!data || data.bonusLots.length === 0 ? <p className="mt-2 text-slate">None right now. Top-ups of ₦5,000 or more add Bonus Credits.</p> : (
                <ul className="mt-2 divide-y divide-rule">
                  {data.bonusLots.map((l) => <li key={l.id} className="flex justify-between py-2"><span>{l.source === "refund" ? "Returned with a refund" : "From a top-up"}</span><b>{nairaOf(l.kobo)} · ends {day(l.expiresAt)}</b></li>)}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-slate">Bonus is spent before your own credit, soonest-ending first, and only on boosts, badges and advert banners.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
