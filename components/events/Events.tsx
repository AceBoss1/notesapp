"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { NIGERIAN_STATES } from "@/lib/merch";
import { REPEATS, liveHost, whenText, type EventDoc } from "@/lib/events";
import { EVENT_CATEGORIES, EVENT_THEMES, FORMATS, cleanTheme, coverStyle, whereLine } from "@/lib/event-kit";
import { uploadMarked } from "@/lib/upload";
import { capi, field, small } from "@/components/community/api";

// Events (lib/events.ts): the card, a list (public by state and city, a community's, or what I'm going to) and the form to add or edit one.
export type Ev = EventDoc & { id: string; nextStartAt: string | null };
const duration = (e: Pick<EventDoc, "startsAt" | "endsAt">) => new Date(e.endsAt).getTime() - new Date(e.startsAt).getTime();

export function EventCard({ e }: { e: Ev }) {
  const start = new Date(e.nextStartAt ?? e.startsAt);
  const day = start.toLocaleString("en-NG", { timeZone: "Africa/Lagos", day: "numeric" });
  const mon = start.toLocaleString("en-NG", { timeZone: "Africa/Lagos", month: "short" });
  return (
    <li className="card flex gap-4 p-4">
      <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-crimson/10 text-crimson"><span className="font-display text-xl leading-none">{day}</span><span className="text-[11px] uppercase">{mon}</span></span>
      <Link href={`/events/${e.id}`} className="min-w-0 flex-1">
        <span className="block font-ui text-sm font-bold text-ink">{e.title}</span>
        <span className="block text-xs text-slate">{whenText(start, new Date(start.getTime() + duration(e)))}</span>
        <span className="block text-xs text-slate">{e.format ? whereLine({ format: e.format, place: e.place, city: e.city, online: e.online || "" }) : <>{[e.place, e.city, e.state].filter(Boolean).join(", ")}{e.liveUrl ? `${e.place ? " · " : ""}${liveHost(e.liveUrl)}` : ""}</>}</span>
        <span className="mt-1 block text-xs text-slate">{e.communityName || e.hostName} · {e.going} going{e.interested ? ` · ${e.interested} interested` : ""}{e.repeat !== "none" ? ` · ${REPEATS.find((r) => r.id === e.repeat)?.label.toLowerCase()}` : ""}{e.visibility === "members" ? " · members only" : ""}</span>
      </Link>
    </li>
  );
}

export function EventList({ query, empty }: { query: string; empty: string }) {
  const [list, setList] = useState<Ev[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { setList(null); capi<{ events: Ev[] }>(`/api/events?${query}`).then((d) => setList(d.events)).catch((e) => { setErr(e.message); setList([]); }); }, [query]);
  if (list === null) return <p className="mt-4 text-sm text-slate">Loading…</p>;
  return <>{err && <p className="mt-3 text-sm text-crimson">{err}</p>}{!list.length ? <p className="card mt-4 p-6 text-sm text-slate">{empty}</p> : <ul className="mt-4 grid gap-3">{list.map((e) => <EventCard key={e.id} e={e} />)}</ul>}</>;
}

// datetime-local works in the visitor's own clock; events are Lagos time, so convert both ways (Nigeria is UTC+1 all year).
const toLocalInput = (iso: string) => (iso ? new Date(new Date(iso).getTime() + 3_600_000).toISOString().slice(0, 16) : "");
const fromLocalInput = (v: string) => (v ? new Date(`${v}:00+01:00`).toISOString() : "");

export function EventForm({ cid, existing, onSaved }: { cid?: string; existing?: Ev; onSaved: (e: Ev) => void }) {
  const fmt0 = existing?.format ?? (existing?.place && existing?.liveUrl ? "hybrid" : existing?.liveUrl ? "online" : "in_person");
  const [f, setF] = useState({
    title: existing?.title ?? "", description: existing?.description ?? "", startsAt: toLocalInput(existing?.startsAt ?? ""), endsAt: toLocalInput(existing?.endsAt ?? ""),
    place: existing?.place ?? "", state: existing?.state ?? "", city: existing?.city ?? "", liveUrl: existing?.liveUrl ?? "",
    repeat: existing?.repeat ?? "none", repeatUntil: existing?.repeatUntil?.slice(0, 10) ?? "", visibility: existing?.visibility ?? "public",
    category: existing?.category ?? "", cover: existing?.cover ?? "", theme: existing?.theme ?? "", pattern: existing?.pattern ?? "none",
    format: fmt0 as string, online: (existing?.online || (existing?.liveUrl ? "link" : "notesapp")) as string, capacity: existing?.capacity ? String(existing.capacity) : "",
  });
  const [approval, setApproval] = useState(existing?.approval === true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const theme = cleanTheme({ theme: f.theme, pattern: f.pattern }, f.title || "event");
  async function pickCover(file: File | undefined) {
    if (!file) return;
    setUploading(true); setErr("");
    try { const url = await uploadMarked(file, "event"); setF((x) => ({ ...x, cover: url })); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't upload the picture."); }
    finally { setUploading(false); }
  }
  const save = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      const body = {
        ...f, theme: theme.theme, pattern: theme.pattern, approval, capacity: Number(f.capacity) || 0,
        liveUrl: f.format !== "in_person" && f.online === "link" ? f.liveUrl : "",
        startsAt: fromLocalInput(f.startsAt), endsAt: fromLocalInput(f.endsAt), repeatUntil: f.repeatUntil ? `${f.repeatUntil}T23:00:00+01:00` : "",
      };
      const r = await capi<{ event: Ev }>("/api/events", existing ? { action: "update", id: existing.id, ...body } : { action: "create", ...(cid ? { cid } : {}), ...body });
      onSaved(r.event);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save the event."); }
    finally { setBusy(false); }
  }, [f, cid, existing, onSaved, approval, theme.theme, theme.pattern]);
  const inPerson = f.format !== "online", online = f.format !== "in_person";
  return (
    <div className="card p-5">
      {/* The cover: a picture, or the theme's colours (lib/event-kit.ts) */}
      <div className="relative flex h-40 items-end overflow-hidden rounded-xl p-4" style={f.cover ? { background: `url(${f.cover}) center/cover` } : coverStyle(theme)}>
        {!f.cover && <span className="font-display text-xl leading-tight">{f.title || "Your event"}</span>}
        <label className="absolute right-3 top-3 cursor-pointer rounded-full bg-white/90 px-3 py-1 font-ui text-xs font-bold text-ink shadow">
          {uploading ? "Uploading…" : f.cover ? "Change picture" : "＋ Cover picture"}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickCover(e.target.files?.[0])} />
        </label>
        {f.cover && <button type="button" onClick={() => setF((x) => ({ ...x, cover: "" }))} className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 font-ui text-xs font-bold text-ink shadow">Remove</button>}
      </div>
      <fieldset className="mt-3">
        <legend className="text-xs text-slate">Theme</legend>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {EVENT_THEMES.map((t) => (
            <button key={t.id} type="button" title={t.label} aria-label={t.label} aria-pressed={theme.theme === t.id} onClick={() => setF((x) => ({ ...x, theme: t.id }))}
              className={`h-7 w-7 rounded-full border-2 ${theme.theme === t.id ? "border-ink" : "border-transparent"}`} style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }} />
          ))}
          <label className="ml-2 flex items-center gap-1 text-xs text-slate"><input type="checkbox" checked={f.pattern === "africa"} onChange={(e) => setF((x) => ({ ...x, pattern: e.target.checked ? "africa" : "none" }))} /> African pattern</label>
        </div>
      </fieldset>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate sm:col-span-2">Name<input value={f.title} onChange={set("title")} maxLength={120} placeholder="Sunday service, Product night, AGM…" className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate">Category<select value={f.category} onChange={set("category")} className={`${field} mt-1`}><option value="">Choose one</option>{EVENT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></label>
        <label className="text-xs text-slate">Where it happens<select value={f.format} onChange={set("format")} className={`${field} mt-1`}>{FORMATS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
        <label className="text-xs text-slate">Starts (Lagos time)<input type="datetime-local" value={f.startsAt} onChange={set("startsAt")} className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate">Ends<input type="datetime-local" value={f.endsAt} onChange={set("endsAt")} className={`${field} mt-1`} /></label>
        {inPerson && <>
          <label className="text-xs text-slate">Venue and address<input value={f.place} onChange={set("place")} maxLength={200} placeholder="The Workspace, 12 Herbert Macaulay Way" className={`${field} mt-1`} /></label>
          <label className="text-xs text-slate">City<input value={f.city} onChange={set("city")} maxLength={60} placeholder="Lagos" className={`${field} mt-1`} /></label>
          <label className="text-xs text-slate">State<select value={f.state} onChange={set("state")} className={`${field} mt-1`}><option value="">—</option>{NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        </>}
        {online && <>
          <label className="text-xs text-slate">Online on<select value={f.online} onChange={set("online")} className={`${field} mt-1`}><option value="notesapp">#NotesApp: you go live from your profile</option><option value="link">My own link (Zoom, Meet, Teams, YouTube…)</option></select></label>
          {f.online === "link" && <label className="text-xs text-slate">The link<input value={f.liveUrl} onChange={set("liveUrl")} placeholder="https://…" inputMode="url" className={`${field} mt-1`} /></label>}
        </>}
        <label className="text-xs text-slate">Repeats<select value={f.repeat} onChange={set("repeat")} className={`${field} mt-1`}>{REPEATS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
        {f.repeat !== "none" && <label className="text-xs text-slate">Until (optional)<input type="date" value={f.repeatUntil} onChange={set("repeatUntil")} className={`${field} mt-1`} /></label>}
        <label className="text-xs text-slate">Guest limit (empty for none)<input value={f.capacity} onChange={set("capacity")} inputMode="numeric" placeholder="e.g. 120" className={`${field} mt-1`} /></label>
        <label className="flex items-center gap-2 text-xs text-slate sm:mt-5"><input type="checkbox" checked={approval} onChange={(e) => setApproval(e.target.checked)} /> Needs approval: people ask to join and you accept them (free events only)</label>
        {cid && <label className="text-xs text-slate">Who sees it<select value={f.visibility} onChange={set("visibility")} className={`${field} mt-1`}><option value="public">Anyone (in Discover)</option><option value="members">Members only</option></select></label>}
        <label className="text-xs text-slate sm:col-span-2">Details<textarea value={f.description} onChange={set("description")} maxLength={4000} rows={4} className={`${field} mt-1`} /></label>
      </div>
      <div className="mt-4 flex items-center gap-3"><button className="btn-primary !px-4 !py-2 text-xs" disabled={busy || uploading} onClick={save}>{busy ? "Saving…" : existing ? "Save changes" : "Publish event"}</button>{err && <span className="text-sm text-crimson" role="alert">{err}</span>}</div>
      <p className="mt-2 text-xs text-slate">Everyone going gets a reminder 24 hours and 1 hour before. People who follow you hear about a new public event. Paid tickets are added after you publish.{online && f.online === "link" ? " With tickets or approval, the link is shown only to people who are in." : ""}</p>
    </div>
  );
}

export function NewEventButton({ cid, onSaved }: { cid?: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return open ? <div className="mt-4"><EventForm cid={cid} onSaved={() => { setOpen(false); onSaved(); }} /><button className={`${small} mt-2`} onClick={() => setOpen(false)}>Cancel</button></div> : <button className="btn-primary mt-4 !px-4 !py-2 text-xs" onClick={() => setOpen(true)}>Add an event</button>;
}
