"use client";

import AppLink from "@/components/AppLink";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import { formatNaira, PublisherSettings } from "@/lib/booking-time";
import { SUB_TIERS, TIER_BADGE, TIER_NAME, openTiers, tierOf, tierOffers, type SubTier, type TierOffers } from "@/lib/fans";
import { TierChip } from "@/components/fans/FanBadges";
import { CURRENCIES, formatMoney, payMethodsLabel } from "@/lib/currency";
import { CURRENCY_EVENT, preferredCurrency, setPreferredCurrency } from "@/lib/local-currency";

// Paying in another currency (lib/global-pay.ts): a reader outside Nigeria, or any reader of a creator who earns in another currency,
// pays in their own currency through Stripe or Flutterwave (or Paystack for naira). quote: GET /api/global/quote.
type Quote = { home: string; payCurrency: string; domestic: boolean; ready: boolean; tiers: { tier: SubTier; homeMinor: number; payMinor: number | null }[] };
// The reader's own pick, else the currency of the country they're in, else their time zone's (lib/local-currency.ts).
const startCurrency = (): string => preferredCurrency().currency;

// Subscribing to a creator (lib/fans.ts): Premium, VIP and VVIP, whichever they offer, each at the creator's monthly price. A subscriber
// sees their tier and can change it: the new tier starts now and the days left on the old one are added on (lib/payments.ts).
const PERKS: Record<SubTier, string[]> = {
  premium: ["Their Premium posts, course notes and replays", "🌄 Starter badge in their space", "Builds your fan level", "As their #2 or #3 fan: a car or bike entrance in their lives"],
  vip: ["Everything in Premium", "Their VIP posts and VIP lives", "🛡 Army badge in their space", "Fan level grows with every month"],
  vvip: ["Everything in VIP", "Their VVIP posts and lives", "🏆 VVIP badge everywhere in their space", "As their 🥇 top fan: arrive in their lives by yacht or private jet"],
};

type Mine = { tier: SubTier; active: boolean } | null;
async function mySub(uid: string, username: string): Promise<Mine> {
  const s = (await getDoc(doc(db, "subscriptions", `${uid}_${username}`))).data();
  if (!s) return null;
  const active = s.status === "demo" || (!!s.currentPeriodEnd && Date.parse(String(s.currentPeriodEnd)) > Date.now());
  return active ? { tier: tierOf(s), active } : null;
}

export default function SubscribeButton({ username, publisherUid, creatorName }: { username: string; publisherUid?: string; creatorName?: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [mine, setMine] = useState<Mine | undefined>(undefined);
  const [offers, setOffers] = useState<TierOffers | null | undefined>(undefined); // null = not offered
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<SubTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cur, setCur] = useState<string>("NGN");
  const [quote, setQuote] = useState<Quote | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    setCur(startCurrency());
    // The footer's currency picker changes it everywhere on the page.
    const follow = () => setCur(startCurrency());
    window.addEventListener(CURRENCY_EVENT, follow);
    return () => window.removeEventListener(CURRENCY_EVENT, follow);
  }, []);
  useEffect(() => {
    setQuote(undefined);
    fetch(`/api/global/quote?username=${encodeURIComponent(username)}&currency=${cur}`).then((r) => (r.ok ? r.json() : null)).then(setQuote).catch(() => setQuote(null));
  }, [username, cur]);
  function pickCurrency(c: string) { setCur(c); setPreferredCurrency(c); }
  useEffect(() => {
    // Without the creator's id (a premium entry's gate), look it up from their username.
    const uidOf = publisherUid ? Promise.resolve(publisherUid) : getDoc(doc(db, "usernames", username)).then((u) => String(u.data()?.uid ?? ""));
    uidOf.then((uid) => (uid ? getDoc(doc(db, "publisherSettings", uid)) : Promise.reject()))
      .then((snap) => { const o = tierOffers((snap.data() as PublisherSettings | undefined)?.subscription); setOffers(openTiers(o).length ? o : null); })
      .catch(() => setOffers(null));
  }, [publisherUid, username]);
  useEffect(() => {
    if (!user) { setMine(null); return; }
    mySub(user.uid, username).then(setMine).catch(() => setMine(null));
  }, [user, username]);

  if (user === undefined || offers === undefined || quote === undefined || (user && mine === undefined)) return <div className="h-10 w-40 animate-pulse rounded-full bg-rule" />;
  // Global: anything but a naira reader of a naira creator, when the creator offers tiers this way.
  const global = !!quote && !quote.domestic && quote.tiers.length > 0;
  if (offers === null && !mine && !global) return null; // the creator hasn't opened subscriptions

  if (!user) {
    return <AppLink href="/signup" className="btn-primary !px-5 !py-2 text-xs">Sign up to subscribe</AppLink>;
  }

  async function choose(tier: SubTier) {
    if (!user) return;
    setBusy(tier); setError(null);
    try { await startCheckout(user, { kind: "subscription", username, tier }); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't start payment."); setBusy(null); }
  }
  async function chooseGlobal(tier: SubTier) {
    if (!user) return;
    setBusy(tier); setError(null);
    try {
      const r = await fetch("/api/global/checkout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ username, tier, currency: cur }) });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || "Couldn't start payment.");
      window.location.href = j.url;
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't start payment."); setBusy(null); }
  }
  const tiers = global ? quote!.tiers.map((t) => t.tier) : offers ? openTiers(offers) : [];
  const priceOf = (t: SubTier) => {
    if (!global) return formatNaira(offers![t].priceKobo);
    const q = quote!.tiers.find((x) => x.tier === t);
    return q?.payMinor ? formatMoney(q.payMinor, cur) : "…";
  };
  const fromMinor = global ? Math.min(...quote!.tiers.map((t) => t.payMinor ?? Infinity)) : 0;
  const fromLabel = global ? (Number.isFinite(fromMinor) ? formatMoney(fromMinor, cur) : "") : tiers.length ? formatNaira(Math.min(...tiers.map((t) => offers![t].priceKobo))) : "";
  const first = (creatorName || `@${username}`).split(" ")[0];

  return (
    <div>
      {mine ? (
        <button type="button" onClick={() => setOpen(true)} disabled={!tiers.length} className="inline-flex items-center gap-1.5 rounded-full border border-crimson/30 bg-crimson/10 px-4 py-2 font-ui text-xs font-semibold text-crimson-bright">
          ✓ Subscribed · {TIER_BADGE[mine.tier].emoji} {TIER_NAME[mine.tier]}{tiers.length > 1 ? " · Change" : ""}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn-primary !px-5 !py-2 text-xs">
          Subscribe{fromLabel ? ` · from ${fromLabel}/month` : ""}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-crimson">{error}</p>}
      {open && (offers || global) && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 sm:items-center" role="dialog" aria-modal aria-label={`Subscribe to ${first}`} onClick={() => setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-paper p-5 text-left sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-2xl text-ink">Subscribe to {creatorName || `@${username}`}</p>
                <p className="text-xs text-slate">{global ? `One month at a time · we remind you before it ends · paid by ${payMethodsLabel(cur)}` : "Monthly · cancel any time · paid with NotesApp Credit or card"}</p>
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate">Pay in
                  <select value={cur} onChange={(e) => pickCurrency(e.target.value)} className="rounded-full border border-rule bg-card px-2 py-1 text-xs text-ink" aria-label="Currency">
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full px-2 text-xl text-slate">✕</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {SUB_TIERS.filter((t) => tiers.includes(t)).map((t) => {
                const current = mine?.tier === t;
                return (
                  <div key={t} className={`relative rounded-2xl border bg-card p-4 ${t === "vip" ? "border-crimson-bright ring-2 ring-crimson-bright/30" : "border-rule"}`}>
                    <TierChip tier={t} />
                    <p className="mt-2 font-display text-2xl text-ink">{TIER_NAME[t]}</p>
                    <p className="font-ui text-2xl font-extrabold text-crimson">{priceOf(t)}<span className="text-xs font-normal text-slate"> /month</span></p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-[13.5px] text-ink">{PERKS[t].map((p) => <li key={p}>{p.replace("Their", `${first}'s`)}</li>)}</ul>
                    <button type="button" disabled={current || !!busy || (global && !quote!.tiers.find((x) => x.tier === t)?.payMinor)} onClick={() => (global ? chooseGlobal(t) : choose(t))} className={`mt-3 w-full rounded-full px-4 py-2 font-ui text-sm font-bold ${current ? "bg-rule text-slate" : t === "vip" ? "bg-crimson text-white" : "border border-rule bg-card text-ink hover:border-crimson"}`}>
                      {current ? "Your tier" : busy === t ? "Redirecting…" : mine ? `Switch to ${TIER_NAME[t]}` : `Choose ${TIER_NAME[t]}`}
                    </button>
                  </div>
                );
              })}
            </div>
            {global && quote && !quote.ready && <p className="mt-3 text-xs text-crimson">Prices in {cur} will show again shortly, while exchange rates are updated. You can pay in {quote.home} now.</p>}
            {global && quote && quote.home !== cur && quote.ready && <p className="mt-3 text-xs text-slate">{first} prices in {quote.home}; this is that price in {cur}, including the conversion. You pay {cur}; {first} is paid in {quote.home}.</p>}
            <p className="mt-3 text-xs text-slate">{mine ? "Switching starts the new tier now at its price; the days left on your current tier are added on, and your old tier stops renewing." : `${first} sets each price. Each tier includes the ones below it.`}</p>
          </div>
        </div>
      )}
    </div>
  );
}
