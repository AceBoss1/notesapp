"use client";

import { useEffect, useRef, useState } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import { uploadVideo, type UploadedVideo } from "@/lib/video-upload";
import { uploadToR2 } from "@/lib/upload";
import { VIDEO_ACCEPT, VIDEO_RULES_TEXT, videoPublicUrl, type PostVideo } from "@/lib/video-rules";

// The composer's video field. `value` is what the post will save (undefined = no video); removing a video only
// detaches it from the post.
export type VideoValue = PostVideo & { url: string };

export default function VideoUploader({ value, onChange, disabled, disabledReason, onBusy }: {
  value: VideoValue | null;
  onChange: (v: VideoValue | null) => void;
  disabled?: boolean;
  disabledReason?: string;
  onBusy?: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<"idle" | "checking" | "uploading" | "verifying" | "poster">("idle");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState("");
  const [localFile, setLocalFile] = useState<File | null>(null); // the file just uploaded (frames can be read from it directly)
  const [picking, setPicking] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState("");

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    onBusy?.(true);
    try {
      const up: UploadedVideo = await uploadVideo(file, (s, p) => { setStage(s); if (p !== undefined) setPct(p); });
      setLocalFile(file);
      onChange(up);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The video upload failed.");
    } finally {
      setStage("idle");
      onBusy?.(false);
    }
  }

  // Replace the cover (poster) image: a frame picked from the video, or an image the member uploads.
  async function setCover(file: File) {
    if (!value) return;
    setCoverBusy(true);
    setCoverError("");
    try {
      onChange({ ...value, videoPoster: await uploadToR2(file, "journal") });
      setPicking(false);
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : "Couldn't set the cover image.");
    } finally {
      setCoverBusy(false);
    }
  }

  const busy = stage !== "idle";
  const label = { idle: "", checking: "Checking the video…", uploading: `Uploading… ${pct}%`, verifying: "Verifying…", poster: "Making a preview image…" }[stage];

  return (
    <div className="block">
      <span className="eyebrow">Video (optional)</span>
      {value ? (
        <div className="mt-2">
          <div className="max-w-md"><VideoPlayer src={value.url} poster={value.videoPoster} duration={value.videoDuration} size={value.videoSize} title="Preview" /></div>
          <div className="mt-4 max-w-md border border-rule bg-card p-4">
            <p className="font-ui text-sm font-bold text-ink">Cover image</p>
            <p className="mt-1 text-xs text-slate">Shown before the video plays, on post cards and when the post is shared. Used as the post&apos;s featured image unless you set one below.</p>
            <div className="mt-3 flex items-center gap-4">
              {value.videoPoster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value.videoPoster} alt="Cover" className="h-16 w-28 rounded object-cover" />
              ) : (
                <span className="flex h-16 w-28 items-center justify-center rounded bg-rule text-[11px] text-slate">No cover yet</span>
              )}
              <div className="flex flex-col items-start gap-2 text-xs">
                <button type="button" disabled={coverBusy} onClick={() => setPicking((p) => !p)} className="font-semibold text-crimson underline">{picking ? "Close frame picker" : "Choose a frame from the video"}</button>
                <label className="cursor-pointer font-semibold text-crimson underline">
                  Upload an image instead
                  <input type="file" accept="image/*" disabled={coverBusy} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setCover(f); }} />
                </label>
              </div>
            </div>
            {picking && <FramePicker src={localFile ?? value.url} remote={!localFile} onPick={setCover} busy={coverBusy} onError={setCoverError} />}
            {coverBusy && <p className="mt-2 text-xs text-slate" role="status">Saving the cover image…</p>}
            {coverError && <p className="mt-2 text-xs text-red-700">{coverError}</p>}
          </div>
          <button type="button" onClick={() => { onChange(null); setLocalFile(null); setPicking(false); }} className="mt-3 text-xs text-crimson underline">Remove video</button>
        </div>
      ) : (
        <>
          <input ref={input} type="file" accept={VIDEO_ACCEPT} onChange={pick} disabled={disabled || busy} className="mt-2 block text-sm disabled:opacity-50" />
          {busy && (
            <div className="mt-3 max-w-md" role="status">
              <p className="text-xs text-slate">{label}</p>
              {stage === "uploading" && <div className="mt-1 h-1.5 w-full bg-rule"><div className="h-full bg-crimson transition-all" style={{ width: `${pct}%` }} /></div>}
            </div>
          )}
          {disabled && disabledReason && <p className="mt-2 text-xs text-slate">{disabledReason}</p>}
        </>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate">
        {VIDEO_RULES_TEXT.map((r) => <li key={r}>{r}</li>)}
      </ul>
    </div>
  );
}

// Rebuilds the editor's value from a saved post.
export function videoFromNote(n: { videoId?: string; videoKey?: string; videoPoster?: string; videoDuration?: number; videoSize?: number } | undefined): VideoValue | null {
  return n?.videoId && n.videoKey ? { videoId: n.videoId, videoKey: n.videoKey, videoPoster: n.videoPoster, videoDuration: n.videoDuration ?? 0, videoSize: n.videoSize ?? 0, url: videoPublicUrl(n.videoKey) } : null;
}

// Scrub through the video and capture the frame you like. A just-uploaded file is read locally; a saved video is read
// from the media domain (needs its CORS headers — if the browser refuses, the member can upload an image instead).
function FramePicker({ src, remote, onPick, busy, onError }: { src: File | string; remote: boolean; onPick: (f: File) => void; busy: boolean; onError: (m: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [at, setAt] = useState(0);

  useEffect(() => {
    if (typeof src === "string") { setUrl(src); return; }
    const u = URL.createObjectURL(src);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [src]);

  function seek(t: number) {
    setAt(t);
    if (video.current) video.current.currentTime = t;
  }

  function capture() {
    const v = video.current;
    if (!v) return;
    try {
      const scale = Math.min(1, 960 / (v.videoWidth || 960));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round((v.videoWidth || 960) * scale);
      canvas.height = Math.round((v.videoHeight || 540) * scale);
      canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return onError("Couldn't capture that frame. Upload an image instead.");
        onPick(new File([blob], "cover.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.85);
    } catch {
      onError("This browser wouldn't let us read the frame. Upload an image instead.");
    }
  }

  return (
    <div className="mt-3">
      {url && (
        <video
          ref={video}
          src={url}
          muted
          playsInline
          preload="auto"
          {...(remote ? { crossOrigin: "anonymous" as const } : {})}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          className="aspect-video w-full bg-ink object-contain"
        />
      )}
      <input type="range" min={0} max={Math.max(0.1, duration)} step={0.1} value={at} onChange={(e) => seek(Number(e.target.value))} aria-label="Pick a frame" className="mt-2 w-full accent-crimson" />
      <button type="button" disabled={busy || !duration} onClick={capture} className="btn-primary mt-2 !px-4 !py-2 text-xs disabled:opacity-50">Use this frame</button>
    </div>
  );
}
