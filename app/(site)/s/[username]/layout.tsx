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
import SiteBasketButton from "@/components/site/SiteBasketButton";
import { NameBadgeIcons } from "@/components/PersonName";
import { badgesOf } from "@/lib/name-badges";
import SiteNav from "@/components/site/SiteNav";
import SiteAccount from "@/components/site/SiteAccount";
import { SiteAuthProvider } from "@/components/site/SiteAuth";
import SiteDarkToggle from "@/components/site/SiteDarkToggle";
import { BAND_GRADIENT, SITE_DARK_KEY, canHaveSite, isCrimsonTheme, paletteVars, siteThemeOf, themeAllowed } from "@/lib/site-themes";
import { missingSitePages, siteSectionsShown } from "@/lib/site-settings";
import { buttonHref, emptyBlocks, resolveButton, visibleBlocks } from "@/lib/site-kits";
import { bookingOf, readSite } from "@/lib/site-server";
import { getAdminDb } from "@/lib/firebase-admin";

// A member's own site (Free Basic and above at /s/<username>; Business and Enterprise also on their own domain): their name in the header,
// Home (their banner and content sections, profile, the sections they chose and booking), Notes and Shop (each only if chosen), About and
// Contact (once written), and a "Powered by #NotesApp" footer. The look, colour set and sections are theirs (docs/SITES.md).
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
  // Free Basic and above have a site (lib/site-themes.ts canHaveSite); readers who don't publish don't.
  if (!p || p.suspended || p.uid.startsWith("admin:") || !canHaveSite(p)) {
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
  const tier = effectiveTier(p);
  const [domain, site, booking] = await Promise.all([
    domainForUid(p.uid).catch(() => null), readSite(getAdminDb(), p.uid).catch(() => null), bookingOf(getAdminDb(), p.uid).catch(() => ({ offered: false, hours: "" })),
  ]);
  const sections = siteSectionsShown(p);
  // A look the plan no longer covers (after a downgrade) falls back to Legacy.
  const chosen = siteThemeOf(p);
  const info = {
    base, uid: p.uid, username: p.username, displayName: p.displayName, avatar, bio: p.bio, social: p.social || {},
    home: (domain?.home === "store" ? "store" : "profile") as "profile" | "store",
    theme: themeAllowed(chosen, tier) ? chosen : "legacy" as const, isOrg: p.accountKind === "organisation",
    sections,
    pages: { about: !missingSitePages(p).includes("about"), contact: !missingSitePages(p).includes("contact") },
    services: sections.track ? servicesOf(p).map(serviceName) : [],
    blocks: site?.blocks ?? emptyBlocks(),
    shownBlocks: site ? visibleBlocks(site, tier) : [],
    booking,
    cover: site?.cover ?? "",
    kit: site?.kit ?? "",
  };
  const clean = info.theme === "clean";
  const scholar = info.theme === "scholar"; // plain and academic, with a dark mode
  // Clean: the main button of their banner sits at the top right of every page.
  const cta = clean && info.shownBlocks.includes("hero") ? resolveButton(info.blocks.hero.button, info.blocks.info) : null;
  const crimson = isCrimsonTheme(info.theme); // Aurora and Maroon: the crimson header
  const pic = info.isOrg ? "rounded-xl" : "rounded-full";
  // Enterprise on its own domain: sign-in and sign-up are a branded window on the site itself (not on the main-site preview).
  const ownDomainAuth = fullLabel && !isMainHost(host);
  const Auth = ownDomainAuth ? SiteAuthProvider : ({ children }: { children: React.ReactNode }) => <>{children}</>;
  return (
    <SiteProvider value={info}>
     <Auth>
      <div data-site-theme={info.theme} className="flex min-h-screen flex-col bg-paper" style={paletteVars(site?.palette, tier, info.theme) as React.CSSProperties} suppressHydrationWarning>
        {/* Scholar: light or dark before the first paint, from the visitor's last choice or their device's setting. */}
        {scholar && <script dangerouslySetInnerHTML={{ __html: `try{var e=document.currentScript.parentElement,v=localStorage.getItem(${JSON.stringify(SITE_DARK_KEY)});e.setAttribute("data-site-dark",v==="true"||v==="false"?v:String(matchMedia("(prefers-color-scheme: dark)").matches))}catch(_){}` }} />}
        {site?.announce && <p className="bg-ink px-4 py-2 text-center font-ui text-[11px] font-semibold uppercase tracking-[0.18em] text-paper sm:text-xs">{site.announce}</p>}
        <header className={crimson ? "sticky top-0 z-40 text-paper shadow-md" : clean ? "sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur" : "sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur"} style={crimson ? { backgroundImage: BAND_GRADIENT } : undefined}>
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link href={base || "/"} className="flex min-w-0 items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatar} alt="" className={`h-9 w-9 shrink-0 object-cover ${pic}`} />
              <span className={`truncate ${scholar ? "font-display text-xl" : "font-ui text-lg font-extrabold tracking-tight"} ${crimson ? "text-paper" : "text-ink"}`}>{p.displayName}</span>
              <NameBadgeIcons username={p.username} size={16} badges={badgesOf(p)} />
            </Link>
            <div className="flex shrink-0 items-center gap-5">
              <SiteNav />
              {info.sections.shop && <SiteBasketButton light={crimson} />}
              <SiteAccount />
              {scholar && <SiteDarkToggle />}
              {cta && <a href={buttonHref(cta, base)} className="hidden rounded-full bg-crimson px-4 py-2 font-ui text-sm font-bold text-paper hover:bg-crimson-bright sm:inline-flex" {...(cta.kind === "link" ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{cta.label}</a>}
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer data-site-footer className="mt-20 border-t border-rule bg-ink text-paper">
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
