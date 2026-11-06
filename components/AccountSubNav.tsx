"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import SectionNav from "./SectionNav";
import { WALLET_LIVE } from "@/lib/wallet";
import { MEDIA_LIVE } from "@/lib/media-rules";

const LINKS = [
  { href: "/write", label: "My journal" },
  { href: "/profile/edit", label: "Edit profile" },
  ...(MEDIA_LIVE ? [{ href: "/profile/media", label: "Media" }] : []),
  { href: "/profile/publishing", label: "Rates & payouts" },
  { href: "/profile/analytics", label: "Analytics" },
  { href: "/profile/sounds", label: "Sounds" },
  { href: "/profile/media", label: "Media" },
  { href: "/bookings", label: "Bookings" },
  { href: "/profile/books", label: "Business books" },
  { href: "/profile/inventory", label: "Inventory" },
  { href: "/profile/discounts", label: "Discount codes" },
  { href: "/profile/coupons", label: "My coupons" },
  { href: "/profile/referrals", label: "Referrals" },
  { href: "/boost", label: "Boost", exact: true },
  ...(WALLET_LIVE ? [{ href: "/profile/wallet", label: "Wallet" }] : []),
];

export default function AccountSubNav() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => onAuthStateChanged(auth, (u) => setSignedIn(!!u)), []);
  if (!signedIn) return null;
  return <SectionNav title="My account" links={LINKS} fallbackHref="/" />;
}
