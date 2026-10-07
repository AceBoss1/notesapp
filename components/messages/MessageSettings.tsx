"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import { currentSubscription, disablePush, enablePush, pushSupported } from "@/lib/push-client";

// How you hear about new messages: a bell (always), an email (on by default, at most one an hour per conversation) and,
// if switched on for this device, a notification. None of them shows what was written.
export default function MessageSettings() {
  const [prefs, setPrefs] = useState<{ emailMessages: boolean; pushAvailable: boolean; vapidKey: string | null } | null>(null);
  const [pushOn, setPushOn] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ emailMessages: boolean; pushAvailable: boolean; vapidKey: string | null }>("/api/messages/prefs").then(setPrefs).catch(() => {});
    currentSubscription().then((s) => setPushOn(!!s)).catch(() => {});
  }, []);
  if (!prefs) return null;

  async function toggleEmail(on: boolean) {
    setError("");
    try { await api("/api/messages/prefs", { body: { emailMessages: on } }); setPrefs({ ...prefs!, emailMessages: on }); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); }
  }
  async function togglePush() {
    setError("");
    try { if (pushOn) { await disablePush(); setPushOn(false); } else { await enablePush(prefs!.vapidKey!); setPushOn(true); } }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't change that."); }
  }

  return (
    <div className="mt-6 space-y-2 border-y border-rule py-4 text-sm">
      <label className="flex items-center gap-2 text-ink"><input type="checkbox" checked={prefs.emailMessages} onChange={(e) => toggleEmail(e.target.checked)} /> Email me when I get a new message</label>
      {prefs.pushAvailable && pushSupported() && (
        <p><button onClick={togglePush} className="rounded border border-rule px-3 py-1.5">{pushOn ? "🔕 Turn off notifications on this device" : "🔔 Turn on notifications on this device"}</button></p>
      )}
      {error && <p className="text-red-700" role="alert">{error}</p>}
    </div>
  );
}
