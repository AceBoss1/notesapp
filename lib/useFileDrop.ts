"use client";

import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";

// Lets a part of a page take files by drag and drop and by paste (a screenshot, or files copied from the desktop). Spread `bind` on the element and show
// `dragging` as a highlight. Pasting plain text, or text copied from Word or a spreadsheet (which also puts a picture on the clipboard), still pastes as text.
export function useFileDrop(onFiles: (files: File[]) => void, enabled = true) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0); // dragenter and dragleave fire for every child, so count them
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  const bind = {
    onDragEnter: (e: DragEvent) => { if (!enabled || !hasFiles(e)) return; e.preventDefault(); depth.current += 1; setDragging(true); },
    onDragOver: (e: DragEvent) => { if (!enabled || !hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; },
    onDragLeave: (e: DragEvent) => { if (!enabled || !hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false); },
    onDrop: (e: DragEvent) => {
      if (!enabled || !hasFiles(e)) return;
      e.preventDefault(); depth.current = 0; setDragging(false);
      const f = Array.from(e.dataTransfer.files);
      if (f.length) onFiles(f);
    },
    onPaste: (e: ClipboardEvent) => {
      if (!enabled) return;
      const f = Array.from(e.clipboardData?.files ?? []);
      if (!f.length) return;
      const text = e.clipboardData.getData("text/plain").trim();
      if (text && f.every((x) => x.type.startsWith("image/")) && !f.some((x) => text.includes(x.name))) return; // rich text with a picture: paste the text
      e.preventDefault();
      onFiles(f);
    },
  };
  return { dragging, bind };
}

export const DROP_RING = "ring-2 ring-crimson ring-offset-2";
