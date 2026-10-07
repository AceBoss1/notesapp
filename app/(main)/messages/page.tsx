import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Inbox from "@/components/messages/Inbox";
import MessagesBoundary from "@/components/messages/MessagesBoundary";
import { MESSAGES_LIVE } from "@/lib/moments-rules";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

export default function MessagesPage() {
  if (!MESSAGES_LIVE) notFound();
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl text-ink">Messages</h1>
      <div className="mt-8"><MessagesBoundary><Inbox /></MessagesBoundary></div>
    </div>
  );
}
