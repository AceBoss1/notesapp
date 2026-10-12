import type { Metadata } from "next";
import InstallGuide from "@/components/InstallGuide";

export const metadata: Metadata = {
  title: "Install NotesApp on your phone",
  description: "Add #NotesApp to your phone's home screen from your browser. No app store needed. Steps for iPhone and Android.",
};

// Reachable on the app address (app.notesapp.name.ng/install), linked from its welcome screen's "Download on mobile" button.
export default function InstallPage() {
  return <InstallGuide />;
}
