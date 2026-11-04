"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AUDIENCE_LABEL, TIER_NAME, canSee, tierOf, type Audience, type SubTier } from "@/lib/fans";
import SubscribeButton from "./SubscribeButton";

export default function PremiumGate({
  premium,
  audience: aud,
  authorUsername,
  authorName,
  contentHtml,
}: {
  premium: boolean;
  audience?: Audience; // the lowest tier that can read it (lib/fans.ts); Premium when only premium is set
  authorUsername: string;
  authorName: string;
  contentHtml: string;
}) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const audience: Audience = !premium ? "everyone" : aud && aud !== "everyone" ? aud : "premium";
  const [unlocked, setUnlocked] = useState(!premium);
  const [have, setHave] = useState<SubTier | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!premium) return;
    if (!user) {
      setUnlocked(false);
      return;
    }
    getDoc(doc(db, "subscriptions", `${user.uid}_${authorUsername}`)).then((snap) => {
      const s = snap.data();
      const active = !!s && (s.status === "demo" || (!!s.currentPeriodEnd && Date.parse(String(s.currentPeriodEnd)) > Date.now()));
      const tier = active ? tierOf(s) : null;
      setHave(tier);
      setUnlocked(canSee(audience, tier));
    }).catch(() => setUnlocked(false));
  }, [user, premium, authorUsername, audience]);

  const prose =
    "prose prose-lg max-w-none font-body text-ink prose-headings:font-display prose-a:text-crimson-bright";

  if (!premium || unlocked) {
    return <div className={`mt-10 ${prose}`} dangerouslySetInnerHTML={{ __html: contentHtml }} />;
  }

  return (
    <div className="mt-10">
      <div className="relative">
        <div
          className={`${prose} max-h-56 overflow-hidden`}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-paper to-transparent" />
      </div>
      <div className="card mt-2 p-8 text-center">
        <p className="font-display text-xl text-ink">
          🔒 This entry is for {authorName.split(" ")[0]}&apos;s {audience === "premium" ? "subscribers" : `${TIER_NAME[audience as SubTier]}${audience === "vvip" ? "" : " and up"} subscribers`}
        </p>
        <p className="mt-2 text-sm text-slate">
          {have ? `You're ${TIER_NAME[have]}: switch to ${AUDIENCE_LABEL[audience].replace(" and up", "")} or above to read it.` : "Subscribe to unlock their entries for your tier."}
        </p>
        <div className="mt-5 flex justify-center">
          <SubscribeButton username={authorUsername} creatorName={authorName} />
        </div>
      </div>
    </div>
  );
}
