import type { Metadata } from "next";
import ConnectNotesApp from "@/components/agents/ConnectNotesApp";

export const metadata: Metadata = { title: "Connect NotesApp", robots: { index: false } };

// The authorisation screen for outside AI assistants (OAuth's authorization endpoint, on the mcp. address of every domain family, and on
// the main site). Outside the site's usual frame: on the mcp. address the site's menus don't apply.
export default function ConnectPage() {
  return <ConnectNotesApp />;
}
