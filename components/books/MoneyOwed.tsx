"use client";

import { useCallback, useEffect, useState } from "react";
import { SALE_METHODS, naira, shortDate, type Method } from "@/lib/books";
import { Badge, Icon, WhatsAppIcon, field, nairaInput, newClientId, pill, type Api } from "./shared";

// Money owed: customers who owe you (late first), with reminders (email and bell for members; WhatsApp click-to-send with the #NotesApp
// line for everyone else; SMS greyed out until Send-Na), recording a payment (all or part), and a simple list of what you owe suppliers.
type Debtor = {
  party: { id: string; name: string; member: boolean; hasPhone: boolean; phoneMasked: string; remindersOff?: boolean };
  openKobo: number; overdueKobo: number; since: string; dueOn?: string; daysLate: number; what: string; preview: string; link: string;
  entries: { id: string; on: string; openKobo: number; dueOn?: string; title: string }[]; lastReminder: { at: string; channel: string } | null;
};
type Owed = {
  today: string; shop: string; caps: { freeCustomers: number }; access: { unlimited: boolean };
  debtors: Debtor[]; totals: { owedKobo: number; overdueKobo: number; people: number; latePeople: number; paidBackKobo: number };
  suppliers: { id: string; name: string; balanceKobo: number; dueOn: string; note: string }[];
};

export default function MoneyOwed({ api, onChanged }: { api: Api; onChanged: () => void }) {
  const [data, setData] = useState<Owed | null>(null);
  const [side, setSide] = useState<"in" | "out">("in");
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => api<Owed>("view=owed").then((d) => { setData(d); setSel((s) => s ?? d.debtors[0]?.party.id ?? null); }).catch((e) => setErr(e.message)), [api]);
  useEffect(() => { load(); }, [load]);
  if (err) return <p className="card p-5 text-sm text-red-700">{err}</p>;
  if (!data) return <p className="text-sm text-slate">Loading…</p>;
  const owe = data.suppliers.reduce((n, s) => n + s.balanceKobo, 0);
  const d = data.debtors.find((x) => x.party.id === sel);
  const changed = () => { load(); onChanged(); };
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Money owed</p><h1 className="mt-1 font-display text-4xl text-ink">{side === "in" ? "Owed to you" : "You owe"}</h1></div>
        <div className="inline-flex rounded-full bg-field p-1">
          <button onClick={() => setSide("in")} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${side === "in" ? "bg-card text-ink shadow-sm" : "text-slate"}`}>Owed to you · {naira(data.totals.owedKobo)}</button>
          <button onClick={() => setSide("out")} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${side === "out" ? "bg-card text-ink shadow-sm" : "text-slate"}`}>You owe · {naira(owe)}</button>
        </div>
      </div>
      {side === "out" ? <Suppliers api={api} list={data.suppliers} onChanged={changed} /> : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="card p-4"><p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson">Total</p><p className="mt-1 font-ui text-xl font-bold text-ink sm:text-2xl">{naira(data.totals.owedKobo)}</p><p className="text-xs text-slate">{data.totals.people} {data.totals.people === 1 ? "person" : "people"}</p></div>
            <div className="card p-4"><p className="font-mono text-[11px] uppercase tracking-eyebrow text-red-700">Overdue</p><p className="mt-1 font-ui text-xl font-bold text-red-700 sm:text-2xl">{naira(data.totals.overdueKobo)}</p><p className="text-xs text-slate">{data.totals.latePeople} {data.totals.latePeople === 1 ? "person" : "people"}</p></div>
            <div className="card p-4"><p className="font-mono text-[11px] uppercase tracking-eyebrow text-moss">Paid back</p><p className="mt-1 font-ui text-xl font-bold text-moss sm:text-2xl">{naira(data.totals.paidBackKobo)}</p><p className="text-xs text-slate">this month</p></div>
          </div>
          {!data.access.unlimited && <p className="mt-3 text-xs text-slate">Free Basic keeps up to {data.caps.freeCustomers} customers owing at once ({data.totals.people} now).</p>}
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="card overflow-hidden">
              {data.debtors.length ? (
                <ul className="divide-y divide-rule">
                  {data.debtors.map((x) => (
                    <li key={x.party.id}>
                      <button onClick={() => setSel(x.party.id)} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${sel === x.party.id ? "bg-crimson/5" : "hover:bg-field/60"}`}>
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-field font-ui text-sm font-bold text-crimson">{x.party.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate font-ui font-bold text-ink">{x.party.name}</span><span className="block truncate text-[13px] text-slate">{x.what} · since {shortDate(x.since)}{x.lastReminder ? ` · reminded ${shortDate(x.lastReminder.at.slice(0, 10))}` : ""}</span></span>
                        <span className="shrink-0 text-right"><span className="block font-ui font-bold text-ink">{naira(x.openKobo)}</span>{x.daysLate > 0 ? <Badge tone="late">{x.daysLate} {x.daysLate === 1 ? "day" : "days"} late</Badge> : x.dueOn ? <Badge>Due {shortDate(x.dueOn)}</Badge> : null}</span>
                      </button>
                      {sel === x.party.id && <div className="border-t border-rule p-4 lg:hidden"><Remind api={api} d={x} onChanged={changed} /></div>}
                    </li>
                  ))}
                </ul>
              ) : <p className="p-5 text-sm text-slate">Nobody owes you anything. When a customer buys on credit (Record a sale → Customer owes), they show here.</p>}
              <div className="border-t border-rule p-4">{adding ? <AddCustomer api={api} onDone={() => { setAdding(false); changed(); }} /> : <button onClick={() => setAdding(true)} className={pill}><Icon name="plus" className="h-4 w-4" />Add a customer</button>}</div>
            </div>
            <div className="hidden lg:block">{d ? <div className="card p-5"><Remind api={api} d={d} onChanged={changed} /></div> : null}</div>
          </div>
        </>
      )}
    </div>
  );
}

function Remind({ api, d, onChanged }: { api: Api; d: Debtor; onChanged: () => void }) {
  const [msg, setMsg] = useState("");
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("cash");
  const [phone, setPhone] = useState("");
  const remind = async (channel: "whatsapp" | "email", force = false) => {
    setMsg("");
    try {
      const r = await api<{ url?: string }>("", { action: "remind", partyId: d.party.id, channel, force });
      if (r.url) { window.open(r.url, "_blank", "noopener"); setMsg("WhatsApp opened with the message written. Tap Send there."); }
      else setMsg(`Sent to ${d.party.name.split(" ")[0]} by email and bell.`);
      onChanged();
    } catch (e) {
      const x = e as Error & { code?: string };
      if (x.code === "reminders_off" && channel === "whatsapp" && window.confirm(x.message)) return remind(channel, true);
      setMsg(x.message);
    }
  };
  const receipt = async () => {
    const latest = [...d.entries].sort((a, b) => b.on.localeCompare(a.on))[0];
    try { const r = await api<{ url?: string }>("", { action: "receipt", entryId: latest.id, channel: "whatsapp" }); if (r.url) window.open(r.url, "_blank", "noopener"); setMsg("WhatsApp opened with the receipt written."); } catch (e) { setMsg((e as Error).message); }
  };
  const pay = async () => {
    const k = nairaInput(amount);
    if (!k) return setMsg("Enter how much they paid.");
    try { await api("", { action: "payment", clientId: newClientId(), partyId: d.party.id, amountKobo: k, method }); setPaying(false); setAmount(""); setMsg("Payment recorded."); onChanged(); } catch (e) { setMsg((e as Error).message); }
  };
  const savePhone = async () => { try { await api("", { action: "party", id: d.party.id, kind: "customer", name: d.party.name, phone }); setMsg("Number saved."); onChanged(); } catch (e) { setMsg((e as Error).message); } };
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div><p className="eyebrow">Remind</p><h2 className="mt-1 font-ui text-xl font-bold text-ink">{d.party.name}</h2><p className="font-ui font-bold text-ink">{naira(d.openKobo)}{d.daysLate ? ` · ${d.daysLate} ${d.daysLate === 1 ? "day" : "days"} late` : d.dueOn ? ` · due ${shortDate(d.dueOn)}` : ""}</p></div>
        <button onClick={() => setPaying(!paying)} className={pill}>Record payment</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Badge>{d.party.member ? "On #NotesApp" : "Not on #NotesApp"}</Badge>
        {d.party.phoneMasked && <Badge>{d.party.phoneMasked}</Badge>}
        {d.party.remindersOff && <Badge tone="late">Asked for no reminders</Badge>}
        <span className="text-slate">{d.lastReminder ? `Last reminded ${shortDate(d.lastReminder.at.slice(0, 10))}` : "Not reminded yet"}</span>
      </div>
      {paying && (
        <div className="mt-3 rounded-2xl border border-rule p-3">
          <div className="flex gap-2"><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={`Up to ${naira(d.openKobo)}`} aria-label="Amount paid" className={field} /><button onClick={() => setAmount(String(d.openKobo / 100))} className={pill}>All</button></div>
          <div className="mt-2 flex gap-2">{SALE_METHODS.map((m) => <button key={m.id} onClick={() => setMethod(m.id)} className={`flex-1 rounded-xl border px-2 py-2 text-sm font-semibold ${method === m.id ? "border-crimson bg-crimson/10 text-crimson" : "border-rule text-ink"}`}>{m.label}</button>)}</div>
          <button onClick={pay} className="btn-primary mt-2 w-full">Save payment</button>
        </div>
      )}
      <p className="mt-4 text-sm font-semibold text-ink">They&apos;ll read</p>
      <div className="mt-2 whitespace-pre-line rounded-2xl bg-field p-4 text-[15px] leading-relaxed text-ink">
        {d.preview.split("\n\n")[0]}
        <div className="mt-3 border-t border-rule pt-3 text-sm text-slate">{d.preview.split("\n\n").slice(1).join("\n\n")}</div>
      </div>
      {!d.party.hasPhone && !d.party.member && (
        <div className="mt-3 flex gap-2"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Their WhatsApp number" aria-label="Their WhatsApp number" inputMode="tel" className={field} /><button onClick={savePhone} className={pill}>Save</button></div>
      )}
      <button onClick={() => remind("whatsapp")} disabled={!d.party.hasPhone} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1E7A4C] px-5 py-3.5 font-ui font-semibold text-white hover:bg-[#17633d] disabled:opacity-40"><WhatsAppIcon />Remind by WhatsApp</button>
      {d.party.member && <button onClick={() => remind("email")} className={`${pill} mt-2 w-full`}>Remind by email and bell</button>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={receipt} disabled={!d.party.hasPhone} className={pill}><Icon name="file" className="h-4 w-4" />Send receipt by WhatsApp</button>
        <button disabled className={pill} title="SMS comes with Send-Na"><Icon name="chat" className="h-4 w-4" />SMS · with Send-Na</button>
      </div>
      {msg && <p className="mt-3 text-sm text-ink" role="status">{msg}</p>}
      <p className="mt-3 text-xs leading-relaxed text-slate">WhatsApp opens on your phone with the message ready, and you tap Send. Customers on #NotesApp get it by email and bell instead. One reminder a day at most.</p>
    </div>
  );
}

function AddCustomer({ api, onDone }: { api: Api; onDone: () => void }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [user, setUser] = useState(""); const [err, setErr] = useState("");
  const save = async () => { try { await api("", { action: "party", kind: "customer", name, phone, username: user }); onDone(); } catch (e) { setErr((e as Error).message); } };
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" className={field} />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp number" aria-label="WhatsApp number" inputMode="tel" className={field} />
      <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="@username (if a member)" aria-label="#NotesApp username" className={field} />
      {err && <p className="text-sm text-red-700 sm:col-span-3">{err}</p>}
      <button onClick={save} className="btn-primary sm:col-span-3">Save customer</button>
    </div>
  );
}

function Suppliers({ api, list, onChanged }: { api: Api; list: Owed["suppliers"]; onChanged: () => void }) {
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [due, setDue] = useState(""); const [note, setNote] = useState(""); const [err, setErr] = useState("");
  const add = async () => {
    const k = nairaInput(amount || "0");
    if (k === null) return setErr("Enter what you owe in naira.");
    try { await api("", { action: "party", kind: "supplier", name, balanceKobo: k, dueOn: due, note }); setName(""); setAmount(""); setDue(""); setNote(""); setErr(""); onChanged(); } catch (e) { setErr((e as Error).message); }
  };
  const paid = async (id: string, max: number) => {
    const v = window.prompt(`How much did you pay? (up to ${naira(max)})`, String(max / 100));
    const k = v ? nairaInput(v) : null;
    if (!k) return;
    try { await api("", { action: "supplierPaid", partyId: id, amountKobo: k }); onChanged(); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <ul className="card divide-y divide-rule">
        {list.length ? list.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 p-4">
            <span className="min-w-0"><span className="block font-ui font-bold text-ink">{s.name}</span><span className="text-[13px] text-slate">{[s.note, s.dueOn ? `due ${shortDate(s.dueOn)}` : ""].filter(Boolean).join(" · ") || "—"}</span></span>
            <span className="flex shrink-0 items-center gap-3"><span className="font-ui font-bold text-ink">{naira(s.balanceKobo)}</span>{s.balanceKobo > 0 && <button onClick={() => paid(s.id, s.balanceKobo)} className="rounded-full border border-rule px-3 py-1 text-xs font-semibold text-ink">Paid</button>}</span>
          </li>
        )) : <li className="p-5 text-sm text-slate">No suppliers yet. Add who you owe, so it&apos;s in one place with what you&apos;re owed.</li>}
      </ul>
      <div className="card p-5">
        <h2 className="font-ui text-lg font-bold text-ink">Add who you owe</h2>
        <div className="mt-3 grid gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Supplier (for example: Alhaji Sani Rice Depot)" aria-label="Supplier" className={field} />
          <div className="grid grid-cols-2 gap-2"><input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="You owe (₦)" aria-label="You owe" inputMode="decimal" className={field} /><input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className={field} /></div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What for (optional)" aria-label="What for" className={field} />
          {err && <p className="text-sm text-red-700">{err}</p>}
          <button onClick={add} className="btn-primary">Save</button>
        </div>
      </div>
    </div>
  );
}
