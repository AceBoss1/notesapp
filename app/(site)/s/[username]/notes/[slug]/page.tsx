import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getNoteBySlug } from "@/lib/firestore-notes";
import { getUserByUsername } from "@/lib/users";
import { journalMetadata } from "@/lib/og";
import JournalDetail from "@/components/JournalDetail";

// A note inside the member's own site: the same reading page as /journals/<slug>, but only for their notes.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return journalMetadata(params.slug);
}

export default async function Page({ params }: { params: { username: string; slug: string } }) {
  const [owner, note] = await Promise.all([getUserByUsername(params.username).catch(() => null), getNoteBySlug(params.slug)]);
  if (!owner || !note || note.authorUid !== owner.uid) return notFound();
  return <JournalDetail params={{ slug: params.slug }} />;
}
