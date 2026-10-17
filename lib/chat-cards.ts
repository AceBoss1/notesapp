// A #NotesApp link in a message (a journal, a store item, a course or a profile) shows as a card with what it is, a picture and a button,
// instead of the ordinary web preview. Pure: which links count, read from the address alone (tests/messages/chat-tools.test.ts).
export type CardKind = "journal" | "item" | "course" | "profile";
export type CardRef = { kind: CardKind; id: string };
export type ChatCard = { kind: CardKind; href: string; title: string; subtitle: string; image: string; cta: string; badge?: string };

const PATHS: [RegExp, CardKind][] = [
  [/^\/journals\/([a-z0-9][a-z0-9-]{0,120})\/?$/i, "journal"],
  [/^\/shop\/([A-Za-z0-9_-]{1,64})\/?$/, "item"],
  [/^\/academy\/([a-z0-9][a-z0-9-]{0,120})\/?$/i, "course"],
  [/^\/u\/([a-z0-9][a-z0-9._-]{0,40})\/?$/i, "profile"],
];
const RESERVED = new Set(["teach", "new", "notesapp"]); // pages, not things

// `roots`: our own domains (lib/host.ts KNOWN_ROOTS); www., app. and the bare domain all count.
export function parseCardLink(raw: string, roots: string[]): CardRef | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  if (!roots.some((r) => host === r || host === `www.${r}` || host === `app.${r}`)) return null;
  for (const [re, kind] of PATHS) {
    const m = u.pathname.match(re);
    if (m && !RESERVED.has(m[1].toLowerCase())) return { kind, id: kind === "item" ? m[1] : m[1].toLowerCase() };
  }
  return null;
}
