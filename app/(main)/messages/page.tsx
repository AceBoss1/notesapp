import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Inbox from "@/components/messages/Inbox";
import MessagesBoundary from "@/components/messages/MessagesBoundary";
import { MESSAGES_LIVE } from "@/lib/moments-rules";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

export default function MessagesPage() {
  if (!MESSAGES_LIVE) notFound();
  return (
    <>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:hidden">
        <div className="card p-4">
          <h1 className="font-display text-3xl text-ink">Messages</h1>
          <div className="mt-4"><MessagesBoundary><Inbox /></MessagesBoundary></div>
        </div>
      </div>
      <div className="hidden py-10 lg:block">
        <div className="card flex min-h-[24rem] flex-col items-center justify-center p-10 text-center">
          <h1 className="font-display text-3xl text-ink">Messages</h1>
          <p className="mt-2 max-w-sm text-sm text-slate">Choose a conversation on the left, or ask Nana AI, pinned at the top.</p>
        </div>
      </div>
    </>
  );
}
