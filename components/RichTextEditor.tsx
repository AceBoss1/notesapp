"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { remark } from "remark";
import html from "remark-html";
import { uploadToR2 } from "@/lib/upload";

// Formatting toolbar + live preview over plain Markdown. Content is
// still stored as Markdown, so every existing journal, the journal
// page renderer (remark) and Precheks' shared notes keep working.
type Props = {
  value: string;
  onChange: (v: string) => void;
  draftKey?: string; // enables local autosave + restore when set
};

type Action = { label: string; title: string; run: () => void };

export default function RichTextEditor({ value, onChange, draftKey }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [restorable, setRestorable] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // ---- local draft autosave (browser only; never blocks editing) ----
  const storageKey = draftKey ? `notesapp:draft:${draftKey}` : null;
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && saved !== value && saved.trim()) setRestorable(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey || !value) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, value);
        setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } catch {}
    }, 1000);
    return () => clearTimeout(t);
  }, [value, storageKey]);

  // ---- preview (remark-html sanitizes by default) ----
  useEffect(() => {
    if (tab !== "preview") return;
    let alive = true;
    remark()
      .use(html)
      .process(value)
      .then((f) => alive && setPreview(String(f)))
      .catch(() => alive && setPreview("<p>Couldn't render preview.</p>"));
    return () => {
      alive = false;
    };
  }, [tab, value]);

  function edit(fn: (sel: string, before: string, after: string) => { text: string; select?: [number, number] }) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const out = fn(value.slice(s, e), value.slice(0, s), value.slice(e));
    onChange(out.text);
    requestAnimationFrame(() => {
      el.focus();
      if (out.select) el.setSelectionRange(out.select[0], out.select[1]);
    });
  }

  const wrap = (mark: string, placeholder: string) =>
    edit((sel, before, after) => {
      const inner = sel || placeholder;
      const text = before + mark + inner + mark + after;
      const start = before.length + mark.length;
      return { text, select: [start, start + inner.length] };
    });

  // Prefix each selected line (or the current one) — headings, lists, quotes.
  const prefixLines = (prefix: (i: number) => string, placeholder: string) =>
    edit((sel, before, after) => {
      const lineStart = before.lastIndexOf("\n") + 1;
      const head = before.slice(0, lineStart);
      const target = before.slice(lineStart) + (sel || placeholder);
      const body = target
        .split("\n")
        .map((l, i) => prefix(i) + l.replace(/^(#{1,6} |[-*] |\d+\. |> )/, ""))
        .join("\n");
      return { text: head + body + after, select: [head.length, head.length + body.length] };
    });

  function link() {
    const url = window.prompt("Link URL (https://…)");
    if (!url) return;
    edit((sel, before, after) => {
      const label = sel || "link text";
      const md = `[${label}](${url})`;
      return { text: before + md + after, select: [before.length + 1, before.length + 1 + label.length] };
    });
  }

  async function insertImage(file: File) {
    setError("");
    setUploading(true);
    try {
      const url = await uploadToR2(file);
      const alt = window.prompt("Describe the image (for accessibility)") || "image";
      edit((sel, before, after) => {
        const md = `\n\n![${alt}](${url})\n\n`;
        return { text: before + md + after };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  const actions: Action[] = [
    { label: "B", title: "Bold (Ctrl+B)", run: () => wrap("**", "bold text") },
    { label: "I", title: "Italic (Ctrl+I)", run: () => wrap("*", "italic text") },
    { label: "H2", title: "Heading", run: () => prefixLines(() => "## ", "Heading") },
    { label: "H3", title: "Subheading", run: () => prefixLines(() => "### ", "Subheading") },
    { label: "❝", title: "Quote", run: () => prefixLines(() => "> ", "Quote") },
    { label: "• List", title: "Bulleted list", run: () => prefixLines(() => "- ", "List item") },
    { label: "1. List", title: "Numbered list", run: () => prefixLines((i) => `${i + 1}. `, "List item") },
    { label: "</>", title: "Inline code", run: () => wrap("`", "code") },
    { label: "Link", title: "Link (Ctrl+K)", run: link },
    { label: "―", title: "Divider", run: () => edit((_s, b, a) => ({ text: b + "\n\n---\n\n" + a })) },
  ];

  function onKeyDown(e: React.KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b") (e.preventDefault(), wrap("**", "bold text"));
    else if (k === "i") (e.preventDefault(), wrap("*", "italic text"));
    else if (k === "k") (e.preventDefault(), link());
  }

  const words = useMemo(() => (value.trim() ? value.trim().split(/\s+/).length : 0), [value]);
  const btn = "border border-rule bg-card px-2.5 py-1 font-ui text-xs text-ink hover:border-crimson hover:text-crimson disabled:opacity-40";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {actions.map((a) => (
          <button key={a.label} type="button" title={a.title} onClick={a.run} disabled={tab === "preview"} className={btn}>
            {a.label}
          </button>
        ))}
        <label className={`${btn} cursor-pointer ${tab === "preview" || uploading ? "pointer-events-none opacity-40" : ""}`}>
          {uploading ? "Uploading…" : "Image"}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) insertImage(f);
            }}
          />
        </label>
        <span className="ml-auto flex gap-1.5">
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`${btn} ${tab === t ? "!border-crimson !text-crimson" : ""}`}
            >
              {t === "write" ? "Write" : "Preview"}
            </button>
          ))}
        </span>
      </div>

      {restorable && (
        <p className="mt-2 border border-rule bg-amber-50 px-3 py-2 text-xs text-ink">
          Unsaved draft found in this browser.{" "}
          <button type="button" className="font-semibold text-crimson underline" onClick={() => (onChange(restorable), setRestorable(null))}>
            Restore it
          </button>{" "}
          ·{" "}
          <button
            type="button"
            className="font-semibold text-crimson underline"
            onClick={() => (storageKey && localStorage.removeItem(storageKey), setRestorable(null))}
          >
            Discard
          </button>
        </p>
      )}

      {tab === "write" ? (
        <textarea
          ref={ref}
          required
          rows={18}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Write here — use the toolbar or Markdown."
          className="mt-2 w-full border border-rule bg-card px-4 py-3 font-mono text-sm outline-none focus:border-crimson"
        />
      ) : (
        <div
          className="prose mt-2 min-h-[24rem] max-w-none border border-rule bg-card px-6 py-4"
          dangerouslySetInnerHTML={{ __html: preview || "<p class='text-slate'>Nothing to preview yet.</p>" }}
        />
      )}

      <p className="mt-1 flex justify-between text-xs text-slate">
        <span>{words} words · ~{Math.max(1, Math.round(words / 220))} min read</span>
        <span>{savedAt ? `Draft saved in this browser at ${savedAt}` : ""}</span>
      </p>
      {error && <p className="mt-1 text-xs text-crimson">{error}</p>}
    </div>
  );
}
