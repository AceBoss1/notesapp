"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { capi, field, small } from "@/components/community/api";
import { ShareButton } from "@/components/share/ShareToNotesApp";
import { DEFAULT_RECORDING_FIGURES, RECORDING_HELP, REPLAY_AUDIENCES, daysLeft, type RecordingFigures, type ReplayAudience } from "@/lib/live-recording";
import type { RecordingRow, ReplayCard } from "@/lib/live-recording-server";

// The host's recordings and replays (lib/live-recording.ts), kept simple and self-contained so the Media studio can drop it in as it is.
// Recordings show the days left before they're deleted, with Play, Publish and Delete; published replays show Open, Share (Moments,
// Journal quote, Chat, other apps), Share to Journal (a draft with the transcript and Nana's summary) and Unpublish.
// admin: the safety review list (every recording, Play only), for Trust & safety.
type Mine = { recordings: RecordingRow[]; replays: ReplayCard[]; figures: RecordingFigures };
const mins = (s?: number) => (s ? `${Math.max(1, Math.round(s / 60))} min` : "");
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "");
const STATUS: Record<RecordingRow["status"], string> = { starting: "Starting", recording: "Recording now", finalizing: "Being saved", ready: "Ready", failed: "Not recorded", deleted: "Deleted" };

export default function ReplaysList({ admin = false }: { admin?: boolean }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [data, setData] = useState<Mine | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [publishing, setPublishing] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ id: string; url: string; type: string } | null>(null);
  useEffect(() => onAuthStateChanged(auth, (u) => setSignedIn(!!u)), []);
  const load = useCallback(async () => {
    try {
      if (admin) { const j = await capi<{ recordings: RecordingRow[] }>("/api/replays?all=1"); setData({ recordings: j.recordings, replays: [], figures: DEFAULT_RECORDING_FIGURES }); }
      else setData(await capi<Mine>("/api/replays?mine=1"));
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't load your replays."); }
  }, [admin]);
  useEffect(() => { if (signedIn) void load(); }, [signedIn, load]);
  const act = async (tag: string, body: Record<string, unknown>, done?: (j: Record<string, unknown>) => void) => {
    setBusy(tag); setErr(""); setNote("");
    try { const j = await capi<Record<string, unknown>>("/api/replays", body); done?.(j); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't do that."); }
    finally { setBusy(""); }
  };
  if (signedIn === false) return <p className="text-sm text-slate">Sign in to see your recordings and replays.</p>;
  if (!data) return <p className="text-sm text-slate">{err || "Loading…"}</p>;
  const f = data.figures;
  return (
    <div className="space-y-8">
      {err && <p className="text-sm text-crimson" role="alert">{err}</p>}
      {note && <p className="text-sm text-ink" role="status">{note}</p>}
      <section>
        <h2 className="font-display text-2xl text-ink">{admin ? "Live recordings (safety review)" : "Recordings"}</h2>
        <p className="mt-1 text-sm text-slate">
          {admin
            ? "Every recorded live, newest first. Play opens a link that lasts 15 minutes. Recordings are deleted after their keep date unless the host published the replay."
            : <>Lives you recorded. Each is kept {f.keepDays} days after the live ends, then deleted unless you publish it as a replay. <Link href={RECORDING_HELP} className="font-semibold text-crimson">How recording works</Link></>}
        </p>
        {!data.recordings.length && <p className="mt-3 text-sm text-slate">{admin ? "No recordings." : f.available ? "No recordings yet. Switch on Record this live when you start an audio room." : "Recording isn't available yet."}</p>}
        <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-card">
          {data.recordings.map((r) => (
            <li key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-ui text-sm font-bold text-ink">{r.title}</p>
                  <p className="text-xs text-slate">{[admin ? r.hostName : "", r.communityName, day(r.startedAt), mins(r.seconds), r.hadVideo ? "video" : "audio"].filter(Boolean).join(" · ")}</p>
                  <p className="mt-1 text-xs text-slate">
                    {STATUS[r.status]}{r.why ? ` (${r.why})` : ""}
                    {r.published ? " · published as a replay" : r.status !== "deleted" && r.keepUntil ? ` · ${daysLeft(r.keepUntil)} day${daysLeft(r.keepUntil) === 1 ? "" : "s"} left` : ""}
                    {r.forced || r.safetyOnly ? " · recorded for safety" : ""}{r.paidLive ? " · paid live" : ""}{r.teenOnStage ? " · someone in teen mode spoke" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.status === "ready" && <button type="button" className={small} disabled={busy === r.id} onClick={() => act(r.id, { action: "play", id: r.id, ...(admin ? { admin: true } : {}) }, (j) => setPlaying({ id: r.id, url: String(j.url), type: String(j.type) }))}>Play</button>}
                  {!admin && r.status === "ready" && !r.published && !r.safetyOnly && <button type="button" className={small} onClick={() => setPublishing(publishing === r.id ? null : r.id)}>Publish</button>}
                  {!admin && r.status !== "starting" && r.status !== "recording" && <button type="button" className={small} disabled={busy === r.id} onClick={() => confirm(r.published ? "Delete this recording and its replay? This can't be undone." : "Delete this recording? This can't be undone.") && act(r.id, { action: "delete", id: r.id })}>Delete</button>}
                </div>
              </div>
              {playing?.id === r.id && (playing.type.startsWith("video")
                ? <video src={playing.url} controls className="mt-3 w-full rounded-xl bg-ink" />
                : <audio src={playing.url} controls className="mt-3 w-full" />)}
              {publishing === r.id && <PublishForm title={r.title} teen={!!r.teenOnStage} paid={!!r.paidLive} busy={busy === r.id} onCancel={() => setPublishing(null)}
                onPublish={(title, audience) => act(r.id, { action: "publish", id: r.id, title, audience }, (j) => { setPublishing(null); setNote(j.why ? String(j.why) : "Published. Your replay is being prepared for streaming; it's ready in a minute or two."); })} />}
            </li>
          ))}
        </ul>
      </section>
      {!admin && (
        <section>
          <h2 className="font-display text-2xl text-ink">Replays</h2>
          <p className="mt-1 text-sm text-slate">Published replays show here{data.replays.some((x) => x.audience !== "community") ? ", and those for everyone or your subscribers also on Explore and Trending" : ""}. They become a journal post only if you tap Share to Journal.</p>
          {!data.replays.length && <p className="mt-3 text-sm text-slate">No replays yet.</p>}
          <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-card">
            {data.replays.map((x) => (
              <li key={x.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link href={`/replays/${x.id}`} className="font-ui text-sm font-bold text-ink hover:text-crimson">{x.title}</Link>
                  <p className="text-xs text-slate">{[x.communityName, day(x.publishedAt), x.status === "processing" ? "preparing" : x.status === "failed" ? "couldn't be prepared" : mins(x.duration), REPLAY_AUDIENCES.find((a) => a.id === x.audience)?.label.split(" (")[0], `${x.views.toLocaleString("en-GB")} views`].filter(Boolean).join(" · ")}</p>
                  {x.noteId && <Link href={`/write/${x.noteId}/edit`} className="mt-1 inline-block text-xs font-semibold text-crimson">Open its journal post</Link>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {x.audience !== "community" && <ShareButton shareRef={{ kind: "replay", id: x.id }} path={`/replays/${x.id}`} title={x.title} className={small} />}
                  {x.audience !== "community" && !x.noteId && <button type="button" className={small} disabled={busy === x.id} onClick={() => act(x.id, { action: "journal", id: x.id }, (j) => { window.location.href = String(j.editHref); })}>Share to Journal</button>}
                  <button type="button" className={small} disabled={busy === x.id} onClick={() => confirm(`Unpublish this replay${x.noteId ? " and remove its journal post" : ""}?`) && act(x.id, { action: "unpublish", id: x.id }, (j) => setNote(j.kept ? `Unpublished. The recording is kept until ${day(String(j.keepUntil))}, then deleted unless you publish it again.` : "Unpublished, and the recording was deleted (it was past its keep window)."))}>Unpublish</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PublishForm({ title, teen, paid, busy, onPublish, onCancel }: { title: string; teen: boolean; paid?: boolean; busy: boolean; onPublish: (title: string, audience: ReplayAudience) => void; onCancel: () => void }) {
  const [t, setT] = useState(title);
  const [audience, setAudience] = useState<ReplayAudience>(teen ? "community" : "public");
  return (
    <form className="mt-3 space-y-3 rounded-xl border border-rule p-3" onSubmit={(e) => { e.preventDefault(); onPublish(t, audience); }}>
      <label className="block text-xs font-semibold text-ink">Title<input value={t} onChange={(e) => setT(e.target.value)} maxLength={120} className={`${field} mt-1`} /></label>
      <fieldset className="space-y-1 text-sm">
        <legend className="text-xs font-semibold text-ink">Who can watch</legend>
        {REPLAY_AUDIENCES.map((a) => (
          <label key={a.id} className="flex items-center gap-2"><input type="radio" name="aud" checked={audience === a.id} disabled={teen && a.id !== "community"} onChange={() => setAudience(a.id)} className="accent-crimson" />{paid && a.id === "community" ? "Ticket holders of this paid live only" : a.label}</label>
        ))}
        {teen && <p className="text-xs text-slate">Someone in teen mode spoke in this live, so its replay stays inside the community.</p>}
      </fieldset>
      <div className="flex gap-2"><button className="btn-primary !px-4 !py-2 text-xs" disabled={busy || t.trim().length < 3}>Publish replay</button><button type="button" className="text-xs text-slate underline" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}
