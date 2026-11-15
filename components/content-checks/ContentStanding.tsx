"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { appealCheck, appealPause, loadMyChecks, type MyChecks } from "@/lib/content-checks-client";
import { CATEGORY_LABEL, KIND_LABEL, dayWords, type ContentKind, type FoundCategory } from "@/lib/content-checks";

// The member's own record of AI content checks, on their account page (screen 4 of the approved mockups): a suspension from posting
// with the list of strikes and "Appeal the suspension", each strike with "Ask for a review", and anything waiting for a person.
const STATUS: Record<string, string> = { blocked: "blocked", appealed: "under review", held: "waiting for review", restored: "restored", kept: "kept blocked" };
function where(kind: string, item: string) {
  const k = KIND_LABEL[kind as ContentKind] ?? "post";
  if (kind === "community") return k;
  if (item.startsWith("picture")) return `photo in ${kind === "moment" ? "Moments" : `a ${k}`}`;
  if (item.startsWith("video")) return `video in ${kind === "moment" ? "Moments" : `a ${k}`}`;
  return k;
}
const cat = (c: string) => (c === "community" ? "closed" : CATEGORY_LABEL[c as Exclude<FoundCategory, "none">] ?? "");

export default function ContentStanding({ uid }: { uid: string }) {
  const [d, setD] = useState<MyChecks | null>(null);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => { loadMyChecks().then(setD, (e) => setErr(e instanceof Error ? e.message : "Couldn't load.")); }, []);
  useEffect(() => { if (uid) load(); }, [uid, load]);

  async function run(key: string, f: () => Promise<unknown>) {
    setBusy(key); setErr("");
    try { await f(); setOpen(false); setText(""); load(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't do that."); } finally { setBusy(""); }
  }
  if (!d) return err ? <p id="content-checks" className="mt-6 text-sm text-crimson">{err}</p> : null;
  const strikes = d.items.filter((i) => i.strike && i.active);
  const others = d.items.filter((i) => !(i.strike && i.active));
  const paused = d.pausedUntil || d.banned;
  return (
    <section id="content-checks" className="card mt-6 scroll-mt-6 p-6">
      <h2 className="font-display text-xl">Content checks</h2>
      {paused ? (
        <div className="mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-relaxed text-ink">
          <p className="font-ui font-bold">{d.banned ? "Posting is closed on your account" : `Your account is suspended from posting until ${dayWords(d.pausedUntil!)}`}</p>
          <p className="mt-0.5">
            {strikes.length ? <>{strikes.length === 1 ? "One post" : `${strikes.length} posts`} broke the rules in {d.windowDays} days: {strikes.slice().reverse().map((s) => `${dayWords(s.at)} (${cat(s.category)})`).join(", ")}. </> : null}
            You can still read and message, but you can&apos;t post.
          </p>
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate">
          {d.activeStrikes ? `${d.activeStrikes === 1 ? "One strike" : `${d.activeStrikes} strikes`} in the last ${d.windowDays} days.` : "No strikes. Thank you for keeping NotesApp kind."}{" "}
          <Link href="/content-rules" className="text-crimson underline">The rules</Link>
        </p>
      )}
      {d.items.length > 0 && (
        <ul className="mt-3 rounded-2xl border border-rule bg-card px-4 text-sm">
          {[...strikes, ...others].map((i, n) => (
            <li key={i.id} className={`flex items-center justify-between gap-3 py-2.5 ${n ? "border-t border-rule" : ""}`}>
              <span className="min-w-0">
                <span className="text-ink">{dayWords(i.at)} · {where(i.kind, i.item)}</span>
                {i.label && <span className="block truncate text-xs text-slate">{i.label}</span>}
              </span>
              <span className="flex flex-none items-center gap-2">
                <span className="text-xs text-slate">{STATUS[i.status] ?? i.status}</span>
                {i.status === "blocked" && !paused && (
                  <button type="button" disabled={!!busy} onClick={() => run(i.id, () => appealCheck(i.id))} className="rounded-full border border-rule px-3 py-1 text-xs font-semibold text-ink hover:border-crimson disabled:opacity-40">{busy === i.id ? "…" : "Ask for a review"}</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {paused && (d.appeal?.status === "pending"
        ? <p className="mt-3 text-sm text-slate">You appealed on {dayWords(d.appeal.at)}. A person will look at it within 48 hours.</p>
        : open ? (
          <div className="mt-3 grid gap-2">
            <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} rows={3} placeholder="Anything we should know? (optional)" className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson" />
            <div className="flex gap-2">
              <button type="button" disabled={!!busy} onClick={() => run("pause", () => appealPause(text))} className="btn-primary disabled:opacity-50">{busy === "pause" ? "Sending…" : "Send appeal"}</button>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        ) : <button type="button" onClick={() => setOpen(true)} className="mt-3 w-full rounded-full bg-crimson px-5 py-2.5 font-ui text-sm font-bold text-white">Appeal the suspension</button>)}
      {err && <p className="mt-2 text-sm text-crimson">{err}</p>}
      <p className="mt-3 text-xs text-slate">A community is closed only when its owner or moderators keep posting or approving rule-breaking content. Members are warned first, and the owner can appeal.</p>
    </section>
  );
}
