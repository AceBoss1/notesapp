"use client";

import type { User } from "firebase/auth";
import { lagosToday } from "@/lib/my-calendar";
import type { PlannerView, plannerDay } from "@/lib/planner-server";

// The browser side of Notes Planner (lib/planner-server.ts). Requests carry her sign-in; when she has the lock on, the unlock
// cookie (httpOnly) goes with them on its own, and a 423 means it's time to unlock again.
export type View = PlannerView;
export type InterviewView = NonNullable<PlannerView["interview"]>;
export type DayData = Awaited<ReturnType<typeof plannerDay>>;
export class PlannerHttpError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export const isLocked = (e: unknown) => e instanceof PlannerHttpError && e.status === 423;
export const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export async function papi<T>(user: User, init: { body?: Record<string, unknown>; query?: string; method?: string } = {}): Promise<T> {
  const r = await fetch(`/api/planner${init.query ? `?${init.query}` : init.body ? "" : `?today=${lagosToday()}`}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: init.body ? JSON.stringify({ today: lagosToday(), ...init.body }) : undefined,
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new PlannerHttpError(j.error || "Something went wrong.", r.status);
  return j as T;
}

export const card = "rounded-2xl border border-rule bg-card";
export const field = "w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink outline-none focus:border-crimson";
export const ghost = "inline-flex items-center justify-center gap-1.5 rounded-full border border-rule bg-card px-4 py-2.5 font-ui text-sm font-bold text-ink hover:border-crimson disabled:opacity-50";
export const primary = "btn-primary inline-flex items-center justify-center gap-1.5 !rounded-full !py-2.5 text-sm disabled:opacity-50";
export const PLAN_COLOUR = "#0F8B8D";
