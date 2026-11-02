"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

const BOOKS_APP = "/profile/books";

// The main button on /books: members open their books; visitors sign up first and land in Business books.
export default function BooksCta({ className = "" }: { className?: string }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => onAuthStateChanged(auth, (u) => setSignedIn(!!u)), []);
  const member = signedIn === true;
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <Link href={member ? BOOKS_APP : `/signup?next=${encodeURIComponent(BOOKS_APP)}`} className={className}>
        {member ? "Open Business books" : "Start free"}
      </Link>
      {signedIn === false && (
        <Link href={`/login?next=${encodeURIComponent(BOOKS_APP)}`} className="font-ui text-sm font-semibold underline">
          Already a member? Sign in
        </Link>
      )}
    </span>
  );
}
