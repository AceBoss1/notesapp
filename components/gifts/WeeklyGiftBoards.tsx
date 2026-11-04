"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import Avatar from "@/components/Avatar";
import { giftNaira } from "@/lib/gift-catalogue";
import type { BoardRow } from "@/lib/gifts-server";
import { useMember } from "@/lib/member-client";

type Boards = { week: string; thisWeek: string; endsAt: string; gifted: BoardRow[]; gifters: BoardRow[] | null; creator: { displayName: string } | null };

// The weekly boards (owner, 4 Nov 2026): with a creator, their "Top gifters" (who sent them the most this week); without, the sitewide
// "Top gifted" (who received the most). Both reset at midnight going into Monday, Lagos time; "Last week" keeps the result viewable.
export default function WeeklyGiftBoards({ user, creator }: { user: User | null | undefined; creator?: string }) {
  const [which, setWhich] = useState<"this" | "last">("this");
  const [data, setData] = useState<Boards | null>(null);
  useEffect(() => {
    if (user === undefined) return;
    let gone = false;
    (async () => {
      const headers: Record<string, string> = user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {};
      const r = await fetch(`/api/gifts/boards?week=${which}${creator ? `&creator=${encodeURIComponent(creator)}` : ""}`, { headers }).catch(() => null);
      const j = r?.ok ? await r.json() : null;
      if (!gone) setData(j);
    })();
    return () => { gone = true; };
  }, [user, creator, which]);

  const rows = creator ? data?.gifters ?? [] : data?.gifted ?? [];
  const title = creator ? `Top gifters${data?.creator ? ` for ${data.creator.displayName.split(" ")[0]}` : ""}` : "Top gifted";
  const tab = (w: "this" | "last", label: string) => (
    <button type="button" onClick={() => setWhich(w)} aria-pressed={which === w} className={`rounded-full px-3 py-1 text-xs font-semibold ${which === w ? "bg-ink text-paper" : "bg-paper text-slate ring-1 ring-rule"}`}>{label}</button>
  );
  return (
    <section className="card p-4" data-weekly-board={creator ? "gifters" : "gifted"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-ui text-sm font-bold text-ink">🏆 {title}</p>
        <span className="flex gap-1">{tab("this", "This week")}{tab("last", "Last week")}</span>
      </div>
      <p className="mt-1 text-xs text-slate">{which === "this" ? "Resets at midnight going into Monday (Lagos time)." : `The week of ${data?.week ? new Date(`${data.week}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "…"}, as it finished.`}{creator ? " Anonymous gifts aren't listed." : ""}</p>
      {data && rows.length === 0 && <p className="mt-3 text-sm text-slate">No gifts {which === "this" ? "yet this week" : "last week"}.</p>}
      <ol className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.uid} className="flex items-center gap-3">
            <span className="w-6 text-right font-mono text-xs text-slate">{r.place}</span>
            <Avatar src={r.avatar} alt="" size={28} className="!h-7 !w-7 rounded-full" />
            <Link href={`/u/${r.username}`} className="min-w-0 flex-1 truncate font-ui text-sm text-ink hover:underline">{r.displayName}</Link>
            <span className="font-mono text-xs text-ink">{giftNaira(r.kobo)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// The sitewide weekly "Top gifted" for pages that don't know the viewer (the Gifts page).
export function TopGiftedThisWeek() {
  const { user } = useMember();
  return <WeeklyGiftBoards user={user} />;
}
