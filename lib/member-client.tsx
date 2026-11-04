"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getUserByUid, type UserProfile } from "@/lib/users";
import { MESSAGES_LIVE } from "@/lib/moments-rules";
import { useIsAppHost } from "@/lib/use-app-host";
import { socialAccount, socialSignInBusy } from "@/lib/social-auth-client";

// Pages someone can open before finishing a Google or LinkedIn account: the sign-in pages themselves and what the Terms point to.
const FINISH_FREE = /^\/(signup|login|forgot-password|terms|privacy|cookies|help|contact|legal)(\/|$)/;

// The signed-in member, read once for the whole frame (header, bottom tabs, sidebar) instead of once per piece.
// `user` is undefined until Firebase has answered, null when signed out.
type Member = { user: User | null | undefined; profile: UserProfile | null; unreadDms: number; appHost: boolean };
const Ctx = createContext<Member>({ user: undefined, profile: null, unreadDms: 0, appHost: false });

export function MemberProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [unreadDms, setUnreadDms] = useState(0);
  const appHost = useIsAppHost();
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    const p = u ? await getUserByUid(u.uid).catch(() => undefined) : null;
    setProfile(p ?? null);
    // Signed in with Google or LinkedIn but the new-account steps (username, Terms, age) aren't done: finish them first.
    if (u && p === null && socialAccount(u) && !socialSignInBusy() && !FINISH_FREE.test(window.location.pathname)) {
      window.location.replace(`/signup?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }), []);
  useEffect(() => {
    if (!MESSAGES_LIVE || !user) { setUnreadDms(0); return; }
    const uid = user.uid;
    return onSnapshot(
      query(collection(db, "conversations"), where("participants", "array-contains", uid)),
      (snap) => setUnreadDms(snap.docs.reduce((n, d) => n + ((d.data().unread?.[uid] as number | undefined) ?? 0), 0)),
      () => {},
    );
  }, [user]);
  return <Ctx.Provider value={{ user, profile, unreadDms, appHost }}>{children}</Ctx.Provider>;
}

export const useMember = () => useContext(Ctx);
