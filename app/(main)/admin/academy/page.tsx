"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import { certificateDate, type Academy, type Certificate } from "@/lib/certificates";

type Pending = Academy & { ownerUsername: string };
type CourseRow = { id: string; title: string; slug: string; ownerName: string; enrolCount: number; certified: { at: string; by: string } | null };

// Admin → Academy (lib/certificates-server.ts): accrediting institutions waiting to be checked, the "#NotesApp Certified Course" seal
// for courses we've reviewed, and finding or revoking a certificate. Content and moderation staff.
export default function AdminAcademyPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/academy");
  const [pending, setPending] = useState<Pending[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const [id, setId] = useState("");
  const [cert, setCert] = useState<Certificate | null | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(""); setMsg("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(""); }
  }, []);
  const load = useCallback(() => run("load", async () => { const d = await call(); setPending(d.pending); setCourses(d.courses); }), [call, run]);
  useEffect(() => { if (user) void load(); }, [user, load]);

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const shown = courses.filter((c) => !filter || `${c.title} ${c.ownerName}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-4xl">Academy</h1>
      <p className="mt-2 text-sm text-slate">Certificates: check accrediting institutions before their logo appears, mark courses we&apos;ve reviewed as #NotesApp Certified, and find or revoke a certificate.</p>
      {error && <p className="mt-4 text-sm text-crimson" role="alert">{error}</p>}
      {msg && <p className="mt-4 text-sm text-emerald-800" role="status">{msg}</p>}

      <h2 className="mt-8 font-display text-2xl">Accreditations to check {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 font-ui text-sm text-amber-900">{pending.length}</span>}</h2>
      {pending.length === 0 ? <p className="mt-2 text-sm text-slate">Nothing waiting.</p> : (
        <ul className="mt-3 space-y-3">
          {pending.map((a) => (
            <li key={a.ownerUid} className="card p-4">
              <div className="flex items-start gap-3">
                <img src={a.accreditation!.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-rule object-contain p-1" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{a.accreditation!.name}</p>
                  <p className="text-xs text-slate">for {a.name}{a.ownerUsername && <> (<Link href={`/u/${a.ownerUsername}`} className="text-crimson">@{a.ownerUsername}</Link>)</>} · sent {certificateDate(a.accreditation!.submittedAt)}</p>
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-paper px-3 py-2 text-sm [overflow-wrap:anywhere]">{a.accreditation!.proof}</p>
                </div>
              </div>
              <input value={notes[a.ownerUid] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [a.ownerUid]: e.target.value }))} placeholder="Note (needed to reject; the teacher sees it)" className="mt-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm" />
              <div className="mt-2 flex gap-2">
                <button disabled={!!busy} onClick={() => run(`a${a.ownerUid}`, async () => { await call({ action: "accreditation", ownerUid: a.ownerUid, approve: true, note: notes[a.ownerUid] ?? "" }); setMsg(`Approved ${a.accreditation!.name}.`); await load(); })} className="btn-primary !px-4 !py-1.5 text-xs">Approve</button>
                <button disabled={!!busy} onClick={() => run(`r${a.ownerUid}`, async () => { await call({ action: "accreditation", ownerUid: a.ownerUid, approve: false, note: notes[a.ownerUid] ?? "" }); setMsg(`Rejected ${a.accreditation!.name}.`); await load(); })} className="btn-ghost !px-4 !py-1.5 text-xs">Reject</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 font-display text-2xl">#NotesApp Certified Course</h2>
      <p className="mt-1 text-sm text-slate">The seal top left on certificates, for courses our team has reviewed. It applies to certificates issued from now on.</p>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by course or teacher" aria-label="Filter courses" className="mt-3 w-full rounded-lg border border-rule bg-card px-3 py-2 text-sm" />
      <ul className="mt-3 divide-y divide-rule rounded-xl border border-rule bg-card">
        {shown.slice(0, 60).map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <Link href={`/academy/${c.slug}`} className="block truncate font-semibold text-ink hover:text-crimson">{c.title}</Link>
              <p className="truncate text-xs text-slate">{c.ownerName} · {c.enrolCount} learner{c.enrolCount === 1 ? "" : "s"}{c.certified ? ` · certified by ${c.certified.by}` : ""}</p>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={!!c.certified} disabled={!!busy} className="h-4 w-4 accent-crimson"
                onChange={(e) => { const on = e.target.checked; void run(`c${c.id}`, async () => { await call({ action: "certified", courseId: c.id, on }); setCourses((cs) => cs.map((x) => (x.id === c.id ? { ...x, certified: on ? { at: new Date().toISOString(), by: user.email ?? "" } : null } : x))); }); }} />
              Certified
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-3 text-sm text-slate">No published courses{filter ? " match" : " yet"}.</li>}
      </ul>

      <h2 className="mt-10 font-display text-2xl">Find a certificate</h2>
      <form onSubmit={(e) => { e.preventDefault(); void run("find", async () => setCert((await call(undefined, `?id=${encodeURIComponent(id)}`)).certificate)); }} className="mt-3 flex gap-2">
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="NA-C-…" aria-label="Certificate ID" className="min-w-0 flex-1 rounded-lg border border-rule bg-card px-3 py-2 font-mono text-sm uppercase" />
        <button disabled={!!busy || !id.trim()} className="btn-primary !px-4 !py-2 text-xs">Find</button>
      </form>
      {cert === null && <p className="mt-2 text-sm text-slate">No certificate has that ID.</p>}
      {cert && (
        <div className="card mt-3 p-4 text-sm">
          <p><strong>{cert.learnerName}</strong>: {cert.courseTitle} · {cert.academyName}</p>
          <p className="text-xs text-slate">Issued {certificateDate(cert.issuedAt)} · payment {cert.paymentRef} · <Link href={`/certificates/${cert.id}`} className="text-crimson">public page</Link></p>
          {cert.status === "revoked" ? <p className="mt-2 text-red-700">Revoked {certificateDate(cert.revokedAt ?? cert.issuedAt)}: {cert.revokeReason}</p> : (
            <>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why revoke it (shown on the public page)" className="mt-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm" />
              <button disabled={!!busy || reason.trim().length < 5} onClick={() => { if (confirm(`Revoke ${cert.id}? Its page will say it was revoked and why. This can't be undone here.`)) void run("revoke", async () => { setCert((await call({ action: "revoke", id: cert.id, reason })).certificate); setReason(""); setMsg("Revoked."); }); }} className="btn-ghost mt-2 !border-red-300 !px-4 !py-1.5 text-xs !text-red-700">Revoke</button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
