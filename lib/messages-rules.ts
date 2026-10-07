// Direct messages: client-safe constants and helpers.
export const MESSAGE_MAX = 2000;
export const MESSAGES_PER_MINUTE = 20; // per sender, per instance (see lib/rate-limit.ts)

// One conversation per pair of members; the id is the two uids in sorted order so either side finds it by id.
export const conversationId = (a: string, b: string) => [a, b].sort().join("_");

export type MomentRef = { momentId: string; expiresAt: string };
export type ThreadMessage = {
  id: string;
  from: string;
  text: string;
  createdAt: string;
  // A reply to a moment. The moment itself is never copied into the message: once it has expired it can't be viewed.
  moment?: { momentId: string; expired: boolean };
};
