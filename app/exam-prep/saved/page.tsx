"use client";
import { useEffect, useState } from "react";
import { EXAMS, EXAM_IDS } from "@/lib/exam-prep";
import { shortDate, useMe, useOnline } from "@/lib/exam-prep-client";
import { passValid, savedPacks, type SavedPack } from "@/lib/exam-prep-local";
import { btnGo, btnLine, card, Note, PLink, Spinner } from "@/components/exam-prep/ui";

// The offline hub: what's saved on this phone, and practice or a mock from it with no data.
export default function SavedPage() {
  const me = useMe();
  const online = useOnline();
  const [packs, setPacks] = useState<(SavedPack & { paidOpen: boolean })[] | null>(null);
  useEffect(() => {
    if (me === undefined) return;
    savedPacks().then(async (list) => setPacks(await Promise.all(list.map(async (p) => ({ ...p, paidOpen: await passValid(p, me?.uid) }))))).catch(() => setPacks([]));
  }, [me]);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold">Saved on this phone</h1>
      <p className="mt-1 text-sm text-[#0F2747]/70">Practise and do mocks with no data. Your answers stay on the phone and sync to your account when you're back online.</p>
      {!packs ? <Spinner /> : !packs.length ? (
        <div className="mt-4"><Note>Nothing saved yet. {online ? "Open an exam and tap “Save for offline”." : "Save a pack next time you have data."}</Note></div>
      ) : (
        <div className="mt-4 space-y-3">
          {packs.map((p) => {
            const free = p.questions.filter((q) => q.access === "free").length;
            const paid = p.questions.length - free;
            return (
              <div key={p.exam} className={card}>
                <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{EXAMS[p.exam].short}</h2><span className="text-xs text-[#0F2747]/60">Saved {shortDate(p.savedAt)}</span></div>
                <p className="mt-1 text-sm text-[#0F2747]/75">{free} free questions{paid ? ` · ${paid} pack questions ${p.paidOpen ? `open until ${shortDate(p.pass!.exp)}` : "locked: go online and save again to renew"}` : ""}</p>
                <div className="mt-3 flex flex-wrap gap-2"><PLink href={`/${p.exam}/practice`} className={btnGo}>Practise</PLink><PLink href={`/${p.exam}/mock`} className={btnLine}>Timed mock</PLink></div>
              </div>
            );
          })}
        </div>
      )}
      {online && packs && packs.length < EXAM_IDS.length && (
        <p className="mt-4 text-sm">Save another: {EXAM_IDS.filter((id) => !packs.some((p) => p.exam === id)).map((id, n) => <span key={id}>{n ? " · " : ""}<PLink className="font-semibold underline" href={`/${id}`}>{EXAMS[id].short}</PLink></span>)}</p>
      )}
    </div>
  );
}
