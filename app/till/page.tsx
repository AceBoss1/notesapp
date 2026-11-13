import type { Metadata } from "next";
import HotelTill from "@/components/hotel/HotelTill";

export const metadata: Metadata = { title: "Till", robots: { index: false } };

// A Hotel kit till on its counter device (Hotel Standard and up): opened with the till's own PIN, no #NotesApp sign-in needed, so it
// stands alone without the site's menus (app/statement does the same).
export default function TillPage() {
  return <main data-theme-off className="min-h-screen bg-[#FBF6F2]"><HotelTill /></main>;
}
