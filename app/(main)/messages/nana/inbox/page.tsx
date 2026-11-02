import { notFound } from "next/navigation";
import type { Metadata } from "next";
import NanaInbox from "@/components/agents/NanaInbox";
import { MESSAGES_LIVE } from "@/lib/moments-rules";

export const metadata: Metadata = { title: "Nana's inbox · Messages", robots: { index: false } };

// Nana's inbox inside Messages, under Nana's pinned conversation: full screen on a phone, a card beside the list on a computer.
export default function MessagesNanaInboxPage() {
  if (!MESSAGES_LIVE) notFound();
  return (
    <div className="h-[100dvh] overflow-y-auto bg-paper lg:card lg:h-[calc(100dvh-7.5rem)] lg:bg-paper">
      <NanaInbox variant="messages" />
    </div>
  );
}
