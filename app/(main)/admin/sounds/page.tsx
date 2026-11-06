"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import type { AdminSounds } from "@/lib/sounds-server";
import { SONG_STATUS_LABEL, soundPath } from "@/lib/songs";

const btn = "rounded-full border border-rule px-3 py-1 text-xs hover:border-crimson hover:text-crimson disabled:opacity-40";

// Admin → Sounds (lib/sounds-server.ts): artist applications (verify or reject), uploaded songs (listen, approve, reject, take down), and
// the royalty pool: the part of each month's ad revenue split over song plays (Ad share → Compute statements makes the statements).
export default function AdminSoundsPage() {
  const { user, loading } = useAdminAuth();
  const [d, setD] = useState<AdminSounds | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [pool, setPool] = useState("");
  const call = useCallback(async (body?: Record<string, unknown>) => {
    const token = await user!.getIdToken();
    const res = await fetch("/api/admin/sounds", { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Failed");
    return j;
  }, [user]);
  const load = useCallback(() => call().then((j: AdminSounds) => { setD(j); setPool(String(j.poolPercent)); }, (e) => setError(e.message)), [call]);
  useEffect(() => { if (user) void load(); }, [user, load]);
  const act = async (tag: string, body: Record<string, unknown>) => {
    setBusy(tag); setError("");
    try { await call(body); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } finally { setBusy(""); }
  };
  const why = (verb: string) => (verb === "approved" || verb === "verified" ? "" : prompt("Reason (the artist sees it):") ?? null);

  if (loading || !user) return <p className="p-6 text-sm text-slate">Loading…</p>;
  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl text-ink">NotesApp Sounds</h1>
      <p className="mt-1 text-sm text-slate">Verify artists, check their songs before anyone can use them, and set the royalty pool. House songs (the owner&apos;s, built in) need no review. <Link href="/sounds" className="text-crimson underline">See the catalogue</Link></p>
      {error && <p className="mt-3 text-sm text-crimson" role="alert">{error}</p>}
      {!d ? <p className="mt-6 text-sm text-slate">Loading…</p> : (
        <>
          <div className="mt-6 rounded-2xl border border-rule bg-card p-4">
            <h2 className="font-display text-xl text-ink">Royalty pool</h2>
            <p className="mt-1 text-sm text-slate">The part of each month&apos;s ad revenue that goes to artists, split by their songs&apos; plays that month. Ad share → Compute statements makes a 🎵 song royalty statement for each artist; review and approve them there like the rest (finance).</p>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <input type="number" min={0} max={50} step={0.5} value={pool} onChange={(e) => setPool(e.target.value)} className="w-24 border border-rule bg-card px-3 py-2" aria-label="Pool percent" /> % of ad revenue
              <button type="button" className={btn} disabled={busy === "pool"} onClick={() => act("pool", { action: "pool", percent: Number(pool) })}>Save</button>
            </div>
          </div>

          <h2 className="mt-8 font-display text-2xl text-ink">Artists</h2>
          {!d.artists.length ? <p className="mt-2 text-sm text-slate">No applications yet.</p> : (
            <ul className="mt-3 space-y-2">
              {d.artists.map((a) => (
                <li key={a.uid} className="rounded-2xl border border-rule bg-card p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><b className="text-ink">{a.stageName}</b><Link href={`/u/${a.username}`} className="text-crimson">@{a.username}</Link><span className="text-xs text-slate">· {a.status} · applied {a.appliedAt.slice(0, 10)}</span></div>
                  <ul className="mt-1 text-xs">{a.links.map((l) => <li key={l}><a href={l} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-crimson underline">{l}</a></li>)}</ul>
                  {a.about && <p className="mt-1 text-slate">{a.about}</p>}
                  {a.note && <p className="mt-1 text-xs text-slate">Note: {a.note}</p>}
                  <div className="mt-2 flex gap-2">
                    {a.status !== "verified" && <button type="button" className={btn} disabled={busy === a.uid} onClick={() => act(a.uid, { action: "artist", uid: a.uid, status: "verified" })}>Verify</button>}
                    {a.status !== "rejected" && <button type="button" className={btn} disabled={busy === a.uid} onClick={() => { const n = why("rejected"); if (n !== null) void act(a.uid, { action: "artist", uid: a.uid, status: "rejected", note: n }); }}>Reject</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-8 font-display text-2xl text-ink">Artist songs</h2>
          {!d.songs.length ? <p className="mt-2 text-sm text-slate">No uploads yet.</p> : (
            <ul className="mt-3 space-y-2">
              {d.songs.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-rule bg-card p-3 text-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {s.cover ? <img src={s.cover} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <span className="h-14 w-14 rounded-xl bg-field" />}
                  <div className="min-w-0 flex-1">
                    <b className="text-ink">{s.title}</b> <span className="text-slate">· {s.artist} · @{s.ownerUsername}</span>
                    <p className="text-xs text-slate">{SONG_STATUS_LABEL[s.status]} · {Math.floor(s.durationSec / 60)}:{String(s.durationSec % 60).padStart(2, "0")} · added {s.createdAt.slice(0, 10)}{s.note ? ` · ${s.note}` : ""}</p>
                    <audio src={s.src} controls preload="none" className="mt-1 h-8 w-full max-w-sm" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {s.status === "approved" && <Link href={soundPath(s.id)} className={btn}>Page</Link>}
                    {s.status !== "approved" && <button type="button" className={btn} disabled={busy === s.id} onClick={() => act(s.id, { action: "song", id: s.id, status: "approved" })}>Approve</button>}
                    {s.status === "pending" && <button type="button" className={btn} disabled={busy === s.id} onClick={() => { const n = why("rejected"); if (n !== null) void act(s.id, { action: "song", id: s.id, status: "rejected", note: n }); }}>Reject</button>}
                    {s.status === "approved" && <button type="button" className={btn} disabled={busy === s.id} onClick={() => { const n = why("removed"); if (n !== null) void act(s.id, { action: "song", id: s.id, status: "removed", note: n }); }}>Take down</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
