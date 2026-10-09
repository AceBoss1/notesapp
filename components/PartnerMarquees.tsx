import Link from "next/link";
import { activeHostForUsername } from "@/lib/domains";
import { PARTNERS, TRUSTED_BY } from "@/lib/partners";
import { badgeLevel, getAllUsers, goldKindOf } from "@/lib/users";
import VerifiedBadge from "@/components/VerifiedBadge";

// A row that scrolls sideways, pauses when you point at it, and stands still (wrapped and centred) for people who ask their device for
// less motion. Each copy of the names is long enough to fill a wide screen, and the repeats are hidden from screen readers.
const CSS = `
@keyframes na-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.na-marquee { overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); }
.na-marquee-track { display: flex; width: max-content; animation: na-marquee var(--na-dur, 40s) linear infinite; }
.na-marquee:hover .na-marquee-track, .na-marquee:focus-within .na-marquee-track { animation-play-state: paused; }
.na-marquee-group { display: flex; gap: 1rem; padding-right: 1rem; }
@media (prefers-reduced-motion: reduce) {
  .na-marquee { -webkit-mask-image: none; mask-image: none; }
  .na-marquee-track { animation: none; width: auto; flex-wrap: wrap; justify-content: center; }
  .na-marquee-track > [aria-hidden="true"], .na-marquee-group[aria-hidden="true"] { display: none; }
}`;

type Render = (hidden: boolean, k: string) => React.ReactNode;

// Fewer than four names: a still row. Otherwise a marquee, with the names repeated until one copy is wider than a big screen.
function Strip({ label, count, seconds, render }: { label: string; count: number; seconds: number; render: Render }) {
  if (count < 4) return <div className="mt-5 flex flex-wrap items-stretch justify-center gap-4">{render(false, "a")}</div>;
  const repeat = Math.max(1, Math.ceil(9 / count));
  const copy = (second: boolean) => Array.from({ length: repeat }, (_, g) => {
    const hidden = second || g > 0;
    return <div key={`${second}-${g}`} className="na-marquee-group" aria-hidden={hidden || undefined}>{render(hidden, `${second ? "b" : "a"}${g}`)}</div>;
  });
  return (
    <div className="na-marquee mt-5" role="list" aria-label={label} style={{ ["--na-dur" as string]: `${seconds}s` }}>
      {/* A fixed string of our own, so it is safe to insert as is (escaping it would break the > selector). */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="na-marquee-track">{copy(false)}{copy(true)}</div>
    </div>
  );
}

const pill = "flex shrink-0 items-center gap-3 rounded-xl border border-rule bg-card px-5 py-3";
const Item = ({ hidden, href, external, children }: { hidden: boolean; href?: string; external?: boolean; children: React.ReactNode }) =>
  href
    ? external
      ? <a href={href} target="_blank" rel="noopener noreferrer" tabIndex={hidden ? -1 : undefined} role={hidden ? undefined : "listitem"} className={`${pill} hover:border-crimson`}>{children}</a>
      : <Link href={href} tabIndex={hidden ? -1 : undefined} role={hidden ? undefined : "listitem"} className={`${pill} hover:border-crimson`}>{children}</Link>
    : <div role={hidden ? undefined : "listitem"} className={pill}>{children}</div>;

export async function TrustedByStrip({ className = "" }: { className?: string }) {
  // Names and logos come from each customer's own profile; anyone whose profile can't be found is left out rather than shown blank.
  const users = await getAllUsers().catch(() => []);
  const rows = (await Promise.all(TRUSTED_BY.map(async (c) => {
    const u = users.find((x) => x.username === c.username);
    if (!u || u.suspended) return null;
    const host = await activeHostForUsername(c.username);
    return { key: c.username, name: u.displayName, avatar: u.avatar, what: c.what, badge: badgeLevel(u), gold: goldKindOf(u), href: host ? `https://${host}` : `/u/${c.username}`, external: !!host };
  }))).filter((r): r is NonNullable<typeof r> => !!r);
  if (!rows.length) return null;
  return (
    <section className={className} aria-labelledby="trusted-by">
      <p id="trusted-by" className="text-center font-mono text-[11px] uppercase tracking-eyebrow text-slate">Trusted by</p>
      <Strip label="Customers who run on #NotesApp" count={rows.length} seconds={rows.length * 6 + 10}
        render={(hidden, k) => rows.map((r) => (
          <Item key={`${k}-${r.key}`} hidden={hidden} href={r.href} external={r.external}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.avatar} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
            <span><span className="flex items-center gap-1 font-ui text-sm font-bold text-ink">{r.name}<VerifiedBadge size={14} level={r.badge} goldKind={r.gold} /></span>{r.what && <span className="block text-xs text-slate">{r.what}</span>}</span>
          </Item>
        ))} />
    </section>
  );
}

export function PartnersStrip({ className = "" }: { className?: string }) {
  return (
    <section className={className} aria-labelledby="partners-strip">
      <p id="partners-strip" className="text-center font-mono text-[11px] uppercase tracking-eyebrow text-slate">Our partners and the services we connect to</p>
      <Strip label="Partners and integrations" count={PARTNERS.length} seconds={50}
        render={(hidden, k) => PARTNERS.map((p) => (
          <Item key={`${k}-${p.name}`} hidden={hidden} href="/status">
            {p.logo && p.wordmark ? (
              <span className="flex flex-col items-start gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.logo} alt={p.name} height={28} className="h-7 w-auto max-w-[8rem] object-contain object-left" />
                <span className="text-xs text-slate">{p.what}</span>
              </span>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.logo && <img src={p.logo} alt="" height={32} className="h-8 w-auto max-w-[3.5rem] shrink-0 object-contain" />}
                <span><span className="block font-ui text-sm font-bold text-ink">{p.name}</span><span className="block text-xs text-slate">{p.what}</span></span>
              </>
            )}
          </Item>
        ))} />
      <p className="mx-auto mt-4 max-w-2xl px-4 text-center text-xs text-slate">
        Logos and names belong to their owners. They are shown only to say which services we work with, and do not mean those companies endorse #NotesApp.
      </p>
    </section>
  );
}
