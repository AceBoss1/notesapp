"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { mentionAt } from "@/lib/linkify";
import { NameBadgeIcons } from "@/components/PersonName";

// Type @ in a post, a comment, a message or a caption and this offers matching members (by username); ↑ ↓ to move, Enter or
// Tab to pick, Esc to close. Picking writes "@username " at the caret. Put it inside a `relative` wrapper with the field; it
// shows above the field (place="above", for chat boxes at the bottom of the screen) or below it.
type Person = { username: string; displayName: string; avatar: string };
const CHANNEL: Person = { username: "na-notesapp", displayName: "NotesApp", avatar: "/images/brand/notesapp-icon.webp" };
const found = new Map<string, Person[]>();

async function search(q: string): Promise<Person[]> {
  if (found.has(q)) return found.get(q)!;
  const snap = await getDocs(query(collection(db, "users"), where("username", ">=", q), where("username", "<=", `${q}`), orderBy("username"), limit(8)));
  const people = snap.docs.map((d) => d.data()).filter((u) => u.username && u.suspended !== true && u.teen !== true) // teen mode: under-18s aren't suggested
    .map((u) => ({ username: String(u.username), displayName: String(u.displayName || u.username), avatar: String(u.avatar || "") }));
  if (CHANNEL.username.startsWith(q) && !people.some((p) => p.username === CHANNEL.username)) people.push(CHANNEL);
  const out = people.slice(0, 6);
  found.set(q, out);
  return out;
}

export default function MentionPicker({ target, value, onChange, place = "below" }: {
  target: RefObject<HTMLTextAreaElement | HTMLInputElement>;
  value: string;
  onChange: (next: string) => void;
  place?: "above" | "below";
}) {
  const [at, setAt] = useState<{ start: number; query: string; caret: number } | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [active, setActive] = useState(0);
  const state = useRef({ at, people, active, value });
  state.current = { at, people, active, value };

  // what's being typed at the caret
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const look = () => {
      const caret = el.selectionStart ?? el.value.length;
      const m = el.selectionStart === el.selectionEnd ? mentionAt(el.value, caret) : null;
      setAt(m && m.query.length >= 1 ? { ...m, caret } : null);
    };
    const keys = (e: Event) => {
      const k = e as KeyboardEvent, s = state.current;
      if (!s.at || !s.people.length) return;
      if (k.key === "ArrowDown" || k.key === "ArrowUp") { k.preventDefault(); k.stopPropagation(); setActive((i) => (i + (k.key === "ArrowDown" ? 1 : s.people.length - 1)) % s.people.length); }
      else if (k.key === "Enter" || k.key === "Tab") { k.preventDefault(); k.stopPropagation(); pick(s.people[s.active] ?? s.people[0]); }
      else if (k.key === "Escape") { k.preventDefault(); k.stopPropagation(); setAt(null); }
    };
    const blur = () => window.setTimeout(() => setAt(null), 150);
    el.addEventListener("input", look); el.addEventListener("click", look); el.addEventListener("keyup", look);
    el.addEventListener("keydown", keys); el.addEventListener("blur", blur);
    return () => { el.removeEventListener("input", look); el.removeEventListener("click", look); el.removeEventListener("keyup", look); el.removeEventListener("keydown", keys); el.removeEventListener("blur", blur); };
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  // the members who match
  useEffect(() => {
    if (!at) { setPeople([]); return; }
    let alive = true;
    const t = window.setTimeout(() => { search(at.query).then((p) => { if (alive) { setPeople(p); setActive(0); } }).catch(() => alive && setPeople([])); }, 150);
    return () => { alive = false; window.clearTimeout(t); };
  }, [at?.query]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(p: Person) {
    const s = state.current, el = target.current;
    if (!s.at || !el) return;
    const before = s.value.slice(0, s.at.start), after = s.value.slice(s.at.caret);
    const insert = `@${p.username}${after.startsWith(" ") ? "" : " "}`;
    onChange(before + insert + after);
    setAt(null);
    const pos = before.length + insert.length;
    window.requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos, pos); });
  }

  if (!at || !people.length) return null;
  return (
    <ul role="listbox" aria-label="Mention someone" className={`absolute left-0 z-40 w-full max-w-sm overflow-hidden rounded-xl border border-rule bg-card text-ink shadow-xl ${place === "above" ? "bottom-full mb-1" : "top-full mt-1"}`}>
      {people.map((p, i) => (
        <li key={p.username} role="option" aria-selected={i === active}>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(p); }} onMouseEnter={() => setActive(i)} className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${i === active ? "bg-paper" : ""}`}>
            {p.avatar ? <img src={p.avatar} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-crimson text-[11px] font-bold text-white">{p.displayName.slice(0, 2).toUpperCase()}</span>}
            <span className="min-w-0"><span className="flex min-w-0 items-center leading-tight"><b className="truncate">{p.displayName}</b><NameBadgeIcons username={p.username} size={13} /></span><span className="block truncate text-xs text-slate">@{p.username}</span></span>
          </button>
        </li>
      ))}
    </ul>
  );
}
