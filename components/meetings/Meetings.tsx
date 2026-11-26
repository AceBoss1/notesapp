"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMember } from "@/lib/member-client";
import { NIGERIAN_STATES } from "@/lib/merch";
import { EVENT_CATEGORIES, EVENT_THEMES, FORMATS, cleanTheme, coverStyle, themeOf, whereLine } from "@/lib/event-kit";
import { SEATS_MAX, SEATS_MIN, seatsLeft, type MeetingDoc } from "@/lib/meetings";
import { whenText } from "@/lib/events";
import { formatNaira } from "@/lib/booking-time";
import { POLICY_TEXT } from "@/lib/cancellation";
import { capi, field, small } from "@/components/community/api";
import { startCheckout } from "@/lib/checkout";
import FollowCalendar from "@/components/events/FollowCalendar";

// Meetings (lib/meetings.ts, docs/EVENTS_DISCOVER.md): the form, and a meeting's page (book a seat, give it up, the host's list).
export type Mt = MeetingDoc & { id: string; linkHidden?: boolean };
const toLocalInput = (iso: string) => (iso ? new Date(new Date(iso).getTime() + 3_600_000).toISOString().slice(0, 16) : "");
const fromLocalInput = (v: string) => (v ? new Date(`${v}:00+01:00`).toISOString() : "");

export function MeetingForm({ existing, onSaved }: { existing?: Mt; onSaved: (m: Mt) => void }) {
  const [f, setF] = useState({
    title: existing?.title ?? "", description: existing?.description ?? "", category: existing?.category ?? "", theme: existing?.theme ?? "", pattern: existing?.pattern ?? "none",
    startsAt: toLocalInput(existing?.startsAt ?? ""), endsAt: toLocalInput(existing?.endsAt ?? ""),
    format: existing?.where.format ?? "online", place: existing?.where.place ?? "", state: existing?.where.state ?? "", city: existing?.where.city ?? "", link: existing?.where.link ?? "",
    seats: String(existing?.seats ?? 12), price: existing?.priceKobo ? String(existing.priceKobo / 100) : "", visibility: existing?.visibility ?? "public",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const theme = cleanTheme({ theme: f.theme, pattern: f.pattern }, f.title || "meeting");
  const save = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      const body = { ...f, theme: theme.theme, pattern: theme.pattern, seats: Number(f.seats), priceKobo: Math.round((Number(f.price.replace(/[,\s₦]/g, "")) || 0) * 100), startsAt: fromLocalInput(f.startsAt), endsAt: fromLocalInput(f.endsAt) };
      const r = await capi<{ meeting: Mt }>("/api/meetings", existing ? { action: "update", id: existing.id, ...body } : { action: "create", ...body });
      onSaved(r.meeting);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save the meeting."); }
    finally { setBusy(false); }
  }, [f, existing, onSaved, theme.theme, theme.pattern]);
  return (
    <div className="card p-5">
      <div className="flex h-24 items-end rounded-xl p-3 font-display text-lg" style={coverStyle(theme)}>{f.title || "Your meeting"}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="Theme">
        {EVENT_THEMES.map((t) => <button key={t.id} type="button" aria-label={t.label} aria-pressed={theme.theme === t.id} onClick={() => setF((x) => ({ ...x, theme: t.id }))} className={`h-6 w-6 rounded-full border-2 ${theme.theme === t.id ? "border-ink" : "border-transparent"}`} style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }} />)}
        <label className="ml-2 flex items-center gap-1 text-xs text-slate"><input type="checkbox" checked={f.pattern === "africa"} onChange={(e) => setF((x) => ({ ...x, pattern: e.target.checked ? "africa" : "none" }))} /> African pattern</label>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate sm:col-span-2">Name<input value={f.title} onChange={set("title")} maxLength={120} placeholder="Founder office hours, CV clinic, Excel workshop…" className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate">Starts (Lagos time)<input type="datetime-local" value={f.startsAt} onChange={set("startsAt")} className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate">Ends<input type="datetime-local" value={f.endsAt} onChange={set("endsAt")} className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate">Seats ({SEATS_MIN}–{SEATS_MAX})<input value={f.seats} onChange={set("seats")} inputMode="numeric" className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate">Price per seat, ₦ (empty for free)<input value={f.price} onChange={set("price")} inputMode="numeric" placeholder="e.g. 2000" disabled={!!existing?.booked} className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate">Where it happens<select value={f.format} onChange={set("format")} className={`${field} mt-1`}>{FORMATS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
        <label className="text-xs text-slate">Category<select value={f.category} onChange={set("category")} className={`${field} mt-1`}><option value="">Choose one</option>{EVENT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></label>
        {f.format !== "online" && <>
          <label className="text-xs text-slate">Venue and address<input value={f.place} onChange={set("place")} maxLength={200} className={`${field} mt-1`} /></label>
          <label className="text-xs text-slate">City<input value={f.city} onChange={set("city")} maxLength={60} className={`${field} mt-1`} /></label>
          <label className="text-xs text-slate">State<select value={f.state} onChange={set("state")} className={`${field} mt-1`}><option value="">—</option>{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
        </>}
        {f.format !== "in_person" && <label className="text-xs text-slate">Online link (Zoom, Google Meet, Teams…)<input value={f.link} onChange={set("link")} inputMode="url" placeholder="https://…" className={`${field} mt-1`} /><span className="mt-1 block">Only people with a seat see it.</span></label>}
        <label className="text-xs text-slate">Who can find it<select value={f.visibility} onChange={set("visibility")} className={`${field} mt-1`}><option value="public">On my calendar</option><option value="unlisted">Only people with the link</option></select></label>
        <label className="text-xs text-slate sm:col-span-2">Details<textarea value={f.description} onChange={set("description")} rows={4} maxLength={4000} className={`${field} mt-1`} /></label>
      </div>
      <div className="mt-4 flex items-center gap-3"><button className="btn-primary !px-4 !py-2 text-xs" disabled={busy} onClick={save}>{busy ? "Saving…" : existing ? "Save changes" : "Publish meeting"}</button>{err && <span className="text-sm text-crimson" role="alert">{err}</span>}</div>
      <p className="mt-2 text-xs text-slate">Paid seats carry your plan&apos;s commission, like sessions, and are paid to your bank account after the meeting. Cancellations follow the session policy; if you cancel, everyone is refunded in full.</p>
    </div>
  );
}

type Data = { meeting: Mt; left: number; seat: { status: string; amountKobo: number; refundKobo: number } | null; canManage: boolean; people?: { uid: string; name: string; paid: number }[] };
export function MeetingPage({ id }: { id: string }) {
  const { user } = useMember();
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => capi<Data>(`/api/meetings?id=${id}`).then(setD).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { if (user !== undefined) load(); }, [user, load]);
  if (err) return <p className="card p-6 text-sm text-crimson">{err}</p>;
  if (!d) return <p className="text-sm text-slate">Loading…</p>;
  const m = d.meeting;
  const theme = cleanTheme({ theme: m.theme, pattern: m.pattern }, m.hostUid);
  const booked = d.seat?.status === "booked";
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); await load(); } catch (x) { alert(x instanceof Error ? x.message : "Couldn't do that."); } finally { setBusy(false); } };
  const book = () => act(async () => {
    if (m.priceKobo > 0 && user) await startCheckout(user, { kind: "meeting", meetingId: id }, { payWith: "card" });
    else await capi("/api/meetings", { action: "seat", id });
  });
  return (
    <div>
      <div className="flex min-h-[180px] items-end rounded-2xl p-5" style={coverStyle(theme)}>
        <div><span className="rounded-full bg-black/25 px-2.5 py-1 font-ui text-[11px] font-bold text-white">👥 Meeting</span><h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{m.title}</h1></div>
      </div>
      {m.cancelled && <p className="mt-3 font-semibold text-crimson">This meeting has been cancelled.</p>}
      <div className="mt-5 grid gap-6 lg:grid-cols-[1.3fr,0.9fr]">
        <div className="space-y-3">
          <p className="font-ui text-sm font-bold text-ink">🗓️ {whenText(new Date(m.startsAt), new Date(m.endsAt))}</p>
          <p className="font-ui text-sm font-bold text-ink">{m.where.format === "online" ? "💻" : "📍"} {whereLine(m.where)}</p>
          {m.where.link && <a href={m.where.link} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-block !px-4 !py-2 text-xs">▶ Join online</a>}
          {m.linkHidden && <p className="text-xs text-slate">The online link shows here once you have a seat.</p>}
          <p className="text-sm text-slate">{m.priceKobo ? `${formatNaira(m.priceKobo)} a seat` : "Free"} · {seatsLeft(m)} of {m.seats} seats left</p>
          {!m.cancelled && !d.canManage && (
            !user ? <Link href={`/login?next=/meetings/${id}`} className="btn-primary inline-block !px-4 !py-2 text-xs" style={{ background: themeOf(theme.theme).accent }}>Sign in to book a seat</Link>
              : booked ? <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">✓ You have a seat</span><button disabled={busy} className={small} onClick={() => { if (confirm(m.priceKobo ? `Give up your seat? ${POLICY_TEXT.split(" · ").slice(0, 3).join(" · ")}` : "Give up your seat?")) act(() => capi("/api/meetings", { action: "leave", id })); }}>Give up my seat</button></div>
              : <button disabled={busy || d.left <= 0} onClick={book} className="btn-primary !px-4 !py-2 text-xs" style={{ background: themeOf(theme.theme).accent }}>{d.left <= 0 ? "Full" : m.priceKobo ? `Book a seat · ${formatNaira(m.priceKobo)}` : "Book a free seat"}</button>
          )}
          {m.description && <p className="whitespace-pre-line pt-2 text-ink">{m.description}</p>}
          {m.priceKobo > 0 && <p className="text-xs text-slate">{POLICY_TEXT.split(" · ").slice(0, 3).join(" · ")}</p>}
        </div>
        <aside className="space-y-3">
          <div className="card flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="text-xs text-slate">Hosted by</p><Link href={`/events/calendar/${m.hostUsername}`} className="font-ui text-sm font-bold text-ink">{m.hostName}</Link></div>
            <FollowCalendar username={m.hostUsername} />
          </div>
          {d.canManage && d.people && (
            <div className="card p-4"><p className="font-ui text-sm font-bold">Booked ({d.people.length})</p>
              {!d.people.length ? <p className="mt-1 text-sm text-slate">Nobody yet. Share the link.</p> : <ul className="mt-2 space-y-1 text-sm">{d.people.map((p) => <li key={p.uid} className="flex justify-between"><span>{p.name}</span><span className="text-slate">{p.paid ? formatNaira(p.paid) : "free"}</span></li>)}</ul>}
            </div>
          )}
        </aside>
      </div>
      {d.canManage && !m.cancelled && (
        <div className="mt-8 border-t border-rule pt-6">
          {editing ? <MeetingForm existing={m} onSaved={() => { setEditing(false); load(); }} /> : (
            <div className="flex flex-wrap gap-2">
              <button className={small} onClick={() => setEditing(true)}>Edit</button>
              <button className={small} disabled={busy} onClick={() => { if (confirm("Cancel this meeting? Everyone with a seat is told and refunded in full.")) act(async () => { await capi("/api/meetings", { action: "cancel", id }); router.refresh(); }); }}>Cancel the meeting</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
