"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

// The call to action that opens the footer on every main page. Signed-out visitors are invited to join; members are invited to write.
export default function FooterCta() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return (
    <div className="border-b border-paper/10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div>
          <h2 className="font-display text-3xl text-paper sm:text-4xl">Publish, connect and get paid in Naira.</h2>
          <p className="mt-2 text-sm text-paper/75">Start free, move up when the numbers say so. Nana AI is there on every page.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {user ? (
            <Link href="/write/new" className="rounded-full bg-paper px-6 py-3 font-ui text-sm font-bold text-crimson-deep hover:opacity-90">Write a journal</Link>
          ) : (
            <Link href="/signup" className="rounded-full bg-paper px-6 py-3 font-ui text-sm font-bold text-crimson-deep hover:opacity-90">Create your free account</Link>
          )}
          <Link href="/nana" className="rounded-full border border-paper/40 px-6 py-3 font-ui text-sm font-bold text-paper hover:bg-paper/10">Ask Nana</Link>
        </div>
      </div>
    </div>
  );
}
