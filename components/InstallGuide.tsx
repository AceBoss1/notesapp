"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Platform = "ios" | "android" | "other";
// Chrome's install prompt, when it offers one (Android and desktop Chrome and Edge).
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const steps = {
  ios: [
    ["Open NotesApp in Safari", "Go to the NotesApp address in Safari (the blue compass). Other browsers on iPhone can do this too from iOS 16.4, but Safari is the surest."],
    ["Tap the Share button", "It is the square with an arrow pointing up, at the bottom of the screen (at the top right on an iPad)."],
    ["Choose “Add to Home Screen”", "Scroll down the list of options if you don't see it at first."],
    ["Tap “Add”", "The NotesApp icon now sits on your home screen. Open it from there and it runs full screen, like an app."],
  ],
  android: [
    ["Open NotesApp in Chrome", "Go to the NotesApp address in Chrome. If it is open inside another app (WhatsApp, Facebook, Instagram), tap ⋮ and choose “Open in Chrome” first."],
    ["Tap the ⋮ menu", "Three dots at the top right of Chrome."],
    ["Choose “Install app” (or “Add to Home screen”)", "Chrome shows whichever it supports for this site."],
    ["Tap “Install”", "NotesApp appears on your home screen and in your app list, and opens full screen."],
  ],
} as const;

const other = [
  ["Samsung Internet", "Tap the menu (≡), then “Add page to”, then “Home screen”."],
  ["Firefox on Android", "Tap ⋮, then “Install”."],
  ["Chrome or Edge on a computer", "Click the install icon at the right end of the address bar, then “Install”."],
];

function Steps({ list }: { list: readonly (readonly [string, string])[] }) {
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

// How to install #NotesApp from a phone's browser. Opens on the section for the visitor's phone; when Chrome offers a one-tap install, a button does it.
export default function InstallGuide() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [open, setOpen] = useState<"ios" | "android" | null>(null);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [address, setAddress] = useState("app.notesapp.name.ng");

  useEffect(() => {
    const ua = navigator.userAgent;
    const p: Platform = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "ios" : /Android/i.test(ua) ? "android" : "other";
    setPlatform(p);
    setOpen(p === "other" ? "ios" : p);
    setAddress(window.location.host);
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const copy = async () => {
    try { await navigator.clipboard.writeText(`https://${address}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the address is shown to copy by hand */ }
  };
  const tab = (k: "ios" | "android", label: string) => (
    <button type="button" role="tab" aria-selected={open === k} onClick={() => setOpen(k)} className={`rounded-full border px-4 py-2 font-ui text-sm font-semibold ${open === k ? "border-crimson bg-crimson text-paper" : "border-rule text-ink hover:border-crimson"}`}>
      {label}{platform === k ? " (your phone)" : ""}
    </button>
  );

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
        <h1 className="font-display text-4xl text-ink">Install NotesApp on your phone</h1>
        <p className="mt-3 text-slate">NotesApp installs straight from your phone&apos;s browser, with no app store. It gets its own icon on your home screen, opens full screen and keeps you signed in.</p>

        {installed ? (
          <p className="mt-6 rounded-xl border border-rule bg-card p-4 text-sm text-ink" role="status">NotesApp is already installed on this device. Open it from your home screen.</p>
        ) : prompt ? (
          <div className="mt-6 rounded-xl border border-rule bg-card p-4">
            <p className="text-sm text-ink">Your browser can install NotesApp in one tap.</p>
            <button type="button" onClick={async () => { await prompt.prompt(); const r = await prompt.userChoice; if (r.outcome === "accepted") setInstalled(true); setPrompt(null); }} className="btn-primary mt-3">Install NotesApp</button>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-rule bg-card p-4 text-sm">
          <span className="text-slate">Open this address on your phone:</span>
          <code className="rounded bg-paper px-2 py-1 font-mono text-ink">https://{address}</code>
          <button type="button" onClick={copy} className="rounded-full border border-rule px-3 py-1 font-ui text-xs font-semibold hover:border-crimson">{copied ? "Copied" : "Copy"}</button>
        </div>

        <div role="tablist" aria-label="Your phone" className="mt-8 flex flex-wrap gap-2">{tab("ios", "iPhone or iPad")}{tab("android", "Android")}</div>
        {open && <Steps list={steps[open]} />}

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">Other browsers</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate">{other.map(([b, d]) => <li key={b}><span className="font-semibold text-ink">{b}:</span> {d}</li>)}</ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">If you don&apos;t see the option</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate">
            <li>Use Safari on iPhone and Chrome on Android, and open NotesApp in the browser itself, not inside another app.</li>
            <li>Private or incognito tabs don&apos;t offer it. Open a normal tab.</li>
            <li>Already installed? Look for the NotesApp icon on your home screen or in your app list.</li>
          </ul>
        </section>

        <p className="mt-12"><Link href="/" className="font-ui text-sm font-semibold text-crimson">← Back to the welcome screen</Link></p>
      </main>
    </div>
  );
}
