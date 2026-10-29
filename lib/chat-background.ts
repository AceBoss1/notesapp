// A member's own chat background (Pro, Business and Enterprise): behind every chat they open, on every device (userPrefs, through
// /api/messages/prefs). Everyone else sees the #NotesApp African pattern. Only the member who chose it sees it; the people they
// chat with keep their own.
import type { AccountTier } from "./users";

export type ChatBackground =
  | { kind: "pattern" }
  | { kind: "plain" }
  | { kind: "colour"; id: string }
  | { kind: "picture"; url: string };

export const DEFAULT_CHAT_BACKGROUND: ChatBackground = { kind: "pattern" };

// Colours with a Day and a Night shade, so words stay readable either way.
export const CHAT_COLOURS: { id: string; label: string; day: string; night: string }[] = [
  { id: "kente", label: "Kente gold", day: "#F6E7C1", night: "#45320F" },
  { id: "adire", label: "Adire indigo", day: "#E1E7F5", night: "#1C2848" },
  { id: "forest", label: "Forest", day: "#E2EFE5", night: "#163222" },
  { id: "sahel", label: "Sahel sand", day: "#F3E5D1", night: "#3A2917" },
  { id: "atlantic", label: "Atlantic", day: "#DCEFF2", night: "#0E3138" },
  { id: "hibiscus", label: "Hibiscus", day: "#F8E2EA", night: "#4A0E25" },
];

const PAID: AccountTier[] = ["pro", "business", "enterprise"];
export const canChooseChatBackground = (tier: AccountTier | undefined) => !!tier && PAID.includes(tier);

// A picture is the member's own upload (lib/upload.ts, purpose "chat"), stored at <media>/chatbg/<uid>/…
export const chatPicturePrefix = (mediaBase: string, uid: string) => `${mediaBase.replace(/\/$/, "")}/chatbg/${uid}/`;

// What's saved, checked: anything else falls back to the pattern.
export function cleanChatBackground(v: unknown, picturePrefix?: string): ChatBackground | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  if (b.kind === "pattern" || b.kind === "plain") return { kind: b.kind };
  if (b.kind === "colour" && typeof b.id === "string" && CHAT_COLOURS.some((c) => c.id === b.id)) return { kind: "colour", id: b.id };
  if (b.kind === "picture" && typeof b.url === "string" && b.url.length < 500 && /^https:\/\/[^\s"'()<>]+$/.test(b.url) && (!picturePrefix || b.url.startsWith(picturePrefix)))
    return { kind: "picture", url: b.url };
  return null;
}

// The class and style for the chat's message list.
export function chatBackgroundStyle(bg: ChatBackground, night: boolean): { className: string; style?: Record<string, string> } {
  if (bg.kind === "plain") return { className: "bg-paper" };
  if (bg.kind === "colour") {
    const c = CHAT_COLOURS.find((x) => x.id === bg.id);
    if (c) return { className: "", style: { backgroundColor: night ? c.night : c.day } };
  }
  if (bg.kind === "picture") {
    // A wash over the picture so the bubbles still read: light by Day, dark by Night.
    const wash = night ? "rgba(30, 4, 14, 0.55)" : "rgba(251, 246, 242, 0.35)";
    return { className: "bg-cover bg-center", style: { backgroundImage: `linear-gradient(${wash}, ${wash}), url("${bg.url}")` } };
  }
  return { className: "na-pattern" };
}
