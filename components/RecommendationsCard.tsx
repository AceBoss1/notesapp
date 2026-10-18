"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LinkedText from "@/components/LinkedText";
import Avatar from "@/components/Avatar";
import { Stars } from "@/components/ReviewsPanel";
import type { RatingSummary, Recommendation } from "@/lib/reviews";

// A member's approved recommendations in short, beside their journals and on their site's About page: the stars, how many, and the
// latest two, with a link to them all on the profile (RecommendationsPanel). Nothing shows until someone's recommendation is approved.
// profileBase: where profiles live when this isn't on #NotesApp itself (a member's own site links back to the main site).
export default function RecommendationsCard({ subjectUid, username, name, profileBase = "", className = "card p-5" }: { subjectUid: string; username: string; name: string; profileBase?: string; className?: string }) {
  const [d, setD] = useState<{ approved: Recommendation[]; summary?: RatingSummary & { total: number } } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/recommendations?subjectUid=${encodeURIComponent(subjectUid)}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && j) setD(j); }).catch(() => {});
    return () => { alive = false; };
  }, [subjectUid]);
  if (!d?.approved.length) return null;
  const s = d.summary;
  return (
    <div className={className}>
      <p className="font-ui text-sm font-bold text-ink">Recommendations</p>
      <p className="mt-1 text-xs text-slate">{s?.count ? <><Stars value={s.average} size="text-sm" /> <b className="text-ink">{s.average.toFixed(1)}</b> · </> : null}{d.approved.length} recommending {name.split(" ")[0]}</p>
      <ul className="mt-3 space-y-3">
        {d.approved.slice(0, 2).map((r) => (
          <li key={r.id} className="text-sm">
            <p className="line-clamp-3 text-ink">“<LinkedText text={r.text} />”</p>
            <p className="mt-1 flex items-center gap-2 text-xs text-slate"><Avatar src={r.authorAvatar} alt={r.authorName} size={20} square={r.authorIsOrg} /><span className="truncate">{r.authorName}{r.rating ? ` · ${"★".repeat(r.rating)}` : ""}</span></p>
          </li>
        ))}
      </ul>
      <Link href={`${profileBase}/u/${username}#recommendations`} className="mt-3 inline-block text-xs font-semibold text-crimson">See all on {name.split(" ")[0]}&apos;s profile →</Link>
    </div>
  );
}
