"use client";

import { createContext, useContext } from "react";
import { MAIN_HOST, isMainHost } from "@/lib/host";

// Where a community is being shown (owner, 22 Oct 2026: "communities should … reflect on the user domain if they have"): on #NotesApp at
// /c/<id>, or inside the member's own site at <base>/community, on their own domain too. `path` is the community's own address there (its tabs stay on it).
export type CommunityPlace = { path: string };
const Ctx = createContext<CommunityPlace | null>(null);
// A real component (not Ctx.Provider itself), so a server page can render it.
export function CommunityPlaceProvider({ value, children }: { value: CommunityPlace; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useCommunityPlace(cid: string): CommunityPlace {
  return useContext(Ctx) ?? { path: `/c/${cid}` };
}
// On a member's own domain (not one of ours): links to the rest of #NotesApp (a profile, Messages) go to the main site, and the community's
// own links (invite, share) go to its page on that domain. Only ever called in the browser, after the community has loaded.
const onOwnDomain = () => typeof window !== "undefined" && !isMainHost(window.location.hostname);
export const mainHref = (path: string) => (onOwnDomain() ? `https://${MAIN_HOST}${path}` : path);
export const communityUrl = (cid: string, rest = "") => `${window.location.origin}${onOwnDomain() ? "/community" : `/c/${cid}`}${rest}`;
