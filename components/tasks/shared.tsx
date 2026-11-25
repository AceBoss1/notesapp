"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { jobsApi } from "@/components/jobs/useAuthUser";
import { FILES_MAX, FILE_MAX_BYTES, type TaskFile } from "@/lib/tasks";
import { ATTACHMENT_ACCEPT, formatBytes } from "@/lib/messages-rules";

// Shared bits for the Notes Tasks screens (lib/tasks.ts): the API call, file uploads to the private bucket, and the stars.
export const tasksApi = <T,>(user: User | null | undefined, query = "", body?: unknown) => jobsApi<T>(user, `/api/tasks${query}`, body);
export const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
export const field = "mt-1 block w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink outline-none focus:border-crimson";
export const dateText = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

// Picks files, uploads each (POST action "upload" → PUT to the signed URL), and reports the list of uploaded ids.
export function FilePicker({ user, purpose, taskId, value, onChange }: { user: User; purpose: "brief" | "work"; taskId?: string; value: TaskFile[]; onChange: (v: TaskFile[]) => void }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const add = async (list: FileList | null) => {
    if (!list) return;
    setError("");
    let next = [...value];
    for (const f of Array.from(list)) {
      if (next.length >= FILES_MAX) { setError(`Up to ${FILES_MAX} files.`); break; }
      if (f.size > FILE_MAX_BYTES) { setError(`${f.name} is over ${FILE_MAX_BYTES / 1048576} MB.`); continue; }
      setBusy(f.name);
      try {
        const r = await tasksApi<{ id: string; uploadUrl: string; contentType: string }>(user, "", { action: "upload", name: f.name, size: f.size, purpose, id: taskId });
        const put = await fetch(r.uploadUrl, { method: "PUT", headers: { "Content-Type": r.contentType }, body: f });
        if (!put.ok) throw new Error(`${f.name} didn't upload. Try again.`);
        next = [...next, { id: r.id, name: f.name, size: f.size, type: r.contentType }];
        onChange(next);
      } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    }
    setBusy("");
  };
  return (
    <div>
      {value.length > 0 && (
        <ul className="mt-2 space-y-1">
          {value.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-1.5 text-sm text-ink">
              <span className="min-w-0 flex-1 truncate">📄 {f.name}</span><span className="text-xs text-slate">{formatBytes(f.size)}</span>
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== f.id))} className="text-xs font-semibold text-crimson">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <label className="mt-2 inline-flex cursor-pointer rounded-full border border-dashed border-crimson/50 px-4 py-1.5 font-ui text-xs font-semibold text-crimson hover:bg-crimson/5">
        {busy ? `Uploading ${busy}…` : "+ Add files"}
        <input type="file" multiple accept={ATTACHMENT_ACCEPT} className="sr-only" disabled={!!busy} onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
      </label>
      <p className="mt-1 text-[11px] text-slate">Documents, spreadsheets, pictures, audio or video, up to {FILE_MAX_BYTES / 1048576} MB each. Kept private.</p>
      {error && <p className="mt-1 text-xs text-crimson">{error}</p>}
    </div>
  );
}

export function FileLinks({ user, taskId, files, worker }: { user: User | null | undefined; taskId: string; files: TaskFile[]; worker?: string }) {
  const [error, setError] = useState("");
  const open = async (f: TaskFile) => {
    setError("");
    try {
      const r = await tasksApi<{ url: string }>(user, `?id=${taskId}&file=${f.id}${worker ? `&worker=${worker}` : ""}`);
      window.location.href = r.url;
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't open it."); }
  };
  if (!files.length) return null;
  return (
    <div className="mt-2">
      <ul className="space-y-1">
        {files.map((f) => (
          <li key={f.id}><button type="button" onClick={() => void open(f)} className="flex w-full items-center gap-2 rounded-lg bg-paper px-3 py-1.5 text-left text-sm text-ink hover:text-crimson">
            <span className="min-w-0 flex-1 truncate">📄 {f.name}</span><span className="text-xs text-slate">{formatBytes(f.size)} · Download</span>
          </button></li>
        ))}
      </ul>
      {error && <p className="mt-1 text-xs text-crimson">{error}</p>}
    </div>
  );
}

export const Stars = ({ value, count }: { value: number | null; count?: number }) =>
  value === null ? <span className="text-xs text-slate">No ratings yet</span> : <span className="text-xs text-ink"><span className="text-gold">★</span> {value.toFixed(1)}{count !== undefined ? <span className="text-slate"> ({count})</span> : null}</span>;

export function RateForm({ onRate, label }: { onRate: (stars: number, comment: string) => Promise<void>; label: string }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="mt-3 rounded-xl border border-rule bg-paper p-3">
      <p className="font-ui text-sm font-semibold text-ink">{label}</p>
      <div className="mt-1 flex gap-1" role="radiogroup" aria-label="Stars">
        {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setStars(n)} className={`text-2xl ${n <= stars ? "text-gold" : "text-rule"}`}>★</button>)}
      </div>
      <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder="A few words (optional)" className={field} />
      <button type="button" disabled={!stars || busy} onClick={async () => { setBusy(true); setError(""); try { await onRate(stars, comment); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save it."); } setBusy(false); }} className="btn-primary mt-2 !px-4 !py-1.5 text-xs disabled:opacity-50">Rate</button>
      {error && <p className="mt-1 text-xs text-crimson">{error}</p>}
    </div>
  );
}
