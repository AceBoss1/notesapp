"use client";

import Link from "next/link";
import MediaStudio from "@/components/media/MediaStudio";
import ReplaysList from "@/components/replays/ReplaysList";
import { useMember } from "@/lib/member-client";
import { MEDIA_LIVE } from "@/lib/media-rules";

// /profile/media: my Media studio (components/media/MediaStudio.tsx), whose Lives & replays tab holds the recordings and replays from
// lives (components/replays/ReplaysList.tsx). Until Media is switched on, this page still shows those recordings and replays. Signed in
// only; the API checks everything again.
export default function ProfileMediaPage() {
  const { user, profile } = useMember();
  return (
    <section className="mx-auto max-w-[1100px] px-4 pb-16 pt-8 sm:px-6">
      {user === null ? <p className="text-sm text-slate"><Link href="/login?next=/profile/media" className="text-crimson underline">Sign in</Link> to see your Media.</p>
        : !user ? <p className="text-sm text-slate">Loading…</p>
        : MEDIA_LIVE ? <MediaStudio />
        : <><h1 className="font-display text-3xl text-ink">Media</h1><p className="mt-1 text-sm text-slate">Your recorded lives and the replays you&apos;ve published.</p><div className="mt-6"><ReplaysList /></div></>}
      {MEDIA_LIVE && user && profile?.username && <p className="mt-8 text-sm text-slate">Your Media as others see it: <Link href={`/u/${profile.username}/media`} className="font-semibold text-crimson">/u/{profile.username}/media</Link> · <Link href="/help/media" className="font-semibold text-crimson">How Media works</Link></p>}
    </section>
  );
}
