"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import { Masked } from "@/components/admin/Masked";
import { Lead, LEAD_LABEL } from "@/lib/leads";
import { MOOD_SCALE, average, nps } from "@/lib/feedback";
import { BACKGROUNDS, examsLabel, subjectName } from "@/lib/prep-reviewers";
import { BUSINESS_TYPES, businessTypeLabel, keepsBooksLabel } from "@/lib/books-waitlist";

type Kind = "all" | "messages" | "feedback" | "volunteers" | "books";
const KINDS: { id: Kind; label: string }[] = [
  { id: "all", label: "Everything" }, { id: "messages", label: "Messages" }, { id: "feedback", label: "Feedback" }, { id: "volunteers", label: "Exam Prep reviewers" }, { id: "books", label: "Business books waitlist" },
];
const SERVER_KINDS: Record<string, Kind> = { feedback: "feedback", volunteer: "volunteers", "books-waitlist": "books" };
const ofKind = (l: Lead, k: Kind) => k === "all" || (k === "messages" ? !(l.category in SERVER_KINDS) : SERVER_KINDS[l.category] === k);
const pill = (on: boolean) => `rounded-full px-4 py-1.5 font-ui text-xs font-semibold transition-colors ${on ? "bg-crimson text-paper" : "border border-rule text-ink hover:border-crimson"}`;
const small = "border border-rule px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50";

export default function AdminLeadsPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/leads");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [community, setCommunity] = useState<string | null>(null);
  const [can, setCan] = useState<{ approve: boolean; seed: boolean }>({ approve: false, seed: false });
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState<"all" | Lead["status"]>("all");
  const [kind, setKind] = useState<Kind>("all");

  // Through /api/admin/leads: senders' emails and phones arrive masked (lib/pii.ts); Show reveals an email with a logged reason.
  function reload() {
    call()
      .then((j) => { setLeads(j.leads); setCommunity(j.community ?? null); setCan(j.can ?? { approve: false, seed: false }); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load leads"));
  }
  const act = async (label: string, body: Record<string, unknown>, done?: (j: Record<string, unknown>) => string) => {
    setBusy(label); setError(""); setNote("");
    try { const j = await call(body); if (done) setNote(done(j)); reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(""); }
  };

  useEffect(() => {
    if (!user) return;
    reload();
    // ?kind=feedback (or volunteers) opens that tab, e.g. from the dashboard
    const k = new URLSearchParams(window.location.search).get("kind");
    if (KINDS.some((x) => x.id === k)) setKind(k as Kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) {
    return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  }

  const visible = leads?.filter((l) => ofKind(l, kind) && (filter === "all" || l.status === filter)) || [];
  const feedback = (leads ?? []).filter((l) => l.category === "feedback" && l.feedback);
  const moods = feedback.map((l) => l.feedback!.mood), recs = feedback.map((l) => l.feedback!.recommend);
  const npsNow = nps(recs);
  const waiting = (leads ?? []).filter((l) => l.category === "volunteer" && !l.approval).length;
  const books = (leads ?? []).filter((l) => l.category === "books-waitlist" && l.booksWaitlist);
  const count = (pick: (l: Lead) => string) => Object.entries(books.reduce<Record<string, number>>((m, l) => { const k = pick(l); m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);

  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14">
      <Link href="/admin" className="block font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright">← Dashboard</Link>
      <p className="eyebrow mt-6">{leads ? `${leads.filter((l) => l.status === "new").length} new` : ""}</p>
      <h1 className="font-display text-4xl mt-3">Leads</h1>
      <p className="mt-3 text-sm text-slate max-w-xl">
        Every /contact submission — general enquiries, support, bug reports — plus the one-month feedback form, Naija Exam Prep
        reviewer sign-ups and the Business books waitlist, routed here rather than a shared inbox someone has to remember to check.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button key={k.id} onClick={() => setKind(k.id)} className={pill(kind === k.id)}>
            {k.label}{k.id === "feedback" && feedback.length ? ` (${feedback.length})` : ""}{k.id === "volunteers" && waiting ? ` (${waiting} waiting)` : ""}{k.id === "books" && books.length ? ` (${books.length})` : ""}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["all", "new", "read", "archived"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 font-ui text-[11px] font-semibold ${filter === f ? "bg-ink text-paper" : "border border-rule text-slate hover:border-ink"}`}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {kind === "feedback" && (
        <div className="card mt-6 grid gap-4 p-5 sm:grid-cols-4">
          <div><p className="eyebrow">Replies</p><p className="mt-1 font-display text-3xl text-ink">{feedback.length}</p></div>
          <div><p className="eyebrow">First month</p><p className="mt-1 font-display text-3xl text-ink">{average(moods) ?? "–"}<span className="text-base text-slate"> / 5</span></p></div>
          <div><p className="eyebrow">Would recommend</p><p className="mt-1 font-display text-3xl text-ink">{average(recs) ?? "–"}<span className="text-base text-slate"> / 10</span></p></div>
          <div><p className="eyebrow">NPS</p><p className="mt-1 font-display text-3xl text-ink">{npsNow === null ? "–" : npsNow > 0 ? `+${npsNow}` : npsNow}</p><p className="text-[11px] text-slate">% 9–10 less % 0–6</p></div>
          <p className="text-xs text-slate sm:col-span-4">From <Link className="text-crimson underline" href="/contact?topic=feedback">/contact?topic=feedback</Link>, linked from the one-month announcement. Replies marked “can contact” are fair to answer by email.</p>
        </div>
      )}

      {kind === "volunteers" && (
        <div className="card mt-6 space-y-2 p-5 text-sm">
          <p className="font-semibold text-ink">Naija Exam Prep reviewers</p>
          <p className="text-slate">
            Sign-ups from <a className="text-crimson underline" href="/exam-prep/reviewers">/exam-prep/reviewers</a>. <b>Approve</b> gives reviewer access for their subjects
            straight away when they have a #NotesApp account with that email (the same access an invite link gives, so they show under
            Admin → Naija Exam Prep → Reviewers); without an account, it emails them a one-person invite link for those subjects. Approving
            needs Editorial. Volunteers who asked to join the reviewers&apos; community get its invite link with the approval.
          </p>
          {community ? (
            <p className="text-slate">Reviewers&apos; community: <a className="text-crimson underline" href={community.replace(/^https?:\/\/[^/]+/, "")}>Naija Exam Prep Reviewers</a> (private, by invite link).</p>
          ) : can.seed ? (
            <button disabled={!!busy} onClick={() => act("seed", { action: "seed_community" }, (j) => j.created ? "The Naija Exam Prep Reviewers community is set up, and you run it." : "It's already set up.")} className="btn-primary !px-4 !py-2 text-xs">
              {busy === "seed" ? "Setting up…" : "Set up the reviewers' community"}
            </button>
          ) : (
            <p className="text-slate">The reviewers&apos; community isn&apos;t set up yet: a super admin sets it up here, with one tap.</p>
          )}
        </div>
      )}

      {kind === "books" && (
        <div className="card mt-6 grid gap-4 p-5 text-sm sm:grid-cols-3">
          <div><p className="eyebrow">On the waitlist</p><p className="mt-1 font-display text-3xl text-ink">{books.length}</p><p className="text-[11px] text-slate">{books.filter((l) => l.booksWaitlist!.notify).length} want an email when it opens</p></div>
          <div><p className="eyebrow">Kinds of business</p><ul className="mt-1 space-y-0.5 text-slate">{count((l) => businessTypeLabel(l.booksWaitlist!.businessType)).slice(0, BUSINESS_TYPES.length).map(([k, n]) => <li key={k}>{k}: <b className="text-ink">{n}</b></li>)}</ul></div>
          <div><p className="eyebrow">Keep books today in</p><ul className="mt-1 space-y-0.5 text-slate">{count((l) => keepsBooksLabel(l.booksWaitlist!.keepsBooks)).map(([k, n]) => <li key={k}>{k}: <b className="text-ink">{n}</b></li>)}</ul></div>
          <p className="text-xs text-slate sm:col-span-3">From <Link className="text-crimson underline" href="/books">/books</Link>. Business books isn&apos;t built yet (docs/BUSINESS-BOOKS.md); these answers shape what comes first.</p>
        </div>
      )}

      {error && <p className="mt-6 text-sm text-red-700">{error}</p>}
      {note && <p className="mt-6 text-sm text-emerald-800">{note}</p>}

      {!leads ? (
        <p className="mt-8 text-slate">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-sm text-slate">Nothing here.</p>
      ) : (
        <div className="mt-8 divide-y divide-rule">
          {visible.map((l) => (
            <div key={l.id} className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-ui font-semibold text-ink">
                    {l.name}{" "}
                    <Masked kind="lead-email" subject={l.id} masked={l.email} page="Leads" className="font-mono text-xs text-crimson-bright" />
                    {l.uid && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] text-emerald-900">member</span>}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wideish text-slate">
                    <span className="rounded-full bg-crimson/10 px-2 py-0.5 text-crimson-bright">{LEAD_LABEL[l.category] || l.category}</span>
                    {new Date(l.createdAt).toLocaleString("en-NG", { hour12: true })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {l.status !== "read" && <button onClick={() => act(`r${l.id}`, { id: l.id, action: "read" })} className={small}>Mark Read</button>}
                  {l.status !== "archived" && <button onClick={() => act(`a${l.id}`, { id: l.id, action: "archived" })} className={small}>Archive</button>}
                  <button onClick={() => { if (confirm("Delete this lead permanently?")) void act(`d${l.id}`, { id: l.id, action: "delete" }); }} className={`${small} text-red-700 hover:border-red-700`}>Delete</button>
                </div>
              </div>

              {l.feedback ? (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-rule px-3 py-1 font-ui text-xs font-semibold">{MOOD_SCALE.find((m) => m.value === l.feedback!.mood)?.emoji} First month {l.feedback.mood}/5</span>
                    <span className={`rounded-full px-3 py-1 font-ui text-xs font-semibold ${l.feedback.recommend >= 9 ? "bg-emerald-100 text-emerald-900" : l.feedback.recommend <= 6 ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>Recommend {l.feedback.recommend}/10</span>
                    <span className="rounded-full border border-rule px-3 py-1 font-ui text-xs">{l.feedback.contactOk ? "✓ Can contact" : "Don't contact"}</span>
                  </div>
                  {l.feedback.love && <p className="font-body text-ink"><b className="font-ui text-xs uppercase tracking-wideish text-slate">Loves</b><br />{l.feedback.love}</p>}
                  {l.feedback.missing && <p className="font-body text-ink"><b className="font-ui text-xs uppercase tracking-wideish text-slate">Missing or broken</b><br />{l.feedback.missing}</p>}
                </div>
              ) : l.booksWaitlist ? (
                <div className="mt-3 space-y-1 text-sm">
                  <p className="text-ink"><b>{businessTypeLabel(l.booksWaitlist.businessType)}</b> · {l.booksWaitlist.city}</p>
                  <p className="text-ink"><b>Sells:</b> {l.booksWaitlist.sells}</p>
                  <p className="text-slate">Keeps books today in: {keepsBooksLabel(l.booksWaitlist.keepsBooks, l.booksWaitlist.otherApp)} · {l.booksWaitlist.notify ? "wants an email when it opens" : "no email when it opens"}</p>
                </div>
              ) : l.volunteer ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-ink"><b>Subjects:</b> {l.volunteer.subjects.map(subjectName).join(", ")} · <b>Exams:</b> {examsLabel(l.volunteer.exams)}</p>
                  <p className="text-ink"><b>Background:</b> {l.volunteer.background.map((b) => BACKGROUNDS.find((x) => x.id === b)?.label ?? b).join(", ")} · <b>{l.volunteer.years}</b> years{l.volunteer.phone ? <> · <span className="font-mono text-xs">{l.volunteer.phone}</span></> : null}</p>
                  <p className="text-slate">Reviewers&apos; community: {l.volunteer.joinCommunity ? "wants to join" : "not now"}</p>
                  {l.volunteer.note && <p className="font-body text-ink">{l.volunteer.note}</p>}
                  {l.approval ? (
                    <p className={`rounded px-3 py-2 text-xs ${l.approval.status === "approved" ? "bg-emerald-50 text-emerald-900" : "bg-paper text-slate"}`}>
                      {l.approval.status === "approved"
                        ? `Approved by ${l.approval.byName}, ${new Date(l.approval.at).toLocaleDateString("en-GB")}: ${l.approval.how === "granted" ? "reviewer access switched on" : "invite link emailed (no account yet)"} for ${l.approval.subjects.length} subject${l.approval.subjects.length === 1 ? "" : "s"}.`
                        : `Declined by ${l.approval.byName}${l.approval.note ? `: ${l.approval.note}` : "."}`}
                    </p>
                  ) : can.approve ? (
                    <div className="flex flex-wrap gap-2">
                      <button disabled={!!busy} onClick={() => act(`ap${l.id}`, { id: l.id, action: "approve" }, (j) => (j.inviteUrl ? `Approved. ${l.name} has no account yet, so an invite link for their subjects went to their email.` : `Approved. ${l.name} can review now; we've emailed them.`) + (j.community ? " The community invite went with it." : ""))} className="btn-primary !px-4 !py-1.5 text-xs">{busy === `ap${l.id}` ? "Approving…" : "Approve as reviewer"}</button>
                      <button disabled={!!busy} onClick={() => { const n = prompt("Decline: a note for the record (optional). They aren't emailed."); if (n !== null) void act(`de${l.id}`, { id: l.id, action: "decline", note: n }, () => "Declined."); }} className={small}>Decline</button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate">Waiting for an editor to approve (Editorial runs Naija Exam Prep).</p>
                  )}
                </div>
              ) : (
                <p className="mt-3 whitespace-pre-line text-sm text-ink font-body">{l.message}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
