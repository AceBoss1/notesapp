"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { capi } from "@/components/community/api";
import { FEED_GROUPS, SESSION_BELL_MINUTES, type CalMode, type CalPrefs, type FeedGroup } from "@/lib/my-calendar";
import { CalendarHeader } from "./MyCalendar";

// The two settings screens of My Calendar (docs/MY_CALENDAR.md, mockups 4 and 6): Sync with your phone (the private link and what goes
// out on it) and Calendar settings (reminders, times, and what's coming later). Both save as she changes them.
type FeedLink = { has: boolean; https: string | null; webcal: string | null; createdAt: string | null; shownOnce: boolean };
type Settings = { prefs: CalPrefs; link: FeedLink; mode: CalMode };

export function Toggle({ on, onChange, label, disabled = false }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-crimson" : "bg-[#CFC3BC]"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[1.125rem]" : "left-0.5"}`} />
    </button>
  );
}

function useSettings() {
  const router = useRouter();
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => onAuthStateChanged(auth, (u) => {
    if (!u) return router.replace("/login?next=/calendar");
    capi<Settings>("/api/calendar?settings=1").then(setS).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your settings."));
  }), [router]);
  const save = async (prefs: CalPrefs) => {
    setS((cur) => (cur ? { ...cur, prefs } : cur)); setError(""); setSaved("");
    try { const r = await capi<{ prefs: CalPrefs }>("/api/calendar", { action: "save", prefs }); setS((cur) => (cur ? { ...cur, prefs: r.prefs } : cur)); setSaved("Saved ✓"); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); }
  };
  return { s, setS, error, setError, saved, save };
}

const card = "rounded-2xl border border-rule bg-card";
const rowCls = "flex items-center justify-between gap-3 border-t border-rule px-4 py-3 text-sm text-ink first:border-t-0";

export function CalendarSync() {
  const { s, setS, error, setError, saved, save } = useSettings();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const make = async (again: boolean) => {
    if (again && !confirm("Make a new link? The old one stops at once, so any calendar using it stops updating until you add the new one.")) return;
    setBusy(true); setError("");
    try { const r = await capi<{ link: FeedLink }>("/api/calendar", { action: "new_link" }); setS((cur) => (cur ? { ...cur, link: r.link } : cur)); setCopied(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't make a link."); }
    finally { setBusy(false); }
  };
  const stop = async () => {
    if (!confirm("Stop syncing? The link stops working and your phone's calendar stops updating from #NotesApp.")) return;
    setBusy(true);
    try { const r = await capi<{ link: FeedLink }>("/api/calendar", { action: "stop_link" }); setS((cur) => (cur ? { ...cur, link: r.link } : cur)); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't stop it."); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    if (!s?.link.https) return;
    try { await navigator.clipboard.writeText(s.link.https); setCopied(true); } catch { window.prompt("Copy your private calendar link:", s.link.https); }
  };
  const groups = FEED_GROUPS.filter((g) => !(s?.mode.teen && g.id === "money"));
  const setFeed = (id: FeedGroup, v: boolean) => s && save({ ...s.prefs, feed: { ...s.prefs.feed, [id]: v } });

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <CalendarHeader title="Sync with your phone" back />
      <h2 className="mt-4 font-display text-xl text-ink">Keep your phone&apos;s calendar up to date</h2>
      {error && <p role="alert" className="mt-3 rounded-xl bg-[#FFF1F3] px-3 py-2 text-sm text-crimson">{error}</p>}
      {!s ? <p className="mt-6 text-sm text-slate">{error ? "" : "Loading…"}</p> : s.mode.kid ? <p className="card mt-6 p-6 text-sm text-slate">Child profiles don&apos;t have a calendar.</p> : (
        <>
          {!s.link.has ? (
            <div className={`${card} mt-4 border-crimson bg-[#FBF0F3] p-4`}>
              <p className="flex gap-3"><span className="text-2xl" aria-hidden>📱</span><span><b className="block font-ui text-[15px] text-ink">Make my private calendar link</b><span className="text-xs text-slate">Your phone&apos;s calendar (iPhone Calendar, Google Calendar on Android, Outlook) subscribes to it and keeps itself up to date. New bookings appear on their own.</span></span></p>
              <button type="button" disabled={busy} onClick={() => make(false)} className="btn-primary mt-3 w-full !rounded-full !py-2.5 text-sm">{busy ? "Making it…" : "Make my link"}</button>
            </div>
          ) : !s.link.webcal ? (
            <div className={`${card} mt-4 p-4 text-sm text-slate`}>
              <p className="font-ui font-bold text-ink">Your private link is working ✓</p>
              <p className="mt-1">For your privacy it can&apos;t be shown again here. To add it to another calendar, make a new link (the old one then stops).</p>
              <button type="button" disabled={busy} onClick={() => make(true)} className="btn-primary mt-3 !rounded-full !px-4 !py-2 text-xs">Make a new link</button>
            </div>
          ) : (
            <>
              <a href={s.link.webcal} className={`${card} mt-4 flex gap-3 border-crimson bg-[#FBF0F3] p-4 hover:border-crimson-bright`}>
                <span className="text-2xl" aria-hidden>📱</span>
                <span><b className="block font-ui text-[15px] text-ink">Add to this phone&apos;s calendar</b><span className="text-xs text-slate">Opens your calendar app (iPhone Calendar, Google Calendar on Android, Outlook) to subscribe. New bookings appear on their own.</span></span>
              </a>
              <button type="button" onClick={copy} className={`${card} mt-3 flex w-full gap-3 p-4 text-left hover:border-crimson`}>
                <span className="text-2xl" aria-hidden>🔗</span>
                <span><b className="block font-ui text-[15px] text-ink">{copied ? "Copied ✓" : "Copy my private calendar link"}</b><span className="text-xs text-slate">For Google Calendar on a computer (Other calendars → From URL) or Outlook (Add calendar → Subscribe from web). Paste the link there.</span></span>
              </button>
              {s.link.shownOnce && <p className="mt-2 text-xs text-slate">Copy it now: for your privacy this link is shown only this once.</p>}
              <p className="mt-2 text-xs text-slate">iPhone checks about every hour; Google can take several hours to show a change.</p>
            </>
          )}

          <h3 className="mt-6 font-ui text-sm font-bold text-ink">What goes to your phone</h3>
          <div className={`${card} mt-2`}>
            {groups.map((g) => (
              <div key={g.id} className={rowCls}><span>{g.label}</span><Toggle on={s.prefs.feed[g.id]} onChange={(v) => setFeed(g.id, v)} label={g.label} /></div>
            ))}
            <div className={rowCls}><span><span aria-hidden>🌸</span> My Cycle (shows as &quot;Private&quot;)<span className="block text-xs text-slate">Not yet: My Cycle keeps its dates locked and encrypted, so the calendar can&apos;t read them.</span></span><Toggle on={false} onChange={() => {}} label="My Cycle" disabled /></div>
          </div>
          <p className="mt-1 text-xs text-slate" aria-live="polite">{saved || "Only titles and times go out: never amounts or notes."}</p>

          <p className="mt-5 rounded-xl border border-[#F1D48A] bg-[#FFF4D6] px-3 py-2.5 text-xs leading-relaxed text-[#5a4300]">
            Your link is private: anyone who has it can see these events.{" "}
            {s.link.has ? <><button type="button" disabled={busy} onClick={() => make(true)} className="font-semibold underline">Make a new link</button> stops the old one at once.</> : "You can make a new one at any time, which stops the old one at once."}
          </p>
          {s.link.has && <button type="button" disabled={busy} onClick={stop} className="mt-3 text-xs font-semibold text-slate underline">Stop syncing</button>}
          <p className="mt-6 text-xs text-slate">In the #NotesApp app for Android and iPhone, &quot;Add to my calendar&quot; on an entry will put it straight into your phone&apos;s calendar once the app update with calendar access is out. <Link href="/help/my-calendar" className="text-crimson underline">How syncing works</Link></p>
        </>
      )}
    </div>
  );
}

export function CalendarReminders() {
  const { s, error, saved, save } = useSettings();
  const bells = s?.prefs.bells;
  const setBell = <K extends keyof CalPrefs["bells"]>(k: K, v: CalPrefs["bells"][K]) => s && save({ ...s.prefs, bells: { ...s.prefs.bells, [k]: v } });
  const select = "rounded-lg border border-rule bg-card px-2 py-1 text-sm font-semibold text-ink";
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <CalendarHeader title="Calendar settings" back />
      {error && <p role="alert" className="mt-3 rounded-xl bg-[#FFF1F3] px-3 py-2 text-sm text-crimson">{error}</p>}
      {!s || !bells ? <p className="mt-6 text-sm text-slate">{error ? "" : "Loading…"}</p> : (
        <>
          <h2 className="mt-5 font-ui text-sm font-bold text-ink">Reminders on #NotesApp</h2>
          <div className={`${card} mt-2`}>
            <label className={rowCls}><span><span aria-hidden>🔔</span> Bell before sessions and calls</span>
              <select className={select} value={bells.sessionsMin} onChange={(e) => setBell("sessionsMin", Number(e.target.value))}>
                {SESSION_BELL_MINUTES.map((m) => <option key={m} value={m}>{m ? `${m} min` : "Off"}</option>)}
              </select>
            </label>
            <label className={rowCls}><span><span aria-hidden>🔔</span> Bell before events and lives</span>
              <select className={select} value={bells.events ? "1" : "0"} onChange={(e) => setBell("events", e.target.value === "1")}>
                <option value="1">1 hour</option><option value="0">Off</option>
              </select>
            </label>
            <div className={rowCls}><span><span aria-hidden>🔔</span> Day before a hotel check-in</span><Toggle on={bells.hotelDayBefore} onChange={(v) => setBell("hotelDayBefore", v)} label="Day before a hotel check-in" /></div>
            <div className={rowCls}><span><span aria-hidden>✉️</span> Email me the week ahead (Mondays)</span><Toggle on={bells.weekAhead} onChange={(v) => setBell("weekAhead", v)} label="Email me the week ahead on Mondays" /></div>
          </div>
          <p className="mt-1 text-xs text-slate" aria-live="polite">{saved || "Bookings still remind you a day and an hour before, interviews a day and an hour before, and events you're going to and paid lives a day and an hour before. These add to them."}</p>

          <h2 className="mt-6 font-ui text-sm font-bold text-ink">Your times</h2>
          <p className={`${card} mt-2 px-4 py-3 text-sm text-ink`}>Shown in <b>Lagos time (WAT)</b>, as bookings, tickets and interviews are.</p>

          <h2 className="mt-6 font-ui text-sm font-bold text-ink">Coming later</h2>
          <p className={`${card} mt-2 px-4 py-3 text-sm text-slate`}>Connect Google or Outlook so the times you&apos;re busy there are blocked on your booking calendar (two-way).</p>
          <p className="mt-6 text-xs text-slate"><Link href="/calendar/sync" className="text-crimson underline">Sync with your phone</Link> · <Link href="/help/my-calendar" className="text-crimson underline">How My Calendar works</Link></p>
        </>
      )}
    </div>
  );
}
