import type { Metadata } from "next";
import SavedItemsClient from "@/components/SavedItemsClient";

export const metadata: Metadata = { title: "Saved items", description: "The store items you saved with the heart on #NotesApp.", robots: { index: false } };

export default function SavedPage() {
  return <SavedItemsClient />;
}
