"use client";

import Link from "next/link";
import MediaStudio from "@/components/media/MediaStudio";
import { useMember } from "@/lib/member-client";
import { MEDIA_LIVE } from "@/lib/media-rules";

// /profile/media: my Media studio (components/media/MediaStudio.tsx). Signed in only; the API checks everything again.
export default function ProfileMediaPage() {
  const { user, profile } = useMember();
  return (
    <section className="mx-auto max-w-[1100px] px-4 pb-16 pt-8 sm:px-6">
      {!MEDIA_LIVE ? <p className="text-sm text-slate">Media isn&apos;t switched on yet.</p>
        : user === null ? <p className="text-sm text-slate"><Link href="/login?next=/profile/media" className="text-crimson underline">Sign in</Link> to post to your Media.</p>
        : user ? <MediaStudio /> : <p className="text-sm text-slate">Loading…</p>}
      {user && profile?.username && <p className="mt-8 text-sm text-slate">Your Media as others see it: <Link href={`/u/${profile.username}/media`} className="font-semibold text-crimson">/u/{profile.username}/media</Link> · <Link href="/help/media" className="font-semibold text-crimson">How Media works</Link></p>}
    </section>
  );
}
