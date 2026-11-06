"use client";

import Link from "next/link";
import ArtistStudio from "@/components/sounds/ArtistStudio";
import { useMember } from "@/lib/member-client";

// /profile/sounds: your NotesApp Sounds (components/sounds/ArtistStudio.tsx): plays and where, royalties, the artist application, and
// adding songs once verified. Signed in only; the API checks everything again.
export default function ProfileSoundsPage() {
  const { user } = useMember();
  return (
    <section className="mx-auto max-w-[900px] px-4 pb-16 pt-8 sm:px-6">
      {user === null ? <p className="text-sm text-slate"><Link href="/login?next=/profile/sounds" className="text-crimson underline">Sign in</Link> to see your sounds.</p>
        : !user ? <p className="text-sm text-slate">Loading…</p>
        : <ArtistStudio />}
    </section>
  );
}
