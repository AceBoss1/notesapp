import { auth } from "./firebase";
import { apiError, type CheckDetail } from "./content-checks";

// The browser's side of AI content checks: a pass for what it is about to save (journals, shop items, profiles; firestore.rules ask
// for one), the member's own record (account page), and appeals. Errors carry `contentCheck` (what was found, and where).
async function call<T>(method: "GET" | "POST", body?: unknown): Promise<T> {
  const u = auth.currentUser;
  if (!u) throw new Error("Sign in first.");
  const res = await fetch("/api/content-checks", {
    method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${await u.getIdToken()}` },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(data, "Something went wrong.");
  return data as T;
}

// The pass id to save with (null when checks are switched off). Throws when the content was blocked or held, or posting is paused.
export async function requestPass(kind: "journal" | "store_item" | "profile", body: Record<string, unknown>): Promise<string | null> {
  return (await call<{ passId: string | null }>("POST", { action: "pass", kind, ...body })).passId;
}

export type MyChecks = {
  pausedUntil: string | null; banned: boolean; appeal: { text: string; at: string; status: string } | null;
  activeStrikes: number; strikesToSuspend: number; windowDays: number;
  items: { id: string; kind: string; label: string; category: string; item: string; at: string; status: string; strike: boolean; active: boolean; appealed: boolean }[];
};
export const loadMyChecks = () => call<MyChecks>("GET");
export const appealCheck = (flagId: string, text = "") => call<{ ok: true }>("POST", { action: "appeal", flagId, text });
export const appealPause = (text = "") => call<{ ok: true }>("POST", { action: "appeal_suspension", text });
export type { CheckDetail };
