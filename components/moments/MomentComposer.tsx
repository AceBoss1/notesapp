"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { uploadToR2WithKey } from "@/lib/upload";
import { api } from "@/lib/moments-client";
import { MOMENT_DEFAULT_HOURS, MOMENT_HINT, MOMENT_HOURS, MOMENT_TEXT_MAX, MOMENT_VIDEO_MAX_SECONDS, MOMENT_VIDEO_SOURCE_MAX_SECONDS, momentVideoClips, momentVideoParts, type MomentHours, type MomentKind } from "@/lib/moments-rules";
import { VIDEO_ACCEPT } from "@/lib/video-rules";
import VoiceOverRecorder, { uploadVoiceOver, type VoiceOver } from "./VoiceOverRecorder";

const readDuration = (file: File) =>
  new Promise<number>((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); };
    v.onerror = () => reject(new Error("We couldn't read that video."));
    v.src = URL.createObjectURL(file);
  });

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// Create a moment: text, a picture or a video, for 24 hours by default (48 or 72 if you choose). A moment's video is up to 90
// seconds; a longer one is cut into parts of up to 90 seconds, one moment each, as far as the plan's weekly video moments allow.
// A voice-over (recorded here, up to 90 seconds) can go on top of any of them.
export default function MomentComposer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const [kind, setKind] = useState<MomentKind>("text");
  const [text, setText] = useState("");
  const [hours, setHours] = useState<MomentHours>(MOMENT_DEFAULT_HOURS);
  const [file, setFile] = useState<File | null>(null);
  const [voice, setVoice] = useState<VoiceOver | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [quota, setQuota] = useState<{ limit: number; used: number; remaining: number } | null>(null);
  const [doneNote, setDoneNote] = useState<string | null>(null); // shown after a video was shared, before closing

  // Choosing a video: read its length, and if it needs more than one moment, ask how many the plan has left so the member is told
  // what will happen before pressing Share.
  async function pickFile(f: File | null) {
    setFile(f); setDuration(null); setQuota(null); setError(null);
    if (!f || kind !== "video") return;
    try {
      const d = await readDuration(f);
      setDuration(d);
      if (momentVideoParts(d) > 1) setQuota(await api("/api/video", { body: { action: "quota", purpose: "moment" } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't read that video.");
    }
  }
  const needed = duration ? momentVideoParts(duration) : 1;
  const allowed = quota ? Math.min(needed, quota.remaining) : needed;

  async function post() {
    setBusy(true); setError(null);
    try {
      const body: Record<string, unknown> = { kind, hours, text };
      if (kind === "image") {
        if (!file) throw new Error("Choose a picture.");
        body.imageKey = (await uploadToR2WithKey(file, "moment")).key;
      } else if (kind === "video") {
        if (!file) throw new Error("Choose a video.");
        const durationSec = duration ?? (await readDuration(file));
        const start = await api<{ id: string; uploadUrl: string; partsAllowed: number; partsNeeded: number }>("/api/video", { body: { action: "start", purpose: "moment", size: file.size, contentType: file.type, durationSec } });
        const put = await fetch(start.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!put.ok) throw new Error("The upload didn't go through. Try again.");
        await api("/api/video", { body: { action: "finish", purpose: "moment", id: start.id } });
        if (!auth.currentUser) throw new Error("Sign in first.");
        // One moment per part, in order (each waits for the one before, so they appear in the right order). A voice-over goes on the first.
        const clips = momentVideoClips(durationSec, start.partsAllowed);
        const voiceId = voice ? await uploadVoiceOver(voice) : undefined;
        let made = 0;
        try {
          for (let i = 0; i < clips.length; i++) {
            const caption = clips.length === 1 ? text : text ? `${text} (${i + 1}/${clips.length})` : `Part ${i + 1} of ${clips.length}`;
            await api("/api/moments", { body: { kind: "video", hours, text: caption, videoUploadId: start.id, clipStart: clips[i].start, clipEnd: clips[i].end, ...(i === 0 && voiceId ? { audioUploadId: voiceId } : {}) } });
            made++;
          }
        } catch (e) {
          if (made) onPosted();
          throw new Error(`${made ? `Shared ${made} of ${clips.length} parts. ` : ""}${e instanceof Error ? e.message : "Couldn't share the rest."}`);
        }
        onPosted();
        if (clips.length > 1 || start.partsNeeded > start.partsAllowed) {
          const used = Math.round(clips[clips.length - 1].end - clips[0].start);
          setDoneNote(
            start.partsAllowed >= start.partsNeeded
              ? `Your ${clock(durationSec)} video was shared as ${clips.length} moments, in order, each up to ${MOMENT_VIDEO_MAX_SECONDS} seconds.${voiceId ? " The voice-over is on the first one." : ""}`
              : `Your video is ${clock(durationSec)} long, but your plan had room for ${clips.length === 1 ? "one more video moment" : `${clips.length} more video moments`} this week, so only the first ${clock(used)} was shared (${clips.length === 1 ? "one moment" : `${clips.length} moments`}). The rest was left out.`
          );
          return;
        }
        onClose();
        return;
      }
      if (voice) body.audioUploadId = await uploadVoiceOver(voice);
      if (!auth.currentUser) throw new Error("Sign in first.");
      await api("/api/moments", { body });
      onPosted();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't share the moment.");
    } finally {
      setBusy(false);
    }
  }

  const tab = (k: MomentKind, label: string) => (
    <button type="button" onClick={() => { setKind(k); setFile(null); setDuration(null); setQuota(null); }} aria-pressed={kind === k}
      className={`rounded-full border px-4 py-1.5 text-sm ${kind === k ? "border-crimson bg-crimson text-white" : "border-rule text-ink"}`}>{label}</button>
  );

  const tooLong = !!duration && duration > MOMENT_VIDEO_SOURCE_MAX_SECONDS + 1;
  const noRoom = needed > 1 && !!quota && quota.remaining === 0;

  if (doneNote) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Moment shared">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <h2 className="font-display text-2xl text-ink">Shared</h2>
          <p className="mt-3 text-sm text-slate">{doneNote}</p>
          <button onClick={onClose} className="btn-primary mt-5 w-full">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="New moment">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">New moment</h2>
          <button onClick={onClose} aria-label="Close" className="px-2 text-2xl leading-none text-slate">×</button>
        </div>
        <div className="mt-4 flex gap-2">{tab("text", "Text")}{tab("image", "Picture")}{tab("video", "Video")}</div>
        {kind !== "text" && (
          <div className="mt-4">
            <input type="file" accept={kind === "image" ? "image/jpeg,image/png,image/webp,image/gif,image/avif" : VIDEO_ACCEPT} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
            {kind === "video" && <p className="mt-1 text-xs text-slate">Up to {MOMENT_VIDEO_MAX_SECONDS} seconds.</p>}
          </div>
        )}
        {kind === "video" && duration !== null && (
          <div className="mt-3 rounded border border-rule bg-paper p-3 text-xs text-slate" role="status">
            {tooLong ? `That video is ${clock(duration)} long. We can use videos of up to ${MOMENT_VIDEO_SOURCE_MAX_SECONDS / 60} minutes.`
              : needed === 1 ? `${clock(duration)}: it fits in one moment.`
              : !quota ? `That video is ${clock(duration)}. Checking how many video moments you have left this week…`
              : quota.remaining === 0 ? `That video is ${clock(duration)}, longer than the ${MOMENT_VIDEO_MAX_SECONDS} seconds a moment can be, and you've used all ${quota.limit} of this week's video moments${quota.limit === 0 ? " (video moments come with a paid plan)" : ""}. Pictures and text are still free.`
              : allowed >= needed ? `That video is ${clock(duration)}, longer than the ${MOMENT_VIDEO_MAX_SECONDS} seconds a moment can be. It will be shared as ${needed} moments, in order, each up to ${MOMENT_VIDEO_MAX_SECONDS} seconds. That uses ${needed} of your ${quota.remaining} video moments left this week.${voice ? " The voice-over goes on the first one." : ""}`
              : `That video is ${clock(duration)}, longer than the ${MOMENT_VIDEO_MAX_SECONDS} seconds a moment can be, and you have ${quota.remaining === 1 ? "1 video moment" : `${quota.remaining} video moments`} left this week. Only the first ${clock(Math.min(duration, allowed * MOMENT_VIDEO_MAX_SECONDS))} will be shared; the rest will be left out.`}
          </div>
        )}
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={MOMENT_TEXT_MAX} rows={4} placeholder={MOMENT_HINT} className="mt-4 w-full rounded border border-rule p-3 text-sm" />
        <p className="text-right text-xs text-slate">{text.length}/{MOMENT_TEXT_MAX}</p>
        <VoiceOverRecorder value={voice} onChange={setVoice} />
        <fieldset className="mt-3">
          <legend className="text-sm font-bold text-ink">Disappears after</legend>
          <div className="mt-2 flex gap-4 text-sm">
            {MOMENT_HOURS.map((h) => (
              <label key={h} className="flex items-center gap-1.5"><input type="radio" name="hours" checked={hours === h} onChange={() => setHours(h)} /> {h} hours{h === MOMENT_DEFAULT_HOURS ? " (default)" : ""}</label>
            ))}
          </div>
        </fieldset>
        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        <button onClick={post} disabled={busy || tooLong || noRoom || (kind === "text" ? !text.trim() : !file)} className="btn-primary mt-5 w-full disabled:opacity-50">{busy ? "Sharing…" : "Share moment"}</button>
      </div>
    </div>
  );
}
