"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { uploadToR2WithKey } from "@/lib/upload";
import { api } from "@/lib/moments-client";
import { MOMENT_DEFAULT_HOURS, MOMENT_HINT, MOMENT_HOURS, MOMENT_TEXT_MAX, MOMENT_VIDEO_MAX_SECONDS, type MomentHours, type MomentKind } from "@/lib/moments-rules";
import { VIDEO_ACCEPT } from "@/lib/video-rules";

const readDuration = (file: File) =>
  new Promise<number>((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); };
    v.onerror = () => reject(new Error("We couldn't read that video."));
    v.src = URL.createObjectURL(file);
  });

// Create a moment: text, a picture or a video up to 90 seconds, for 24 hours by default (48 or 72 if you choose).
// Voice-over is planned (the data model has a place for it) but not built yet.
export default function MomentComposer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const [kind, setKind] = useState<MomentKind>("text");
  const [text, setText] = useState("");
  const [hours, setHours] = useState<MomentHours>(MOMENT_DEFAULT_HOURS);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post() {
    setBusy(true); setError(null);
    try {
      const body: Record<string, unknown> = { kind, hours, text };
      if (kind === "image") {
        if (!file) throw new Error("Choose a picture.");
        body.imageKey = (await uploadToR2WithKey(file, "moment")).key;
      } else if (kind === "video") {
        if (!file) throw new Error("Choose a video.");
        const durationSec = await readDuration(file);
        if (durationSec > MOMENT_VIDEO_MAX_SECONDS + 1) throw new Error(`Moment videos can be up to ${MOMENT_VIDEO_MAX_SECONDS} seconds.`);
        const start = await api<{ id: string; uploadUrl: string }>("/api/video", { body: { action: "start", purpose: "moment", size: file.size, contentType: file.type, durationSec } });
        const put = await fetch(start.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!put.ok) throw new Error("The upload didn't go through. Try again.");
        await api("/api/video", { body: { action: "finish", purpose: "moment", id: start.id } });
        body.videoUploadId = start.id;
      }
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
    <button type="button" onClick={() => { setKind(k); setFile(null); }} aria-pressed={kind === k}
      className={`rounded-full border px-4 py-1.5 text-sm ${kind === k ? "border-crimson bg-crimson text-white" : "border-rule text-ink"}`}>{label}</button>
  );

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
            <input type="file" accept={kind === "image" ? "image/jpeg,image/png,image/webp,image/gif,image/avif" : VIDEO_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
            {kind === "video" && <p className="mt-1 text-xs text-slate">Up to {MOMENT_VIDEO_MAX_SECONDS} seconds.</p>}
          </div>
        )}
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={MOMENT_TEXT_MAX} rows={4} placeholder={MOMENT_HINT} className="mt-4 w-full rounded border border-rule p-3 text-sm" />
        <p className="text-right text-xs text-slate">{text.length}/{MOMENT_TEXT_MAX}</p>
        <fieldset className="mt-3">
          <legend className="text-sm font-bold text-ink">Disappears after</legend>
          <div className="mt-2 flex gap-4 text-sm">
            {MOMENT_HOURS.map((h) => (
              <label key={h} className="flex items-center gap-1.5"><input type="radio" name="hours" checked={hours === h} onChange={() => setHours(h)} /> {h} hours{h === MOMENT_DEFAULT_HOURS ? " (default)" : ""}</label>
            ))}
          </div>
        </fieldset>
        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        <button onClick={post} disabled={busy || (kind === "text" ? !text.trim() : !file)} className="btn-primary mt-5 w-full disabled:opacity-50">{busy ? "Sharing…" : "Share moment"}</button>
      </div>
    </div>
  );
}
