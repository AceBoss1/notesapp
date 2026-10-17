import type { Metadata } from "next";
import SavedItemsClient from "@/components/SavedItemsClient";

export const metadata: Metadata = { title: "Saved", description: "The journals, chat messages and store items you saved on #NotesApp.", robots: { index: false } };

export default function SavedPage() {
  return <SavedItemsClient />;
}
