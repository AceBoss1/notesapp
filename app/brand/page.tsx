import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Brand",
  description:
    "The #NotesApp brand system — primary mark, palette, and every seasonal/festival logo variant, with usage notes.",
};

const SEASONAL = [
  { file: "valentines.png", label: "Valentine's Day" },
  { file: "eid-al-fitr.png", label: "Eid al-Fitr" },
  { file: "eid-al-adha.png", label: "Eid al-Adha" },
  { file: "igbo-new-yam-festival.png", label: "Igbo New Yam Festival" },
  { file: "lagos-eyo-festival.png", label: "Lagos Eyo Festival" },
  { file: "calabar-carnival.png", label: "Calabar Carnival" },
  { file: "arugungu-fishing-festival.png", label: "Argungu Fishing Festival" },
  { file: "christmas.png", label: "Christmas" },
];

export default function BrandPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Company / Brand</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
        The #NotesApp mark
      </h1>
      <p className="mt-5 max-w-2xl text-slate">
        Our logo is the "na" monogram — a red, rounded square that reads
        as a notepad tab. It appears in two forms: the standalone icon
        (app tiles, favicons, avatars) and the full wordmark (site
        headers, decks, printed material). Below is every approved
        variant, including the seasonal marks we use across the
        Nigerian calendar.
      </p>

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
  );
}
