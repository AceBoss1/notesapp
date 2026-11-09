"use client";

import type { User } from "firebase/auth";

// Calls to /api/partners and /api/partners/portal from the browser, signed in when there's a member.
export async function partnersCall<T>(user: User | null, path: "/api/partners" | "/api/partners/portal", method: "GET" | "POST", body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method, cache: "no-store",
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong.");
  return j as T;
}
