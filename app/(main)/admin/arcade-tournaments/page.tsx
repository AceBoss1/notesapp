"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { TOURNAMENT_GAMES } from "@/lib/arcade/tournament-games";
import { lagosWhen } from "@/lib/arcade/lagos-time";
import type { Best, Phase, Prize, Tournament } from "@/lib/arcade/tournaments";

// Admin → Arcade tournaments (lib/arcade/tournaments-server.ts; owner, 21 Nov 2026: "start tournaments"; docs/ARCADE_TOURNAMENTS.md §6):
// create and edit tournaments, open and close them, check the results, mark prizes sent, and the sponsor's report. The owner's decisions
// (§8): prize tournaments are 18+ only, practice tournaments (no prizes) let teens in; a prize tournament doesn't open for entries until the
// legal check is ticked; our first pick is a Whot weekend, but admin can change the game, dates and sponsor here.

type Row = Tournament & { phase: Phase };
type Run = { id: string; try: number; status: string; startedAt: string; finishedAt?: string; reason?: string; length?: number; result?: { summary: string; score: number } };
type Result = { place: number; uid: string; username: string; name: string; tries: number; best: Best; runs: Run[] };
type Report = {
  entrants: number; tries: number; finished: number; rejected: number; abandoned: number; expired: number; open: number;
  sponsorImpressions: number; sponsorClicks: number; pageViews: number | null;
};
type Form = {
  game: string; level: string; name: string; playFrom: string; playUntil: string; entryFrom: string; tries: number;
  sponsorName: string; sponsorLogo: string; sponsorLink: string; sponsorWords: string; prizes: Prize[]; prize: boolean; ageRule: "adults" | "practice"; legalChecked: boolean;
};

// The window is typed in Lagos time (UTC+1 all year, no daylight saving) and stored as ISO.
const toLagosInput = (iso?: string) => (iso ? new Date(Date.parse(iso) + 3_600_000).toISOString().slice(0, 16) : "");
const fromLagosInput = (v: string) => (v ? new Date(`${v}:00+01:00`).toISOString() : "");
const nextSaturday = () => { const d = new Date(); d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7 || 7)); return d.toISOString().slice(0, 10); };

const blank = (): Form => {
  const sat = nextSaturday();
  const sun = new Date(Date.parse(sat) + 86_400_000).toISOString().slice(0, 10);
  // The owner's pick for the first tournament (§8.4): a Whot weekend.
  return { game: "whot", level: TOURNAMENT_GAMES.find((g) => g.slug === "whot")?.levels[0] ?? "", name: "Whot Weekend", playFrom: `${sat}T10:00`, playUntil: `${sun}T22:00`, entryFrom: "", tries: 3,
    sponsorName: "", sponsorLogo: "", sponsorLink: "", sponsorWords: "", prizes: [], prize: false, ageRule: "adults", legalChecked: false };
};
const formOf = (t: Tournament): Form => ({
  game: t.game, level: t.level, name: t.name, playFrom: toLagosInput(t.playFrom), playUntil: toLagosInput(t.playUntil), entryFrom: toLagosInput(t.entryFrom), tries: t.tries,
  sponsorName: t.sponsor?.name ?? "", sponsorLogo: t.sponsor?.logo ?? "", sponsorLink: t.sponsor?.link ?? "", sponsorWords: t.sponsor?.words ?? "",
  prizes: t.prizes ?? [], prize: t.prize, ageRule: t.ageRule, legalChecked: t.legalChecked,
});
const draftOf = (f: Form) => ({
  game: f.game, level: f.level, name: f.name, tries: f.tries, playFrom: fromLagosInput(f.playFrom), playUntil: fromLagosInput(f.playUntil),
  ...(f.entryFrom ? { entryFrom: fromLagosInput(f.entryFrom) } : {}),
  sponsor: { name: f.sponsorName, logo: f.sponsorLogo, link: f.sponsorLink, words: f.sponsorWords },
  prizes: f.prize ? f.prizes : [], prize: f.prize, ageRule: f.prize ? "adults" : f.ageRule, legalChecked: f.legalChecked,
});

const input = "w-full rounded-lg border border-rule bg-white px-3 py-2 text-sm text-ink";
const btn = "rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-40";
const primary = "rounded-lg bg-ink px-3 py-1.5 text-sm text-white disabled:opacity-40";

export default function AdminArcadeTournamentsPage() {
  const { user, loading } = useAdminAuth();
  const [list, setList] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [open, setOpen] = useState<{ id: string; results: Result[]; report: Report } | null>(null);
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (method: "GET" | "POST", body?: unknown, query = "") => {
    const r = await fetch(`/api/admin/arcade/tournaments${query}`, {
      method, headers: { Authorization: `Bearer ${await user!.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Failed");
    return j;
  }, [user]);
  const load = useCallback(() => call("GET").then((j) => setList(j.tournaments)).catch((e) => setError(e.message)), [call]);
  useEffect(() => { if (user) void load(); }, [user, load]);

  const act = async (body: Record<string, unknown>, done: string) => {
    setBusy(true); setError(""); setNote("");
    try { await call("POST", body); setNote(done); await load(); if (open && body.id === open.id) await details(open.id); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); return false; }
    finally { setBusy(false); }
  };
  const details = async (id: string) => {
    try { const j = await call("GET", undefined, `?id=${encodeURIComponent(id)}`); setOpen({ id, ...j }); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  };
  const save = async () => {
    if (!editing) return;
    const ok = await act(editing.id ? { action: "update", id: editing.id, draft: draftOf(editing.form) } : { action: "create", draft: draftOf(editing.form) }, editing.id ? "Saved." : "Created as a draft. Open it when it's ready.");
    if (ok) setEditing(null);
  };

  if (loading || !user) return <p className="p-6 text-sm text-slate">Loading…</p>;
  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl text-ink">Arcade tournaments</h1>
      <p className="mt-1 text-sm text-slate">
        Same deal for everyone; the server replays every try. Free entry for signed-in members; prize tournaments 18+, practice tournaments let teens in (no prizes).{" "}
        <Link href="/arcade/tournaments" className="text-crimson underline">See the public page</Link>
      </p>
      {error && <p className="mt-3 text-sm text-crimson" role="alert">{error}</p>}
      {note && <p className="mt-3 text-sm text-ink" role="status">{note}</p>}
      {!editing && <button className={`${primary} mt-4`} onClick={() => setEditing({ id: null, form: blank() })}>New tournament</button>}

      {editing && <Editor value={editing.form} locked={!!editing.id && (list?.find((t) => t.id === editing.id)?.runs ?? 0) > 0} onChange={(form) => setEditing({ ...editing, form })} onSave={save} onCancel={() => setEditing(null)} busy={busy} />}

      {list && list.length === 0 && !editing && (
        <div className="mt-6 rounded-xl border border-dashed border-rule p-4 text-sm text-slate">
          No tournaments yet. Our pick for the first (owner, 21 Nov 2026): a <b>Whot weekend</b>, the best known and quickest to learn, then Ludo. The sponsor is whoever signs first.{" "}
          <button className="text-crimson underline" onClick={() => setEditing({ id: null, form: blank() })}>Start a Whot weekend</button>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {(list ?? []).map((t) => (
          <li key={t.id} className="rounded-xl border border-rule p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-lg text-ink">{t.name} <span className="text-xs text-slate">· {t.game} · {t.level} · best of {t.tries}</span></p>
                <p className="text-xs text-slate">
                  {lagosWhen(t.playFrom)} to {lagosWhen(t.playUntil)} (Lagos) · <b>{t.status}</b> ({t.phase}) · {t.prize ? "prize, 18+" : t.ageRule === "practice" ? "practice, teens welcome" : "no prizes, 18+"}
                  {t.sponsor ? ` · sponsor: ${t.sponsor.name}` : ""} · {t.entrants ?? 0} entrants, {t.runs ?? 0} tries · seed {t.seed}
                  {t.prize && !t.legalChecked ? " · legal check not ticked" : ""}{t.resultsCheckedAt ? ` · results checked ${t.resultsCheckedAt.slice(0, 10)}` : ""}{t.prizesSentAt ? ` · prizes sent ${t.prizesSentAt.slice(0, 10)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className={btn} onClick={() => setEditing({ id: t.id, form: formOf(t) })} disabled={busy}>Edit</button>
                {(t.status === "draft" || t.status === "closed") && <button className={btn} disabled={busy || (t.prize && !t.legalChecked)} title={t.prize && !t.legalChecked ? "Tick the legal check first (owner, 21 Nov 2026)" : ""} onClick={() => act({ action: "open", id: t.id }, "Opened.")}>Open</button>}
                {t.status === "open" && <button className={btn} disabled={busy} onClick={() => act({ action: "close", id: t.id }, "Closed.")}>Close</button>}
                {t.status !== "draft" && <button className={btn} onClick={() => (open?.id === t.id ? setOpen(null) : details(t.id))}>{open?.id === t.id ? "Hide results" : "Check results & report"}</button>}
                <Link className={btn} href={`/arcade/tournaments/${t.id}`}>Page</Link>
              </div>
            </div>
            {open?.id === t.id && <Details t={t} data={open} busy={busy} act={act} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Editor({ value: f, locked, onChange, onSave, onCancel, busy }: { value: Form; locked: boolean; onChange: (f: Form) => void; onSave: () => void; onCancel: () => void; busy: boolean }) {
  const set = <K extends keyof Form>(k: K, v: Form[K]) => onChange({ ...f, [k]: v });
  const game = TOURNAMENT_GAMES.find((g) => g.slug === f.game);
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-rule p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-slate">Game
          <select className={input} value={f.game} disabled={locked} onChange={(e) => onChange({ ...f, game: e.target.value, level: TOURNAMENT_GAMES.find((g) => g.slug === e.target.value)?.levels[0] ?? "" })}>
            {TOURNAMENT_GAMES.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate">Level
          <select className={input} value={f.level} disabled={locked} onChange={(e) => set("level", e.target.value)}>
            {(game?.levels ?? []).map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate">Tries (1–10; best counts)
          <input className={input} type="number" min={1} max={10} value={f.tries} onChange={(e) => set("tries", Number(e.target.value))} />
        </label>
      </div>
      {locked && <p className="text-xs text-slate">Members have played: the game and level are fixed, and tries can only go up.</p>}
      <label className="block text-xs text-slate">Name (e.g. &quot;The Ariaria Cup, Whot, 29–30 Nov&quot;)
        <input className={input} value={f.name} maxLength={80} onChange={(e) => set("name", e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-slate">Play from (Lagos time)<input className={input} type="datetime-local" value={f.playFrom} onChange={(e) => set("playFrom", e.target.value)} /></label>
        <label className="text-xs text-slate">Play until (Lagos time)<input className={input} type="datetime-local" value={f.playUntil} onChange={(e) => set("playUntil", e.target.value)} /></label>
        <label className="text-xs text-slate">Listed from (optional)<input className={input} type="datetime-local" value={f.entryFrom} onChange={(e) => set("entryFrom", e.target.value)} /></label>
      </div>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="text-xs font-semibold text-ink">Sponsor (optional; their logo takes over this game&apos;s advert spots while it plays)</legend>
        <label className="text-xs text-slate">Name<input className={input} value={f.sponsorName} maxLength={60} onChange={(e) => set("sponsorName", e.target.value)} /></label>
        <label className="text-xs text-slate">Link (https://)<input className={input} value={f.sponsorLink} onChange={(e) => set("sponsorLink", e.target.value)} /></label>
        <label className="text-xs text-slate">Logo URL (https://)<input className={input} value={f.sponsorLogo} onChange={(e) => set("sponsorLogo", e.target.value)} /></label>
        <label className="text-xs text-slate">Their words (up to 280)<input className={input} value={f.sponsorWords} maxLength={280} onChange={(e) => set("sponsorWords", e.target.value)} /></label>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-ink">Kind</legend>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={f.prize} onChange={() => onChange({ ...f, prize: true, ageRule: "adults" })} /> Prize tournament (adults, 18+ only)</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!f.prize && f.ageRule === "adults"} onChange={() => onChange({ ...f, prize: false, ageRule: "adults" })} /> No prizes, adults (18+)</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!f.prize && f.ageRule === "practice"} onChange={() => onChange({ ...f, prize: false, ageRule: "practice" })} /> Practice tournament: no prizes, teens can play too</label>
      </fieldset>
      {f.prize && (
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink">Prizes (from the sponsor: goods, vouchers, services, NotesApp Credit they pay for, or N$; never cash from a game)</legend>
          {f.prizes.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input className={`${input} max-w-[6rem]`} placeholder="1st" value={p.place} onChange={(e) => set("prizes", f.prizes.map((x, j) => (j === i ? { ...x, place: e.target.value } : x)))} />
              <input className={input} placeholder="What it is, and how it's delivered" value={p.prize} onChange={(e) => set("prizes", f.prizes.map((x, j) => (j === i ? { ...x, prize: e.target.value } : x)))} />
              <button className={btn} onClick={() => set("prizes", f.prizes.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          {f.prizes.length < 10 && <button className={btn} onClick={() => set("prizes", [...f.prizes, { place: `${f.prizes.length + 1}${["st", "nd", "rd"][f.prizes.length] ?? "th"}`, prize: "" }])}>Add a prize</button>}
          <label className="flex items-start gap-2 rounded-lg bg-paper p-3 text-sm">
            <input type="checkbox" className="mt-1" checked={f.legalChecked} onChange={(e) => set("legalChecked", e.target.checked)} />
            <span><b>Legal check done.</b> Admin has checked whether this free, skill-based contest with sponsor prizes needs any promotion approval in Nigeria, and the Terms clause for tournaments is in place. A prize tournament won&apos;t open for entries until this is ticked (owner, 21 Nov 2026).</span>
          </label>
        </fieldset>
      )}
      <div className="flex gap-2">
        <button className={primary} onClick={onSave} disabled={busy}>Save</button>
        <button className={btn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function Details({ t, data, busy, act }: { t: Row; data: { results: Result[]; report: Report }; busy: boolean; act: (b: Record<string, unknown>, done: string) => Promise<boolean> }) {
  const r = data.report;
  return (
    <div className="mt-4 border-t border-rule pt-4 text-sm">
      <h3 className="font-display text-lg text-ink">Sponsor&apos;s report</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        {[["Entrants", r.entrants], ["Tries started", r.tries], ["Finished games", r.finished], ["Refused / given up / expired", `${r.rejected} / ${r.abandoned} / ${r.expired}`],
          ["Sponsor takeover views", r.sponsorImpressions], ["Sponsor takeover clicks", r.sponsorClicks], ["Page views", r.pageViews ?? "not counted yet"]].map(([k, v]) => (
          <div key={String(k)} className="rounded-lg border border-rule p-2"><p className="text-xs text-slate">{k}</p><p className="text-ink">{v}</p></div>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate">Takeover views and clicks count once per visitor per day, like Admin → Ads, but on the tournament, not on any booked advert. Page views: TODO, not counted yet.</p>

      <h3 className="mt-5 font-display text-lg text-ink">Check results</h3>
      <p className="text-xs text-slate">The top entrants with every try they sent. Look for odd patterns (§5) before ticking; nothing is handed over before that check.</p>
      {data.results.length === 0 ? <p className="mt-2 text-slate">No finished tries yet.</p> : (
        <table className="mt-2 w-full text-left text-sm">
          <thead><tr className="text-xs text-slate"><th>#</th><th>Member</th><th>Best</th><th>Tries</th></tr></thead>
          <tbody>
            {data.results.map((e) => (
              <tr key={e.uid} className="border-t border-rule align-top">
                <td className="py-1.5 pr-2">{e.place}</td>
                <td className="pr-2"><Link href={`/u/${e.username}`} className="text-crimson">@{e.username}</Link></td>
                <td className="pr-2">{e.best.summary}<br /><span className="text-xs text-slate">{e.best.at.slice(0, 16).replace("T", " ")} UTC</span></td>
                <td className="text-xs text-slate">{e.runs.map((x) => <div key={x.id}>#{x.try} {x.status}{x.result ? `: ${x.result.summary}` : ""}{x.reason ? ` (${x.reason})` : ""}{x.length ? ` · ${x.length} chars` : ""}</div>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {t.status !== "results"
          ? <button className={btn} disabled={busy || t.phase !== "ended"} title={t.phase !== "ended" ? "After play has ended (or close it first)" : ""} onClick={() => act({ action: "results-checked", id: t.id }, "Results marked as checked; they show on the public page.")}>Results checked</button>
          : <span className="text-xs text-slate">✓ Results checked {t.resultsCheckedAt?.slice(0, 10)}</span>}
        {t.prize && (t.prizesSentAt
          ? <span className="text-xs text-slate">✓ Prizes sent {t.prizesSentAt.slice(0, 10)}</span>
          : <button className={btn} disabled={busy || !t.resultsCheckedAt} onClick={() => act({ action: "prizes-sent", id: t.id }, "Prizes marked as sent.")}>Mark prizes sent</button>)}
      </div>
    </div>
  );
}
