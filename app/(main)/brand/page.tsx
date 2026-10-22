import Image from "next/image";
import type { Metadata } from "next";
import { SEASONAL } from "@/lib/brand-marks";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import BrandPackDownload from "@/components/BrandPackDownload";
import { BRAND_FAQ, BRAND_GENERAL, BRAND_INTRO, BRAND_LEGAL, BRAND_PACK, BRAND_PROHIBITED } from "@/lib/brand-guidelines";

const SECTIONS = [["introduction", "Introduction"], ["marks", "Marks"], ["guidelines", "General guidelines"], ["logo-pack", "Logo pack"], ["prohibited", "Prohibited uses"], ["faq", "FAQ"], ["legal", "Legal"]] as const;

export const metadata: Metadata = {
  title: "Brand",
  description:
    "The #NotesApp brand system — primary mark, palette, every seasonal/festival logo variant, usage notes, guidelines, the logo pack, prohibited uses, FAQ and legal.",
};


export default function BrandPage() {
  return (
    <>
      <PageHero eyebrow="Company / Brand" title={<>The #NotesApp mark</>}>
        <p>Our logo is the "na" monogram — a red, rounded square that reads
        as a notepad tab. It appears in two forms: the standalone icon
        (app tiles, favicons, avatars) and the full wordmark (site
        headers, decks, printed material). Below is every approved
        variant, including the seasonal marks we use across the
        Nigerian calendar.</p>
      </PageHero>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">

      <nav aria-label="On this page" className="flex flex-wrap gap-2">
        {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-full border border-rule px-3 py-1 font-ui text-xs font-semibold text-ink hover:border-crimson hover:text-crimson">{label}</a>)}
      </nav>

      {/* Introduction */}
      <section id="introduction" className="mt-10 scroll-mt-24">
        <p className="eyebrow">Introduction</p>
        {BRAND_INTRO.map((p) => <p key={p} className="mt-3 max-w-3xl text-sm text-slate">{p}</p>)}
      </section>

      {/* Primary marks */}
      <div id="marks" className="mt-14 scroll-mt-24 grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div className="card p-8 text-center">
          <div className="mx-auto flex h-40 items-center justify-center">
            <Image
              src="/images/brand/notesapp-icon.webp"
              alt="#NotesApp icon"
              width={140}
              height={140}
              className="h-[140px] w-[140px] rounded-2xl"
            />
          </div>
          <p className="mt-4 font-ui text-sm font-semibold text-ink">
            Icon mark
          </p>
          <p className="mt-1 text-xs text-slate">
            Use for favicons, app tiles, avatars, anywhere space is tight.
          </p>
        </div>
        <div className="card flex flex-col items-center justify-center p-8 text-center">
          <div className="mx-auto flex h-40 items-center justify-center">
            <Image
              src="/images/brand/notesapp-logo-full.webp"
              alt="#NotesApp full logo"
              width={260}
              height={140}
              className="object-contain"
            />
          </div>
          <p className="mt-4 font-ui text-sm font-semibold text-ink">
            Full wordmark
          </p>
          <p className="mt-1 text-xs text-slate">
            Use in headers, decks, and anywhere the name needs to be read.
          </p>
        </div>
      </div>

      {/* Campaign graphic */}
      <div className="mt-14">
        <p className="eyebrow">Campaign graphic</p>
        <div className="card mt-5 overflow-hidden">
          <div className="flex items-center justify-center bg-white p-4 sm:p-8">
            <Image
              src="/images/brand/challenge-graphic.webp"
              alt="#1MillionNairaNotesAppChallenge: ₦10m up for grabs this month, with a creator going live on a phone"
              width={1536}
              height={1024}
              className="h-auto w-full max-w-2xl object-contain"
            />
          </div>
          <p className="border-t border-rule px-4 py-3 font-ui text-sm font-semibold text-ink">#1MillionNairaNotesAppChallenge</p>
          <p className="px-4 pb-4 text-xs text-slate">
            The challenge artwork: for the challenge page, social posts and creator briefs. Keep it whole, and don&apos;t crop or restyle the title.
            Download it from <a href="/images/brand/challenge-graphic.webp" download className="text-crimson underline">here</a>.
          </p>
        </div>
      </div>

      {/* Color */}
      <div className="mt-14">
        <p className="eyebrow">Color</p>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { name: "Crimson", hex: "#7A0328", cls: "bg-crimson" },
            { name: "Crimson Bright", hex: "#A6093D", cls: "bg-crimson-bright" },
            { name: "Ink", hex: "#1A1210", cls: "bg-ink" },
            { name: "Paper", hex: "#FBF6F2", cls: "bg-paper border border-rule" },
          ].map((c) => (
            <div key={c.name} className="overflow-hidden rounded-xl2 border border-rule">
              <div className={`h-20 ${c.cls}`} />
              <div className="p-3">
                <p className="font-ui text-xs font-semibold text-ink">{c.name}</p>
                <p className="font-mono text-[11px] text-slate">{c.hex}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Seasonal marks */}
      <div className="mt-14">
        <p className="eyebrow">Seasonal &amp; festival marks</p>
        <p className="mt-3 max-w-2xl text-sm text-slate">
          For culturally significant dates on the Nigerian calendar, the
          icon mark is dressed for the occasion — used only in-app,
          on social, and in seasonal email banners. The wordmark and
          primary crimson identity never change; only the icon adapts.
          The icon marks and every seasonal mark here are also chat stickers that members can send in Messages.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {SEASONAL.map((s) => (
            <div key={s.file} className="card overflow-hidden">
              <div className="flex h-32 items-center justify-center bg-paper p-3">
                <Image
                  src={`/images/seasonal/${s.file.replace(/\.png$/, ".webp")}`}
                  alt={s.label}
                  width={160}
                  height={110}
                  className="max-h-full w-auto object-contain"
                />
              </div>
              <p className="border-t border-rule px-3 py-2 text-center font-ui text-xs font-semibold text-ink">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Usage notes */}
      <div className="mt-14 card p-8">
        <p className="eyebrow">Usage notes</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate">
          <li>Keep clear space around the icon equal to the height of the "n".</li>
          <li>Never recolor the mark outside the crimson family above.</li>
          <li>Seasonal marks are for a specific window only — revert to the standard icon once the observance ends.</li>
          <li>Don't stretch, rotate, or add drop shadows beyond what's shown here.</li>
        </ul>
      </div>
      {/* General guidelines */}
      <section id="guidelines" className="mt-14 scroll-mt-24">
        <p className="eyebrow">General guidelines</p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {BRAND_GENERAL.map((g) => <div key={g.t} className="card p-5"><p className="font-ui text-sm font-bold text-ink">{g.t}</p><p className="mt-1 text-sm text-slate">{g.d}</p></div>)}
        </div>
      </section>

      {/* Logo pack */}
      <section id="logo-pack" className="mt-14 card scroll-mt-24 p-8">
        <p className="eyebrow">Logo pack</p>
        <p className="mt-3 max-w-2xl text-sm text-slate">One zip with the icon (PNG and WebP, up to 512 px), the full wordmark, the app icons, the #1MillionNairaNotesAppChallenge artwork and these guidelines as a text file. Version {BRAND_PACK.version}. The seasonal marks aren&apos;t in it: they&apos;re for NotesApp&apos;s own channels.</p>
        <BrandPackDownload />
      </section>

      {/* Prohibited uses */}
      <section id="prohibited" className="mt-14 scroll-mt-24">
        <p className="eyebrow">Prohibited uses</p>
        <p className="mt-3 text-sm text-slate">Please don&apos;t:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate">{BRAND_PROHIBITED.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>

      {/* FAQ */}
      <section id="faq" className="mt-14 scroll-mt-24">
        <p className="eyebrow">FAQ</p>
        <div className="mt-4 divide-y divide-rule rounded-xl2 border border-rule bg-card">
          {BRAND_FAQ.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="cursor-pointer list-none font-ui text-sm font-semibold text-ink">{f.q}<span className="float-right text-slate group-open:rotate-45">+</span></summary>
              <p className="mt-2 text-sm text-slate">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate">Something else? <Link href="/contact" className="text-crimson underline">Ask us from the contact page</Link>.</p>
      </section>

      {/* Legal */}
      <section id="legal" className="mt-14 scroll-mt-24 pb-6">
        <p className="eyebrow">Legal</p>
        {BRAND_LEGAL.map((p) => <p key={p} className="mt-3 max-w-3xl text-sm text-slate">{p}</p>)}
        <p className="mt-3 text-sm"><Link href="/terms" className="text-crimson underline">Terms of Service</Link></p>
      </section>
    </div>
    </>
  );
}
