"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import PageHero from "@/components/PageHero";
import { AccessCard, ListingCard, type Me } from "@/components/logistics/ProviderPanel";
import CarriedOrders, { type Carried } from "@/components/logistics/CarriedOrders";
import { HOLDER_LABEL, HolderType, type Parcel } from "@/lib/orders";
import { NIGERIAN_STATES } from "@/lib/merch";
import { SHIPMENT_SERVICES, cleanShipment, isErrand, receiverMessage, serviceName, shipmentOpen, shipmentStatusLabel, waNumber, type ShipmentService } from "@/lib/shipments";

// Shipments for logistics businesses (lib/shipments.ts): book one for a customer, record each hand-off or give riders their update
// link, send the receiver their tracking link, mark it delivered. Business and Enterprise; team members with store access too.
type Row = Parcel & { link: string };
type Biz = { uid: string; username: string; name: string; trackOn: boolean; domain: string | null; services: ShipmentService[]; shipments: Row[]; carried?: Carried[] };
type Filter = "active" | "delivered" | "cancelled" | "all";
const field = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";
const holderLabel = (t: HolderType) => (t === "seller" ? "Office" : HOLDER_LABEL[t]);

async function api(user: User, body: Record<string, unknown>) {
  const res = await fetch("/api/shipments", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body) });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "Something went wrong.");
  return j as { shipment: Row; url?: string; business?: Omit<Biz, "shipments"> };
}

function SendLink({ biz, s }: { biz: Biz; s: Row }) {
  const sh = s.shipment!;
  const text = receiverMessage({ business: biz.name, receiverName: sh.receiverName, itemTitle: s.itemTitle, parcelId: s.parcelId, link: s.link });
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex flex-wrap gap-2">
      <a href={`https://wa.me/${waNumber(sh.receiverPhone)}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="btn-primary !px-3 !py-1.5 text-xs">Send to {sh.receiverName.split(" ")[0]} on WhatsApp</a>
      <a href={`sms:${sh.receiverPhone}?body=${encodeURIComponent(text)}`} className="rounded-full border border-rule px-3 py-1.5 text-xs font-semibold text-ink">SMS</a>
      <button onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); }} className="rounded-full border border-rule px-3 py-1.5 text-xs font-semibold text-ink">{copied ? "Copied" : "Copy message"}</button>
    </span>
  );
}

function ShipmentCard({ biz, s, user, onChange }: { biz: Biz; s: Row; user: User; onChange: (r: Row) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [hand, setHand] = useState({ holderType: "bike" as HolderType, holderName: "", holderPhone: "", location: "", consent: false });
  const sh = s.shipment!;
  const open = shipmentOpen(s.status);
  async function run(body: Record<string, unknown>, after?: (j: { shipment: Row; url?: string }) => void) {
    setBusy(true); setError("");
    try { const j = await api(user, { parcelId: s.parcelId, ...body }); onChange(j.shipment); after?.(j); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  return (
    <li className="card p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-ink">{s.itemTitle}{s.quantity > 1 && <span className="font-normal text-slate"> · {s.quantity} pieces</span>}</p>
        <a href={s.link} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-crimson underline">{s.parcelId}</a>
      </div>
      <p className="text-xs text-slate">{shipmentStatusLabel(s.status, sh.service)} · {serviceName(sh.service)} · booked {new Date(s.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}</p>
      <p className="mt-1 text-xs text-ink">From {sh.senderName} at {sh.pickup} → <b>{sh.receiverName}</b> · {sh.receiverPhone}<br />{sh.address}, {s.city}, {s.state}</p>
      {sh.note && <p className="mt-1 text-xs italic text-slate">{sh.note}</p>}
      {error && <p className="mt-2 text-xs text-crimson">{error}</p>}
      {open && <div className="mt-3"><SendLink biz={biz} s={s} /></div>}

      {s.custody.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-rule pt-3 text-xs text-ink">
          {s.custody.map((c) => (
            <li key={c.id}>
              {holderLabel(c.holderType)}: {c.holderName}{c.holderPhone ? ` (${c.holderPhone})` : ""} — {c.location} <span className="text-slate">· {c.status === "pending" ? "waiting for them to confirm" : new Date(c.at).toLocaleString("en-NG", { hour12: true })}</span>
              {open && <button disabled={busy} onClick={() => run({ action: "holder_link", entryId: c.id }, (j) => setLink(j.url || ""))} className="ml-2 font-semibold text-crimson">Get their update link</button>}
            </li>
          ))}
        </ul>
      )}
      {link && (
        <p className="mt-2 break-all text-xs text-ink">
          Send this to the rider (it works until the next holder confirms, up to 14 days): <span className="font-mono">{link}</span>{" "}
          <button onClick={() => navigator.clipboard?.writeText(link)} className="font-semibold text-crimson">Copy</button>
        </p>
      )}

      {open && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-crimson">Record who has it now</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate">Who
              <select value={hand.holderType} onChange={(e) => setHand({ ...hand, holderType: e.target.value as HolderType })} className={field}>
                {(["bike", "bus", "park", "seller"] as HolderType[]).map((t) => <option key={t} value={t}>{holderLabel(t)}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate">Their name<input value={hand.holderName} onChange={(e) => setHand({ ...hand, holderName: e.target.value })} className={field} /></label>
            <label className="text-xs text-slate">Their phone (optional)<input value={hand.holderPhone} onChange={(e) => setHand({ ...hand, holderPhone: e.target.value })} className={field} placeholder="08012345678" /></label>
            <label className="text-xs text-slate">Where the parcel is<input value={hand.location} onChange={(e) => setHand({ ...hand, location: e.target.value })} className={field} placeholder="Jibowu park, Lagos" /></label>
            <label className="flex items-start gap-2 text-xs text-slate sm:col-span-2">
              <input type="checkbox" checked={hand.consent} onChange={(e) => setHand({ ...hand, consent: e.target.checked })} className="mt-0.5" />
              <span>They agree to their phone number being shown to the receiver (needed if you add a number).</span>
            </label>
          </div>
          <button disabled={busy} onClick={() => run({ action: "add_custody", ...hand }, () => setHand({ ...hand, holderName: "", holderPhone: "", location: "", consent: false }))} className="btn-primary mt-2 !px-4 !py-2 text-xs">Add to the log</button>
          <p className="mt-1 text-xs text-slate">Then tap <b>Get their update link</b> beside them: riders update the location, hand it on and mark it delivered from that link, with no account.</p>
        </details>
      )}
      <div className="mt-3 flex flex-wrap gap-4">
        {open && <button disabled={busy} onClick={() => confirm(`Mark ${s.parcelId} as delivered to ${sh.receiverName}?`) && run({ action: "mark_delivered" })} className="text-xs font-semibold text-crimson">Mark delivered</button>}
        {s.status === "paid" && <button disabled={busy} onClick={() => confirm(`Cancel ${s.parcelId}? Its tracking page will say it was cancelled.`) && run({ action: "cancel" })} className="text-xs font-semibold text-slate">Cancel shipment</button>}
      </div>
    </li>
  );
}

// Which services this business offers (an errands-only company, a full logistics company, …): only these can be booked, and its site lists them.
function ServicesCard({ biz, user, onSaved }: { biz: Biz; user: User; onSaved: (b: Omit<Biz, "shipments">) => void }) {
  const [on, setOn] = useState<ShipmentService[]>(biz.services);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const changed = on.length !== biz.services.length || on.some((x) => !biz.services.includes(x));
  async function save() {
    setBusy(true); setMsg("");
    try { const j = await api(user, { action: "set_services", businessUid: biz.uid, services: on }); if (j.business) onSaved(j.business); setMsg("Saved."); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save."); }
    finally { setBusy(false); }
  }
  return (
    <details className="card mb-6 p-5">
      <summary className="cursor-pointer font-display text-lg text-ink">Your services <span className="font-ui text-xs font-normal text-slate">· {biz.services.map(serviceName).join(", ")}</span></summary>
      <p className="mt-2 text-xs text-slate">Tick what {biz.name} does. Only these can be booked, and your site lists them under the tracking box.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {SHIPMENT_SERVICES.map((sv) => (
          <label key={sv.id} className={`flex cursor-pointer items-start gap-2 border p-3 text-sm ${on.includes(sv.id) ? "border-crimson" : "border-rule"}`}>
            <input type="checkbox" checked={on.includes(sv.id)} onChange={(e) => setOn((cur) => (e.target.checked ? [...cur, sv.id] : cur.filter((x) => x !== sv.id)))} className="mt-1" />
            <span><span className="block font-semibold text-ink">{sv.name}</span><span className="text-xs text-slate">{sv.blurb}</span></span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button disabled={busy || !changed || !on.length} onClick={save} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        {!on.length ? <span className="text-xs text-crimson">Choose at least one.</span> : msg && <span className="text-xs text-ink" role="status">{msg}</span>}
      </div>
    </details>
  );
}

const blank = (sender: string, service: ShipmentService = "delivery") => ({ service: service as string, itemTitle: "", quantity: "1", senderName: sender, receiverName: "", receiverPhone: "", pickup: "", address: "", city: "", state: "", note: "" });

function BookForm({ biz, user, onBooked }: { biz: Biz; user: User; onBooked: (r: Row) => void }) {
  const [f, setF] = useState(() => blank(biz.name, biz.services[0]));
  const errand = isErrand(f.service);
  // The services offered can change while the form is open: keep the choice to one of them.
  useEffect(() => { if (!biz.services.includes(f.service as ShipmentService)) setF((x) => ({ ...x, service: biz.services[0] })); }, [biz.services, f.service]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<Row | null>(null);
  const set = (k: keyof ReturnType<typeof blank>) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function book() {
    const check = cleanShipment({ ...f, quantity: Number(f.quantity) });
    if (!check.ok) return setError(check.error);
    setBusy(true); setError("");
    try {
      const j = await api(user, { action: "create", businessUid: biz.uid, shipment: check.value });
      setBooked(j.shipment); onBooked(j.shipment);
      setF((x) => ({ ...blank(biz.name, x.service as ShipmentService), pickup: x.pickup, senderName: x.senderName }));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't book it."); }
    finally { setBusy(false); }
  }
  return (
    <section className="card p-5" aria-labelledby="book-h">
      <h2 id="book-h" className="font-display text-xl text-ink">Book a shipment</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate">Service
          <select value={f.service} onChange={set("service")} className={field}>{SHIPMENT_SERVICES.filter((s) => biz.services.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}: {s.blurb}</option>)}</select>
        </label>
        <div className="grid grid-cols-[1fr,5rem] gap-2">
          <label className="text-xs text-slate">{errand ? "The errand" : "What's being sent"}<input value={f.itemTitle} onChange={set("itemTitle")} className={field} placeholder={errand ? "Pick up drugs from the pharmacy" : f.service === "warehouse" ? "40 bags of rice (stored)" : "2 cartons of shoes"} /></label>
          <label className="text-xs text-slate">Qty<input value={f.quantity} onChange={set("quantity")} inputMode="numeric" className={field} /></label>
        </div>
        <label className="text-xs text-slate">{errand ? "Customer" : "Sender"}<input value={f.senderName} onChange={set("senderName")} className={field} /></label>
        <label className="text-xs text-slate">{f.service === "warehouse" ? "Stored at" : "Picked up from"}<input value={f.pickup} onChange={set("pickup")} className={field} placeholder={f.service === "warehouse" ? "Our Ikeja warehouse" : errand ? "Medplus, Allen Avenue" : "Our office, Ikeja"} /></label>
        <label className="text-xs text-slate">{errand ? "Deliver to (name)" : "Receiver's name"}<input value={f.receiverName} onChange={set("receiverName")} className={field} /></label>
        <label className="text-xs text-slate">Receiver&apos;s phone<input value={f.receiverPhone} onChange={set("receiverPhone")} className={field} placeholder="08012345678" inputMode="tel" /></label>
        <label className="text-xs text-slate sm:col-span-2">Delivery address<input value={f.address} onChange={set("address")} className={field} placeholder="12 Allen Avenue" /></label>
        <label className="text-xs text-slate">City or town<input value={f.city} onChange={set("city")} className={field} /></label>
        <label className="text-xs text-slate">State
          <select value={f.state} onChange={set("state")} className={field}><option value="">Choose…</option>{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <label className="text-xs text-slate sm:col-span-2">Note for your team (optional)<input value={f.note} onChange={set("note")} className={field} placeholder="Fragile · call before delivery" /></label>
      </div>
      {error && <p className="mt-3 text-sm text-crimson" role="alert">{error}</p>}
      <button disabled={busy} onClick={book} className="btn-primary mt-4 !px-5 !py-2.5 text-sm">{busy ? "Booking…" : "Book and get a tracking number"}</button>
      <p className="mt-2 text-xs text-slate">The receiver&apos;s phone number and address are only for you and your team. The public tracking page shows the item, the destination city and each hand-off.</p>
      {booked && (
        <div className="mt-4 border-t border-rule pt-4 text-sm" role="status">
          <p className="text-ink">Booked: <b className="font-mono">{booked.parcelId}</b> for {booked.shipment?.receiverName}. Send them their tracking link:</p>
          <div className="mt-2"><SendLink biz={biz} s={booked} /></div>
        </div>
      )}
    </section>
  );
}

export default function ShipmentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [list, setList] = useState<Biz[] | null>(null);
  const [error, setError] = useState("");
  const [which, setWhich] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [q, setQ] = useState("");
  const [me, setMe] = useState<Me | null>(null); // as a provider: access (plan, add-on, trial) and the network listing

  const load = useCallback(async (u: User) => {
    try {
      fetch("/api/logistics?view=me", { headers: { Authorization: `Bearer ${await u.getIdToken()}` } }).then((r) => r.json()).then((j) => j.access && setMe(j)).catch(() => {});
      const res = await fetch("/api/shipments", { headers: { Authorization: `Bearer ${await u.getIdToken()}` } });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't load shipments.");
      setList(j.businesses);
      setWhich((w) => w || j.businesses[0]?.uid || "");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load shipments."); }
  }, []);
  useEffect(() => onAuthStateChanged(auth, (u) => { if (!u) return router.replace("/login"); setUser(u); load(u); }), [router, load]);

  const biz = list?.find((b) => b.uid === which) ?? null;
  // A booking or a step on a shipment: put the new version at the top of the list (or in its place).
  const put = (r: Row) => setList((cur) => cur?.map((b) => (b.uid !== r.sellerUid ? b : { ...b, shipments: [r, ...b.shipments.filter((x) => x.parcelId !== r.parcelId)].sort((a, c) => (a.createdAt < c.createdAt ? 1 : -1)) })) ?? cur);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (biz?.shipments ?? []).filter((s) => (filter === "all" ? true : filter === "active" ? shipmentOpen(s.status) : s.status === filter))
      .filter((s) => !term || [s.parcelId, s.itemTitle, s.shipment?.receiverName, s.shipment?.receiverPhone, s.city].some((x) => String(x ?? "").toLowerCase().includes(term)));
  }, [biz, filter, q]);
  const counts = useMemo(() => {
    const all = biz?.shipments ?? [];
    return { booked: all.filter((s) => s.status === "paid").length, transit: all.filter((s) => s.status === "dispatched").length, delivered: all.filter((s) => s.status === "delivered").length };
  }, [biz]);

  return (
    <>
      <PageHero compact max="max-w-3xl" eyebrow="Logistics" title={<>Shipments</>}>
        <p>Book deliveries for your customers, hand them rider to rider, and let receivers follow every step on your own site. <Link href="/logistics">How it works</Link></p>
      </PageHero>
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {error && <p className="text-sm text-crimson">{error}</p>}
        {list === null && !error && <p className="text-sm text-slate">Loading…</p>}
        {user && me && (!me.access.ok || me.access.via !== "plan" || list?.length === 0) && <AccessCard me={me} user={user} onChange={() => load(user)} />}
        {list?.length === 0 && me && !me.access.ok && <p className="mb-6 text-xs text-slate">On a team? Ask the business owner to give you store access in their team settings. <Link href="/logistics" className="text-crimson underline">How it works</Link></p>}
        {user && me?.access.ok && biz?.uid === user.uid && <ListingCard me={me} user={user} onSaved={() => load(user)} />}
        {list && list.length > 1 && (
          <label className="mb-4 block text-xs text-slate">Business
            <select value={which} onChange={(e) => setWhich(e.target.value)} className={field}>{list.map((b) => <option key={b.uid} value={b.uid}>{b.name} (@{b.username})</option>)}</select>
          </label>
        )}
        {biz && user && (
          <>
            <div className="mb-6 grid grid-cols-3 gap-3 text-center">
              {[["Booked", counts.booked], ["In transit", counts.transit], ["Delivered", counts.delivered]].map(([l, n]) => (
                <div key={l as string} className="card p-3"><p className="font-display text-2xl text-ink">{n as number}</p><p className="text-xs text-slate">{l as string}</p></div>
              ))}
            </div>
            <p className={`mb-6 text-xs ${biz.trackOn ? "text-slate" : "text-crimson"}`}>
              {biz.trackOn
                ? <>Receivers track on your site{biz.domain ? <> at <span className="font-mono">{biz.domain}/track</span></> : ""}. </>
                : <>Your site&apos;s Track page is off, so tracking links go to #NotesApp&apos;s tracking page. </>}
              <Link href="/profile/site" className="text-crimson underline">{biz.trackOn ? "Your site" : "Switch Track on"}</Link>
            </p>
            <ServicesCard key={`s-${biz.uid}`} biz={biz} user={user} onSaved={(b) => setList((cur) => cur?.map((x) => (x.uid === b.uid ? { ...x, ...b } : x)) ?? cur)} />
            <BookForm key={biz.uid} biz={biz} user={user} onBooked={put} />
            <div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
              {(["active", "delivered", "cancelled", "all"] as Filter[]).map((t) => (
                <button key={t} onClick={() => setFilter(t)} className={`rounded-full border px-4 py-1.5 capitalize ${filter === t ? "border-crimson bg-crimson text-paper" : "border-rule text-ink"}`}>{t}</button>
              ))}
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, receiver, phone, city" aria-label="Search shipments" className="ml-auto w-full border border-rule bg-card px-3 py-1.5 text-sm outline-none focus:border-crimson sm:w-64" />
            </div>
            {shown.length === 0 ? <p className="mt-6 text-sm text-slate">{biz.shipments.length ? "Nothing here." : "No shipments yet. Book your first one above."}</p>
              : <ul className="mt-6 space-y-3">{shown.map((s) => <ShipmentCard key={s.parcelId} biz={biz} s={s} user={user} onChange={put} />)}</ul>}
            <CarriedOrders orders={biz.carried ?? []} user={user} onDone={() => load(user)} />
          </>
        )}
      </section>
    </>
  );
}
