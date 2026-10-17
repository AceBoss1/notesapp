"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import type { ChatCard } from "@/lib/chat-cards";

// The card under a message with a #NotesApp link: a journal (Read), a store item (Buy), a course (Enrol) or a profile. Falls back to nothing
// when the link isn't public (a draft, an item not on sale); the message itself still has the link.
const seen = new Map<string, ChatCard | null>();
const ICON: Record<ChatCard["kind"], string> = { journal: "📰", item: "🛍", course: "🎓", profile: "👤" };
const LABEL: Record<ChatCard["kind"], string> = { journal: "Journal", item: "Notes Market", course: "Notes Academy", profile: "Profile" };

export default function NotesAppCard({ url, user, mine = false }: { url: string; user: User | null; mine?: boolean }) {
  const [c, setC] = useState<ChatCard | null | undefined>(seen.get(url));
  useEffect(() => {
    if (seen.has(url) || !user) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/messages/card?url=${encodeURIComponent(url)}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
        const j = r.ok ? ((await r.json()) as { card: ChatCard | null }) : { card: null };
        seen.set(url, j.card); if (alive) setC(j.card);
      } catch { if (alive) setC(null); }
    })();
    return () => { alive = false; };
  }, [url, user]);
  if (!c) return null;
  const round = c.kind === "profile";
  return (
    <Link href={c.href} className={`mt-2 flex items-center gap-3 overflow-hidden rounded-xl border p-2.5 text-left no-underline ${mine ? "border-white/30 bg-white/10 text-white" : "border-rule bg-card text-ink"}`}>
      {c.image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={c.image} alt="" loading="lazy" className={`h-14 w-14 shrink-0 object-cover sm:h-16 sm:w-16 ${round ? "rounded-full" : "rounded-lg"}`} />
        : <span aria-hidden="true" className={`flex h-16 w-16 shrink-0 items-center justify-center text-2xl ${round ? "rounded-full" : "rounded-lg"} ${mine ? "bg-white/15" : "bg-paper"}`}>{ICON[c.kind]}</span>}
      <span className="min-w-0 flex-1">
        <span className={`block font-mono text-[10px] uppercase tracking-eyebrow ${mine ? "text-white/75" : "text-crimson"}`}>{LABEL[c.kind]}{c.badge ? ` · ${c.badge}` : ""}</span>
        <span className="block font-ui text-sm font-bold leading-snug line-clamp-2">{c.title}</span>
        <span className={`block truncate text-xs ${mine ? "text-white/80" : "text-slate"}`}>{c.subtitle}</span>
        <span className={`mt-1.5 inline-block rounded-full px-3 py-1 font-ui text-xs font-bold sm:hidden ${mine ? "bg-white text-crimson" : "bg-crimson text-white"}`}>{c.cta}</span>
      </span>
      {/* On a phone the button sits under the words, so the title has the width. */}
      <span className={`hidden shrink-0 rounded-full px-3 py-1.5 font-ui text-xs font-bold sm:inline-block ${mine ? "bg-white text-crimson" : "bg-crimson text-white"}`}>{c.cta}</span>
    </Link>
  );
}
