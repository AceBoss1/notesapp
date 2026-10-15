import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { journalMetadata } from "@/lib/og";

// Rendered on the first visit to each address, then served from Vercel's cache and refreshed in the background
// (see `revalidate`), instead of running a function on every view.
export const revalidate = 120;
export async function generateStaticParams() {
  return [];
}

// Older shared links point here. Give the redirecting page the post's own share card, in case a scraper reads it
// without following the redirect.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return journalMetadata(params.slug);
}

export default function NoteSlugRedirect({ params }: { params: { slug: string } }) {
  redirect(`/journals/${params.slug}`);
}
