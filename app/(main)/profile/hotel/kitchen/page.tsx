import type { Metadata } from "next";
import HotelKitchen from "@/components/hotel/HotelKitchen";

export const metadata: Metadata = { title: "Kitchen screen", robots: { index: false } };

// The Hotel kit's kitchen screen (Hotel Standard and up): big tickets, a sound and a spoken alert for each new order, late ones in red.
export default function HotelKitchenPage() {
  return <HotelKitchen />;
}
