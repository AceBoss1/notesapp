"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "./firebase";
import { getUserByUid, UserProfile } from "./users";

// The signed-in member and their profile, for the /write pages.
// `profile === undefined` while loading; redirects to /login if signed out.
export function useSelfPublisher() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        if (!u) return router.replace("/login");
        setUser(u);
        setProfile(await getUserByUid(u.uid));
      }),
    [router]
  );
  return { user, profile, setProfile };
}
