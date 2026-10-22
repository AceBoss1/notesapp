"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

// Naija Exam Prep in the browser: where its pages live, who is signed in, and its API calls.
// On prep.<domain> the pages sit at the root (/jamb, /saved …; middleware.ts); on the main site, localhost and previews under /exam-prep.
const BaseContext = createContext("/exam-prep");
export const PrepBase = ({ base, children }: { base: string; children: React.ReactNode }) => <BaseContext.Provider value={base}>{children}</BaseContext.Provider>;
export function usePrepHref() {
  const base = useContext(BaseContext);
  return (p: string) => (base ? `${base}${p === "/" ? "" : p}` : p) || "/";
}

export function useMe() {
  const [me, setMe] = useState<User | null | undefined>(undefined); // undefined = still checking
  useEffect(() => onAuthStateChanged(auth, setMe), []);
  return me;
}

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
// A call to /api/exam-prep/…, signed in when there's an account. Throws ApiError with the server's own words.
export async function prepApi<T = Record<string, unknown>>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken().catch(() => undefined);
  const res = await fetch(`/api/exam-prep/${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}), ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(String((data as { error?: string }).error || "Something went wrong. Try again."), res.status);
  return data as T;
}

// The catalogue, fetched once per page load and account (several cards on a page share it).
import type { Catalogue } from "@/lib/exam-prep-server";
let cat: { uid: string | null; p: Promise<Catalogue> } | null = null;
export function loadCatalogue(fresh = false): Promise<Catalogue> {
  const uid = auth.currentUser?.uid ?? null;
  if (!cat || fresh || cat.uid !== uid) { cat = { uid, p: prepApi<Catalogue>("catalogue") }; cat.p.catch(() => { cat = null; }); }
  return cat.p;
}

export const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => { window.removeEventListener("online", set); window.removeEventListener("offline", set); };
  }, []);
  return online;
}
