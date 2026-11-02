import type { Metadata } from "next";
import ConnectNotesApp from "@/components/agents/ConnectNotesApp";

export const metadata: Metadata = { title: "Type your code", robots: { index: false } };

// Where a member types the 8-character code an assistant shows them (it opens Connect NotesApp for that request).
export default function LinkPage() {
  return <ConnectNotesApp />;
}
