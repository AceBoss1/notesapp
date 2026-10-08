import type { Metadata } from "next";
import Splash from "@/components/Splash";

export const metadata: Metadata = {
  title: "Welcome",
  description: "Publish a note, take a booking, get paid. Sign in or create your #NotesApp account.",
};

// The home page of the app domain (notesapp.ng); middleware rewrites "/" there. On the main site it is reachable too.
export default function WelcomePage() {
  return <Splash />;
}
