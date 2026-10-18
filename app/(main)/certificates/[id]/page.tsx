import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getAdminDb } from "@/lib/firebase-admin";
import { certificateOf, verifyUrlFor } from "@/lib/certificates-server";
import { certificateDate, faceOnly, isCertificateId, linkedInAddUrl, normaliseCertificateId } from "@/lib/certificates";
import { certificateMetadata } from "@/lib/og";
import Certificate from "@/components/academy/Certificate";
import { qrSvg } from "@/lib/certificate-qr";
import CertificateActions from "@/components/academy/CertificateActions";

export const dynamic = "force-dynamic";
export const generateMetadata = ({ params }: { params: { id: string } }): Promise<Metadata> => certificateMetadata(normaliseCertificateId(decodeURIComponent(params.id)));

// /certificates/<id>: the public check. Genuine (or revoked, and why), the certificate as issued, and what's printed on it; the learner
// also gets Download PDF. Nothing private is shown.
export default async function CertificatePage({ params }: { params: { id: string } }) {
  const id = normaliseCertificateId(decodeURIComponent(params.id));
  const c = isCertificateId(id) ? await certificateOf(getAdminDb(), id) : null;
  if (!c) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="card border-red-200 p-6">
          <p className="font-display text-3xl text-ink">No certificate has this ID</p>
          <p className="mt-2 text-sm text-slate">We couldn&apos;t find <span className="font-mono">{id}</span>. Check it against the certificate (it starts with NA-C- and has eight letters and numbers). A certificate that isn&apos;t here wasn&apos;t issued by Notes Academy.</p>
          <Link href="/certificates" className="btn-primary mt-4 inline-block">Check another</Link>
        </div>
      </div>
    );
  }
  const url = verifyUrlFor(c.id);
  const qr = await qrSvg(url);
  const revoked = c.status === "revoked";
  const row = "text-sm text-slate";
  const val = "font-semibold text-ink";
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <Image src="/images/academy/notes-academy-verifiable-certificate.webp" alt="" width={64} height={64} className="h-16 w-16" />
        <div>
          <p className="eyebrow">Notes Academy verification</p>
          <p className="font-mono text-lg text-slate">{c.id}</p>
        </div>
      </div>

      <div className={`mt-6 flex items-start gap-4 rounded-2xl border p-5 ${revoked ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-white ${revoked ? "bg-red-600" : "bg-emerald-600"}`} aria-hidden="true">{revoked ? "✕" : "✓"}</span>
        <div>
          <p className={`font-ui text-xl font-bold ${revoked ? "text-red-800" : "text-emerald-900"}`}>{revoked ? "Revoked certificate" : "Genuine certificate"}</p>
          <p className={`mt-0.5 text-sm ${revoked ? "text-red-800" : "text-emerald-800"}`}>
            {revoked
              ? <>Issued by {c.academyName} through Notes Academy, then revoked on {certificateDate(c.revokedAt ?? c.issuedAt)}: {c.revokeReason}</>
              : <>Issued by {c.academyName} through Notes Academy on #NotesApp. It hasn&apos;t been revoked.</>}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className={`min-w-0 rounded-2xl border border-rule bg-card p-2 shadow-sm ${revoked ? "opacity-60 grayscale" : ""}`}><Certificate face={faceOnly(c)} verifyUrl={url} qr={qr} /></div>
        <div className="card min-w-0 p-5">
          <p className={row}>Awarded to</p>
          <p className="font-display text-3xl text-ink">{c.learnerName}</p>
          <p className={`${row} mt-4`}>Course</p>
          <p className={val}><Link href={`/academy/${c.courseSlug}`} className="hover:text-crimson">{c.courseTitle}</Link></p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div><p className={row}>Issued by</p><p className={`${val} flex items-center gap-2`}>{c.logoUrl && <img src={c.logoUrl} alt="" className="h-5 max-w-[2.5rem] object-contain" />}{c.academyName}</p></div>
            <div><p className={row}>Learning hours</p><p className={val}>{c.hours}</p></div>
            <div><p className={row}>Completed</p><p className={val}>{certificateDate(c.completedAt)}</p></div>
            <div><p className={row}>Issued</p><p className={val}>{certificateDate(c.issuedAt)}</p></div>
          </div>
          <p className={`${row} mt-4`}>Signed by</p>
          <p className={val}>{c.signerName}{c.signerTitle ? `, ${c.signerTitle}` : ""}</p>
          {c.accreditation && <><p className={`${row} mt-4`}>Accredited by</p><p className={val}>{c.accreditation.name}</p></>}
          {c.certified && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">#NotesApp Certified Course: reviewed by our team.</p>}
          {!revoked && <CertificateActions id={c.id} ownerUid={c.uid} url={url} learnerName={c.learnerName} courseTitle={c.courseTitle} linkedIn={linkedInAddUrl(c, url)} />}
        </div>
      </div>
      <p className="mt-8 text-center text-sm text-slate">Want to check another? Enter its ID at <Link href="/certificates" className="font-semibold text-crimson">notesapp.name.ng/certificates</Link></p>
    </div>
  );
}
