"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { campusCall, useCampusMe, type CampusMe } from "@/lib/campus-client";
import { countryName } from "@/lib/campus";

// Shared parts of the Campus pages in the admin area (lib/campus.ts).

// Signed in and in the programme? `ready` once known; `denied` for anyone else (signed out, or not a coordinator, ambassador or lead).
export function useCampus() {
  const { user, me, refresh } = useCampusMe();
  const denied = user === null || (!!me && !me.lead && !me.member);
  const call = useCallback(<T,>(init: Parameters<typeof campusCall>[1]) => campusCall<T>(user as User, init), [user]);
  return { user, me, ready: !!user && !!me && !denied, denied, call, refresh };
}

// Load a view and reload it on demand.
export function useCampusView<T>(view: string, query: Record<string, string | undefined>, on: boolean) {
  const { user } = useCampusMe();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const key = JSON.stringify(query);
  const load = useCallback(async () => {
    if (!user || !on) return;
    setError("");
    try { setData(await campusCall<T>(user, { view, query: JSON.parse(key) })); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load."); }
  }, [user, on, view, key]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, reload: load };
}

export function CampusPage({ title, intro, me, denied, children }: { title: string; intro?: React.ReactNode; me: CampusMe | null; denied: boolean; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-3 sm:px-6">
      <h1 className="font-display text-3xl font-medium text-ink sm:text-[2rem]">{title}</h1>
      {intro && <p className="mt-3 max-w-3xl font-ui text-[15px] leading-relaxed text-slate">{intro}</p>}
      {denied ? (
        <p className="mt-8 rounded-[14px] border border-rule bg-card p-5 font-ui text-sm text-slate">Campus is for #NotesApp campus coordinators and ambassadors. If you&apos;ve just been added, sign out and back in. <Link href="/help/campus-ambassadors" className="font-semibold text-crimson underline">How the campus programme works</Link></p>
      ) : !me ? <p className="mt-8 font-ui text-sm text-slate">Loading…</p> : <div className="mt-6">{children}</div>}
    </div>
  );
}

export const card = "rounded-[14px] border border-rule bg-card p-5";
export const input = "w-full rounded-[10px] border border-rule bg-paper px-3.5 py-2.5 font-ui text-sm text-ink outline-none focus:border-crimson";
export const btn = "rounded-full bg-crimson-bright px-5 py-2.5 font-ui text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50";
export const btnGhost = "rounded-full border border-rule bg-card px-4 py-2 font-ui text-sm font-semibold text-ink hover:border-crimson disabled:opacity-50";

export function Stat({ label, value, note, tone }: { label: string; value: React.ReactNode; note?: string; tone?: "bad" | "good" }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-rule bg-card p-[18px]">
      <p className="font-ui text-[13px] font-medium text-slate">{label}</p>
      <p className={`mt-1 font-display text-[1.75rem] font-medium leading-tight ${tone === "bad" ? "text-red-700" : tone === "good" ? "text-green-700" : "text-ink"}`}>{value}</p>
      {note && <p className="mt-0.5 font-ui text-xs text-slate">{note}</p>}
    </div>
  );
}

// "today", "yesterday", "5 days ago", "never".
export function ago(iso: string | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

export const placeOf = (m: { campus: string; state?: string; country?: string }) => [m.campus, m.state, m.country ? countryName(m.country) : ""].filter(Boolean).join(", ");

export function Notice({ error, note }: { error?: string; note?: string }) {
  return <>{error && <p className="mb-4 font-ui text-sm text-crimson" role="alert">{error}</p>}{note && <p className="mb-4 font-ui text-sm text-green-700" role="status">{note}</p>}</>;
}
