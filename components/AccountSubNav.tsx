"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import SectionNav from "./SectionNav";
import { WALLET_LIVE } from "@/lib/wallet";

const LINKS = [
  { href: "/write", label: "My journal" },
  { href: "/profile/edit", label: "Edit profile" },
  { href: "/profile/publishing", label: "Rates & payouts" },
  { href: "/bookings", label: "Bookings" },
  { href: "/profile/inventory", label: "Inventory" },
  { href: "/boost", label: "Boost", exact: true },
  ...(WALLET_LIVE ? [{ href: "/profile/wallet", label: "Wallet" }] : []),
];

export default function AccountSubNav() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => onAuthStateChanged(auth, (u) => setSignedIn(!!u)), []);
  if (!signedIn) return null;
  return <SectionNav title="My account" links={LINKS} fallbackHref="/" />;
}
