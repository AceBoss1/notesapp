import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { isMainHost } from "@/lib/host";
import { siteDocOf } from "@/lib/site-kits";
import { getUserByUsername } from "@/lib/users";
import { MemberProvider } from "@/lib/member-client";
import CommunityView from "@/components/community/CommunityView";
import { CommunityPlaceProvider } from "@/components/community/place";

export const dynamic = "force-dynamic";

async function linked(username: string) {
  const p = await getUserByUsername(username).catch(() => null);
  if (!p) return null;
  const site = siteDocOf((await getAdminDb().doc(`sites/${p.uid}`).get()).data());
  return site.community && site.communityPage !== false ? site.community : null;
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const cid = await linked(params.username);
  const c = cid ? (await getAdminDb().doc(`communities/${cid}`).get().catch(() => null))?.data() : null;
  return c ? { title: c.name, description: c.tagline || `${c.name}, our community.` } : { title: "Community" };
}

// The community a member linked on Your site (lib/site-kits.ts SiteDoc.community), inside their site: their header and footer around it,
// at /community on their own domain (middleware.ts). It's the same community as at /c/<id> on #NotesApp; its tabs stay here, and links to
// the rest of #NotesApp (profiles, Messages) go to the main site (components/community/place.tsx).
export default async function Page({ params }: { params: { username: string } }) {
  const cid = await linked(params.username);
  if (!cid) notFound();
  const host = (headers().get("host") || "").toLowerCase().replace(/:\d+$/, "");
  const base = isMainHost(host) ? `/s/${params.username}` : "";
  return (
    <MemberProvider>
      <CommunityPlaceProvider value={{ path: `${base}/community` }}>
        <Suspense><CommunityView id={cid} /></Suspense>
      </CommunityPlaceProvider>
    </MemberProvider>
  );
}
