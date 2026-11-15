"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import SectionNav from "./SectionNav";
import { WALLET_LIVE } from "@/lib/wallet";
import { MEDIA_LIVE } from "@/lib/media-rules";
import { accountSubNav } from "@/lib/account-menu";

// The "My account" bar: grouped behind a drop-down each (lib/account-menu.ts).
const LINKS = accountSubNav({ media: MEDIA_LIVE, wallet: WALLET_LIVE });

export default function AccountSubNav() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => onAuthStateChanged(auth, (u) => setSignedIn(!!u)), []);
  if (!signedIn) return null;
  return <SectionNav title="My account" links={LINKS} fallbackHref="/" />;
}
