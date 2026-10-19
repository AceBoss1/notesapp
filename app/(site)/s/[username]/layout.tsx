import type { Metadata } from "next";
import { DEFAULT_AVATAR } from "@/lib/admin";
import { serviceName, servicesOf } from "@/lib/shipments";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { effectiveTier, getUserByUsername } from "@/lib/users";
import { getTierConfig } from "@/lib/tiers";
import { MAIN_HOST, isMainHost } from "@/lib/host";
import { domainForUid } from "@/lib/domains";
import { SiteProvider } from "@/components/site/SiteContext";
import { NameBadgeIcons } from "@/components/PersonName";
import { badgesOf } from "@/lib/name-badges";
import SiteNav from "@/components/site/SiteNav";
import SiteAccount from "@/components/site/SiteAccount";
import { SiteAuthProvider } from "@/components/site/SiteAuth";
import { isCrimsonTheme, siteThemeOf } from "@/lib/site-themes";
import { missingSitePages, siteSectionsOf } from "@/lib/site-settings";

// A member's branded site (Business and Enterprise custom domains): their name in the header, Home (profile, the sections they
// chose and booking), Notes and Shop (each only if chosen), About and Contact (once written), and a "Powered by #NotesApp" footer.
// No #NotesApp navigation. On their own domain the URLs are /, /notes, /shop, /about and /contact (middleware.ts rewrites them
// here); www.notesapp.name.ng/s/<username> previews it. `data-site-theme` is where themes plug in.
export const dynamic = "force-dynamic";

type Props = { children: React.ReactNode; params: { username: string } };

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const p = await getUserByUsername(params.username).catch(() => null);
  if (!p || p.suspended) return { title: "Not found" };
  const description = p.bio || `${p.displayName} — notes, bookings and shop.`;
  const images = p.avatar ? [p.avatar] : undefined; // an empty address would make a broken <link> and stop the page from loading
  return {
    title: { default: p.displayName, template: `%s — ${p.displayName}` },
    description,
    ...(p.avatar ? { icons: { icon: p.avatar } } : {}), // their logo is the tab icon
    openGraph: { siteName: p.displayName, title: p.displayName, description, images },
    twitter: { card: "summary_large_image", title: p.displayName, description, images },
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
  // No picture yet: the standard one, never an empty <img> (a broken image in the header, the profile and the footer).
  const avatar = p.avatar || DEFAULT_AVATAR;
  const host = (headers().get("host") || "").toLowerCase().replace(/:\d+$/, "");
  const base = isMainHost(host) ? `/s/${p.username}` : "";
  // Business: "Name is powered by [na] #NotesApp". Enterprise: "Name, powered by [na]" — just the icon.
  const fullLabel = getTierConfig(effectiveTier(p)).whiteLabel === "full";
  const domain = await domainForUid(p.uid).catch(() => null);
  const info = {
    base, uid: p.uid, username: p.username, displayName: p.displayName, avatar, bio: p.bio, social: p.social || {},
    home: (domain?.home === "store" ? "store" : "profile") as "profile" | "store",
    theme: siteThemeOf(p), isOrg: p.accountKind === "organisation",
    sections: siteSectionsOf(p),
    pages: { about: !missingSitePages(p).includes("about"), contact: !missingSitePages(p).includes("contact") },
    services: siteSectionsOf(p).track ? servicesOf(p).map(serviceName) : [],
  };
  const crimson = isCrimsonTheme(info.theme); // Aurora and Maroon: the crimson header
  const pic = info.isOrg ? "rounded-xl" : "rounded-full";
  // Enterprise on its own domain: sign-in and sign-up are a branded window on the site itself (not on the main-site preview).
  const ownDomainAuth = fullLabel && !isMainHost(host);
  const Auth = ownDomainAuth ? SiteAuthProvider : ({ children }: { children: React.ReactNode }) => <>{children}</>;
  return (
    <SiteProvider value={info}>
     <Auth>
      <div data-site-theme={info.theme} className="flex min-h-screen flex-col">
        <header className={crimson ? "sticky top-0 z-40 text-paper shadow-md" : "sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur"} style={crimson ? { backgroundImage: "linear-gradient(100deg, #4E0119 0%, #7A0328 70%, #A6093D 100%)" } : undefined}>
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link href={base || "/"} className="flex min-w-0 items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatar} alt="" className={`h-9 w-9 shrink-0 object-cover ${pic}`} />
              <span className={`truncate font-ui text-lg font-extrabold tracking-tight ${crimson ? "text-paper" : "text-ink"}`}>{p.displayName}</span>
              <NameBadgeIcons username={p.username} size={16} badges={badgesOf(p)} />
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
              <p className="mt-1 text-xs text-paper/55">
                © {new Date().getFullYear()} {p.displayName}. All rights reserved. ·{" "}
                <Link href={`${base}/terms`} className="underline hover:text-paper">Terms</Link> ·{" "}
                <Link href={`${base}/privacy`} className="underline hover:text-paper">Privacy</Link>
              </p>
            </div>
            <SiteNav footer />
          </div>
          <div className="border-t border-paper/10 py-4 text-center text-xs text-paper/55">
            <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatar} alt="" className="h-4 w-4 shrink-0 rounded object-cover" />
              <span>{fullLabel ? `${p.displayName}, powered by` : `${p.displayName} is powered by`}</span>
              <a href={`https://${MAIN_HOST}`} aria-label="#NotesApp" className="inline-flex items-center gap-1.5 font-semibold text-paper/80 hover:text-paper">
                <Image src="/images/brand/notesapp-icon.webp" alt="" width={16} height={16} className="h-4 w-4 rounded" />
                {!fullLabel && "#NotesApp"}
              </a>
            </p>
          </div>
        </footer>
      </div>
     </Auth>
    </SiteProvider>
  );
}
