import { EXAMS, EXAM_IDS, PREP_NAME, PREP_TAGLINE, DEFAULT_PACK_KOBO, DEFAULT_PACK_MONTHS } from "@/lib/exam-prep";
import { PLink } from "@/components/exam-prep/ui";
import { card, btnGo } from "@/components/exam-prep/styles";
import TeenCard from "@/components/exam-prep/TeenCard";
import ExamAccessBadge from "@/components/exam-prep/ExamAccessBadge";

export default function PrepHome() {
  return (
    <>
      <TeenCard />
      <section className="rounded-3xl bg-[#0F2747] px-5 py-8 text-white sm:px-8 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C9A227]">JAMB · WAEC · NECO</p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{PREP_NAME}</h1>
        <p className="mt-1 text-lg text-white/85">{PREP_TAGLINE}</p>
        <p className="mt-4 max-w-xl text-[15px] text-white/80">Free practice questions with full explanations, timed mocks marked on the spot, and packs you can save to your phone and use with no data.</p>
        <PLink href="#exams" className={`${btnGo} mt-5`}>Choose your exam</PLink>
      </section>

      <h2 id="exams" className="mt-8 font-display text-xl font-bold">Choose your exam</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {EXAM_IDS.map((id) => (
          <PLink key={id} href={`/${id}`} className={`${card} block transition hover:border-[#1E8E5A]/50`}>
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl font-bold">{EXAMS[id].short}</span>
              <ExamAccessBadge exam={id} />
            </div>
            <p className="mt-1 text-sm font-semibold">{EXAMS[id].name}</p>
            <p className="mt-2 text-sm text-[#0F2747]/70">{EXAMS[id].about}</p>
            <p className="mt-3 text-sm font-semibold text-[#1E8E5A]">Start free →</p>
          </PLink>
        ))}
      </div>

      <h2 className="mt-10 font-display text-xl font-bold">How it works</h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-4">
        {[
          ["Practise free", "Every subject has free questions. Answer, see if you're right, read why."],
          ["Time yourself", "Mocks of 10, 20 or 40 questions on a timer, marked when you finish."],
          [`Get the pack`, `₦${(DEFAULT_PACK_KOBO / 100).toLocaleString("en-NG")} opens every question in one exam, all subjects, for ${DEFAULT_PACK_MONTHS} months. Or ask someone to pay for you.`],
          ["Save it offline", "Keep a pack on your phone and practise with no data. Your progress syncs later."],
        ].map(([t, d], i) => (
          <li key={t} className={card}>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#C9A227]/25 text-sm font-bold">{i + 1}</span>
            <p className="mt-2 font-semibold">{t}</p>
            <p className="mt-1 text-sm text-[#0F2747]/70">{d}</p>
          </li>
        ))}
      </ol>

      <div className={`${card} mt-8`}>
        <p className="font-semibold">Every question is checked by a person</p>
        <p className="mt-1 text-sm text-[#0F2747]/70">Questions are original, written for {PREP_NAME} and reviewed before they're published. Spot a mistake? Tap “Report” on the question and we'll look at it.</p>
      </div>
    </>
  );
}
