// Fire-and-forget visit tracking for the trending feed. Failures are
// ignored on purpose — analytics must never break a page. A session
// only reports each page once.
export function recordView(kind: "note" | "profile", id: string): void {
  try {
    const key = `tracked:${kind}:${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // sessionStorage unavailable (private mode etc.) — skip
  }
}
