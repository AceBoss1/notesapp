import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { publicPartner } from "@/lib/partner-network-server";
import { DIRECTORY_PATH, NETWORK_NAME, SERVICE_LABEL, TIER_LABEL, TRACK } from "@/lib/partner-network";
import PartnerActions from "@/components/partners/PartnerActions";

export const revalidate = 60;

async function load(slug: string) {
  try { return await publicPartner(getAdminDb(), slug); } catch { return null; }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const d = await load(params.slug);
  if (!d) return { title: `Partner · ${NETWORK_NAME}` };
  return { title: `${d.partner.name} · ${TRACK[d.partner.track].short} · ${NETWORK_NAME}`, description: d.partner.blurb.slice(0, 160) };
}

// A partner's page (/partners/<slug>): who they are, their tier and track, and what a member can do here: ask an expert for help, ask an
// association to verify them, join a chapter, or join their workplace with its code. Associations and chapters list their members;
// workplaces list the practitioners they recommend and never their staff.
export default async function PartnerPage({ params }: { params: { slug: string } }) {
  const d = await load(params.slug);
  if (!d) notFound();
  const { partner: p, members } = d;
  const t = TRACK[p.track];
  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson"><Link href={DIRECTORY_PATH}>Partner directory</Link> · {t.directory}</p>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.4fr,1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl text-ink">{p.name}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${p.tier === "premier" ? "bg-crimson-deep text-[#F4B860]" : p.tier === "certified" ? "bg-crimson text-paper" : "bg-field text-ink"}`}>{TIER_LABEL[p.tier]} partner</span>
          </div>
          <p className="mt-2 text-sm text-slate">{t.emoji} {t.label} · {p.countries}{p.members ? ` · ${p.members} member${p.members === 1 ? "" : "s"} on #NotesApp` : ""}</p>
          <p className="mt-5 whitespace-pre-wrap text-ink">{p.blurb}</p>
          <p className="mt-5 flex flex-wrap gap-4 text-sm">
            <Link href={`/u/${p.username}`} className="font-semibold text-crimson underline">@{p.username} on #NotesApp</Link>
            {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-crimson underline">Website ↗</a>}
          </p>
          {p.services.length > 0 && (
            <div className="mt-6">
              <p className="font-ui text-xs font-bold uppercase tracking-wide text-slate">Services</p>
              <ul className="mt-2 flex flex-wrap gap-2">{p.services.map((s) => <li key={s} className="rounded-full border border-rule px-3 py-1 text-xs font-semibold text-ink">{SERVICE_LABEL[s]}</li>)}</ul>
            </div>
          )}
          {p.recommended && p.recommended.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-2xl text-ink">Practitioners we recommend</h2>
              <p className="mt-1 text-sm text-slate">Coaches, therapists and mentors {p.name} recommends to its staff. What you book stays between you and them.</p>
              <ul className="mt-3 flex flex-wrap gap-2">{p.recommended.map((u) => <li key={u}><Link href={`/u/${u}`} className="rounded-full bg-field px-3 py-1.5 text-sm font-semibold text-ink hover:text-crimson">@{u}</Link></li>)}</ul>
            </div>
          )}
          {members.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-2xl text-ink">{p.track === "chapters" ? "Chapter members" : "Verified members"}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">{members.map((m) => <li key={m.username}><Link href={`/u/${m.username}`} className="rounded-full border border-rule px-3 py-1.5 text-sm text-ink hover:border-crimson">{m.name} <span className="text-slate">@{m.username}</span></Link></li>)}</ul>
            </div>
          )}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <PartnerActions partner={{ id: p.id, name: p.name, track: p.track, services: p.services, username: p.username }} />
        </aside>
      </div>
    </section>
  );
}
