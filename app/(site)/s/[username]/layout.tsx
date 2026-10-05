import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { getUserByUsername } from "@/lib/users";
import { MAIN_HOST, isMainHost } from "@/lib/host";
import { SiteProvider } from "@/components/site/SiteContext";
import SiteNav from "@/components/site/SiteNav";
import SiteAccount from "@/components/site/SiteAccount";

// A member's branded site (Enterprise custom domains): their name in the header, three pages — Home (profile and
// booking), Notes and Shop — and a "Powered by #NotesApp" footer. No #NotesApp navigation. On their own domain the
// URLs are /, /notes and /shop (middleware.ts rewrites them here); www.notesapp.name.ng/s/<username> previews it.
// `data-site-theme` is where future themes will plug in.
export const dynamic = "force-dynamic";

type Props = { children: React.ReactNode; params: { username: string } };

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const p = await getUserByUsername(params.username).catch(() => null);
  if (!p || p.suspended) return { title: "Not found" };
  const description = p.bio || `${p.displayName} — notes, bookings and shop.`;
  return {
    title: { default: p.displayName, template: `%s — ${p.displayName}` },
    description,
    openGraph: { siteName: p.displayName, title: p.displayName, description, images: [p.avatar] },
    twitter: { card: "summary_large_image", title: p.displayName, description, images: [p.avatar] },
  };
}

export default async function SiteLayout({ children, params }: Props) {
  const p = await getUserByUsername(params.username).catch(() => null);
  if (!p || p.suspended || p.uid.startsWith("admin:")) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="font-display text-2xl text-ink">This site isn&apos;t available.</p>
        <a href={`https://${MAIN_HOST}`} className="mt-4 inline-block text-sm text-crimson underline">Go to #NotesApp</a>
      </div>
    );
  }
  const host = (headers().get("host") || "").toLowerCase().replace(/:\d+$/, "");
  const base = isMainHost(host) ? `/s/${p.username}` : "";
  const info = {
    base, uid: p.uid, username: p.username, displayName: p.displayName, avatar: p.avatar, bio: p.bio, social: p.social || {},
  };
  return (
    <SiteProvider value={info}>
      <div data-site-theme="classic" className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link href={base || "/"} className="flex min-w-0 items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              <span className="truncate font-ui text-lg font-extrabold tracking-tight text-ink">{p.displayName}</span>
            </Link>
            <div className="flex shrink-0 items-center gap-5">
              <SiteNav />
              <SiteAccount />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-20 border-t border-rule bg-ink text-paper">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-4 py-8 sm:flex-row sm:items-center sm:px-6">
            <div>
              <p className="font-ui text-sm font-bold">{p.displayName}</p>
              <p className="mt-1 text-xs text-paper/55">© {new Date().getFullYear()} {p.displayName}. All rights reserved.</p>
            </div>
            <SiteNav footer />
          </div>
          <div className="border-t border-paper/10 py-4 text-center text-xs text-paper/55">
            <a href={`https://${MAIN_HOST}`} className="inline-flex items-center gap-2 hover:text-paper">
              <Image src="/images/brand/notesapp-icon.webp" alt="" width={16} height={16} className="h-4 w-4 rounded" />
              {p.displayName} is powered by <span className="font-semibold text-paper/80">#NotesApp</span>
            </a>
          </div>
        </footer>
      </div>
    </SiteProvider>
  );
}
