"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { OrgInvite } from "./org";

export type Membership = { uid: string; username: string; displayName: string; avatar: string; accountTier: string; role: "admin" | "writer"; canPublish: boolean };

// Organisations the signed-in member writes for, and invitations waiting for them.
// `orgs === undefined` while loading; failures just mean "none".
export function useMemberships(user: User | null) {
  const [orgs, setOrgs] = useState<Membership[] | undefined>(undefined);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  useEffect(() => {
    if (!user) return;
    let live = true;
    user
      .getIdToken()
      .then((t) => fetch("/api/org/team?mine=1", { headers: { Authorization: `Bearer ${t}` } }))
      .then((r) => (r.ok ? r.json() : { orgs: [], invites: [] }))
      .then((j) => {
        if (!live) return;
        setOrgs(j.orgs || []);
        setInvites(j.invites || []);
      })
      .catch(() => live && setOrgs([]));
    return () => {
      live = false;
    };
  }, [user]);
  return { orgs, invites };
}
