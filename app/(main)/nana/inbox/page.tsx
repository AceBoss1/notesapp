import type { Metadata } from "next";
import NanaInbox from "@/components/agents/NanaInbox";

export const metadata: Metadata = { title: "Nana's inbox", robots: { index: false } };

// Nana's inbox on its own page (also pinned in Messages at /messages/nana/inbox): three columns on a computer, cards on a phone.
export default function NanaInboxPage() {
  return <NanaInbox variant="full" />;
}
