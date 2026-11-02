"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/moments-client";
import { PROMPT_MAX, leftText, type CoverItem } from "@/lib/covers";

// "✨ Make a cover with Nana" in the course editor's cover area (lib/covers-server.ts, /api/academy/covers). The publisher can say
// what it should show, gets a cover drawn from Nana's design, and then uses it, edits it ("make it green") or tries another. The last
// few stay below to go back to. Every new cover and every edit counts one of the day's covers; the AI comes from their Nana allowance.
type Status = { limit: number; used: number; left: number; resetsAt: string; items: CoverItem[]; allowance: { source: string; ok: boolean; note: string } };
const EDITS = ["Make it green", "Add a laptop", "Shorter headline", "Flip sides", "Kente pattern", "Different colours"];
const field = "w-full rounded-lg border border-rule bg-card px-3 py-2.5 text-base text-ink outline-none placeholder:text-slate/70 focus:border-crimson sm:text-sm";

export default function CoverMaker({ courseId, cover, onUse }: { courseId: string; cover: string; onUse: (url: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Status | null>(null);
  const [prompt, setPrompt] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [change, setChange] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open || s) return;
    api<Status>(`/api/academy/covers?courseId=${encodeURIComponent(courseId)}`).then(setS).catch((e) => setError(e.message));
  }, [open, s, courseId]);

  async function make(body: { prompt?: string; baseId?: string }, what: string) {
    setBusy(what); setError(""); setNote("");
    try {
      const r = await api<{ item: CoverItem; status: Status; fallback: boolean }>("/api/academy/covers", { body: { courseId, ...body } });
      setS(r.status);
      setEditing(null); setChange("");
      if (r.fallback) setNote("Nana's answer couldn't be read, so this one is our own design from your course. It still counted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make the cover.");
    } finally { setBusy(null); }
  }
  async function use(item: CoverItem) {
    setBusy(`use-${item.id}`); setError("");
    try { await onUse(item.url); setNote("Cover saved. Learners see it on the course page."); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save the cover."); } finally { setBusy(null); }
  }

  const out = !!s && s.left <= 0;
  const blocked = !!s && !s.allowance.ok;
  const cant = out || blocked || busy !== null;
  return (
    <div className="mt-3">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-crimson/40 bg-crimson/[0.06] px-4 py-2 font-ui text-sm font-semibold text-crimson hover:bg-crimson/[0.1]">
          <span aria-hidden>✨</span> Make a cover with Nana
        </button>
      ) : (
        <div className="rounded-2xl border border-rule bg-crimson/[0.03] p-4 sm:p-5" data-testid="cover-maker">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-ui text-sm font-semibold text-ink"><span aria-hidden>✨</span> Make a cover with Nana</p>
              <p className="mt-0.5 text-xs text-slate">Nana designs it from your course: our African patterns, an icon and your title, drawn at 1600 × 900.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="font-ui text-xs font-semibold text-slate hover:text-crimson">Close</button>
          </div>

          <label className="mt-3 block">
            <span className="font-ui text-xs font-semibold text-ink">What should it show? <span className="font-normal text-slate">(optional)</span></span>
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={PROMPT_MAX} placeholder="e.g. a farmer with a phone, in green and gold" className={`mt-1 ${field}`} />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => make({ prompt }, "new")} disabled={cant || !s} className="btn-primary !px-5 !py-2 text-sm disabled:opacity-50">{busy === "new" ? "Designing…" : s?.items.length ? "Make another" : "Make a cover"}</button>
            {s && (
              <span className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-eyebrow ${out ? "bg-rule text-slate" : "bg-emerald-100 text-emerald-800"}`} data-testid="covers-left">{leftText(s.left, s.limit)}</span>
            )}
          </div>
          {s && <p className={`mt-2 text-xs ${blocked ? "font-semibold text-crimson" : "text-slate"}`}>{s.allowance.note}</p>}
          {s && out && s.limit > 0 && <p className="mt-1 text-xs text-slate">That&apos;s today&apos;s covers. More from midnight, Lagos time; you can still use or go back to the ones below.</p>}
          {s && s.limit <= 0 && <p className="mt-1 text-xs text-slate">Covers with Nana are on publishing plans. <Link href="/pricing" className="font-semibold text-crimson">See the plans</Link></p>}
          {error && <p role="alert" className="mt-3 rounded-lg bg-[#fbe9ee] px-3 py-2 text-sm text-crimson">{error}</p>}
          {note && !error && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{note}</p>}

          {(busy === "new" || busy?.startsWith("edit-") || (s && s.items.length > 0)) && (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {(busy === "new" || busy?.startsWith("edit-")) && (
                <li className="flex aspect-video animate-pulse items-center justify-center rounded-xl border border-dashed border-crimson/40 bg-card text-sm text-slate">Nana is designing your cover…</li>
              )}
              {s?.items.map((it, i) => (
                <li key={it.id} className="overflow-hidden rounded-xl border border-rule bg-card" data-testid="cover-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.url} alt={`Cover: ${it.spec.headline}`} className="aspect-video w-full object-cover" loading={i > 3 ? "lazy" : undefined} />
                  <div className="p-3">
                    <p className="truncate text-xs text-slate">{it.baseId ? "Edit" : "Cover"}{it.prompt ? `: “${it.prompt}”` : ""} · {new Date(it.at).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" })}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {cover === it.url
                        ? <span className="rounded-full bg-emerald-100 px-3 py-1.5 font-ui text-xs font-semibold text-emerald-800">✓ In use</span>
                        : <button type="button" onClick={() => use(it)} disabled={busy !== null} className="btn-primary !px-4 !py-1.5 text-xs disabled:opacity-50">{busy === `use-${it.id}` ? "Saving…" : "Use as cover"}</button>}
                      <button type="button" onClick={() => { setEditing(editing === it.id ? null : it.id); setChange(""); }} disabled={cant} className="btn-ghost !px-4 !py-1.5 text-xs disabled:opacity-50">Edit</button>
                      {i === 0 && <button type="button" onClick={() => make({ prompt }, "new")} disabled={cant} className="btn-ghost !px-4 !py-1.5 text-xs disabled:opacity-50">Try another</button>}
                    </div>
                    {editing === it.id && (
                      <div className="mt-3">
                        <label className="block"><span className="font-ui text-xs font-semibold text-ink">What should change?</span>
                          <input autoFocus value={change} onChange={(e) => setChange(e.target.value)} maxLength={PROMPT_MAX} placeholder="Make it green, add a laptop, shorter headline…" className={`mt-1 ${field}`}
                            onKeyDown={(e) => { if (e.key === "Enter" && change.trim()) make({ baseId: it.id, prompt: change }, `edit-${it.id}`); }} />
                        </label>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {EDITS.map((x) => <button key={x} type="button" onClick={() => setChange(x)} className="rounded-full border border-rule bg-card px-2.5 py-1 text-xs text-ink hover:border-crimson">{x}</button>)}
                        </div>
                        <button type="button" onClick={() => make({ baseId: it.id, prompt: change }, `edit-${it.id}`)} disabled={cant || !change.trim()} className="btn-primary mt-2 !px-4 !py-1.5 text-xs disabled:opacity-50">{busy === `edit-${it.id}` ? "Changing…" : "Change it (counts 1)"}</button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
