import type { Metadata, Viewport } from "next";
import Play from "./Play";

export const metadata: Metadata = {
  title: "Play Notes Life",
  description: "Notes Life, the free NotesApp life game: start in a room in Wuse, Abuja with N$ 100,000, get a job, eat at Chef Adams and climb the Billionaires List.",
  robots: { index: false },
  openGraph: { title: "Play Notes Life", description: "Start small. Hustle. Ball out (in game money). A NotesApp game.", images: ["/images/life/room-desktop.webp"] },
};
export const viewport: Viewport = { themeColor: "#0f766e", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };

// Notes Life, the game itself (full screen, client only: three.js needs the browser). Played on www so the NotesApp sign-in is the same one.
export default function LifePlayPage() {
  return <Play />;
}
