"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { auth } from "@/lib/firebase";
import { AVATAR_MARK, type AvatarStatus } from "@/lib/avatar-maker";

// Nana's avatar maker on Edit profile (lib/avatar-maker.ts): choose a photo of yourself, get an illustrated portrait, use it as your
// picture. Shown only to members who may use it now (the #NotesApp team on the staff test pass, until it opens to everyone).
const token = async () => (auth.currentUser ? `Bearer ${await auth.currentUser.getIdToken()}` : "");

export default function AvatarMaker({ onUse }: { onUse: (url: string) => void }) {
  const [status, setStatus] = useState<AvatarStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let off = false;
    (async () => {
      const t = await token();
      if (!t) return;
      const j = await fetch("/api/avatar-maker", { headers: { Authorization: t }, cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (!off && j && typeof j.open === "boolean") setStatus(j as AvatarStatus);
    })();
    return () => { off = true; };
  }, []);
  if (!status?.open) return null;

  const make = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true); setError(""); setMade("");
    try {
      const body = new FormData();
      body.set("photo", file);
      const res = await fetch("/api/avatar-maker", { method: "POST", headers: { Authorization: await token() }, body });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.url) throw new Error(j.error || "Couldn't make the avatar. Please try again.");
      setMade(j.url);
      setStatus((s) => (s ? { ...s, left: j.left, used: s.limit - j.left } : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make the avatar. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-rule bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-ui text-sm font-bold text-ink">✨ Make an avatar with Nana <span className="ml-1 rounded-full bg-field px-2 py-0.5 text-[11px] font-semibold text-slate">Team test</span></p>
        <button type="button" className="font-ui text-sm font-semibold text-crimson underline underline-offset-2" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Close" : "Open"}</button>
      </div>
      {open && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-slate">Choose a clear photo of yourself and Nana draws an illustrated portrait from it, marked “{AVATAR_MARK}”. Use your own photo only. The photo is sent to our image partner to be drawn and isn&apos;t kept.</p>
          {!status.ready ? <p className="text-crimson" role="status">The avatar maker isn&apos;t set up yet: it needs an image model&apos;s key (docs/AVATAR_MAKER.md).</p> : status.left <= 0 ? <p className="text-slate" role="status">You&apos;ve made {status.limit} avatars today. You can make more tomorrow.</p> : (
            <label className="block">
              <span className="sr-only">Your photo</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => { void make(e.target.files?.[0]); e.target.value = ""; }} className="min-w-0 max-w-full" />
              <span className="mt-1 block text-[11px] text-slate">{status.left} of {status.limit} left today</span>
            </label>
          )}
          {busy && <p className="text-slate" role="status">Drawing your portrait. This can take up to a minute…</p>}
          {error && <p className="text-crimson" role="alert">{error}</p>}
          {made && (
            <div className="flex flex-wrap items-center gap-4">
              <Image src={made} alt="Your illustrated avatar" width={160} height={160} unoptimized className="h-40 w-40 rounded-2xl border border-rule object-cover" />
              <div className="space-y-2">
                <button type="button" className="btn-primary" onClick={() => { onUse(made); setOpen(false); }}>Use this picture</button>
                <p className="text-[11px] text-slate">Then press Save below to make it your profile picture.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
