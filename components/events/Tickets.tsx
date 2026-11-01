"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import { formatNaira } from "@/lib/booking-time";
import { whenText } from "@/lib/events";
import { TICKETS_PER_ORDER_MAX, TICKET_TYPES_MAX, checkInPath, readTicketCode, showCode, type TicketDoc } from "@/lib/tickets";
import { capi, field, small } from "@/components/community/api";

// Paid event tickets (lib/tickets.ts): buying on the event page, the buyer's tickets with their QR codes, the organiser's ticket types,
// and the check-in page at the door.
export type TicketOffer = { id: string; name: string; priceKobo: number; left: number; quantity?: number; sold?: number };

export function BuyTickets({ eventId, offers, signedIn }: { eventId: string; offers: TicketOffer[]; signedIn: boolean }) {
  const [typeId, setTypeId] = useState(offers.find((o) => o.left > 0)?.id ?? "");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const sel = offers.find((o) => o.id === typeId);
  const max = Math.min(TICKETS_PER_ORDER_MAX, sel?.left ?? 0);
  async function buy() {
    const u = auth.currentUser;
    if (!u || !sel) return;
    setBusy(true); setErr("");
    try { await startCheckout(u, { kind: "ticket", eventId, typeId: sel.id, quantity: qty }, { payWith: "card" }); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't start the payment."); setBusy(false); }
  }
  return (
    <section className="card mt-6 p-5">
      <h2 className="font-display text-xl text-ink">Tickets</h2>
      <ul className="mt-3 space-y-2">{offers.map((o) => (
        <li key={o.id}><label className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${o.id === typeId ? "border-crimson" : "border-rule"} ${o.left ? "" : "opacity-50"}`}>
          <input type="radio" name="ticket-type" disabled={!o.left} checked={o.id === typeId} onChange={() => { setTypeId(o.id); setQty(1); }} />
          <span className="flex-1 font-semibold text-ink">{o.name}</span>
          <span className="text-ink">{formatNaira(o.priceKobo)}</span>
          <span className="w-20 text-right text-xs text-slate">{o.left ? (o.left <= 20 ? `${o.left} left` : "") : "Sold out"}</span>
        </label></li>
      ))}</ul>
      {sel && sel.left > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">How many
            <select value={qty} onChange={(e) => setQty(Number(e.target.value))} className="rounded-lg border border-rule bg-card px-2 py-1">{Array.from({ length: max }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}</select>
          </label>
          {signedIn
            ? <button className="btn-primary !px-4 !py-2 text-xs" disabled={busy} onClick={buy}>{busy ? "Starting…" : `Pay ${formatNaira(sel.priceKobo * qty)}`}</button>
            : <Link href={`/login?next=/events/${eventId}`} className="btn-primary !px-4 !py-2 text-xs">Sign in to buy</Link>}
        </div>
      )}
      <p className="mt-3 text-xs text-slate">Paid by card or bank through Paystack. Each ticket has its own QR code to show at the door; it lets one person in, once.</p>
      {err && <p className="mt-2 text-sm text-crimson" role="alert">{err}</p>}
    </section>
  );
}

function Qr({ text }: { text: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => { QRCode.toDataURL(text, { margin: 1, width: 220, color: { dark: "#1A1210", light: "#ffffff" } }).then(setSrc).catch(() => setSrc("")); }, [text]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="Ticket QR code" className="h-40 w-40 rounded-lg bg-white p-1" /> : <span className="block h-40 w-40" />;
}

export function TicketCard({ t }: { t: TicketDoc }) {
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}${checkInPath(t.eventId, t.code)}`;
  return (
    <li className={`card flex flex-col gap-4 p-4 sm:flex-row ${t.status === "refunded" ? "opacity-60" : ""}`}>
      {t.status === "valid" ? <Qr text={url} /> : <span className="flex h-40 w-40 items-center justify-center rounded-lg border border-dashed border-rule text-sm text-slate">Refunded</span>}
      <div className="min-w-0 flex-1">
        <Link href={`/events/${t.eventId}`} className="font-ui text-base font-bold text-ink hover:underline">{t.eventTitle}</Link>
        <p className="text-sm text-slate">{whenText(new Date(t.startsAt), new Date(t.endsAt))}</p>
        <p className="mt-2 text-sm text-ink">{t.typeName} · {t.holderName}</p>
        <p className="mt-1 font-mono text-lg tracking-widest text-ink">{showCode(t.code)}</p>
        <p className="mt-1 text-xs text-slate">{t.status === "refunded" ? "This ticket was refunded and no longer works." : t.checkedInAt ? `Checked in ${new Date(t.checkedInAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })}` : "Show the QR code at the door, or read out the code."}</p>
      </div>
    </li>
  );
}

// The signed-in buyer's tickets: all of them (the /tickets page) or one event's (on its page).
export function MyTickets({ eventId, empty }: { eventId?: string; empty?: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [list, setList] = useState<TicketDoc[] | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) { setList(user === null ? [] : null); return; }
    capi<{ tickets: TicketDoc[] }>(`/api/tickets${eventId ? `?event=${eventId}` : ""}`).then((d) => setList(d.tickets)).catch(() => setList([]));
  }, [user, eventId]);
  if (user === null && !eventId) return <p className="card p-6 text-sm text-slate"><Link href="/login?next=/tickets" className="text-crimson underline">Sign in</Link> to see your tickets.</p>;
  if (list === null) return eventId ? null : <p className="text-sm text-slate">Loading…</p>;
  if (!list.length) return empty ? <p className="card p-6 text-sm text-slate">{empty}</p> : null;
  return (
    <section className={eventId ? "mt-6" : ""}>
      {eventId && <h2 className="mb-3 font-display text-xl text-ink">Your tickets</h2>}
      <ul className="space-y-3">{list.map((t) => <TicketCard key={t.code} t={t} />)}</ul>
    </section>
  );
}

// The organiser's ticket types. With none, the event is free RSVP as before.
type Row = { id?: string; name: string; priceNaira: string; quantity: string; sold: number };
export function TicketTypesEditor({ eventId, offers, onSaved }: { eventId: string; offers: TicketOffer[]; onSaved: () => void }) {
  const [rows, setRows] = useState<Row[]>(offers.map((o) => ({ id: o.id, name: o.name, priceNaira: String(o.priceKobo / 100), quantity: String(o.quantity ?? ""), sold: o.sold ?? 0 })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  async function save() {
    setBusy(true); setMsg("");
    try {
      await capi("/api/tickets", { action: "types", eventId, types: rows.map((r) => ({ id: r.id, name: r.name, priceNaira: Number(r.priceNaira), quantity: Number(r.quantity) })) });
      setMsg("Saved."); onSaved();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save."); }
    finally { setBusy(false); }
  }
  return (
    <section className="card mt-6 p-5">
      <h3 className="font-display text-xl text-ink">Tickets</h3>
      <p className="mt-1 text-xs text-slate">Add ticket types to sell paid tickets (with none, it stays a free RSVP). You&apos;re paid after the event, less your plan&apos;s usual commission, to your bank account under Rates &amp; payouts.</p>
      {rows.map((r, i) => (
        <div key={i} className="mt-2 grid gap-2 sm:grid-cols-[1fr,8rem,7rem,auto]">
          <input value={r.name} maxLength={40} placeholder="Regular" onChange={(e) => set(i, "name", e.target.value)} className={field} aria-label="Ticket name" />
          <input value={r.priceNaira} inputMode="numeric" placeholder="Price ₦" onChange={(e) => set(i, "priceNaira", e.target.value.replace(/[^\d]/g, ""))} className={field} aria-label="Price in naira" />
          <input value={r.quantity} inputMode="numeric" placeholder="How many" onChange={(e) => set(i, "quantity", e.target.value.replace(/[^\d]/g, ""))} className={field} aria-label="How many" />
          {r.sold ? <span className="self-center text-xs text-slate">{r.sold} sold</span> : <button className={small} onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>}
        </div>
      ))}
      {rows.length < TICKET_TYPES_MAX && <button className={`${small} mt-2`} onClick={() => setRows([...rows, { name: "", priceNaira: "", quantity: "", sold: 0 }])}>+ Add a ticket type</button>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-primary !px-4 !py-2 text-xs" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save tickets"}</button>
        {offers.length > 0 && <Link href={`/events/${eventId}/checkin`} className={`${small} !px-4 !py-2`}>Check-in at the door</Link>}
        {msg && <span className="text-sm text-ink" role="status">{msg}</span>}
      </div>
    </section>
  );
}

// ---- Check-in at the door (the organiser) ----
type Result =
  | { state: "valid"; name: string; type: string; at: string }
  | { state: "already"; name: string; type: string; at: string }
  | { state: "refunded"; name: string; type: string }
  | { state: "wrong_event"; event: string }
  | { state: "not_found" };
type Stats = { title: string; sold: number; in: number; byType: { type: string; sold: number; in: number }[] };
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hour12: false });

export function CheckIn({ eventId, initialCode }: { eventId: string; initialCode?: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  const [code, setCode] = useState(initialCode ?? "");
  const [res, setRes] = useState<Result | null>(null);
  const [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const busy = useRef(false);
  const loadStats = useCallback(() => capi<Stats>(`/api/tickets?checkin=${eventId}`).then((s) => { setStats(s); setErr(""); }).catch((e) => setErr(e.message)), [eventId]);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => { if (user) loadStats(); }, [user, loadStats]);
  const check = useCallback(async (input: string) => {
    if (busy.current) return;
    busy.current = true;
    try { setRes(await capi<Result>("/api/tickets", { action: "checkin", eventId, code: input })); setCode(""); loadStats(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't check that."); }
    finally { busy.current = false; }
  }, [eventId, loadStats]);
  // A link from a ticket's QR opened with the phone's own camera: check it straight away.
  const first = useRef(true);
  useEffect(() => { if (user && initialCode && first.current) { first.current = false; check(initialCode); } }, [user, initialCode, check]);
  // Scanning in the page, where the browser can read QR codes itself (BarcodeDetector: Chrome on Android, and others).
  const canScan = typeof window !== "undefined" && "BarcodeDetector" in window;
  useEffect(() => {
    if (!scanning) return;
    let stop = false, stream: MediaStream | null = null, last = "";
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        const det = new Ctor({ formats: ["qr_code"] });
        while (!stop) {
          const found = await det.detect(video.current).catch(() => []);
          const c = found.length ? readTicketCode(found[0].rawValue) : "";
          if (c && c !== last) { last = c; await check(c); }
          await new Promise((r) => setTimeout(r, 350));
        }
      } catch { setErr("Couldn't open the camera. Type the code instead."); setScanning(false); }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [scanning, check]);

  if (user === null) return <p className="card p-6 text-sm text-slate"><Link href={`/login?next=${encodeURIComponent(`/events/${eventId}/checkin`)}`} className="text-crimson underline">Sign in</Link> to check tickets in.</p>;
  if (err && !stats) return <p className="card p-6 text-sm text-crimson">{err}</p>;
  if (!stats) return <p className="text-sm text-slate">Loading…</p>;
  const box = !res ? null
    : res.state === "valid" ? { tone: "border-green-600 bg-green-50 text-green-900", head: "✓ Valid", body: `${res.name}, ${res.type}` }
    : res.state === "already" ? { tone: "border-amber-500 bg-amber-50 text-amber-900", head: `Already checked in at ${clock(res.at)}`, body: `${res.name}, ${res.type}` }
    : res.state === "refunded" ? { tone: "border-crimson bg-crimson/10 text-crimson", head: "Not valid: refunded", body: `${res.name}, ${res.type}` }
    : res.state === "wrong_event" ? { tone: "border-crimson bg-crimson/10 text-crimson", head: "Not a ticket for this event", body: `It's for ${res.event}.` }
    : { tone: "border-crimson bg-crimson/10 text-crimson", head: "Not a ticket", body: "No ticket has that code." };
  return (
    <div>
      <p className="eyebrow"><Link href={`/events/${eventId}`}>{stats.title}</Link></p>
      <h1 className="mt-2 font-display text-3xl text-ink">Check-in</h1>
      <p className="mt-2 text-sm text-slate">{stats.in} of {stats.sold} checked in{stats.byType.length > 1 ? ` · ${stats.byType.map((b) => `${b.type} ${b.in}/${b.sold}`).join(" · ")}` : ""}</p>
      <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) check(code); }}>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ticket code, e.g. ABCDE-23456" className={`${field} font-mono uppercase`} autoCapitalize="characters" autoComplete="off" aria-label="Ticket code" />
        <button className="btn-primary !px-4 !py-2 text-xs" type="submit">Check</button>
      </form>
      {canScan && <button className={`${small} mt-3 !px-4 !py-2`} onClick={() => setScanning((x) => !x)}>{scanning ? "Stop scanning" : "Scan QR codes"}</button>}
      {scanning && <video ref={video} className="mt-3 w-full max-w-sm rounded-xl bg-black" muted playsInline />}
      {!canScan && <p className="mt-2 text-xs text-slate">To scan, point your phone&apos;s camera at a ticket&apos;s QR code: it opens this page and checks it.</p>}
      {box && <div className={`mt-5 rounded-2xl border-2 p-5 ${box.tone}`} role="status" aria-live="assertive"><p className="font-display text-2xl">{box.head}</p><p className="mt-1 text-sm">{box.body}</p></div>}
      {err && <p className="mt-3 text-sm text-crimson" role="alert">{err}</p>}
    </div>
  );
}
