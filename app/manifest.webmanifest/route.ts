import { NextResponse } from "next/server";
import { WHAT_IS_NOTESAPP } from "@/lib/site";

// What lets #NotesApp be installed from a phone's browser (Add to Home Screen / Install app): its name, icon and colours, and that it opens full screen.
// Served on every host; on the app address (app.notesapp.name.ng) the start page is the welcome screen, or straight to the journal when signed in.
// A route rather than app/manifest.ts so a section can link its own instead (Notes Arcade: app/(arcade)/layout.tsx); the root layout links this one.
export function GET() {
  const manifest = {
    id: "/",
    name: "#NotesApp",
    short_name: "NotesApp",
    description: WHAT_IS_NOTESAPP,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBF6F2",
    theme_color: "#7A0328",
    icons: [
      { src: "/images/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/images/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/images/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new NextResponse(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
