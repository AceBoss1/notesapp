"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isKidUid } from "@/lib/kids";

// Hides what isn't for a child profile (kids mode): the prompts, offers and Nana's chat around the site.
export default function AdultOnly({ children }: { children: React.ReactNode }) {
  const [kid, setKid] = useState(false);
  useEffect(() => onAuthStateChanged(auth, (u) => setKid(!!u && isKidUid(u.uid))), []);
  return kid ? null : <>{children}</>;
}
