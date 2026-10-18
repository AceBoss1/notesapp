import ErrorReporter from "@/components/ErrorReporter";
import type { Metadata, Viewport } from "next";
import { SITE, WHAT_IS_NOTESAPP } from "@/lib/site";
import "./globals.css";
import { unstable_cache } from "next/cache";
import PricingHydrator from "@/components/PricingHydrator";
import { getAdminDb } from "@/lib/firebase-admin";
import { applyPricing, cleanPricing, type PricingConfig } from "@/lib/pricing";

// The prices an admin set on /admin/pricing, read at most once a minute (and refreshed when they save). Without any (or if the read fails)
// the built-in defaults apply, so a Firestore hiccup can never take a page down.
const savedPricing = unstable_cache(
  async (): Promise<PricingConfig | null> => {
    try {
      const saved = (await getAdminDb().doc("platformSettings/pricing").get()).data()?.config;
      return saved ? cleanPricing(saved) : null;
    } catch {
      return null;
    }
  },
  ["platform-pricing"],
  { revalidate: 60, tags: ["pricing"] },
);

const DEFAULT_TITLE = "#NotesApp — Publish. Book. Get Paid. One Workspace.";
const DEFAULT_DESCRIPTION = WHAT_IS_NOTESAPP;

export const viewport: Viewport = { themeColor: "#7A0328" };

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: DEFAULT_TITLE,
    template: "%s — #NotesApp",
  },
  description: DEFAULT_DESCRIPTION,
  icons: { icon: "/images/brand/notesapp-icon.webp", apple: "/images/brand/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "NotesApp", statusBarStyle: "default" },
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pricing = await savedPricing();
  if (pricing) applyPricing(pricing); // this server render's own copy (the client copy is set by PricingHydrator)
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
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,500&family=Manrope:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Mrs+Saint+Delafield&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ErrorReporter />
        <PricingHydrator config={pricing}>{children}</PricingHydrator>
      </body>
    </html>
  );
}
