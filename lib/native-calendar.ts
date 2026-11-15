"use client";

import { SITE_URL } from "./host";
import type { CalEntry } from "./my-calendar";

// The installed #NotesApp app (Capacitor, mobile/ and docs/MOBILE-APPS.md) can write an entry straight into the phone's default calendar,
// once the app ships with a calendar plugin (the owner step in docs/MY_CALENDAR.md: @ebarooni/capacitor-calendar, registered as
// "CapacitorCalendar"). This is only the web side: it is used when the page runs inside the app AND the plugin is there; anywhere else
// (a browser, or an app release without the plugin) it says no, and "Add to my calendar" downloads the .ics invite instead.
type Permission = { result?: string } | undefined;
type CalendarPlugin = {
  requestWriteOnlyCalendarAccess?: () => Promise<Permission>;
  requestFullCalendarAccess?: () => Promise<Permission>;
  createEvent: (o: { title: string; location?: string; startDate: number; endDate: number; isAllDay?: boolean; url?: string }) => Promise<unknown>;
};
type Cap = { isNativePlatform?: () => boolean; isPluginAvailable?: (name: string) => boolean; Plugins?: Record<string, unknown> };

export function nativeCalendar(): CalendarPlugin | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: Cap }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  if (cap.isPluginAvailable && !cap.isPluginAvailable("CapacitorCalendar")) return null;
  const p = cap.Plugins?.CapacitorCalendar as CalendarPlugin | undefined;
  return p && typeof p.createEvent === "function" ? p : null;
}

// true when the entry went into the phone's calendar; false to fall back to the .ics download (no plugin, permission refused, an error).
export async function addToNativeCalendar(e: CalEntry): Promise<boolean> {
  const cal = nativeCalendar();
  if (!cal) return false;
  try {
    const ask = cal.requestWriteOnlyCalendarAccess ?? cal.requestFullCalendarAccess;
    if (ask) {
      const r = await ask.call(cal);
      if (r?.result && r.result !== "granted") return false;
    }
    await cal.createEvent({ title: e.title, location: e.where || undefined, startDate: Date.parse(e.start), endDate: Date.parse(e.end), isAllDay: !!e.allDay, url: `${SITE_URL}${e.href}` });
    return true;
  } catch {
    return false;
  }
}
