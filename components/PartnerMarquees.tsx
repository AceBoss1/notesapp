import Link from "next/link";
import { PARTNERS, TRUSTED_BY } from "@/lib/partners";

// A row that scrolls sideways, pauses when you point at it, and stands still (wrapped and centred) for people who ask their device for
// less motion. The names are repeated once so the loop has no gap; the repeat is hidden from screen readers.
const CSS = `
@keyframes na-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.na-marquee { overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); }
.na-marquee-track { display: flex; width: max-content; gap: 1rem; animation: na-marquee var(--na-dur, 40s) linear infinite; }
.na-marquee:hover .na-marquee-track, .na-marquee:focus-within .na-marquee-track { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .na-marquee { -webkit-mask-image: none; mask-image: none; }
  .na-marquee-track { animation: none; width: auto; flex-wrap: wrap; justify-content: center; }
  .na-marquee-copy { display: none; }
}`;

function Strip({ label, children, count, seconds }: { label: string; children: (hidden: boolean) => React.ReactNode; count: number; seconds: number }) {
  // Too few names to scroll: show them as a still row instead.
  if (count < 4) return <div className="mt-5 flex flex-wrap items-stretch justify-center gap-4">{children(false)}</div>;
  return (
    <div className="na-marquee mt-5" role="list" aria-label={label} style={{ ["--na-dur" as string]: `${seconds}s` }}>
      <style>{CSS}</style>
      <div className="na-marquee-track">
        <div className="flex gap-4">{children(false)}</div>
        <div className="na-marquee-copy flex gap-4" aria-hidden="true">{children(true)}</div>
      </div>
    </div>
  );
}

const pill = "flex shrink-0 items-center gap-3 rounded-xl border border-rule bg-card px-5 py-3";

export function TrustedByStrip({ className = "" }: { className?: string }) {
  return (
    <section className={className} aria-labelledby="trusted-by">
      <p id="trusted-by" className="text-center font-mono text-[11px] uppercase tracking-eyebrow text-slate">Trusted by</p>
      <Strip label="Customers who run on #NotesApp" count={TRUSTED_BY.length} seconds={30}>
        {(hidden) => TRUSTED_BY.map((c) => {
          const body = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.icon} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
              <span><span className="block font-ui text-sm font-bold text-ink">{c.name}</span><span className="block text-xs text-slate">{c.what}</span></span>
            </>
          );
          return c.href
            ? <a key={c.name} href={c.href} target="_blank" rel="noopener noreferrer" tabIndex={hidden ? -1 : undefined} role={hidden ? undefined : "listitem"} className={`${pill} hover:border-crimson`}>{body}</a>
            : <div key={c.name} role={hidden ? undefined : "listitem"} className={pill}>{body}</div>;
        })}
      </Strip>
    </section>
  );
}

export function PartnersStrip({ className = "" }: { className?: string }) {
  return (
    <section className={className} aria-labelledby="partners-strip">
      <p id="partners-strip" className="text-center font-mono text-[11px] uppercase tracking-eyebrow text-slate">Our partners and the services we connect to</p>
      <Strip label="Partners and integrations" count={PARTNERS.length} seconds={45}>
        {(hidden) => PARTNERS.map((p) => {
          const body = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.image && <img src={p.image} alt="" width={40} height={40} className="h-10 w-auto shrink-0" />}
              <span><span className="block font-ui text-sm font-bold text-ink">{p.name}</span><span className="block text-xs text-slate">{p.what}</span></span>
            </>
          );
          return p.href
            ? <Link key={p.name} href={p.href} tabIndex={hidden ? -1 : undefined} role={hidden ? undefined : "listitem"} className={`${pill} hover:border-crimson`}>{body}</Link>
            : <div key={p.name} role={hidden ? undefined : "listitem"} className={pill}>{body}</div>;
        })}
      </Strip>
    </section>
  );
}
