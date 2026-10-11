"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useSiteAuth } from "./SiteAuth";
import { useSite } from "./SiteContext";

// Sign in / out on a member's site. On Enterprise domains (full white label) it opens a branded window right here; on Business
// signing in happens on #NotesApp (middleware sends /login there and brings the visitor back, already signed in here).
export default function SiteAccount() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const dark = useSite().theme === "aurora";
  const whiteLabel = useSiteAuth(); // set on Enterprise domains: sign in and sign up open in a window right here
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <span className="w-16" />;
  return user ? (
    <span className={`flex items-center gap-3 font-ui text-xs font-semibold ${dark ? "text-paper" : "text-ink"}`}>
      <span className={`hidden max-w-[8rem] truncate sm:inline ${dark ? "text-paper/75" : "text-slate"}`}>{user.displayName || user.email}</span>
      <button onClick={() => signOut(auth)} className={`underline ${dark ? "hover:text-white" : "hover:text-crimson"}`}>Sign out</button>
    </span>
  ) : whiteLabel ? (
    <span className="flex items-center gap-3 font-ui text-xs font-semibold">
      <button onClick={() => whiteLabel.open("signin")} className={`underline ${dark ? "text-paper hover:text-white" : "text-crimson hover:text-crimson-bright"}`}>Sign in</button>
      <button onClick={() => whiteLabel.open("signup")} className={`hidden rounded-full px-3 py-1.5 sm:inline ${dark ? "bg-paper text-crimson-deep hover:opacity-90" : "bg-crimson text-paper hover:bg-crimson-bright"}`}>Sign up</button>
    </span>
  ) : (
    <Link href="/login" prefetch={false} className={`font-ui text-xs font-semibold underline ${dark ? "text-paper hover:text-white" : "text-crimson hover:text-crimson-bright"}`}>Sign in</Link>
  );
}
