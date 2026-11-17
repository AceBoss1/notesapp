"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { capi } from "@/components/community/api";
import { Toggle } from "@/components/calendar/CalendarSettings";
import type { CalPrefs } from "@/lib/my-calendar";
import { addPasskey, passkeysSupported } from "@/lib/passkeys-client";
import { deviceLabel } from "@/lib/passkeys";
import { MOVES_BELL_HOURS, REVIEW_BELL_HOURS, hourLabel, type PlannerPrefs } from "@/lib/planner";
import { card, errText, isLocked, papi, type View } from "./api";
import { PlannerGate, PlannerHeader, type Gate } from "./PlannerGate";

// Planner settings (/calendar/planner/settings; docs/NOTES_PLANNER.md, mockup 8): the two bells, Nana's note, what leaves #NotesApp
// (nothing unless she turns it on), the optional passkey lock, Download my plan and Delete. Each saves as she changes it.
const row = "flex items-center justify-between gap-3 border-t border-rule px-4 py-3 text-sm text-ink first:border-t-0";
const select = "rounded-lg border border-rule bg-card px-2 py-1 text-sm font-semibold text-ink";

function Inner({ g }: { g: Gate }) {
  const router = useRouter();
  const [view, setView] = useState<View | null>(null);
  const [cal, setCal] = useState<CalPrefs | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    papi<View>(g.user).then(setView).catch((e) => { if (isLocked(e)) g.locked(); else setError(errText(e, "Couldn't load your settings.")); });
    capi<{ prefs: CalPrefs }>("/api/calendar?settings=1").then((r) => setCal(r.prefs)).catch(() => {});
  }, [g]);
  const back = { href: "/calendar/planner", label: "Planner" };
  if (!view) return <div className="mx-auto max-w-xl px-4 py-8"><PlannerHeader title="Planner settings" back={back} /><p className="mt-6 text-sm text-slate">{error || "Loading…"}</p></div>;
  const p = view.prefs;

  const save = async (change: Partial<PlannerPrefs>) => {
    setError(""); setSaved("");
    const before = view;
    setView({ ...view, prefs: { ...p, ...change } });
    try { const r = await papi<{ prefs: PlannerPrefs }>(g.user, { body: { action: "prefs", prefs: change } }); setView((v) => (v ? { ...v, prefs: r.prefs } : v)); setSaved("Saved ✓"); }
    catch (e) { setView(before); if (isLocked(e)) g.locked(); else setError(errText(e, "Couldn't save that.")); }
  };
  const setFeed = async (on: boolean) => {
    if (!cal) return;
    setError(""); setSaved("");
    try { const r = await capi<{ prefs: CalPrefs }>("/api/calendar", { action: "save", prefs: { ...cal, feed: { ...cal.feed, plan: on } } }); setCal(r.prefs); setSaved("Saved ✓"); }
    catch (e) { setError(errText(e, "Couldn't save that.")); }
  };
  // The lock needs a passkey here first, so she can't lock herself out.
  const setLock = async (on: boolean) => {
    if (!on) return save({ lock: false });
    setBusy(true); setError("");
    try {
      const keys = await fetch("/api/planner/unlock", { headers: { Authorization: `Bearer ${await g.user.getIdToken()}` }, cache: "no-store" }).then((r) => r.json()) as { hasPasskey?: boolean; passkeysHere?: boolean };
      if (!passkeysSupported() || !keys.passkeysHere) { setError("This browser can't use passkeys here. Open #NotesApp in an up-to-date browser to turn the lock on."); return; }
      if (!keys.hasPasskey) {
        if (!confirm("The lock uses a #NotesApp passkey (your fingerprint, face or screen lock). Add one on this device now?")) return;
        await addPasskey(g.user, deviceLabel(navigator.userAgent));
      }
      await save({ lock: true });
    } catch (e) { setError(errText(e, "Couldn't turn the lock on.")); }
    finally { setBusy(false); }
  };
  const download = async () => {
    setError("");
    try {
      const r = await fetch("/api/planner?export=1", { headers: { Authorization: `Bearer ${await g.user.getIdToken()}` }, cache: "no-store" });
      if (r.status === 423) return g.locked();
      if (!r.ok) throw new Error("Couldn't download your plan.");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a"); a.href = url; a.download = "notes-planner.json"; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(errText(e, "Couldn't download your plan.")); }
  };
  const erase = async () => {
    if (!confirm("Delete your plan, your interview answers, your ticks and your reviews? This can't be undone.")) return;
    setBusy(true);
    try { await papi(g.user, { method: "DELETE", query: "all=1" }); router.replace("/calendar/planner"); }
    catch (e) { if (isLocked(e)) g.locked(); else setError(errText(e, "Couldn't delete that.")); setBusy(false); }
  };
  const has = !!view.plan || !!view.interview;
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <PlannerHeader title="Planner settings" back={back} />
      {error && <p role="alert" className="mt-3 rounded-xl bg-[#FFF1F3] px-3 py-2 text-sm text-crimson">{error}</p>}
      <p className="mt-2 h-4 text-xs text-[#17694a]" aria-live="polite">{saved}</p>

      <h2 className="mt-2 font-ui text-sm font-bold text-ink">Reminders</h2>
      <div className={`${card} mt-2`}>
        <label className={row}><span>🔔 Today&apos;s moves, each morning</span>
          <select value={p.movesBell} onChange={(e) => save({ movesBell: Number(e.target.value) })} className={select}>{MOVES_BELL_HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
        </label>
        <label className={row}><span>🔔 Sunday review</span>
          <select value={p.reviewBell} onChange={(e) => save({ reviewBell: Number(e.target.value) })} className={select}>{REVIEW_BELL_HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
        </label>
        <div className={row}><span>✨ Nana&apos;s note on my review<span className="block text-xs text-slate">Uses a little of your Nana allowance each Sunday.</span></span><Toggle on={p.nanaNote} onChange={(v) => save({ nanaNote: v })} label="Nana's note on my review" /></div>
      </div>
      <p className="mt-2 text-xs text-slate">Bells arrive in Lagos time (WAT) and say only that your Planner is ready, never what&apos;s in it.</p>

      <h2 className="mt-6 font-ui text-sm font-bold text-ink">Privacy</h2>
      <div className={`${card} mt-2`}>
        <div className={row}><span>📲 Send to my phone&apos;s calendar<span className="block text-xs text-slate">Each month&apos;s project and the Sunday review, through your private calendar link. Shows only as &quot;Planner&quot;.</span></span><Toggle on={cal?.feed.plan === true} disabled={!cal || p.lock} onChange={setFeed} label="Send to my phone's calendar" /></div>
        {cal?.feed.plan && !p.lock && <div className={row}><span>Show the real titles on my phone<span className="block text-xs text-slate">Anyone who can see your phone&apos;s calendar can read them.</span></span><Toggle on={p.feedTitles} onChange={(v) => save({ feedTitles: v })} label="Show the real titles on my phone" /></div>}
        <div className={row}><span>🔒 Lock Planner with my passkey<span className="block text-xs text-slate">Asks for your fingerprint, face or screen lock to open it. While it&apos;s on, your plan stays out of My Calendar and your phone.</span></span><Toggle on={p.lock} disabled={busy} onChange={setLock} label="Lock Planner with my passkey" /></div>
        <button type="button" onClick={download} disabled={!has} className={`${row} w-full text-left disabled:opacity-50`}><span>⬇️ Download my plan</span><span aria-hidden>›</span></button>
        <button type="button" onClick={erase} disabled={!has || busy} className={`${row} w-full text-left text-[#B00020] disabled:opacity-50`}><span>🗑 Delete my plan and answers</span><span aria-hidden>›</span></button>
      </div>
      <p className="mt-3 rounded-xl border border-[#F1D48A] bg-[#FFF4D6] px-3 py-2 text-xs leading-relaxed text-[#5a4300]">Your answers and plan are encrypted. Staff can&apos;t read them, and they&apos;re never used for ads or by Nana anywhere else. Closing your account deletes them.</p>
      {view.teen && <p className={`${card} mt-3 p-4 text-[13px] leading-relaxed text-ink`}><b>🎒 The teen version</b><br />Your Planner is for a school term or year: exams, a skill, habits. Nana asks gentle questions only. A parent never sees your answers or your plan.</p>}
    </div>
  );
}

export default function PlannerSettings() {
  return <PlannerGate next="/calendar/planner/settings">{(g) => <Inner g={g} />}</PlannerGate>;
}
