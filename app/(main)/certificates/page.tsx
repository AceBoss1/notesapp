import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { normaliseCertificateId } from "@/lib/certificates";

export const metadata: Metadata = {
  title: "Verify a certificate",
  description: "Check a Notes Academy certificate: enter its ID (NA-C-…) or scan its QR code.",
};

// Anyone can check a certificate here by its ID, or by scanning the QR code on it (which opens /certificates/<id> directly).
export default function CertificatesLookup({ searchParams }: { searchParams: { id?: string } }) {
  const typed = (searchParams.id ?? "").trim();
  if (typed) redirect(`/certificates/${encodeURIComponent(normaliseCertificateId(typed))}`);
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <p className="eyebrow">Notes Academy verification</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Verify a certificate</h1>
      <p className="mt-3 text-slate">Every Notes Academy certificate has an ID like <span className="font-mono">NA-C-7K2M9QXD</span> and a QR code. Scan the code, or type the ID.</p>
      <form className="mt-6 flex gap-2" action="/certificates">
        <input name="id" required placeholder="NA-C-…" aria-label="Certificate ID" className="min-w-0 flex-1 rounded-xl border border-rule bg-card px-4 py-3 font-mono uppercase outline-none focus:border-crimson" />
        <button className="btn-primary !px-5">Check</button>
      </form>
    </div>
  );
}
