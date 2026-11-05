import type { GiftMotif } from "./gift-catalogue";

// Playing an animated gift on screen (components/GiftOverlay.tsx, mounted on every page). Anything that learns a gift was sent calls
// playGift: the receiver's page (components/GiftShowWatcher.tsx), the bell, the gift sheet after a wallet payment, and, when the live
// chat lands, the live room on each gift broadcast to everyone watching. One gift plays at a time; the rest queue.
export const GIFT_PLAY_EVENT = "notesapp:gift-play";
// priceKobo is what was paid in all; quantity (a send of N of one small gift) plays once with a ×N counter.
export type GiftPlay = { giftId: GiftMotif; name: string; priceKobo: number; senderName?: string; toName?: string; key?: string; quantity?: number };

export function playGift(g: GiftPlay): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GiftPlay>(GIFT_PLAY_EVENT, { detail: g }));
}

// Gift sounds are off unless the viewer turns them on (kept on this device only).
const SOUND_KEY = "na-gift-sound";
export function giftSoundOn(): boolean {
  try { return localStorage.getItem(SOUND_KEY) === "on"; } catch { return false; }
}
export function setGiftSound(on: boolean): void {
  try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch { /* private window: stays off */ }
}
