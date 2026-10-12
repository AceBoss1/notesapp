import type { MetadataRoute } from "next";

// What lets #NotesApp be installed from a phone's browser (Add to Home Screen / Install app): its name, icon and colours, and that it opens full screen.
// Served on every host; on the app address (app.notesapp.name.ng) the start page is the welcome screen, or straight to the journal when signed in.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "#NotesApp",
    short_name: "NotesApp",
    description: "Publish a note, take a booking, get paid in Naira.",
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
}
