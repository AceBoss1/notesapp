import { api } from "./moments-client";

// Browser side of web push: register the service worker, ask permission, subscribe, and tell the server.
const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush(vapidKey: string): Promise<void> {
  if (!pushSupported()) throw new Error("This browser can't receive notifications.");
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications are blocked for this site in your browser settings.");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(vapidKey) }));
  await api("/api/push", { body: { subscription: sub.toJSON() } });
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await api("/api/push", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}

// What this device's owner chose, remembered on the device (a subscription belongs to one browser): "off" once they turn notifications off
// themselves, so we never turn them back on; "later:<time>" when they dismissed the offer, which comes back after a week.
const CHOICE_KEY = "notesapp-push-choice";
const WEEK_MS = 7 * 24 * 3600 * 1000;
export function pushChoiceBlocks(now = Date.now()): boolean {
  try {
    const v = localStorage.getItem(CHOICE_KEY);
    if (v === "off") return true;
    if (v?.startsWith("later:")) return now - Number(v.slice(6)) < WEEK_MS;
  } catch { /* storage unavailable: treat as no choice */ }
  return false;
}
export function setPushChoice(v: "off" | "later" | null): void {
  try {
    if (v === null) localStorage.removeItem(CHOICE_KEY);
    else localStorage.setItem(CHOICE_KEY, v === "off" ? "off" : `later:${Date.now()}`);
  } catch { /* ignore */ }
}
