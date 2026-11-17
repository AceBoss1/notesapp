"use client";
import type { User } from "firebase/auth";
import type { Change, Draft, Funnel, NanaRead, Part, Question, QuestionId } from "@/lib/site-nana";
import type { Finding } from "@/lib/site-review";
import type { SiteDoc } from "@/lib/site-kits";

// The browser's side of /api/site/nana (lib/site-nana-server.ts).
export type SetupView = {
  tier: string; questions: Question[]; answers: Partial<Record<QuestionId, string>>; next: number; answered: number; canDraft: boolean;
  known: { shop: number; bookingHours: string } | null; can: { book: boolean; shop: boolean };
  draft: Draft | null; changes: Change[]; replace: Record<Part, boolean>;
  current: { site: SiteDoc; theme: string; about: string; username: string };
  undo: { at: string; days: number } | null;
  notice?: string;
};
export type ReviewView = { tier: string; username: string; findings: Finding[]; fine: string[] };
export type ReadView = { read: NanaRead; funnel: Funnel; notice?: string };

export async function siteNana<T>(user: User, body?: Record<string, unknown>, query = ""): Promise<T> {
  const res = await fetch(`/api/site/nana${query}`, {
    method: body ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Something went wrong. Try again.");
  return d as T;
}

// Where each kind of fix is made.
export const FIX_HREF: Record<Finding["fix"]["at"], string> = {
  kit: "/profile/site#kit-h", look: "/profile/site#theme-h", show: "/profile/site#sections-h", content: "/profile/site#content-h",
  pages: "/profile/site#pages-h", shop: "/shop", booking: "/profile/publishing",
};
