import { auth } from "./firebase";

// Growth measurement: first value the browser sees before the server does (lib/growth.ts). A journal published (journals are saved
// from the browser) or one read to the end. Once per member per device; the server checks it and records it once.
export function reportValue(kind: "journal" | "read", noteId?: string): void {
  try {
    const u = auth.currentUser;
    if (!u) return;
    const key = `na_fv_${kind}_${u.uid}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    void u.getIdToken().then((t) => fetch("/api/growth", {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ action: "value", kind, ...(noteId ? { noteId } : {}) }),
    })).catch(() => {});
  } catch { /* storage blocked: skip */ }
}
