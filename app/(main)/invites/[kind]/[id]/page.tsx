"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Avatar from "@/components/Avatar";
import { useMember } from "@/lib/member-client";
import { api } from "@/lib/moments-client";
import type { InviteView } from "@/lib/invites-server";
import { accessLabel, accessTerms, helpHref, roleOf, shareTerms, termsLines, type InviteKind } from "@/lib/invite-terms";

// /invites/<journal|course>/<id>: one co-author or co-tutor invitation, with everything the member agrees to, from the bell and the
// email. Who invited them, what (title and cover), their access in plain words (what they can and can't do), their share and how it's
// paid, the credit, that the lead keeps publishing control, how to leave and the help article. Accept and agree records the
// agreement on the server (lib/invites-server.ts); Decline answers no. A change the lead proposed to an accepted invite is answered here too.
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default function InviteAcceptPage() {
  const { kind: rawKind, id } = useParams<{ kind: string; id: string }>();
  const kind: InviteKind | null = rawKind === "journal" || rawKind === "course" ? rawKind : null;
  const { user } = useMember();
  const [v, setV] = useState<InviteView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const load = useCallback(() => {
    if (!kind) return;
    api<InviteView>(`/api/invites/${kind}/${id}`).then(setV).catch((e) => setError(e.message));
  }, [kind, id]);
  useEffect(() => { if (user) load(); }, [user, load]);

  async function answer(accept: boolean) {
    if (!v || !v.offer) return;
    if (!accept && !window.confirm(v.status === "accepted" ? "Decline the new terms? Your current terms stay as they are." : "Decline this invitation?")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/invites/${v.kind}/${v.id}`, { body: accept ? { accept: true, agree: true, termsVersion: v.termsVersion, seen: { access: v.offer.access, percent: v.offer.percent } } : { accept: false } });
      setDone(accept ? "accepted" : "declined");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't answer the invitation.");
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!kind) return <Shell><p className="text-sm text-slate">That invitation link isn&apos;t right.</p></Shell>;
  if (user === null) return <Shell><p className="text-sm text-slate"><Link href={`/login?next=/invites/${kind}/${id}`} className="font-semibold text-crimson">Sign in</Link> to see your invitation.</p></Shell>;
  if (error && !v) return <Shell><p className="text-sm text-crimson">{error}</p><p className="mt-3 text-sm"><Link href="/invites" className="text-crimson underline">All your invites</Link></p></Shell>;
  if (!v) return <Shell><p className="text-sm text-slate">Loading the invitation…</p></Shell>;

  const role = roleOf(v.kind);
  const thing = v.kind === "journal" ? "journal" : "course";
  const offer = v.offer;
  const isChange = v.status === "accepted" && !!v.change;
  const shown = offer ?? { access: v.access, percent: v.percent }; // what the page describes: the terms on offer, or those in force
  const t = accessTerms(v.kind, shown.access);
  const lines = termsLines(v.kind, { title: v.title, leadName: v.lead.name, access: shown.access, percent: shown.percent });
  const mine = v.viewer === "invitee";
  const answerable = mine && !!offer && !done;

  return (
    <Shell>
      <p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">{v.kind === "journal" ? "Co-author invitation" : "Co-tutor invitation"}</p>
      <h1 className="mt-2 font-display text-3xl text-ink sm:text-4xl">{isChange ? "New terms to agree" : mine ? `You're invited to be a ${role}` : `Your invitation to @${v.invitee.username}`}</h1>

      {/* Who and what */}
      <div className="card mt-6 overflow-hidden">
        {v.cover
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={v.cover} alt="" className="aspect-[16/7] w-full object-cover" />
          : <div aria-hidden className="flex aspect-[16/7] w-full items-center justify-center bg-crimson/[0.07] font-display text-5xl text-crimson">{v.title.trim()[0] ?? "·"}</div>}
        <div className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">{v.kind === "journal" ? "Journal" : "Notes Academy course"} · {v.published ? "published" : "draft"}</p>
          <p className="mt-1 font-display text-2xl text-ink">{v.title}</p>
          <div className="mt-3 flex items-center gap-3">
            <Avatar src={v.lead.avatar} alt={v.lead.name} size={40} />
            <p className="text-sm text-slate"><b className="text-ink">{v.lead.name}</b> @{v.lead.username}<span className="block text-xs">{mine ? "invited you" : "lead"} · keeps publishing control</span></p>
          </div>
        </div>
      </div>

      {done && <p role="status" className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{done === "accepted" ? `Done: you accepted and agreed on ${day(new Date().toISOString())}. ${v.lead.name} has been told.` : `You declined. ${v.lead.name} has been told.`}</p>}
      {v.status === "accepted" && v.agreedAt && !isChange && !done && <p className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{mine ? "You" : `@${v.invitee.username}`} accepted on {day(v.agreedAt)} (terms version {v.agreedTerms?.termsVersion}).</p>}
      {v.status !== "pending" && v.status !== "accepted" && <p className="mt-5 rounded-lg bg-paper px-4 py-3 text-sm text-slate">This invitation is {v.status === "revoked" ? "withdrawn" : v.status}.</p>}
      {isChange && v.change && <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">{v.lead.name} proposes new terms: <b>{accessLabel(v.change.access)}</b>, <b>{v.change.percent}%</b>. Until you agree, your current terms stay: {accessLabel(v.access).toLowerCase()}, {v.percent}%.</p>}

      {/* Access */}
      <section className="card mt-5 p-5">
        <h2 className="font-ui text-lg font-bold text-ink">Your access: {t.label}</h2>
        <p className="mt-1 text-sm text-slate">{t.summary}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">You can</p>
            <ul className="mt-1 space-y-1 text-sm text-ink">{t.can.length ? t.can.map((x) => <li key={x}>✓ {x}</li>) : <li className="text-slate">Be credited and paid your share</li>}</ul></div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-crimson">You can&apos;t</p>
            <ul className="mt-1 space-y-1 text-sm text-ink">{t.cannot.map((x) => <li key={x}>✕ {x}</li>)}</ul></div>
        </div>
      </section>

      {/* Share, credit, control, leaving */}
      <section className="card mt-5 grid gap-4 p-5 text-sm sm:grid-cols-2">
        <div><p className="font-ui font-bold text-ink">Your share: {shown.percent}%</p><p className="mt-1 text-slate">{shareTerms(v.kind, shown.percent)}</p></div>
        <div><p className="font-ui font-bold text-ink">Credit</p><p className="mt-1 text-slate">{v.kind === "journal" ? "Listed as a co-author (“with …” on the byline, and on your profile) once it's published." : "Listed as a co-tutor on the course page and its Tutors tab."}</p></div>
        <div><p className="font-ui font-bold text-ink">The lead keeps control</p><p className="mt-1 text-slate">{v.lead.name} decides when to publish, and keeps the {v.kind === "course" ? "price, the " : ""}split and invitations. Changing your access or share later: less access applies at once (you&apos;re told); more access or a new share needs your agreement here.</p></div>
        <div><p className="font-ui font-bold text-ink">Leaving</p><p className="mt-1 text-slate">{v.kind === "journal" ? "Leave any time before the post is published, from your invites page. Leaving ends your credit and share." : "Leave any time with Leave on the course's Tutors section. Your credit and share of later sales end then."}</p></div>
        <p className="text-xs text-slate sm:col-span-2">More in the help article: <Link href={helpHref(v.kind)} className="font-semibold text-crimson">{v.kind === "journal" ? "Co-authoring a post" : "Co-teaching a course"}</Link>.</p>
      </section>

      {/* Agree */}
      {answerable && (
        <section className="card mt-5 border-crimson/30 p-5">
          <p className="text-sm font-semibold text-ink">By accepting you agree to these terms:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
          {!v.canAccept && <p className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-ink">To accept, you need a publishing account, because your share is paid to a publisher. <Link href="/profile/publishing" className="text-crimson underline">Apply for Free Basic</Link> (free), then come back.</p>}
          {error && <p className="mt-3 text-sm text-crimson">{error}</p>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button onClick={() => answer(true)} disabled={busy || !v.canAccept} className="btn-primary !px-6 !py-2.5 disabled:opacity-50">{busy ? "Saving…" : "Accept and agree"}</button>
            <button onClick={() => answer(false)} disabled={busy} className="btn-ghost !px-6 !py-2.5 disabled:opacity-50">Decline</button>
          </div>
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        {v.status === "accepted" && mine && v.access !== "credit" && <Link href={v.openHref} className="btn-primary !px-5 !py-2">{v.published ? `Open the ${thing}` : v.access === "edit" ? `Open the draft to edit` : "Read the draft"}</Link>}
        <Link href={v.kind === "journal" ? "/invites" : "/academy/teach"} className="btn-ghost !px-5 !py-2">{v.kind === "journal" ? "All your invites" : "Your courses"}</Link>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">{children}</section>;
}
