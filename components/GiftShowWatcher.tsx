"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { isGiftMotif } from "@/lib/gift-catalogue";
import { playGift } from "@/lib/gift-play";

// On a member's page: when someone sends them an animated gift, everyone signed in and looking at the page sees it play
// (giftShows/{uid}, written with the payment in lib/payments.ts). Only gifts sent after the page was opened play.
export default function GiftShowWatcher({ uid, toName }: { uid?: string; toName?: string }) {
  useEffect(() => {
    if (!uid) return;
    const opened = Date.now() - 5_000;
    let stop: (() => void) | null = null;
    const off = onAuthStateChanged(auth, (u) => {
      stop?.(); stop = null;
      if (!u) return;
      stop = onSnapshot(doc(db, "giftShows", uid), (s) => {
        const g = s.data();
        if (!g || !isGiftMotif(g.giftId) || !(Date.parse(String(g.at)) > opened)) return;
        playGift({ giftId: g.giftId, name: String(g.name || ""), priceKobo: Number(g.priceKobo) || 0, senderName: g.senderName ? String(g.senderName) : undefined, toName, key: String(g.reference || g.at) });
      }, () => {});
    });
    return () => { off(); stop?.(); };
  }, [uid, toName]);
  return null;
}
