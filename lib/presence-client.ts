"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { api } from "./moments-client";
import type { PresenceStatus } from "./social-graph";

// Who is online or when they were last seen, for the people you may see: followers you follow back, with online visibility on both sides.
// Asks the server (it applies the rules) on load and every two minutes while the tab is open.
export function usePresence(uids: string[]): { statuses: Record<string, PresenceStatus>; viewerOff: boolean } {
  const key = useMemo(() => Array.from(new Set(uids.filter(Boolean))).sort().join(","), [uids]);
  const [state, setState] = useState<{ statuses: Record<string, PresenceStatus>; viewerOff: boolean }>({ statuses: {}, viewerOff: false });
  useEffect(() => {
    if (!key) return;
    let stop = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      api<{ statuses: Record<string, PresenceStatus>; viewerOff: boolean }>("/api/presence", { body: { uids: key.split(",") } })
        .then((r) => { if (!stop) setState(r); })
        .catch(() => {});
    };
    const off = onAuthStateChanged(auth, (u) => {
      clearInterval(timer);
      if (!u) { setState({ statuses: {}, viewerOff: false }); return; }
      load();
      timer = setInterval(load, 120_000);
    });
    return () => { stop = true; off(); clearInterval(timer); };
  }, [key]);
  return state;
}
