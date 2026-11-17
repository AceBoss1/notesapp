import type { Metadata, Viewport } from "next";
import { NANA_URL } from "@/lib/host";

export const viewport: Viewport = { themeColor: "#f7f0e7" };
export const metadata: Metadata = {
  title: { default: "Nana AI — Professional portraits for journals and profiles", template: "%s · Nana AI" },
  description: "Turn a favorite photo into a polished professional portrait for your journal or profile.",
  alternates: { canonical: NANA_URL },
  openGraph: { siteName: "Nana AI", title: "Nana AI — Professional portraits", description: "Turn a favorite photo into a polished professional portrait for your journal or profile.", images: ["/images/nana/nana.webp"] },
};

// Nana AI's own frame (not the NotesApp masthead). On nana.<domain> its pages are at the root; elsewhere under /nana-studio.
export default function NanaStudioLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#f7f0e7", minHeight: "100vh" }}>{children}</div>;
}
