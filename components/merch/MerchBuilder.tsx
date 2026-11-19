"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import { formatNaira } from "@/lib/booking-time";
import {
  LOGO_OPTIONS, MERCH_COLOURS, MERCH_MAX_QTY, NAME_MAX, NIGERIAN_STATES, PLACE_NAME, SHIRT_SIZES, MerchError, applyMerch, colourOf, getMerchDesign,
  getMerchItem, placesFor, quoteMerch, validateAddress, type DeliveryAddress, type MerchPlace, type MerchSettings,
} from "@/lib/merch";
import MerchMockup from "@/components/MerchMockup";
import DiscountCodeField from "@/components/DiscountCodeField";
import type { Side } from "./Merch3D";

// The item page of the merch store (docs/MERCH_3D.md): the 3D view, then colour, logo, where it's printed, size, a name on the back,
// how many, and the price line by line. The price comes from lib/merch.ts quoteMerch with the settings Admin saved (passed in), the
// same function checkout uses on the server.
const Merch3D = dynamic(() => import("./Merch3D"), { ssr: false });
const field = "mt-1 w-full rounded-lg border border-rule bg-card px-3 py-2 font-body text-sm focus:border-crimson outline-none";
const EMPTY: DeliveryAddress = { fullName: "", phone: "", street: "", city: "", state: "" };
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? "border-crimson bg-crimson text-paper" : "border-rule bg-card text-ink hover:border-crimson"}`;

export default function MerchBuilder({ product, settings, state }: { product: string; settings: MerchSettings; state: "open" | "soon" | "closed" }) {
  useMemo(() => applyMerch(settings), [settings]); // this page's copy of the prices is Admin's, not the built-in defaults
  const [kind, id] = product.split(":");
  const item = kind === "item" ? getMerchItem(id) : undefined;
  const design = kind === "design" ? getMerchDesign(id) : undefined;
  const offer = item ? settings.items.find((i) => i.id === item.id) : undefined;
  const [colour, setColour] = useState<string>(offer?.colours[0] ?? "black");
  const [logoId, setLogoId] = useState(LOGO_OPTIONS[0].id);
  const [place, setPlace] = useState<MerchPlace>("front");
  const [size, setSize] = useState("M");
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [side, setSide] = useState<Side>("front");
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [addr, setAddr] = useState<DeliveryAddress>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [disc, setDisc] = useState<{ code: string; discountKobo: number } | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const shirt = !!design || item?.shape === "tshirt";
  const logo = LOGO_OPTIONS.find((l) => l.id === logoId) ?? LOGO_OPTIONS[0];
  const hex = design ? design.base : colourOf(colour)?.hex ?? "#1d1b1c";
  const choice = { product, colour, logoId, place, size, name, quantity: qty };
  let quote: ReturnType<typeof quoteMerch> | null = null, problem = "";
  try { quote = quoteMerch(choice); } catch (e) { problem = e instanceof MerchError ? e.message : "Check your choices."; }
  // Show the back when a choice puts something there.
  useEffect(() => { if (name || place === "both") setSide("back"); }, [name, place]);
  useEffect(() => { if (place !== "both" && !name) setSide("front"); }, [place, name]);

  const title = design ? `Custom shirt: ${design.name}` : item?.name ?? "";
  const flat = design
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={design.image} alt={title} className="mx-auto h-[85%] w-auto object-contain" />
    : item ? <div className="mx-auto w-3/4"><MerchMockup item={item} logoSrc={logo.image} logoAlt={logo.label} colour={hex} /></div> : null;
  const total = quote ? quote.quote.subtotalKobo + quote.quote.deliveryKobo - (disc?.discountKobo ?? 0) : 0;

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const bad = validateAddress(addr);
    if (bad) return setError(bad);
    if (!user || !quote) return;
    setBusy(true);
    try {
      await startCheckout(user, { kind: "merch", product, ...(item ? { colour, logoId, place } : {}), ...(shirt ? { size, ...(name.trim() ? { name } : {}) } : {}), quantity: qty, address: addr, ...(disc ? { code: disc.code } : {}) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start payment.");
      setBusy(false);
    }
  }
  if (!item && !design) return null;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <Merch3D look={{ shape: design ? "design" : item!.shape, colour: hex, logo: item ? logo.image : undefined, place, name: name.trim().toUpperCase(), design }}
          height={420} fallback={flat} label={`${title}, in 3D. Drag to turn it.`} side={side} onSide={setSide} />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-3xl text-ink">{title}</h1>
          {quote && <p className="font-mono text-lg text-crimson-bright" aria-live="polite">{formatNaira(quote.quote.eachKobo)}</p>}
        </div>
        {design && <p className="mt-1 text-sm text-slate">Printed all over, front and sleeves. The back is in the shirt&apos;s main colour, with your name if you add one.</p>}

        {item && offer && (
          <fieldset className="mt-5 min-w-0">
            <legend className="text-sm font-bold text-ink">Colour · {colourOf(colour)?.name}</legend>
            <div className="mt-2 flex flex-wrap gap-2.5" role="radiogroup">
              {MERCH_COLOURS.filter((c) => offer.colours.includes(c.id)).map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={colour === c.id} aria-label={c.name} onClick={() => setColour(c.id)}
                  className={`h-9 w-9 rounded-full border border-rule ${colour === c.id ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: c.hex }} />
              ))}
            </div>
          </fieldset>
        )}
        {item && (
          <fieldset className="mt-5 min-w-0">
            <legend className="text-sm font-bold text-ink">Logo · {logo.label}</legend>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="radiogroup">
              {LOGO_OPTIONS.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={logoId === l.id} onClick={() => setLogoId(l.id)} className="w-16 shrink-0 text-center text-[10px] text-slate">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.image} alt="" className={`mx-auto h-14 w-14 rounded-xl border bg-card object-contain p-1 ${logoId === l.id ? "border-2 border-ink" : "border-rule"}`} />
                  <span className="mt-1 block leading-tight">{l.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {item && placesFor(item.shape).length > 1 && (
          <fieldset className="mt-5 min-w-0">
            <legend className="text-sm font-bold text-ink">Where it&apos;s printed</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {placesFor(item.shape).map((p) => {
                const extra = p === "both" ? settings.extras.backKobo : p === "wrap" ? settings.extras.wrapKobo : 0;
                return <button key={p} type="button" aria-pressed={place === p} onClick={() => setPlace(p)} className={chip(place === p)}>{PLACE_NAME[p]}{extra ? ` +${formatNaira(extra)}` : ""}</button>;
              })}
            </div>
          </fieldset>
        )}
        {shirt && (
          <>
            <fieldset className="mt-5 min-w-0">
              <legend className="text-sm font-bold text-ink">Size</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {SHIRT_SIZES.map((s) => <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)} className={chip(size === s)}>{s}{s === "XXL" && settings.extras.xxlKobo ? ` +${formatNaira(settings.extras.xxlKobo)}` : ""}</button>)}
              </div>
            </fieldset>
            <label className="mt-5 block">
              <span className="text-sm font-bold text-ink">Name on the back <span className="font-normal text-slate">(optional, +{formatNaira(settings.extras.nameKobo)})</span></span>
              <input value={name} onChange={(e) => setName(e.target.value.toUpperCase().slice(0, NAME_MAX))} maxLength={NAME_MAX} placeholder="ADA" className={field} aria-describedby="name-help" />
              <span id="name-help" className="mt-1 block text-xs text-slate">Up to {NAME_MAX} letters or numbers, printed in capitals.</span>
            </label>
          </>
        )}
        <div className="mt-5 flex items-center gap-3">
          <span className="text-sm font-bold text-ink">How many</span>
          <button type="button" aria-label="One fewer" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-9 w-9 rounded-full border border-rule text-lg">−</button>
          <b className="w-6 text-center text-lg" aria-live="polite">{qty}</b>
          <button type="button" aria-label="One more" onClick={() => setQty((q) => Math.min(MERCH_MAX_QTY, q + 1))} className="h-9 w-9 rounded-full border border-rule text-lg">+</button>
          <span className="text-xs text-slate">Up to {MERCH_MAX_QTY}</span>
        </div>

        {quote ? (
          <dl className="card mt-5 p-4 text-sm" aria-live="polite">
            {quote.quote.lines.map((l, i) => <div key={l.label} className="flex justify-between py-0.5"><dt>{l.label}</dt><dd>{i ? "+" : ""}{formatNaira(l.kobo)}</dd></div>)}
            {quote.quote.lines.length > 1 && <div className="flex justify-between py-0.5"><dt>Each</dt><dd>{formatNaira(quote.quote.eachKobo)}</dd></div>}
            {qty > 1 && <div className="flex justify-between py-0.5"><dt>× {qty}</dt><dd>{formatNaira(quote.quote.subtotalKobo)}</dd></div>}
            <div className="flex justify-between py-0.5"><dt>Delivery anywhere in Nigeria</dt><dd>{formatNaira(quote.quote.deliveryKobo)}</dd></div>
            {disc && <div className="flex justify-between py-0.5 text-[#17694a]"><dt>Code {disc.code}</dt><dd>−{formatNaira(disc.discountKobo)}</dd></div>}
            <div className="mt-1 flex justify-between border-t border-rule pt-2 text-base font-extrabold"><dt>Total</dt><dd>{formatNaira(total)}</dd></div>
          </dl>
        ) : <p className="mt-5 text-sm text-crimson">{problem}</p>}
        <p className="mt-2 text-xs text-slate">The price updates as you choose, and it&apos;s worked out again on our server before you pay, so what you see is what you pay.</p>

        {state !== "open" ? (
          <p className="mt-5 rounded-xl border border-rule bg-card px-4 py-3 text-sm text-ink" role="status">
            {state === "soon" ? <>Orders open on <b>{settings.batch.opensOn}</b> for {settings.batch.label}. You can choose everything now and come back then.</> : <>Orders aren&apos;t open right now: the next batch opens soon. You can still choose and see the price.</>}
          </p>
        ) : user === null ? (
          <p className="mt-5 text-sm text-slate"><Link href={`/login?next=/merchstore/${id}`} className="font-semibold text-crimson underline">Sign in</Link> to pre-order.</p>
        ) : user && quote ? (
          <form onSubmit={pay} className="mt-5 grid gap-2">
            <p className="text-sm font-bold text-ink">Deliver to</p>
            <label className="text-xs text-slate">Recipient name<input value={addr.fullName} onChange={(e) => setAddr({ ...addr, fullName: e.target.value })} className={field} autoComplete="name" /></label>
            <label className="text-xs text-slate">Phone<input value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} placeholder="08012345678" className={field} autoComplete="tel" /></label>
            <label className="text-xs text-slate">Street address<input value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} className={field} autoComplete="street-address" /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate">City or town<input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} className={field} /></label>
              <label className="text-xs text-slate">State
                <select value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} className={field}>
                  <option value="">Choose…</option>
                  {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <DiscountCodeField target="merch" itemId={item ? item.id : `design-${design!.id}`} subtotalKobo={quote.quote.subtotalKobo} extraKobo={quote.quote.deliveryKobo} onChange={setDisc} className="mt-2" />
            {error && <p className="text-sm text-crimson" role="alert">{error}</p>}
            <button disabled={busy} className="btn-primary mt-1 !py-3 text-sm">{busy ? "Starting…" : `Pre-order for ${formatNaira(Math.max(0, total))}`}</button>
            <p className="text-[11px] text-slate">{settings.batch.label} closes {settings.batch.closesOn}. {settings.batch.note} Refunds are available until the batch is printed.</p>
          </form>
        ) : null}
      </div>
    </div>
  );
}
