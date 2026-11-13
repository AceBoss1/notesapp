"use client";

import ShareIcon from "./ShareIcon";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useMember } from "@/lib/member-client";
import { api } from "@/lib/moments-client";
import { MAIN_HOST, isMainHost } from "@/lib/host";
import { isKidUid } from "@/lib/kids";
import { MOMENTS_LIVE, MOMENT_DEFAULT_HOURS, MOMENT_HOURS, MOMENT_TEXT_MAX, type MomentHours } from "@/lib/moments-rules";
import { journalDraftFromCard, shareHref, signInHref, type ShareCard, type ShareRef } from "@/lib/share-targets";
import ShareLinkCard from "./ShareLinkCard";

// "Share to Moments" and "Share to Journals" (lib/share-targets.ts), for every share menu and row on #NotesApp. Signed-in members only:
// a visitor gets a sign-in prompt that brings them back to finish. On a member's own domain both go to /share on #NotesApp.
// Only render these for something public: a draft, a members-only post or anything the viewer can't see has no share target (and the
// server refuses it anyway).

export const DRAFT_KEY = "notesapp:chatDraft"; // read once by /write/new (also used by "Start a journal draft" in Messages)

// Sheets go straight under <body>: a share menu often sits in a dropdown with its own stacking context (z-10), which would otherwise
// trap a "fixed" sheet under the site header and the phone's tab bar.
const Layer = ({ children }: { children: React.ReactNode }) => (typeof document === "undefined" ? null : createPortal(<div data-share-layer="">{children}</div>, document.body));

const onOwnDomain = () => typeof window !== "undefined" && !isMainHost(window.location.hostname);

export async function fetchShareCard(ref: ShareRef): Promise<ShareCard> {
  const r = await fetch(`/api/share?kind=${ref.kind}&id=${encodeURIComponent(ref.id)}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.card) throw new Error(j.error || "That can't be shared right now.");
  return j.card as ShareCard;
}

// Starts the journal draft (never published by itself) and opens the editor.
export async function startJournalDraft(ref: ShareRef, go: (href: string) => void): Promise<void> {
  const card = await fetchShareCard(ref);
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(journalDraftFromCard(card, window.location.origin))); } catch { /* the editor opens empty */ }
  go("/write/new");
}

type Want = "moment" | "journal";

// The two choices, styled for where they sit: "menu" rows (a dropdown or sheet), "pill" buttons (a row of share buttons) or "link" text.
export default function ShareToNotesApp({ shareRef, look = "menu", onPicked }: { shareRef: ShareRef; look?: "menu" | "pill" | "link"; onPicked?: () => void }) {
  const { user } = useMember();
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [prompt, setPrompt] = useState<Want | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const who = user === undefined ? auth.currentUser : user;
  if (who && isKidUid(who.uid)) return null; // a child profile never shares out

  async function pick(want: Want) {
    setErr("");
    if (onOwnDomain()) { window.location.href = `https://${MAIN_HOST}${shareHref(want, shareRef)}`; return; }
    if (!who) { setPrompt(want); return; }
    if (want === "moment") { setSheet(true); return; }
    setBusy(true);
    try { await startJournalDraft(shareRef, (h) => router.push(h)); onPicked?.(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't start the draft."); }
    finally { setBusy(false); }
  }

  const cls = look === "menu" ? "flex w-full items-center gap-2 border-b border-rule px-4 py-3 text-left font-ui text-sm hover:bg-paper"
    : look === "pill" ? "flex h-10 items-center justify-center gap-1.5 rounded-full border border-rule bg-card px-3.5 font-ui text-xs font-bold text-ink hover:border-crimson"
    : "text-crimson underline";
  return (
    <>
      {MOMENTS_LIVE && <button type="button" onClick={() => pick("moment")} className={cls}><span aria-hidden>◐</span>Share to Moments</button>}
      <button type="button" onClick={() => pick("journal")} disabled={busy} className={`${cls} disabled:opacity-50`}><span aria-hidden>✎</span>{busy ? "Starting draft…" : "Share to Journals"}</button>
      {err && <span role="alert" className="block px-4 py-2 text-xs text-crimson">{err}</span>}
      {prompt && <SignInPrompt want={prompt} shareRef={shareRef} onClose={() => setPrompt(null)} />}
      {sheet && <MomentShareSheet shareRef={shareRef} onClose={() => { setSheet(false); onPicked?.(); }} />}
    </>
  );
}

function SignInPrompt({ want, shareRef, onClose }: { want: Want; shareRef: ShareRef; onClose: () => void }) {
  return (
    <Layer><div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Sign in to share" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl text-ink">Sign in to share</h2>
        <p className="mt-2 text-sm text-slate">{want === "moment" ? "Share to Moments puts this on your picture for your followers, for a day or up to three." : "Share to Journals starts a draft in your journal that quotes this, for you to add your thoughts."} It&apos;s for #NotesApp members.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={signInHref(want, shareRef)} className="btn-primary !px-5 !py-2.5 text-sm">Sign in</a>
          <a href="/signup" className="btn-ghost !px-5 !py-2.5 text-sm">Join free</a>
          <button type="button" onClick={onClose} className="px-3 text-sm text-slate">Not now</button>
        </div>
      </div>
    </div></Layer>
  );
}

// The quick compose sheet: the card, an optional caption, how long it stays, and Post. The usual Moments rules apply on the server.
export function MomentShareSheet({ shareRef, onClose, inline = false }: { shareRef: ShareRef; onClose: () => void; inline?: boolean }) {
  const [card, setCard] = useState<ShareCard | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [hours, setHours] = useState<MomentHours>(MOMENT_DEFAULT_HOURS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { fetchShareCard(shareRef).then(setCard).catch((e) => { setCard(null); setErr(e.message); }); }, [shareRef.kind, shareRef.id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function post() {
    setBusy(true); setErr("");
    try { await api("/api/moments", { body: { share: shareRef, text, hours } }); setDone(true); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't share the moment."); }
    finally { setBusy(false); }
  }
  const panel = (
    <div className={`w-full max-w-md rounded-2xl bg-card p-5 text-left shadow-xl sm:p-6 ${inline ? "" : "max-h-[92vh] overflow-y-auto"}`} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-ink">{done ? "Shared to your Moments" : "Share to Moments"}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="px-2 text-2xl leading-none text-slate">×</button>
      </div>
      {done ? (
        <>
          <p className="mt-3 text-sm text-slate">It&apos;s on your picture for {hours} hours, for the people who can see your moments. The creator is credited on it.</p>
          <div className="mt-5 flex gap-2"><a href="/journals" className="btn-primary !px-5 !py-2.5 text-sm">See Moments</a><button type="button" onClick={onClose} className="btn-ghost !px-5 !py-2.5 text-sm">Done</button></div>
        </>
      ) : (
        <>
          <div className="mt-4">{card === undefined ? <p className="text-sm text-slate">Loading…</p> : card ? <ShareLinkCard link={card} compact asLink={false} /> : null}</div>
          {card !== null && (
            <>
              <label className="mt-4 block text-sm font-semibold text-ink">Add a caption <span className="font-normal text-slate">(optional)</span>
                <textarea ref={box} value={text} onChange={(e) => setText(e.target.value)} maxLength={MOMENT_TEXT_MAX} rows={3} placeholder="Say why you're sharing it" className="mt-1 w-full rounded-lg border border-rule bg-card p-3 text-sm font-normal text-ink outline-none focus:border-crimson" />
              </label>
              <p className="text-right text-xs text-slate">{text.length}/{MOMENT_TEXT_MAX}</p>
              <fieldset className="mt-1">
                <legend className="text-sm font-bold text-ink">Disappears after</legend>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">{MOMENT_HOURS.map((h) => (
                  <label key={h} className="flex items-center gap-1.5"><input type="radio" name="share-hours" checked={hours === h} onChange={() => setHours(h)} /> {h} hours</label>
                ))}</div>
              </fieldset>
              <p className="mt-3 text-xs text-slate">Seen by the people who see your moments (your followers, or everyone signed in if you made yours public; in teen mode only people you follow back).</p>
            </>
          )}
          {err && <p role="alert" className="mt-3 text-sm text-crimson">{err}</p>}
          {card && <button type="button" onClick={post} disabled={busy} className="btn-primary mt-4 w-full disabled:opacity-50">{busy ? "Posting…" : "Post"}</button>}
        </>
      )}
    </div>
  );
  if (inline) return <div className="flex justify-center">{panel}</div>;
  return <Layer><div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Share to Moments" onClick={onClose}>{panel}</div></Layer>;
}

// A share sheet for places that had only "share to another app / copy link": the two #NotesApp choices first, then those.
export function ShareMenu({ shareRef, url, title, onClose, onShared }: { shareRef: ShareRef | null; url: string; title: string; onClose: () => void; onShared?: () => void }) {
  const [copied, setCopied] = useState(false);
  const canNative = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const row = "flex w-full items-center gap-2 border-b border-rule px-4 py-3 text-left font-ui text-sm hover:bg-paper";
  return (
    <Layer><div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Share" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-card text-ink shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="flex items-center justify-between border-b border-rule px-4 py-3"><span className="truncate font-ui text-sm font-bold">Share “{title}”</span><button type="button" onClick={onClose} aria-label="Close" className="pl-3 text-xl leading-none text-slate">×</button></p>
        {shareRef && <ShareToNotesApp shareRef={shareRef} look="menu" onPicked={() => { onShared?.(); onClose(); }} />}
        {canNative && <button type="button" className={row} onClick={async () => { try { await navigator.share({ title, url }); onShared?.(); onClose(); } catch { /* closed */ } }}><ShareIcon className="h-4 w-4" />Share to another app</button>}
        <button type="button" className={`${row} border-b-0`} onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); onShared?.(); setTimeout(onClose, 900); } catch { window.prompt("Copy the link", url); } }}><span aria-hidden>🔗</span>{copied ? "Link copied" : "Copy link"}</button>
      </div>
    </div></Layer>
  );
}

// A Share button for pages that had none (shop items, services, events): opens ShareMenu. `path` is the item's page on this site.
export function ShareButton({ shareRef, path, title, className, label = "Share" }: { shareRef: ShareRef | null; path: string; title: string; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const url = typeof window === "undefined" ? path : new URL(path, window.location.href).toString();
  return (
    <>
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }} aria-label={`Share ${title}`}
        className={className ?? "inline-flex items-center gap-1.5 rounded-full border border-rule bg-card px-4 py-2 font-ui text-xs font-bold text-ink hover:border-crimson"}>
        <ShareIcon className="h-4 w-4" />{label}
      </button>
      {open && <ShareMenu shareRef={shareRef} url={url} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}
