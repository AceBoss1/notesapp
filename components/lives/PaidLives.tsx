"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import { formatNaira } from "@/lib/booking-time";
import { PAYOUT_HOLD_HOURS } from "@/lib/cancellation";
import { BAND_NAME, LIVE_AUDIENCES, LIVE_RECORD_CHOICES, liveTicketRate, pctText, quoteLiveTicket, recordNotice, type LiveAudience, type LiveBand, type LiveRecordChoice } from "@/lib/live-tickets";
import { TIER_NAME, type SubTier } from "@/lib/fans";
import { DEFAULT_PAID_FIGURES, type PaidLiveFigures } from "@/lib/rooms";
import type { PosterSource } from "@/lib/rooms-live";
import { useMyRates } from "@/components/MyCommission";
import { PosterChoice, RoomScreen } from "@/components/community/AudioRoom";
import { capi } from "@/components/community/api";

// Paid lives (lib/live-tickets.ts): the "Schedule a paid live" form, the lobby (/lives/[id]: the ticket, buying one, the door and the
// room) and the list (/lives). The approved mockups are docs/LIVE_ECONOMY.md's 1-create-event and 2-paid-lobby.

type Figures = PaidLiveFigures & { upliftPct: number };
export function usePaidFigures(): Figures {
  const [f, setF] = useState<Figures>({ ...DEFAULT_PAID_FIGURES, upliftPct: 10 });
  useEffect(() => { fetch("/api/lives?figures=1").then((r) => r.json()).then((j) => j.figures && setF(j.figures)).catch(() => {}); }, []);
  return f;
}
function useUser(): User | null | undefined {
  const [u, setU] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setU), []);
  return u;
}
// Wall-clock Lagos (UTC+1, no daylight saving) for datetime-local inputs, and back.
const toLagosInput = (d: Date) => new Date(d.getTime() + 3_600_000).toISOString().slice(0, 16);
const fromLagosInput = (v: string) => (v ? new Date(`${v}:00+01:00`).toISOString() : "");
const lagos = (iso: string, o: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) => new Date(iso).toLocaleString("en-NG", { timeZone: "Africa/Lagos", hour12: true, ...o });
const seg = (on: boolean, dark = false) => `rounded-full px-4 py-2 font-ui text-sm ${on ? "bg-crimson text-paper" : dark ? "border border-white/20 text-white" : "border border-rule bg-card text-ink hover:border-crimson"}`;
const fieldCls = "w-full rounded-2xl border border-rule bg-card px-4 py-3 text-base outline-none focus:border-crimson";
const label = "mb-1.5 block font-ui text-sm font-semibold text-slate";

// ── Schedule a paid live (/lives/new) ──
export function CreateLive() {
  const router = useRouter();
  const user = useUser();
  const fig = usePaidFigures();
  const rates = useMyRates();
  const start0 = (() => { const d = new Date(Date.now() + 10 * 86_400_000); const s = toLagosInput(d).slice(0, 10); return `${s}T19:00`; })();
  const early0 = (() => { const d = new Date(Date.parse(fromLagosInput(start0)) - 5 * 86_400_000); return `${toLagosInput(d).slice(0, 10)}T23:59`; })();
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState(start0);
  const [earlyUntil, setEarlyUntil] = useState(early0);
  const [prices, setPrices] = useState({ early: "2000", normal: "3000", late: "4000" });
  const [audience, setAudience] = useState<LiveAudience>("everyone");
  const [record, setRecord] = useState<LiveRecordChoice>("off");
  const [poster, setPoster] = useState<{ source: PosterSource; url?: string; preview?: string }>({ source: "none" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const rate = rates?.session ?? null;
  const earlyKobo = Math.round(Number(prices.early) * 100) || 0;
  const keep = rate === null ? null : quoteLiveTicket(earlyKobo, 0, rate, fig.upliftPct);
  async function submit() {
    setBusy(true); setErr("");
    try {
      const r = await capi<{ event: { id: string } }>("/api/lives", {
        action: "create", title, startsAt: fromLagosInput(startsAt), earlyUntil: fromLagosInput(earlyUntil),
        earlyNaira: Number(prices.early), normalNaira: Number(prices.normal), lateNaira: Number(prices.late), audience, record,
        ...(poster.source !== "none" ? { poster: { source: poster.source, url: poster.url } } : {}),
      });
      router.push(`/lives/${r.event.id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't schedule the live."); setBusy(false); }
  }
  const tile = (k: "early" | "normal" | "late", name: string, sub: React.ReactNode) => (
    <div className="min-w-0 rounded-2xl border border-rule bg-card p-3">
      <span className="block font-ui text-sm font-semibold text-slate">{name}</span>
      <label className="mt-1 flex items-baseline gap-0.5 font-display text-2xl font-bold text-crimson"><span>₦</span>
        <input aria-label={`${name} price`} inputMode="numeric" value={prices[k]} onChange={(e) => setPrices({ ...prices, [k]: e.target.value.replace(/[^\d]/g, "") })} className="w-full min-w-0 bg-transparent outline-none" />
      </label>
      <span className="mt-1 block text-[12.5px] leading-snug text-slate">{sub}</span>
    </div>
  );
  return (
    <div>
      <p className="eyebrow">Lives · New paid live</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Schedule a paid live</h1>
      {user === null && <p className="mt-4 text-sm text-slate"><Link href="/login?next=/lives/new" className="text-crimson underline">Sign in</Link> to schedule a paid live.</p>}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <label className="block"><span className={label}>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Raising your first ₦5m: live Q&A" className={fieldCls} /></label>
          <label className="mt-4 block"><span className={label}>Date and time (Lagos)</span><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={fieldCls} /></label>
          <div className="mt-4"><span className={label}>Prices</span>
            <div className="grid grid-cols-3 gap-2.5">
              {tile("early", "Early bird", earlyUntil ? `until ${lagos(fromLagosInput(earlyUntil), { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : "until a date you pick")}
              {tile("normal", "Normal", "until the start")}
              {tile("late", "Late", `first ${fig.lateWindowMin} min of the live`)}
            </div>
          </div>
          <label className="mt-4 block"><span className={label}>Early bird price ends (Lagos)</span><input type="datetime-local" value={earlyUntil} onChange={(e) => setEarlyUntil(e.target.value)} className={fieldCls} /></label>
          <div className="mt-4"><PosterChoice light value={poster} onChange={setPoster} onError={setErr} /></div>
        </div>
        <div className="card p-5">
          <div><span className={label}>Who can buy a ticket</span>
            <div className="flex flex-wrap gap-2">{LIVE_AUDIENCES.map((a) => <button key={a.id} type="button" aria-pressed={audience === a.id} onClick={() => setAudience(a.id)} className={seg(audience === a.id)}>{a.label}</button>)}</div>
            {audience !== "everyone" && <p className="mt-1.5 text-xs text-slate">Subscribers of your {audience === "premium" ? "Premium, VIP and VVIP" : "VIP and VVIP"} tiers can buy; they still pay, less the discount you set for their tier under Rates &amp; payouts → Subscriptions.</p>}
          </div>
          <div className="mt-4"><span className={label}>Recording</span>
            <div className="flex flex-wrap gap-2">{LIVE_RECORD_CHOICES.map((c) => <button key={c.id} type="button" aria-pressed={record === c.id} onClick={() => setRecord(c.id)} className={seg(record === c.id)}>{c.label}</button>)}</div>
            <p className="mt-1.5 text-[12.5px] text-slate">{record === "off" ? "Nobody is recorded (Admin may still record every live for safety; everyone is told if so)." : `Everyone hears "This live is being recorded" as they join. Speakers agree before their mic goes on.${record === "safety" ? " Kept for safety review only, never offered as a replay." : ""}`}</p>
          </div>
          <div className="mt-4"><span className={label}>You keep</span>
            <p className="m-0 text-base text-ink">{keep && rate !== null
              ? <>{formatNaira(earlyKobo)} ticket at your {pctText(rate)} rate + {fig.upliftPct}% of it ({pctText(liveTicketRate(rate, fig.upliftPct))}): <b>{formatNaira(keep.netKobo)}</b> each. Paid out after the live plus {PAYOUT_HOLD_HOURS} h.</>
              : <>Your rate plus {fig.upliftPct}% of it comes off each ticket. Paid out after the live plus {PAYOUT_HOLD_HOURS} h.</>}</p>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={busy || !user || title.trim().length < 3} onClick={submit}>{busy ? "Scheduling…" : "Schedule live"}</button>
            <span className="text-[12.5px] text-slate">Ticket holders get reminders a day, an hour and at the start.</span>
          </div>
          {err && <p className="mt-3 text-sm text-crimson" role="alert">{err}</p>}
          <p className="mt-3 text-[12px] text-slate">If you cancel, or don&apos;t open the live within {fig.noShowMin} minutes of its time, everyone is refunded to their NotesApp Credit automatically.</p>
        </div>
      </div>
    </div>
  );
}

// ── The lobby (/lives/[id]) ──
type Lobby = {
  event: { id: string; title: string; description: string; poster: string; hostUid: string; hostName: string; hostUsername: string; startsAt: string; earlyUntil: string; prices: { earlyKobo: number; normalKobo: number; lateKobo: number }; audience: LiveAudience; audienceLabel: string; record: LiveRecordChoice; recordNotice: string; lateWindowMin: number; lateClosesAt: string | null; status: "scheduled" | "live" | "ended" | "cancelled"; startedAt: string | null; roomId: string | null; sold?: number };
  now: string;
  band: { band: LiveBand; name: string; listKobo: number; payKobo: number; until: string | null } | null;
  bands: { band: LiveBand; name: string; listKobo: number; payKobo: number }[];
  tier: string | null; discountPct: number; isHost: boolean; canBuy: boolean; why: string;
  ticket: { ref: string; band: LiveBand; bandName: string; paidKobo: number; discountPct: number; status: "valid" | "refunded"; checkedInAt: string | null } | null;
};
function untilText(mins: number) { return mins <= 1 ? "1 min" : mins < 90 ? `${mins} min` : mins < 48 * 60 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} days`; }

export function LiveLobby({ id }: { id: string }) {
  const user = useUser();
  const [d, setD] = useState<Lobby | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [room, setRoom] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const load = useCallback(() => capi<Lobby>(`/api/lives?id=${encodeURIComponent(id)}`).then((x) => { setD(x); setErr(""); }).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't load the live.")), [id]);
  useEffect(() => { if (user !== undefined) void load(); }, [user, load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); const r = setInterval(() => void load(), 30_000); return () => { clearInterval(t); clearInterval(r); }; }, [load]);
  if (room && user) return <RoomScreen id={room} me={user.uid} title={d?.event.title} onDone={() => { setRoom(null); void load(); }} />;
  const e = d?.event;
  const act = async (what: string, fn: () => Promise<unknown>) => { setBusy(what); setErr(""); try { await fn(); } catch (x) { setErr(x instanceof Error ? x.message : "Something went wrong."); } finally { setBusy(""); } };
  const enter = () => act("enter", async () => { const r = await capi<{ roomId: string }>("/api/lives", { action: "enter", id }); setRoom(r.roomId); });
  const goLive = () => act("start", async () => { const r = await capi<{ roomId: string }>("/api/lives", { action: "start", id }); setRoom(r.roomId); });
  const cancel = () => confirm("Cancel this live? Everyone who bought a ticket gets it back as NotesApp Credit.") && act("cancel", async () => { await capi("/api/lives", { action: "cancel", id }); await load(); });
  const buy = () => act("buy", async () => { if (!user || !d?.band) return; await startCheckout(user, { kind: "live_ticket", eventId: id }, { amountKobo: d.band.payKobo }); });
  const mins = e ? Math.round((Date.parse(e.startsAt) - now) / 60_000) : 0;
  const head = !e ? "" : e.status === "cancelled" ? "Cancelled" : e.status === "ended" ? "Ended" : e.status === "live" ? "● Live now" : mins <= 0 ? "● Starting now" : mins < 24 * 60 ? `● Live in ${untilText(mins)}` : `${lagos(e.startsAt)} (Lagos)`;
  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#1A1210] px-4 pb-16 pt-10 text-white" data-theme-off>
      <div className="mx-auto max-w-[560px] text-center">
        {!d && !err && <p className="text-white/60">Loading…</p>}
        {err && !d && <p className="text-[#FFB4A2]" role="alert">{err}</p>}
        {e && d && <>
          <p className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-[#E8B23A]">{head} · {e.hostName || `@${e.hostUsername}`}</p>
          <h1 className="mt-3 font-display text-[30px] font-bold leading-tight">{e.title}</h1>
          {e.poster && /* eslint-disable-next-line @next/next/no-img-element */ <img src={e.poster} alt="" className="mx-auto mt-4 max-h-48 rounded-2xl object-cover" />}
          {e.description && <p className="mt-3 text-sm text-white/75">{e.description}</p>}

          {d.isHost ? (
            <div className="mx-auto mt-6 max-w-[420px] rounded-[20px] bg-[#FBF6F2] p-5 text-left text-ink">
              <div className="flex items-center justify-between"><b>You&apos;re the host</b><span className="rounded-full border border-rule px-2 py-0.5 text-[11.5px] font-bold">{e.sold ?? 0} sold</span></div>
              <p className="mt-1.5 text-[12.5px] text-slate">{lagos(e.startsAt)} (Lagos) · Early bird {formatNaira(e.prices.earlyKobo)} until {lagos(e.earlyUntil)} · Normal {formatNaira(e.prices.normalKobo)} · Late {formatNaira(e.prices.lateKobo)} for the first {e.lateWindowMin} min · {e.audienceLabel}</p>
              <div className="mt-3 rounded-xl bg-[#FFF4D6] p-2.5 text-[13px]">● {e.recordNotice}</div>
              {(e.status === "scheduled" || e.status === "live" || e.status === "ended") && <button className="btn-primary mt-3.5 w-full" disabled={!!busy || e.status === "ended"} onClick={goLive}>{busy === "start" ? "Opening…" : e.status === "live" ? "Back to the live" : "Go live"}</button>}
              {e.status === "scheduled" && <button className="mt-2 w-full text-xs text-slate underline" disabled={!!busy} onClick={cancel}>Cancel this live and refund everyone</button>}
              <p className="mt-2 text-[11.5px] text-slate">You can open the room from 15 minutes before the start. Name moderators from inside the room; only the moderators you name can moderate.</p>
            </div>
          ) : d.ticket?.status === "valid" ? (
            <div className="mx-auto mt-6 max-w-[420px] rounded-[20px] bg-[#FBF6F2] p-5 text-left text-ink">
              <div className="flex items-center justify-between"><b>Your ticket</b>{d.ticket.checkedInAt
                ? <span className="rounded-full border border-[#BFD6C6] bg-[#EAF3EC] px-2 py-0.5 text-[11.5px] font-bold text-[#3D5A45]">✓ Checked</span>
                : <span className="rounded-full border border-[#BFD6C6] bg-[#EAF3EC] px-2 py-0.5 text-[11.5px] font-bold text-[#3D5A45]">Valid</span>}</div>
              <p className="mb-3 mt-1.5 text-[12.5px] text-slate">{d.ticket.bandName} · {formatNaira(d.ticket.paidKobo)}{d.ticket.discountPct ? ` (${d.ticket.discountPct}% subscriber discount)` : ""} · Ref {d.ticket.ref}</p>
              <div className="rounded-xl bg-[#FFF4D6] p-2.5 text-[13px]">● {e.recordNotice}</div>
              <button className="btn-primary mt-3.5 w-full" disabled={!!busy || e.status !== "live"} onClick={enter}>{busy === "enter" ? "Checking your ticket…" : e.status === "live" ? "Enter the live" : e.status === "ended" ? "This live has ended" : "Opens when the host starts"}</button>
            </div>
          ) : (
            <div className="mx-auto mt-6 max-w-[420px] rounded-[20px] bg-[#FBF6F2] p-5 text-left text-ink">
              <b>{e.status === "cancelled" ? "This live was cancelled" : d.band ? `${d.band.name} ticket` : "Tickets"}</b>
              {d.ticket?.status === "refunded" && <p className="mt-1 text-[12.5px] text-slate">Your ticket was refunded to your NotesApp Credit.</p>}
              <ul className="mt-2 space-y-1 text-[13px]">
                {d.bands.map((b) => (
                  <li key={b.band} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${d.band?.band === b.band ? "bg-[#FFF4D6] font-semibold" : "text-slate"}`}>
                    <span>{BAND_NAME[b.band]}<span className="ml-1 text-[11.5px] font-normal text-slate">{b.band === "early" ? `until ${lagos(e.earlyUntil)}` : b.band === "normal" ? "until the start" : `first ${e.lateWindowMin} min`}</span></span>
                    <span>{d.discountPct ? <><s className="mr-1 text-slate">{formatNaira(b.listKobo)}</s>{formatNaira(b.payKobo)}</> : formatNaira(b.listKobo)}</span>
                  </li>
                ))}
              </ul>
              {d.discountPct > 0 && <p className="mt-2 text-[12px] text-[#3D5A45]">Your {TIER_NAME[(d.tier ?? "premium") as SubTier]} subscription takes {d.discountPct}% off.</p>}
              <div className="mt-3 rounded-xl bg-[#FFF4D6] p-2.5 text-[13px]">● {e.recordNotice}</div>
              {d.canBuy && d.band
                ? <button className="btn-primary mt-3.5 w-full" disabled={!!busy} onClick={buy}>{busy === "buy" ? "Starting…" : `Buy ${d.band.name.toLowerCase()} ticket · ${formatNaira(d.band.payKobo)}`}</button>
                : user === null && d.band ? <Link href={`/login?next=/lives/${id}`} className="btn-primary mt-3.5 block w-full text-center">Sign in to buy a ticket</Link>
                : <p className="mt-3 text-[13px] text-slate">{d.why}</p>}
              {d.band?.until && d.canBuy && <p className="mt-2 text-center text-[11.5px] text-slate">This price until {lagos(d.band.until, { hour: "numeric", minute: "2-digit", ...(Date.parse(d.band.until) - now > 86_400_000 ? { weekday: "short", day: "numeric", month: "short" } : {}) })} (Lagos). Pay from NotesApp Credit or by card.</p>}
            </div>
          )}

          {err && <p className="mt-3 text-sm text-[#FFB4A2]" role="alert">{err}</p>}
          {(d.ticket?.status === "valid" || d.isHost) && (e.status === "scheduled" || e.status === "live") && !(e.lateClosesAt && Date.parse(e.lateClosesAt) <= now) && (
            <p className="mt-4 text-[12.5px] text-white/75">No ticket? Late tickets {formatNaira(e.prices.lateKobo)} until {e.lateWindowMin} minutes in. <Link href={`/lives/${id}`} className="underline">Share this page</Link></p>
          )}
          <p className="mt-6 text-[11.5px] text-white/45">If the host cancels or never starts, every ticket is refunded to NotesApp Credit automatically. <Link href="/help/paid-lives" className="underline">How paid lives work</Link></p>
        </>}
      </div>
    </div>
  );
}

// ── The list (/lives) ──
type Card = { id: string; title: string; poster: string; hostName: string; hostUsername: string; startsAt: string; status: string; audience: LiveAudience; prices: { earlyKobo: number; normalKobo: number; lateKobo: number } };
export function LivesHome() {
  const user = useUser();
  const [d, setD] = useState<{ upcoming: Card[]; mine: (Card & { ref: string; band: string; paidKobo: number; ticketStatus: string })[]; hosting: (Card & { sold: number })[] } | null>(null);
  useEffect(() => { if (user !== undefined) capi<NonNullable<typeof d>>("/api/lives").then(setD).catch(() => setD({ upcoming: [], mine: [], hosting: [] })); }, [user]);
  const row = (c: Card, extra?: React.ReactNode) => (
    <li key={c.id}><Link href={`/lives/${c.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-paper">
      <span className="min-w-0"><span className="block truncate font-ui text-sm font-bold text-ink">{c.title}</span>
        <span className="text-xs text-slate">{c.status === "live" ? "● Live now" : `${lagos(c.startsAt)} (Lagos)`} · {c.hostName || `@${c.hostUsername}`}{c.audience !== "everyone" ? ` · ${LIVE_AUDIENCES.find((a) => a.id === c.audience)?.label}` : ""}</span></span>
      <span className="shrink-0 text-right text-xs text-slate">{extra ?? `from ${formatNaira(c.prices.earlyKobo)}`}</span>
    </Link></li>
  );
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Lives</p><h1 className="mt-2 font-display text-4xl text-ink">Paid lives</h1>
          <p className="mt-2 text-sm text-slate">Scheduled lives with tickets: early bird, normal and late prices. {recordNotice("replay").split(".")[0]} when the host chooses to record.</p></div>
        {user && <Link href="/lives/new" className="btn-primary">Schedule a paid live</Link>}
      </div>
      {d?.mine.length ? <section className="mt-8"><h2 className="font-display text-2xl text-ink">Your tickets</h2><ul className="mt-3 divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-card">{d.mine.map((c) => row(c, c.ticketStatus === "refunded" ? "Refunded" : `${c.band} · ${c.ref}`))}</ul></section> : null}
      {d?.hosting.length ? <section className="mt-8"><h2 className="font-display text-2xl text-ink">Your paid lives</h2><ul className="mt-3 divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-card">{d.hosting.map((c) => row(c, `${c.status} · ${c.sold} sold`))}</ul></section> : null}
      <section className="mt-8"><h2 className="font-display text-2xl text-ink">Coming up</h2>
        {!d ? <p className="mt-3 text-sm text-slate">Loading…</p> : d.upcoming.length ? <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-card">{d.upcoming.map((c) => row(c))}</ul> : <p className="mt-3 text-sm text-slate">No paid lives scheduled right now.</p>}
      </section>
    </div>
  );
}
