"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import { LIVE_DB, MAX_RETENTION_DAYS, WEEKDAYS, dbIdOf, describeSchedule, fmtBytes, newDbId, pitrMinute, pitrOn, protectionOn, validDbId, type Backup, type Database, type LogAction, type LogEntry, type Operation, type Schedule, type Weekday } from "@/lib/backups";
import { backupsApi, signInWithGoogle, type GoogleToken } from "@/lib/backups-client";

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" }) : "–");
const card = "card mt-6 p-5";
const h2 = "font-ui text-lg font-bold text-ink";
const field = "rounded-xl border border-rule bg-paper px-3 py-2 text-sm";
type Info = { project: string; databaseId: string; clientId: string; log: LogEntry[] };
type Pending = { op: Operation; dbId: string; from: string };

// Admin → Backups: point-in-time recovery, scheduled backups, the backups themselves, and restoring one into a new database.
// The owner signs in with Google here and every change is made with that sign-in (lib/backups-client.ts), never with the site's
// server key. Switching recovery off or removing delete protection is left to the Google Cloud console on purpose.
export default function AdminBackupsPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/backups");
  const [info, setInfo] = useState<Info | null>(null);
  const [denied, setDenied] = useState("");
  const [token, setToken] = useState<GoogleToken | null>(null);
  const [db, setDb] = useState<Database | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [backups, setBackups] = useState<Backup[] | null>(null);
  const [dbs, setDbs] = useState<Database[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [daily, setDaily] = useState(14);
  const [weekly, setWeekly] = useState<{ day: Weekday; weeks: number }>({ day: "SUNDAY", weeks: 14 });
  const [restoring, setRestoring] = useState<{ from: string; label: string; kind: "restore" | "clone"; id: string; typed: string } | null>(null);
  const [minute, setMinute] = useState("");

  useEffect(() => { if (user) call().then(setInfo).catch((e) => setDenied(e.message)); }, [user, call]);
  const api = token && info ? backupsApi(token, info.project) : null;
  const log = (action: LogAction, detail: string) => call({ action, detail }).then(() => call().then(setInfo)).catch(() => {});

  const refresh = useCallback(async (a = api) => {
    if (!a) return;
    const [d, s, b, all] = await Promise.all([a.database(), a.schedules(), a.backups(), a.databases()]);
    setDb(d); setSchedules(s); setBackups(b); setDbs(all.filter((x) => dbIdOf(x.name) !== LIVE_DB));
  }, [api]);
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(""); setMsg("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(""); }
  };

  // Restores and copies take minutes: follow each until Google says it's done.
  useEffect(() => {
    if (!api || !pending.length) return;
    const t = setInterval(async () => {
      const next = await Promise.all(pending.map(async (p) => ({ ...p, op: await api.operation(p.op.name).catch(() => p.op) })));
      const finished = next.filter((p) => p.op.done);
      if (finished.length) { setMsg(finished.map((p) => (p.op.error ? `${p.dbId}: ${p.op.error.message}` : `${p.dbId} is ready.`)).join(" ")); void refresh(); }
      setPending(next.filter((p) => !p.op.done));
    }, 10_000);
    return () => clearInterval(t);
  }, [api, pending, refresh]);

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (denied) return <section className="mx-auto max-w-3xl px-4 py-14"><h1 className="font-display text-4xl">Backups</h1><p className="mt-4 text-sm text-slate">{denied} Backups and restores are the owner&apos;s, done with the owner&apos;s own Google sign-in.</p></section>;
  if (!info) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;

  const hasDaily = schedules.some((s) => s.dailyRecurrence), hasWeekly = schedules.some((s) => s.weeklyRecurrence);
  const confirmWord = restoring?.kind === "clone" ? "COPY" : "RESTORE";
  const startRestore = () => restoring && run("restore", async () => {
    if (!validDbId(restoring.id)) throw new Error("A database name is 4 to 63 lower-case letters, digits and hyphens, starting with a letter.");
    if (restoring.typed !== confirmWord) throw new Error(`Type ${confirmWord} to confirm.`);
    const op = restoring.kind === "clone" ? await api!.clone(restoring.from, restoring.id) : await api!.restore(restoring.from, restoring.id);
    setPending((p) => [...p, { op, dbId: restoring.id, from: restoring.label }]);
    await log(restoring.kind, `${restoring.id} from ${restoring.label}`);
    setRestoring(null);
    setMsg(`Making ${restoring.id}. It takes a few minutes, longer for a big database; this page follows it.`);
  });

  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-4xl">Backups</h1>
      <p className="mt-2 text-sm text-slate">Keep a way back for the database: point-in-time recovery (any minute of the last 7 days), daily and weekly backups (kept up to 14 weeks), and restoring one into a new database beside the live one. You work here with your own Google sign-in, so the site&apos;s server key never has these powers. Project <b>{info.project || "?"}</b> · the site uses <b>{info.databaseId}</b>.</p>
      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {msg && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p>}

      {!token ? (
        <div className={card}>
          <h2 className={h2}>Sign in with Google</h2>
          <p className="mt-1 text-sm text-slate">Use the Google account that owns the project in Google Cloud (with its security key). The sign-in lasts an hour and stays in this tab.</p>
          {!info.clientId ? <p className="mt-3 text-sm text-amber-800">Set NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID first (HANDOVER, &quot;Backups&quot;).</p> : (
            <button disabled={!!busy} onClick={() => run("signin", async () => { const t = await signInWithGoogle(info.clientId); setToken(t); await refresh(backupsApi(t, info.project)); })} className="btn-primary mt-4 !px-4 !py-2 text-xs">{busy === "signin" ? "Signing in…" : "Sign in with Google"}</button>
          )}
        </div>
      ) : (
        <>
          <div className={card}>
            <div className="flex items-baseline justify-between gap-2"><h2 className={h2}>Protection</h2><button disabled={!!busy} onClick={() => run("refresh", () => refresh())} className="font-ui text-xs font-semibold text-crimson-bright">{busy === "refresh" ? "Checking…" : "Check again"}</button></div>
            <ul className="mt-3 divide-y divide-rule text-sm">
              <li className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span><b>Point-in-time recovery</b><span className="block text-xs text-slate">{pitrOn(db) ? `On: any minute back to ${when(db?.earliestVersionTime)}` : "Off: a mistake or a wipe can't be wound back to the minute"}</span></span>
                {pitrOn(db) ? <Chip on /> : <button disabled={!!busy} onClick={() => run("pitr", async () => { await api!.pitrOn(); await log("pitr_on", "switched on"); await refresh(); setMsg("Point-in-time recovery is on. The 7-day window fills from now."); })} className="btn-primary !px-4 !py-2 text-xs">{busy === "pitr" ? "Switching on…" : "Switch on"}</button>}
              </li>
              <li className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span><b>Delete protection</b><span className="block text-xs text-slate">{protectionOn(db) ? "On: the database can't be deleted until someone switches this off in Google Cloud" : "Off: anyone with the rights can delete the database in one step"}</span></span>
                {protectionOn(db) ? <Chip on /> : <button disabled={!!busy} onClick={() => run("protect", async () => { await api!.protectionOn(); await log("protection_on", "switched on"); await refresh(); })} className="btn-primary !px-4 !py-2 text-xs">{busy === "protect" ? "Switching on…" : "Switch on"}</button>}
              </li>
            </ul>
            <p className="mt-2 text-xs text-slate">Switching either off is done in the Google Cloud console only, on purpose.</p>
          </div>

          <div className={card}>
            <h2 className={h2}>Backup schedules</h2>
            <p className="mt-1 text-sm text-slate">Google allows one daily and one weekly schedule, each kept up to 14 weeks. Backups outlive the database if it&apos;s deleted.</p>
            {schedules.length > 0 && (
              <ul className="mt-3 divide-y divide-rule rounded-xl border border-rule text-sm">
                {schedules.map((s) => (
                  <li key={s.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>{describeSchedule(s)}<span className="block text-xs text-slate">since {when(s.createTime)}</span></span>
                    <button disabled={!!busy} onClick={() => { if (confirm(`Stop this schedule? (${describeSchedule(s)}) Backups already made are kept until they expire.`)) void run("del", async () => { await api!.deleteSchedule(s.name); await log("schedule_delete", describeSchedule(s)); await refresh(); }); }} className="btn-ghost !px-3 !py-1.5 text-xs">Stop</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-rule p-3 text-sm">
                <b>Daily</b>
                <label className="mt-2 flex items-center gap-2 text-xs">Keep each <input type="number" min={1} max={MAX_RETENTION_DAYS} value={daily} onChange={(e) => setDaily(Number(e.target.value))} className={`${field} w-20`} /> days</label>
                <button disabled={!!busy || hasDaily} onClick={() => run("daily", async () => { await api!.createSchedule({ days: daily }); await log("schedule_create", `daily, kept ${daily} days`); await refresh(); })} className="btn-primary mt-3 !px-4 !py-2 text-xs">{hasDaily ? "Daily is on" : busy === "daily" ? "Adding…" : "Add daily backups"}</button>
              </div>
              <div className="rounded-xl border border-rule p-3 text-sm">
                <b>Weekly</b>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  On <select value={weekly.day} onChange={(e) => setWeekly((w) => ({ ...w, day: e.target.value as Weekday }))} className={field}>{WEEKDAYS.map((d) => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}</select>
                  keep <input type="number" min={1} max={14} value={weekly.weeks} onChange={(e) => setWeekly((w) => ({ ...w, weeks: Number(e.target.value) }))} className={`${field} w-16`} /> weeks
                </div>
                <button disabled={!!busy || hasWeekly} onClick={() => run("weekly", async () => { await api!.createSchedule({ weekly: weekly.day, days: weekly.weeks * 7 }); await log("schedule_create", `weekly on ${weekly.day.charAt(0)}${weekly.day.slice(1).toLowerCase()}, kept ${weekly.weeks} weeks`); await refresh(); })} className="btn-primary mt-3 !px-4 !py-2 text-xs">{hasWeekly ? "Weekly is on" : busy === "weekly" ? "Adding…" : "Add weekly backups"}</button>
              </div>
            </div>
          </div>

          <div className={card}>
            <h2 className={h2}>Backups</h2>
            {!backups ? <p className="mt-3 text-sm text-slate">Loading…</p> : backups.length === 0 ? <p className="mt-3 text-sm text-slate">None yet. The first appears within a day of adding a schedule.</p> : (
              <ul className="mt-3 divide-y divide-rule rounded-xl border border-rule text-sm">
                {backups.map((b) => (
                  <li key={b.name} className="px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span><b>{when(b.snapshotTime)}</b> <span className="text-xs text-slate">· {b.state === "READY" ? "ready" : b.state === "CREATING" ? "being made" : "not available"} · {fmtBytes(b.stats?.sizeBytes)}{b.stats?.documentCount ? ` · ${Number(b.stats.documentCount).toLocaleString("en-GB")} documents` : ""} · kept until {when(b.expireTime)}</span></span>
                      <button disabled={!!busy || b.state !== "READY"} onClick={() => setRestoring({ from: b.name, label: `the backup of ${when(b.snapshotTime)}`, kind: "restore", id: newDbId("restore"), typed: "" })} className="btn-ghost !px-3 !py-1.5 text-xs">Restore…</button>
                    </div>
                    {restoring?.from === b.name && <RestoreForm r={restoring} setR={setRestoring} word={confirmWord} busy={busy === "restore"} go={startRestore} />}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={card}>
            <h2 className={h2}>Copy the database as it was at a minute</h2>
            <p className="mt-1 text-sm text-slate">From point-in-time recovery: pick the minute before something went wrong (Lagos time). The copy is a new database; the live one isn&apos;t touched.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input type="datetime-local" value={minute} onChange={(e) => setMinute(e.target.value)} className={field} />
              <button disabled={!!busy || !pitrOn(db) || !minute} onClick={() => { const t = pitrMinute(`${minute}:00+01:00`, db?.earliestVersionTime); if (!t) { setError(`Pick a minute between ${when(db?.earliestVersionTime)} and now.`); return; } setRestoring({ from: t, label: `${when(t)} (point in time)`, kind: "clone", id: newDbId("clone"), typed: "" }); }} className="btn-ghost !px-3 !py-2 text-xs">Copy…</button>
            </div>
            {!pitrOn(db) && <p className="mt-2 text-xs text-slate">Needs point-in-time recovery switched on.</p>}
            {restoring?.kind === "clone" && <RestoreForm r={restoring} setR={setRestoring} word={confirmWord} busy={busy === "restore"} go={startRestore} />}
          </div>

          <div className={card}>
            <h2 className={h2}>Restored databases</h2>
            {pending.map((p) => <p key={p.op.name} className="mt-2 text-sm text-amber-800">Making {p.dbId} from {p.from}{p.op.metadata?.progressPercentage ? ` (${p.op.metadata.progressPercentage}%)` : ""}…</p>)}
            {dbs.length === 0 && !pending.length ? <p className="mt-3 text-sm text-slate">None.</p> : (
              <ul className="mt-3 divide-y divide-rule rounded-xl border border-rule text-sm">
                {dbs.map((d) => <li key={d.name} className="px-3 py-2"><b>{dbIdOf(d.name)}</b>{dbIdOf(d.name) === info.databaseId && <span className="ml-2 rounded-full bg-crimson/10 px-2 py-0.5 text-[11px] text-crimson-bright">the site uses this</span>}<span className="block text-xs text-slate">made {when(d.createTime)}{d.sourceInfo?.backup?.backup ? " from a backup" : ""}</span></li>)}
              </ul>
            )}
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold text-ink">Switching the site to a restored database</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate">
                <li>Check it: open it in the Firebase console (Firestore → the database list) and look at a few members, journals and payments.</li>
                <li>Give it the rules and indexes: in firebase.json add an entry with <code>&quot;database&quot;: &quot;&lt;its name&gt;&quot;</code>, then <code>firebase deploy --only firestore</code>.</li>
                <li>In Vercel set NEXT_PUBLIC_FIRESTORE_DATABASE_ID to its name and redeploy. Every page and server route then uses it.</li>
                <li>Copy anything written to the old database since the restore point, if it still exists.</li>
              </ol>
            </details>
          </div>
        </>
      )}

      <div className={card}>
        <h2 className={h2}>What was done here</h2>
        {info.log.length === 0 ? <p className="mt-3 text-sm text-slate">Nothing yet.</p> : (
          <ul className="mt-3 divide-y divide-rule text-sm">
            {info.log.map((l) => <li key={l.id} className="py-2"><span className="text-xs text-slate">{when(l.at)} · {l.byName}</span><span className="block">{LABEL[l.action]}: {l.detail}</span></li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

const LABEL: Record<LogAction, string> = { pitr_on: "Point-in-time recovery", protection_on: "Delete protection", schedule_create: "Schedule added", schedule_delete: "Schedule stopped", restore: "Restored", clone: "Copied at a minute" };

function Chip({ on }: { on: boolean }) {
  return <span className={`rounded-full border px-3 py-1 font-ui text-[11px] font-semibold ${on ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rule text-slate"}`}>{on ? "On" : "Off"}</span>;
}

type R = { from: string; label: string; kind: "restore" | "clone"; id: string; typed: string };
function RestoreForm({ r, setR, word, busy, go }: { r: R; setR: (r: R | null) => void; word: string; busy: boolean; go: () => void }) {
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
      <p>This makes a <b>new database</b> from {r.label}. The live database isn&apos;t changed, and the site keeps using it until you switch (below).</p>
      <label className="mt-3 block text-xs font-semibold">New database name<input value={r.id} onChange={(e) => setR({ ...r, id: e.target.value.trim().toLowerCase() })} className={`${field} mt-1 w-full font-mono`} /></label>
      <label className="mt-2 block text-xs font-semibold">Type {word} to confirm<input value={r.typed} onChange={(e) => setR({ ...r, typed: e.target.value.trim() })} className={`${field} mt-1 w-full`} /></label>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || r.typed !== word || !validDbId(r.id)} onClick={go} className="btn-primary !px-4 !py-2 text-xs">{busy ? "Starting…" : r.kind === "clone" ? "Make the copy" : "Restore into it"}</button>
        <button onClick={() => setR(null)} className="btn-ghost !px-4 !py-2 text-xs">Cancel</button>
      </div>
    </div>
  );
}
