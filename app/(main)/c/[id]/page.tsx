import type { Metadata } from "next";
import { Suspense } from "react";
import { getAdminDb } from "@/lib/firebase-admin";
import CommunityView from "@/components/community/CommunityView";

export const dynamic = "force-dynamic";

// A community's page (lib/community.ts). Only the public parts (name, line, picture) go into share previews: members-only posts never do.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const c = (await getAdminDb().doc(`communities/${params.id}`).get().catch(() => null))?.data();
  if (!c) return { title: "Community" };
  const description = c.tagline || `${c.name} on #NotesApp.`;
  return { title: c.name, description, openGraph: { title: c.name, description, images: c.cover || c.avatar ? [c.cover || c.avatar] : undefined } };
}

export default function Page({ params }: { params: { id: string } }) {
  return <Suspense><CommunityView id={params.id} /></Suspense>;
}
