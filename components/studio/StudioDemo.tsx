"use client";

import { useState } from "react";
import ProgramFrame from "./ProgramFrame";
import StudioControls from "./StudioControls";
import { DEFAULT_STUDIO, applyStudioPatch, cleanComment, queueWith, type StudioState } from "@/lib/studio";

// The studio to try on /studio: the real programme picture and desk, changed only on this screen (uploads are left out: the logo,
// clips and sponsor spot need a live). The same rules clean what is typed as in a real live (lib/studio.ts).
const PEOPLE: Record<string, { name: string; avatar: string }> = {
  host: { name: "Tunde Bakare", avatar: "" }, g1: { name: "Dr. Naledi Mokoena", avatar: "" }, g2: { name: "Zanele Dube", avatar: "" },
};
const STAGE = ["host", "g1", "g2"];
const SAMPLE = [
  { id: "c1", from: "v1", name: "Efua Addo", avatar: "", text: "We need to re-embrace our culture and survive economically, looking at the current state of affairs." },
  { id: "c2", from: "v2", name: "Jabari Mwangi", avatar: "", text: "The Oyo Empire had checks on the Alaafin long before Westminster. Why is this not in our syllabus?" },
  { id: "c3", from: "v3", name: "Sade Okonkwo", avatar: "", text: "Question for Dr. Mokoena: where should a parent start with a ten-year-old?" },
];
const START: StudioState = {
  ...DEFAULT_STUDIO, on: true,
  bug: { ...DEFAULT_STUDIO.bug, show: "The Emerging Voices", place: "Lagos · Johannesburg · London" },
  lower: { on: true, style: "headline", kicker: "Tonight's question", head: "African Mental Freedom: reclaiming the levers through history", name: "Dr. Naledi Mokoena", role: "Historian and author" },
  ticker: { on: true, tag: "NOTES LIVE", speed: "normal", lines: ["Join the conversation: comment and the moderators may put you on air", "Next week: the Oyo Empire and what it teaches about institutions", "The replay is on NotesApp straight after"] },
  caption: "…and if we do not teach our own history, someone else will teach it for us.",
  comment: cleanComment(SAMPLE[0], "host"),
};

export default function StudioDemo() {
  const [studio, setStudio] = useState<StudioState>(START);
  const [note, setNote] = useState("");
  const act = async (body: Record<string, unknown>) => {
    setNote("");
    setStudio((cur) => {
      switch (body.op) {
        case "on": return { ...cur, on: body.on === true };
        case "set": { const out = applyStudioPatch(cur, body.patch, { file: (u) => (u ? null : ""), stage: STAGE }); if (!out.ok) { setNote(out.error); return cur; } return out.studio; }
        case "comment": { const c = cleanComment(body.message, "host"); return { ...cur, comment: c, queue: c ? cur.queue.filter((q) => q.id !== c.id) : cur.queue }; }
        case "queue": { const c = cleanComment(body.message, "host"); return c ? { ...cur, queue: queueWith(cur.queue, c) } : cur; }
        case "unqueue": return { ...cur, queue: cur.queue.filter((q) => q.id !== body.messageId) };
        case "clip": return { ...cur, clip: null };
        default: return cur;
      }
    });
  };
  return (
    <div className="rounded-xl2 bg-ink p-3 text-white sm:p-5" style={{ backgroundImage: "radial-gradient(ellipse 80% 55% at 50% 0%, rgba(122,3,40,0.55) 0%, rgba(26,18,16,0) 70%)" }}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <ProgramFrame studio={studio} stage={STAGE} hostUid="host" me="" person={(u) => PEOPLE[u]} videos={{}} myCam={null} talking={{ g1: true }} sub={(u) => (u === "host" ? "Host" : "")} />
          {note && <p className="text-xs text-[#FFB4A2]" role="alert">{note}</p>}
          <StudioControls studio={studio} isHost canEdit canAir stage={STAGE} nameOf={(u) => PEOPLE[u].name} act={act} onError={(m) => setNote(/upload|sign in/i.test(m) ? "Uploads work in a real live: this is a try-out." : m)} />
        </div>
        <div className="min-w-0">
          <p className="font-ui text-sm font-bold">Chat</p>
          <p className="mt-0.5 text-xs text-white/50">In a live, moderators see these buttons beside each comment.</p>
          <ul className="mt-3 space-y-3">
            {SAMPLE.map((m) => (
              <li key={m.id} className="rounded-xl bg-white/[0.06] p-3 text-sm">
                <b className="font-ui text-xs">{m.name}</b>
                <p className="mt-0.5 text-white/85">{m.text}</p>
                <div className="mt-2 flex gap-2 text-[11px]">
                  {studio.comment?.id === m.id
                    ? <button type="button" onClick={() => void act({ op: "comment", message: null })} className="rounded bg-[#E5122F] px-2 py-1 font-extrabold">ON AIR · take off</button>
                    : <button type="button" disabled={!studio.on} onClick={() => void act({ op: "comment", message: m })} className="rounded bg-white px-2 py-1 font-extrabold text-ink disabled:opacity-40">On air</button>}
                  {studio.comment?.id !== m.id && <button type="button" disabled={!studio.on} onClick={() => void act({ op: "queue", message: m })} className="rounded bg-white/10 px-2 py-1 font-semibold disabled:opacity-40">Queue</button>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
