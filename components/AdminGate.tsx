"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { adminAccess } from "@/lib/admin-claims";
import { Access, allowedSections, pathAllowed } from "@/lib/admin-access";

// Keeps staff out of pages their role doesn't cover. UI only: the API routes and
// Firestore rules enforce the same thing, so this just spares people a page of errors.
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<{ ready: boolean; access: Access | null }>({ ready: false, access: null });
  useEffect(() => onAuthStateChanged(auth, async (u) => setState({ ready: true, access: await adminAccess(u) })), []);

  // Signed-out or non-staff visitors are handled by each page's own redirect.
  if (!state.ready || !state.access || pathAllowed(state.access, pathname)) return <>{children}</>;
  const first = allowedSections(state.access).find((s) => s.href !== "/admin");
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-ink">This area isn&apos;t part of your role</h1>
      <p className="mt-3 font-ui text-sm text-muted">Your access covers specific departments. Ask a super admin if you need this page.</p>
      <div className="mt-6 flex justify-center gap-3 font-ui text-sm">
        <Link href="/admin" className="rounded-full bg-crimson px-4 py-2 font-semibold text-white">Dashboard</Link>
        {first && <Link href={first.href} className="rounded-full border border-rule px-4 py-2 font-semibold text-ink">{first.label}</Link>}
      </div>
    </main>
  );
}
