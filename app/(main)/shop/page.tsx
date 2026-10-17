import type { Metadata } from "next";
import MarketPageClient from "@/components/MarketPageClient";

// Notes Market: every #NotesApp store in one place (components/MarketPageClient.tsx). Item pages stay at /shop/<id>.
export const metadata: Metadata = {
  title: "Notes Market",
  description: "Every #NotesApp store in one place: fashion, beauty, food, electronics, books and courses from African creators and businesses. Pay safely through #NotesApp.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  return <MarketPageClient />;
}
