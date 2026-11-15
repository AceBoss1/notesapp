"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useMember } from "@/lib/member-client";
import { accountGroups, accountPages, whereAmI } from "@/lib/account-nav";
import SideShell from "@/components/shell/SideShell";
import ThemeSwitch from "@/components/theme/ThemeSwitch";
import Link from "next/link";
import { useCampusMe } from "@/lib/campus-client";

// My account's frame (owner, 15 Nov 2026, the Moda "User Dashboard Redesign"): Back to NotesApp, MY ACCOUNT and the groups Profile,
// Money, Store and Growth in a sidebar, with Day / Night / Auto and Sign out at the bottom; "MY ACCOUNT · MONEY" over the page in place
// of the crimson band; on a phone a bar ("My account / Money / Analytics") opening the same menu as a drawer. Signed-in members only:
// a signed-out visitor sees the page as it is (each page asks them to sign in).
export default function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useMember();
  const pages = useMemo(() => accountPages(), []);
  const groups = useMemo(() => accountGroups(pages), [pages]);
  const where = whereAmI(pathname, pages);
  const campus = useCampusMe().me;
  if (!user) return <>{children}</>;
  const footer = (
    <div className="space-y-2">
      {/* Campus coordinators and ambassadors (lib/campus.ts): their tasks and team live in the admin area's Campus pages. */}
      {(campus?.member || campus?.lead) && (
        <Link href="/admin/campus" className="flex h-10 items-center gap-3 rounded-lg bg-crimson-bright/10 px-3 font-ui text-sm font-semibold text-crimson-bright hover:bg-crimson-bright/15">
          <span aria-hidden>🎓</span> Campus team
        </Link>
      )}
      <ThemeSwitch pill />
      <button type="button" onClick={() => signOut(auth)} className="flex h-10 w-full items-center gap-3 rounded-lg px-3 font-ui text-sm font-medium text-ink hover:bg-field">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[18px] w-[18px] text-slate">
          <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H4" />
        </svg>
        Sign out
      </button>
    </div>
  );
  return (
    <SideShell title="My account" crumbTitle pages={pages} groups={groups} active={where.page} crumb={where} label="My account"
      back={{ href: "/journals", label: "Back to NotesApp" }} footer={footer} heading="hero" width="15.5rem"
      eyebrow={where.group ? `My account · ${where.group}` : "My account"}>
      {children}
    </SideShell>
  );
}
