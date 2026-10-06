import type { Metadata } from "next";
import LearnClient from "@/components/LearnClient";

export const metadata: Metadata = { title: "Your purchase", robots: { index: false, follow: false } };

export default function LearnPage({ params }: { params: { reference: string } }) {
  return <LearnClient reference={params.reference} />;
}
