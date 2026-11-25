"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DOORS, doorFrom, doorHash, quotesFor, type DoorKey } from "@/lib/home-doors";

// "Who are you here as?" — the homepage's four doors on one landing page (lib/home-doors.ts). Choosing a door opens its panel in place
// and puts #for-<door> in the address, so a campaign can link straight to one (https://notesapp.name.ng/#for-organisations).
export default function AudienceDoors({ proof }: { proof: { value: string; label: string }[] }) {
  const [open, setOpen] = useState<DoorKey>("professionals");
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    const read = () => {
      const k = doorFrom(window.location.hash, window.location.search);
      if (k) { setOpen(k); setChosen(true); }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  function pick(k: DoorKey) {
    setOpen(k); setChosen(true);
    try { window.history.replaceState(null, "", `#${doorHash(k)}`); } catch { /* old browsers: the panel still opens */ }
  }

  const d = DOORS.find((x) => x.key === open)!;
  const quotes = quotesFor(open);
  return (
    <section id="doors" aria-labelledby="doors-title" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-16 sm:px-6 lg:px-8">
      <h2 id="doors-title" className="font-display text-3xl text-ink sm:text-4xl">Who are you here as?</h2>
      <p className="mt-2 max-w-2xl text-slate">Pick one and see what #NotesApp looks like for you. When you sign in you get a dashboard made for it, and you can change it any time.</p>

      <div role="tablist" aria-label="Who are you here as?" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DOORS.map((x) => {
          const on = x.key === open;
          return (
            <button key={x.key} id={`door-${x.key}`} role="tab" type="button" aria-selected={on} aria-controls={`panel-${x.key}`} onClick={() => pick(x.key)}
              className={`card flex min-w-0 flex-col gap-1.5 p-4 text-left transition ${on ? "border-crimson shadow-[0_12px_28px_-16px_rgba(122,3,40,0.55)]" : "hover:border-crimson/50"}`}>
              <span className="text-2xl" aria-hidden>{x.icon}</span>
              <span className="font-ui text-base font-bold text-ink">{x.title}</span>
              <span className="text-sm text-slate">{x.blurb}</span>
              <span className="mt-auto pt-1 font-ui text-xs font-bold text-crimson">{on ? (chosen ? "Showing below ↓" : "See it for you ↓") : "See it for you →"}</span>
            </button>
          );
        })}
      </div>

      <div id={`panel-${d.key}`} role="tabpanel" aria-labelledby={`door-${d.key}`} className="mt-5 grid grid-cols-1 gap-6 rounded-2xl border border-rule bg-card p-5 sm:p-7 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="min-w-0">
          <span className="eyebrow">{d.who}</span>
          <p className="mt-3 font-display text-2xl leading-snug text-ink sm:text-3xl">{d.headline}</p>
          {quotes.map((q) => (
            <figure key={q.name} className="mt-5 border-l-2 border-crimson pl-4">
              <blockquote className="font-body text-ink">“{q.text}”</blockquote>
              <figcaption className="mt-1 text-sm text-slate">{q.href ? <a href={q.href} className="underline">{q.name}</a> : q.name} · {q.role}</figcaption>
            </figure>
          ))}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={d.cta.href} className="btn-primary">{d.cta.label}</Link>
            {d.alt && <Link href={d.alt.href} className="btn-ghost">{d.alt.label}</Link>}
          </div>
        </div>
        <div className="min-w-0 overflow-hidden rounded-2xl border border-rule bg-white text-sm" aria-label={`${d.sample.title}, with sample figures`}>
          <div className="flex items-center justify-between bg-crimson px-4 py-2.5 font-ui text-xs font-bold text-white">
            <span>{d.sample.title}</span><span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] tracking-wide">SAMPLE</span>
          </div>
          <ul className="divide-y divide-rule px-4">
            {d.sample.rows.map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-3 py-2.5"><span className="text-slate">{k}</span><b className="text-right text-ink">{v}</b></li>
            ))}
          </ul>
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-1 overflow-hidden rounded-2xl bg-crimson-deep text-white sm:grid-cols-2 lg:grid-cols-4" aria-label="#NotesApp in numbers">
        {proof.map((p) => (
          <li key={p.label} className="border-white/15 p-4 sm:border-l first:sm:border-l-0">
            <b className="block font-display text-2xl">{p.value}</b><span className="text-xs text-white/80">{p.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
