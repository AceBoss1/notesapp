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
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="mb-3 font-ui text-sm"><Link href="/messages" className="text-crimson underline">← Messages</Link></p>
      <div className="overflow-hidden rounded-xl border border-rule"><NanaPanel context="messages" className="h-[min(640px,calc(100dvh-12rem))]" /></div>
      <p className="mt-3 text-xs text-slate">Nana is #NotesApp&apos;s helper. <Link href="/nana" className="underline">More about Nana, and connecting your own AI account</Link>.</p>
    </div>
  );
}
