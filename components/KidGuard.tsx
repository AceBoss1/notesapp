"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signInWithCustomToken, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isKidUid, kidMayOpen, type KidAllow } from "@/lib/kids";

export type KidState = { nickname: string; allow: KidAllow; playMinutes: number; playLeftMs: number };

export async function kidCall(user: User, body?: Record<string, unknown>) {
  const r = await fetch("/api/kids", body ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body) } : { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong.");
  return j;
}

// The PIN pad that takes a child profile back to the parent's account.
export function BackToParent({ user, className = "" }: { user: User; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try { const r = await kidCall(user, { action: "exit", pin }); await signInWithCustomToken(auth, r.token); router.push("/profile/family"); }
    catch (err) { setError((err as Error).message); setPin(""); } finally { setBusy(false); }
  };
  if (!open) return <button className={className || "rounded-full border border-white/40 px-3 py-1 text-xs font-semibold"} onClick={() => setOpen(true)}>Back to parent</button>;
  return (
    <form onSubmit={go} className="flex items-center gap-2">
      <input autoFocus inputMode="numeric" type="password" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="PIN" aria-label="Parent's PIN" className="w-20 rounded-lg border border-rule px-2 py-1 text-center text-sm text-ink" />
      <button disabled={busy || pin.length !== 4} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-crimson disabled:opacity-50">OK</button>
      <button type="button" className="text-xs underline" onClick={() => { setOpen(false); setPin(""); setError(""); }}>Cancel</button>
      {error && <span className="text-xs font-semibold text-amber-200" role="alert">{error}</span>}
    </form>
  );
}

// On every page, for a child profile only (kids mode, lib/kids.ts): a band with their name and the way back to the parent, and
// anywhere the parent hasn't switched on sends them to their home (/kids). The server refuses those areas too.
export default function KidGuard() {
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [kid, setKid] = useState<KidState | null>(null);
  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u && isKidUid(u.uid) ? u : null); if (!u || !isKidUid(u.uid)) setKid(null); }), []);
  useEffect(() => { if (user) kidCall(user).then((d) => setKid(d.kid)).catch(() => setKid(null)); }, [user]);
  useEffect(() => { if (kid && !kidMayOpen(path, kid.allow)) router.replace("/kids"); }, [kid, path, router]);
  if (!user || !kid) return null;
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-[#0F2747] px-4 py-2 text-sm text-white">
      <Link href="/kids" className="font-semibold">🌟 {kid.nickname}&apos;s profile</Link>
      <BackToParent user={user} />
    </div>
  );
}
