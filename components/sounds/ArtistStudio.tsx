"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mediaApi } from "@/lib/media-client";
import { compact } from "@/lib/media-rules";
import { formatNaira } from "@/lib/booking-time";
import { asWebp } from "@/lib/upload";
import type { MySong, MySounds } from "@/lib/sounds-server";
import {
  ROYALTY_NOTE, SONG_STATUS_LABEL, SOUND_MAX_BYTES, SOUND_MAX_SECONDS, SOUND_SOURCES, SOUND_SOURCE_LABEL, SOUND_TITLE_MAX, SOUND_TYPES, emptyPlays, soundPath,
  type PlayCounts,
} from "@/lib/songs";

// /profile/sounds: an artist's side of NotesApp Sounds (lib/songs.ts). Your songs' plays, where they're played (Media posts, Moments,
// Lives, Notes Life), this month and last, the last 30 days, and your song royalties in ad share. Not an artist yet: the application.
// Verified: add a song (it goes live once the team has checked it).
const card = "rounded-[22px] border border-rule bg-card p-5 sm:p-6";
const field = "mt-1 w-full rounded-2xl border border-rule bg-card px-3.5 py-2.5 text-sm text-ink outline-none focus:border-crimson";
const add = (a: PlayCounts, b: PlayCounts): PlayCounts => ({ media: a.media + b.media, moment: a.moment + b.moment, live: a.live + b.live, life: a.life + b.life, total: a.total + b.total });

export default function ArtistStudio() {
  const [d, setD] = useState<MySounds | null | undefined>(undefined);
  const [error, setError] = useState("");
  const load = () => mediaApi<MySounds>("/api/sounds/mine", { signedIn: true }).then(setD, (e) => { setError(e instanceof Error ? e.message : "Couldn't load your sounds."); setD(null); });
  useEffect(() => { void load(); }, []);
  if (d === undefined) return <p className="py-10 text-sm text-slate">Loading your sounds…</p>;
  if (d === null) return <p className="py-10 text-sm text-red-700">{error}</p>;

  const verified = d.isHouse || d.artist?.status === "verified";
  const month = d.songs.reduce((p, s) => add(p, s.thisMonth), emptyPlays());
  const all = d.songs.reduce((p, s) => add(p, s.plays), emptyPlays());
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Your sounds</h1>
        <p className="mt-1 text-sm text-slate">Where your songs are played, and what they earn. <Link href="/sounds" className="font-semibold text-crimson">All NotesApp Sounds →</Link></p>
      </div>

      {d.songs.length > 0 && (
        <section className={card} aria-label="Plays">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><p className="font-ui text-xs font-bold uppercase tracking-[0.15em] text-slate">This month</p><p className="font-display text-4xl text-ink">{compact(month.total)} <span className="text-base text-slate">plays</span></p></div>
            <p className="text-sm text-slate">{compact(all.total)} since the start</p>
          </div>
          <SourceBars p={month} />
        </section>
      )}

      {d.songs.length > 0 && (
        <section aria-label="Your songs" className="space-y-3">
          {d.songs.map((s) => <SongRow key={s.id} s={s} onRemoved={load} />)}
        </section>
      )}

      {verified && (
        <section className={card} aria-label="Song royalties">
          <h2 className="font-display text-2xl text-ink">Song royalties</h2>
          <p className="mt-1 text-sm text-slate">{ROYALTY_NOTE} The pool is {d.poolPercent}% of the month&apos;s ad revenue. Statements are made once the month&apos;s revenue is in, checked, then paid to your bank with your <Link href="/profile/publishing" className="font-semibold text-crimson">ad share</Link>.</p>
          {d.royalties.length ? (
            <table className="mt-3 w-full text-sm">
              <thead><tr className="text-left text-xs text-slate"><th className="py-1">Month</th><th>Plays</th><th>Royalty</th><th>Status</th></tr></thead>
              <tbody>{d.royalties.map((r) => <tr key={r.month} className="border-t border-rule"><td className="py-1.5">{r.month}</td><td>{r.plays.toLocaleString("en-NG")}</td><td>{formatNaira(r.shareKobo)}</td><td className="text-xs text-slate">{r.status.replace(/_/g, " ")}</td></tr>)}</tbody>
            </table>
          ) : <p className="mt-3 text-sm text-slate">No statements yet. Your first one comes after the month&apos;s ad revenue is counted.</p>}
        </section>
      )}

      {verified ? <AddSong onAdded={load} /> : <Apply artist={d.artist} onApplied={load} />}
    </div>
  );
}

function SourceBars({ p }: { p: PlayCounts }) {
  const max = Math.max(1, ...SOUND_SOURCES.map((s) => p[s]));
  return (
    <ul className="mt-4 space-y-2">
      {SOUND_SOURCES.map((s) => (
        <li key={s} className="grid grid-cols-[110px_1fr_56px] items-center gap-3 text-sm">
          <span className="text-slate">{SOUND_SOURCE_LABEL[s]}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-field"><span className="block h-full rounded-full bg-crimson" style={{ width: `${(p[s] / max) * 100}%` }} /></span>
          <b className="text-right font-ui text-ink">{compact(p[s])}</b>
        </li>
      ))}
    </ul>
  );
}

function SongRow({ s, onRemoved }: { s: MySong; onRemoved: () => void }) {
  const [open, setOpen] = useState(false);
  const max = Math.max(1, ...s.daily.map((x) => x.total));
  const remove = async () => {
    if (!confirm(`Take "${s.title}" down? Posts that used it keep its name, but it stops playing and leaves the picker.`)) return;
    try { await mediaApi("/api/sounds/mine", { body: { action: "remove", id: s.id }, signedIn: true }); onRemoved(); } catch (e) { alert(e instanceof Error ? e.message : "Couldn't take it down."); }
  };
  return (
    <div className={card}>
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {s.cover ? <img src={s.cover} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" /> : <span className="h-16 w-16 shrink-0 rounded-2xl bg-field" />}
        <div className="min-w-0 flex-1">
          {s.status === "approved" ? <Link href={soundPath(s.id)} className="block truncate font-ui text-base font-bold text-ink hover:text-crimson">{s.title}</Link> : <b className="block truncate font-ui text-base text-ink">{s.title}</b>}
          <p className="text-xs text-slate">{SONG_STATUS_LABEL[s.status]}{s.house ? " · built in" : ""}{s.note ? ` · ${s.note}` : ""}</p>
          <p className="mt-0.5 text-sm text-ink"><b>{compact(s.thisMonth.total)}</b> this month · {compact(s.lastMonth.total)} last month · {compact(s.plays.total)} in all · {compact(s.posts)} posts · {compact(s.moments)} moments</p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="shrink-0 rounded-full border border-rule px-3 py-1.5 font-ui text-xs font-bold">{open ? "Less" : "Where"}</button>
      </div>
      {open && (
        <div className="mt-3 border-t border-rule pt-3">
          <p className="font-ui text-xs font-bold uppercase tracking-[0.12em] text-slate">Since the start</p>
          <SourceBars p={s.plays} />
          <p className="mt-4 font-ui text-xs font-bold uppercase tracking-[0.12em] text-slate">The last 30 days</p>
          {s.daily.length ? (
            <div className="mt-2 flex h-20 items-end gap-[3px]" aria-label="Plays a day, the last 30 days">
              {s.daily.map((x) => <span key={x.day} title={`${x.day.slice(6)}/${x.day.slice(4, 6)}: ${x.total}`} className="flex-1 rounded-t bg-crimson/80" style={{ height: `${Math.max(4, (x.total / max) * 100)}%` }} />)}
            </div>
          ) : <p className="mt-1 text-sm text-slate">No plays in the last 30 days.</p>}
          {!s.house && s.status !== "removed" && <button type="button" onClick={remove} className="mt-3 text-xs font-semibold text-red-700 underline">Take this song down</button>}
        </div>
      )}
    </div>
  );
}

function Apply({ artist, onApplied }: { artist: MySounds["artist"]; onApplied: () => void }) {
  const [f, setF] = useState({ stageName: "", links: "", about: "", ownsRights: false });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  if (artist?.status === "pending") return <section className={card}><h2 className="font-display text-2xl text-ink">🎤 Application sent</h2><p className="mt-1 text-sm text-slate">The team is checking your application as <b>{artist.stageName}</b>. You&apos;ll be able to add songs once you&apos;re verified.</p></section>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setNote("");
    try { await mediaApi("/api/sounds/mine", { body: { action: "apply", stageName: f.stageName, links: f.links.split(/\s+/).filter(Boolean), about: f.about, ownsRights: f.ownsRights }, signedIn: true }); onApplied(); }
    catch (err) { setNote(err instanceof Error ? err.message : "Couldn't send it."); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className={card}>
      <h2 className="font-display text-2xl text-ink">🎤 Are you an artist? Get verified</h2>
      <p className="mt-1 text-sm text-slate">Verified artists add their own songs to NotesApp Sounds. Creators use them on posts, moments and lives, and you earn a royalty from #NotesApp&apos;s ad revenue for every play.</p>
      {artist?.status === "rejected" && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Your last application wasn&apos;t approved{artist.note ? `: ${artist.note}` : "."} You can apply again.</p>}
      <label className="mt-4 block text-sm font-bold text-ink">Artist name<input className={field} value={f.stageName} maxLength={60} onChange={(e) => setF({ ...f, stageName: e.target.value })} placeholder="The name on your songs" required /></label>
      <label className="mt-3 block text-sm font-bold text-ink">Links to your music<textarea className={field} rows={3} value={f.links} onChange={(e) => setF({ ...f, links: e.target.value })} placeholder={"https://audiomack.com/…\nhttps://open.spotify.com/artist/…"} required /></label>
      <p className="mt-1 text-xs text-slate">One per line, up to 5: Audiomack, Boomplay, Spotify, Apple Music, YouTube… so the team can see the songs are yours.</p>
      <label className="mt-3 block text-sm font-bold text-ink">About you (optional)<textarea className={field} rows={2} maxLength={600} value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} /></label>
      <label className="mt-3 flex items-start gap-2 text-sm text-ink"><input type="checkbox" className="mt-1" checked={f.ownsRights} onChange={(e) => setF({ ...f, ownsRights: e.target.checked })} />I own the rights to the songs I&apos;ll add (or have the rights holders&apos; permission), and I let #NotesApp members use them on #NotesApp.</label>
      {note && <p className="mt-3 text-sm text-red-700" role="alert">{note}</p>}
      <button type="submit" disabled={busy} className="mt-4 rounded-full bg-crimson px-5 py-2.5 font-ui text-sm font-bold text-white disabled:opacity-50">{busy ? "Sending…" : "Apply"}</button>
    </form>
  );
}

const readDuration = (file: File) => new Promise<number>((ok, no) => {
  const a = document.createElement("audio"); const url = URL.createObjectURL(file);
  a.preload = "metadata"; a.onloadedmetadata = () => { URL.revokeObjectURL(url); ok(a.duration); }; a.onerror = () => { URL.revokeObjectURL(url); no(new Error("We couldn't read that file. Use an MP3.")); };
  a.src = url;
});
const put = async (url: string, file: File) => { const r = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } }); if (!r.ok) throw new Error("The upload didn't go through. Try again."); };

function AddSong({ onAdded }: { onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [song, setSong] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [dur, setDur] = useState(0);
  const [hook, setHook] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const pickSong = async (f: File | undefined) => {
    setNote(null); setSong(null); setDur(0);
    if (!f) return;
    if (!SOUND_TYPES[f.type]) { setNote({ ok: false, text: "Use an MP3 (or M4A) file." }); return; }
    if (f.size > SOUND_MAX_BYTES) { setNote({ ok: false, text: `Songs can be up to ${SOUND_MAX_BYTES / 1048576} MB. Export it at 128 kbps.` }); return; }
    try { const d = await readDuration(f); if (d > SOUND_MAX_SECONDS) throw new Error(`Songs can be up to ${SOUND_MAX_SECONDS / 60} minutes.`); setSong(f); setDur(d); if (!title) setTitle(f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").slice(0, SOUND_TITLE_MAX)); if (!hook) setHook(String(Math.round(d * 0.3))); }
    catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "We couldn't read that file." }); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!song || !cover) { setNote({ ok: false, text: "Add the song and its cover." }); return; }
    setBusy(true); setNote(null);
    try {
      const pic = await asWebp(cover, "poster");
      const start = await mediaApi<{ id: string; uploadUrl: string; coverUrl: string }>("/api/sounds/mine", { body: { action: "start", title, size: song.size, contentType: song.type, durationSec: dur, hook: Number(hook) || 0, coverType: pic.type, coverSize: pic.size }, signedIn: true });
      await Promise.all([put(start.uploadUrl, song), put(start.coverUrl, pic)]);
      await mediaApi("/api/sounds/mine", { body: { action: "finish", id: start.id }, signedIn: true });
      setTitle(""); setSong(null); setCover(null); setHook(""); setDur(0);
      setNote({ ok: true, text: "Added. The team checks it (usually within a day); once it's live, everyone can use it." });
      onAdded();
    } catch (err) { setNote({ ok: false, text: err instanceof Error ? err.message : "Couldn't add the song." }); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className={card}>
      <h2 className="font-display text-2xl text-ink">Add a song</h2>
      <p className="mt-1 text-sm text-slate">MP3 up to {SOUND_MAX_BYTES / 1048576} MB, with a square cover. Only add songs you own. The team checks each one before it goes live.</p>
      <label className="mt-4 block text-sm font-bold text-ink">The song (MP3)<input type="file" accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,.mp3,.m4a" className={field} onChange={(e) => void pickSong(e.target.files?.[0])} /></label>
      <label className="mt-3 block text-sm font-bold text-ink">Cover picture<input type="file" accept="image/jpeg,image/png,image/webp" className={field} onChange={(e) => setCover(e.target.files?.[0] ?? null)} /></label>
      <label className="mt-3 block text-sm font-bold text-ink">Title<input className={field} value={title} maxLength={SOUND_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} required /></label>
      <label className="mt-3 block text-sm font-bold text-ink">Best part starts at (seconds)<input type="number" min={0} max={Math.max(0, Math.floor(dur) - 5)} className={field} value={hook} onChange={(e) => setHook(e.target.value)} /></label>
      <p className="mt-1 text-xs text-slate">Posts and moments start playing your song here: the chorus or the catchiest part.{dur ? ` The song is ${Math.floor(dur / 60)}:${String(Math.floor(dur % 60)).padStart(2, "0")} long.` : ""}</p>
      {note && <p className={`mt-3 text-sm ${note.ok ? "text-emerald-700" : "text-red-700"}`} role="status">{note.text}</p>}
      <button type="submit" disabled={busy || !song || !cover} className="mt-4 rounded-full bg-crimson px-5 py-2.5 font-ui text-sm font-bold text-white disabled:opacity-50">{busy ? "Uploading…" : "Add the song"}</button>
    </form>
  );
}
