import type { Metadata } from "next";
import SoundPage from "@/components/sounds/SoundPage";
import { SONG } from "@/lib/songs";

// A NotesApp Sounds song's page (components/sounds/SoundPage.tsx). House songs get their title and cover in link previews; artist songs
// load the same page with the general title.
export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const s = SONG(params.id);
  if (!s) return { title: "NotesApp Sounds" };
  const description = `${s.title} by ${s.artist} on NotesApp Sounds: listen, and see the posts and moments people made with it.`;
  return { title: `${s.title} · ${s.artist}`, description, openGraph: { title: `${s.title} · ${s.artist}`, description, images: [{ url: s.cover, width: 512, height: 512 }] } };
}

export default function SoundRoute({ params }: { params: { id: string } }) {
  return <section className="mx-auto max-w-[1100px] px-4 pb-16 pt-8 sm:px-6"><SoundPage id={params.id} /></section>;
}
