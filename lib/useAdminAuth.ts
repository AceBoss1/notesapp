"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "./firebase";
import { isAdminEmail } from "./admin";

export function useAdminAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setUser(null);
        router.replace("/admin/login");
        return;
      }
      if (!isAdminEmail(u.email)) {
        // signed in, but not one of the two admin accounts — not for them
        setUser(null);
        router.replace("/");
        return;
      }
      setUser(u);
    });
    return unsub;
  }, [router]);

  return { user, loading: user === undefined };
}
