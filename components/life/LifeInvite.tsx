"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

// The invite (?ref=username) is read in the browser, so the Notes Life page itself can be cached and served to everyone.
const useInvite = () => {
  const r = useSearchParams().get("ref") ?? "";
  return /^[a-z0-9_.-]{1,40}$/i.test(r) ? r : "";
};

function Play({ play, className }: { play: string; className: string }) {
  const ref = useInvite();
  return <a href={ref ? `${play}?ref=${encodeURIComponent(ref)}` : play} className={className}>▶ Play now, free</a>;
}

function Note({ children }: { children: React.ReactNode }) {
  const ref = useInvite();
  return <>{ref ? <>@{ref} invited you. Finish your first shift and you both get ₦250 NotesApp Bonus Credit.</> : children}</>;
}

export function PlayLink({ play, className }: { play: string; className: string }) {
  return <Suspense fallback={<a href={play} className={className}>▶ Play now, free</a>}><Play play={play} className={className} /></Suspense>;
}

export function InviteNote({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={children}><Note>{children}</Note></Suspense>;
}
