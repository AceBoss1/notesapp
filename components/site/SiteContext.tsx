"use client";

import { createContext, useContext } from "react";
import type { SocialLinks } from "@/lib/admin";
import type { SiteThemeId } from "@/lib/site-themes";

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
  home: "profile" | "store"; // which comes first on the Home page
  theme: SiteThemeId; // the look they chose (lib/site-themes.ts)
  isOrg: boolean; // organisations get a rounded-square picture, people a circle
};

const Ctx = createContext<SiteInfo | null>(null);
// A real component (not Ctx.Provider itself): a server layout can't render a context object across the client boundary.
export function SiteProvider({ value, children }: { value: SiteInfo; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useSite(): SiteInfo {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSite() used outside a member site");
  return v;
}
// Like useSite(), but null on the main site (for components shared between the main site and member sites).
export function useSiteOptional(): SiteInfo | null {
  return useContext(Ctx);
}
