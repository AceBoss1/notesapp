"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import { formatNaira } from "@/lib/booking-time";
import { WALLET_LIVE } from "@/lib/wallet";
import { FUNDS_MAX, FUND_NAME_MAX, GIFT_NOTE_MAX, GIVING_HOLD_HOURS, GIVING_MIN_KOBO, giftProblem, quoteGift } from "@/lib/giving";
import { capi, field, small, ago } from "./api";

// Giving (lib/giving.ts): the Give button and form on a community, and the Giving section of its admin tools.
export type GivingView = { funds: string[]; capKobo: number | null; canGive: boolean };

export function GiveButton({ cid, name, giving, signedIn, loginHref }: { cid: string; name: string; giving: GivingView; signedIn: boolean; loginHref: string }) {
  const [open, setOpen] = useState(false);
  if (!signedIn) return <Link href={loginHref} className={`${small} !px-4 !py-2`}>Sign in to give</Link>;
  if (!giving.canGive) return null;
  return (
    <>
      <button className="btn-primary !px-4 !py-2 text-xs" onClick={() => setOpen(true)}>Give</button>
      {open && <GiveForm cid={cid} name={name} giving={giving} onClose={() => setOpen(false)} />}
    </>
  );
}

function GiveForm({ cid, name, giving, onClose }: { cid: string; name: string; giving: GivingView; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [fund, setFund] = useState(giving.funds[0] ?? "Donation");
  const [note, setNote] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [cover, setCover] = useState(true);
  const [method, setMethod] = useState<"card" | "wallet">("card");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const giftKobo = Math.round(Number(amount) * 100);
  const problem = amount ? giftProblem(giftKobo, giving.capKobo === null) : null;
  const q = giftKobo >= GIVING_MIN_KOBO && !problem ? quoteGift(giftKobo, { method, cover }) : null;
  async function pay() {
    const u = auth.currentUser;
    if (!u || !q) return;
    setBusy(true); setErr("");
    try { await startCheckout(u, { kind: "giving", cid, amountNaira: Number(amount), fund, note, anonymous, cover }, { payWith: method, amountKobo: q.payKobo }); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't start the payment."); setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={`Give to ${name}`} onClick={onClose}>
      <div className="card max-h-[90vh] w-full max-w-md overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3"><h3 className="font-display text-xl text-ink">Give to {name}</h3><button className="text-slate" onClick={onClose} aria-label="Close">✕</button></div>
        <label className="mt-4 block text-xs text-slate">Amount (₦)
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} placeholder="e.g. 5000" className={`${field} mt-1 text-lg`} autoFocus />
        </label>
        {giving.capKobo !== null && <p className="mt-1 text-xs text-slate">Until this community is verified, each gift can be up to {formatNaira(giving.capKobo)}.</p>}
        {problem && <p className="mt-1 text-xs text-crimson">{problem}</p>}
        <label className="mt-3 block text-xs text-slate">Fund
          <select value={fund} onChange={(e) => setFund(e.target.value)} className={`${field} mt-1`}>{giving.funds.map((f) => <option key={f}>{f}</option>)}</select>
        </label>
        <label className="mt-3 block text-xs text-slate">Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={GIFT_NOTE_MAX} placeholder="e.g. Thanksgiving for my family" className={`${field} mt-1`} />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />Give anonymously (the admins won&apos;t see your name)</label>
        <label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={cover} onChange={(e) => setCover(e.target.checked)} />Cover the charges, so {name} gets the whole gift</label>
        {WALLET_LIVE && (
          <div className="mt-3 flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={method === "card"} onChange={() => setMethod("card")} />Card or bank</label>
            <label className="flex items-center gap-2"><input type="radio" checked={method === "wallet"} onChange={() => setMethod("wallet")} />My wallet (lower charges)</label>
          </div>
        )}
        {q && (
          <dl className="mt-4 space-y-1 rounded-xl bg-paper p-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate">Gift</dt><dd>{formatNaira(q.giftKobo)}</dd></div>
            {q.cardChargeKobo > 0 && <div className="flex justify-between"><dt className="text-slate">Card charge (Paystack)</dt><dd>{formatNaira(q.cardChargeKobo)}</dd></div>}
            <div className="flex justify-between"><dt className="text-slate">Charge</dt><dd>{formatNaira(q.bandKobo)}</dd></div>
            <div className="flex justify-between border-t border-rule pt-1 font-semibold"><dt>You pay</dt><dd>{formatNaira(q.payKobo)}</dd></div>
            <div className="flex justify-between text-xs text-slate"><dt>{name} receives</dt><dd>{formatNaira(q.netKobo)}</dd></div>
          </dl>
        )}
        <p className="mt-3 text-xs text-slate">Charges are like a bank transfer: ₦10 up to ₦5,000, ₦25 up to ₦50,000, ₦50 above{method === "card" ? ", plus the card charge at cost" : ""}. No commission. You get a receipt by email and under My giving.</p>
        {err && <p className="mt-2 text-sm text-crimson" role="alert">{err}</p>}
        <button className="btn-primary mt-4 w-full !py-2 text-sm" disabled={!q || busy} onClick={pay}>{busy ? "Starting…" : q ? `Give ${formatNaira(q.payKobo)}` : "Give"}</button>
      </div>
    </div>
  );
}

// ---- Admins: switch giving on, name the funds, see the gifts and the totals per fund ----
type Gifts = {
  totals: { count: number; giftKobo: number; netKobo: number };
  funds: { fund: string; count: number; giftKobo: number; netKobo: number }[];
  gifts: { reference: string; fund: string; note: string; giverName: string; giftKobo: number; netKobo: number; covered: boolean; status: string; createdAt: string }[];
};
export function GivingAdmin({ cid, initial, verified, onSaved }: { cid: string; initial: { enabled: boolean; funds: string[] }; verified: boolean; onSaved: () => void }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState<Gifts | null>(null);
  const load = useCallback(() => capi<Gifts>(`/api/giving?cid=${cid}`).then(setD).catch(() => setD(null)), [cid]);
  useEffect(() => { load(); }, [load]);
  async function save() {
    setBusy(true); setMsg("");
    try { const r = await capi<{ giving: { enabled: boolean; funds: string[] } }>("/api/giving", { action: "settings", cid, ...s }); setS(r.giving); setMsg("Saved."); onSaved(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save."); }
    finally { setBusy(false); }
  }
  return (
    <section className="card p-5">
      <h3 className="font-display text-xl text-ink">Giving</h3>
      <p className="mt-1 text-xs text-slate">Members (and signed-in visitors, when your community is listed) can give by card, bank or their wallet. Charges are like a bank transfer: ₦10 up to ₦5,000, ₦25 up to ₦50,000, ₦50 above, plus Paystack&apos;s card charge at cost when paid by card; givers can cover them. No commission. Gifts are paid to the owner&apos;s bank account under Rates &amp; payouts, together, a day after they&apos;re given (from {GIVING_HOLD_HOURS} hours).{verified ? "" : " Until the community is verified, each gift is capped at ₦20,000."}</p>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />Take gifts (shows a Give button)</label>
      <p className="mt-3 text-xs text-slate">Funds (up to {FUNDS_MAX}), e.g. Tithe, Offering, Building fund</p>
      {s.funds.map((f, i) => <div key={i} className="mt-1 flex gap-2"><input value={f} maxLength={FUND_NAME_MAX} onChange={(e) => setS({ ...s, funds: s.funds.map((x, j) => (j === i ? e.target.value : x)) })} className={field} aria-label={`Fund ${i + 1}`} />{s.funds.length > 1 && <button className={small} onClick={() => setS({ ...s, funds: s.funds.filter((_, j) => j !== i) })}>Remove</button>}</div>)}
      {s.funds.length < FUNDS_MAX && <button className={`${small} mt-2`} onClick={() => setS({ ...s, funds: [...s.funds, ""] })}>+ Add a fund</button>}
      <div className="mt-4 flex items-center gap-3"><button className="btn-primary !px-4 !py-2 text-xs" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save giving"}</button>{msg && <span className="text-sm text-ink" role="status">{msg}</span>}</div>

      {d && d.totals.count > 0 && (
        <div className="mt-6">
          <p className="font-ui text-sm font-bold text-ink">{d.totals.count} {d.totals.count === 1 ? "gift" : "gifts"} · {formatNaira(d.totals.giftKobo)} given · {formatNaira(d.totals.netKobo)} to you after charges</p>
          <table className="mt-2 w-full text-sm"><thead><tr className="text-left text-xs text-slate"><th className="py-1">Fund</th><th>Gifts</th><th>Given</th><th>After charges</th></tr></thead>
            <tbody>{d.funds.map((f) => <tr key={f.fund} className="border-t border-rule"><td className="py-1">{f.fund}</td><td>{f.count}</td><td>{formatNaira(f.giftKobo)}</td><td>{formatNaira(f.netKobo)}</td></tr>)}</tbody>
          </table>
          <ul className="mt-4 divide-y divide-rule text-sm">{d.gifts.map((g) => (
            <li key={g.reference} className="flex flex-wrap items-baseline gap-x-3 py-2">
              <span className="font-semibold text-ink">{formatNaira(g.giftKobo)}</span><span className="text-slate">{g.fund}</span><span className="text-slate">{g.giverName}</span>
              {g.status === "refunded" && <span className="text-xs font-semibold text-crimson">Refunded</span>}
              <span className="ml-auto text-xs text-slate">{ago(g.createdAt)}</span>
              {g.note && <span className="w-full text-xs text-slate">“{g.note}”</span>}
            </li>
          ))}</ul>
        </div>
      )}
    </section>
  );
}
