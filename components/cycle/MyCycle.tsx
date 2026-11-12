"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMember } from "@/lib/member-client";
import { addPasskey, confirmWithPasskey, passkeysSupported } from "@/lib/passkeys-client";
import { deviceLabel } from "@/lib/passkeys";
import { CONSENT_TEXT, MAX_LENGTH, MIN_LENGTH } from "@/lib/cycle";
import { CycleHttpError, cycleApi, cycleMenuChanged, cycleStatus, localToday, lockNow, type CycleData } from "@/lib/cycle-client";
import type { CycleStatus } from "@/lib/cycle-server";
import { TodayTab, CalendarTab, InsightsTab, AskNanaTab } from "./CycleTabs";
import CheckIn from "./CheckIn";
import CycleSettings from "./CycleSettings";

// My Cycle (docs/MY_CYCLE.md): first open, the lock, and the four tabs. The page keeps her data only while it is on screen: when she
// switches apps or tabs (visibilitychange, pagehide), or after 2 minutes without a touch, it drops the data, tells the server to lock,
// and shows the lock screen, so the phone's app switcher shows nothing. Every request needs the unlock cookie the passkey check sets.

const IDLE_MS = 2 * 60_000;
export type Tab = "today" | "calendar" | "insights" | "nana";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "🌸" }, { id: "calendar", label: "Calendar", icon: "📅" },
  { id: "insights", label: "Insights", icon: "📈" }, { id: "nana", label: "Ask Nana", icon: "💬" },
];
const TITLE: Record<Tab, string> = { today: "My Cycle", calendar: "Calendar", insights: "Insights", nana: "Ask Nana" };

export default function MyCycle() {
  const { user } = useMember();
  const [status, setStatus] = useState<CycleStatus | null>(null);
  const [error, setError] = useState("");
  const [data, setData] = useState<CycleData | null>(null);
  const [locked, setLocked] = useState(true);
  const [tab, setTab] = useState<Tab>("today");
  const [checkIn, setCheckIn] = useState<string | null>(null); // the day being checked in
  const [settings, setSettings] = useState(false);
  const lastActive = useRef(Date.now());
  const lastPing = useRef(Date.now());

  useEffect(() => {
    if (!user) return;
    cycleStatus(user).then(setStatus).catch((e) => setError(e instanceof Error ? e.message : "Couldn't open My Cycle."));
  }, [user]);

  // Lock: forget everything on screen and tell the server.
  const lock = useCallback(() => {
    setData(null); setLocked(true); setCheckIn(null); setSettings(false);
    lockNow();
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const d = await cycleApi<CycleData>(user, { query: `today=${localToday()}` });
      setData(d); setLocked(false); setError("");
    } catch (e) {
      if (e instanceof CycleHttpError && e.status === 423) { setData(null); setLocked(true); return; }
      setError(e instanceof Error ? e.message : "Couldn't open My Cycle.");
    }
  }, [user]);

  // The privacy shield.
  useEffect(() => {
    if (locked) return;
    const hide = () => { if (document.visibilityState === "hidden") lock(); };
    const touch = () => { lastActive.current = Date.now(); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", lock);
    for (const ev of ["pointerdown", "keydown", "scroll", "touchstart"]) window.addEventListener(ev, touch, { passive: true });
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (now - lastActive.current > IDLE_MS) { lock(); return; }
      // Keep the 2-minute unlock alive while she is using the page.
      if (user && now - lastPing.current > 60_000 && now - lastActive.current < 60_000) {
        lastPing.current = now;
        cycleApi(user, { query: "ping=1" }).catch((e) => { if (e instanceof CycleHttpError && e.status === 423) lock(); });
      }
    }, 10_000);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", lock);
      for (const ev of ["pointerdown", "keydown", "scroll", "touchstart"]) window.removeEventListener(ev, touch);
      window.clearInterval(timer);
    };
  }, [locked, lock, user]);

  // Any request that finds the lock back on (2 minutes passed) shows the lock screen.
  const call = useCallback(async <T,>(body: Record<string, unknown>, method?: string): Promise<T> => {
    if (!user) throw new Error("Sign in first.");
    lastPing.current = Date.now();
    try { return await cycleApi<T>(user, { body, method }); } catch (e) {
      if (e instanceof CycleHttpError && e.status === 423) lock();
      throw e;
    }
  }, [user, lock]);

  if (user === undefined || (user && !status && !error)) return <Shell><p className="p-8 text-center text-sm text-slate">Opening My Cycle…</p></Shell>;
  if (user === null) return (
    <Shell>
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="font-display text-2xl text-ink">My Cycle</h1>
        <p className="mt-2 text-sm text-slate">A private cycle and wellness companion, locked with your fingerprint, face or passkey. Sign in to open it.</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/login?next=/cycle" className="btn-primary !py-2.5 text-sm">Sign in</Link>
          <Link href="/my-cycle" className="btn-ghost !py-2.5 text-sm">How it works</Link>
        </div>
      </div>
    </Shell>
  );
  if (!status) return <Shell><p className="p-8 text-center text-sm text-crimson">{error}</p></Shell>;
  if (!status.eligible) return (
    <Shell><div className="mx-auto max-w-md p-6 text-center"><p className="text-sm text-ink">{status.reason}</p><Link href="/journals" className="mt-4 inline-block text-sm font-semibold text-crimson">Back to the feed</Link></div></Shell>
  );
  if (!status.ready) return <Shell><p className="mx-auto max-w-md p-8 text-center text-sm text-slate">My Cycle isn&apos;t switched on yet. Please check back soon.</p></Shell>;
  if (status.answer === null) return <FirstOpen onDone={(s) => { setStatus(s); if (user) cycleMenuChanged(user.uid); }} />;
  if (status.answer === "no") return (
    <Shell>
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-ink">You chose <b>Not for me</b>, so My Cycle is hidden from your menu.</p>
        <p className="mt-1 text-sm text-slate">You can change this at any time in <Link href="/profile/account#privacy" className="text-crimson underline">Settings → Privacy</Link>.</p>
        <button type="button" className="btn-ghost mt-4 !py-2 text-sm" onClick={async () => { if (!user) return; setStatus(await cycleApi<CycleStatus>(user, { body: { action: "answer", answer: "undo" } })); cycleMenuChanged(user.uid); }}>Show My Cycle again</button>
      </div>
    </Shell>
  );
  if (locked || !data) return <LockScreen onUnlocked={load} error={error} />;

  const today = data.today.today;
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-paper pb-24 lg:pb-10">
      <div className="mx-auto max-w-3xl lg:px-6 lg:pt-6">
        <div className="lg:overflow-hidden lg:rounded-3xl lg:border lg:border-rule lg:bg-paper lg:shadow-sm">
          <header className="flex items-center gap-2 bg-gradient-to-r from-crimson-deep to-crimson-bright px-4 py-3 text-white">
            <span className="text-lg" aria-hidden>🌸</span>
            <h1 className="font-ui text-[15px] font-bold">{TITLE[tab]}</h1>
            <span className="ml-auto flex items-center gap-1">
              <button type="button" onClick={() => setSettings(true)} aria-label="My Cycle settings" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15">⚙️</button>
              <button type="button" onClick={lock} aria-label="Lock My Cycle" title="Lock now" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15">🔒</button>
            </span>
          </header>
          <nav aria-label="My Cycle" className="hidden border-b border-rule bg-card lg:flex">
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
                className={`flex-1 py-3 font-ui text-sm ${tab === t.id ? "border-b-2 border-crimson font-bold text-crimson" : "text-slate hover:text-ink"}`}>
                <span aria-hidden>{t.icon}</span> {t.label}
              </button>
            ))}
          </nav>
          <main className="px-4 py-4 lg:px-6 lg:py-6">
            {tab === "today" && <TodayTab data={data} call={call} onCheckIn={() => setCheckIn(today)} />}
            {tab === "calendar" && <CalendarTab data={data} call={call} reload={load} onCheckIn={setCheckIn} />}
            {tab === "insights" && <InsightsTab data={data} call={call} />}
            {tab === "nana" && <AskNanaTab data={data} call={call} />}
          </main>
        </div>
      </div>
      <nav aria-label="My Cycle" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-rule bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
            className={`flex-1 py-2 text-center font-ui text-[11px] ${tab === t.id ? "font-bold text-crimson" : "text-slate"}`}>
            <span className="block text-lg leading-6" aria-hidden>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>
      {checkIn && <CheckIn day={checkIn} data={data} call={call} onClose={() => setCheckIn(null)} onSaved={load} />}
      {settings && <CycleSettings data={data} call={call} user={user!} onClose={() => setSettings(false)} onChanged={load} onDeleted={() => { setSettings(false); setData(null); setLocked(true); setStatus({ ...status, answer: null }); if (user) cycleMenuChanged(user.uid); }} />}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[60vh] bg-paper">{children}</div>;
}

// ── 1 · First open ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function FirstOpen({ onDone }: { onDone: (s: CycleStatus) => void }) {
  const { user } = useMember();
  const [choice, setChoice] = useState<"female" | "no" | null>(null);
  const [last, setLast] = useState("");
  const [len, setLen] = useState<"unknown" | number>(28);
  const [custom, setCustom] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hidden, setHidden] = useState<CycleStatus | null>(null);
  const today = localToday();
  const opt = (on: boolean) => `flex w-full items-start gap-3 rounded-2xl border p-3 text-left ${on ? "border-crimson bg-crimson/[0.05]" : "border-rule bg-card"}`;
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 font-ui text-xs font-semibold ${on ? "border-crimson bg-crimson text-white" : "border-rule bg-card text-ink"}`;

  const go = async () => {
    if (!user || !choice) return;
    setBusy(true); setError("");
    try {
      const s = await cycleApi<CycleStatus>(user, { body: choice === "no" ? { action: "answer", answer: "no" } : { action: "answer", answer: "female", consent, lastPeriod: last || null, cycleLength: len === "unknown" ? null : len } });
      if (choice === "no") setHidden(s); else onDone(s);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); } finally { setBusy(false); }
  };

  if (hidden) return (
    <div className="mx-auto max-w-md p-6 text-center">
      <p className="text-sm text-ink">Done. My Cycle is hidden from your menu.</p>
      <p className="mt-1 text-sm text-slate">Changed your mind? Go to <Link href="/profile/account#privacy" className="text-crimson underline">Settings → Privacy</Link>.</p>
      <button type="button" className="btn-ghost mt-4 !py-2 text-sm" onClick={() => onDone(hidden)}>OK</button>
    </div>
  );
  return (
    <div className="mx-auto max-w-md lg:py-6">
      <div className="lg:overflow-hidden lg:rounded-3xl lg:border lg:border-rule lg:shadow-sm">
        <header className="flex items-center gap-2 bg-gradient-to-r from-crimson-deep to-crimson-bright px-4 py-3 text-white"><span aria-hidden>🌸</span><span className="font-ui text-[15px] font-bold">My Cycle</span></header>
        <div className="flex flex-col gap-3 bg-paper px-4 py-5">
          <h1 className="font-display text-2xl text-ink">Before we start</h1>
          <p className="text-sm leading-relaxed text-slate">My Cycle is for women and girls. Your answer is private: it never shows on your profile, and nobody else can see it.</p>
          <button type="button" className={opt(choice === "female")} onClick={() => setChoice("female")} aria-pressed={choice === "female"}>
            <span className="text-2xl" aria-hidden>♀️</span><span><b className="block font-ui text-sm text-ink">I&apos;m female</b><span className="text-xs text-slate">Set up My Cycle</span></span>
          </button>
          <button type="button" className={opt(choice === "no")} onClick={() => setChoice("no")} aria-pressed={choice === "no"}>
            <span className="text-2xl" aria-hidden>🙅</span><span><b className="block font-ui text-sm text-ink">Not for me</b><span className="text-xs text-slate">We&apos;ll hide My Cycle from your menu</span></span>
          </button>
          {choice === "female" && (
            <>
              <label className="mt-2 font-ui text-xs font-bold text-ink" htmlFor="cy-last">When did your last period start?</label>
              <input id="cy-last" type="date" max={today} value={last} onChange={(e) => setLast(e.target.value)} className="rounded-2xl border border-rule bg-card px-3 py-2.5 text-sm text-ink" />
              <span className="font-ui text-xs font-bold text-ink">How long is your cycle, usually?</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={chip(len === "unknown")} onClick={() => { setLen("unknown"); setCustom(false); }}>I don&apos;t know</button>
                <button type="button" className={chip(len === 28 && !custom)} onClick={() => { setLen(28); setCustom(false); }}>28 days</button>
                <button type="button" className={chip(custom)} onClick={() => { setCustom(true); if (len === "unknown") setLen(28); }}>Set {MIN_LENGTH}–{MAX_LENGTH}</button>
              </div>
              {custom && (
                <label className="flex items-center gap-3 text-sm text-ink">
                  <input type="range" min={MIN_LENGTH} max={MAX_LENGTH} value={len === "unknown" ? 28 : len} onChange={(e) => setLen(Number(e.target.value))} className="flex-1 accent-[#7A0328]" />
                  <b className="w-16 text-right">{len} days</b>
                </label>
              )}
              <label className="mt-1 flex items-start gap-2 text-xs leading-relaxed text-ink">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[#7A0328]" />
                <span>{CONSENT_TEXT} <Link href="/privacy#my-cycle" className="text-crimson underline">Privacy Policy</Link>.</span>
              </label>
              <p className="rounded-xl border border-[#F1D48A] bg-[#FFF4D6] px-3 py-2 text-xs leading-relaxed text-[#5a4300]">🔒 Next, protect it with your fingerprint, face or passkey. You&apos;ll need it every time you open My Cycle.</p>
            </>
          )}
          {error && <p className="text-sm text-crimson" role="alert">{error}</p>}
          <button type="button" disabled={!choice || busy || (choice === "female" && !consent)} onClick={go} className="mt-2 rounded-full bg-crimson py-3 font-ui text-sm font-bold text-white disabled:opacity-50">
            {busy ? "Saving…" : "Continue"}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-slate">My Cycle is not contraception and not medical advice: predictions are estimates from what you log.</p>
        </div>
      </div>
    </div>
  );
}

// ── 2 · Locked ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function LockScreen({ onUnlocked, error: outer }: { onUnlocked: () => Promise<void>; error: string }) {
  const { user } = useMember();
  const [keys, setKeys] = useState<{ hasPasskey: boolean; passkeysHere: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(outer);
  const [supported, setSupported] = useState(true);
  useEffect(() => { setSupported(passkeysSupported()); }, []);
  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((t) => fetch("/api/cycle/unlock", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" })).then((r) => r.json()).then(setKeys).catch(() => setKeys({ hasPasskey: true, passkeysHere: true }));
  }, [user]);

  const unlock = async () => {
    if (!user) return;
    setBusy(true); setError("");
    try { await confirmWithPasskey(user, "/api/cycle/unlock"); await onUnlocked(); } catch (e) {
      const m = e instanceof Error ? e.message : "That didn't work. Try again.";
      if (/Add a passkey/.test(m)) setKeys((k) => (k ? { ...k, hasPasskey: false } : k));
      setError(m);
    } finally { setBusy(false); }
  };
  const add = async () => {
    if (!user) return;
    setBusy(true); setError("");
    try { await addPasskey(user, deviceLabel(navigator.userAgent)); setKeys((k) => (k ? { ...k, hasPasskey: true } : k)); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't add a passkey."); } finally { setBusy(false); }
  };

  const noKey = keys && !keys.hasPasskey;
  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-3 bg-gradient-to-br from-crimson-deep to-crimson-bright px-6 py-12 text-center text-white">
      <p className="text-sm opacity-85">My Cycle is locked</p>
      <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/50 bg-white/10 text-5xl" aria-hidden>{noKey ? "🔑" : "👆"}</div>
      {!keys ? (
        <p className="text-sm opacity-85">Checking your passkeys…</p>
      ) : !supported ? (
        <>
          <h1 className="font-display text-2xl">This browser can&apos;t unlock it</h1>
          <p className="max-w-sm text-sm opacity-85">My Cycle opens with a passkey (fingerprint, face or screen lock). Open #NotesApp in an up-to-date browser on your phone or computer.</p>
        </>
      ) : !keys.passkeysHere ? (
        <>
          <h1 className="font-display text-2xl">Open My Cycle on #NotesApp</h1>
          <p className="max-w-sm text-sm opacity-85">Passkeys work on the #NotesApp site and app, not on this address.</p>
        </>
      ) : noKey ? (
        <>
          <h1 className="font-display text-2xl">First, add a passkey</h1>
          <p className="max-w-sm text-sm leading-relaxed opacity-85">My Cycle opens only with your fingerprint, face or screen lock, through a #NotesApp passkey on this device. It takes a few seconds, and you can use it to sign in too.</p>
          <button type="button" onClick={add} disabled={busy} className="rounded-full bg-white px-6 py-2.5 font-ui text-sm font-bold text-crimson disabled:opacity-60">{busy ? "Waiting for your device…" : "Add a passkey"}</button>
          <Link href="/help/passkeys" className="text-xs underline opacity-80">What&apos;s a passkey?</Link>
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl">Unlock with your fingerprint</h1>
          <p className="max-w-sm text-sm leading-relaxed opacity-85">Uses this device&apos;s fingerprint, face or screen lock through your #NotesApp passkey. Nothing about your body leaves the device.</p>
          <button type="button" onClick={unlock} disabled={busy} className="rounded-full bg-white px-6 py-2.5 font-ui text-sm font-bold text-crimson disabled:opacity-60">{busy ? "Waiting for your device…" : "Unlock"}</button>
          <p className="mt-2 max-w-sm text-xs leading-relaxed opacity-80">Locks again after 2 minutes away, or when you switch apps.<br />When you switch apps, the screen is blanked so your phone&apos;s app switcher shows nothing.</p>
        </>
      )}
      {error && <p className="max-w-sm rounded-xl bg-black/25 px-3 py-2 text-sm" role="alert">{error}</p>}
      <p className="absolute bottom-5 px-6 text-[11px] opacity-75">Didn&apos;t work? Try again, or use your passkey on another device.</p>
    </div>
  );
}
