"use client";

import { usePathname } from "next/navigation";
import { useMember } from "@/lib/member-client";
import { isThreadRoute, usesAppFrame } from "@/lib/chrome";
import AppSidebar from "./AppSidebar";

// Pages in the app frame get the left sidebar on a computer; everything else renders as it is.
export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { appHost } = useMember();
  if (!usesAppFrame(pathname, appHost)) return <>{children}</>;
  return (
    <div className="lg:mx-auto lg:grid lg:max-w-[90rem] lg:grid-cols-[15rem,minmax(0,1fr)] lg:gap-6 lg:px-8 lg:pt-6">
      <AppSidebar />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// The banners and prompts above the masthead step aside in Messages: an open conversation is full screen on a phone, and on a
// computer the list and the conversation fill the window under the masthead.
export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return pathname === "/messages" || pathname.startsWith("/messages/") ? null : <>{children}</>;
}

// The site footer: not on the app address, not in an open conversation on a phone, and on phones members have the tab bar
// and the menu instead (Moda redesign).
export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, appHost } = useMember();
  if (appHost) return null;
  // The feed pages end in the right column's small links on a computer, as in the design.
  if (usesAppFrame(pathname, appHost)) return user ? null : <div className="lg:hidden">{children}</div>;
  if (isThreadRoute(pathname) || user) return <div className="max-lg:hidden">{children}</div>;
  return <>{children}</>;
}
