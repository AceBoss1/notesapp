"use client";

import { useRef, useState } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import { uploadVideo, type UploadedVideo } from "@/lib/video-upload";
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

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    onBusy?.(true);
    try {
      const up: UploadedVideo = await uploadVideo(file, (s, p) => { setStage(s); if (p !== undefined) setPct(p); });
      onChange(up);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The video upload failed.");
    } finally {
      setStage("idle");
      onBusy?.(false);
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
          <button type="button" onClick={() => onChange(null)} className="mt-3 text-xs text-crimson underline">Remove video</button>
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
