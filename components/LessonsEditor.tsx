"use client";

import { useState } from "react";
import { User } from "firebase/auth";
import { PublicLesson, StoreItem, MAX_LESSONS } from "@/lib/store";
import { STREAM_MAX_BYTES } from "@/lib/stream-config";
import { DIGITAL_MAX_BYTES } from "@/lib/private-files-config";

const field = "mt-1 w-full border border-rule bg-card px-3 py-2 font-body text-sm outline-none focus:border-gold";

async function call(user: User, body: Record<string, unknown>) {
  const res = await fetch("/api/store/lessons", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body) });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "Something went wrong.");
  return j;
}

// The lessons of a view-only item: video (hosted on Cloudflare Stream, played only with short-lived tokens) and PDFs
// (kept in private storage). One lesson makes a single view-only file; several make a course. Pro and above.
export default function LessonsEditor({ user, item, onChanged }: { user: User; item: StoreItem; onChanged: () => void }) {
  const [lessons, setLessons] = useState<PublicLesson[]>(item.lessons ?? []);
  const [kind, setKind] = useState<"video" | "pdf">("video");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function act(body: Record<string, unknown>) {
    setError("");
    try {
      const j = await call(user, { itemId: item.id, ...body });
      setLessons(j.lessons);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!file) return setError("Choose a file.");
    if (!title.trim()) return setError("Give the lesson a title.");
    const limit = kind === "video" ? STREAM_MAX_BYTES : DIGITAL_MAX_BYTES;
    if (file.size > limit) return setError(`That file is too big — the limit is ${limit / 1024 / 1024} MB${kind === "video" ? ". Compress the video and try again." : "."}`);
    setBusy(true);
    try {
      setMsg("Preparing upload…");
      const s = await call(user, { action: "start", itemId: item.id, kind, title, filename: file.name, size: file.size });
      setMsg("Uploading… keep this page open");
      if (kind === "video") {
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch(s.uploadUrl, { method: "POST", body: fd });
        if (!up.ok) throw new Error("The upload failed. Check your connection and try again.");
      } else {
        const up = await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: file });
        if (!up.ok) throw new Error("The upload failed. Check your connection and try again.");
      }
      setMsg("Finishing…");
      const done = await call(user, { action: "finish", itemId: item.id, lessonId: s.lessonId, kind, title, uid: s.uid, key: s.key });
      setLessons(done.lessons);
      setTitle("");
      setFile(null);
      setMsg(kind === "video" ? "Added. A new video can take a few minutes to process before it plays." : "Added.");
      onChanged();
    } catch (err) {
      setMsg("");
      setError(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border border-rule bg-card p-4 text-xs text-slate">
      <p className="font-ui text-sm font-bold text-ink">Lessons · {lessons.length} of {MAX_LESSONS}</p>
      <p className="mt-1">Buyers watch the videos and read the PDFs here, on up to 2 devices, with no download. One lesson makes a single view-only file; several make a course. Buyers can&apos;t see the item until it has at least one lesson.</p>
      {lessons.length > 0 && (
        <ol className="mt-3 space-y-1">
          {lessons.map((l, i) => (
            <li key={l.id} className="flex items-center justify-between gap-3 border border-rule bg-paper px-3 py-1.5">
              <span className="truncate text-ink">{i + 1}. {l.title} <span className="font-mono text-slate">· {l.kind === "video" ? "video" : "PDF"}</span></span>
              <span className="flex shrink-0 gap-2 font-semibold text-crimson">
                <button type="button" disabled={i === 0} onClick={() => act({ action: "move", lessonId: l.id, dir: "up" })}>↑</button>
                <button type="button" disabled={i === lessons.length - 1} onClick={() => act({ action: "move", lessonId: l.id, dir: "down" })}>↓</button>
                <button type="button" onClick={() => { const t = prompt("Lesson title", l.title); if (t && t.trim()) void act({ action: "rename", lessonId: l.id, title: t }); }}>Rename</button>
                <button type="button" className="text-slate hover:text-crimson" onClick={() => confirm(`Remove “${l.title}”? Buyers lose it immediately.`) && act({ action: "remove", lessonId: l.id })}>Remove</button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label>Type
          <select value={kind} onChange={(e) => { setKind(e.target.value as "video" | "pdf"); setFile(null); }} className={field}>
            <option value="video">Video (MP4, MOV, WebM — up to {STREAM_MAX_BYTES / 1024 / 1024} MB)</option>
            <option value="pdf">PDF (up to {DIGITAL_MAX_BYTES / 1024 / 1024} MB)</option>
          </select>
        </label>
        <label>Lesson title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={field} /></label>
        <label className="sm:col-span-2">File
          <input key={kind} type="file" accept={kind === "video" ? "video/*" : "application/pdf,.pdf"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block text-sm" />
        </label>
        {msg && <p className="sm:col-span-2 text-ink">{msg}</p>}
        {error && <p className="sm:col-span-2 text-sm text-crimson">{error}</p>}
        <div className="sm:col-span-2"><button className="btn-primary !px-4 !py-2 text-xs" disabled={busy}>{busy ? "Please wait…" : "Add lesson"}</button></div>
      </form>
    </div>
  );
}
