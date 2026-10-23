import type { Metadata } from "next";
import InvoiceView from "@/components/time/InvoiceView";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

// A client's invoice, opened from the link in its email (/invoice/{id}?t=…). No sign-in: the link is the proof.
export default function InvoicePage({ params }: { params: { id: string } }) {
  return <InvoiceView id={params.id} />;
}
