"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { api } from "@/lib/moments-client";
import { formatBytes, type ThreadMessage } from "@/lib/messages-rules";
import { fileBadge } from "@/lib/chat-tools";
import { linkTokens } from "@/lib/linkify";
import { useLinkPreview } from "@/components/LinkPreview";
import { deleteForMeText, fileQuery, saveFile, useChatMedia, when, type MediaItem } from "./MediaViewer";

type Tab = "media" | "docs" | "links";
type Media = MediaItem & { at: string; durationSec?: number };
type Doc = { mid: string; i: number; at: string; from: string; name: string; size: number; type: string };
type Linked = { mid: string; n: number; at: string; from: string; href: string; text: string };
const keyOf = (x: { mid: string; i?: number; n?: number }) => `${x.mid}/${x.i ?? x.n ?? 0}`;

// "This week", then "September 2026", newest first.
function shelf(iso: string) {
  const d = new Date(iso);
  if (Date.now() - d.getTime() < 7 * 86_400_000) return "This week";
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
const live = (m: ThreadMessage) => !m.deleted && !m.removed;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const site = (href: string) => { try { return new URL(href).hostname.replace(/^www\./, ""); } catch { return href; } };

// Media, links and docs: everything shared in this chat, in three tabs (like WhatsApp's). Media is a grid by month, newest first;
// tap one to open it in the viewer and swipe. Docs and Links are lists, each with ⋮ (go to the message, keep, forward, save or copy,
// delete for me). Press and hold, or Select, to pick several and forward, keep or delete them for you together.
// Full screen on a phone; a panel over the right of the chat on a computer. Built from the messages the chat has loaded.
export default function ChatLibrary({ user, onClose }: { user: User; onClose: () => void }) {
  const chat = useChatMedia()!;
  const [tab, setTab] = useState<Tab>("media");
  const [sel, setSel] = useState<string[] | null>(null); // keys picked (null = not selecting)
  const [menu, setMenu] = useState<string | null>(null); // the row whose ⋮ is open
  const [note, setNote] = useState("");
  const hold = useRef<ReturnType<typeof setTimeout>>();

  const { media, docs, links } = useMemo(() => {
    const list = chat.messages.filter(live).slice().reverse(); // newest first
    const media: Media[] = [], docs: Doc[] = [], links: Linked[] = [];
    for (const m of list) {
      m.attachments?.forEach((f, i) => {
        if (f.kind === "image" || f.kind === "video") media.push({ mid: m.id, i, kind: f.kind, at: m.createdAt, durationSec: f.durationSec });
        else if (f.kind === "document") docs.push({ mid: m.id, i, at: m.createdAt, from: m.from, name: f.name, size: f.size, type: f.type });
      });
      const seen = new Set<string>();
      linkTokens(m.text || "").forEach((t) => { if (t.kind === "url" && !seen.has(t.href)) { seen.add(t.href); links.push({ mid: m.id, n: seen.size - 1, at: m.createdAt, from: m.from, href: t.href, text: t.text }); } });
    }
    return { media, docs, links };
  }, [chat.messages]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { if (menu) setMenu(null); else if (sel) setSel(null); else onClose(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [menu, sel, onClose]);
  useEffect(() => { setSel(null); setMenu(null); }, [tab]);

  const say = (t: string) => { setNote(t); setTimeout(() => setNote(""), 2400); };
  const rows: { key: string; mid: string }[] = tab === "media" ? media.map((x) => ({ key: keyOf(x), mid: x.mid })) : tab === "docs" ? docs.map((x) => ({ key: keyOf(x), mid: x.mid })) : links.map((x) => ({ key: keyOf(x), mid: x.mid }));
  const pickedMids = sel ? Array.from(new Set(rows.filter((r) => sel.includes(r.key)).map((r) => r.mid))) : [];
  const toggle = (k: string) => setSel((s) => (s ? (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]) : [k]));
  // Press and hold starts selecting, with that one picked.
  const holdable = (k: string) => ({
    onTouchStart: () => { hold.current = setTimeout(() => { navigator.vibrate?.(15); setSel((s) => s ?? [k]); }, 450); },
    onTouchMove: () => clearTimeout(hold.current),
    onTouchEnd: () => clearTimeout(hold.current),
    onContextMenu: (e: React.MouseEvent) => { if (!sel) { e.preventDefault(); setSel([k]); } },
  });
  function deleteMids(mids: string[]) {
    if (!mids.length || !confirm(deleteForMeText(mids.length))) return;
    chat.hide(mids); setSel(null); setMenu(null);
  }
  async function openDoc(d: Doc) {
    try {
      const q = fileQuery(chat.cid, d);
      if (d.type === "application/pdf") window.open((await api<{ url: string }>(q)).url, "_blank", "noopener");
      else await saveFile(q);
    } catch (e) { say(e instanceof Error ? e.message : "Couldn't open it."); }
  }

  const tabs: [Tab, string, number][] = [["media", "Media", media.length], ["docs", "Docs", docs.length], ["links", "Links", links.length]];
  const who = (uid: string) => (uid === chat.meUid ? "You" : chat.nameOf(uid).split(" ")[0]);
  const shown = note || chat.toast;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-paper lg:absolute lg:inset-y-0 lg:left-auto lg:right-0 lg:z-[35] lg:w-[420px] lg:rounded-r-xl2 lg:border-l lg:border-rule lg:bg-card lg:shadow-[-8px_0_24px_rgba(26,18,16,0.06)]" role="dialog" aria-label="Media, links and docs">
      <div className="flex items-start gap-2 px-4 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))] lg:px-5 lg:pt-5">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onClose} className="font-ui text-xs font-semibold text-crimson hover:underline lg:hidden">← Back to the chat</button>
          <h2 className="font-display text-2xl text-ink">Media, links and docs</h2>
        </div>
        {rows.length > 0 && <button type="button" onClick={() => setSel((s) => (s ? null : []))} className="mt-1 rounded-full px-3 py-1.5 font-ui text-sm font-semibold text-crimson hover:bg-crimson/5">{sel ? "Cancel" : "Select"}</button>}
        <button type="button" onClick={onClose} aria-label="Close" className="hidden h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-slate hover:bg-paper lg:flex">×</button>
      </div>
      <div role="tablist" className="mx-4 flex border-b border-rule lg:mx-5">
        {tabs.map(([t, label, count]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`-mb-px flex-1 border-b-2 py-2.5 font-ui text-sm font-semibold ${tab === t ? "border-crimson text-crimson" : "border-transparent text-slate hover:text-ink"}`}>{label} · {count}</button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        {tab === "media" && (media.length ? (
          Object.entries(media.reduce<Record<string, Media[]>>((acc, x) => { (acc[shelf(x.at)] ||= []).push(x); return acc; }, {})).map(([label, list]) => (
            <section key={label}>
              <h3 className="px-4 pb-2 pt-4 font-mono text-[11px] uppercase tracking-eyebrow text-slate lg:px-5">{label}</h3>
              <div className="grid grid-cols-3 gap-0.5 sm:grid-cols-4 lg:grid-cols-3">
                {list.map((x) => {
                  const k = keyOf(x);
                  return <Thumb key={k} item={x} kept={chat.kept.includes(x.mid)} picked={sel ? sel.includes(k) : null} hold={holdable(k)}
                    onTap={(url) => (sel ? toggle(k) : chat.open(x, url))} />;
                })}
              </div>
            </section>
          ))
        ) : <Empty what="photos or videos" />)}

        {tab === "docs" && (docs.length ? docs.map((d) => {
          const k = keyOf(d);
          return (
            <Row key={k} picked={sel ? sel.includes(k) : null} hold={holdable(k)} onTap={() => (sel ? toggle(k) : openDoc(d))} menuOpen={menu === k} onMenu={() => setMenu(menu === k ? null : k)}
              lead={<span aria-hidden="true" className="flex h-11 w-9 shrink-0 items-end justify-center rounded-md bg-crimson/10 pb-1 font-mono text-[9px] font-bold text-crimson">{fileBadge(d.name)}</span>}
              title={d.name} sub={`${formatBytes(d.size)} · ${who(d.from)} · ${when(d.at)}`} kept={chat.kept.includes(d.mid)}
              options={[
                { label: "Go to message", onClick: () => { onClose(); chat.goTo(d.mid); } },
                { label: chat.kept.includes(d.mid) ? "Remove from kept" : "Keep", onClick: () => { setMenu(null); chat.keep([d.mid], !chat.kept.includes(d.mid)); } },
                { label: "Forward", onClick: () => { setMenu(null); chat.forward([d.mid]); } },
                ...(d.type === "application/pdf" ? [{ label: "Open", onClick: () => { setMenu(null); void openDoc(d); } }] : []),
                { label: "Save", onClick: () => { setMenu(null); saveFile(fileQuery(chat.cid, d)).catch(() => say("Couldn't save it.")); } },
                { label: "Delete for me", danger: true, onClick: () => deleteMids([d.mid]) },
              ]} />
          );
        }) : <Empty what="documents" />)}

        {tab === "links" && (links.length ? links.map((l) => {
          const k = keyOf(l);
          return (
            <LinkRow key={k} link={l} user={user} by={`${who(l.from)} · ${when(l.at)}`} picked={sel ? sel.includes(k) : null} hold={holdable(k)} kept={chat.kept.includes(l.mid)}
              onTap={() => (sel ? toggle(k) : window.open(l.href, "_blank", "noopener,noreferrer"))} menuOpen={menu === k} onMenu={() => setMenu(menu === k ? null : k)}
              options={[
                { label: "Go to message", onClick: () => { onClose(); chat.goTo(l.mid); } },
                { label: "Copy link", onClick: () => { setMenu(null); navigator.clipboard.writeText(l.href).then(() => say("Link copied"), () => say("Couldn't copy it.")); } },
                { label: chat.kept.includes(l.mid) ? "Remove from kept" : "Keep", onClick: () => { setMenu(null); chat.keep([l.mid], !chat.kept.includes(l.mid)); } },
                { label: "Forward", onClick: () => { setMenu(null); chat.forward([l.mid]); } },
                { label: "Delete for me", danger: true, onClick: () => deleteMids([l.mid]) },
              ]} />
          );
        }) : <Empty what="links" />)}

        {rows.length > 0 && (
          <p className="px-4 pt-4 text-xs text-slate lg:px-5">
            {tab === "media" ? "Tap to open and swipe. Press and hold to select several, then forward, keep or delete them." : tab === "docs" ? "Tap to open (PDF) or save. ⋮ on each: go to the message, keep, forward, save, delete for me." : "Tap to open the link. ⋮ on each: go to the message, copy the link, keep, forward."}
            {chat.messages.length >= 100 && " Showing what's in the latest 100 messages."}
          </p>
        )}
      </div>

      {sel && (
        <div className="flex shrink-0 items-center gap-2 border-t border-rule bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:rounded-br-xl2">
          <span className="flex-1 font-ui text-sm font-semibold text-ink">{sel.length ? `${sel.length} selected` : "Tap to select"}</span>
          <button type="button" disabled={!pickedMids.length} onClick={() => { chat.forward(pickedMids); setSel(null); }} className="rounded-full border border-rule px-3 py-2 font-ui text-sm font-semibold text-ink hover:bg-paper disabled:opacity-40">Forward</button>
          <button type="button" disabled={!pickedMids.length} onClick={() => { chat.keep(pickedMids, true); setSel(null); }} className="rounded-full border border-rule px-3 py-2 font-ui text-sm font-semibold text-ink hover:bg-paper disabled:opacity-40">Keep</button>
          <button type="button" disabled={!pickedMids.length} onClick={() => deleteMids(pickedMids)} className="rounded-full border border-crimson/30 px-3 py-2 font-ui text-sm font-semibold text-crimson hover:bg-crimson/5 disabled:opacity-40">Delete for me</button>
        </div>
      )}
      {shown && <p role="status" className="pointer-events-none absolute inset-x-0 bottom-20 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-lg">{shown}</p>}
    </div>
  );
}

function Empty({ what }: { what: string }) {
  return <p className="px-4 py-10 text-center text-sm text-slate lg:px-5">No {what} in this chat yet.</p>;
}

type Hold = { onTouchStart: () => void; onTouchMove: () => void; onTouchEnd: () => void; onContextMenu: (e: React.MouseEvent) => void };
const Tick = ({ on }: { on: boolean }) => (
  <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${on ? "border-crimson bg-crimson text-white" : "border-slate/50 bg-card"}`}>{on ? "✓" : ""}</span>
);

// One square in the grid. Its private link is fetched once it scrolls into view.
function Thumb({ item, kept, picked, hold, onTap }: { item: Media; kept: boolean; picked: boolean | null; hold: Hold; onTap: (url?: string) => void }) {
  const chat = useChatMedia()!;
  const el = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState<string>();
  const [secs, setSecs] = useState(item.durationSec);
  useEffect(() => {
    const node = el.current;
    if (!node || url) return;
    let alive = true;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      api<{ url: string }>(fileQuery(chat.cid, item)).then((r) => { if (alive) setUrl(r.url); }).catch(() => {});
    }, { rootMargin: "200px" });
    io.observe(node);
    return () => { alive = false; io.disconnect(); };
  }, [chat.cid, item, url]);
  return (
    <button ref={el} type="button" onClick={() => onTap(url)} {...hold} aria-label={`${item.kind === "image" ? "Photo" : "Video"}, ${when(item.at)}${kept ? ", kept" : ""}`} aria-pressed={picked ?? undefined}
      className={`relative aspect-square overflow-hidden bg-ink/10 ${picked ? "ring-4 ring-inset ring-crimson" : ""}`}>
      {url && (item.kind === "image"
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
        : <video src={`${url}#t=0.1`} preload="metadata" muted playsInline className="pointer-events-none h-full w-full object-cover" onLoadedMetadata={(e) => { const d = e.currentTarget.duration; setSecs((s) => s || d); }} />)}
      {item.kind === "video" && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 font-ui text-[11px] font-semibold text-white">▶ {secs ? clock(secs) : ""}</span>}
      {kept && <span aria-hidden="true" className="absolute right-1 top-1 text-sm text-white drop-shadow">★</span>}
      {picked !== null && <span className="absolute left-1 top-1"><Tick on={picked} /></span>}
    </button>
  );
}

type RowOption = { label: string; onClick: () => void; danger?: boolean };
function Row({ lead, title, sub, kept, picked, hold, onTap, menuOpen, onMenu, options }: {
  lead: React.ReactNode; title: React.ReactNode; sub: React.ReactNode; kept: boolean; picked: boolean | null; hold: Hold; onTap: () => void; menuOpen: boolean; onMenu: () => void; options: RowOption[];
}) {
  return (
    <div className={`relative flex items-center gap-3 border-b border-rule px-4 py-3 lg:px-5 ${picked ? "bg-crimson/5" : ""}`}>
      {picked !== null && <Tick on={picked} />}
      <button type="button" onClick={onTap} {...hold} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {lead}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-words text-sm font-semibold leading-snug text-ink">{title}{kept && <span className="ml-1 text-amber-600" aria-label="Kept">★</span>}</span>
          <span className="block text-[11px] text-slate">{sub}</span>
        </span>
      </button>
      {picked === null && <button type="button" onClick={onMenu} aria-label="Options" aria-haspopup="menu" aria-expanded={menuOpen} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-slate hover:bg-paper">⋮</button>}
      {menuOpen && (
        <div role="menu" className="absolute right-4 top-12 z-10 w-48 rounded-xl border border-rule bg-card py-1 shadow-xl">
          {options.map((o) => <button key={o.label} type="button" role="menuitem" onClick={o.onClick} className={`block w-full px-4 py-2 text-left text-sm hover:bg-paper ${o.danger ? "text-crimson" : "text-ink"}`}>{o.label}</button>)}
        </div>
      )}
    </div>
  );
}

function LinkRow({ link, user, by, ...rest }: { link: Linked; user: User; by: string; kept: boolean; picked: boolean | null; hold: Hold; onTap: () => void; menuOpen: boolean; onMenu: () => void; options: RowOption[] }) {
  const p = useLinkPreview(link.href, user);
  const lead = p?.image
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-11 w-11 shrink-0 rounded-md object-cover" />
    : <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-ink/5 font-ui text-base font-bold uppercase text-slate">{site(link.href).slice(0, 1)}</span>;
  return <Row {...rest} lead={lead} title={p?.title || link.text} sub={<><span className="text-crimson">{p?.site || site(link.href)}</span> · {by}</>} />;
}
