"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

// "Notify me when it's back": a bell alert is sent when the seller restocks.
export default function NotifyWhenBack({ itemId, compact = false }: { itemId: string; compact?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) return;
    user
      .getIdToken()
      .then((t) => fetch(`/api/store/watch?itemId=${encodeURIComponent(itemId)}`, { headers: { Authorization: `Bearer ${t}` } }))
      .then((r) => r.json())
      .then((j) => setWatching(!!j.watching))
      .catch(() => {});
  }, [user, itemId]);

  async function toggle() {
    if (!user) return router.push("/login");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/store/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ itemId, watch: !watching }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't save that.");
      setWatching(!!j.watching);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button onClick={toggle} disabled={busy || user === undefined} className={`btn-ghost ${compact ? "!px-3 !py-1.5 text-xs" : "!px-4 !py-2 text-sm"}`}>
        {watching ? "🔔 We'll tell you — cancel" : "🔔 Notify me when it's back"}
      </button>
      {error && <span className="mt-1 text-xs text-crimson">{error}</span>}
    </span>
  );
}
