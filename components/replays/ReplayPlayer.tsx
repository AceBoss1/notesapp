"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { capi } from "@/components/community/api";
import type { ReplayCard } from "@/lib/live-recording-server";

// A published replay's player (lib/live-recording.ts): the Cloudflare Stream player with a signed link the server hands only to someone
// who may watch (everyone, the host's subscribers, or the community's members). Used on the replay's page and inside its journal post.
// A watch is counted once a session (Trending → Replays).
export default function ReplayPlayer({ id, compact = false }: { id: string; compact?: boolean }) {
  const [state, setState] = useState<{ replay: ReplayCard; canWatch: boolean; player?: string } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => onAuthStateChanged(auth, () => {
    capi<{ replay: ReplayCard; canWatch: boolean; player?: string }>(`/api/replays?id=${encodeURIComponent(id)}`).then(setState).catch((e) => setErr(e instanceof Error ? e.message : "This replay can't be played."));
  }), [id]);
  useEffect(() => {
    if (!state?.player) return;
    fetch("/api/views", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "replay", id }) }).catch(() => {});
  }, [state?.player, id]);
  if (err) return <p className="my-6 rounded-xl border border-rule bg-card p-4 text-sm text-slate">{err}</p>;
  if (!state) return <div className="my-6 aspect-video w-full animate-pulse rounded-2xl bg-rule/40" />;
  const r = state.replay;
  if (!state.canWatch) {
    return (
      <div className="my-6 rounded-2xl border border-rule bg-card p-6 text-sm text-slate">
        <p className="font-ui font-bold text-ink">{r.audience === "subscribers" ? "For subscribers" : "For community members"}</p>
        <p className="mt-1">{r.audience === "subscribers"
          ? <>This replay is for {r.hostName}&apos;s journal subscribers. <Link href={`/u/${r.hostUsername}`} className="font-semibold text-crimson">Subscribe on their profile</Link>.</>
          : <>This replay is for members of {r.communityName}.</>}</p>
      </div>
    );
  }
  if (r.status !== "ready" || !state.player) return <p className="my-6 rounded-xl border border-rule bg-card p-4 text-sm text-slate">{r.status === "failed" ? "This replay couldn't be prepared." : "This replay is being prepared for streaming. It's ready in a minute or two."}</p>;
  return (
    <div className={`${compact ? "my-4" : "my-6"} overflow-hidden rounded-2xl bg-ink`}>
      <div className="relative aspect-video w-full">
        <iframe src={state.player} title={r.title} className="absolute inset-0 h-full w-full border-0" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowFullScreen />
      </div>
    </div>
  );
}
