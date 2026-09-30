"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import SectionNav from "./SectionNav";

const LINKS = [
  { href: "/profile/edit", label: "Edit profile" },
  { href: "/profile/publishing", label: "Rates & payouts" },
  { href: "/bookings", label: "Bookings" },
  { href: "/boost", label: "Boost", exact: true },
];

export default function AccountSubNav() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => onAuthStateChanged(auth, (u) => setSignedIn(!!u)), []);
  if (!signedIn) return null;
  return <SectionNav title="My account" links={LINKS} fallbackHref="/" />;
}
