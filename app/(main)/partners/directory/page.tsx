import type { Metadata } from "next";
import Link from "next/link";
import TierBadge from "@/components/partners/TierBadge";
import { getAdminDb } from "@/lib/firebase-admin";
import { directory } from "@/lib/partner-network-server";
import {
  NETWORK_NAME, PARTNERS_PATH, SERVICES, SERVICE_LABEL, TRACK, TRACKS, isService, isTrack, partnerPath,
  type PublicPartner,
} from "@/lib/partner-network";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Partner directory · ${NETWORK_NAME}`,
  description: "Find an expert to set up your NotesApp, your association or chapter, integrations, and where to get #NotesApp: every approved partner of the NotesApp Partner Network.",
};

// /partners/directory: every listed, active partner (lib/partner-network-server.ts directory, cached 5 minutes), grouped by track, with
// filters for the track, the service (solutions partners) and a search. Premier first, then Certified, then Registered.
export default async function PartnerDirectory({ searchParams }: { searchParams: { track?: string; service?: string; q?: string } }) {
  const track = isTrack(searchParams.track) ? searchParams.track : null;
  const service = isService(searchParams.service) ? searchParams.service : null;
  const q = String(searchParams.q ?? "").trim().toLowerCase().slice(0, 60);
  let all: PublicPartner[] = [];
  try { all = await directory(getAdminDb()); } catch { /* empty until the database answers */ }
  const shown = all.filter((p) => (!track || p.track === track) && (!service || p.services.includes(service))
    && (!q || `${p.name} ${p.blurb} ${p.countries} ${p.username}`.toLowerCase().includes(q)));
  const groups = TRACKS.filter((t) => !track || t === track).map((t) => [t, shown.filter((p) => p.track === t)] as const).filter(([, list]) => list.length);
  const href = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const v = { track, service, q: q || null, ...over };
    for (const [k, x] of Object.entries(v)) if (x) p.set(k, x);
    const s = p.toString();
    return `/partners/directory${s ? `?${s}` : ""}`;
  };
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? "border-crimson bg-crimson text-paper" : "border-rule text-ink hover:border-crimson"}`;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson"><Link href={PARTNERS_PATH}>{NETWORK_NAME}</Link></p>
      <h1 className="mt-2 font-display text-4xl text-ink">Partner directory</h1>
      <p className="mt-2 max-w-2xl text-slate">Experts who set up and run #NotesApp, associations that verify their members, chapters, integrations, and where to get #NotesApp. Every partner here was reviewed by the partnerships team.</p>

      <form action="/partners/directory" className="mt-6 flex flex-wrap gap-2">
        {track && <input type="hidden" name="track" value={track} />}
        {service && <input type="hidden" name="service" value={service} />}
        <input type="search" name="q" defaultValue={q} placeholder="Search by name, place or what they do" aria-label="Search partners" className="min-w-[14rem] flex-1 rounded-full border border-rule bg-card px-4 py-2 text-sm text-ink outline-none focus:border-crimson" />
        <button type="submit" className="rounded-full bg-crimson px-5 py-2 font-ui text-sm font-bold text-paper">Search</button>
      </form>
      <nav aria-label="Tracks" className="mt-4 flex flex-wrap gap-2">
        <Link href={href({ track: null, service: null })} className={chip(!track)}>All</Link>
        {TRACKS.map((t) => <Link key={t} href={href({ track: t, service: t === "solutions" ? service : null })} className={chip(track === t)}>{TRACK[t].emoji} {TRACK[t].directory}</Link>)}
      </nav>
      {track === "solutions" && (
        <nav aria-label="Services" className="mt-3 flex flex-wrap gap-2">
          {SERVICES.map((s) => <Link key={s} href={href({ service: service === s ? null : s })} className={chip(service === s)}>{SERVICE_LABEL[s]}</Link>)}
        </nav>
      )}

      {!groups.length ? (
        <div className="mt-10 rounded-[22px] border border-dashed border-rule p-8 text-center">
          <p className="text-ink">{all.length ? "No partner matches that yet." : "The first partners are being approved now."}</p>
          <p className="mt-2 text-sm text-slate">Run an agency, an association, a chapter or a product people use? <Link href={`${PARTNERS_PATH}#apply`} className="text-crimson underline">Become a partner</Link>.</p>
        </div>
      ) : groups.map(([t, list]) => (
        <div key={t} className="mt-10">
          <h2 className="font-display text-2xl text-ink">{TRACK[t].emoji} {TRACK[t].directory}</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <li key={p.id}>
                <Link href={partnerPath(p.id)} className="flex h-full flex-col rounded-[22px] border border-rule bg-card p-5 hover:border-crimson">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display text-lg text-ink">{p.name}</p>
                    <TierBadge tier={p.tier} className="px-2.5 py-0.5 text-[11px]" />
                  </div>
                  <p className="mt-1 text-xs text-slate">{p.countries}{p.members ? ` · ${p.members} member${p.members === 1 ? "" : "s"}` : ""}</p>
                  <p className="mt-3 line-clamp-3 text-sm text-ink">{p.blurb}</p>
                  {p.services.length > 0 && <p className="mt-3 text-xs text-slate">{p.services.slice(0, 4).map((s) => SERVICE_LABEL[s]).join(" · ")}{p.services.length > 4 ? " …" : ""}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
