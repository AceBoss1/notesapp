import type { Metadata } from "next";
import { journalMetadata } from "@/lib/og";
import JournalDetail from "@/components/JournalDetail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return journalMetadata(params.slug);
}

export default function Page({ params }: { params: { slug: string } }) {
  return <JournalDetail params={params} />;
}
