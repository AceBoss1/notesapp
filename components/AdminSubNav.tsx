"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { adminAccess } from "@/lib/admin-claims";
import { allowedSections, Access } from "@/lib/admin-access";
import SectionNav from "./SectionNav";

// Only shown to admins, and never on the login page.
export default function AdminSubNav() {
  const pathname = usePathname();
  const [access, setAccess] = useState<Access | null>(null);
  useEffect(() => onAuthStateChanged(auth, async (u) => setAccess(await adminAccess(u))), []);
  if (!access || pathname.startsWith("/admin/login")) return null;
  return <SectionNav title="Admin" links={allowedSections(access).map(({ href, label, exact, group }) => ({ href, label, exact, group }))} fallbackHref="/admin" />;
}
