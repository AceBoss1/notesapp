"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { NIGERIAN_STATES } from "@/lib/merch";
import { REPEATS, liveHost, whenText, type EventDoc } from "@/lib/events";
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
        <span className="block text-xs text-slate">{[e.place, e.city, e.state].filter(Boolean).join(", ")}{e.liveUrl ? `${e.place ? " · " : ""}${liveHost(e.liveUrl)}` : ""}</span>
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
  const [f, setF] = useState({
    title: existing?.title ?? "", description: existing?.description ?? "", startsAt: toLocalInput(existing?.startsAt ?? ""), endsAt: toLocalInput(existing?.endsAt ?? ""),
    place: existing?.place ?? "", state: existing?.state ?? "", city: existing?.city ?? "", liveUrl: existing?.liveUrl ?? "",
    repeat: existing?.repeat ?? "none", repeatUntil: existing?.repeatUntil?.slice(0, 10) ?? "", visibility: existing?.visibility ?? "public",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      const body = { ...f, startsAt: fromLocalInput(f.startsAt), endsAt: fromLocalInput(f.endsAt), repeatUntil: f.repeatUntil ? `${f.repeatUntil}T23:00:00+01:00` : "" };
      const r = await capi<{ event: Ev }>("/api/events", existing ? { action: "update", id: existing.id, ...body } : { action: "create", ...(cid ? { cid } : {}), ...body });
      onSaved(r.event);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save the event."); }
    finally { setBusy(false); }
  }, [f, cid, existing, onSaved]);
  return (
    <div className="card p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate sm:col-span-2">Name<input value={f.title} onChange={set("title")} maxLength={120} placeholder="Sunday service, Youth outreach, AGM…" className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate">Starts (Lagos time)<input type="datetime-local" value={f.startsAt} onChange={set("startsAt")} className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate">Ends<input type="datetime-local" value={f.endsAt} onChange={set("endsAt")} className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate">Where<input value={f.place} onChange={set("place")} maxLength={200} placeholder="Venue and address" className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate">City<input value={f.city} onChange={set("city")} maxLength={60} className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate">State<select value={f.state} onChange={set("state")} className={`${field} mt-1`}><option value="">—</option>{NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label className="text-xs text-slate">Join live link (optional)<input value={f.liveUrl} onChange={set("liveUrl")} placeholder="YouTube Live, Facebook Live, Zoom, Google Meet…" className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate">Repeats<select value={f.repeat} onChange={set("repeat")} className={`${field} mt-1`}>{REPEATS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
        {f.repeat !== "none" && <label className="text-xs text-slate">Until (optional)<input type="date" value={f.repeatUntil} onChange={set("repeatUntil")} className={`${field} mt-1`} /></label>}
        {cid && <label className="text-xs text-slate">Who sees it<select value={f.visibility} onChange={set("visibility")} className={`${field} mt-1`}><option value="public">Anyone (listed in Events)</option><option value="members">Members only</option></select></label>}
        <label className="text-xs text-slate sm:col-span-2">Details<textarea value={f.description} onChange={set("description")} maxLength={4000} rows={4} className={`${field} mt-1`} /></label>
      </div>
      <div className="mt-4 flex items-center gap-3"><button className="btn-primary !px-4 !py-2 text-xs" disabled={busy} onClick={save}>{busy ? "Saving…" : existing ? "Save changes" : "Add the event"}</button>{err && <span className="text-sm text-crimson" role="alert">{err}</span>}</div>
      <p className="mt-2 text-xs text-slate">Everyone going or interested gets a reminder 24 hours and 1 hour before.</p>
    </div>
  );
}

export function NewEventButton({ cid, onSaved }: { cid?: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return open ? <div className="mt-4"><EventForm cid={cid} onSaved={() => { setOpen(false); onSaved(); }} /><button className={`${small} mt-2`} onClick={() => setOpen(false)}>Cancel</button></div> : <button className="btn-primary mt-4 !px-4 !py-2 text-xs" onClick={() => setOpen(true)}>Add an event</button>;
}
