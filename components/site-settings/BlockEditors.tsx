"use client";

import { useState } from "react";
import { uploadToR2 } from "@/lib/upload";
import { BLOCKS, BUTTON_KINDS, LIMITS, blockAllowed, type BlockId, type Blocks, type OrcidLink, type SiteButton } from "@/lib/site-kits";
import { mergePublications } from "@/lib/publications-import";
import ImportPublications from "./ImportPublications";
import { tierName } from "@/lib/site-themes";
import { PLACE_NAMES, placeCoords } from "@/lib/places";

// Step 4 on Your site: what goes in each content section (lib/site-kits.ts). One panel per section that's switched on; Save sends them all.
const field = "mt-1 w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";
const small = "rounded-full border border-rule px-3 py-1 text-xs font-semibold text-ink hover:border-crimson disabled:opacity-40";

function Picture({ value, onChange, label }: { value: string; onChange: (url: string) => void; label: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true); setErr("");
    try { onChange(await uploadToR2(f, "journal")); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't upload the picture."); } finally { setBusy(false); }
  }
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {value ? <img src={value} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-rule text-xl text-slate">🖼️</span>}
      <label className={`${small} cursor-pointer`}>{busy ? "Uploading…" : value ? "Change" : label}<input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} disabled={busy} /></label>
      {value && <button type="button" onClick={() => onChange("")} className="text-xs text-slate underline">Remove</button>}
      {err && <span className="text-xs text-crimson">{err}</span>}
    </div>
  );
}

function ButtonEditor({ value, onChange, label }: { value: SiteButton | null; onChange: (b: SiteButton | null) => void; label: string }) {
  const kind = BUTTON_KINDS.find((k) => k.id === value?.kind);
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <label className="text-xs text-slate">{label}
        <select value={value?.kind ?? ""} onChange={(e) => { const k = BUTTON_KINDS.find((x) => x.id === e.target.value); onChange(k ? { kind: k.id, label: k.label, value: "" } : null); }} className={field}>
          <option value="">No button</option>
          {BUTTON_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
      </label>
      {value && <label className="text-xs text-slate">Button words<input value={value.label} maxLength={30} onChange={(e) => onChange({ ...value, label: e.target.value })} className={field} /></label>}
      {value && kind?.needs && (
        <label className="text-xs text-slate">{kind.needs}
          <input value={value.value} onChange={(e) => onChange({ ...value, value: e.target.value })} placeholder={value.kind === "link" ? "https://" : "Empty: uses your strip’s number"} className={field} />
        </label>
      )}
    </div>
  );
}

// A list of rows (services, pictures, testimonials, people, questions): add, remove and move up.
// grid: small cards side by side (pictures, people) instead of one long column.
function Rows<T>({ items, max, blank, onChange, render, addLabel, grid }: { items: T[]; max: number; blank: T; onChange: (v: T[]) => void; render: (x: T, set: (v: T) => void) => React.ReactNode; addLabel: string; grid?: boolean }) {
  return (
    <div className={grid ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}>
      {items.map((x, n) => (
        <div key={n} className="rounded-xl border border-rule p-3">
          {render(x, (v) => onChange(items.map((y, m) => (m === n ? v : y))))}
          <div className="mt-2 flex gap-2">
            <button type="button" className={small} disabled={n === 0} onClick={() => { const a = [...items]; [a[n - 1], a[n]] = [a[n], a[n - 1]]; onChange(a); }}>↑ Up</button>
            <button type="button" className={small} onClick={() => onChange(items.filter((_, m) => m !== n))}>Remove</button>
          </div>
        </div>
      ))}
      <button type="button" className={`${small} ${grid ? "self-start justify-self-start" : ""}`} disabled={items.length >= max} onClick={() => onChange([...items, blank])}>{items.length >= max ? `Up to ${max}` : `+ ${addLabel}`}</button>
    </div>
  );
}

export default function BlockEditors({ tier, value, onChange, orcid = null, onOrcid }: { tier: string; value: Blocks; onChange: (b: Blocks) => void; orcid?: OrcidLink | null; onOrcid?: (o: OrcidLink | null) => void }) {
  const set = <K extends BlockId>(id: K, v: Blocks[K]) => onChange({ ...value, [id]: v });
  const on = BLOCKS.filter((b) => value[b.id].on && blockAllowed(b.id, tier));
  if (!on.length) return <p className="mt-3 text-sm text-slate">Switch on a section in step 3 (or start from a kit) and its details appear here.</p>;
  const name = (id: BlockId) => BLOCKS.find((b) => b.id === id)!.name;
  return (
    <div className="mt-4 space-y-4">
      {value.hero.on && (
        <details open className="rounded-2xl border border-rule p-4"><summary className="cursor-pointer font-ui text-sm font-bold text-ink">{name("hero")}</summary>
          <div className="mt-3 grid gap-3">
            <label className="text-xs text-slate">Headline<input value={value.hero.headline} maxLength={90} onChange={(e) => set("hero", { ...value.hero, headline: e.target.value })} className={field} placeholder="Your work, shown properly." /></label>
            <label className="text-xs text-slate">A line about what you do<textarea value={value.hero.subline} maxLength={240} rows={2} onChange={(e) => set("hero", { ...value.hero, subline: e.target.value })} className={field} /></label>
            <Picture value={value.hero.image} label="Add a picture" onChange={(image) => set("hero", { ...value.hero, image })} />
            <ButtonEditor label="Main button" value={value.hero.button} onChange={(button) => set("hero", { ...value.hero, button })} />
            <ButtonEditor label="Second button" value={value.hero.second} onChange={(second) => set("hero", { ...value.hero, second })} />
          </div>
        </details>
      )}
      {value.info.on && (
        <details open className="rounded-2xl border border-rule p-4"><summary className="cursor-pointer font-ui text-sm font-bold text-ink">{name("info")}</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="text-xs text-slate">
              <label>Opening hours<input value={value.info.hours} maxLength={120} disabled={value.info.bookingHours} onChange={(e) => set("info", { ...value.info, hours: e.target.value })} className={`${field} disabled:opacity-50`} placeholder="Mon–Sat, 8am to 6pm" /></label>
              <label className="mt-1.5 flex items-start gap-2"><input type="checkbox" checked={value.info.bookingHours} onChange={(e) => set("info", { ...value.info, bookingHours: e.target.checked })} className="mt-0.5" />
                <span>Use the hours of my booking calendar (<a href="/profile/publishing" className="text-crimson underline">set them here</a>). While your sessions are on, tapping the hours opens your booking card.</span></label>
            </div>
            <label className="text-xs text-slate">WhatsApp number<input value={value.info.whatsapp} inputMode="tel" onChange={(e) => set("info", { ...value.info, whatsapp: e.target.value })} className={field} placeholder="0803 000 0000" /></label>
            <label className="text-xs text-slate">Phone number<input value={value.info.phone} inputMode="tel" onChange={(e) => set("info", { ...value.info, phone: e.target.value })} className={field} /></label>
            <label className="text-xs text-slate">Where to find you<input value={value.info.address} maxLength={200} onChange={(e) => set("info", { ...value.info, address: e.target.value })} className={field} placeholder="12 Allen Avenue, Ikeja, Lagos" /></label>
            <label className="text-xs text-slate sm:col-span-2">Google Maps link (optional)<input value={value.info.mapUrl} onChange={(e) => set("info", { ...value.info, mapUrl: e.target.value })} className={field} placeholder="https://maps.app.goo.gl/…" /></label>
          </div>
        </details>
      )}
      {value.services.on && (
        <details open className="rounded-2xl border border-rule p-4"><summary className="cursor-pointer font-ui text-sm font-bold text-ink">{name("services")}</summary>
          <div className="mt-3"><Rows items={value.services.items} max={LIMITS.services} blank={{ name: "", price: "", note: "" }} addLabel="Add a service" onChange={(items) => set("services", { ...value.services, items })}
            render={(x, s) => <div className="grid gap-2 sm:grid-cols-3"><input aria-label="Service" placeholder="Service or item" value={x.name} maxLength={80} onChange={(e) => s({ ...x, name: e.target.value })} className={field} /><input aria-label="Price" placeholder="₦10,000 or From ₦5,000" value={x.price} maxLength={40} onChange={(e) => s({ ...x, price: e.target.value })} className={field} /><input aria-label="Note" placeholder="A short note (optional)" value={x.note} maxLength={160} onChange={(e) => s({ ...x, note: e.target.value })} className={field} /></div>} /></div>
        </details>
      )}
      {value.gallery.on && (
        <details open className="rounded-2xl border border-rule p-4"><summary className="cursor-pointer font-ui text-sm font-bold text-ink">{name("gallery")}</summary>
          <div className="mt-3"><Rows grid items={value.gallery.items} max={LIMITS.gallery} blank={{ image: "", caption: "" }} addLabel="Add a picture" onChange={(items) => set("gallery", { ...value.gallery, items })}
            render={(x, s) => <div className="grid gap-2"><Picture value={x.image} label="Upload" onChange={(image) => s({ ...x, image })} /><input aria-label="Caption" placeholder="Caption (optional)" value={x.caption} maxLength={120} onChange={(e) => s({ ...x, caption: e.target.value })} className={field} /></div>} />
            <p className="mt-2 text-xs text-slate">Pictures without an upload are left out when you save.</p></div>
        </details>
      )}
      {value.testimonials.on && (
        <details open className="rounded-2xl border border-rule p-4"><summary className="cursor-pointer font-ui text-sm font-bold text-ink">{name("testimonials")}</summary>
          <div className="mt-3"><Rows items={value.testimonials.items} max={LIMITS.testimonials} blank={{ quote: "", name: "", role: "" }} addLabel="Add a testimonial" onChange={(items) => set("testimonials", { ...value.testimonials, items })}
            render={(x, s) => <div className="grid gap-2"><textarea aria-label="What they said" placeholder="What they said" value={x.quote} maxLength={400} rows={2} onChange={(e) => s({ ...x, quote: e.target.value })} className={field} /><div className="grid gap-2 sm:grid-cols-2"><input aria-label="Name" placeholder="Their name" value={x.name} maxLength={60} onChange={(e) => s({ ...x, name: e.target.value })} className={field} /><input aria-label="Who they are" placeholder="Customer, Lagos" value={x.role} maxLength={80} onChange={(e) => s({ ...x, role: e.target.value })} className={field} /></div></div>} />
            <p className="mt-2 text-xs text-slate">Only add what people really said, with their permission.</p></div>
        </details>
      )}
      {value.team.on && (
        <details open className="rounded-2xl border border-rule p-4"><summary className="cursor-pointer font-ui text-sm font-bold text-ink">{name("team")}</summary>
          <div className="mt-3"><Rows grid items={value.team.items} max={LIMITS.team} blank={{ name: "", role: "", photo: "" }} addLabel="Add a person" onChange={(items) => set("team", { ...value.team, items })}
            render={(x, s) => <div className="grid gap-2"><Picture value={x.photo} label="Add a photo" onChange={(photo) => s({ ...x, photo })} /><div className="grid gap-2 sm:grid-cols-2"><input aria-label="Name" placeholder="Name" value={x.name} maxLength={60} onChange={(e) => s({ ...x, name: e.target.value })} className={field} /><input aria-label="Role" placeholder="Role" value={x.role} maxLength={80} onChange={(e) => s({ ...x, role: e.target.value })} className={field} /></div></div>} /></div>
        </details>
      )}
      {value.faq.on && (
        <details open className="rounded-2xl border border-rule p-4"><summary className="cursor-pointer font-ui text-sm font-bold text-ink">{name("faq")}</summary>
          <div className="mt-3"><Rows items={value.faq.items} max={LIMITS.faq} blank={{ q: "", a: "" }} addLabel="Add a question" onChange={(items) => set("faq", { ...value.faq, items })}
            render={(x, s) => <div className="grid gap-2"><input aria-label="Question" placeholder="The question" value={x.q} maxLength={160} onChange={(e) => s({ ...x, q: e.target.value })} className={field} /><textarea aria-label="Answer" placeholder="Your answer" value={x.a} maxLength={800} rows={2} onChange={(e) => s({ ...x, a: e.target.value })} className={field} /></div>} /></div>
        </details>
      )}
      {value.publications.on && (
        <details open className="rounded-2xl border border-rule p-4"><summary className="cursor-pointer font-ui text-sm font-bold text-ink">{name("publications")}</summary>
          <ImportPublications orcid={orcid} onOrcid={(o) => onOrcid?.(o)} onAdd={(items) => { const m = mergePublications(value.publications.items, items, LIMITS.publications); set("publications", { on: true, items: m.items }); return m.added; }} />
          <div className="mt-3"><Rows items={value.publications.items} max={LIMITS.publications} blank={{ title: "", authors: "", venue: "", year: "", url: "", note: "" }} addLabel="Add a publication" onChange={(items) => set("publications", { ...value.publications, items })}
            render={(x, s) => <div className="grid gap-2"><input aria-label="Title" placeholder="Title" value={x.title} maxLength={300} onChange={(e) => s({ ...x, title: e.target.value })} className={field} /><input aria-label="Authors" placeholder="Authors, as they appear (your name is shown in bold)" value={x.authors} maxLength={600} onChange={(e) => s({ ...x, authors: e.target.value })} className={field} /><div className="grid gap-2 sm:grid-cols-[1fr,7rem]"><input aria-label="Journal, conference or publisher" placeholder="Journal, conference or publisher" value={x.venue} maxLength={200} onChange={(e) => s({ ...x, venue: e.target.value })} className={field} /><input aria-label="Year" placeholder="Year" value={x.year} maxLength={20} onChange={(e) => s({ ...x, year: e.target.value })} className={field} /></div><div className="grid gap-2 sm:grid-cols-[1fr,12rem]"><input aria-label="Link" placeholder="Link: https://doi.org/… (optional)" value={x.url} onChange={(e) => s({ ...x, url: e.target.value })} className={field} /><input aria-label="Label" placeholder="Label, e.g. Best paper" value={x.note} maxLength={120} onChange={(e) => s({ ...x, note: e.target.value })} className={field} /></div></div>} />
            <p className="mt-2 text-xs text-slate">Shown by year, newest first; within a year, in this order.</p></div>
        </details>
      )}
      {value.awards.on && (
        <details open className="rounded-2xl border border-rule p-4"><summary className="cursor-pointer font-ui text-sm font-bold text-ink">{name("awards")}</summary>
          <div className="mt-3"><Rows items={value.awards.items} max={LIMITS.awards} blank={{ title: "", by: "", year: "", note: "" }} addLabel="Add an award" onChange={(items) => set("awards", { ...value.awards, items })}
            render={(x, s) => <div className="grid gap-2"><div className="grid gap-2 sm:grid-cols-[1fr,7rem]"><input aria-label="Award" placeholder="Award, grant or fellowship" value={x.title} maxLength={200} onChange={(e) => s({ ...x, title: e.target.value })} className={field} /><input aria-label="Year" placeholder="Year" value={x.year} maxLength={20} onChange={(e) => s({ ...x, year: e.target.value })} className={field} /></div><div className="grid gap-2 sm:grid-cols-2"><input aria-label="Given by" placeholder="Given by" value={x.by} maxLength={160} onChange={(e) => s({ ...x, by: e.target.value })} className={field} /><input aria-label="Note" placeholder="A short note (optional)" value={x.note} maxLength={200} onChange={(e) => s({ ...x, note: e.target.value })} className={field} /></div></div>} /></div>
        </details>
      )}
      {value.talks.on && (
        <details open className="rounded-2xl border border-rule p-4"><summary className="cursor-pointer font-ui text-sm font-bold text-ink">{name("talks")}</summary>
          <datalist id="talk-places">{PLACE_NAMES.map((p) => <option key={p} value={p} />)}</datalist>
          <div className="mt-3"><Rows items={value.talks.items} max={LIMITS.talks} blank={{ title: "", event: "", place: "", year: "", url: "", lat: null, lng: null }} addLabel="Add a talk" onChange={(items) => set("talks", { ...value.talks, items })}
            render={(x, s) => {
              const known = placeCoords(x.place);
              const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
              return (
                <div className="grid gap-2">
                  <div className="grid gap-2 sm:grid-cols-[1fr,7rem]"><input aria-label="Talk" placeholder="Title of the talk" value={x.title} maxLength={200} onChange={(e) => s({ ...x, title: e.target.value })} className={field} /><input aria-label="Year" placeholder="Year" value={x.year} maxLength={20} onChange={(e) => s({ ...x, year: e.target.value })} className={field} /></div>
                  <div className="grid gap-2 sm:grid-cols-2"><input aria-label="Event" placeholder="Event or host" value={x.event} maxLength={160} onChange={(e) => s({ ...x, event: e.target.value })} className={field} />
                    <input aria-label="Where" list="talk-places" placeholder="City, country (e.g. Lagos, Nigeria)" value={x.place} maxLength={80} onChange={(e) => { const c = placeCoords(e.target.value); s({ ...x, place: e.target.value, lat: c ? c[0] : null, lng: c ? c[1] : null }); }} className={field} /></div>
                  <input aria-label="Link" placeholder="Link to slides or a video: https://… (optional)" value={x.url} onChange={(e) => s({ ...x, url: e.target.value })} className={field} />
                  {known || (x.lat !== null && x.lng !== null)
                    ? <p className="text-xs text-slate">📍 On the globe.</p>
                    : <div className="flex flex-wrap items-center gap-2 text-xs text-slate"><span>Not on the globe yet: pick a city from the list, or add where it is:</span>
                        <input aria-label="Latitude" inputMode="decimal" placeholder="Latitude" defaultValue={x.lat ?? ""} onBlur={(e) => s({ ...x, lat: num(e.target.value) })} className="w-24 rounded-lg border border-rule bg-card px-2 py-1" />
                        <input aria-label="Longitude" inputMode="decimal" placeholder="Longitude" defaultValue={x.lng ?? ""} onBlur={(e) => s({ ...x, lng: num(e.target.value) })} className="w-24 rounded-lg border border-rule bg-card px-2 py-1" /></div>}
                </div>
              );
            }} /></div>
        </details>
      )}
      {value.news.on && (
        <details open className="rounded-2xl border border-rule p-4"><summary className="cursor-pointer font-ui text-sm font-bold text-ink">{name("news")}</summary>
          <div className="mt-3"><Rows items={value.news.items} max={LIMITS.news} blank={{ title: "", outlet: "", year: "", url: "" }} addLabel="Add an article" onChange={(items) => set("news", { ...value.news, items })}
            render={(x, s) => <div className="grid gap-2"><input aria-label="Headline" placeholder="Headline" value={x.title} maxLength={200} onChange={(e) => s({ ...x, title: e.target.value })} className={field} /><div className="grid gap-2 sm:grid-cols-[1fr,7rem]"><input aria-label="Outlet" placeholder="Newspaper, site or show" value={x.outlet} maxLength={100} onChange={(e) => s({ ...x, outlet: e.target.value })} className={field} /><input aria-label="Year" placeholder="Year" value={x.year} maxLength={20} onChange={(e) => s({ ...x, year: e.target.value })} className={field} /></div><input aria-label="Link" placeholder="https://…" value={x.url} onChange={(e) => s({ ...x, url: e.target.value })} className={field} /></div>} /></div>
        </details>
      )}
      {BLOCKS.filter((b) => value[b.id].on && !blockAllowed(b.id, tier)).map((b) => <p key={b.id} className="text-xs text-slate">🔒 {b.name} comes with {tierName(b.minTier)}.</p>)}
    </div>
  );
}
