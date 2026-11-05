"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import GiftButton from "@/components/GiftButton";
import ReportDialog from "@/components/moments/ReportDialog";
import type { GiftContext, GiftToKind } from "@/lib/gift-catalogue";

// Gift · Block · Report beside a person's name (owner, 4 Nov 2026; docs/LIVE_ECONOMY.md phase 2): the author of a comment or a review,
// a speaker on a live's stage, a Media post's creator or a replay's host. A ⋯ opens the three; Gift opens the gift sheet for them
// (components/GiftButton.tsx, which asks the server whether this viewer may gift them and explains when they can't: no payouts yet,
// teen mode with no mutual follow, or a block). Block stops them messaging you and seeing your moments (the same block as Messages);
// Report sends the member to #NotesApp's reports queue with where it was. Nothing shows for yourself or when signed out.
export default function PersonActions({ uid, username, name, toKind, context, liveId, mediaId, replayId, where, href, text, dark = false, compact = false }: {
  uid: string; username?: string; name: string; toKind: GiftToKind; context: GiftContext;
  liveId?: string; mediaId?: string; replayId?: string; // never a post's id: a gift to a commenter isn't shared with the post's co-authors
  where: string; href?: string; text?: string; // for a report: "a comment", the page it was on, the words shown
  dark?: boolean; compact?: boolean;
}) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [menu, setMenu] = useState(false);
  const [gift, setGift] = useState(false);
  const [report, setReport] = useState(false);
  const [note, setNote] = useState("");
  // The menu is placed on screen from the ⋯ button, kept inside the window (a name near the right edge on a phone).
  const btn = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const openMenu = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setAt({ left: Math.max(8, Math.min(r.left, window.innerWidth - 272)), top: r.bottom + 4 });
    setMenu((v) => !v);
  };
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close); window.removeEventListener("resize", close); };
  }, [menu]);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (!user || user.uid === uid || !uid) return null;
  const first = name.split(" ")[0] || "them";

  async function block() {
    setMenu(false);
    if (!window.confirm(`Block ${first}? They won't be able to message you or see your moments, and you won't be able to gift each other. You can unblock them in Messages.`)) return;
    try {
      const r = await fetch("/api/messages/block", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user!.getIdToken()}` }, body: JSON.stringify({ uid, block: true }) });
      const j = await r.json().catch(() => ({}));
      setNote(r.ok ? `${first} is blocked.` : j.error || "Couldn't block them.");
    } catch { setNote("Couldn't block them."); }
  }

  const chip = dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-card text-slate ring-1 ring-rule hover:text-ink";
  return (
    <span className="relative inline-flex items-center" data-person-actions={uid}>
      <button ref={btn} type="button" onClick={openMenu} aria-haspopup="menu" aria-expanded={menu} aria-label={`Gift, block or report ${name}`}
        className={`inline-flex items-center rounded-full ${compact ? "px-1.5 py-0" : "px-2 py-0.5"} font-ui text-xs font-bold leading-5 ${chip}`}>⋯</button>
      {menu && (
        <span role="menu" style={at ? { left: at.left, top: at.top } : undefined} className={`fixed z-40 flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-1 font-ui text-xs shadow-lg ${dark ? "border-white/20 bg-ink text-white" : "border-rule bg-paper text-ink"}`}>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); setGift(true); }} className="rounded-full px-2 py-1 font-semibold hover:bg-crimson/10">🎁 Gift {first}</button>
          <span aria-hidden className="opacity-40">·</span>
          <button type="button" role="menuitem" onClick={block} className="rounded-full px-2 py-1 hover:bg-crimson/10">🚫 Block</button>
          <span aria-hidden className="opacity-40">·</span>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); setReport(true); }} className="rounded-full px-2 py-1 hover:bg-crimson/10">⚑ Report</button>
        </span>
      )}
      {note && <span role="status" className={`ml-2 text-[11px] ${dark ? "text-white/60" : "text-slate"}`}>{note}</span>}
      {/* The sheet and the report open on the page itself (a portal): the menu sits inside a line of text, which can't hold them. */}
      {gift && createPortal(<GiftButton sheetOnly onClose={() => setGift(false)} publisherUid={uid} username={username} toName={name} toKind={toKind} context={context} liveId={liveId} mediaId={mediaId} replayId={replayId} />, document.body)}
      {report && createPortal(<ReportDialog kind="person" targetId={uid} extra={{ where, href: href ?? window.location.pathname + window.location.search, text }} onClose={() => setReport(false)} />, document.body)}
    </span>
  );
}
