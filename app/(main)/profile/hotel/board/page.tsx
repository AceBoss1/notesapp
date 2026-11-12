import type { Metadata } from "next";
import HotelBoard from "@/components/hotel/HotelBoard";

export const metadata: Metadata = { title: "Staff board", robots: { index: false } };

// The Hotel kit's live staff board (Hotel Standard and up): orders moving through each department, as they land.
export default function HotelBoardPage() {
  return <HotelBoard />;
}
