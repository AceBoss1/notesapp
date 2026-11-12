import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { ensurePricing } from "@/lib/pricing-server";
import { guestView, hotelById, publicHotel } from "@/lib/hotel-server";
import { providers } from "@/lib/hotel-pay-server";
import HotelGuest from "@/components/hotel/HotelGuest";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking or order", robots: { index: false } };

// A hotel guest's own link (the booking, order or room bill with this code; lib/hotel-server.ts guestView): where it stands, and paying
// for it (card, bank or USSD through Paystack; or the account number for it, with the add-on). After Paystack sends them back (?ref=…),
// the page asks the server to confirm with Paystack; nothing here marks anything paid by itself.
export default async function HotelGuestPage({ params, searchParams }: { params: { code: string }; searchParams?: { ref?: string; pay?: string } }) {
  const db = getAdminDb();
  await ensurePricing();
  const view = await guestView(db, decodeURIComponent(params.code)).catch(() => null);
  if (!view) notFound();
  const found = await hotelById(db, view.hotelId);
  const pay = found ? (await publicHotel(db, found, new Date(), providers())).pay : { online: false, transfer: false, desk: false };
  const ref = typeof searchParams?.ref === "string" && /^[A-Za-z0-9_-]{6,80}$/.test(searchParams.ref) ? searchParams.ref : "";
  return (
    <main data-theme-off className="min-h-screen bg-[#FBF6F2] px-4 py-8">
      <HotelGuest initial={JSON.parse(JSON.stringify(view))} pay={pay} returnRef={ref} wantTransfer={searchParams?.pay === "transfer"} />
    </main>
  );
}
