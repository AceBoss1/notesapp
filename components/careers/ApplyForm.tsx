"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

// Applying for a role with your NotesApp account (lib/careers-server.ts apply): a short note, links, optional phone and city, and consent.
export default function ApplyForm({ roleId, roleTitle, consentText, futureText }: { roleId: string; roleTitle: string; consentText: string; futureText: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [coverNote, setCoverNote] = useState("");
  const [links, setLinks] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [consent, setConsent] = useState(false);
  const [futureRoles, setFutureRoles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const field = "mt-1 block w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";

  if (user === undefined) return <p className="mt-4 text-sm text-slate">Loading…</p>;
  if (!user) {
    const next = encodeURIComponent(`/careers/${roleId}`);
    return (
      <div className="mt-4 text-sm text-ink">
        <p>You apply with your NotesApp account, so we can reply to you here and see your public profile if you choose to share it.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/login?next=${next}`} className="rounded-full bg-crimson px-5 py-2 font-ui text-sm font-semibold text-paper">Sign in to apply</Link>
          <Link href={`/signup?next=${next}`} className="rounded-full border border-rule px-5 py-2 font-ui text-sm font-semibold">Create an account</Link>
        </div>
      </div>
    );
  }
  if (done) return <p className="mt-4 text-sm text-green-700" role="status">Thank you. Your application for {roleTitle} is in. A person reads every application, and we&apos;ll tell you either way in your NotesApp notifications.</p>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/careers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user!.getIdToken()}` },
        body: JSON.stringify({ roleId, coverNote, links: links.split("\n"), phone, city, consent, futureRoles }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't send your application");
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't send your application"); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 text-sm">
      <label>Why this role, and what would you bring to it?<textarea required rows={7} minLength={40} maxLength={4000} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} className={field} /></label>
      <label>Links to your work (one per line, https)<textarea rows={3} value={links} onChange={(e) => setLinks(e.target.value)} className={field} placeholder="https://www.linkedin.com/in/…" /></label>
      <label>Phone (optional)<input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} /></label>
      <label>City (optional)<input value={city} onChange={(e) => setCity(e.target.value)} className={field} /></label>
      <label className="flex items-start gap-2 text-xs text-slate"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" required /> <span>{consentText}</span></label>
      <label className="flex items-start gap-2 text-xs text-slate"><input type="checkbox" checked={futureRoles} onChange={(e) => setFutureRoles(e.target.checked)} className="mt-0.5" /> <span>{futureText}</span></label>
      {error && <p className="text-red-700" role="alert">{error}</p>}
      <button disabled={busy || !consent} className="rounded-full bg-crimson px-5 py-2 font-ui text-sm font-semibold text-paper disabled:opacity-50">{busy ? "Sending…" : "Send my application"}</button>
    </form>
  );
}
