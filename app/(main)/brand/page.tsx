import Image from "next/image";
import type { Metadata } from "next";
import { SEASONAL } from "@/lib/brand-marks";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Brand",
  description:
    "The #NotesApp brand system — primary mark, palette, and every seasonal/festival logo variant, with usage notes.",
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

      {/* Primary marks */}
      <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2">
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
    </div>
    </>
  );
}
