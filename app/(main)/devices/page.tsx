import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import PhoneArt from "@/components/devices/PhoneArt";
import ReserveForm from "@/components/devices/ReserveForm";
import { COLOURS, DEVICES, MOQ, PARTNER_NAMED } from "@/lib/devices";

export const metadata: Metadata = {
  title: "NotesPhone",
  description: "NotesPhone by #NotesApp: phones with #NotesApp built in. Reserve E Pro, our first phone, free. E Ultra, E Ultra+ and E Prestige follow in 2027.",
};

// NotesPhone (lib/devices.ts, docs/DEVICES.md), served at devices.<domain>. Nothing is on sale: the page says what each phone is and
// takes free reservations. No price and no date until the factory confirms them.
export default function DevicesPage() {
  const first = DEVICES.find((d) => d.status === "first")!;
  const later = DEVICES.filter((d) => d.status === "2027");
  return (
    <div>
      <PageHero eyebrow="NotesPhone" title="A phone with #NotesApp built in" art={<div className="flex justify-center gap-4"><PhoneArt swatch="#A6093D" label="Crimson" /><div className="mt-10 hidden sm:block"><PhoneArt swatch="#F4EEDF" label="Ivory" /></div></div>}>
        <p>Your journal, calls, Market, Academy, Jobs and Nana from the moment you switch it on. {PARTNER_NAMED ? "Made with our partner Egoras, on CubeOS." : "Made with a phone maker we're partnering with."}</p>
        <p>Nothing is on sale yet. Reserve the phone you want, free: we order a phone from the factory once {MOQ} people have reserved it, and we&apos;ll tell you the price and the date before anyone pays anything.</p>
        <p><a href="#reserve">Reserve yours, free</a></p>
      </PageHero>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12 sm:px-6 lg:px-8">
        <section aria-labelledby="first" className="grid gap-8 lg:grid-cols-[1fr,1.1fr] lg:items-start">
          <div className="min-w-0">
            <p className="eyebrow">Our first phone</p>
            <h2 id="first" className="mt-2 font-display text-4xl text-ink">{first.name}</h2>
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
        </section>

        <section aria-labelledby="later">
          <p className="eyebrow">Coming in 2027</p>
          <h2 id="later" className="mt-2 font-display text-3xl text-ink">After research and development</h2>
          <p className="mt-2 max-w-2xl text-slate">These are being designed now. Launch dates will be announced in 2027. Reserve one to tell us you want it: it helps decide which comes first.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {later.map((d) => (
              <article key={d.id} className="card flex flex-col p-5">
                <h3 className="font-display text-2xl text-ink">{d.name}</h3>
                <p className="mt-1 font-ui text-sm font-semibold text-crimson">{d.line}</p>
                <p className="mt-2 flex-1 text-sm text-slate">{d.about}</p>
                <p className="mt-4 inline-flex w-fit rounded-full bg-field px-3 py-1 font-ui text-xs font-semibold text-slate">Launch date to be announced in 2027</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="reserve-title" id="reserve" className="scroll-mt-24">
          <h2 id="reserve-title" className="font-display text-3xl text-ink">Reserve your NotesPhone</h2>
          <p className="mt-2 max-w-2xl text-slate">Free, and you don&apos;t have to buy. One reservation per phone: you can reserve more than one.</p>
          <div className="mt-6"><ReserveForm /></div>
        </section>

        <section className="card p-5 text-sm text-slate">
          <p className="font-ui font-bold text-ink">How it works</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Reserving is free and doesn&apos;t commit you to anything.</li>
            <li>The factory makes a phone in batches of {MOQ}. When {MOQ} people have reserved a phone, we place the order.</li>
            <li>Before anyone pays, we email everyone who reserved it with the price, the colours and the delivery date.</li>
            <li>Questions? <Link href="/contact">Contact the team</Link>.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
