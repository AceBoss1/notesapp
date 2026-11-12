"use client";

import { useState } from "react";
import { useMember } from "@/lib/member-client";

// "Set it up for me" (the Hotel kit): a request that reaches our team in Admin → Leads (lib/hotel-server.ts requestSetup).
export default function HotelSetupForm() {
  const { user, profile } = useMember();
  const [v, setV] = useState({ name: "", email: "", phone: "", hotel: "", city: "", rooms: "", departments: "", note: "" });
  const [state, setState] = useState<"" | "busy" | "done">("");
  const [err, setErr] = useState("");
  const field = "w-full rounded-xl border border-rule bg-white px-3 py-2.5 text-sm text-ink";
  const send = async () => {
    setState("busy"); setErr("");
    try {
      const r = await fetch("/api/public/hotel", { method: "POST", headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {}) }, body: JSON.stringify({ action: "setup", ...v, name: v.name || profile?.displayName, email: v.email || user?.email }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't send that. Try again.");
      setState("done");
    } catch (e) { setErr((e as Error).message); setState(""); }
  };
  if (state === "done") return <div className="card p-6"><p className="font-ui font-bold text-ink">Thank you. We&apos;ve got it.</p><p className="mt-1 text-sm text-slate">Our team will be in touch soon to set up your hotel.</p></div>;
  return (
    <form className="card grid gap-2 p-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <input className={field} placeholder="Your name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-label="Your name" />
      <input className={field} type="email" placeholder={user?.email ?? "Email"} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} aria-label="Email" />
      <input className={field} placeholder="Hotel name" value={v.hotel} onChange={(e) => setV({ ...v, hotel: e.target.value })} aria-label="Hotel name" />
      <input className={field} placeholder="City" value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} aria-label="City" />
      <input className={field} placeholder="Phone" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} aria-label="Phone" />
      <input className={field} placeholder="How many rooms" inputMode="numeric" value={v.rooms} onChange={(e) => setV({ ...v, rooms: e.target.value.replace(/\D/g, "") })} aria-label="How many rooms" />
      <input className={`${field} sm:col-span-2`} placeholder="Departments (restaurant, bar, lounge…)" value={v.departments} onChange={(e) => setV({ ...v, departments: e.target.value })} aria-label="Departments" />
      <textarea className={`${field} sm:col-span-2`} rows={3} placeholder="Anything else we should know" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} aria-label="Anything else" />
      {err && <p className="text-sm text-crimson sm:col-span-2" role="alert">{err}</p>}
      <button disabled={state === "busy"} className="rounded-full bg-crimson px-5 py-3 font-ui text-sm font-bold text-paper disabled:opacity-50 sm:col-span-2">Send to the #NotesApp team</button>
    </form>
  );
}
