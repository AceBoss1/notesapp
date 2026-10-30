"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import { CREDIT_BONUS, HOLD_DAYS, MAX_AFFILIATE_PERCENT, MIN_CASH_KOBO, PLAN_MONTHS, PLAN_SHARE, referralLink } from "@/lib/referrals";
import { naira } from "@/lib/discounts";

// A member's referrals and affiliate earnings (lib/referrals.ts): their link, what they've earned, taking it as cash or as
// NotesApp Credit with a bonus, and, for publishers, the share they offer affiliates on each product.
type Summary = {
  username: string; verified: boolean; walletLive: boolean; offer: { from: string } | null;
  payout: { bankName: string; accountLast4: string } | null;
  friendsJoined: number; payingFriends: number; availableKobo: number; pendingKobo: number; paidOutKobo: number;
  earnings: { id: string; source: string; title: string; kobo: number; percent: number; status: string; releaseAfter: string; createdAt: string }[];
  withdrawals: { id: string; method: string; kobo: number; bonusKobo?: number; at: string }[];
};
type Offer = { id: string; type: "item" | "course"; itemId: string; percent: number };
type Product = { type: "item" | "course"; itemId: string; title: string; priceKobo: number; kind: string };

const SOURCE: Record<string, string> = { plan: "Plan", store: "Shop", digital: "Download", course: "Course" };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

export function CopyLink({ url, label = "Copy" }: { url: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn-primary !px-4 !py-2 text-sm" onClick={async () => {
      try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1800); } catch { window.prompt("Copy your link", url); }
    }}>{done ? "Copied ✓" : label}</button>
  );
}

// Where cash goes, for a member who isn't a publisher (publishers already have one under Rates & payouts). The bank checks the name.
function BankForm({ onSaved }: { onSaved: () => void }) {
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/publisher/banks").then((r) => r.json()).then((j) => setBanks(j.banks || [])).catch(() => {}); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api("/api/publisher/payout-account", { body: { bankCode, bankName: banks.find((b) => b.code === bankCode)?.name, accountNumber } });
      onSaved();
    } catch (x) { setError(x instanceof Error ? x.message : "Couldn't verify that account."); }
    finally { setBusy(false); }
  }
  const input = "w-full rounded-lg border border-rule bg-card px-3 py-2 text-sm text-ink outline-none focus:border-crimson";
  return (
    <form onSubmit={save} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className={input} required aria-label="Bank">
        <option value="">Your bank…</option>
        {banks.map((b) => <option key={b.code + b.name} value={b.code}>{b.name}</option>)}
      </select>
      <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit account number" inputMode="numeric" className={input} required aria-label="Account number" />
      <button disabled={busy} className="btn-ghost !px-4 !py-2 text-sm disabled:opacity-50">{busy ? "Checking…" : "Add bank account"}</button>
      {error && <p className="text-xs text-crimson sm:col-span-3" role="alert">{error}</p>}
    </form>
  );
}

export default function ReferralsPanel() {
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [shares, setShares] = useState<Record<string, string>>({});
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    try {
      const [sum, mine] = await Promise.all([
        api<Summary>("/api/referrals"),
        api<{ offers: Offer[]; products: Product[] }>("/api/referrals/offers?mine=1"),
      ]);
      setS(sum); setProducts(mine.products);
      setShares(Object.fromEntries(mine.offers.map((o) => [o.id, String(o.percent)])));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your referrals."); }
  }, []);
  useEffect(() => {
    setOrigin(window.location.origin);
    // A new member who signed up another way (Google) records their referral here; the server ignores it otherwise.
    api("/api/referrals", { body: { action: "claim" } }).catch(() => {}).finally(() => void load());
  }, [load]);

  async function take(method: "cash" | "credit") {
    setBusy(method); setError(""); setNote("");
    try {
      const r = await api<{ kobo: number; bonusKobo?: number }>("/api/referrals", { body: { action: "withdraw", method } });
      setNote(method === "cash" ? `${naira(r.kobo)} is on its way to your bank account.` : `${naira(r.kobo + (r.bonusKobo ?? 0))} added to your NotesApp Credit (including a ${naira(r.bonusKobo ?? 0)} bonus).`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't do that."); }
    finally { setBusy(""); }
  }
  async function saveShare(p: Product) {
    const id = `${p.type}_${p.itemId}`;
    setBusy(id); setError(""); setNote("");
    try {
      await api("/api/referrals/offers", { body: { type: p.type, itemId: p.itemId, percent: Number(shares[id] || 0) } });
      setNote(Number(shares[id] || 0) ? `${p.title} is on the affiliate marketplace at ${shares[id]}%.` : `${p.title} is off the affiliate marketplace.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); }
    finally { setBusy(""); }
  }

  if (!s) return error ? <p className="rounded-lg bg-crimson/10 px-3 py-2 text-sm text-crimson" role="alert">{error}</p> : <p className="text-sm text-slate">Loading…</p>;
  const link = s.username ? referralLink(origin, s.username) : "";
  const cashOk = s.availableKobo >= MIN_CASH_KOBO;

  return (
    <div className="space-y-8">
      {error && <p className="rounded-lg bg-crimson/10 px-3 py-2 text-sm text-crimson" role="alert">{error}</p>}
      {note && <p className="rounded-lg bg-moss/10 px-3 py-2 text-sm text-moss" role="status">{note}</p>}
      {s.offer && (
        <p className="rounded-lg border border-crimson/30 bg-crimson/5 px-4 py-3 text-sm text-ink">
          @{s.offer.from} invited you: your first month of a plan is free (on a yearly plan, one month off). <Link href="/pricing" className="text-crimson underline">Choose a plan</Link>
        </p>
      )}

      <div className="card p-5">
        <h2 className="font-display text-2xl text-ink">Your link</h2>
        {!s.verified ? (
          <p className="mt-2 text-sm text-slate">Verify your email to start earning. Your link works once you have.</p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-rule bg-field px-3 py-2 text-sm text-ink">{link}</code>
              <CopyLink url={link} />
            </div>
            <p className="mt-3 text-sm text-ink">
              Or give them your code: <b className="font-mono text-crimson">{s.username.toUpperCase()}</b>. They type it under &quot;Have a discount code?&quot; when they choose a plan.
            </p>
            <p className="mt-2 text-sm text-slate">
              Friends who join with your link or code get their first month of a plan free. You earn {Math.round(PLAN_SHARE * 100)}% of what they pay for their plan for {PLAN_MONTHS} months, from their first payment.
              To earn on products, find one on the <Link href="/affiliates" className="text-crimson underline">affiliate marketplace</Link> and share its link.
            </p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Ready to take", naira(s.availableKobo)],
          ["Waiting", naira(s.pendingKobo)],
          ["Taken so far", naira(s.paidOutKobo)],
          ["Friends joined", `${s.friendsJoined} · ${s.payingFriends} paying`],
        ].map(([k, v]) => (
          <div key={k} className="card p-4"><p className="font-ui text-xs font-semibold text-slate">{k}</p><p className="mt-1 font-display text-xl text-ink sm:text-2xl">{v}</p></div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="font-display text-2xl text-ink">Take your earnings</h2>
        <p className="mt-1 text-sm text-slate">
          Earnings wait {HOLD_DAYS.plan} days ({HOLD_DAYS.store} for delivered shop items) so payments can clear. Then take them as cash to your bank account, from {naira(MIN_CASH_KOBO)},
          or as NotesApp Credit with {Math.round(CREDIT_BONUS * 100)}% extra, any amount.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={!cashOk || !!busy} onClick={() => take("cash")} className="btn-primary !px-5 !py-2.5 text-sm disabled:opacity-50">
            {busy === "cash" ? "Sending…" : `Cash ${naira(s.availableKobo)}`}
          </button>
          <button type="button" disabled={!s.walletLive || s.availableKobo <= 0 || !!busy} onClick={() => take("credit")} className="btn-ghost !px-5 !py-2.5 text-sm disabled:opacity-50">
            {busy === "credit" ? "Adding…" : `Credit ${naira(Math.round(s.availableKobo * (1 + CREDIT_BONUS)))}`}
          </button>
        </div>
        {!cashOk && s.availableKobo > 0 && <p className="mt-2 text-xs text-slate">Cash opens at {naira(MIN_CASH_KOBO)}.</p>}
        {!s.walletLive && <p className="mt-2 text-xs text-slate">NotesApp Credit isn&apos;t live yet; your earnings keep until it is, or take them as cash.</p>}
        {s.payout ? (
          <p className="mt-2 text-xs text-slate">Cash goes to {s.payout.bankName} ••••{s.payout.accountLast4} (change it in <Link href="/profile/publishing" className="text-crimson underline">Rates &amp; payouts</Link>).</p>
        ) : s.earnings.length > 0 ? <BankForm onSaved={load} /> : null}
      </div>

      <div>
        <h2 className="font-display text-2xl text-ink">Earnings</h2>
        {s.earnings.length === 0 ? <p className="mt-2 text-sm text-slate">Nothing yet. Share your link to start.</p> : (
          <ul className="mt-2 divide-y divide-rule text-sm">
            {s.earnings.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="min-w-0"><b className="text-ink">{SOURCE[e.source] ?? e.source}</b> · {e.title} · {e.percent}%</span>
                <span className="text-slate">
                  {naira(e.kobo)} · {e.status === "available" ? "ready" : e.status === "held" ? `ready ${day(e.releaseAfter)}` : e.status} · {day(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {s.withdrawals.length > 0 && (
          <p className="mt-3 text-xs text-slate">Taken: {s.withdrawals.map((w) => `${naira(w.kobo + (w.bonusKobo ?? 0))} as ${w.method} (${day(w.at)})`).join(" · ")}</p>
        )}
      </div>

      {products.length > 0 && (
        <div className="card p-5">
          <h2 className="font-display text-2xl text-ink">Let affiliates sell your products</h2>
          <p className="mt-1 text-sm text-slate">
            Set a share (up to {MAX_AFFILIATE_PERCENT}%) and the product goes on the <Link href="/affiliates" className="text-crimson underline">affiliate marketplace</Link>.
            Members who promote it earn that share of what the buyer pays, out of your part of the sale. 0 takes it off.
          </p>
          <ul className="mt-4 divide-y divide-rule">
            {products.map((p) => {
              const id = `${p.type}_${p.itemId}`;
              return (
                <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 basis-48"><b className="text-ink">{p.title}</b> · {SOURCE[p.kind] ?? p.kind} · {naira(p.priceKobo)}</span>
                  <span className="flex items-center gap-2">
                    <input type="number" min={0} max={MAX_AFFILIATE_PERCENT} value={shares[id] ?? ""} placeholder="0"
                      onChange={(e) => setShares((x) => ({ ...x, [id]: e.target.value }))} aria-label={`Affiliate share for ${p.title}`}
                      className="w-20 rounded-lg border border-rule bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-crimson" />
                    <span className="text-slate">%</span>
                    <button type="button" onClick={() => saveShare(p)} disabled={busy === id} className="rounded-full border border-rule px-3 py-1.5 font-ui text-xs font-semibold text-ink hover:border-crimson">{busy === id ? "Saving…" : "Save"}</button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
