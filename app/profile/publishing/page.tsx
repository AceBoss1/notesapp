"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { canPublish, getUserByUid, UserProfile } from "@/lib/users";
import { LIMITS, WEEKDAYS, formatNaira, formatSlot, PublisherSettings } from "@/lib/booking-time";
import type { LedgerEntry } from "@/lib/payments";
import BecomePublisher from "@/components/BecomePublisher";

const TIME_OPTIONS = Array.from({ length: 30 }, (_, i) => {
  const mins = 6 * 60 + i * 30; // 06:00 … 20:30
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
});

type Bank = { name: string; code: string };
type Payout = { accountName: string; bankName: string; accountLast4: string };

export default function PublishingSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);

  const [sessionOn, setSessionOn] = useState(false);
  const [price, setPrice] = useState("15000");
  const [minutes, setMinutes] = useState(45);
  const [avail, setAvail] = useState<Record<string, string[]>>({});
  const [subOn, setSubOn] = useState(false);
  const [subPrice, setSubPrice] = useState("2000");
  const [giftsOn, setGiftsOn] = useState(true);
  const [adsOn, setAdsOn] = useState(false);
  const [plan, setPlan] = useState<Record<string, any> | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planMsg, setPlanMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [payout, setPayout] = useState<Payout | null>(null);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [boosts, setBoosts] = useState<Record<string, any>[]>([]);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        if (!u) return router.replace("/login");
        setUser(u);
        const p = await getUserByUid(u.uid);
        setProfile(p);
        if (!p) return;
        setAdsOn(p.adsOptIn === true);
        getDoc(doc(db, "tierSubscriptions", u.uid)).then((p) => setPlan(p.exists() ? p.data() : null)).catch(() => {});
        getDocs(query(collection(db, "boosts"), where("publisherUid", "==", u.uid)))
          .then((b) => setBoosts(b.docs.map((d) => d.data()).sort((a, c) => String(c.createdAt).localeCompare(String(a.createdAt)))))
          .catch(() => {});
        const [sSnap, pSnap, lSnap] = await Promise.all([
          getDoc(doc(db, "publisherSettings", u.uid)),
          getDoc(doc(db, "payoutAccounts", u.uid)),
          getDocs(query(collection(db, "ledger"), where("publisherUid", "==", u.uid))),
        ]);
        const s = sSnap.data() as PublisherSettings | undefined;
        if (s) {
          setSessionOn(!!s.session?.enabled);
          if (s.session) {
            setPrice(String(s.session.priceKobo / 100));
            setMinutes(s.session.minutes);
            setAvail(s.session.availability);
          }
          setSubOn(!!s.subscription?.enabled);
          if (s.subscription) setSubPrice(String(s.subscription.priceKobo / 100));
          setGiftsOn(s.gifts?.enabled !== false);
        }
        if (pSnap.exists()) setPayout(pSnap.data() as Payout);
        setLedger(lSnap.docs.map((d) => d.data() as LedgerEntry).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      }),
    [router]
  );

  useEffect(() => {
    fetch("/api/publisher/banks").then((r) => r.json()).then((j) => setBanks(j.banks || [])).catch(() => {});
  }, []);

  async function authedPost(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user!.getIdToken()}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
  }

  async function saveRates(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await authedPost("/api/publisher/settings", {
        session: { enabled: sessionOn, priceNaira: Number(price), minutes, availability: avail },
        subscription: { enabled: subOn, priceNaira: Number(subPrice) },
        gifts: { enabled: giftsOn },
        ads: { optIn: adsOn },
      });
      setMsg({ ok: true, text: "Saved." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't save" });
    } finally {
      setSaving(false);
    }
  }

  async function savePayout(e: React.FormEvent) {
    e.preventDefault();
    setPayoutBusy(true);
    setPayoutMsg(null);
    try {
      const bank = banks.find((b) => b.code === bankCode);
      const r = await authedPost("/api/publisher/payout-account", { bankCode, bankName: bank?.name, accountNumber });
      setPayout({ accountName: r.accountName, bankName: r.bankName, accountLast4: r.accountLast4 });
      setAccountNumber("");
      setPayoutMsg({ ok: true, text: `Verified: ${r.accountName}` });
    } catch (err) {
      setPayoutMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't verify account" });
    } finally {
      setPayoutBusy(false);
    }
  }

  async function cancelPlan() {
    if (!confirm("Stop auto-renewal? You keep your plan until the end of the period you've paid for. No partial refunds.")) return;
    setPlanBusy(true);
    setPlanMsg(null);
    try {
      const r = await authedPost("/api/billing/cancel-tier", {});
      setPlan((p) => (p ? { ...p, status: "cancelled" } : p));
      setPlanMsg(`Auto-renewal stopped. You keep your plan until ${String(r.accessUntil).slice(0, 10)}.`);
    } catch (err) {
      setPlanMsg(err instanceof Error ? err.message : "Couldn't cancel");
    } finally {
      setPlanBusy(false);
    }
  }

  function toggleSlot(day: number, t: string) {
    setAvail((a) => {
      const cur = a[String(day)] || [];
      return { ...a, [String(day)]: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].sort() };
    });
  }

  if (profile === undefined) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (!profile || !canPublish(profile)) {
    return <BecomePublisher user={user} profile={profile} onApplied={() => setProfile((p) => (p ? { ...p, tierRequest: { status: "pending", message: "", requestedAt: new Date().toISOString() } } : p))} />;
  }

  const input = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";
  const owed = ledger.filter((l) => l.status === "held" || l.status === "disputed").reduce((n, l) => n + l.netKobo, 0);
  const paid = ledger.filter((l) => l.status === "paid_out").reduce((n, l) => n + l.netKobo, 0);

  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <p className="eyebrow">@{profile.username}</p>
      <h1 className="mt-3 font-display text-4xl">Rates & payouts</h1>

      {plan && plan.status !== "expired" && (
        <div className="card mt-8 p-6">
          <p className="eyebrow">Your plan</p>
          <p className="mt-2 text-sm text-ink">
            {plan.tier === "pro" ? "Pro" : "Business"} · billed {plan.interval === "annually" ? "yearly" : "monthly"} ·{" "}
            {plan.status === "active" ? `renews around ${String(plan.currentPeriodEnd).slice(0, 10)}` : `ends ${String(plan.currentPeriodEnd).slice(0, 10)} (auto-renewal off)`}
          </p>
          {plan.status === "active" && (
            <button onClick={cancelPlan} disabled={planBusy} className="mt-3 rounded-full border border-rule px-4 py-1.5 text-xs hover:border-crimson hover:text-crimson disabled:opacity-40">
              {planBusy ? "Cancelling…" : "Cancel auto-renewal"}
            </button>
          )}
          {planMsg && <p className="mt-2 text-xs text-slate">{planMsg}</p>}
        </div>
      )}

      <div className="card mt-8 p-6">
        <p className="eyebrow">Payout account</p>
        {payout ? (
          <p className="mt-2 text-sm text-ink">
            {payout.accountName} · {payout.bankName} · ••••{payout.accountLast4}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate">Add a bank account before anyone can book or subscribe — that's where your earnings go.</p>
        )}
        <form onSubmit={savePayout} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className={input} required>
            <option value="">Select bank…</option>
            {banks.map((b) => <option key={b.code + b.name} value={b.code}>{b.name}</option>)}
          </select>
          <input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit account number"
            inputMode="numeric"
            className={input}
            required
          />
          <button disabled={payoutBusy} className="btn-primary !px-5 !py-2 text-xs disabled:opacity-50">
            {payoutBusy ? "Verifying…" : payout ? "Replace" : "Verify & save"}
          </button>
        </form>
        {payoutMsg && <p className={`mt-2 text-xs ${payoutMsg.ok ? "text-ink" : "text-crimson"}`}>{payoutMsg.text}</p>}
      </div>

      <form onSubmit={saveRates} className="mt-8 grid gap-8">
        <div className="card p-6">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={sessionOn} onChange={(e) => setSessionOn(e.target.checked)} />
            <span className="eyebrow">Offer paid 1:1 sessions</span>
          </label>
          {sessionOn && (
            <div className="mt-5 grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs text-slate">
                  Price per session (₦5,000 – ₦500,000)
                  <input type="number" min={5000} max={500000} step={500} value={price} onChange={(e) => setPrice(e.target.value)} className={input} />
                </label>
                <label className="block text-xs text-slate">
                  Length
                  <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={input}>
                    {LIMITS.sessionMinutes.map((m) => <option key={m} value={m}>{m} minutes</option>)}
                  </select>
                </label>
              </div>
              <div>
                <p className="text-xs text-slate">Weekly availability (Lagos time, tap to toggle start times)</p>
                {WEEKDAYS.map((name, d) => (
                  <details key={name} className="mt-2 border border-rule px-3 py-2">
                    <summary className="cursor-pointer text-sm text-ink">
                      {name} <span className="text-slate">· {(avail[String(d)] || []).length} slots</span>
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {TIME_OPTIONS.map((t) => {
                        const on = (avail[String(d)] || []).includes(t);
                        return (
                          <button
                            type="button"
                            key={t}
                            onClick={() => toggleSlot(d, t)}
                            className={`rounded-full border px-3 py-1 text-xs ${on ? "border-crimson bg-crimson text-paper" : "border-rule text-ink"}`}
                          >
                            {formatSlot(t)}
                          </button>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card p-6">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={subOn} onChange={(e) => setSubOn(e.target.checked)} />
            <span className="eyebrow">Offer monthly journal subscriptions (unlocks your premium entries)</span>
          </label>
          {subOn && (
            <label className="mt-5 block text-xs text-slate">
              Price per month (₦1,000 – ₦100,000)
              <input type="number" min={1000} max={100000} step={100} value={subPrice} onChange={(e) => setSubPrice(e.target.value)} className={input} />
              <span className="mt-1 block">Changing the price applies to new subscribers; current ones keep their old price.</span>
            </label>
          )}
        </div>

        <div className="card p-6">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={giftsOn} onChange={(e) => setGiftsOn(e.target.checked)} />
            <span className="eyebrow">Accept gifts (a Gift button on your profile and every post)</span>
          </label>
          <p className="mt-2 text-xs text-slate">Needs a verified payout account. Gifts pay out after a 7-day window, minus your tier's commission.</p>
        </div>

        <div className="card p-6">
          {profile && ["pro", "business", "enterprise"].includes(profile.accountTier) ? (
            <>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={adsOn} onChange={(e) => setAdsOn(e.target.checked)} />
                <span className="eyebrow">Show ads on my journal (earn your plan&apos;s ad share)</span>
              </label>
              <p className="mt-2 text-xs text-slate">
                Ads carry a “Sponsored” note. Pro earns 25% and Business 45% of the ad revenue from your pages, from day one of opting in.
                Ad-share payouts start when the ad program launches — see <Link href="/advertise" className="text-crimson underline">Advertise</Link>.
              </p>
            </>
          ) : (
            <p className="text-xs text-slate">
              Free journals carry ads (no revenue share). Pro and Business publishers can opt in to ads and earn an ad share —{" "}
              <Link href="/pricing" className="text-crimson underline">see plans</Link>.
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button disabled={saving} className="btn-primary !px-6 !py-3 disabled:opacity-50">{saving ? "Saving…" : "Save rates"}</button>
          {msg && <span className={`text-sm ${msg.ok ? "text-ink" : "text-crimson"}`}>{msg.text}</span>}
        </div>
      </form>

      <div className="card mt-10 p-6">
        <p className="eyebrow">Boost results</p>
        {boosts.length === 0 ? (
          <p className="mt-3 text-sm text-slate">
            No boosts yet. <Link href="/boost" className="text-crimson underline">Boost a post</Link> to see its impressions and clicks here.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-ink">
              {boosts.filter((b) => b.status === "active" && new Date(b.endsAt).getTime() > Date.now() && b.impressionsDelivered < b.impressionsPurchased).length} active ·{" "}
              {boosts.reduce((s, b) => s + b.impressionsDelivered, 0).toLocaleString()} impressions ·{" "}
              {boosts.reduce((s, b) => s + b.clicks, 0).toLocaleString()} clicks
            </p>
            <ul className="mt-3 divide-y divide-rule text-sm">
              {boosts.slice(0, 3).map((b) => (
                <li key={b.reference} className="py-2">
                  <p className="text-ink">{b.title}</p>
                  <p className="text-xs text-slate">
                    {b.impressionsDelivered.toLocaleString()} / {b.impressionsPurchased.toLocaleString()} impressions · {b.clicks} clicks ·{" "}
                    {b.status === "active" && new Date(b.endsAt).getTime() > Date.now() ? `runs until ${String(b.endsAt).slice(0, 10)}` : "ended"}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
        <Link href="/profile/boosts" className="mt-3 inline-block text-xs font-semibold text-crimson underline">Full boost performance →</Link>
      </div>

      <div className="card mt-10 p-6">
        <p className="eyebrow">Earnings</p>
        <p className="mt-2 text-sm text-ink">
          Awaiting release: {formatNaira(owed)} · Paid out: {formatNaira(paid)}
        </p>
        <p className="mt-1 text-xs text-slate">
          Session earnings are released after the session; subscription earnings after a 7-day dispute window. Amounts are after NotesApp's commission for your tier.
        </p>
        {ledger.length > 0 && (
          <ul className="mt-4 divide-y divide-rule text-sm">
            {ledger.slice(0, 20).map((l) => (
              <li key={l.reference} className="flex justify-between py-2">
                <span className="text-slate">{l.createdAt.slice(0, 10)} · {l.kind}</span>
                <span className="text-ink">{formatNaira(l.netKobo)} · {l.status.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
