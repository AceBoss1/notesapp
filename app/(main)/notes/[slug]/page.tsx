import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { journalMetadata } from "@/lib/og";

// Older shared links point here. Give the redirecting page the post's own share card, in case a scraper reads it
// without following the redirect.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return journalMetadata(params.slug);
}

export default function NoteSlugRedirect({ params }: { params: { slug: string } }) {
  redirect(`/journals/${params.slug}`);
}
