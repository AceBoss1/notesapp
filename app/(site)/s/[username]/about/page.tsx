import type { Metadata } from "next";
import SitePageView from "@/components/site/SitePageView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "About" };

// The member's own About page (written on /profile/site); not found until they write it.
export default function Page({ params }: { params: { username: string } }) {
  return <SitePageView username={params.username} page="about" />;
}
