"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { REPEATS, liveHost, whenText, type Rsvp } from "@/lib/events";
import { capi, small } from "@/components/community/api";
import { EventForm, type Ev } from "./Events";
import { BuyTickets, MyTickets, TicketTypesEditor, type TicketOffer } from "./Tickets";

// One event: when and where (the next time, for a repeating one), the host, Going and Interested, Add to calendar, the Join live link,
// and, for its host or its community's admins, edit and cancel.
type Data = { event: Ev; next: { start: string; end: string } | null; rsvp: Rsvp | null; canManage: boolean; tickets: TicketOffer[] };

export default function EventDetail({ id }: { id: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const load = useCallback(() => capi<Data>(`/api/events?id=${id}`).then((x) => { setD(x); setErr(""); }).catch((e) => setErr(e.message)), [id]);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => { if (user !== undefined) load(); }, [user, load]);
  if (err) return <p className="card p-6 text-sm text-crimson">{err}</p>;
  if (!d) return <p className="text-sm text-slate">Loading…</p>;
  const e = d.event;
  const start = new Date(d.next?.start ?? e.startsAt), end = new Date(d.next?.end ?? e.endsAt);
  const rsvp = async (status: Rsvp | null) => { try { await capi("/api/events", { action: "rsvp", id, status }); load(); } catch (x) { alert(x instanceof Error ? x.message : "Couldn't save."); } };
  return (
    <div>
      <p className="eyebrow">{e.communityName ? <Link href={`/c/${e.cid}`}>{e.communityName}</Link> : <Link href={`/u/${e.hostUsername}`}>{e.hostName}</Link>}{e.visibility === "members" ? " · members only" : ""}</p>
      <h1 className="mt-2 font-display text-4xl text-ink">{e.title}</h1>
      {e.cancelled && <p className="mt-2 font-semibold text-crimson">This event has been cancelled.</p>}
      <p className="mt-3 text-ink">{d.next || !e.cancelled ? whenText(start, end) : ""}{e.repeat !== "none" ? ` · ${REPEATS.find((r) => r.id === e.repeat)?.label}` : ""}</p>
      {(e.place || e.city || e.state) && <p className="text-slate">{[e.place, e.city, e.state].filter(Boolean).join(", ")}</p>}
      <p className="mt-2 text-sm text-slate">{e.going} going · {e.interested} interested</p>
      {!e.cancelled && (
        <div className="mt-5 flex flex-wrap gap-2">
          {user ? ((d.tickets?.length ? ["interested"] : ["going", "interested"]) as Rsvp[]).map((s) => (
            <button key={s} onClick={() => rsvp(d.rsvp === s ? null : s)} className={d.rsvp === s ? "btn-primary !px-4 !py-2 text-xs" : `${small} !px-4 !py-2`} aria-pressed={d.rsvp === s}>{d.rsvp === s ? "✓ " : ""}{s === "going" ? "Going" : "Interested"}</button>
          )) : <Link href={`/login?next=/events/${id}`} className="btn-primary !px-4 !py-2 text-xs">Sign in to say you&apos;re going</Link>}
          {e.visibility === "public" && <a href={`/api/events/${id}/ics`} className={`${small} !px-4 !py-2`}>Add to calendar</a>}
          {e.liveUrl && <a href={e.liveUrl} target="_blank" rel="noopener noreferrer" className={`${small} !px-4 !py-2`}>▶ {liveHost(e.liveUrl)}</a>}
        </div>
      )}
      {!e.cancelled && d.next && d.tickets?.length > 0 && !d.canManage && <BuyTickets eventId={id} offers={d.tickets} signedIn={!!user} />}
      {user && <MyTickets eventId={id} />}
      {e.description && <p className="mt-6 whitespace-pre-line text-ink">{e.description}</p>}
      {d.canManage && !e.cancelled && (
        <div className="mt-8 border-t border-rule pt-6">
          {d.tickets?.length > 0 && <p className="mb-4 text-sm text-slate">Tickets: {d.tickets.map((t) => `${t.name} ${t.sold ?? 0}/${t.quantity ?? 0} sold`).join(" · ")}</p>}
          {editing ? <EventForm existing={e} onSaved={() => { setEditing(false); load(); }} /> : (
            <div className="flex flex-wrap gap-2"><button className={small} onClick={() => setEditing(true)}>Edit</button>{d.tickets?.length > 0 && <Link href={`/events/${id}/checkin`} className={small}>Check-in</Link>}<button className={small} onClick={async () => { if (confirm("Cancel this event? Everyone going or interested is told.")) { await capi("/api/events", { action: "cancel", id }); load(); } }}>Cancel the event</button></div>
          )}
          {!editing && <TicketTypesEditor key={d.tickets.map((t) => t.id).join()} eventId={id} offers={d.tickets} onSaved={load} />}
        </div>
      )}
    </div>
  );
}
