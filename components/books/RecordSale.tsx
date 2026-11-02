"use client";

import { useEffect, useMemo, useState } from "react";
import { SALE_METHODS, naira, type Method } from "@/lib/books";
import { Icon, Sheet, WhatsAppIcon, field, koboToInput, nairaInput, newClientId, pill, type Api } from "./shared";

// Record a sale (the mockup's quick sheet): items from the store and Books-only items (search by name or SKU), or a one-off typed in;
// quantity and price; cash, transfer or POS; and Customer owes, with who, the part paid now and a due date. Then the receipt: a link,
// the PDF, and WhatsApp for a customer who isn't on #NotesApp.
type CatItem = { ref: string; title: string; sku: string; priceKobo: number; costKobo: number; stock: number | null; lowAt: number; image?: string; itemId?: string; bookItemId?: string };
type Customer = { id: string; name: string; balanceKobo: number; member: boolean; hasPhone: boolean };
type L = { key: string; ref?: string; title: string; qty: number; price: string; stock: number | null };
type Saved = { entry: { id: string; totalKobo: number; owesKobo: number; partyName?: string }; receiptUrl: string; hasPhone: boolean; member: boolean };

export default function RecordSale({ api, today, onClose, onSaved }: { api: Api; today: string; onClose: () => void; onSaved: () => void }) {
  const [cat, setCat] = useState<CatItem[] | null>(null);
  const [inventory, setInventory] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<L[]>([]);
  const [method, setMethod] = useState<Method>("cash");
  const [owes, setOwes] = useState(false);
  const [who, setWho] = useState(""); // a customer's id, or "new"
  const [newName, setNewName] = useState(""); const [newPhone, setNewPhone] = useState(""); const [newUser, setNewUser] = useState("");
  const [paidNow, setPaidNow] = useState("0");
  const [dueOn, setDueOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState<Saved | null>(null);
  const [clientId, setClientId] = useState(newClientId);

  useEffect(() => {
    api<{ items: CatItem[]; inventory: boolean }>("view=catalog").then((r) => { setCat(r.items); setInventory(r.inventory); }).catch(() => setCat([]));
    api<{ customers: Customer[] }>("view=owed").then((r) => setCustomers(r.customers)).catch(() => {});
  }, [api]);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!cat) return [];
    return (s ? cat.filter((x) => x.title.toLowerCase().includes(s) || x.sku.toLowerCase().includes(s)) : cat).slice(0, s ? 8 : 5);
  }, [q, cat]);
  const lineKobo = (l: L) => (nairaInput(l.price) ?? 0) * l.qty;
  const total = lines.reduce((n, l) => n + lineKobo(l), 0);
  const paid = owes ? Math.min(nairaInput(paidNow) ?? 0, total) : total;
  const units = lines.reduce((n, l) => n + l.qty, 0);
  const customer = customers.find((c) => c.id === who);
  const whoName = who === "new" ? newName.trim() : customer?.name ?? "";

  const add = (it: CatItem | null) => {
    if (it) {
      const have = lines.find((l) => l.ref === it.ref);
      if (have) setLines(lines.map((l) => (l === have ? { ...l, qty: l.qty + 1 } : l)));
      else setLines([...lines, { key: it.ref, ref: it.ref, title: it.title, qty: 1, price: koboToInput(it.priceKobo), stock: it.stock }]);
    } else if (q.trim()) setLines([...lines, { key: `t${Date.now()}`, title: q.trim(), qty: 1, price: "", stock: null }]);
    setQ("");
  };
  const setLine = (key: string, p: Partial<L>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...p } : l)).filter((l) => l.qty > 0));

  const save = async () => {
    setErr("");
    if (!lines.length) return setErr("Add at least one item.");
    if (lines.some((l) => nairaInput(l.price) === null)) return setErr("Enter a price for each item.");
    if (owes && !who) return setErr("Who owes? Choose or add the customer.");
    setBusy(true);
    try {
      const r = await api<Saved>("", {
        action: "sale", clientId, method, owes, paidKobo: paid, dueOn: owes ? dueOn : "",
        ...(owes ? (who === "new" ? { party: { name: newName, phone: newPhone, username: newUser } } : { partyId: who }) : {}),
        lines: lines.map((l) => ({ ...(l.ref ? { ref: l.ref } : { title: l.title }), qty: l.qty, unitKobo: nairaInput(l.price) ?? 0 })),
      });
      setSaved({ ...r, hasPhone: who === "new" ? !!newPhone.trim() : !!customer?.hasPhone, member: who === "new" ? !!newUser.trim() : !!customer?.member });
      onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const again = () => { setSaved(null); setLines([]); setOwes(false); setWho(""); setPaidNow("0"); setDueOn(""); setNewName(""); setNewPhone(""); setNewUser(""); setClientId(newClientId()); };

  if (saved) return <Sheet title="Sale saved" eyebrow="New entry · walk-in" onClose={onClose}><SavedSale api={api} saved={saved} onAgain={again} onClose={onClose} /></Sheet>;

  return (
    <Sheet title="Record a sale" eyebrow="New entry · walk-in" onClose={onClose}>
      <label className="flex items-center gap-2 rounded-2xl bg-field px-4 py-3">
        <Icon name="search" className="h-5 w-5 text-slate" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(matches[0] && q.trim() ? matches[0] : null); } }} placeholder="Search your items, or type one" aria-label="Search your items, or type one" className="w-full bg-transparent text-base text-ink outline-none placeholder:text-slate" />
      </label>
      {cat === null ? <p className="mt-3 text-sm text-slate">Loading your items…</p> : (
        <>
          {cat.length > 0 && <p className="mt-3 text-sm text-slate">{q.trim() ? `From your items · ${matches.length} ${matches.length === 1 ? "match" : "matches"}` : "Your items"}</p>}
          <ul className="mt-1">
            {matches.map((it) => (
              <li key={it.ref}>
                <button onClick={() => add(it)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-field">
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-field text-slate">{it.image ? <img src={it.image} alt="" className="h-full w-full object-cover" /> : <Icon name="box" />}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-ui font-semibold text-ink">{it.title}</span><span className="block text-xs text-slate">{[it.sku, it.stock !== null ? `${it.stock} in stock` : "", it.bookItemId ? "Books only" : ""].filter(Boolean).join(" · ")}</span></span>
                  <span className="font-ui font-bold text-ink">{naira(it.priceKobo)}</span>
                </button>
              </li>
            ))}
          </ul>
          {q.trim() && <button onClick={() => add(null)} className="mt-1 flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left text-sm text-ink hover:bg-field"><Icon name="plus" className="h-5 w-5 text-slate" />{matches.length ? "Not in your items? " : ""}Sell “{q.trim()}” as a one-off item</button>}
        </>
      )}

      {lines.length > 0 && (
        <>
          <p className="eyebrow mt-5">In this sale</p>
          <ul className="mt-2 divide-y divide-rule rounded-2xl border border-rule">
            {lines.map((l) => (
              <li key={l.key} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1 basis-40">
                  <p className="font-ui font-semibold leading-snug text-ink">{l.title}</p>
                  <label className="mt-1 flex items-center gap-1 text-xs text-slate">₦<input value={l.price} onChange={(e) => setLine(l.key, { price: e.target.value })} inputMode="decimal" placeholder="price" aria-label={`Price each for ${l.title}`} className="w-24 rounded-lg border border-rule bg-card px-2 py-1 text-sm text-ink outline-none focus:border-crimson" /> each</label>
                </div>
                <div className="flex items-center rounded-full border border-rule">
                  <button onClick={() => setLine(l.key, { qty: l.qty - 1 })} aria-label="One less" className="grid h-9 w-9 place-items-center text-crimson"><Icon name="minus" className="h-4 w-4" /></button>
                  <span className="w-8 text-center font-ui font-bold text-ink" aria-label="Quantity">{l.qty}</span>
                  <button onClick={() => setLine(l.key, { qty: l.qty + 1 })} aria-label="One more" className="grid h-9 w-9 place-items-center text-crimson"><Icon name="plus" className="h-4 w-4" /></button>
                </div>
                <span className="w-24 text-right font-ui font-bold text-ink">{naira(lineKobo(l))}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-5 text-sm font-semibold text-ink">How did they pay?</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {SALE_METHODS.map((m) => <button key={m.id} onClick={() => setMethod(m.id)} className={`rounded-xl border px-2 py-3 font-ui text-sm font-semibold ${method === m.id && !(owes && paid === 0) ? "border-crimson bg-crimson/10 text-crimson" : "border-rule text-ink"}`}>{m.label}</button>)}
        <button onClick={() => { setOwes(true); setPaidNow("0"); }} className={`rounded-xl border px-2 py-3 font-ui text-sm font-semibold ${owes ? "border-crimson bg-crimson/10 text-crimson" : "border-rule text-ink"}`}>Credit</button>
      </div>

      <div className="mt-4 rounded-2xl border border-rule p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="font-ui font-bold text-ink">Customer owes</p><p className="text-sm text-slate">Goes to Money owed to you, with a due date</p></div>
          <button role="switch" aria-checked={owes} aria-label="Customer owes" onClick={() => setOwes(!owes)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${owes ? "bg-crimson" : "bg-rule"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${owes ? "left-6" : "left-1"}`} /></button>
        </div>
        {owes && (
          <div className="mt-3 space-y-3">
            <label className="block text-sm font-semibold text-ink">Customer
              <select value={who} onChange={(e) => setWho(e.target.value)} className={`${field} mt-1`}>
                <option value="">Choose…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.balanceKobo ? ` (owes ${naira(c.balanceKobo)})` : ""}</option>)}
                <option value="new">＋ A new customer</option>
              </select>
            </label>
            {who === "new" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" aria-label="Customer's name" className={field} />
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="WhatsApp number (for reminders)" aria-label="Customer's WhatsApp number" inputMode="tel" className={field} />
                <input value={newUser} onChange={(e) => setNewUser(e.target.value)} placeholder="@username, if on #NotesApp" aria-label="Customer's #NotesApp username" className={`${field} sm:col-span-2`} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-ink">Paid now ({SALE_METHODS.find((m) => m.id === method)?.label.toLowerCase()})<input value={paidNow} onChange={(e) => setPaidNow(e.target.value)} inputMode="decimal" className={`${field} mt-1`} /></label>
              <label className="block text-sm font-semibold text-ink">Pay by<input type="date" value={dueOn} min={today} onChange={(e) => setDueOn(e.target.value)} className={`${field} mt-1`} /></label>
            </div>
          </div>
        )}
      </div>

      <dl className="mt-4 space-y-1.5 text-[15px]">
        <div className="flex justify-between text-slate"><dt>{lines.length} {lines.length === 1 ? "item" : "items"} · {units} {units === 1 ? "unit" : "units"}</dt><dd className="font-semibold text-ink">{naira(total)}</dd></div>
        {owes && <div className="flex justify-between text-slate"><dt>Paid now</dt><dd className="font-semibold text-ink">{naira(paid)}</dd></div>}
        {owes && <div className="flex justify-between"><dt className="font-ui font-bold text-ink">{whoName ? `${whoName.split(" ")[0]} owes` : "Owes"}</dt><dd className="font-ui text-2xl font-bold text-amber-700">{naira(total - paid)}</dd></div>}
      </dl>
      {lines.some((l) => l.ref) && (
        <p className="mt-3 flex gap-2 rounded-2xl bg-field p-3 text-sm text-slate"><Icon name="box" className="mt-0.5 h-4 w-4 shrink-0" />
          {inventory ? <>Stock goes down when you save: {lines.filter((l) => l.ref && l.stock !== null).map((l) => `${l.title.split(" (")[0]} ${l.stock} → ${Math.max(0, (l.stock ?? 0) - l.qty)}`).join(", ")}.</> : <>Stock isn&apos;t counted without Inventory, so it stays as it is.</>}
        </p>
      )}
      {err && <p className="mt-3 text-sm text-red-700" role="alert">{err}</p>}
      <button onClick={save} disabled={busy || !lines.length} className="btn-primary mt-4 w-full !py-4 !text-base">{busy ? "Saving…" : `Save sale · ${naira(total)}`}</button>
      <p className="mt-3 text-center text-xs text-slate">A receipt link and PDF are ready as soon as it&apos;s saved.</p>
    </Sheet>
  );
}

// After saving: the receipt link, the PDF, and the receipt by WhatsApp (or email and bell for a member).
export function SavedSale({ api, saved, onAgain, onClose }: { api: Api; saved: Saved; onAgain?: () => void; onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Receipt", url: saved.receiptUrl });
      else { await navigator.clipboard.writeText(saved.receiptUrl); setMsg("Link copied."); }
    } catch { /* closed the share sheet */ }
  };
  const whatsapp = async () => {
    setMsg("");
    try {
      const r = await api<{ url: string }>("", { action: "receipt", entryId: saved.entry.id, channel: "whatsapp", ...(phone ? { phone } : {}) });
      window.open(r.url, "_blank", "noopener");
      setMsg("WhatsApp opened with the receipt written. Tap Send there.");
    } catch (e) { setMsg((e as Error).message); }
  };
  const email = async () => {
    try { await api("", { action: "receipt", entryId: saved.entry.id, channel: "email" }); setMsg("Sent by email and to their bell."); } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div>
      <div className="rounded-2xl bg-field p-4">
        <p className="font-ui text-2xl font-bold text-ink">{naira(saved.entry.totalKobo)}</p>
        <p className="text-sm text-slate">{saved.entry.owesKobo ? `${saved.entry.partyName} owes ${naira(saved.entry.owesKobo)}. It's in Money owed to you.` : "Paid in full."}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={share} className={pill}><Icon name="link" className="h-4 w-4" />Share receipt link</button>
        <a href={`${saved.receiptUrl}?print=1`} target="_blank" rel="noopener" className={pill}><Icon name="file" className="h-4 w-4" />Receipt PDF</a>
      </div>
      {!saved.hasPhone && <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Customer's WhatsApp number" aria-label="Customer's WhatsApp number" inputMode="tel" className={`${field} mt-3`} />}
      <button onClick={whatsapp} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1E7A4C] px-5 py-3 font-ui text-sm font-semibold text-white hover:bg-[#17633d]"><WhatsAppIcon />Send receipt by WhatsApp</button>
      {saved.member && <button onClick={email} className={`${pill} mt-2 w-full`}>Send by email and bell (on #NotesApp)</button>}
      <button disabled className={`${pill} mt-2 w-full`} title="SMS comes with Send-Na"><Icon name="chat" className="h-4 w-4" />SMS · with Send-Na</button>
      {msg && <p className="mt-3 text-sm text-ink" role="status">{msg}</p>}
      <p className="mt-3 text-xs text-slate">Customers who aren&apos;t on #NotesApp get it by WhatsApp, from your own phone, with a short #NotesApp line at the end.</p>
      <div className="mt-4 flex gap-2">
        {onAgain && <button onClick={onAgain} className="btn-primary flex-1">Record another</button>}
        <button onClick={onClose} className="btn-ghost flex-1">Done</button>
      </div>
    </div>
  );
}
