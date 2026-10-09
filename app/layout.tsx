import ErrorReporter from "@/components/ErrorReporter";
import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import "./globals.css";

const DEFAULT_TITLE = "#NotesApp — Publish. Book. Get Paid. One Workspace.";
const DEFAULT_DESCRIPTION =
  "#NotesApp is where African creators, professionals and businesses publish journals, grow an audience, take bookings, sell products and downloads, and get paid in Naira — in one place.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: DEFAULT_TITLE,
    template: "%s — #NotesApp",
  },
  description: DEFAULT_DESCRIPTION,
  icons: { icon: "/images/brand/notesapp-icon.webp" },
  openGraph: {
    siteName: "#NotesApp",
    type: "website",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/images/brand/og-default.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/images/brand/og-default.jpg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,500&family=Manrope:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ErrorReporter />
        {children}
      </body>
    </html>
  );
}
