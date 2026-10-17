import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import NanaPanel from "@/components/NanaPanel";
import { MESSAGES_LIVE } from "@/lib/moments-rules";

export const metadata: Metadata = { title: "Nana AI · Messages", robots: { index: false } };

// Nana AI as a conversation pinned at the top of every member's Messages.
export default function NanaMessagePage() {
  if (!MESSAGES_LIVE) notFound();
  return (
    // Full screen on a phone (no site bar above it there), a card beside the list on desktop.
    <div className="flex h-[100dvh] flex-col bg-paper lg:card lg:h-[calc(100dvh-7.5rem)] lg:overflow-hidden lg:bg-card">
      <p className="shrink-0 border-b border-rule bg-card px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] font-ui text-sm lg:px-6 lg:pt-4">
        <Link href="/messages" className="inline-flex items-center gap-1 font-semibold text-crimson hover:underline"><span aria-hidden="true">←</span> Messages</Link>
      </p>
      <NanaPanel context="messages" className="flex-1" />
      <p className="shrink-0 border-t border-rule bg-card px-4 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 text-xs text-slate lg:px-6 lg:pb-3">Nana is #NotesApp&apos;s helper. <Link href="/nana" className="underline">More about Nana, and connecting your own AI account</Link>.</p>
    </div>
  );
}
