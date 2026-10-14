// Chats with residents (computer players) stay on this device only (localStorage), never on our servers. Chats with real players are
// real NotesApp messages, opened in Messages.
import { RESIDENT, type Resident } from "@/lib/life/catalog";

export type Line = { me: boolean; text: string; at: number };
export type Topic = keyof Resident["lines"];
const KEY = (uid: string) => `notesLife:chats:${uid}`;

function all(uid: string): Record<string, Line[]> { try { return JSON.parse(localStorage.getItem(KEY(uid)) || "{}") || {}; } catch { return {}; } }
export function chatWith(uid: string, id: string): Line[] { return all(uid)[id] ?? []; }

export const TOPICS: { id: Topic; label: string; ask: string }[] = [
  { id: "greet", label: "👋 Greet", ask: "Hello! How are you?" },
  { id: "food", label: "🍲 Food", ask: "Where should I eat?" },
  { id: "work", label: "💼 Work", ask: "Any work tips?" },
  { id: "nepa", label: "⚡ NEPA", ask: "What do you do when NEPA takes light?" },
  { id: "money", label: "💰 Money", ask: "How do I make money here?" },
];

// You ask, they answer (one of their lines on that topic). Keeps the last 30 lines with each resident.
export function say(uid: string, id: string, topic: Topic): Line[] {
  const r = RESIDENT(id); if (!r) return [];
  const t = TOPICS.find((x) => x.id === topic)!;
  const opts = r.lines[topic]?.length ? r.lines[topic] : r.lines.greet;
  const now = Date.now();
  const lines = [...chatWith(uid, id), { me: true, text: t.ask, at: now }, { me: false, text: opts[Math.floor(Math.random() * opts.length)], at: now + 1 }].slice(-30);
  try { const a = all(uid); a[id] = lines; localStorage.setItem(KEY(uid), JSON.stringify(a)); } catch { /* private mode: this visit only */ }
  return lines;
}
