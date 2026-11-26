"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { REPEATS, liveHost, whenText, type Rsvp } from "@/lib/events";
import { categoryOf, cleanTheme, coverStyle, themeOf, whereLine } from "@/lib/event-kit";
import { capi, small } from "@/components/community/api";
import { recordView } from "@/lib/track";
import { EventForm, type Ev } from "./Events";
import { BuyTickets, MyTickets, TicketTypesEditor, type TicketOffer } from "./Tickets";
import FollowCalendar from "./FollowCalendar";
import InvitePanel from "./InvitePanel";
import { ShareButton } from "@/components/share/ShareToNotesApp";

// One event (docs/EVENTS_DISCOVER.md): the cover or the theme, when and where (in person, online or both), Going / Request to join /
// tickets, the calendar it belongs to with Follow, and for its host: requests to accept, edit, tickets, check-in and cancel.
type Data = { event: Ev & { linkHidden?: boolean }; next: { start: string; end: string } | null; rsvp: Rsvp | null; canManage: boolean; tickets: TicketOffer[] };
type Person = { uid: string; name: string; username: string; avatar: string; at: string };

function Requests({ id, onDone }: { id: string; onDone: () => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const load = useCallback(() => capi<{ people: Person[] }>(`/api/events?requests=${id}`).then((r) => setPeople(r.people)).catch(() => setPeople([])), [id]);
  useEffect(() => { load(); }, [load]);
  if (!people) return null;
  const decide = async (who: string, accept: boolean) => {
    try { await capi("/api/events", { action: "decide", id, who, accept }); await load(); onDone(); }
    catch (x) { alert(x instanceof Error ? x.message : "Couldn't save."); }
  };
  return (
    <section id="requests" className="card mt-6 p-4">
      <h2 className="font-ui text-sm font-bold">Asking to join ({people.length})</h2>
      {!people.length ? <p className="mt-2 text-sm text-slate">Nobody is waiting.</p> : (
        <ul className="mt-2 divide-y divide-rule">
          {people.map((p) => (
            <li key={p.uid} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.avatar || "/images/headshots/default-avatar.png"} alt="" className="h-8 w-8 rounded-full object-cover" />
              <Link href={`/u/${p.username}`} className="min-w-0 flex-1 font-semibold text-ink">{p.name || p.username}</Link>
              <button className="btn-primary !px-3 !py-1 text-xs" onClick={() => decide(p.uid, true)}>Accept</button>
              <button className={small} onClick={() => decide(p.uid, false)}>Decline</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function EventDetail({ id }: { id: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const load = useCallback(() => capi<Data>(`/api/events?id=${id}`).then((x) => { setD(x); setErr(""); }).catch((e) => setErr(e.message)), [id]);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => { if (user !== undefined) load(); }, [user, load]);
  // A visit to a public event counts towards Trending → Events (the organiser's own visits don't).
  const countable = !!d && d.event.visibility === "public" && !d.event.cancelled && !d.canManage;
  useEffect(() => { if (countable) recordView("event", id); }, [countable, id]);
  if (err) return <p className="card p-6 text-sm text-crimson">{err}</p>;
  if (!d) return <p className="text-sm text-slate">Loading…</p>;
  const e = d.event;
  const start = new Date(d.next?.start ?? e.startsAt), end = new Date(d.next?.end ?? e.endsAt);
  const theme = cleanTheme({ theme: e.theme, pattern: e.pattern }, e.hostUid);
  const accent = themeOf(theme.theme).accent;
  const cat = categoryOf(e.category);
  const format = e.format ?? (e.place && e.liveUrl ? "hybrid" : e.liveUrl ? "online" : "in_person");
  const full = !!e.capacity && e.going >= e.capacity;
  const paid = d.tickets?.length > 0;
  const rsvp = async (status: Rsvp | null) => { try { await capi("/api/events", { action: "rsvp", id, status }); load(); } catch (x) { alert(x instanceof Error ? x.message : "Couldn't save."); } };
  const day = start.toLocaleString("en-NG", { timeZone: "Africa/Lagos", day: "numeric" });
  const mon = start.toLocaleString("en-NG", { timeZone: "Africa/Lagos", month: "short" }).toUpperCase();
  const goingLabel = d.rsvp === "going" ? "✓ You're going" : d.rsvp === "requested" ? "Asked to join · waiting" : e.approval ? "Request to join" : "Register";
  return (
    <div>
      <div className="flex min-h-[220px] items-end overflow-hidden rounded-2xl p-5 sm:min-h-[300px]" style={e.cover ? { background: `linear-gradient(180deg, transparent 45%, rgba(0,0,0,.6)), url(${e.cover}) center/cover`, color: "#fff" } : coverStyle(theme)}>
        <div>
          {cat && <span className="rounded-full bg-black/25 px-2.5 py-1 font-ui text-[11px] font-bold text-white">{cat.icon} {cat.label}</span>}
          <h1 className="mt-2 font-display text-3xl leading-tight sm:text-5xl">{e.title}</h1>
        </div>
      </div>
      {e.cancelled && <p className="mt-3 font-semibold text-crimson">This event has been cancelled.</p>}
      <div className="mt-5 grid gap-6 lg:grid-cols-[1.3fr,0.9fr]">
        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-rule bg-card text-[10px] font-bold text-slate">{mon}<b className="font-display text-lg leading-none text-ink">{day}</b></span>
            <div><p className="font-ui text-sm font-bold text-ink">{d.next || !e.cancelled ? whenText(start, end) : ""}</p>{e.repeat !== "none" && <p className="text-xs text-slate">{REPEATS.find((r) => r.id === e.repeat)?.label}</p>}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rule bg-card text-lg">{format === "online" ? "💻" : "📍"}</span>
            <div>
              <p className="font-ui text-sm font-bold text-ink">{whereLine({ format, place: e.place, city: e.city, online: e.online || (e.liveUrl ? "link" : "") }) || "Where: see the details"}</p>
              {e.state && format !== "online" && <p className="text-xs text-slate">{e.state} State</p>}
              {e.linkHidden && <p className="text-xs text-slate">The online link shows here once you&apos;re in.</p>}
            </div>
          </div>
          <p className="text-sm text-slate">{e.going} going{e.capacity ? ` of ${e.capacity}` : ""}{e.interested ? ` · ${e.interested} interested` : ""}{d.canManage && e.requested ? ` · ${e.requested} asking to join` : ""}</p>
          {!e.cancelled && (
            <div className="flex flex-wrap gap-2">
              {!user ? <Link href={`/login?next=/events/${id}`} className="btn-primary !px-4 !py-2 text-xs" style={{ background: accent }}>{paid ? "Sign in to get tickets" : e.approval ? "Sign in to ask to join" : "Sign in to register"}</Link> : <>
                {!paid && !d.canManage && (
                  <button onClick={() => rsvp(d.rsvp === "going" || d.rsvp === "requested" ? null : "going")} disabled={full && d.rsvp !== "going"} aria-pressed={d.rsvp === "going"}
                    className={d.rsvp ? `${small} !px-4 !py-2` : "btn-primary !px-4 !py-2 text-xs"} style={d.rsvp ? undefined : { background: accent }}>{full && !d.rsvp ? "Full" : goingLabel}</button>
                )}
                <button onClick={() => rsvp(d.rsvp === "interested" ? null : "interested")} className={`${small} !px-4 !py-2`} aria-pressed={d.rsvp === "interested"}>{d.rsvp === "interested" ? "✓ " : ""}Interested</button>
              </>}
              {e.visibility === "public" && <a href={`/api/events/${id}/ics`} className={`${small} !px-4 !py-2`}>Add to calendar</a>}
              {e.liveUrl && <a href={e.liveUrl} target="_blank" rel="noopener noreferrer" className={`${small} !px-4 !py-2`}>▶ {liveHost(e.liveUrl)}</a>}
              {format !== "in_person" && e.online === "notesapp" && <Link href={`/u/${e.hostUsername}`} className={`${small} !px-4 !py-2`}>▶ Watch on #NotesApp</Link>}
              {e.visibility === "public" && <ShareButton shareRef={{ kind: "event", id }} path={`/events/${id}`} title={e.title} className={`${small} !px-4 !py-2`} />}
            </div>
          )}
          {!e.cancelled && d.next && paid && !d.canManage && <BuyTickets eventId={id} offers={d.tickets} signedIn={!!user} />}
          {user && <MyTickets eventId={id} />}
          {e.description && <p className="whitespace-pre-line text-ink">{e.description}</p>}
        </div>
        <aside className="space-y-3">
          <div className="card flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate">{e.cid ? "Community" : "Calendar"}</p>
              {e.cid ? <Link href={`/c/${e.cid}`} className="font-ui text-sm font-bold text-ink">{e.communityName}</Link> : <Link href={`/events/calendar/${e.hostUsername}`} className="font-ui text-sm font-bold text-ink">{e.hostName}</Link>}
              {e.visibility === "members" && <p className="text-xs text-slate">Members only</p>}
            </div>
            {!e.cid && <FollowCalendar username={e.hostUsername} />}
          </div>
          {e.approval && !d.canManage && <p className="card p-3 text-xs text-slate">The host accepts each person. You&apos;ll get a bell and an email when they answer.</p>}
        </aside>
      </div>
      {d.canManage && !e.cancelled && e.visibility === "public" && <div className="mt-6"><InvitePanel kind="event" id={id} /></div>}
      {d.canManage && !e.cancelled && e.approval && <Requests id={id} onDone={load} />}
      {d.canManage && !e.cancelled && (
        <div className="mt-8 border-t border-rule pt-6">
          {paid && <p className="mb-4 text-sm text-slate">Tickets: {d.tickets.map((t) => `${t.name} ${t.sold ?? 0}/${t.quantity ?? 0} sold`).join(" · ")}</p>}
          {editing ? <EventForm existing={e} onSaved={() => { setEditing(false); load(); }} /> : (
            <div className="flex flex-wrap gap-2"><button className={small} onClick={() => setEditing(true)}>Edit</button>{paid && <Link href={`/events/${id}/checkin`} className={small}>Check-in</Link>}<button className={small} onClick={async () => { if (confirm("Cancel this event? Everyone going or interested is told.")) { await capi("/api/events", { action: "cancel", id }); load(); } }}>Cancel the event</button></div>
          )}
          {!editing && !e.approval && <TicketTypesEditor key={d.tickets.map((t) => t.id).join()} eventId={id} offers={d.tickets} onSaved={load} />}
        </div>
      )}
    </div>
  );
}
