import type { Metadata } from "next";
import JournalsPageClient from "@/components/JournalsPageClient";

export const metadata: Metadata = {
  title: "Journals",
  description:
    "Search People, Channels & Topics — the same notes Precheks publishes, read through #NotesApp, with follow, subscribe, and booking one click away.",
};

export default function JournalsPage() {
  return <JournalsPageClient />;
}
