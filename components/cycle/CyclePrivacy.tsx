"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { cycleApi, cycleMenuChanged, cycleStatus } from "@/lib/cycle-client";
import type { CycleStatus } from "@/lib/cycle-server";

// Settings → Privacy: My Cycle's private answer. "Not for me" can be undone here; nobody else ever sees the answer.
export default function CyclePrivacy({ user }: { user: User }) {
  const [s, setS] = useState<CycleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { cycleStatus(user).then(setS).catch(() => {}); }, [user]);
  if (!s || !s.eligible) return null;
  const undo = async () => {
    setBusy(true);
    try { setS(await cycleApi<CycleStatus>(user, { body: { action: "answer", answer: "undo" } })); cycleMenuChanged(user.uid); } finally { setBusy(false); }
  };
  return (
    <section id="privacy" className="mx-auto mt-10 max-w-2xl scroll-mt-6 px-6">
    <h2 className="font-display text-2xl text-ink">Privacy</h2>
    <div className="mt-4 rounded-2xl border border-rule bg-card p-4">
      <p className="font-ui text-sm font-bold text-ink">🌸 My Cycle</p>
      {s.answer === "no" ? (
        <>
          <p className="mt-1 text-sm text-slate">You chose &quot;Not for me&quot;, so My Cycle is hidden from your menu. Only you can see this.</p>
          <button type="button" disabled={busy} onClick={undo} className="btn-ghost mt-3 !py-2 text-sm">Show My Cycle in my menu</button>
        </>
      ) : s.answer === "female" ? (
        <p className="mt-1 text-sm text-slate">My Cycle is set up and locked with your passkey. To download or delete what you&apos;ve logged, open <Link href="/cycle" className="text-crimson underline">My Cycle</Link> → settings.</p>
      ) : (
        <p className="mt-1 text-sm text-slate">A private cycle and wellness companion. <Link href="/my-cycle" className="text-crimson underline">How it works</Link>, or <Link href="/cycle" className="text-crimson underline">open it</Link>.</p>
      )}
    </div>
    </section>
  );
}
