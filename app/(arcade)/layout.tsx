import type { Metadata, Viewport } from "next";

// Every Notes Arcade page (Snake and the games under /arcade) installs as the Notes Arcade app: its own manifest, the green [na] icon
// in the browser tab and on the home screen.
export const metadata: Metadata = {
  manifest: "/arcade/manifest.webmanifest",
  applicationName: "Notes Arcade",
  appleWebApp: { capable: true, title: "Notes Arcade", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/images/brand/notesapp-icon-green.png", sizes: "64x64", type: "image/png" }, { url: "/images/brand/arcade-icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/images/brand/arcade-apple-touch-180.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = { themeColor: "#17251f" };

export default function ArcadeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
