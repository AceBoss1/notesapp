import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteTrackLookup } from "@/components/site/SiteTrack";
import { trackSectionOn } from "@/lib/site-sections-server";
import { SITE_URL } from "@/lib/host";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Track a parcel" };

// A logistics business's Track page (Your site → Track): the tracking-number box. With Track off, the visitor goes to #NotesApp's tracking page.
export default async function Page({ params }: { params: { username: string } }) {
  if (!(await trackSectionOn(params.username))) redirect(`${SITE_URL}/track`); // Track is off: #NotesApp's own tracking page
  return <SiteTrackLookup />;
}
