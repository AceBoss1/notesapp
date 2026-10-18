import type { Metadata } from "next";
import CertificateClaim from "@/components/academy/CertificateClaim";

export const metadata: Metadata = { title: "Your certificate · Notes Academy", robots: { index: false } };

// After the last lesson: preview, price (with any late claim fee) and pay (components/academy/CertificateClaim.tsx).
export default function CertificateClaimPage({ params }: { params: { slug: string } }) {
  return <CertificateClaim slug={params.slug} />;
}
