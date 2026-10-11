import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { isMainHost } from "@/lib/host";
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
  const host = (headers().get("host") || "").toLowerCase().replace(/:\d+$/, "");
  return <JournalDetail params={{ slug: params.slug }} site={{ uid: owner.uid, base: isMainHost(host) ? `/s/${owner.username}` : "", theme: owner.siteTheme }} />;
}
