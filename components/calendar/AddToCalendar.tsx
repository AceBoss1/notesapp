"use client";

import { useState } from "react";
import { MAIN_HOST, SITE_URL } from "@/lib/host";
import { buildIcs, icsFileName, type CalEntry } from "@/lib/my-calendar";
import { addToNativeCalendar } from "@/lib/native-calendar";

// "Add to my calendar" for one entry (My Calendar's agenda, the booking and hotel confirmations, My tickets). Inside the installed app
// with its calendar plugin, the entry goes straight into the phone's calendar; everywhere else an .ics invite downloads, which the
// phone opens in its own default calendar.
export function downloadIcs(entry: CalEntry) {
  const ics = buildIcs([entry], { now: new Date(), host: MAIN_HOST, siteUrl: SITE_URL });
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = icsFileName(entry);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function AddToCalendar({ entry, className = "", small = false }: { entry: CalEntry; className?: string; small?: boolean }) {
  const [done, setDone] = useState<"" | "phone" | "file">("");
  const go = async () => {
    if (await addToNativeCalendar(entry)) return setDone("phone");
    downloadIcs(entry);
    setDone("file");
  };
  const look = small
    ? "inline-flex items-center gap-1.5 rounded-full border border-rule bg-card px-3 py-1.5 text-xs font-semibold text-ink hover:border-crimson"
    : "inline-flex items-center justify-center gap-1.5 rounded-full border border-rule bg-card px-4 py-2.5 text-sm font-bold text-ink hover:border-crimson";
  return (
    <span className={`inline-flex flex-col ${className}`}>
      <button type="button" onClick={go} className={look}><span aria-hidden>📲</span> Add to my calendar</button>
      <span className="mt-1 text-[11px] text-slate" aria-live="polite">{done === "phone" ? "✓ In your phone's calendar" : done === "file" ? "Open the downloaded invite to add it." : ""}</span>
    </span>
  );
}
