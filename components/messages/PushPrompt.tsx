"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import { MESSAGES_LIVE } from "@/lib/moments-rules";
import { currentSubscription, enablePush, pushChoiceBlocks, pushSupported, setPushChoice } from "@/lib/push-client";

// Device notifications are on unless you say otherwise. A browser only lets a site turn them on with the person's say-so, so: if this
// device has already allowed notifications we simply subscribe it (nothing to click); if it hasn't been asked, a one-line offer appears
// (Turn on / Not now, which asks again in a week). Turning them off in Messages is remembered and never undone.
export default function PushPrompt() {
  const [offer, setOffer] = useState<string | null>(null); // the VAPID key, when an offer should show
  const [error, setError] = useState("");
  useEffect(() => {
    if (!MESSAGES_LIVE || !pushSupported()) return;
    return onAuthStateChanged(auth, async (u) => {
      setOffer(null);
      if (!u || pushChoiceBlocks() || Notification.permission === "denied") return;
      try {
        const prefs = await api<{ pushAvailable: boolean; vapidKey: string | null }>("/api/messages/prefs");
        if (!prefs.pushAvailable || !prefs.vapidKey || (await currentSubscription())) return;
        if (Notification.permission === "granted") await enablePush(prefs.vapidKey);
        else setOffer(prefs.vapidKey);
      } catch { /* not offered right now */ }
    });
  }, []);
  if (!offer) return null;
  return (
    <div className="border-b border-rule bg-card px-4 py-2 text-center text-sm text-ink" role="region" aria-label="Notifications">
      🔔 Get a notification on this device when someone messages you or replies to your moment.{" "}
      <button
        onClick={async () => { setError(""); try { await enablePush(offer); setOffer(null); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't turn them on."); } }}
        className="ml-1 rounded-full bg-crimson px-3 py-0.5 text-xs font-bold text-white"
      >Turn on</button>
      <button onClick={() => { setPushChoice("later"); setOffer(null); }} className="ml-2 text-xs text-slate underline">Not now</button>
      {error && <span className="ml-2 text-xs text-red-700" role="alert">{error}</span>}
    </div>
  );
}
