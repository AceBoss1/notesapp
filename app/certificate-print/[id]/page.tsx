import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { certificateOf, verifyUrlFor } from "@/lib/certificates-server";
import { faceOnly } from "@/lib/certificates";
import Certificate from "@/components/academy/Certificate";
import { qrSvg } from "@/lib/certificate-qr";
import PrintNow from "@/components/academy/PrintNow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Certificate", robots: { index: false } };

// The PDF: the certificate alone on a landscape A4 page, opened from "Download PDF". The browser's print dialog saves it as a PDF.
export default async function CertificatePrint({ params }: { params: { id: string } }) {
  const c = await certificateOf(getAdminDb(), decodeURIComponent(params.id));
  if (!c || c.status === "revoked") notFound();
  const url = verifyUrlFor(c.id);
  return (
    <main data-theme-off className="flex min-h-screen items-center justify-center bg-white p-0 print:block">
      <style>{"@page { size: A4 landscape; margin: 0 } @media print { html, body { background: #fff } }"}</style>
      <div className="w-[min(100vw,141.4vh)] print:w-[297mm]"><Certificate face={faceOnly(c)} verifyUrl={url} qr={await qrSvg(url)} /></div>
      <PrintNow />
    </main>
  );
}
