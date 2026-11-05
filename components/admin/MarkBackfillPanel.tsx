"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { BACKFILL_COUNTS, BACKFILL_KINDS, BACKFILL_PHASES, type BackfillState } from "@/lib/media-mark";

// Admin → Limits → Re-mark existing pictures and videos: the one-off job that gives everything posted before the permanent NotesApp mark
// (v0.143.0) the same mark and deletes the clean originals (lib/media-mark-backfill.ts). Start it once; it carries on by itself on the
// cron a batch at a time, and "Run a batch now" moves it along while you watch. It can be paused, and started again safely.
const PHASE_LABEL: Record<(typeof BACKFILL_PHASES)[number], string> = {
  mediaPosts: "Media posts", replays: "live replays", storeItems: "shop items", sites: "services on sites", notes: "journals", moments: "moments", recount: "counting Media storage again",
};
const COUNT_LABEL: Record<(typeof BACKFILL_COUNTS)[number], string> = { done: "Marked now", already: "Already marked", pending: "Video copying", failed: "Failed", skipped: "Nothing to mark", external: "Not our file" };

export default function MarkBackfillPanel({ user }: { user: User }) {
  const [s, setS] = useState<BackfillState | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const call = useCallback(async (body?: Record<string, unknown>) => {
    const r = await fetch("/api/admin/media-marks", { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    setS(j.backfill);
  }, [user]);
  useEffect(() => { call().catch((e) => setMsg(e.message)); }, [call]);
  const act = (action: string) => { setBusy(true); setMsg(""); call({ action }).catch((e) => setMsg(e.message)).finally(() => setBusy(false)); };
  if (!s) return msg ? <p className="mt-6 text-sm text-crimson">{msg}</p> : null;
  const phase = BACKFILL_PHASES[s.phase];
  const status = s.status === "running" ? `Running: ${phase ? PHASE_LABEL[phase] : "finishing the videos still copying"}` : s.status === "paused" ? "Paused" : s.status === "done" ? `Done${s.finishedAt ? ` on ${new Date(s.finishedAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}` : ""}` : "Not started";
  return (
    <section className="mt-10" aria-label="Re-mark existing pictures and videos">
      <h2 className="font-display text-2xl text-ink">Re-mark existing pictures and videos</h2>
      <p className="mt-1 text-sm text-slate">
        Gives everything posted before the permanent mark the same mark, written over the same file so every link already shared shows it: Media pictures and videos, published
        video replays, shop item photos, service pictures and journal pictures. Videos are copied by Cloudflare Stream with the mark (this uses
        Stream minutes, and each video is stored twice for a few minutes). It runs a batch at a time on the scheduler, survives being stopped,
        and running it again only finishes what&rsquo;s left. A picture also used as your site&rsquo;s cover, gallery or a profile picture keeps
        its original there and the item gets a marked copy. Pictures from outside links are left as they are.
      </p>
      <p className="mt-3 font-ui text-sm font-bold text-ink" role="status">{status}{s.runs ? ` · ${s.runs} batch${s.runs === 1 ? "" : "es"}` : ""}{s.recounted ? ` · storage recounted for ${s.recounted} member${s.recounted === 1 ? "" : "s"}` : ""}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead><tr className="border-b border-rule text-left text-xs text-slate"><th className="py-2 pr-3 font-semibold">Kind</th>{BACKFILL_COUNTS.map((c) => <th key={c} className="px-2 py-2 text-right font-semibold">{COUNT_LABEL[c]}</th>)}</tr></thead>
          <tbody>
            {BACKFILL_KINDS.map((k) => (
              <tr key={k.key} className="border-b border-rule">
                <td className="py-2 pr-3">{k.label}</td>
                {BACKFILL_COUNTS.map((c) => <td key={c} className={`px-2 py-2 text-right tabular-nums ${c === "failed" && s.counts[k.key]?.[c] ? "font-bold text-crimson" : ""}`}>{s.counts[k.key]?.[c] ?? 0}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {s.lastError && <p className="mt-2 text-xs text-slate">Last problem: {s.lastError}</p>}
      {/* Pictures are written back over their own addresses (so every copied link shows the mark), with a short cache time; the edge may
          still hold the clean copies until they expire or are purged. */}
      <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${s.status === "done" ? "bg-[#fdf1d8] text-ink" : "bg-field text-slate"}`}>
        <strong>When it&rsquo;s finished:</strong> in Cloudflare, open the media domain&rsquo;s zone → <strong>Caching</strong> → <strong>Purge Cache</strong> →
        <strong> Custom purge</strong> of the media hostname (or <strong>Purge everything</strong>), so Cloudflare stops serving clean copies of
        pictures that were marked in place.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {s.status !== "running" && <button type="button" disabled={busy} className="btn-primary disabled:opacity-50" onClick={() => { if (confirm("Re-mark every existing Media picture and video, replay, shop photo, service picture and journal picture? Pictures are written over with the marked copy and old videos are replaced; this can't be undone.")) act("start"); }}>{s.status === "idle" ? "Start re-marking" : "Run it again"}</button>}
        {s.status === "paused" && <button type="button" disabled={busy} className="btn-ghost" onClick={() => act("resume")}>Carry on</button>}
        {s.status === "running" && <button type="button" disabled={busy} className="btn-primary disabled:opacity-50" onClick={() => act("step")}>{busy ? "Working…" : "Run a batch now"}</button>}
        {s.status === "running" && <button type="button" disabled={busy} className="btn-ghost" onClick={() => act("pause")}>Pause</button>}
        <button type="button" disabled={busy} className="btn-ghost" onClick={() => { setMsg(""); call().catch((e) => setMsg(e.message)); }}>Refresh</button>
        {msg && <span className="text-sm text-crimson">{msg}</span>}
      </div>
    </section>
  );
}
