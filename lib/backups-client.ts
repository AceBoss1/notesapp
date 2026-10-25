"use client";

import { ADMIN_API, NO_RIGHTS, OAUTH_SCOPE, req, type Backup, type Database, type Operation, type Schedule, type Weekday } from "./backups";

// Admin → Backups in the browser: the owner signs in with Google (Google Identity Services, scope datastore) and the page calls
// Google's Firestore Admin API directly with that short-lived token. The token stays in this tab's memory and never reaches our
// server, so only someone holding the owner's Google login (and its security key) can switch recovery on, schedule or restore.

type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void };
type Gsi = { accounts: { oauth2: { initTokenClient: (c: { client_id: string; scope: string; callback: (r: { access_token?: string; error?: string; expires_in?: number }) => void; error_callback?: (e: { message?: string }) => void }) => TokenClient } } };

let gsi: Promise<Gsi> | null = null;
function loadGsi(): Promise<Gsi> {
  gsi ??= new Promise((ok, no) => {
    const w = window as unknown as { google?: Gsi };
    if (w.google?.accounts?.oauth2) return ok(w.google);
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (w.google ? ok(w.google) : no(new Error("Google sign-in didn't load.")));
    s.onerror = () => { gsi = null; no(new Error("Google sign-in didn't load. Check your connection.")); };
    document.head.appendChild(s);
  });
  return gsi;
}

export type GoogleToken = { token: string; until: number };
export async function signInWithGoogle(clientId: string): Promise<GoogleToken> {
  const g = await loadGsi();
  return new Promise((ok, no) => {
    const c = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: OAUTH_SCOPE,
      callback: (r) => (r.access_token ? ok({ token: r.access_token, until: Date.now() + (r.expires_in ?? 3600) * 1000 - 60_000 }) : no(new Error(r.error || "Google sign-in was cancelled."))),
      error_callback: (e) => no(new Error(e.message || "Google sign-in was cancelled.")),
    });
    c.requestAccessToken({ prompt: "consent" });
  });
}

export class GoogleApiError extends Error { constructor(readonly status: number, message: string) { super(message); } }

async function call<T>(t: GoogleToken, r: { path: string; method?: string; body?: unknown }): Promise<T> {
  if (Date.now() > t.until) throw new GoogleApiError(401, "Your Google sign-in has expired. Sign in again.");
  const res = await fetch(`${ADMIN_API}/${r.path}`, {
    method: r.method ?? "GET",
    headers: { Authorization: `Bearer ${t.token}`, ...(r.body ? { "Content-Type": "application/json" } : {}) },
    body: r.body ? JSON.stringify(r.body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new GoogleApiError(res.status, res.status === 403 ? NO_RIGHTS : res.status === 401 ? "Your Google sign-in has expired. Sign in again." : String(j?.error?.message ?? `Google answered ${res.status}.`));
  return j as T;
}

export const backupsApi = (t: GoogleToken, project: string) => ({
  database: () => call<Database>(t, req.database(project)),
  databases: () => call<{ databases?: Database[] }>(t, req.databases(project)).then((j) => j.databases ?? []),
  pitrOn: () => call<Operation>(t, req.setPitr(project)),
  protectionOn: () => call<Operation>(t, req.setProtection(project)),
  schedules: () => call<{ backupSchedules?: Schedule[] }>(t, req.schedules(project)).then((j) => j.backupSchedules ?? []),
  createSchedule: async (s: { weekly?: Weekday; days: number }) => call<Schedule>(t, req.createSchedule(project, s)), // async: a bad retention rejects, like Google's refusals
  deleteSchedule: (name: string) => call<object>(t, req.deleteSchedule(name)),
  backups: () => call<{ backups?: Backup[] }>(t, req.backups(project)).then((j) => (j.backups ?? []).sort((a, b) => String(b.snapshotTime).localeCompare(String(a.snapshotTime)))),
  restore: (backup: string, databaseId: string) => call<Operation>(t, req.restore(project, backup, databaseId)),
  clone: (snapshotTime: string, databaseId: string) => call<Operation>(t, req.clone(project, snapshotTime, databaseId)),
  operation: (name: string) => call<Operation>(t, req.operation(name)),
});
