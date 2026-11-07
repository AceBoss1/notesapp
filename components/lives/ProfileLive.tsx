"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { capi } from "@/components/community/api";
import { PosterChoice, RoomScreen } from "@/components/community/AudioRoom";
import { StageModeChoice } from "@/components/community/StageControls";
import { formatNaira } from "@/lib/booking-time";
import { PROFILE_AUDIENCE_LABEL, PROFILE_LIVE_AUDIENCES, type ProfileLiveAudience, type StageMode } from "@/lib/rooms";
import type { PosterSource } from "@/lib/rooms-live";
import type { LiveCard, LiveSummary } from "@/lib/profile-lives-server";

// 🔴 Go live from your profile (docs/GO_LIVE.md; the approved mockups are docs/mockups/go-live/1–6). Starting is for #NotesApp team
// accounts while the staff test pass is on (the server checks); joining follows the host's choice of who can watch.

function useUser(): User | null | undefined {
  const [u, setU] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setU), []);
  return u;
}

const Toggle = ({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) => (
  <label className="flex cursor-pointer items-center justify-between border-t border-rule py-2.5 text-sm">
    <span>{label}</span>
    <input type="checkbox" role="switch" checked={on} onChange={(e) => set(e.target.checked)} className="peer sr-only" />
    <span aria-hidden className={`relative h-5 w-9 rounded-full transition ${on ? "bg-crimson" : "bg-rule"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${on ? "left-[18px]" : "left-0.5"}`} /></span>
  </label>
);

// Screen 2: set up in one screen, then Go live (screen 3 is the room itself). When it ends, the summary (screen 6).
export function GoLiveNow() {
  const user = useUser();
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState<ProfileLiveAudience>("everyone");
  const [stageMode, setStageMode] = useState<StageMode>("approve");
  const [notify, setNotify] = useState(true);
  const [gifts, setGifts] = useState(true);
  const [record, setRecord] = useState(false);
  const [poster, setPoster] = useState<{ source: PosterSource; url?: string; preview?: string }>({ source: "profile" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [room, setRoom] = useState<string | null>(null);
  const [ended, setEnded] = useState<string | null>(null);
  const start = async () => {
    setBusy(true); setErr("");
    try {
      const r = await capi<{ id: string }>("/api/lives", { action: "go_live", title, audience, stageMode, notify, gifts, record, poster: { source: poster.source, url: poster.url } });
      setRoom(r.id);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't go live."); }
    finally { setBusy(false); }
  };
  if (room && user) return <RoomScreen id={room} me={user.uid} title={title} onDone={() => { setEnded(room); setRoom(null); }} />;
  if (ended) return <Summary id={ended} />;
  return (
    <section className="card mt-6 border-crimson p-5" aria-labelledby="golive-now">
      <h2 id="golive-now" className="font-ui text-lg font-bold text-ink">🔴 Go live now · free</h2>
      <p className="mt-1 text-sm text-slate">From your profile, no ticket and no community. {audience === "everyone" ? "Anyone signed in can join." : `Only your ${audience} can join.`}</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="What's it about? e.g. Sunday chat" aria-label="Title"
        className="mt-4 w-full rounded-xl border border-rule bg-card px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-crimson" />
      <p className="mt-4 text-xs font-bold text-ink">Who can watch</p>
      <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Who can watch">
        {PROFILE_LIVE_AUDIENCES.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={audience === a} onClick={() => setAudience(a)}
            className={`rounded-full px-3.5 py-1.5 font-ui text-xs font-semibold ${audience === a ? "bg-crimson text-white" : "border border-rule bg-white text-ink"}`}>{a === "everyone" ? "🌍 " : ""}{PROFILE_AUDIENCE_LABEL[a]}</button>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-ink p-3 text-white"><p className="text-xs font-bold">Stage</p><StageModeChoice value={stageMode} onChange={setStageMode} /></div>
      <div className="mt-4"><PosterChoice light value={poster} onChange={setPoster} onError={setErr} /></div>
      <div className="mt-3">
        <Toggle label="🔔 Tell my followers" on={notify} set={setNotify} />
        <Toggle label="🎁 Gifts" on={gifts} set={setGifts} />
        <Toggle label="⏺ Record for a replay (everyone in the live is told)" on={record} set={setRecord} />
      </div>
      {err && <p className="mt-2 text-sm text-crimson" role="alert">{err}</p>}
      <button type="button" disabled={busy || title.trim().length < 3} onClick={start} className="btn-primary mt-3 w-full disabled:opacity-50">{busy ? "Going live…" : "🔴 Go live"}</button>
      <p className="mt-2 text-center text-xs text-slate">Team test: only the #NotesApp team can go live from a profile for now. Nothing is recorded unless you switch it on.</p>
    </section>
  );
}

// Screen 6: when the host ends it.
export function Summary({ id }: { id: string }) {
  const [s, setS] = useState<LiveSummary | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { capi<{ summary: LiveSummary }>(`/api/lives?summary=${encodeURIComponent(id)}`).then((r) => setS(r.summary)).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't load the summary.")); }, [id]);
  if (err) return <p className="card mt-6 p-5 text-sm text-crimson">{err}</p>;
  if (!s) return <p className="mt-6 text-sm text-slate">Adding it up…</p>;
  const stat = (n: string, label: string) => <div className="rounded-2xl border border-rule bg-card p-3"><b className="block font-display text-2xl">{n}</b><span className="text-xs text-slate">{label}</span></div>;
  return (
    <section className="mt-6" aria-labelledby="sum-h">
      <h2 id="sum-h" className="font-display text-3xl text-ink">Nice one 👏</h2>
      <p className="mt-1 text-sm text-slate">{s.title} · {s.minutes} min{s.status === "live" ? " so far" : ""}</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {stat(s.joined.toLocaleString("en-GB"), "people joined")}
        {stat(s.peak.toLocaleString("en-GB"), "at the peak")}
        {stat(formatNaira(s.giftKobo), `in gifts (${s.gifts})`)}
        {stat(s.newFollowers === null ? "—" : `+${s.newFollowers.toLocaleString("en-GB")}`, "new followers")}
      </div>
      {s.recorded && (
        <div className="card mt-3 p-4 text-sm"><b>Replay</b><p className="mt-1 text-slate">Recorded. Publish it to your Media (Lives &amp; replays), or keep it private.</p>
          <div className="mt-3 flex flex-wrap gap-2"><Link href="/profile/media?tab=live" className="btn-primary !px-4 !py-2 text-sm">Publish replay</Link><Link href="/lives/start" className="btn-ghost !px-4 !py-2 text-sm">Keep private</Link></div></div>
      )}
      {s.giftKobo > 0 && <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-ink">Gifts reach your earnings with the usual hold.{s.topGifters.length ? ` Top gifters: ${s.topGifters.map((g) => `${g.name} (${formatNaira(g.kobo)})`).join(", ")}.` : ""}</p>}
      <Link href={`/u/${s.hostUsername}`} className="btn-ghost mt-4 block w-full text-center">Back to my profile</Link>
    </section>
  );
}

// /live/[id]: the lobby of one live, then the room (screen 5). The host coming back to an ended live sees the summary.
export function LiveLobby({ id }: { id: string }) {
  const user = useUser();
  const [d, setD] = useState<{ live: LiveCard; status: "live" | "ended"; canJoin: boolean; host: boolean } | null>(null);
  const [err, setErr] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const load = () => capi<NonNullable<typeof d>>(`/api/lives?live=${encodeURIComponent(id)}`).then(setD).catch((e) => setErr(e instanceof Error ? e.message : "That live wasn't found."));
  useEffect(() => { if (user !== undefined) void load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  if (inRoom && user) return <RoomScreen id={id} me={user.uid} title={d?.live.title} onDone={() => { setInRoom(false); void load(); }} />;
  if (err) return <p className="card p-6 text-sm text-crimson">{err}</p>;
  if (!d) return <p className="text-sm text-slate">Loading…</p>;
  if (d.host && d.status === "ended") return <Summary id={id} />;
  const l = d.live;
  return (
    <div className="card overflow-hidden">
      <div className="relative flex aspect-video items-center justify-center bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {l.poster ? <img src={l.poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : null}
        <span className="relative rounded-md bg-[#E0123E] px-2 py-1 font-ui text-xs font-extrabold tracking-wide text-white">{d.status === "live" ? "LIVE" : "ENDED"}</span>
      </div>
      <div className="p-5">
        <p className="font-ui text-xs font-semibold uppercase tracking-[0.2em] text-crimson">@{l.hostUsername}{d.status === "live" ? ` · ${l.watching.toLocaleString("en-GB")} watching` : ""}</p>
        <h1 className="mt-1 font-display text-3xl text-ink">{l.title}</h1>
        {d.status === "ended" ? <p className="mt-3 text-sm text-slate">This live has ended. <Link href={`/u/${l.hostUsername}`} className="text-crimson underline">See @{l.hostUsername}&apos;s profile</Link>.</p>
          : user === null ? <Link href={`/login?next=/live/${id}`} className="btn-primary mt-4 inline-block">Sign in to join</Link>
          : d.canJoin ? <button type="button" onClick={() => setInRoom(true)} className="btn-primary mt-4">{d.host ? "Back to your live" : "▶ Join the live"}</button>
          : <p className="mt-3 text-sm text-slate">This live is for @{l.hostUsername}&apos;s {l.audience}. <Link href={`/u/${l.hostUsername}`} className="text-crimson underline">{l.audience === "subscribers" ? "Subscribe" : "Follow"} on their profile</Link> to join.</p>}
      </div>
    </div>
  );
}

// Screen 4: Live now, a row of LIVE rings (the feed, above the moments, and Explore). Nothing shows when nobody is live.
export function LiveNowStrip({ className = "" }: { className?: string }) {
  const [lives, setLives] = useState<LiveCard[]>([]);
  useEffect(() => { capi<{ lives: LiveCard[] }>("/api/lives?live_now=1").then((r) => setLives(r.lives)).catch(() => {}); }, []);
  if (!lives.length) return null;
  return (
    <section className={className} aria-label="Live now">
      <p className="font-ui text-xs font-bold uppercase tracking-[0.2em] text-crimson">● Live now</p>
      <ul className="mt-2 flex gap-4 overflow-x-auto pb-1">
        {lives.map((l) => (
          <li key={l.id} className="shrink-0"><Link href={`/live/${l.id}`} className="flex w-20 flex-col items-center text-center" title={l.title}>
            <LiveRing avatar={l.hostAvatar} size={64} />
            <span className="mt-2 w-full truncate font-ui text-xs font-semibold text-ink">{l.hostUsername}</span>
            <span className="text-[10px] text-slate">{l.watching.toLocaleString("en-GB")} watching</span>
          </Link></li>
        ))}
      </ul>
    </section>
  );
}

export function LiveRing({ avatar, size = 64 }: { avatar: string; size?: number }) {
  return (
    <span className="relative inline-block rounded-full bg-[conic-gradient(#E0123E,#ff6a88,#E0123E)] p-[3px]" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {avatar ? <img src={avatar} alt="" className="h-full w-full rounded-full border-[3px] border-paper object-cover" /> : <span className="block h-full w-full rounded-full border-[3px] border-paper bg-field" />}
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-[#E0123E] px-1.5 py-px font-ui text-[9px] font-extrabold tracking-wide text-white">LIVE</span>
    </span>
  );
}

// Screen 4, on a profile: Join the live (or, for a followers- or subscribers-only live, what it takes to join).
export function ProfileLiveBanner({ username }: { username: string }) {
  const user = useUser();
  const [l, setL] = useState<(LiveCard & { canJoin: boolean }) | null>(null);
  useEffect(() => { if (user !== undefined) capi<{ live: (LiveCard & { canJoin: boolean }) | null }>(`/api/lives?profile=${encodeURIComponent(username)}`).then((r) => setL(r.live)).catch(() => {}); }, [user, username]);
  if (!l) return null;
  return (
    <Link href={`/live/${l.id}`} className="mt-3 inline-flex items-center gap-2 rounded-full bg-crimson px-4 py-2 font-ui text-sm font-bold text-white hover:bg-crimson-bright">
      <span className="rounded bg-[#E0123E] px-1.5 py-px text-[10px] font-extrabold tracking-wide">LIVE</span>
      {l.canJoin ? `Join the live · ${l.watching.toLocaleString("en-GB")} watching` : `Live now (for ${l.audience})`}
    </Link>
  );
}
