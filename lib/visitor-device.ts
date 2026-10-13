// Which device, system and browser a visitor is on, from what the browser reports. Used to word the "Download" button and the install steps for them.
// A best guess: phones and tablets are told apart from computers, then the system (Windows, Mac, Linux, iPhone, Android) and the browser.
export type DeviceKind = "phone" | "tablet" | "desktop";
export type OsName = "ios" | "android" | "windows" | "mac" | "linux" | "chromeos" | "other";
export type BrowserName = "chrome" | "edge" | "safari" | "firefox" | "samsung" | "opera" | "brave" | "other";
export type Device = { kind: DeviceKind; os: OsName; browser: BrowserName; inApp: boolean };

export function detectDevice(ua: string, platform = "", maxTouchPoints = 0, brave = false): Device {
  const u = ua || "";
  // iPadOS 13+ reports itself as a Mac; a touch screen gives it away.
  const iPadAsMac = /Macintosh/i.test(u) && maxTouchPoints > 1;
  const os: OsName = /iPhone|iPad|iPod/i.test(u) || iPadAsMac ? "ios" : /Android/i.test(u) ? "android" : /CrOS/i.test(u) ? "chromeos" : /Windows/i.test(u) || /^Win/i.test(platform) ? "windows" : /Macintosh|Mac OS X/i.test(u) ? "mac" : /Linux|X11/i.test(u) ? "linux" : "other";
  const tablet = /iPad/i.test(u) || iPadAsMac || (os === "android" && !/Mobile/i.test(u));
  const kind: DeviceKind = os === "ios" || os === "android" ? (tablet ? "tablet" : "phone") : "desktop";
  // Chat and social apps open links in their own browser, which can't install anything.
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|Twitter|LinkedInApp|WhatsApp|; wv\)/i.test(u);
  const browser: BrowserName = brave ? "brave" : /SamsungBrowser/i.test(u) ? "samsung" : /EdgA?\/|Edg\//i.test(u) ? "edge" : /OPR\/|Opera|OPT\//i.test(u) ? "opera" : /FxiOS|Firefox/i.test(u) ? "firefox" : /CriOS|Chrome|Chromium/i.test(u) ? "chrome" : /Safari/i.test(u) ? "safari" : "other";
  return { kind, os, browser, inApp };
}

export const isMobile = (d: Device) => d.kind !== "desktop";
// The button's wording: "Download on mobile" on a phone or tablet, "Download on PC" on Windows, "Download on Mac", otherwise "Download on desktop".
export function downloadLabel(d: Device | null): string {
  if (!d) return "Download the app";
  if (isMobile(d)) return "Download on mobile";
  return d.os === "windows" ? "Download on PC" : d.os === "mac" ? "Download on Mac" : "Download on desktop";
}
export const downloadIcon = (d: Device | null) => (d && !isMobile(d) ? "💻" : "📱");
