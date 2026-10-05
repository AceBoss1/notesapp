"use client";

import { createContext, useContext } from "react";
import type { SocialLinks } from "@/lib/admin";

// What every page of a member's branded site needs to know. `base` is "" on their own domain and
// "/s/<username>" when the same site is previewed on www.notesapp.name.ng.
export type SiteInfo = {
  base: string;
  uid: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  social: SocialLinks;
};

const Ctx = createContext<SiteInfo | null>(null);
export const SiteProvider = Ctx.Provider;
export function useSite(): SiteInfo {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSite() used outside a member site");
  return v;
}
