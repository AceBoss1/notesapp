"use client";

import { useEffect, useState } from "react";
import type { NameBadges } from "./name-badges";

// Badges by username for the browser (GET /api/public/badges). Names asked for in the same moment go in one request; answers
// are kept for 5 minutes in this tab, so a list of fifty names is one request, not fifty.
const cache = new Map<string, { at: number; b: NameBadges }>();
const waiting = new Map<string, ((b: NameBadges) => void)[]>();
let timer: ReturnType<typeof setTimeout> | null = null;
const KEEP_MS = 5 * 60_000;

function flush() {
  timer = null;
  const names = Array.from(waiting.keys());
  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    fetch(`/api/public/badges?u=${encodeURIComponent(batch.join(","))}`)
      .then((r) => (r.ok ? r.json() : { badges: {} }))
      .catch(() => ({ badges: {} }))
      .then((j: { badges: Record<string, NameBadges> }) => {
        for (const n of batch) {
          const b = j.badges[n] ?? { level: null, team: false };
          cache.set(n, { at: Date.now(), b });
          (waiting.get(n) ?? []).forEach((f) => f(b));
          waiting.delete(n);
        }
      });
  }
}
export function loadBadges(username: string): Promise<NameBadges> {
  const n = username.toLowerCase();
  const hit = cache.get(n);
  if (hit && Date.now() - hit.at < KEEP_MS) return Promise.resolve(hit.b);
  return new Promise((ok) => {
    waiting.set(n, [...(waiting.get(n) ?? []), ok]);
    if (!timer) timer = setTimeout(flush, 30);
  });
}
// The badges for a username; `known` (already loaded with the profile) skips the request.
export function useBadges(username: string | undefined | null, known?: NameBadges | null): NameBadges | null {
  const [b, setB] = useState<NameBadges | null>(known ?? (username ? cache.get(username.toLowerCase())?.b ?? null : null));
  useEffect(() => {
    if (known) { setB(known); return; }
    if (!username) return;
    let alive = true;
    loadBadges(username).then((x) => { if (alive) setB(x); });
    return () => { alive = false; };
  }, [username, known]);
  return b;
}
