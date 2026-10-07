"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { MESSAGES_LIVE } from "@/lib/moments-rules";

// "Message" on a profile. Hidden while messaging is switched off, and on your own profile.
export default function MessageButton({ username, ownUid, profileUid }: { username: string; ownUid?: string; profileUid?: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => (MESSAGES_LIVE ? onAuthStateChanged(auth, setUser) : undefined), []);
  if (!MESSAGES_LIVE || !user || user.uid === (ownUid ?? profileUid)) return null;
  return <Link href={`/messages/new?to=${encodeURIComponent(username)}`} className="btn-ghost">✉ Message</Link>;
}
