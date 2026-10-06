"use client";

import { useEffect, useRef, useState } from "react";

// View-only PDF: pages are drawn to canvases from bytes the server streams to a registered device. There's no download
// button, no file URL, right-click and printing are blocked and the buyer's email is stamped faintly across each page.
// That stops casual copying; it can't stop a screenshot, and we say so.
export default function PdfViewer({ load, watermark }: { load: () => Promise<ArrayBuffer>; watermark: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let dead = false;
    let doc: { destroy: () => void } | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.js", import.meta.url).toString();
        const data = await load();
        const pdf = await pdfjs.getDocument({ data }).promise;
        doc = pdf;
        if (dead || !host.current) return;
        host.current.innerHTML = "";
        const width = Math.min(host.current.clientWidth || 800, 900);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          if (dead || !host.current) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${viewport.height / dpr}px`;
          canvas.className = "mx-auto mb-4 block max-w-full border border-rule bg-white shadow-sm";
          host.current.appendChild(canvas);
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          ctx.save();
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = "#000";
          ctx.font = `${Math.round(viewport.width / 28)}px sans-serif`;
          ctx.translate(viewport.width / 2, viewport.height / 2);
          ctx.rotate(-Math.PI / 6);
          ctx.textAlign = "center";
          ctx.fillText(watermark, 0, 0);
          ctx.restore();
          if (n === 1) setState("ready");
        }
      } catch (e) {
        if (!dead) {
          setError(e instanceof Error ? e.message : "Couldn't open this file.");
          setState("error");
        }
      }
    })();
    return () => {
      dead = true;
      doc?.destroy();
    };
  }, [load, watermark]);

  return (
    <div className="no-print select-none" onContextMenu={(e) => e.preventDefault()}>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      {state === "loading" && <p className="text-sm text-slate">Opening…</p>}
      {state === "error" && <p className="text-sm text-crimson">{error}</p>}
      <div ref={host} />
    </div>
  );
}
