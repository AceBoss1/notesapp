import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import PhoneArt from "@/components/devices/PhoneArt";
import ReserveForm from "@/components/devices/ReserveForm";
import { COLOURS, DEVICES, DEVICES_NAME, MOQ, PARTNER_NAMED } from "@/lib/devices";

export const metadata: Metadata = {
  title: DEVICES_NAME,
  description: "Notes Smart Devices: NotesPhone and Anya smart glasses, with #NotesApp and Nana built in. Nothing on sale yet: reserve the one you want, free.",
};

// Notes Smart Devices (lib/devices.ts, docs/DEVICES.md), served at devices.<domain>: the permanent home of #NotesApp's own devices,
// NotesPhone and Anya today (Anya keeps its own page at /anya). Nothing is on sale: the page says what each device is and takes free
// reservations. No price and no date until they're confirmed.
export default function DevicesPage() {
  const first = DEVICES.find((d) => d.status === "first")!;
  const later = DEVICES.filter((d) => d.status === "2027");
  const anya = DEVICES.filter((d) => d.family === "glasses");
  return (
    <div>
      <PageHero eyebrow={DEVICES_NAME} title="Devices with #NotesApp built in" art={<div className="flex items-center justify-center gap-4"><PhoneArt swatch="#A6093D" label="Crimson" /><Image src="/anya/anya-nana-black.webp" alt="Anya Nana smart glasses" width={220} height={150} className="hidden h-auto w-48 rounded-2xl bg-paper/95 p-2 sm:block" /></div>}>
        <p>NotesPhone and Anya smart glasses: your journal, calls, Market, Academy and Nana, in your hand and in your ear.</p>
        <p>Nothing is on sale yet. Reserve the device you want, free, and we&apos;ll tell you the price and the date before anyone pays anything.</p>
        <p><a href="#reserve">Reserve yours, free</a></p>
      </PageHero>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12 sm:px-6 lg:px-8">
        <nav aria-label="Devices" className="flex flex-wrap gap-2">
          <a href="#notesphone" className="btn-ghost">NotesPhone</a>
          <a href="#anya" className="btn-ghost">Anya smart glasses</a>
          <a href="#reserve" className="btn-primary">Reserve, free</a>
        </nav>

        <section id="notesphone" aria-labelledby="notesphone-title" className="scroll-mt-24 space-y-10">
          <div>
            <p className="eyebrow">NotesPhone</p>
            <h2 id="notesphone-title" className="mt-2 font-display text-4xl text-ink">A phone with #NotesApp built in</h2>
            <p className="mt-2 max-w-2xl text-slate">Your journal, calls, Market, Academy, Jobs and Nana from the moment you switch it on. {PARTNER_NAMED ? "Made with our partner Egoras, on CubeOS." : "Made with a phone maker we're partnering with."} The factory makes each phone in batches of {MOQ}: we place the order once {MOQ} people have reserved it.</p>
          </div>
          <div className="grid gap-8 lg:grid-cols-[1fr,1.1fr] lg:items-start">
            <div className="min-w-0">
              <p className="font-ui text-sm font-bold uppercase tracking-wideish text-crimson">Our first phone</p>
              <h3 className="mt-1 font-display text-3xl text-ink">{first.name}</h3>
              <p className="mt-1 font-ui text-lg font-semibold text-crimson">{first.line}</p>
              <p className="mt-3 max-w-xl text-slate">{first.about}</p>
              <p className="mt-4 font-ui text-sm font-bold text-ink">Colours we&apos;ve asked the factory for</p>
              <ul className="mt-2 flex flex-wrap gap-3">
                {COLOURS.map((c) => <li key={c.id} className="flex items-center gap-2 text-sm text-ink"><span className="h-5 w-5 rounded-full ring-1 ring-black/15" style={{ background: c.swatch }} />{c.label}</li>)}
              </ul>
              <p className="mt-2 text-xs text-slate">Not confirmed yet. Tell us the one you&apos;d like when you reserve.</p>
            </div>
            <div className="card min-w-0 overflow-x-auto p-5">
              <p className="font-ui text-sm font-bold text-ink">Planned specification</p>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {first.specs.map(([k, v]) => <tr key={k} className="border-t border-rule first:border-0"><th scope="row" className="py-2 pr-4 text-left font-semibold text-ink">{k}</th><td className="py-2 text-slate">{v}</td></tr>)}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate">May change before launch. Price and date to be announced.</p>
            </div>
          </div>
          <div>
            <h3 className="font-display text-2xl text-ink">Coming in 2027, after research and development</h3>
            <p className="mt-1 max-w-2xl text-sm text-slate">Being designed now. Reserve one to tell us you want it: it helps decide which comes first.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {later.map((d) => (
                <article key={d.id} className="card flex flex-col p-5">
                  <h4 className="font-display text-2xl text-ink">{d.name}</h4>
                  <p className="mt-1 font-ui text-sm font-semibold text-crimson">{d.line}</p>
                  <p className="mt-2 flex-1 text-sm text-slate">{d.about}</p>
                  <p className="mt-4 inline-flex w-fit rounded-full bg-field px-3 py-1 font-ui text-xs font-semibold text-slate">Launch date to be announced in 2027</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="anya" aria-labelledby="anya-title" className="scroll-mt-24">
          <p className="eyebrow">Anya smart glasses</p>
          <h2 id="anya-title" className="mt-2 font-display text-4xl text-ink">Smart glasses with Nana, made for Africa</h2>
          <p className="mt-2 max-w-2xl text-slate">Anya means &ldquo;eye&rdquo; in Igbo. Three models, coming soon. <Link href="/anya" className="font-semibold text-crimson underline">Everything about Anya</Link>.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {anya.map((d) => (
              <article key={d.id} className="card flex flex-col overflow-hidden">
                {d.picture && <div className="bg-[#EDE9E6]"><Image src={d.picture} alt={d.name} width={480} height={300} className="h-44 w-full object-contain p-3" /></div>}
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-2xl text-ink">{d.name}</h3>
                  <p className="mt-1 font-ui text-sm font-semibold text-crimson">{d.line}</p>
                  <p className="mt-2 flex-1 text-sm text-slate">{d.about}</p>
                  <a href={`?model=${d.id}#reserve`} className="mt-4 font-ui text-sm font-semibold text-crimson underline">Reserve {d.name}</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="reserve-title" id="reserve" className="scroll-mt-24">
          <h2 id="reserve-title" className="font-display text-3xl text-ink">Reserve your device</h2>
          <p className="mt-2 max-w-2xl text-slate">Free, and you don&apos;t have to buy. One reservation per device: you can reserve more than one.</p>
          <div className="mt-6"><ReserveForm /></div>
        </section>

        <section className="card p-5 text-sm text-slate">
          <p className="font-ui font-bold text-ink">How it works</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Reserving is free and doesn&apos;t commit you to anything.</li>
            <li>Phones are made in batches of {MOQ}. When {MOQ} people have reserved a phone, we place the order.</li>
            <li>Before anyone pays, we email everyone who reserved a device with the price, the colours and the delivery date.</li>
            <li>New #NotesApp devices will appear here first. Questions? <Link href="/contact">Contact the team</Link>.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
