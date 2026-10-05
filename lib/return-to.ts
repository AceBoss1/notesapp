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
