import Link from "next/link";
import Image from "next/image";
import Masthead from "@/components/shell/Masthead";
import BottomTabs from "@/components/shell/BottomTabs";
import { AppFrame, ChromeGate, FooterGate } from "@/components/shell/Frame";
import { MemberProvider } from "@/lib/member-client";
import VerifyEmailBanner from "@/components/VerifyEmailBanner";
import WorkPrompt from "@/components/WorkPrompt";
import NanaChat from "@/components/NanaChat";
import FooterCta from "@/components/FooterCta";
import PushPrompt from "@/components/messages/PushPrompt";
import PresenceBeat from "@/components/PresenceBeat";
import CallManager from "@/components/calls/CallManager";
import PayChooser from "@/components/PayChooser";
import CelebrationBanner from "@/components/CelebrationBanner";
import ChallengeBanner from "@/components/ChallengeBanner";
import RememberReturn from "@/components/RememberReturn";
import { getSiteSettingsCached } from "@/lib/settings";
import { COMPANY_INFO, DISCORD_LABEL, SITE } from "@/lib/site";
import { DiscordIcon, FacebookIcon, LinkedInIcon, MailIcon, NotesAppIcon } from "@/components/ContactIcons";
import PartnerIcon from "@/components/PartnerIcon";
import { ROOT_DOMAIN } from "@/lib/host";

// Contact is in the footer and on About.
const NAV = [
  { href: "/journals", label: "Journals" },
  { href: "/shop", label: "Market" },
  { href: "/academy", label: "Academy" },
  { href: "/trending", label: "Trending" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

// On the app domain (notesapp.ng) the masthead carries only the app.
const APP_NAV = [
  { href: "/journals", label: "Journals" },
  { href: "/shop", label: "Market" },
  { href: "/academy", label: "Academy" },
  { href: "/messages", label: "Messages" },
  { href: "/bookings", label: "Bookings" },
  { href: "/trending", label: "Trending" },
];

// The footer's link columns, in the owner's order (19 Oct 2026). The first column (logo, partners, contacts, Terms | Privacy)
// is written out in the footer itself.
const PRODUCT = [
  { href: "/journals", label: "Journals" },
  { href: "/shop", label: "Notes Market" },
  { href: "/academy", label: "Notes Academy" },
  { href: "/booking", label: "Booking" },
  { href: "/boost", label: "Boost" },
  { href: "/coauthoring", label: "Co-authoring" },
  { href: "/badges", label: "Verification badges" },
  { href: "/advertise", label: "Advertise" },
  { href: "/organisations", label: "Organisations" },
  { href: "/events", label: "Events" },
  { href: "/store-selling", label: "Store selling" },
  { href: "/logistics", label: "Logistics" },
  { href: "/logistics/network", label: "Logistics network" },
];
const COMPANY = [
  { href: "/brand", label: "Brand" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
  { href: "/pricing", label: "Pricing" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/status", label: "Status" },
  { href: "/docs", label: "API Docs" },
  { href: "/changelog", label: "Changelog" },
  { href: "/security", label: "Trust & Security" },
  { href: "/teams", label: "Team hub" },
  { href: "/domains", label: "Buy Domains" },
  { href: "/merchstore", label: "Merch Store" },
  { href: "/challenge", label: "#1MillionNairaNotes" },
];
// Calls are end-to-end encrypted, so the footer says so; both land on /calls.
const CONNECT = [
  { href: "/gifts", label: "Gifts" },
  { href: "/nana", label: "Nana AI" },
  { href: "/help", label: "Help centre" },
  { href: "/community#spaces", label: "Spaces" },
  { href: "/community#circles", label: "Circles" },
  { href: "/community", label: "Community" },
  { href: "/calls#one-to-one", label: "Encrypted 1-on-1 calls" },
  { href: "/calls#group", label: "Encrypted group calls" },
  { href: "/explore", label: "Explore" },
  { href: "/trending", label: "Trending" },
  { href: "/track", label: "Track a Parcel" },
  { href: "/certificates", label: "Check a certificate" },
  { href: "/life", label: "Want to pass time; try Notes Life" },
];

// The #NotesApp masthead and footer. The members' branded sites live in app/(site) and don't get these.
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
const site = await getSiteSettingsCached();
  const social = [
    { label: "LinkedIn", href: site.social.linkedin },
    { label: "Facebook", href: site.social.facebook },
    { label: "Instagram", href: site.social.instagram },
    { label: "X / Twitter", href: site.social.twitter },
    { label: "WhatsApp", href: site.whatsapp },
    { label: "Website", href: site.social.website },
  ].filter((l) => !!l.href);

  return (
    <MemberProvider>
        <RememberReturn />
        <ChromeGate>
          <CelebrationBanner />
          <ChallengeBanner />
          <VerifyEmailBanner />
          <WorkPrompt />
          <PushPrompt />
        </ChromeGate>
        <PresenceBeat />
        <CallManager />
        <PayChooser />
        <Masthead links={NAV} appLinks={APP_NAV} />

        <main><AppFrame>{children}</AppFrame></main>

        {/* Footer */}
        <FooterGate>
        <footer className="mt-24 bg-crimson-deep text-paper" style={{ backgroundImage: "linear-gradient(160deg, #4E0119 0%, #7A0328 100%)" }}>
          <FooterCta />
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:gap-10 sm:px-6 sm:py-16 lg:grid-cols-4 lg:px-8">
            <div className="col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/images/brand/notesapp-icon.webp"
                  alt="#NotesApp"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-lg"
                />
                <span className="font-ui text-lg font-extrabold">
                  Notes<span className="text-crimson-bright">App</span>
                </span>
              </div>
              <p className="mt-4 max-w-xs text-sm text-paper/65">
                Publish, connect and get paid in Naira — one home for
                African creators, professionals and businesses.
              </p>
              <p className="mt-6 max-w-xs text-sm text-paper/50">
                Built in partnership with <PartnerIcon partner="precheks" /> Precheks (journal) and{" "}
                <PartnerIcon partner="apexglitz" /> ApexGlitz (shop) — our first reference customers. —{" "}
                <Link href="/admin/login" className="text-paper/70 hover:text-paper">
                  Staff Login
                </Link>
              </p>
              <ul className="mt-6 space-y-2 text-sm text-paper/75">
                <li>
                  <a href={`mailto:${site.email}`} className="inline-flex items-center gap-2 hover:text-paper">
                    <MailIcon /> {site.email}
                  </a>
                </li>
                {site.social.linkedin && (
                  <li>
                    <a href={site.social.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-paper">
                      <LinkedInIcon /> {site.social.linkedin.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  </li>
                )}
                {site.social.facebook && (
                  <li>
                    <a href={site.social.facebook} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-paper">
                      <FacebookIcon /> {site.social.facebook.replace(/^https?:\/\/(www\.|web\.)?/, "")}
                    </a>
                  </li>
                )}
                <li>
                  <a href={SITE.discord} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-paper">
                    <DiscordIcon /> {DISCORD_LABEL}
                  </a>
                </li>
                <li>
                  <Link href="/u/na-notesapp" className="inline-flex items-center gap-2 hover:text-paper">
                    <NotesAppIcon /> {ROOT_DOMAIN}/u/na-notesapp
                  </Link>
                </li>
                {social.filter((l) => !["LinkedIn", "Facebook"].includes(l.label)).map((l) => (
                  <li key={l.label}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="hover:text-paper">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-paper/75">
                <Link href="/terms" className="hover:text-paper">Terms</Link>
                <span className="mx-2 text-paper/40" aria-hidden>|</span>
                <Link href="/privacy" className="hover:text-paper">Privacy</Link>
              </p>
            </div>

            {([["Product", PRODUCT], ["Company", COMPANY], ["Connect", CONNECT]] as const).map(([title, items]) => (
              <div key={title}>
                <p className="eyebrow text-crimson-bright/90">{title}</p>
                <ul className="mt-4 space-y-2 text-sm text-paper/75">
                  {items.map((item) => (
                    <li key={item.label}>
                      <Link href={item.href} className="hover:text-paper">{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-paper/10 py-5 text-center text-xs text-paper/45">
            <p>© {new Date().getFullYear()} #NotesApp. All rights reserved.</p>
            <p className="mt-1 inline-flex flex-wrap items-center justify-center gap-1.5">
              <NotesAppIcon />
              {COMPANY_INFO.legalName} · RC {COMPANY_INFO.rcNumber} · TIN {COMPANY_INFO.tin}
              {COMPANY_INFO.smedanId ? ` · SMEDAN ${COMPANY_INFO.smedanId}` : ""}
            </p>
          </div>
        </footer>
        </FooterGate>
      <BottomTabs />
      <NanaChat />
    </MemberProvider>
  );
}
