"use client";

import { useState } from "react";

// The receipt's Save as PDF button (the browser's print dialog, as certificates and giving receipts do), and the statement's
// "stop reminders" switch.
export function PrintButton() {
  return <button onClick={() => window.print()} className="rounded-full border border-[#E7DAD3] px-5 py-2.5 text-sm font-semibold text-[#1A1210] hover:border-[#7A0328] print:hidden">Save as PDF</button>;
}
export function StopReminders({ code, off }: { code: string; off: boolean }) {
  const [state, setState] = useState(off);
  const [busy, setBusy] = useState(false);
  const flip = async () => {
    setBusy(true);
    const r = await fetch("/api/books/statement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, off: !state }) }).catch(() => null);
    if (r?.ok) setState(!state);
    setBusy(false);
  };
  return (
    <p className="text-sm text-[#5C534E]">
      {state ? "You've asked not to get reminders about this. " : "Don't want reminders about this? "}
      <button onClick={flip} disabled={busy} className="font-semibold text-[#7A0328] underline">{state ? "Turn reminders back on" : "Stop reminders"}</button>
    </p>
  );
}
