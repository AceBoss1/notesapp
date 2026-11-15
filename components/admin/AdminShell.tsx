"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { adminAccess } from "@/lib/admin-claims";
import { GROUP_ORDER, activeSection, allowedSections, groupSections, type Access } from "@/lib/admin-access";
import SideShell from "@/components/shell/SideShell";
import { useCampusMe } from "@/lib/campus-client";
import { campusPages } from "@/lib/campus";

// The admin area's frame (owner, 15 Nov 2026, the Moda "Admin Dashboard Redesign"): Back to site, "Jump to a page" and the menu groups
// in a sidebar, "ADMIN · <GROUP>" over the page, and on a phone a bar ("People & Trust / Throwaway emails") opening the menu as a drawer
// (components/shell/SideShell.tsx). Only staff see it, and only the pages their role covers; never on the login page. Campus coordinators
// and ambassadors who aren't staff see it with the Campus pages only.
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [access, setAccess] = useState<Access | null>(null);
  useEffect(() => onAuthStateChanged(auth, async (u) => setAccess(await adminAccess(u))), []);
  // Campus: coordinators and ambassadors (who may not be staff at all) and the programme's leads get its pages (lib/campus.ts).
  const { me } = useCampusMe();
  const sections = useMemo(() => {
    const campus = campusPages({ lead: !!me?.lead, role: me?.member?.role ?? null }).map((p) => ({ ...p, need: "all" as const, exact: p.href === "/admin/campus" }));
    return [...allowedSections(access), ...campus].sort((x, y) => GROUP_ORDER.indexOf(x.group) - GROUP_ORDER.indexOf(y.group));
  }, [access, me]);
  const groups = useMemo(() => groupSections(sections), [sections]);
  const active = activeSection(sections, pathname);
  if ((!access && !me?.member) || pathname.startsWith("/admin/login")) return <>{children}</>;
  return (
    <SideShell title="Admin" pages={sections} groups={groups} active={active} back={{ href: "/", label: "Back to site" }} search
      eyebrow={active ? `Admin · ${active.group}` : undefined}>
      {children}
    </SideShell>
  );
}
