"use client";

import { useEffect, useRef, useState } from "react";
import { cropFor, imageProblem, type ImageSpec } from "@/lib/ad-config";

// Crops a picture to an advert's shape (1200 × 628, or a Notes Life billboard's 1600 × 900) before it's uploaded: zoom and
// slide it until the frame shows what you want, then "Use this". The result is a JPEG at the spec's size (larger, up to
// the sharp size, when the picture allows), as light as it can be while staying sharp (under 500 KB where possible, never
// over 1 MB). The dashed box is the safe area: keep the logo, words and faces inside it.
export async function loadPicture(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function cutPicture(img: HTMLImageElement, spec: ImageSpec & { bestBytes: number }, view: { zoom: number; x: number; y: number }): Promise<{ blob: Blob; width: number; height: number }> {
  const c = cropFor(img.naturalWidth, img.naturalHeight, spec, view);
  const canvas = document.createElement("canvas");
  canvas.width = c.width;
  canvas.height = c.height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background, as JPEG has none
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, 0, 0, c.width, c.height);
  let blob: Blob | null = null;
  for (const q of [0.9, 0.85, 0.8, 0.75, 0.7, 0.62]) {
    blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", q));
    if (blob && blob.size <= spec.bestBytes) break;
  }
  if (!blob) throw new Error("Couldn't prepare the picture.");
  if (blob.size > spec.maxBytes) throw new Error("The picture is still over 1 MB after cropping; try a simpler one.");
  return { blob, width: c.width, height: c.height };
}

export default function ImageCrop({ file, spec, label, onDone, onCancel }: { file: File; spec: ImageSpec & { bestBytes: number; safe: { width: number; height: number } }; label: string; onDone: (f: File) => void; onCancel: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [view, setView] = useState({ zoom: 1, x: 0.5, y: 0.5 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadPicture(file).then(setImg).catch(() => setError("That file isn't a picture we can read."));
  }, [file]);

  const cut = img ? cropFor(img.naturalWidth, img.naturalHeight, spec, view) : null;
  const tooSmall = img && cut ? imageProblem(cut.sw, cut.sh, spec) : null;

  useEffect(() => {
    const el = canvas.current;
    if (!el || !img || !cut) return;
    const ctx = el.getContext("2d")!;
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.drawImage(img, cut.sx, cut.sy, cut.sw, cut.sh, 0, 0, el.width, el.height);
  }, [img, cut?.sx, cut?.sy, cut?.sw, cut?.sh]); // eslint-disable-line react-hooks/exhaustive-deps

  async function use() {
    if (!img) return;
    setBusy(true);
    setError("");
    try {
      const out = await cutPicture(img, spec, view);
      onDone(new File([out.blob], `${file.name.replace(/\.[^.]+$/, "") || "advert"}-${out.width}x${out.height}.jpg`, { type: "image/jpeg" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't prepare the picture.");
    } finally {
      setBusy(false);
    }
  }

  const slider = "w-full accent-crimson";
  const safeW = (spec.safe.width / spec.width) * 100, safeH = (spec.safe.height / spec.height) * 100;
  return (
    <div className="card mt-2 p-4">
      <p className="font-ui text-sm font-bold text-ink">{label}: crop to {spec.width} × {spec.height}</p>
      <div className="relative mt-3 overflow-hidden rounded-lg bg-paper" style={{ aspectRatio: `${spec.width} / ${spec.height}` }}>
        <canvas ref={canvas} width={spec.width / 2} height={spec.height / 2} className="h-full w-full" />
        <div aria-hidden className="pointer-events-none absolute border-2 border-dashed border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,.35)]" style={{ left: `${(100 - safeW) / 2}%`, top: `${(100 - safeH) / 2}%`, width: `${safeW}%`, height: `${safeH}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-slate">Keep the logo, words and faces inside the dashed box (the safe area).</p>
      {img && (
        <div className="mt-3 grid gap-2 text-xs text-slate sm:grid-cols-3">
          <label>Zoom<input type="range" min={1} max={3} step={0.05} value={view.zoom} onChange={(e) => setView({ ...view, zoom: Number(e.target.value) })} className={slider} /></label>
          <label>Left / right<input type="range" min={0} max={1} step={0.01} value={view.x} onChange={(e) => setView({ ...view, x: Number(e.target.value) })} className={slider} /></label>
          <label>Up / down<input type="range" min={0} max={1} step={0.01} value={view.y} onChange={(e) => setView({ ...view, y: Number(e.target.value) })} className={slider} /></label>
        </div>
      )}
      {img && cut && <p className="mt-2 text-xs text-slate">Your picture is {img.naturalWidth} × {img.naturalHeight} px; this crop comes out at {cut.width} × {cut.height} px.</p>}
      {(tooSmall || error) && <p className="mt-2 text-sm text-crimson" role="alert">{error || tooSmall}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={use} disabled={!img || !!tooSmall || busy} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">{busy ? "Preparing…" : "Use this"}</button>
        <button type="button" onClick={onCancel} className="btn-ghost !px-4 !py-2 text-xs">Choose another</button>
      </div>
    </div>
  );
}
