"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { confirmWithPasskey } from "@/lib/passkeys-client";
import { errText } from "./api";

// Calendar | Planner, at the top of both (docs/NOTES_PLANNER.md, mockups 1 and 6).
export function PlannerTabs({ active }: { active: "calendar" | "planner" }) {
  const tab = (on: boolean) => `flex-1 rounded-full px-4 py-2 text-center font-ui text-[13px] font-bold ${on ? "bg-card text-crimson shadow-sm" : "text-slate hover:text-ink"}`;
  return (
    <nav aria-label="My Calendar" className="mt-4 flex max-w-sm rounded-full bg-paper p-1">
      <Link href="/calendar" aria-current={active === "calendar" ? "page" : undefined} className={tab(active === "calendar")}>📅 Calendar</Link>
      <Link href="/calendar/planner" aria-current={active === "planner" ? "page" : undefined} className={tab(active === "planner")}>🗓 Planner</Link>
    </nav>
  );
}

export function PlannerHeader({ title, back }: { title: string; back?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        {back && <Link href={back.href} className="text-xs font-semibold text-crimson">← {back.label}</Link>}
        <h1 className="font-display text-3xl text-ink">{title}</h1>
      </div>
      {!back && <Link href="/calendar/planner/settings" aria-label="Planner settings" className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-card px-3 py-1.5 text-xs font-semibold text-ink hover:border-crimson"><span aria-hidden>⚙️</span><span className="hidden sm:inline">Settings</span></Link>}
    </div>
  );
}

// Every Planner screen sits inside this: it waits for her sign-in, and when she has the lock on and a request comes back locked,
// it shows the unlock screen and starts the screen again once her passkey check passes.
export type Gate = { user: User; locked: () => void };
export function PlannerGate({ next, children }: { next: string; children: (g: Gate) => ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [isLocked, setLocked] = useState(false);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => onAuthStateChanged(auth, (u) => { if (!u) router.replace(`/login?next=${next}`); setUser(u); }), [router, next]);
  const locked = useCallback(() => setLocked(true), []);
  if (!user) return <p className="px-4 py-16 text-center text-sm text-slate">Opening Notes Planner…</p>;
  if (isLocked) {
    const unlock = async () => {
      setBusy(true); setError("");
      try { await confirmWithPasskey(user, "/api/planner/unlock"); setLocked(false); setRound((n) => n + 1); }
      catch (e) { setError(errText(e, "Couldn't unlock it. Try again.")); }
      finally { setBusy(false); }
    };
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
        <span className="text-5xl" aria-hidden>🔒</span>
        <h1 className="font-display text-2xl text-ink">Notes Planner is locked</h1>
        <p className="text-sm leading-relaxed text-slate">You turned the lock on. Unlock with this device&apos;s fingerprint, face or screen lock, through your #NotesApp passkey.</p>
        {error && <p role="alert" className="rounded-xl bg-[#FFF1F3] px-3 py-2 text-sm text-crimson">{error}</p>}
        <button type="button" onClick={unlock} disabled={busy} className="btn-primary !rounded-full !px-6 !py-2.5 text-sm disabled:opacity-60">{busy ? "Waiting for your device…" : "Unlock"}</button>
        <Link href="/calendar" className="text-xs text-slate underline">Back to My Calendar</Link>
      </div>
    );
  }
  return <div key={round}>{children({ user, locked })}</div>;
}
