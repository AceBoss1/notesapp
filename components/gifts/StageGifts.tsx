"use client";

import PersonActions from "@/components/gifts/PersonActions";

// Gift · Block · Report for each person on a live's stage (gifting everywhere, v0.140.0): one small row under the stage, so the room's
// own stage code (components/community/AudioRoom.tsx) only has to place it. Each gift carries the live's id, so it counts as sent during
// the live (the daily shelf links to it, and a grand gift's announcement opens it).
export default function StageGifts({ roomId, hostUid, stage, me, joined }: { roomId: string; hostUid: string; stage: string[]; me: string; joined: Record<string, { name?: string } | undefined> }) {
  const people = stage.filter((u) => u !== me);
  if (!people.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2" data-stage-gifts>
      <span className="font-ui text-[11px] uppercase tracking-wide text-white/45">🎁 Gift on stage</span>
      {people.map((u) => {
        const name = joined[u]?.name || "Someone";
        return (
          <span key={u} className="inline-flex items-center gap-1 font-ui text-xs text-white/80">
            {name}
            <PersonActions uid={u} name={name} toKind={u === hostUid ? "host" : "speaker"} context="live" liveId={roomId} where="a live's stage" dark compact />
          </span>
        );
      })}
    </div>
  );
}
