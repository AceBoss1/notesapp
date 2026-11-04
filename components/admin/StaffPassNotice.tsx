"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { passNotice, type StaffPass } from "@/lib/staff-pass";

// A strip across the admin area while the staff test pass is on (lib/staff-pass.ts), so nobody forgets it. Super admins only: the
// gate renders it only for them, and the API answers nobody else.
export default function StaffPassNotice() {
  const [text, setText] = useState("");
  useEffect(() => {
    let gone = false;
    (async () => {
      const u = auth.currentUser;
      if (!u) return;
      const r = await fetch("/api/admin/staff-pass", { headers: { Authorization: `Bearer ${await u.getIdToken()}` } }).catch(() => null);
      if (!r?.ok || gone) return;
      const j = (await r.json().catch(() => null)) as { pass?: StaffPass } | null;
      if (j?.pass && !gone) setText(passNotice(j.pass));
    })();
    return () => { gone = true; };
  }, []);
  if (!text) return null;
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center font-ui text-sm text-amber-900" role="status">
      {text}: team accounts skip live limits. <Link href="/admin/limits#staff-pass" className="font-semibold underline">Change or turn off</Link>
    </div>
  );
}
