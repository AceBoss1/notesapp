import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { ensurePricing } from "@/lib/pricing-server";
import { lagosToday } from "@/lib/hotel";
import { hotelByUsername, publicHotel } from "@/lib/hotel-server";
import { providers } from "@/lib/hotel-pay-server";
import { readSite } from "@/lib/site-server";
import HotelSite from "@/components/hotel/HotelSite";
import { isMainHost, mainSiteUrl } from "@/lib/host";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const found = await hotelByUsername(getAdminDb(), params.username).catch(() => null);
  return found ? { title: "Rooms and dining", description: `Book a room or order food at ${found.hotel.name}${found.hotel.city ? `, ${found.hotel.city}` : ""}.` } : { title: "Hotel" };
}

// The Hotel kit inside a member's site (/hotel on their own domain, middleware.ts): rooms with live availability, booking, and ordering
// from every department (components/hotel/HotelSite.tsx). Guests' own links (/hotel/<code>) are on the main site, where they pay.
export default async function Page({ params, searchParams }: { params: { username: string }; searchParams: { tab?: string; b?: string; stay?: string } }) {
  const db = getAdminDb();
  await ensurePricing();
  const found = await hotelByUsername(db, params.username, searchParams.b).catch(() => null);
  if (!found) notFound();
  const host = (headers().get("host") || "").toLowerCase().replace(/:\d+$/, "");
  const [hotel, site] = await Promise.all([publicHotel(db, found, new Date(), providers()), readSite(db, found.hotel.ownerUid).catch(() => null)]);
  const stay = typeof searchParams.stay === "string" && /^[A-Z0-9]{6,10}$/.test(searchParams.stay) ? searchParams.stay : "";
  return (
    <HotelSite hotel={hotel} cover={site?.cover ?? ""} base={isMainHost(host) ? `/s/${params.username}` : ""} mainUrl={isMainHost(host) ? "" : mainSiteUrl(host).replace(/\/$/, "")} today={lagosToday(new Date())} startTab={searchParams.tab === "order" || stay ? "order" : "rooms"} stayCode={stay} />
  );
}
