import { NextRequest, NextResponse } from "next/server";

// Notes Arcade as its own installable app (owner, 21 Nov 2026): the green [na] icon and the name "Notes Arcade". On arcade.<domain> it
// owns the whole address; on the main site it owns /arcade (the main site keeps #NotesApp's own manifest, app/manifest.ts).
export function GET(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  const own = host.startsWith("arcade.");
  const manifest = {
    id: "/arcade",
    name: "Notes Arcade",
    short_name: "Notes Arcade",
    description: "Free games from #NotesApp: Ludo, Whot, Ace of Spades, Naija Landlord, Ncho, Chess, Draughts, Achi, Naija Run, Puff-Puff Rush and more.",
    start_url: own ? "/" : "/arcade",
    scope: own ? "/" : "/arcade",
    display: "standalone",
    background_color: "#f7f7f2",
    theme_color: "#17251f",
    categories: ["games", "entertainment"],
    icons: [
      { src: "/images/brand/arcade-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/images/brand/arcade-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/images/brand/arcade-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new NextResponse(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
