"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useDevice } from "@/lib/use-device";
import { isMobile, type BrowserName, type Device } from "@/lib/visitor-device";

// Chrome's install prompt, when it offers one (Android, and Chrome or Edge on a computer).
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Tab = "ios" | "android" | "desktop";
type Step = readonly [string, string];

const ios: Step[] = [
  ["Open NotesApp in Safari", "Go to the NotesApp address in Safari (the blue compass). Chrome and Firefox on iPhone can do this too from iOS 16.4, but Safari is the surest."],
  ["Tap the Share button", "It is the square with an arrow pointing up, at the bottom of the screen (at the top right on an iPad)."],
  ["Choose “Add to Home Screen”", "Scroll down the list of options if you don't see it at first."],
  ["Tap “Add”", "The NotesApp icon now sits on your home screen. Open it from there and it runs full screen, like an app."],
];
const android: Step[] = [
  ["Open NotesApp in Chrome", "Go to the NotesApp address in Chrome."],
  ["Tap the ⋮ menu", "Three dots at the top right of Chrome."],
  ["Choose “Install app” (or “Add to Home screen”)", "Chrome shows whichever it supports for this site."],
  ["Tap “Install”", "NotesApp appears on your home screen and in your app list, and opens full screen."],
];
const androidOther: [string, string][] = [
  ["Samsung Internet", "Tap the menu (≡), then “Add page to”, then “Home screen”."],
  ["Firefox on Android", "Tap ⋮, then “Install”."],
];

// Steps for a computer, by browser. Chrome, Edge, Brave and Opera can install it; Safari on a Mac can add it to the Dock; Firefox on a computer cannot.
const desktop: Record<"chrome" | "edge" | "safari" | "firefox", { name: string; steps: Step[] }> = {
  chrome: { name: "Google Chrome", steps: [
    ["Open NotesApp in Chrome", "Go to the NotesApp address in a normal tab."],
    ["Click the install icon", "It is a small screen with a down arrow at the right end of the address bar. If you don't see it, open the ⋮ menu, then “Cast, save and share” (or “Save and share”), then “Install NotesApp…”."],
    ["Click “Install”", "NotesApp opens in its own window, without the browser's tabs and address bar."],
  ] },
  edge: { name: "Microsoft Edge", steps: [
    ["Open NotesApp in Edge", "Go to the NotesApp address in a normal window."],
    ["Click the install icon", "At the right end of the address bar. Or open the ⋯ menu, then “Apps”, then “Install this site as an app”."],
    ["Click “Install”", "NotesApp opens in its own window and is added to the Start menu."],
  ] },
  safari: { name: "Safari on a Mac", steps: [
    ["Open NotesApp in Safari", "This needs macOS Sonoma (14) or newer."],
    ["Choose File, then “Add to Dock…”", "Or click the Share button and choose “Add to Dock”."],
    ["Click “Add”", "NotesApp gets its own icon in the Dock and opens in its own window."],
  ] },
  firefox: { name: "Firefox", steps: [
    ["Firefox on a computer can't install web apps", "Open NotesApp in Google Chrome or Microsoft Edge instead and follow their steps."],
  ] },
};
const desktopKey = (b: BrowserName): keyof typeof desktop => (b === "edge" ? "edge" : b === "safari" ? "safari" : b === "firefox" ? "firefox" : "chrome"); // Brave and Opera install like Chrome

function Steps({ list }: { list: readonly Step[] }) {
  return (
    <ol className="mt-4 space-y-4">
      {list.map(([t, d], i) => (
        <li key={t} className="flex gap-4">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-crimson font-ui text-sm font-bold text-paper" aria-hidden="true">{i + 1}</span>
          <span><span className="block font-ui text-base font-bold text-ink">{t}</span><span className="mt-0.5 block text-sm text-slate">{d}</span></span>
        </li>
      ))}
    </ol>
  );
}

const tabOf = (d: Device | null): Tab => (!d || !isMobile(d) ? "desktop" : d.os === "ios" ? "ios" : "android");

// How to install #NotesApp, for the visitor's own device: a phone or tablet (iPhone, iPad, Android) or a computer (Windows, Mac, Linux), and their browser.
// Opens on the right section; when the browser offers a one-tap install, a button does it.
export default function InstallGuide() {
  const device = useDevice();
  const [tab, setTab] = useState<Tab>("desktop");
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [address, setAddress] = useState("app.notesapp.name.ng");

  useEffect(() => { if (device) setTab(tabOf(device)); }, [device]);
  useEffect(() => {
    setAddress(window.location.host);
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const onComputer = !device || !isMobile(device);
  const where = onComputer ? (device?.os === "windows" ? "your PC" : device?.os === "mac" ? "your Mac" : "your computer") : device?.kind === "tablet" ? "your tablet" : "your phone";
  const mine = device && onComputer ? desktopKey(device.browser) : "chrome";
  const copy = async () => {
    try { await navigator.clipboard.writeText(`https://${address}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the address is shown to copy by hand */ }
  };
  const tabBtn = (k: Tab, label: string) => (
    <button type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full border px-4 py-2 font-ui text-sm font-semibold ${tab === k ? "border-crimson bg-crimson text-paper" : "border-rule text-ink hover:border-crimson"}`}>
      {label}{tabOf(device) === k && device ? " (yours)" : ""}
    </button>
  );
  const order = (Object.keys(desktop) as (keyof typeof desktop)[]).sort((a, b) => Number(b === mine) - Number(a === mine));

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-rule bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/brand/notesapp-icon.webp" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <span className="font-ui text-lg font-extrabold tracking-tight text-ink">Notes<span className="text-crimson">App</span></span>
          </Link>
          <Link href="/login" className="font-ui text-sm font-semibold text-crimson">Sign in</Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-display text-4xl text-ink">Install NotesApp on {where}</h1>
        <p className="mt-3 text-slate">
          {onComputer
            ? "NotesApp installs straight from your browser, with no store and nothing to download by hand. It gets its own icon and its own window, and keeps you signed in."
            : "NotesApp installs straight from your phone's browser, with no app store. It gets its own icon on your home screen, opens full screen and keeps you signed in."}
          {" Allow notifications when it asks, and calls ring on your device even when NotesApp isn't open on your screen."}
        </p>

        {device?.inApp && (
          <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink" role="alert">
            You are inside another app&apos;s browser, which can&apos;t install NotesApp. Copy the address below and open it in {device.os === "ios" ? "Safari" : "Chrome"}.
          </p>
        )}

        {installed ? (
          <p className="mt-6 rounded-xl border border-rule bg-card p-4 text-sm text-ink" role="status">NotesApp is already installed on this device. Open it from {onComputer ? (device?.os === "windows" ? "the Start menu or your taskbar" : device?.os === "mac" ? "Launchpad or the Dock" : "your apps") : "your home screen"}.</p>
        ) : prompt ? (
          <div className="mt-6 rounded-xl border border-rule bg-card p-4">
            <p className="text-sm text-ink">Your browser can install NotesApp in one click.</p>
            <button type="button" onClick={async () => { await prompt.prompt(); const r = await prompt.userChoice; if (r.outcome === "accepted") setInstalled(true); setPrompt(null); }} className="btn-primary mt-3">Install NotesApp</button>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-rule bg-card p-4 text-sm">
          <span className="text-slate">{onComputer ? "NotesApp address:" : "Open this address on your phone:"}</span>
          <code className="rounded bg-paper px-2 py-1 font-mono text-ink">https://{address}</code>
          <button type="button" onClick={copy} className="rounded-full border border-rule px-3 py-1 font-ui text-xs font-semibold hover:border-crimson">{copied ? "Copied" : "Copy"}</button>
        </div>

        <div role="tablist" aria-label="Your device" className="mt-8 flex flex-wrap gap-2">{tabBtn("desktop", "Windows, Mac or Linux")}{tabBtn("ios", "iPhone or iPad")}{tabBtn("android", "Android")}</div>

        {tab === "ios" && <Steps list={ios} />}
        {tab === "android" && (
          <>
            <Steps list={android} />
            <ul className="mt-6 space-y-2 text-sm text-slate">{androidOther.map(([b, d]) => <li key={b}><span className="font-semibold text-ink">{b}:</span> {d}</li>)}</ul>
          </>
        )}
        {tab === "desktop" && (
          <div className="mt-2 space-y-8">
            {order.map((k) => (
              <section key={k}>
                <h2 className="mt-4 font-display text-2xl text-ink">{desktop[k].name}{device && onComputer && k === mine ? " (your browser)" : ""}</h2>
                <Steps list={desktop[k].steps} />
              </section>
            ))}
            <section>
              <h2 className="font-display text-2xl text-ink">After you install</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate">
                <li><span className="font-semibold text-ink">Windows:</span> find NotesApp in the Start menu. Right-click it and choose “Pin to taskbar” to keep it close.</li>
                <li><span className="font-semibold text-ink">Mac:</span> open it from Launchpad or the Dock; Chrome and Edge also put it in your Applications folder.</li>
                <li><span className="font-semibold text-ink">Linux and Chromebook:</span> it appears in your app launcher.</li>
              </ul>
            </section>
          </div>
        )}

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">If you don&apos;t see the option</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate">
            <li>Open NotesApp in the browser itself, not inside another app, and in a normal (not private or incognito) window.</li>
            <li>Use Safari on iPhone, Chrome on Android, and Chrome or Edge on a computer.</li>
            <li>Already installed? Look for the NotesApp icon on your home screen, Start menu, Dock or app list.</li>
          </ul>
        </section>

        <p className="mt-12"><Link href="/" className="font-ui text-sm font-semibold text-crimson">← Back to the welcome screen</Link></p>
      </main>
    </div>
  );
}
