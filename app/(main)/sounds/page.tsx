import type { Metadata } from "next";
import SoundsIndex from "@/components/sounds/SoundsIndex";

export const metadata: Metadata = {
  title: "NotesApp Sounds",
  description: "Songs made for #NotesApp, free to use on your Media posts, moments and lives. Artists earn a royalty from ad revenue for every play.",
};

export default function SoundsRoute() {
  return <section className="mx-auto max-w-[1100px] px-4 pb-16 pt-8 sm:px-6"><SoundsIndex /></section>;
}
