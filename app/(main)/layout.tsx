import Link from "next/link";
import CurrencyPicker from "@/components/CurrencyPicker";
import Image from "next/image";
import Masthead from "@/components/shell/Masthead";
import BottomTabs from "@/components/shell/BottomTabs";
import { AppFrame, ChromeGate, FooterGate } from "@/components/shell/Frame";
import { MemberProvider } from "@/lib/member-client";
import VerifyEmailBanner from "@/components/VerifyEmailBanner";
import CouponReminder from "@/components/CouponReminder";
import WorkPrompt from "@/components/WorkPrompt";
import TimeCheck from "@/components/TimeCheck";
import KidGuard from "@/components/KidGuard";
import AdultOnly from "@/components/AdultOnly";
import EighteenBanner from "@/components/EighteenBanner";
import NanaChat from "@/components/NanaChat";
import FooterCta from "@/components/FooterCta";
import PushPrompt from "@/components/messages/PushPrompt";
import PresenceBeat from "@/components/PresenceBeat";
import CallManager from "@/components/calls/CallManager";
import PayChooser from "@/components/PayChooser";
import GiftOverlay from "@/components/GiftOverlay";
import GiftBurstBanner from "@/components/GiftBurstBanner";
import CelebrationBanner from "@/components/CelebrationBanner";
import ChallengeBanner from "@/components/ChallengeBanner";
import RememberReturn from "@/components/RememberReturn";
import { getSiteSettingsCached } from "@/lib/settings";
import { COMPANY_INFO, DISCORD_LABEL, SITE } from "@/lib/site";
import { DiscordIcon, FacebookIcon, GlobeIcon, InstagramIcon, LinkedInIcon, NotesAppIcon, WhatsAppIcon, XIcon } from "@/components/ContactIcons";
import FooterActions from "@/components/shell/FooterActions";
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

// The footer's link groups (owner, 19 Nov 2026: "rearrange the footer like ContiSX's, with dropdowns to group the menus"). Every link from
// the old Product, Company and Connect columns is here, in themed groups; Notes Arcade sits below Notes Life. On a phone each group is a
// dropdown; on a wide screen, a column. The legal pages sit in the Legal dropdown at the bottom.
type FooterLink = { href: string; label: string };
const FOOTER_GROUPS: { title: string; items: FooterLink[] }[] = [
  { title: "Products", items: [
    { href: "/journals", label: "Journals" }, { href: "/shop", label: "Notes Market" }, { href: "/academy", label: "Notes Academy" },
    { href: "/booking", label: "Booking" }, { href: "/events", label: "Events" }, { href: "/lives", label: "Paid lives" },
    { href: "/ppm", label: "Pay-per-minute sessions" }, { href: "/gifts", label: "Gifts" }, { href: "/boost", label: "Boost" },
    { href: "/coauthoring", label: "Co-authoring" }, { href: "/badges", label: "Verification badges" }, { href: "/nana", label: "Nana AI" },
  ] },
  { title: "Business", items: [
    { href: "/organisations", label: "Organisations" }, { href: "/store-selling", label: "Store selling" }, { href: "/hotels", label: "Hotel kit" },
    { href: "/logistics", label: "Logistics" }, { href: "/logistics/network", label: "Logistics network" }, { href: "/advertise", label: "Advertise" },
    { href: "/affiliates", label: "Affiliates" }, { href: "/partners", label: "Partner Network" }, { href: "/partners/directory", label: "Find a partner" },
    { href: "/help/discount-codes", label: "Discount codes & coupons" }, { href: "/domains", label: "Buy Domains" }, { href: "/teams", label: "Team hub" },
  ] },
  { title: "Community", items: [
    { href: "/community", label: "Community" }, { href: "/community/general", label: "General channel" }, { href: "/community/spaces", label: "Spaces" },
    { href: "/community/circles", label: "Circles" }, { href: "/community/audio-rooms", label: "Audio rooms" }, { href: "/community/events", label: "Community events" },
    { href: "/community#giving", label: "Community giving" }, { href: "/calls#one-to-one", label: "Encrypted 1-on-1 calls" }, { href: "/calls#group", label: "Encrypted group calls" },
    { href: "/explore", label: "Explore" }, { href: "/trending", label: "Trending" },
  ] },
  { title: "For you", items: [
    { href: "/my-cycle", label: "My Cycle" }, { href: "/my-calendar", label: "My Calendar" }, { href: "/tickets", label: "My tickets" },
    { href: "/giving", label: "My giving" }, { href: "/profile/coupons", label: "My coupons" }, { href: "/track", label: "Track a Parcel" },
    { href: "/certificates", label: "Check a certificate" }, { href: "/help", label: "Help centre" },
  ] },
  { title: "Devices & play", items: [
    { href: "/devices", label: "Notes Smart Devices" }, { href: "/anya", label: "Anya smart glasses" },
    { href: "/life", label: "Want to pass time; try Notes Life" }, { href: "/snake", label: "Notes Arcade" },
    { href: "/merchstore", label: "Merch Store" }, { href: "/challenge", label: "#1MillionNairaNotes" },
  ] },
  { title: "Company", items: [
    { href: "/about", label: "About Us" }, { href: "/brand", label: "Brand" }, { href: "/careers", label: "Careers" },
    { href: "/explore?tab=jobs", label: "Notes Jobs" }, { href: "/nana-jobs", label: "Nana Jobs" }, { href: "/ventures", label: "Ventures: Rewrite the Playbook" },
    { href: "/pricing", label: "Pricing" }, { href: "/roadmap", label: "Roadmap" }, { href: "/status", label: "Status" },
    { href: "/changelog", label: "Changelog" }, { href: "/docs", label: "API Docs" }, { href: "/contact", label: "Contact" },
  ] },
];
const LEGAL: FooterLink[] = [
  { href: "/terms", label: "Terms of Service" }, { href: "/privacy", label: "Privacy Policy" },
  { href: "/content-rules", label: "Content rules" }, { href: "/security", label: "Trust & Security" },
];

// The #NotesApp masthead and footer. The members' branded sites live in app/(site) and don't get these.
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
const site = await getSiteSettingsCached();

  return (
    <MemberProvider>
        <RememberReturn />
        <ChromeGate>
          <AdultOnly><CelebrationBanner /></AdultOnly>
          <AdultOnly><ChallengeBanner /></AdultOnly>
          <AdultOnly><VerifyEmailBanner /></AdultOnly>
          <KidGuard />
          <EighteenBanner />
          <AdultOnly><CouponReminder /></AdultOnly>
          <AdultOnly><WorkPrompt /></AdultOnly>
          <TimeCheck />
          <AdultOnly><PushPrompt /></AdultOnly>
        </ChromeGate>
        <PresenceBeat />
        <CallManager />
        <PayChooser />
        <GiftOverlay />
        <GiftBurstBanner />
        <Masthead links={NAV} appLinks={APP_NAV} />

        <main><AppFrame>{children}</AppFrame></main>

        {/* Footer */}
        <FooterGate>
        <footer className="mt-24 bg-crimson-deep text-paper" style={{ backgroundImage: "linear-gradient(160deg, #4E0119 0%, #7A0328 100%)" }}>
          <FooterCta />
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            {/* The brand, what we are, and how to reach us (owner, 19 Nov 2026: laid out like ContiSX's footer). */}
            <div className="max-w-xl">
              <div className="flex items-center gap-2.5">
                <Image src="/images/brand/notesapp-icon.webp" alt="#NotesApp" width={40} height={40} className="h-10 w-10 rounded-xl" />
                <span className="font-ui text-2xl font-extrabold">Notes<span className="text-crimson-bright">App</span></span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-paper/70">Publish, connect and get paid in your local currency — one home for African creators, professionals and businesses.</p>
              <p className="mt-4 text-sm text-paper/55">
                Built in partnership with <PartnerIcon partner="precheks" /> Precheks (journal) and <PartnerIcon partner="apexglitz" /> ApexGlitz (shop) — our first reference customers. —{" "}
                <Link href="/admin/login" className="text-paper/75 hover:text-paper">Staff Login</Link>
              </p>
              <p className="mt-4 text-sm text-paper/75"><span className="font-semibold text-paper">Email:</span>{" "}<a href={`mailto:${site.email}`} className="underline decoration-paper/30 underline-offset-2 hover:text-paper">{site.email}</a></p>
              <p className="mt-1 text-sm text-paper/75"><span className="font-semibold text-paper">#NotesApp:</span>{" "}<Link href="/u/na-notesapp" className="underline decoration-paper/30 underline-offset-2 hover:text-paper">{ROOT_DOMAIN}/u/na-notesapp</Link></p>
            </div>

            {/* The link groups: each folds into a dropdown on a phone, and stands as a column on a wide screen. */}
            <div className="mt-10 lg:hidden">
              {FOOTER_GROUPS.map((g) => (
                <details key={g.title} className="group border-b border-paper/10">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-5 font-mono text-sm font-semibold uppercase tracking-[0.22em] text-paper/90 marker:hidden [&::-webkit-details-marker]:hidden">
                    {g.title}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-paper/60 transition-transform group-open:rotate-180" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
                  </summary>
                  <ul className="grid gap-x-6 gap-y-2.5 pb-5 text-sm text-paper/75 sm:grid-cols-2">
                    {g.items.map((item) => <li key={item.label}><Link href={item.href} className="hover:text-paper">{item.label}</Link></li>)}
                  </ul>
                </details>
              ))}
            </div>
            <div className="mt-12 hidden gap-8 lg:grid lg:grid-cols-6">
              {FOOTER_GROUPS.map((g) => (
                <div key={g.title} className="min-w-0">
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-paper/60">{g.title}</p>
                  <ul className="mt-4 space-y-2 text-sm text-paper/75">
                    {g.items.map((item) => <li key={item.label}><Link href={item.href} className="hover:text-paper">{item.label}</Link></li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-paper/10">
            <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
              <p className="text-sm text-paper/60">© {new Date().getFullYear()} #NotesApp. All rights reserved.</p>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-paper/75">
                  {site.social.twitter && <a href={site.social.twitter} target="_blank" rel="noopener noreferrer" aria-label="X" className="hover:text-paper"><XIcon size={20} /></a>}
                  {site.social.linkedin && <a href={site.social.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="hover:text-paper"><LinkedInIcon size={20} /></a>}
                  {site.social.facebook && <a href={site.social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="hover:text-paper"><FacebookIcon size={20} /></a>}
                  {site.social.instagram && <a href={site.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:text-paper"><InstagramIcon size={20} /></a>}
                  {site.whatsapp && <a href={site.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="hover:text-paper"><WhatsAppIcon size={20} /></a>}
                  <a href={SITE.discord} target="_blank" rel="noopener noreferrer" aria-label={DISCORD_LABEL} className="hover:text-paper"><DiscordIcon size={20} /></a>
                  {site.social.website && <a href={site.social.website} target="_blank" rel="noopener noreferrer" aria-label="Website" className="hover:text-paper"><GlobeIcon size={20} /></a>}
                  <details className="relative">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm hover:text-paper [&::-webkit-details-marker]:hidden">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 3 5 6v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6l-7-3Z" /></svg>
                      Legal
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
                    </summary>
                    <ul className="absolute bottom-full left-0 z-20 mb-2 w-56 space-y-1 rounded-xl bg-paper p-2 text-sm text-ink shadow-xl">
                      {LEGAL.map((l) => <li key={l.href}><Link href={l.href} className="block rounded-lg px-3 py-2 hover:bg-field">{l.label}</Link></li>)}
                    </ul>
                  </details>
                </div>
                <FooterActions />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-paper/45">
                <p className="inline-flex flex-wrap items-center gap-1.5">
                  <NotesAppIcon />
                  {COMPANY_INFO.legalName} · RC {COMPANY_INFO.rcNumber} · TIN {COMPANY_INFO.tin}
                  {COMPANY_INFO.smedanId ? ` · SMEDAN ${COMPANY_INFO.smedanId}` : ""}
                </p>
                <CurrencyPicker />
              </div>
            </div>
          </div>
        </footer>
        </FooterGate>
      <BottomTabs />
      <AdultOnly><NanaChat /></AdultOnly>
    </MemberProvider>
  );
}
