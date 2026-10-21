"use client";

import { auth } from "@/lib/firebase";

// Calls to /api/community and /api/events, signed in when the visitor is (signed out works for what non-members may see).
export async function capi<T = Record<string, unknown>>(url: string, body?: unknown): Promise<T> {
  const u = auth.currentUser;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (u) headers.Authorization = `Bearer ${await u.getIdToken()}`;
  const res = await fetch(url, { method: body ? "POST" : "GET", headers, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store" });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j.error || "Something went wrong.");
  return j as T;
}
export const small = "rounded-full border border-rule px-3 py-1 text-xs font-semibold text-ink hover:border-crimson disabled:opacity-40";
export const field = "w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";
export const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: s > 300 * 86_400 ? "numeric" : undefined });
};
