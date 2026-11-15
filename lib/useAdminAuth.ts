"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "./firebase";
import { adminAccess } from "./admin-claims";
import type { Access } from "./admin-access";

export function useAdminAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading
  const [access, setAccess] = useState<Access | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        router.replace("/admin/login");
        return;
      }
      const a = await adminAccess(u);
      if (!a) {
        // Signed in, but not staff: a campus coordinator or ambassador goes to Campus (lib/campus.ts), anyone else home.
        setUser(null);
        const campus = await u.getIdToken().then((t) => fetch("/api/campus?view=me", { headers: { Authorization: `Bearer ${t}` } })).then((r) => r.ok).catch(() => false);
        router.replace(campus ? "/admin/campus" : "/");
        return;
      }
      setAccess(a);
      setUser(u);
    });
    return unsub;
  }, [router]);

  return { user, access, loading: user === undefined };
}
