import type { Metadata } from "next";
import { journalMetadata } from "@/lib/og";
import JournalDetail from "@/components/JournalDetail";

// Rendered on the first visit to each address, then served from Vercel's cache and refreshed in the background
// (see `revalidate`), instead of running a function on every view.
export const revalidate = 120;
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return journalMetadata(params.slug);
}

export default function Page({ params }: { params: { slug: string } }) {
  return <JournalDetail params={params} />;
}
