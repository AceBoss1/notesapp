"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isAdminUser } from "@/lib/admin-claims";
import SectionNav from "./SectionNav";

const LINKS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/journals", label: "Journals" },
  { href: "/admin/notes", label: "Notes" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/revenue", label: "Revenue" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/merch", label: "Merch" },
  { href: "/admin/ads", label: "Ads" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/settings", label: "Settings" },
];

// Only shown to admins, and never on the login page.
export default function AdminSubNav() {
  const pathname = usePathname();
  const [ok, setOk] = useState(false);
  useEffect(() => onAuthStateChanged(auth, async (u) => setOk(await isAdminUser(u))), []);
  if (!ok || pathname.startsWith("/admin/login")) return null;
  return <SectionNav title="Admin" links={LINKS} fallbackHref="/admin" />;
}
