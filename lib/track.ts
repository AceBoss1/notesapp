// Fire-and-forget visit tracking for the trending feed. Failures are
// ignored on purpose — analytics must never break a page. A session
// only reports each page once.
// Where this visit came from, for the member's analytics (lib/analytics.ts sourceOf): the referring site's host name and any ?utm_source=.
// Only the host is sent, never the full address.
export function visitSource(): { ref: string; utm: string } {
  try {
    const ref = document.referrer ? new URL(document.referrer).hostname : "";
    const utm = new URLSearchParams(window.location.search).get("utm_source") ?? "";
    return { ref: ref.slice(0, 253), utm: utm.slice(0, 40) };
  } catch {
    return { ref: "", utm: "" };
  }
}

export function recordView(kind: "note" | "profile", id: string): void {
  try {
    const key = `tracked:${kind}:${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, ...visitSource() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // sessionStorage unavailable (private mode etc.) — skip
  }
}
