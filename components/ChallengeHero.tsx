"use client";

import { useEffect, useState } from "react";
import { challengePromoActive } from "@/lib/challenge-promo";
import ChallengePanel from "@/components/ChallengePanel";

// Home-page hero for the #1MillionNairaNotesAppChallenge. Appears by itself once the Independence Day hero has expired.
export default function ChallengeHero() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(challengePromoActive()), []);
  if (!show) return null;
  return <ChallengePanel variant="hero" />;
}
