"use client";

import { useEffect, useState } from "react";
import { SALE_METHODS, longDate, naira, type Entry, type Method } from "@/lib/books";
import { Icon, Sheet, field, nairaInput, newClientId, pill, type Api } from "./shared";
import { EntryList } from "./Home";
import { OutboxPanel, kvGet, kvSet, saveOrQueue, useOutbox } from "./outbox";

// A cashier's Business books (docs/BUSINESS-BOOKS.md, step 10): record a sale, record a payment received, Tell Nana, and the sales and
// payments they recorded today, each with its receipt to print or share. No profit, costs, expenses, other people's entries or exports;
// the server never sends them (lib/books-staff-server.ts cashierHome).
export type CashierData = {
  role: "cashier"; today: string; shop: { name: string; username: string; tier: string }; inventory: boolean;
  mine: { sales: number; salesKobo: number; paymentsKobo: number }; entries: Entry[]; accounts: { uid: string; name: string }[]; owner: string;
};

export default function CashierHome({ data, api, onSale, onNana, onChanged }: { data: CashierData; api: Api; onSale: () => void; onNana: () => void; onChanged: () => void }) {
  const [paying, setPaying] = useState(false);
  return (
    <div>
      <p className="eyebrow">{data.shop.name} · {longDate(data.today)}</p>
      <h1 className="mt-1 font-display text-4xl text-ink">At the counter</h1>
      <p className="mt-2 text-[15px] text-slate">You&apos;re a cashier on {data.shop.name}&apos;s books: you record sales and payments received, and share receipts.</p>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="card p-4"><p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson">Your sales today</p><p className="mt-1.5 font-ui text-2xl font-bold text-ink">{naira(data.mine.salesKobo)}</p><p className="mt-1 text-[13px] text-slate">{data.mine.sales} {data.mine.sales === 1 ? "sale" : "sales"} you recorded</p></div>
        <div className="card p-4"><p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson">Payments you took</p><p className="mt-1.5 font-ui text-2xl font-bold text-ink">{naira(data.mine.paymentsKobo)}</p><p className="mt-1 text-[13px] text-slate">From customers paying back</p></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <button onClick={onSale} className="btn-primary !py-4 !text-base"><Icon name="plus" className="h-5 w-5" />Record a sale</button>
        <button onClick={() => setPaying(true)} className={`${pill} !py-3.5`}><Icon name="people" className="h-4 w-4" />Payment received</button>
        <button onClick={onNana} className={`${pill} !py-3.5`}><Icon name="sparkle" className="h-4 w-4" />Tell Nana</button>
      </div>
      <OutboxPanel />
      <section className="card mt-5 p-5">
        <h2 className="font-ui text-lg font-bold text-ink">What you recorded today</h2>
        {data.entries.length ? <EntryList entries={data.entries} api={api} categories={[]} onChanged={onChanged} /> : <p className="mt-2 text-sm text-slate">Nothing yet today. Tap Record a sale.</p>}
      </section>
      <p className="mt-4 text-xs text-slate">The owner sees who recorded each entry. To fix a mistake, open the entry and Void it with a reason (today&apos;s, your own).</p>
      {paying && <PaymentReceived api={api} onClose={() => setPaying(false)} onSaved={onChanged} />}
    </div>
  );
}

// A customer paying back what they owe (all or part), oldest sales first. Saves on the phone when there's no connection.
export function PaymentReceived({ api, onClose, onSaved }: { api: Api; onClose: () => void; onSaved: () => void }) {
  const outbox = useOutbox();
  const [customers, setCustomers] = useState<{ id: string; name: string; balanceKobo: number }[] | null>(null);
  const [who, setWho] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("cash");
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const [clientId] = useState(newClientId);
  const snap = outbox?.owner ?? "";
  useEffect(() => {
    api<{ customers: { id: string; name: string; balanceKobo: number }[] }>("view=customers").then((r) => { setCustomers(r.customers); void kvSet(`customers:${snap}`, r.customers); })
      .catch(async () => setCustomers((await kvGet<{ id: string; name: string; balanceKobo: number }[]>(`customers:${snap}`)) ?? []));
  }, [api, snap]);
  const owing = (customers ?? []).filter((c) => c.balanceKobo > 0);
  const c = owing.find((x) => x.id === who);
  const save = async () => {
    setErr("");
    const k = nairaInput(amount);
    if (!c) return setErr("Choose who paid.");
    if (!k) return setErr("Enter how much they paid.");
    setBusy(true);
    try {
      const body = { action: "payment", clientId, partyId: c.id, partyName: c.name, amountKobo: k, method };
      const r = await saveOrQueue(outbox, () => api("", body), "payment", body, `${c.name} paid back`, k);
      setDone(r.queued ? "Saved on this phone. It syncs when you're back online." : `${naira(k)} from ${c.name} is recorded.`);
      onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Sheet title="Payment received" eyebrow="New entry · money in" onClose={onClose}>
      {done ? <><p className="rounded-2xl bg-field p-4 text-ink" role="status">{done}</p><button onClick={onClose} className="btn-primary mt-4 w-full">Done</button></> : <>
        <label className="block text-sm font-semibold text-ink">Who paid?
          <select value={who} onChange={(e) => setWho(e.target.value)} className={`${field} mt-1`}>
            <option value="">{customers === null ? "Loading…" : owing.length ? "Choose…" : "Nobody owes anything"}</option>
            {owing.map((x) => <option key={x.id} value={x.id}>{x.name} (owes {naira(x.balanceKobo)})</option>)}
          </select>
        </label>
        <label className="mt-3 block text-sm font-semibold text-ink">Amount (₦)<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={c ? String(c.balanceKobo / 100) : "20,000"} className={`${field} mt-1 text-lg`} /></label>
        <div className="mt-3 grid grid-cols-3 gap-2">{SALE_METHODS.map((m) => <button key={m.id} onClick={() => setMethod(m.id)} className={`rounded-xl border px-2 py-3 font-ui text-sm font-semibold ${method === m.id ? "border-crimson bg-crimson/10 text-crimson" : "border-rule text-ink"}`}>{m.label}</button>)}</div>
        {err && <p className="mt-3 text-sm text-red-700" role="alert">{err}</p>}
        <button onClick={save} disabled={busy} className="btn-primary mt-4 w-full !py-4">{busy ? "Saving…" : "Save payment"}</button>
      </>}
    </Sheet>
  );
}
