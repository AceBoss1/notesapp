import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SiteTrackParcel } from "@/components/site/SiteTrack";
import { normalizeParcelId } from "@/lib/orders";
import { trackSectionOn } from "@/lib/site-sections-server";
import { SITE_URL } from "@/lib/host";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Track a parcel", robots: { index: false } };

// One shipment on the business's own site. /api/track answers only for this business's parcels here (its `seller` check).
export default async function Page({ params }: { params: { username: string; id: string } }) {
  const id = normalizeParcelId(decodeURIComponent(params.id));
  if (!id) notFound();
  if (!(await trackSectionOn(params.username))) redirect(`${SITE_URL}/track/${id}`); // Track is off: #NotesApp's own tracking page
  return <SiteTrackParcel id={id} />;
}
