// Signing in happens on www.notesapp.name.ng. When someone arrives from a member's own domain (middleware adds
// ?from=<host>&next=<path> to /login and /signup), this says where to send them afterwards: back to that domain,
// but only if it really is an active member domain. Returns null when there is nothing to return to.
export async function returnTarget(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const from = (q.get("from") || "").toLowerCase();
  if (!from) return null;
  let next = q.get("next") || "/";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/";
  try {
    const d = await fetch(`/api/public/domain-resolve?host=${encodeURIComponent(from)}`).then((r) => r.json());
    return d.found && d.host === from ? `https://${from}${next}` : null;
  } catch {
    return null;
  }
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
