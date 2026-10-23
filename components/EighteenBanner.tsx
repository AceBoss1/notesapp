"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isKidUid } from "@/lib/kids";

// For a member in teen mode on their 18th birthday: one line at the top, to the "You're 18 now" screen, until they've done it.
export default function EighteenBanner() {
  const path = usePathname();
  const [due, setDue] = useState(false);
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u || isKidUid(u.uid)) { setDue(false); return; }
    try { const r = await fetch("/api/young", { headers: { Authorization: `Bearer ${await u.getIdToken()}` } }); setDue(r.ok && (await r.json()).due === true); } catch { setDue(false); }
  }), []);
  if (!due || path.startsWith("/eighteen")) return null;
  return (
    <div className="bg-[#0F2747] px-4 py-2.5 text-center text-sm text-white">
      🎉 Happy 18th birthday! Your account becomes yours. <Link href="/eighteen" className="font-bold text-[#C9A227] underline">Choose what changes</Link>
    </div>
  );
}
