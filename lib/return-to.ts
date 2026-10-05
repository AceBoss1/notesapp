import type { User } from "firebase/auth";

// Signing in happens on www.notesapp.name.ng. When someone arrives from a member's own domain (middleware adds
// ?from=<host>&next=<path> to /login and /signup), `comeFrom()` says which domain and page, if it really is an active
// member domain; `goBack(user)` then signs them into that domain (a one-time hand-off) and sends them to the page.
export async function comeFrom(): Promise<{ host: string; next: string } | null> {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const from = (q.get("from") || "").toLowerCase();
  if (!from) return null;
  let next = q.get("next") || "/";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/";
  try {
    const d = await fetch(`/api/public/domain-resolve?host=${encodeURIComponent(from)}`).then((r) => r.json());
    return d.found && d.host === from ? { host: from, next } : null;
  } catch {
    return null;
  }
}

// Returns true when the browser is being sent away (so the caller shouldn't also navigate).
let leaving = false;
export async function goBack(user: User): Promise<boolean> {
  if (leaving) return true;
  const c = await comeFrom();
  if (!c) return false;
  leaving = true;
  try {
    const res = await fetch("/api/auth/handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify(c),
    });
    const j = await res.json();
    window.location.href = res.ok && j.url ? j.url : `https://${c.host}${c.next}`;
  } catch {
    window.location.href = `https://${c.host}${c.next}`;
  }
  return true;
}

// Paying also happens on the main site. When a buyer hops over from a member's domain (?from=<host>), remember it for this
// tab so the payment confirmation can offer the way back. Only active member domains are remembered.
const KEY = "na_return_host";
export async function rememberReturnHost(): Promise<void> {
  if (typeof window === "undefined") return;
  const from = (new URLSearchParams(window.location.search).get("from") || "").toLowerCase();
  if (!from) return;
  try {
    const d = await fetch(`/api/public/domain-resolve?host=${encodeURIComponent(from)}`).then((r) => r.json());
    if (d.found && d.host === from) sessionStorage.setItem(KEY, from);
  } catch {
    /* nothing to remember */
  }
}
export function rememberedReturnHost(): string | null {
  try {
    return typeof window === "undefined" ? null : sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function forgetReturnHost() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
