// Nana AI, #NotesApp's helper: shared limits, visitor details and reply parsing. Pure and client-safe.
export const NANA_NAME = "Nana AI";
export const NANA_USER_MAX = 800; // characters in one message from a person
export const NANA_HISTORY_MAX = 14; // messages we send back to the model each turn
export const NANA_TRANSCRIPT_MAX = 60; // messages kept per saved chat

export type NanaMsg = { role: "user" | "assistant"; content: string };
export class NanaError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export const firstName = (name: string) => (name.trim().split(/\s+/)[0] || "").slice(0, 30);
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

// A visitor who is not signed in must say who they are first. Names are plain text; emails are checked for shape only.
export function cleanVisitor(v: { name?: unknown; email?: unknown }): { name: string; email: string } {
  const name = String(v.name ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim();
  const email = String(v.email ?? "").trim().toLowerCase();
  if (name.length < 2 || name.length > 60) throw new NanaError("Please tell me your name, so I know who I am talking to.");
  if (!EMAIL.test(email) || email.length > 254) throw new NanaError("That email doesn't look right. Could you check it?");
  return { name, email };
}

// The model ends a reply with control tags on their own: [[HANDOFF]] (a person should follow up) and [[GAP]] (the knowledge base didn't
// cover the question). They are removed before anything is shown.
export function parseReply(raw: string): { text: string; handoff: boolean; gap: boolean } {
  const handoff = /\[\[HANDOFF\]\]/i.test(raw);
  const gap = /\[\[GAP\]\]/i.test(raw);
  const text = raw.replace(/\[\[(?:HANDOFF|GAP)\]\]/gi, "").replace(/\n{3,}/g, "\n\n").trim();
  return { text, handoff, gap };
}
