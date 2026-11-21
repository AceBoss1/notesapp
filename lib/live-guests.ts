// Watching a live without an account (docs/GUEST_LIVES.md; owner approved 19 Nov 2026). Pure: who may watch as a guest and why not,
// the guest limit, and the chat a guest may see. The pass is lib/live-guest-pass.ts (server only); the server side is
// lib/live-guests-server.ts.
//
// A guest has no account and no name: a random id in a signed, http-only cookie, used only to count them, give them a seat in the
// relay (receive only) and limit how often they ask. Guests watch, read the chat and share; everything else asks them to join.
import type { RoomChat, RoomDoc, RoomSettings } from "./rooms";

export const GUEST_COOKIE = "nl_guest";
export const GUEST_PASS_MS = 6 * 3_600_000; // a pass lasts six hours, renewed while they watch
export const GUEST_BEAT_MS = 20_000; // a guest's page says "still here" this often
export const GUEST_GONE_MS = 60_000; // and is counted as gone after this long without
export const GUEST_CHAT_SHOWN = 40;

export const isGuestId = (v: unknown): v is string => typeof v === "string" && /^g_[A-Za-z0-9_-]{8,20}$/.test(v);

// ── Who may watch as a guest ──────────────────────────────────────────────────────────────────────────────────────────────────
// Why a guest can't watch (the states on screen 5 of the mockups), or null when they can.
export type GuestNo = "ended" | "followers" | "subscribers" | "paid" | "community" | "off" | "teen" | "phone" | "full";
export const GUEST_NO_TEXT: Record<GuestNo, { title: string; body: string; button: string }> = {
  ended: { title: "This live has ended", body: "", button: "" },
  followers: { title: "For the host's followers", body: "The host chose followers only for this live.", button: "Sign in and follow" },
  subscribers: { title: "For the host's subscribers", body: "The host chose subscribers only for this live.", button: "Sign in to subscribe" },
  paid: { title: "A paid live", body: "Buy a ticket to watch.", button: "Sign in to buy a ticket" },
  community: { title: "For the community's members", body: "Lives in a community are for its members.", button: "Sign in to ask to join" },
  off: { title: "Sign in to watch", body: "The host has kept this live to people with an account.", button: "Sign in to watch" },
  teen: { title: "Sign in to watch", body: "This live is for people with an account.", button: "Sign in to watch" },
  phone: { title: "Sign in to watch", body: "This is a small live, sent from the host's phone, so it's for people with an account.", button: "Sign in to watch" },
  full: { title: "This live is full for guests", body: "Members can still get in.", button: "Sign in to watch" },
};
export type GuestSettings = Pick<RoomSettings, "guestsOn" | "guestsPerLive" | "relayListeners">;
// hostTeen: the host is in teen mode (a teen's live is never open to guests). guests: guests watching now.
export function guestNo(r: Pick<RoomDoc, "status" | "mode" | "profile" | "paid" | "cid" | "listening">, s: GuestSettings, o: { hostTeen: boolean; guests: number; joining?: boolean }): GuestNo | null {
  if (r.status !== "live") return "ended";
  if (r.paid) return "paid";
  if (!r.profile) return "community";
  if (r.profile.audience === "followers") return "followers";
  if (r.profile.audience === "subscribers") return "subscribers";
  if (s.guestsOn <= 0 || r.profile.guests === false) return "off";
  if (o.hostTeen) return "teen";
  if (r.mode !== "relay") return "phone";
  if (o.joining && o.guests >= guestLimit(r, s)) return "full";
  return null;
}
// How many guests a live takes: Admin's limit per live, and never so many that members can't get in (members are counted against the
// room's listener limit without guests, so they always have room; guests stop when members and guests together reach it).
export const guestLimit = (r: Pick<RoomDoc, "listening">, s: GuestSettings) => Math.max(0, Math.min(s.guestsPerLive, s.relayListeners - (r.listening ?? 0)));
// Whether a live is open to guests, for the host's numbers and the teen rule on stage.
export const openToGuests = (r: Pick<RoomDoc, "profile" | "paid">, s: Pick<RoomSettings, "guestsOn">) =>
  !r.paid && r.profile?.audience === "everyone" && r.profile.guests !== false && s.guestsOn > 0;

// ── What a guest sees of the chat ─────────────────────────────────────────────────────────────────────────────────────────────
// Teens' own lines are never shown to guests (they are marked when sent, lib/rooms-server.ts sendRoomChat). Joins, shares and the like
// are shown as they are for everyone; the newest last.
export type GuestChatLine = { id: string; name: string; text: string; at: string; ev?: RoomChat["ev"] };
export function guestChat(rows: { id: string; m: RoomChat & { teen?: boolean } }[]): GuestChatLine[] {
  return rows.filter((x) => !x.m.teen).slice(-GUEST_CHAT_SHOWN).map((x) => ({ id: x.id, name: x.m.name, text: x.m.text, at: x.m.at, ...(x.m.ev ? { ev: x.m.ev } : {}) }));
}

// What a link preview says about a live.
export function livePreview(r: Pick<RoomDoc, "title" | "hostName" | "status" | "profile" | "paid">, guestsCanWatch: boolean): { title: string; description: string } {
  if (r.status !== "live") return { title: `${r.hostName}'s live: ${r.title}`, description: "This live has ended. See the replay and what's next on #NotesApp." };
  return {
    title: `${r.hostName} is live: ${r.title}`,
    description: guestsCanWatch ? "Watch on #NotesApp. No account needed to watch." : r.paid ? "A paid live on #NotesApp." : "Live now on #NotesApp.",
  };
}
