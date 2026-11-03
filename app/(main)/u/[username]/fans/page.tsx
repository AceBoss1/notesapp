import type { Metadata } from "next";
import { getUserByUsername } from "@/lib/users";
import TopFans from "@/components/fans/TopFans";

// /u/{username}/fans: a creator's Top fans (lib/fans.ts), loaded in the browser from /api/fans/board, which decides what this viewer may
// see (teens only for their followers, the list hidden when the creator chose so), so the cached page holds nothing private.
export const revalidate = 300;
export async function generateStaticParams() { return []; }
export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const p = await getUserByUsername(params.username);
  if (!p) return { title: "Profile Not Found" };
  return { title: `${p.displayName} (@${p.username}) · Top fans`, description: `${p.displayName}'s top fans on #NotesApp.`, robots: { index: false } };
}
export default function FansPage({ params }: { params: { username: string } }) {
  return <TopFans username={params.username} />;
}
