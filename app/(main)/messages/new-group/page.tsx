import { notFound } from "next/navigation";
import type { Metadata } from "next";
import NewGroup from "@/components/messages/NewGroup";
import MessagesBoundary from "@/components/messages/MessagesBoundary";
import { MESSAGES_LIVE } from "@/lib/moments-rules";

export const metadata: Metadata = { title: "New group", robots: { index: false } };

export default function NewGroupPage() {
  if (!MESSAGES_LIVE) notFound();
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <MessagesBoundary><NewGroup /></MessagesBoundary>
    </div>
  );
}
