import type { Metadata } from "next";
import SitePageView from "@/components/site/SitePageView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact" };

// The member's own Contact page (written on /profile/site); not found until they write it.
export default function Page({ params }: { params: { username: string } }) {
  return <SitePageView username={params.username} page="contact" />;
}
