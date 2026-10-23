"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { CHOICE_LABEL, type GraduationChoice } from "@/lib/young";

const off: GraduationChoice = { search: false, messages: false, replies: false, realName: false, offers: false };

// "You're 18 now" (turning 18, lib/young.ts): a one-time screen. Everything stays as it was in teen mode until they switch it on.
export default function EighteenPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [status, setStatus] = useState<{ due: boolean; name: string } | null>(null);
  const [c, setC] = useState(off);
  const [consent, setConsent] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((t) => fetch("/api/young", { headers: { Authorization: `Bearer ${t}` } })).then((r) => r.json()).then(setStatus).catch(() => setStatus({ due: false, name: "" }));
  }, [user]);

  const download = async () => {
    const r = await fetch("/api/young?export=1", { headers: { Authorization: `Bearer ${await user!.getIdToken()}` } });
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a"); a.href = url; a.download = "my-notesapp-data.json"; a.click(); URL.revokeObjectURL(url);
  };
  const save = async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/young", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user!.getIdToken()}` }, body: JSON.stringify({ ...c, consent, deleteChildhood: fresh }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't save that.");
      setDone(true);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  if (user === undefined || (user && !status)) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (done) return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <p className="text-5xl" aria-hidden>🎉</p>
      <h1 className="mt-3 font-display text-4xl text-ink">It&apos;s all yours</h1>
      <p className="mt-2 text-slate">Teen mode has ended and your parent or guardian has been told. You can change any of this later in your account settings.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/pricing" className="rounded-full bg-crimson px-5 py-3 font-ui text-sm font-bold text-paper">Try Pro free for 15 days</Link><Link href="/academy" className="rounded-full border border-rule px-5 py-3 font-ui text-sm font-bold text-ink">Courses for university and a first job</Link></div>
    </div>
  );
  if (!user || !status?.due) return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="font-display text-3xl text-ink">Turning 18</h1><p className="mt-2 text-slate">This screen opens for members in teen mode on their 18th birthday.</p></div>
  );
  return (
    <div className="mx-auto max-w-xl pb-16">
      <div className="bg-[#0F2747] px-5 py-8 text-white sm:rounded-b-3xl">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#C9A227]">Happy birthday 🎉</p>
        <h1 className="mt-1 font-display text-4xl">You&apos;re 18 now{status.name ? `, ${status.name.split(" ")[0]}` : ""}</h1>
        <p className="mt-2 text-sm text-white/80">This account is yours. Teen mode ends today; choose what changes. Everything below is off until you turn it on.</p>
      </div>
      <div className="space-y-4 px-4 pt-5">
        <div className="card space-y-3 p-4">
          {(Object.keys(CHOICE_LABEL) as (keyof GraduationChoice)[]).map((k) => (
            <label key={k} className="flex items-center justify-between gap-3 text-sm text-ink">
              <span>{CHOICE_LABEL[k]}</span>
              <input type="checkbox" role="switch" className="h-5 w-9 shrink-0 accent-[#1E8E5A]" checked={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.checked })} />
            </label>
          ))}
        </div>
        <div className="card p-4">
          <p className="font-bold text-ink">A fresh start, if you want one</p>
          <p className="text-xs text-slate">Your exam progress, scores and certificates stay either way.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded-full border border-rule px-4 py-2 text-xs font-semibold" onClick={download}>Download my data</button>
            <label className="flex items-center gap-2 rounded-full border border-rule px-4 py-2 text-xs font-semibold"><input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} /> Delete my day-by-day practice log</label>
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>I&apos;ve read and agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link> myself. <span className="text-slate">(Your parent or guardian agreed for you until now.)</span></span></label>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <button className="w-full rounded-full bg-[#1E8E5A] py-3 font-ui font-bold text-white disabled:opacity-50" disabled={busy || !consent} onClick={save}>{busy ? "Saving…" : "Make it my account"}</button>
        <p className="text-xs text-slate">We&apos;ll tell your parent or guardian the account is now yours, and remove their email from it. Then, if you&apos;d like to publish, you can try Pro free for 15 days.</p>
      </div>
    </div>
  );
}
