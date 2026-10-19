import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { AD_FOOTER, AD_PLACEMENTS, type AdPlacement } from "@/lib/ads";
import { AD_IMAGE, AD_TEXT_MAX, AD_TITLE_MAX, BILLBOARD_IMAGE, spotOn } from "@/lib/ad-config";
import { adConfig } from "@/lib/ad-config-server";

export const metadata: Metadata = {
  title: "Advert sizes and spots",
  description: "Where adverts and boosts show on #NotesApp, in the weekly digest and in Notes Life, and how to make the picture: 1200 × 628 px, the safe area, the words, the billboard size and how impressions are counted.",
  alternates: { canonical: "/advertise/specifications" },
};
export const revalidate = 300; // the rotation numbers come from Admin → Ads

const kb = (n: number) => `${Math.round(n / 1024)} KB`;
const NEVER = ["Messages and calls", "Checkout and payment pages", "Course lessons, paid course pages and certificates", "The journal, course and store editors", "Account and settings pages"];

export default async function AdSpecsPage() {
  const c = await adConfig();
  const spots = (Object.keys(AD_PLACEMENTS) as AdPlacement[]).filter((p) => spotOn(c, p));
  const row = (k: string, v: React.ReactNode) => (
    <tr key={k} className="border-b border-rule align-top"><th scope="row" className="py-2.5 pr-4 text-left font-ui font-semibold text-ink sm:w-56">{k}</th><td className="py-2.5 text-slate">{v}</td></tr>
  );
  return (
    <>
      <PageHero eyebrow="Advertise · Specifications" title={<>Where your advert shows, and how to make it</>}>
        <p>One picture size works everywhere on #NotesApp: the site, the app and the weekly digest. Campaigns that also run in Notes Life add a billboard picture.</p>
      </PageHero>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm text-slate"><Link href="/advertise/new" className="font-semibold text-crimson">Start a campaign</Link> · <Link href="/advertise" className="text-crimson underline">Advertising and prices</Link> · <Link href="/boost" className="text-crimson underline">Boost a post or item</Link></p>

        <h2 id="picture" className="mt-10 scroll-mt-24 font-display text-2xl text-ink">The advert picture</h2>
        <table className="mt-4 w-full text-sm"><tbody>
          {row("Best size", <><strong className="text-ink">{AD_IMAGE.width} × {AD_IMAGE.height} px</strong> (1.91 : 1), the same shape LinkedIn, X and Facebook use for link pictures</>)}
          {row("Sharpest", `${AD_IMAGE.sharpWidth} × ${AD_IMAGE.sharpHeight} px, for high-density phone and laptop screens`)}
          {row("Smallest accepted", `${AD_IMAGE.minWidth} × ${AD_IMAGE.minHeight} px; anything smaller is refused`)}
          {row("Other shapes", "The campaign form asks you to crop to 1.91 : 1 before you pay; nothing is cropped for you later")}
          {row("File", `JPG, PNG or WebP; best under ${kb(AD_IMAGE.bestBytes)}, at most 1 MB. The form saves a light copy so pages stay light on data`)}
          {row("Safe area", `Keep the logo, words and faces in the middle ${AD_IMAGE.safe.width} × ${AD_IMAGE.safe.height} px (the centre 80%)`)}
          {row("Words on the picture", "No more than about a fifth of it, and letters at least 40 px tall at 1200 wide: a phone shows the advert about a third of that size")}
          {row("Don't add", `Borders, fake buttons, a "Sponsored" label or a play icon. We add the frame, the "${AD_FOOTER.notesapp}" label and the Learn more button`)}
          {row("Colour", "sRGB; check it looks right on a light and a dark background")}
          {row("Template", <a href="/api/ads/template" className="font-semibold text-crimson underline">Download the {AD_IMAGE.width} × {AD_IMAGE.height} template (PNG, safe area marked)</a>)}
        </tbody></table>

        <h2 id="words" className="mt-10 scroll-mt-24 font-display text-2xl text-ink">The words</h2>
        <table className="mt-4 w-full text-sm"><tbody>
          {row("Headline", `Up to ${AD_TITLE_MAX} characters`)}
          {row("Text", `Up to ${AD_TEXT_MAX} characters (optional): two lines on a phone, one or two on a computer`)}
          {row("Link", "An https:// address; it opens in a new tab")}
          {row("Rules", <>What we don&apos;t run is on the campaign form and in the <Link href="/terms" className="text-crimson underline">Terms</Link>. We review every advert before it goes live; if we can&apos;t run it you&apos;re refunded in full</>)}
        </tbody></table>

        <h2 id="billboard" className="mt-10 scroll-mt-24 font-display text-2xl text-ink">Notes Life billboards (optional)</h2>
        <p className="mt-3 text-sm text-slate">Tick <strong className="text-ink">{AD_PLACEMENTS.life.label}</strong> on the campaign form if you want your advert in the game too: it stands on a roadside billboard in Notesville, and players can tap it to open your link. It needs its own picture:</p>
        <table className="mt-4 w-full text-sm"><tbody>
          {row("Size", <><strong className="text-ink">{BILLBOARD_IMAGE.width} × {BILLBOARD_IMAGE.height} px</strong> (16 : 9), at least {BILLBOARD_IMAGE.minWidth} × {BILLBOARD_IMAGE.minHeight}</>)}
          {row("Safe area", `The middle ${BILLBOARD_IMAGE.safe.width} × ${BILLBOARD_IMAGE.safe.height} px`)}
          {row("What works", "Big words (three to six), one bold picture and strong colours: players see it from the road, often on a phone")}
          {row("File", `JPG, PNG or WebP, best under ${kb(BILLBOARD_IMAGE.bestBytes)}, at most 1 MB`)}
          {row("Template", <a href="/api/ads/template?kind=billboard" className="font-semibold text-crimson underline">Download the {BILLBOARD_IMAGE.width} × {BILLBOARD_IMAGE.height} template</a>)}
        </tbody></table>
        <p className="mt-2 text-xs text-slate">Our partners&apos; own boards in the game keep their sizes (wide 1600 × 900, portrait 1080 × 1350, square 1080 × 1080); see <Link href="/life/partners" className="text-crimson underline">Partner with Notes Life</Link>.</p>

        <h2 id="spots" className="mt-10 scroll-mt-24 font-display text-2xl text-ink">Where adverts show</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {spots.map((p) => <li key={p} className="card p-3"><p className="font-ui font-semibold text-ink">{AD_PLACEMENTS[p].label}</p><p className="mt-0.5 text-slate">{AD_PLACEMENTS[p].where}</p></li>)}
        </ul>
        <p className="mt-4 text-sm font-semibold text-ink">Never shown in</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate">{NEVER.map((n) => <li key={n}>{n}</li>)}</ul>

        <h2 id="rotation" className="mt-10 scroll-mt-24 font-display text-2xl text-ink">Rotation and counting</h2>
        <table className="mt-4 w-full text-sm"><tbody>
          {row("Adverts", `When a spot has more than one advert, each stays ${c.adRotateSec} seconds, and only moves on while it's on screen`)}
          {row("Boosts", `${c.boostsWide} at a time on a computer or tablet and ${c.boostsPhone} on a phone; each set stays ${c.boostRotateSec} seconds, pausing while the pointer is over it`)}
          {row("Journal feed", `${c.feedPromoted} promoted posts between the posts, marked Promoted`)}
          {row("Weekly digest", `${c.digestSlots} sponsored slots: after the 2nd journal a boosted journal, after the 6th an advert, near the end a boosted store item or an advert`)}
          {row("An impression", "Once at least half of the advert has been on screen; one per person per advert per day, bots and previews left out. A boost counts after 1 second on screen")}
          {row("In the digest", "Each email sent counts as one impression, and each click from it counts as a click")}
          {row("Undelivered", "Impressions not delivered by the campaign's end date are refunded pro rata")}
        </tbody></table>
      </div>
    </>
  );
}
