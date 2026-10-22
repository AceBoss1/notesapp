"use client";
import { useEffect, useState } from "react";
import { EXAMS, type ExamId } from "@/lib/exam-prep";
import type { Catalogue } from "@/lib/exam-prep-server";
import { GUIDES } from "@/lib/exam-prep-guides";
import { loadCatalogue, naira, shortDate, useMe, useOnline } from "@/lib/exam-prep-client";
import { savedPack, type SavedPack } from "@/lib/exam-prep-local";
import SaveOffline from "./SaveOffline";
import { Back, btnGo, btnGold, btnLine, card, Note, PLink, Pill, Spinner } from "./ui";

// One exam: its subjects and topics (free and pack counts), the pack, mocks, saving offline, and a short guide.
export default function ExamHub({ exam }: { exam: ExamId }) {
  const e = EXAMS[exam];
  const me = useMe();
  const online = useOnline();
  const [cat, setCat] = useState<Catalogue | null>(null);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState<SavedPack | null | undefined>(undefined);
  useEffect(() => { if (me === undefined) return; loadCatalogue().then(setCat).catch((x) => setErr((x as Error).message)); }, [me]);
  useEffect(() => { savedPack(exam).then((p) => setSaved(p ?? null)); }, [exam]);
  const subjects = cat?.subjects.filter((s) => s.exam === exam) ?? [];
  const access = cat?.access[exam];
  const pack = cat?.packs[exam];
  const guide = GUIDES[exam];

  return (
    <>
      <Back href="/">All exams</Back>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{e.short}</h1>
          <p className="text-sm font-semibold text-[#0F2747]/70">{e.name} · {e.full}</p>
        </div>
        <PLink href={`/${exam}/mock`} className={btnLine}>Start a timed mock</PLink>
      </div>

      {!online && saved && <div className="mt-4"><Note>You're offline. <PLink className="font-semibold underline" href={`/${exam}/practice`}>Practise from your saved pack</PLink>.</Note></div>}
      {!online && !saved && !cat && <div className="mt-4"><Note>You're offline and this pack isn't saved on this phone yet. Save it next time you have data.</Note></div>}
      {err && online && <div className="mt-4"><Note tone="error">{err}</Note></div>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="font-display text-lg font-bold">Subjects</h2>
          {!cat && online && !err && <Spinner />}
          {cat && !subjects.length && <div className="mt-2"><Note>Questions for {e.short} are being reviewed. Check back soon.</Note></div>}
          <div className="mt-2 space-y-3">
            {subjects.map((s) => (
              <div key={s.id} className={card}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold">{s.name}</h3>
                  <div className="flex gap-1.5"><Pill tone="green">{s.free} free</Pill><Pill tone="gold">{s.pack} in the pack</Pill></div>
                </div>
                <ul className="mt-3 divide-y divide-[#0F2747]/8">
                  {s.topics.map((t) => (
                    <li key={t.id}>
                      <PLink href={`/${exam}/practice?subject=${s.id}&topic=${t.id}`} className="flex min-h-[48px] items-center justify-between gap-2 py-2 hover:text-[#1E8E5A]">
                        <span className="font-medium">{t.name}</span>
                        <span className="shrink-0 text-xs text-[#0F2747]/60">{t.free} free{access?.active ? ` + ${t.pack}` : t.pack ? ` · ${t.pack} 🔒` : ""}</span>
                      </PLink>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PLink href={`/${exam}/practice?subject=${s.id}`} className={btnGo}>Practise {s.name}</PLink>
                  <PLink href={`/${exam}/mock?subject=${s.id}`} className={btnLine}>Mock</PLink>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className={`${card} border-[#C9A227]/50`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#7a6114]">{e.short} pack</p>
            {access?.active ? (
              <>
                <p className="mt-1 text-lg font-bold">Your pack is open</p>
                <p className="text-sm text-[#0F2747]/70">Every {e.short} question, all subjects, until {shortDate(access.expiresAt!)} ({access.daysLeft} days).</p>
                <PLink href={`/${exam}/pack`} className={`${btnLine} mt-3 w-full`}>Pack details</PLink>
              </>
            ) : (
              <>
                <p className="mt-1 text-2xl font-bold">{pack ? naira(pack.priceKobo) : "₦1,000"} <span className="text-sm font-semibold text-[#0F2747]/60">for {pack?.months ?? 12} months</span></p>
                <p className="mt-1 text-sm text-[#0F2747]/70">Opens every {e.short} question in every subject, with explanations and offline saving.</p>
                <PLink href={`/${exam}/pack`} className={`${btnGold} mt-3 w-full`}>Get the {e.short} pack</PLink>
                <PLink href={`/${exam}/pack#ask`} className="mt-2 block text-center text-sm font-semibold text-[#0F2747]/70 underline">Ask someone to pay</PLink>
              </>
            )}
          </div>
          <SaveOffline exam={exam} saved={saved} onSaved={setSaved} uid={me?.uid ?? null} />
          <div className={card}>
            <p className="font-semibold">About {e.short}</p>
            <p className="mt-1 text-sm text-[#0F2747]/70">{e.about}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#0F2747]/80">{guide.facts.map((f) => <li key={f}>{f}</li>)}</ul>
            <p className="mt-3 text-sm font-semibold">Tips</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#0F2747]/80">{guide.tips.map((f) => <li key={f}>{f}</li>)}</ul>
            <a href={guide.official.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-[#1E8E5A] underline">Official site: {guide.official.label} ↗</a>
          </div>
        </aside>
      </div>
    </>
  );
}
