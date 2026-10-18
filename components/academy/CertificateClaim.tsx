"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCourse } from "@/lib/courses-client";
import { api } from "@/lib/moments-client";
import { startCheckout } from "@/lib/checkout";
import { courseHref } from "@/lib/courses";
import { firstName } from "@/lib/nana";
import type { Quote } from "@/lib/certificates-server";
import Certificate from "./Certificate";

const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" });

// /academy/<slug>/certificate: the learner finished every lesson. A blurred preview of their certificate, the name to print (it can't
// change once issued), the price with any late claim fee, and Pay (card or wallet). Already have it → straight to the certificate.
export default function CertificateClaim({ slug }: { slug: string }) {
  const { course, enrolment, user } = useCourse(slug);
  const [name, setName] = useState("");
  const [q, setQ] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (!course || !enrolment?.completedAt) return;
    const t = setTimeout(() => {
      api<{ quote: Quote; name: string }>(`/api/academy/certificate?courseId=${course.id}${first.current ? "" : `&name=${encodeURIComponent(name)}`}`)
        .then((r) => { setQ(r.quote); if (first.current) { setName(r.name); first.current = false; } })
        .catch((e) => setError(e.message));
    }, first.current ? 0 : 400);
    return () => clearTimeout(t);
  }, [course, enrolment?.completedAt, name]);

  async function pay() {
    if (!user || !course || !q) return;
    if (name.trim().length < 2) return setError("Type your name as it should appear on the certificate.");
    setBusy(true); setError("");
    try { await startCheckout(user, { kind: "certificate", courseId: course.id, learnerName: name.trim() }, { amountKobo: q.kobo }); }
    catch (e) { if (e instanceof Error && e.message) setError(e.message); setBusy(false); }
  }

  const wrap = (body: React.ReactNode) => <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">{body}</div>;
  if (user === null) return wrap(<p className="card p-6 text-sm">Please <Link href={`/login?next=/academy/${slug}/certificate`} className="font-semibold text-crimson">sign in</Link> to get your certificate.</p>);
  if (!course || enrolment === undefined) return wrap(<p className="py-12 text-center text-slate">Loading…</p>);
  if (enrolment?.certificateId) return wrap(<div className="card p-6"><p className="font-display text-2xl">You already have this certificate</p><Link href={`/certificates/${enrolment.certificateId}`} className="btn-primary mt-4 inline-block">See it</Link></div>);
  if (!enrolment?.completedAt) return wrap(<div className="card p-6"><p className="font-display text-2xl">Finish the course first</p><p className="mt-2 text-sm text-slate">Your certificate is ready to claim once every lesson is done.</p><Link href={courseHref(slug)} className="btn-primary mt-4 inline-block">Back to the course</Link></div>);

  return wrap(
    <>
      <Link href={courseHref(slug)} className="text-sm font-semibold text-crimson">← {course.title}</Link>
      <div className="mt-4 overflow-hidden rounded-3xl border border-rule bg-card">
        <div className="bg-gradient-to-r from-crimson-deep via-crimson to-crimson-bright px-6 py-7 text-paper sm:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-paper/80">Course complete{q ? ` · ${q.course.hours} learning hour${q.course.hours === 1 ? "" : "s"}` : ""}</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Well done{firstName(name) ? `, ${firstName(name)}` : ""}! 🎉</h1>
          <p className="mt-2 text-paper/90">You finished {course.title} by {q?.face.academyName ?? course.ownerName}.</p>
        </div>
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="rounded-2xl border border-rule p-1.5">{q ? <Certificate face={{ ...q.face, learnerName: name || q.face.learnerName }} verifyUrl="https://www.notesapp.name.ng/certificates/NA-C-XXXXXXXX" preview /> : <div className="aspect-[1.414] animate-pulse rounded-xl bg-paper" />}</div>
            <p className="mt-2 text-sm text-slate">Verifiable by anyone with its QR code or ID. You can add it to LinkedIn and share it once it&apos;s yours.</p>
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-3xl text-ink">Get your certificate</h2>
            <label className="mt-4 block text-sm font-semibold text-ink">Name on the certificate
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={70} className="mt-1 w-full rounded-xl border border-rule bg-card px-3.5 py-3 text-base outline-none focus:border-crimson" />
            </label>
            <p className="mt-1 text-xs text-slate">Check the spelling: it can&apos;t be changed after it&apos;s issued.</p>
            {q && (
              <>
                <div className="mt-4 rounded-2xl bg-paper p-4 text-sm">
                  <p className="flex justify-between"><span>Certificate</span><span>{naira(q.startKobo)}</span></p>
                  <p className="mt-1 flex justify-between text-slate"><span>Late claim fee</span><span>{naira(q.lateKobo)}</span></p>
                  <p className="mt-3 flex justify-between border-t border-rule pt-3 font-ui text-base font-bold text-ink"><span>Total</span><span>{naira(q.kobo)}</span></p>
                </div>
                <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
                  {q.lateKobo > 0
                    ? <>A late claim fee applies because it&apos;s been more than a week since you finished. It goes up by {naira(q.weeklyKobo)} a week, up to {naira(q.capKobo)} at most.</>
                    : <>This price holds until <strong>{day(q.graceUntil)}</strong>. After that a late claim fee of <strong>{naira(q.weeklyKobo)} a week</strong> is added, up to {naira(q.capKobo)} at most.</>}
                </p>
                <button onClick={pay} disabled={busy} className="btn-primary mt-4 w-full !py-3.5 text-base">{busy ? "Opening payment…" : `Pay ${naira(q.kobo)} and get my certificate`}</button>
                <p className="mt-2 text-center text-xs text-slate">Paid securely with Paystack or your NotesApp Credit wallet. Not now? It waits for you on the course page.</p>
              </>
            )}
            {error && <p className="mt-3 text-sm text-crimson" role="alert">{error}</p>}
          </div>
        </div>
      </div>
    </>,
  );
}
