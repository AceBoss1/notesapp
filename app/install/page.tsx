import type { Metadata } from "next";
import InstallGuide from "@/components/InstallGuide";

export const metadata: Metadata = {
  title: "Install NotesApp",
  description: "Install #NotesApp from your browser on a phone, tablet or computer. No store needed. Steps for your device.",
};

// Reachable on the app address (app.notesapp.name.ng/install), linked from its welcome screen's "Download on mobile" button.
export default function InstallPage() {
  return <InstallGuide />;
}
