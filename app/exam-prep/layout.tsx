import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { isPrepHost, PREP_URL, SITE_URL } from "@/lib/host";
import { PREP_NAME, PREP_TAGLINE } from "@/lib/exam-prep";
import { PrepBase } from "@/lib/exam-prep-client";
import PrepChrome from "@/components/exam-prep/PrepChrome";

export const viewport: Viewport = { themeColor: "#0F2747" };
export const metadata: Metadata = {
  title: { default: `${PREP_NAME}: JAMB, WAEC and NECO practice`, template: `%s · ${PREP_NAME}` },
  description: `${PREP_TAGLINE} Free JAMB, WAEC and NECO practice questions with explanations, timed mocks and packs you can use offline. By NotesApp.`,
  alternates: { canonical: PREP_URL },
  openGraph: { siteName: PREP_NAME, title: PREP_NAME, description: PREP_TAGLINE, images: ["/images/exam-prep/icon-512.png"] },
  icons: { icon: [{ url: "/images/exam-prep/favicon-48.png", sizes: "48x48", type: "image/png" }, { url: "/images/exam-prep/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/images/exam-prep/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Exam Prep", statusBarStyle: "default" },
};

// Exam Prep's own frame (not the NotesApp masthead). On prep.<domain> its pages are at the root; elsewhere under /exam-prep.
export default function PrepLayout({ children }: { children: React.ReactNode }) {
  const host = headers().get("host") || "";
  return (
    <PrepBase base={isPrepHost(host) ? "" : "/exam-prep"}>
      {/* The wordmark's rounded type, for Exam Prep pages only */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&display=swap" />
      <PrepChrome mainUrl={SITE_URL}>{children}</PrepChrome>
    </PrepBase>
  );
}
