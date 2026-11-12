import type { Metadata } from "next";
import HotelManage from "@/components/hotel/HotelManage";

export const metadata: Metadata = { title: "Your hotel", robots: { index: false } };

// The Hotel kit (docs/HOTEL_KIT.md): set up and run the hotel. The public page about it is /hotels; guests use the hotel's site (/hotel).
export default function HotelPage() {
  return <HotelManage />;
}
