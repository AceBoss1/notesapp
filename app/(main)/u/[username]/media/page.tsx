import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUserByUsername } from "@/lib/users";
import { MEDIA_LIVE } from "@/lib/media-rules";
import ProfilePageClient from "@/components/ProfilePageClient";

// /u/{username}/media: the profile with its Media tab open (owner, 3 Nov 2026: "/u/{username}/media is that tab as a page"). The grid is
// loaded in the browser from /api/media, which decides what this viewer may see, so the cached page holds nothing private.
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const profile = await getUserByUsername(params.username);
  if (!profile) return { title: "Profile Not Found" };
  const title = `${profile.displayName} (@${profile.username}) · Media`;
  const description = `Videos and pictures from ${profile.displayName} on #NotesApp.`;
  return { title, description, openGraph: { title, description, type: "profile", images: [profile.avatar] }, twitter: { card: "summary_large_image", title, description, images: [profile.avatar] } };
}

export default function ProfileMediaPage({ params }: { params: { username: string } }) {
  if (!MEDIA_LIVE) notFound();
  return <ProfilePageClient params={params} initialTab="media" />;
}
