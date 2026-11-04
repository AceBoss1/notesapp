import AnyaHeroCarousel, { type AnyaSlide } from "@/components/anya/AnyaHeroCarousel";
import Link from "next/link";
import type { Metadata } from "next";
import { BRAND_OWNER } from "@/lib/brand-guidelines";

export const metadata: Metadata = {
  title: "Anya smart glasses",
  description:
    "Anya by #NotesApp: smart glasses made for Africa. Anya Display puts translation in 139 languages, transcripts, a teleprompter and 1080p HD video in your lens; Anya Nana brings Nana AI to your ear as a companion, with real-time translation in 139 languages; Anya Audio is for music and calls. Pricing and pre-orders coming soon.",
  openGraph: { images: [{ url: "/anya/anya-display-hero.webp", width: 1672, height: 941, alt: "Anya Display smart glasses by NotesApp" }] },
};

// Anya ("eye" in Igbo): NotesApp's own smart glasses, three models (HANDOVER 114). Nothing is on sale yet: pricing and pre-orders
// come later, so the page's one action is registering interest through the contact form (lead topic "anya", lib/leads.ts).
const INTEREST =
  "/contact?topic=anya&message=" +
  encodeURIComponent("I'd like to be among the first to try Anya.\n\nThe model I'm most interested in (Display, Nana or Audio): \nWhere I am (city, country): \nWhat I'd use it for: ") +
  "#feedback";

// The hero pictures, shown one at a time with a dissolve between them (components/anya/AnyaHeroCarousel.tsx).
const SLIDES: AnyaSlide[] = [
  { src: "/anya/anya-display-hero.webp", name: "Display", alt: "Anya Display smart glasses by NotesApp, with a side camera: AI voice assistant, AI real-time translation, 139-language translation, AI voice recording, smart image recognition, 1080p HD video, music playback and control from the NotesApp app" },
  { src: "/anya/anya-nana-hero.webp", name: "Nana", alt: "Anya Nana smart glasses by NotesApp, with blue-tinted lenses: Nana AI companion, AI real-time translation, 139-language translation, hands-free calls, music playback and control from the NotesApp app" },
  { src: "/anya/anya-audio-hero.webp", name: "Audio", alt: "Anya Audio smart glasses by NotesApp, with dark lenses: music and podcasts, hands-free calls, open-ear speakers and controls on the arm" },
];

type Model = { name: string; line: string; about: string; points: string[]; tone: string };
const MODELS: Model[] = [
  {
    name: "Display",
    line: "Your world, in your lens.",
    about: "A screen in the lens, a side camera, microphones and open-ear speakers, controlled from the NotesApp app on your phone.",
    points: [
      "Nana, the AI voice assistant",
      "AI real-time translation in 139 languages",
      "AI voice recording and live transcripts",
      "Smart image recognition",
      "1080p HD video from the side camera",
      "A teleprompter in the lens",
      "Music playback",
    ],
    tone: "from-crimson to-crimson-bright",
  },
  {
    name: "Nana",
    line: "Your AI companion, hands-free.",
    about: "Nana, the AI from #NotesApp, as your companion in your ear. Ask anything, hear the answer, and understand people in 139 languages without taking out your phone.",
    points: ["Nana AI as your companion", "AI real-time translation in 139 languages", "Hands-free calls", "Music playback", "Control from the NotesApp app"],
    tone: "from-[#1B2A6B] to-[#2E49B8]",
  },
  {
    name: "Audio",
    line: "Listen. Talk. Connect.",
    about: "Open-ear audio glasses for music, podcasts and calls, with no AI. Simple, light and private.",
    points: ["Music and podcasts", "Hands-free calls", "Open-ear speakers", "Controls on the arm", "No AI, no camera"],
    tone: "from-[#3A0A18] to-crimson",
  },
];

// What each model has. true / false only: nothing here that hasn't been decided.
const COMPARE: [string, boolean, boolean, boolean][] = [
  ["Screen in the lens", true, false, false],
  ["Side camera", true, false, false],
  ["Microphones and open-ear speakers", true, true, true],
  ["Nana AI (assistant on Display, companion on Nana)", true, true, false],
  ["AI real-time translation (139 languages)", true, true, false],
  ["AI voice recording and live transcripts", true, false, false],
  ["Smart image recognition", true, false, false],
  ["1080p HD video", true, false, false],
  ["Teleprompter", true, false, false],
  ["Music playback", true, true, true],
];

const USES = [
  { t: "Talk across languages", d: "Someone speaks; you read what they said in your language, in the lens, across 139 languages. For markets, meetings, travel and family." },
  { t: "Never miss a word", d: "AI voice recording and live transcripts turn a lecture, a sermon or a meeting into text you can read as it happens." },
  { t: "Speak without notes", d: "Your script scrolls in the lens while you look at your audience or your camera. Made for creators who go live on #NotesApp." },
  { t: "Ask Nana anything", d: "Questions, reminders and quick answers, spoken in your ear, with your hands free." },
];

const Tick = ({ on }: { on: boolean }) =>
  on ? (
    <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-crimson text-paper" aria-label="Yes">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M3.5 8.5l3 3 6-7" /></svg>
    </span>
  ) : (
    <span className="inline-block h-0.5 w-3 rounded bg-rule" aria-label="No" />
  );

export default function AnyaPage() {
  return (
    <div className="bg-paper">
      {/* Hero: a dark band with the headline, then the three models' pictures, dissolving from one to the next. */}
      <section className="relative overflow-hidden bg-[#140409] text-paper" style={{ backgroundImage: "radial-gradient(50rem 26rem at 80% -10%, rgba(166,9,61,0.55), transparent 70%), radial-gradient(40rem 22rem at 0% 110%, rgba(46,73,184,0.35), transparent 70%)" }}>
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20 lg:px-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-paper/20 bg-paper/5 px-3 py-1 font-mono text-[11px] uppercase tracking-eyebrow text-paper/80">
            <span className="h-1.5 w-1.5 rounded-full bg-crimson-bright" aria-hidden /> Coming soon · Smart glasses by #NotesApp
          </p>
          <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[1.02] sm:text-7xl">
            Anya. <span className="text-paper/60">See more.</span> <span className="italic text-[#FF8FB0]">Do more.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-paper/80">
            <em>Anya</em> means &ldquo;eye&rdquo; in Igbo. Three pairs of smart glasses, designed for Africa: translation and HD video in your lens, Nana AI as your companion in your ear, or simply great sound.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={INTEREST} className="rounded-full bg-crimson-bright px-6 py-3 font-ui text-sm font-bold text-paper shadow-lg shadow-crimson/40 hover:bg-crimson">Be among the first to try it</a>
            <a href="#models" className="rounded-full border border-paper/30 px-6 py-3 font-ui text-sm font-semibold text-paper hover:border-paper/60">Meet the three</a>
          </div>
          <div className="relative mt-12">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-r from-crimson-bright/40 via-transparent to-[#2E49B8]/40 blur-2xl" aria-hidden />
            <AnyaHeroCarousel slides={SLIDES} />
          </div>
        </div>
      </section>

      {/* The three models. */}
      <section id="models" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8">
        <p className="eyebrow">The family</p>
        <h2 className="mt-2 font-display text-4xl text-ink">Three ways to wear Anya</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {MODELS.map((m) => (
            <article key={m.name} className="flex flex-col overflow-hidden rounded-3xl border border-rule bg-card shadow-sm">
              <div className={`bg-gradient-to-br ${m.tone} px-6 pb-6 pt-7 text-paper`}>
                <p className="font-mono text-[11px] uppercase tracking-eyebrow text-paper/70">NotesApp</p>
                <h3 className="mt-1 font-display text-3xl"><span className="font-bold">Anya</span> {m.name}</h3>
                <p className="mt-1 italic text-paper/85">{m.line}</p>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <p className="text-slate">{m.about}</p>
                <ul className="mt-4 space-y-2 text-sm text-ink">
                  {m.points.map((p) => (
                    <li key={p} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-crimson" aria-hidden />{p}</li>
                  ))}
                </ul>
                <p className="mt-auto pt-6 font-ui text-sm font-semibold text-slate">Price: coming soon</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* What Display does. */}
      <section className="border-y border-rule bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="eyebrow">Anya Display</p>
          <h2 className="mt-2 max-w-2xl font-display text-4xl text-ink">Made for the way Africa talks, learns and creates</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {USES.map((u, i) => (
              <div key={u.t}>
                <p className="font-mono text-sm text-crimson">0{i + 1}</p>
                <h3 className="mt-2 font-ui text-lg font-bold text-ink">{u.t}</h3>
                <p className="mt-2 text-sm text-slate">{u.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compare. */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-3xl text-ink">Compare</h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-rule bg-card">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="border-b border-rule text-left font-ui">
                <th className="px-4 py-3 font-semibold text-slate"> </th>
                {MODELS.map((m) => <th key={m.name} className="px-4 py-3 text-center font-bold text-ink">Anya {m.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {COMPARE.map(([label, ...has]) => (
                <tr key={label}>
                  <td className="px-4 py-3 text-ink">{label}</td>
                  {has.map((on, i) => <td key={i} className="px-4 py-3 text-center"><Tick on={on} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Register interest. */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-crimson-deep p-8 text-paper sm:p-12" style={{ backgroundImage: "radial-gradient(40rem 20rem at 100% 0%, rgba(166,9,61,0.7), transparent 70%)" }}>
          <div className="grid gap-8 lg:grid-cols-[1.4fr,1fr] lg:items-center">
            <div>
              <h2 className="font-display text-4xl">Pricing and pre-orders are coming soon</h2>
              <p className="mt-4 max-w-xl text-paper/85">
                Want to be among the first to try Anya? Tell us which model you&apos;d like and where you are. We&apos;ll contact you before pre-orders open. Registering interest is free and doesn&apos;t commit you to buy.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <a href={INTEREST} className="rounded-full bg-paper px-7 py-3.5 font-ui text-sm font-bold text-crimson hover:bg-paper/90">Register your interest</a>
              <Link href="/contact" className="text-sm text-paper/80 underline">Other questions? Contact us</Link>
            </div>
          </div>
        </div>
        <p className="mt-8 text-xs text-slate">
          Anya, Anya Display, Anya Nana and Anya Audio are trademarks of {BRAND_OWNER}. Pictures are for illustration; the final design may differ. See our <Link href="/brand" className="underline">brand guidelines</Link>.
        </p>
      </section>
    </div>
  );
}
