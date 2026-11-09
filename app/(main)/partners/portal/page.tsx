"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { CopyLink } from "@/components/ReferralsPanel";
import { partnersCall } from "@/components/partners/partners-client";
import TierBadge from "@/components/partners/TierBadge";
import { referralLink } from "@/lib/referrals";
import {
  BUDGET_LABEL, CERTIFY_MEMBERS, CERTIFY_PAYING, LEAD_STATUSES, LEAD_STATUS_LABEL, LIMITS, NETWORK_NAME, PARTNERS_PATH, SERVICES, SERVICE_LABEL,
  TIERS, TIER_LABEL, TIER_NEED, TRACK, TRAINING, partnerPath,
  type Service, type Tier, type TierTerms,
} from "@/lib/partner-network";
import type { PortalPartner } from "@/lib/partner-network-server";

// The partner portal (lib/partner-network-server.ts portal): for each partner a member runs, the tier and its share, the link and code,
// progress to Certified with the training checklist, the listing, and by track: requests from members (solutions), members to verify
// (associations) or who joined (chapters), and the workplace code, staff count and recommended practitioners (workplaces).
// Earnings are the referral ones: the Referrals page shows them and takes them out.
type Data = { partners: PortalPartner[]; terms: Record<Tier, TierTerms> };
const field = "mt-1 block w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink outline-none focus:border-crimson";
const btn = "rounded-full border border-rule px-3 py-1 text-xs font-semibold text-ink hover:border-crimson hover:text-crimson disabled:opacity-40";

export default function PartnerPortal() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const load = useCallback(() => { if (user) partnersCall<Data>(user, "/api/partners/portal", "GET").then(setData, (e) => setError(e.message)); }, [user]);
  useEffect(load, [load]);

  if (user === undefined) return <p className="p-6 text-sm text-slate">Loading…</p>;
  if (!user) return <section className="mx-auto max-w-3xl px-4 py-12"><p className="text-ink"><Link href="/login?next=/partners/portal" className="text-crimson underline">Sign in</Link> to open your partner portal.</p></section>;
  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson"><Link href={PARTNERS_PATH}>{NETWORK_NAME}</Link></p>
      <h1 className="mt-2 font-display text-4xl text-ink">Partner portal</h1>
      {error && <p className="mt-3 text-sm text-crimson" role="alert">{error}</p>}
      {!data ? <p className="mt-6 text-sm text-slate">Loading…</p> : !data.partners.length ? (
        <div className="mt-6 rounded-[22px] border border-rule bg-card p-6">
          <p className="text-ink">You don&apos;t run a partner yet. When your application is approved, it appears here.</p>
          <p className="mt-3"><Link href={`${PARTNERS_PATH}#apply`} className="font-semibold text-crimson underline">Apply to the Partner Network</Link> · <Link href={`${PARTNERS_PATH}#mine`} className="font-semibold text-crimson underline">See your applications</Link></p>
        </div>
      ) : data.partners.map((p) => <PartnerCard key={p.id} p={p} terms={data.terms} user={user} reload={load} />)}
    </section>
  );
}

function PartnerCard({ p, terms, user, reload }: { p: PortalPartner; terms: Record<Tier, TierTerms>; user: User; reload: () => void }) {
  const [origin, setOrigin] = useState("");
  const [f, setF] = useState({ blurb: p.blurb, website: p.website, countries: p.countries, services: p.services, recommended: (p.recommended ?? []).join(" ") });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const t = TRACK[p.track];
  const act = async (tag: string, body: Record<string, unknown>, ok = "Saved.") => {
    setBusy(tag); setMsg("");
    try { await partnersCall(user, "/api/partners/portal", "POST", body); setMsg(ok); reload(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save that."); }
    finally { setBusy(""); }
  };
  const training = p.training ?? [];
  const toggleTraining = (i: number) => act("training", { action: "listing", id: p.id, training: training.includes(i) ? training.filter((x) => x !== i) : [...training, i] }, "Training updated.");
  const memberTrack = p.track === "associations" || p.track === "chapters";
  const pending = p.requests.filter((r) => r.status === "pending");

  return (
    <article className="mt-8 rounded-[26px] border border-rule bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-3xl text-ink">{p.name}</h2>
        <TierBadge tier={p.tier} className="px-3 py-1 text-xs" />
        {p.status === "suspended" && <span className="rounded-full bg-crimson/10 px-3 py-1 text-xs font-bold text-crimson">Paused by the partnerships team</span>}
        <Link href={partnerPath(p.id)} className="ml-auto text-sm font-semibold text-crimson underline">See your page</Link>
      </div>
      <p className="mt-1 text-sm text-slate">{t.emoji} {t.label}{p.listed ? " · listed in the directory" : " · not listed in the directory"}</p>
      {msg && <p className="mt-3 rounded-xl bg-field p-3 text-sm text-ink" role="status">{msg}</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat n={`${p.terms.percent}%`} label={`of plans, ${p.terms.months} months`} />
        <Stat n={p.brought} label="members you brought" />
        <Stat n={p.paying} label="of them paying" />
        {memberTrack || p.track === "workplace" ? <Stat n={p.members} label={p.track === "workplace" ? "staff joined" : p.track === "chapters" ? "chapter members" : "verified members"} /> : <Stat n={p.leads.filter((l) => l.status === "new").length} label="new requests" />}
      </div>

      <div className="mt-6 rounded-2xl bg-field/60 p-4">
        <p className="font-ui text-sm font-bold text-ink">Your link and code</p>
        <p className="mt-1 text-xs text-slate">Members who join through your link, or type your code ({`@${p.username}`}) at checkout, are yours. Your earnings are on <Link href="/profile/referrals" className="text-crimson underline">your Referrals page</Link>, where you take them out.</p>
        {origin && <div className="mt-2"><CopyLink url={referralLink(origin, p.username)} /></div>}
      </div>

      {p.track === "workplace" && (
        <div className="mt-6 rounded-2xl border border-rule p-4">
          <p className="font-ui text-sm font-bold text-ink">Workplace code: <span className="font-mono text-lg tracking-widest text-crimson">{p.code}</span></p>
          <p className="mt-1 text-xs text-slate">Share it with your staff. They enter it on your page to join. You only ever see how many joined, never who, and never what anyone booked.</p>
          <button type="button" className={btn + " mt-2"} disabled={!!busy} onClick={() => { if (confirm("Make a new code? The old one stops working; staff who joined stay.")) void act("code", { action: "listing", id: p.id, newCode: true }, "New code made."); }}>Make a new code</button>
          <label className="mt-4 block text-sm font-semibold text-ink">Practitioners you recommend (usernames)
            <textarea rows={2} value={f.recommended} onChange={(e) => setF({ ...f, recommended: e.target.value })} className={field} placeholder="@coach_ada @dr_tunde" />
            <span className="mt-1 block text-xs font-normal text-slate">Shown on your page to your staff. Up to {LIMITS.recommended}.</span>
          </label>
          <button type="button" className={btn + " mt-2"} disabled={!!busy} onClick={() => void act("rec", { action: "listing", id: p.id, recommended: f.recommended })}>Save practitioners</button>
        </div>
      )}

      {p.track === "solutions" && (
        <div id="leads" className="mt-6 scroll-mt-24">
          <h3 className="font-display text-xl text-ink">Requests from members</h3>
          {!p.leads.length ? <p className="mt-2 text-sm text-slate">No requests yet. A complete listing with clear services gets more.</p> : (
            <ul className="mt-3 space-y-2">
              {p.leads.map((l) => (
                <li key={l.id} className="rounded-xl border border-rule p-4 text-sm">
                  <p className="text-ink"><b>{l.fromName}</b> <Link href={`/u/${l.fromUsername}`} className="text-slate">@{l.fromUsername}</Link> · {SERVICE_LABEL[l.service]} · {BUDGET_LABEL[l.budget]} · {l.createdAt.slice(0, 10)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-ink">{l.message}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link href={`/messages/new?to=${encodeURIComponent(l.fromUsername)}`} className="rounded-full bg-crimson px-3 py-1 text-xs font-bold text-paper">Reply in messages</Link>
                    {LEAD_STATUSES.map((s) => <button key={s} type="button" disabled={!!busy || l.status === s} onClick={() => void act(l.id, { action: "lead", leadId: l.id, status: s })} className={`${btn} ${l.status === s ? "border-crimson text-crimson" : ""}`}>{LEAD_STATUS_LABEL[s]}</button>)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {memberTrack && (
        <div id="members" className="mt-6 scroll-mt-24">
          <h3 className="font-display text-xl text-ink">{p.track === "associations" ? `Members to verify (${pending.length})` : "Chapter members"}</h3>
          {p.track === "associations" && <p className="mt-1 text-xs text-slate">Check each request against your register before you verify it: the badge tells everyone they&apos;re your member.</p>}
          {!p.requests.length ? <p className="mt-2 text-sm text-slate">No members yet. Share your page: {origin}{partnerPath(p.id)}</p> : (
            <ul className="mt-3 divide-y divide-rule rounded-xl border border-rule text-sm">
              {p.requests.map((r) => (
                <li key={r.uid} className="flex flex-wrap items-center gap-2 p-3">
                  <span className="text-ink"><b>{r.name}</b> <Link href={`/u/${r.username}`} className="text-slate">@{r.username}</Link>{r.ref ? <> · <span className="font-mono">{r.ref}</span></> : null}</span>
                  <span className="ml-auto flex gap-2">
                    {r.status === "pending" ? <>
                      <button type="button" className={btn} disabled={!!busy} onClick={() => void act(r.uid, { action: "member", id: p.id, memberUid: r.uid, decision: "verify" }, "Verified.")}>Verify</button>
                      <button type="button" className={btn} disabled={!!busy} onClick={() => void act(r.uid, { action: "member", id: p.id, memberUid: r.uid, decision: "decline" }, "Declined.")}>Decline</button>
                    </> : <button type="button" className={btn} disabled={!!busy} onClick={() => { if (confirm(`Remove ${r.name}? Their badge goes.`)) void act(r.uid, { action: "member", id: p.id, memberUid: r.uid, decision: "remove" }, "Removed."); }}>Remove</button>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-display text-xl text-ink">Your listing</h3>
          <label className="mt-3 block text-sm font-semibold text-ink">About you
            <textarea rows={4} maxLength={LIMITS.blurb} value={f.blurb} onChange={(e) => setF({ ...f, blurb: e.target.value })} className={field} />
          </label>
          <label className="mt-3 block text-sm font-semibold text-ink">Where you work
            <input maxLength={LIMITS.country} value={f.countries} onChange={(e) => setF({ ...f, countries: e.target.value })} className={field} />
          </label>
          <label className="mt-3 block text-sm font-semibold text-ink">Website
            <input type="url" maxLength={LIMITS.website} value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} className={field} placeholder="https://" />
          </label>
          {p.track === "solutions" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {SERVICES.map((s) => <button key={s} type="button" aria-pressed={f.services.includes(s)} onClick={() => setF({ ...f, services: f.services.includes(s) ? f.services.filter((x) => x !== s) : [...f.services, s as Service] })} className={`rounded-full border px-3 py-1 text-xs font-semibold ${f.services.includes(s) ? "border-crimson bg-crimson text-paper" : "border-rule text-ink"}`}>{SERVICE_LABEL[s]}</button>)}
            </div>
          )}
          <button type="button" disabled={!!busy} onClick={() => void act("listing", { action: "listing", id: p.id, blurb: f.blurb, countries: f.countries, website: f.website, ...(p.track === "solutions" ? { services: f.services } : {}) })} className="mt-4 rounded-full bg-crimson px-5 py-2 font-ui text-sm font-bold text-paper disabled:opacity-50">Save listing</button>
        </div>
        <div>
          <h3 className="font-display text-xl text-ink">Moving up</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {TIERS.map((k) => <li key={k} className={k === p.tier ? "font-semibold text-ink" : "text-slate"}>{TIER_LABEL[k]}: {terms[k].percent}% for {terms[k].months} months{k === p.tier ? " (you)" : ""}</li>)}
          </ul>
          {p.tier === "registered" && <>
            <p className="mt-4 text-sm text-ink">{TIER_NEED.certified}</p>
            <p className="mt-2 text-xs text-slate">Progress: {p.paying} of {CERTIFY_PAYING} paying members{memberTrack ? ` · or ${p.members} of ${CERTIFY_MEMBERS} members` : ""}</p>
            <p className="mt-4 font-ui text-sm font-bold text-ink">Partner training</p>
            <ul className="mt-2 space-y-1.5">
              {TRAINING.map((x, i) => (
                <li key={x}><label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" checked={training.includes(i)} disabled={!!busy} onChange={() => void toggleTraining(i)} className="mt-1" />{x}</label></li>
              ))}
            </ul>
            {p.tierRequestedAt ? <p className="mt-4 text-sm font-semibold text-ink">You asked to be Certified on {p.tierRequestedAt.slice(0, 10)}. The partnerships team is reviewing it.</p>
              : <button type="button" disabled={!!busy || !p.canRequestTier} onClick={() => void act("tier", { action: "tier", id: p.id }, "Sent. The partnerships team will review it.")} className="mt-4 rounded-full bg-crimson px-5 py-2 font-ui text-sm font-bold text-paper disabled:opacity-40">Ask to be Certified</button>}
          </>}
          {p.tier === "certified" && <p className="mt-4 text-sm text-slate">{TIER_NEED.premier}</p>}
          <p className="mt-4 text-xs text-slate">Questions? Ask <Link href="/nana" className="text-crimson underline">Nana</Link> or read <Link href="/help/notesapp-partner-network" className="text-crimson underline">the partner help articles</Link>.</p>
        </div>
      </div>
    </article>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return <div className="rounded-2xl bg-field/60 p-4"><p className="font-display text-3xl text-ink">{n}</p><p className="text-xs text-slate">{label}</p></div>;
}
