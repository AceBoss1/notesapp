"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signInWithCustomToken, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ALLOW_LABEL, DEFAULT_PLAY, MAX_KIDS, PLAY_MINUTES, isKidUid, type KidAllow, type KidProfile } from "@/lib/kids";
import { MONTHS, ageOn } from "@/lib/young";

const field = "mt-1 block w-full rounded-xl border border-rule bg-card px-3 py-2.5 text-sm";
const btn = "rounded-full bg-crimson px-5 py-3 font-ui text-sm font-bold text-paper hover:bg-crimson-bright disabled:opacity-50";
const ghost = "rounded-full border border-rule bg-card px-4 py-2 font-ui text-xs font-semibold text-ink hover:border-crimson disabled:opacity-50";
const blank = { nickname: "", birthMonth: "", birthYear: "", pin: "", allow: { prep: true, academy: true, reading: false, life: false } as KidAllow, playMinutes: DEFAULT_PLAY, consent: false };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

function Switch({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 text-sm text-ink">
      <span>{label}{sub && <span className="block text-xs text-slate">{sub}</span>}</span>
      <input type="checkbox" role="switch" className="h-5 w-9 shrink-0 accent-[#1E8E5A]" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

// My account → Family (kids mode, lib/kids.ts): a parent adds child profiles under 13, chooses what each may use, and opens one
// on this device. The child never has a login; getting back here takes the parent's PIN.
export default function FamilyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [kids, setKids] = useState<KidProfile[] | null>(null);
  const [form, setForm] = useState(blank);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const call = useCallback(async (body?: Record<string, unknown>) => {
    const r = await fetch("/api/kids", body ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user!.getIdToken()}` }, body: JSON.stringify(body) } : { headers: { Authorization: `Bearer ${await user!.getIdToken()}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  }, [user]);
  const load = useCallback(() => call().then((d) => setKids(d.kids ?? [])).catch((e) => setError(e.message)), [call]);
  useEffect(() => { if (user && !isKidUid(user.uid)) void load(); }, [user, load]);

  const run = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setError(""); setNote("");
    try { const r = await call(body); setNote(ok); await load(); return r; } catch (e) { setError((e as Error).message); return null; } finally { setBusy(false); }
  };
  const open = async (k: KidProfile) => {
    setBusy(true); setError("");
    try { const r = await call({ action: "enter", id: k.id }); await signInWithCustomToken(auth, r.token); router.push("/kids"); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  };

  if (user === undefined) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (!user) return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="font-display text-3xl text-ink">Family</h1><p className="mt-2 text-slate">Sign in to add a child profile.</p></div>;
  if (isKidUid(user.uid)) return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="font-display text-3xl text-ink">Family</h1><p className="mt-2 text-slate">This is a child profile. Go back to the parent&apos;s account first.</p></div>;
  const year = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson">My account · Family</p>
      <h1 className="mt-1 font-display text-4xl text-ink">Child profiles</h1>
      <p className="mt-2 text-sm text-slate">For children under 13. The account stays yours: each child gets a profile on it that you open on your device. They never have a login, and getting back to your account takes the PIN you set. They never get messages, moments, comments, a public profile, or anything to buy.</p>
      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mt-4 text-sm text-green-700" role="status">{note}</p>}

      <ul className="mt-6 space-y-3">
        {kids?.map((k) => (
          <li key={k.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-display text-2xl text-ink">{k.nickname}</p><p className="text-xs text-slate">Age {ageOn(k.birth, today())} · {Object.entries(k.allow).filter(([, v]) => v).map(([a]) => ALLOW_LABEL[a as keyof KidAllow]).join(" · ") || "Nothing switched on"}{k.allow.life ? ` · ${k.playMinutes} min of Notes Life a day` : ""}</p></div>
              <button className={btn} disabled={busy} onClick={() => open(k)}>Open {k.nickname}&apos;s profile</button>
            </div>
            <div className="mt-3 border-t border-rule pt-2">
              {(Object.keys(ALLOW_LABEL) as (keyof KidAllow)[]).map((a) => <Switch key={a} on={k.allow[a]} label={ALLOW_LABEL[a]} sub={a === "life" ? "Only Notesville's residents: no real players, no invites, no Bonus Credits" : undefined} onChange={(v) => run({ action: "update", id: k.id, allow: { ...k.allow, [a]: v } }, "Saved.")} />)}
              {k.allow.life && <label className="flex items-center justify-between py-1.5 text-sm">Play time a day<select className="rounded-lg border border-rule px-2 py-1 text-sm" value={k.playMinutes} onChange={(e) => run({ action: "update", id: k.id, playMinutes: Number(e.target.value) }, "Saved.")}>{PLAY_MINUTES.map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>}
              <div className="mt-2 flex flex-wrap gap-2">
                <button className={ghost} disabled={busy} onClick={() => { const p = prompt(`A new 4-digit PIN for ${k.nickname}'s profile`); if (p) void run({ action: "update", id: k.id, pin: p }, "PIN changed."); }}>Change PIN</button>
                <button className={ghost} disabled={busy} onClick={() => { if (confirm(`Delete ${k.nickname}'s profile and everything in it (practice, progress, Notes Life)? This can't be undone.`)) void run({ action: "remove", id: k.id }, "Deleted, with everything in it."); }}>Delete profile</button>
              </div>
            </div>
          </li>
        ))}
        {kids?.length === 0 && !adding && <li className="rounded-2xl border border-dashed border-rule p-5 text-sm text-slate">No child profiles yet.</li>}
      </ul>

      {kids && kids.length < MAX_KIDS && (!adding ? <button className={`${btn} mt-5`} onClick={() => setAdding(true)}>Add a child under 13</button> : (
        <form className="card mt-5 space-y-3 p-5" onSubmit={async (e) => { e.preventDefault(); const r = await run({ action: "add", ...form }, `${form.nickname}'s profile is ready.`); if (r) { setForm(blank); setAdding(false); } }}>
          <p className="font-display text-2xl text-ink">Add a child under 13</p>
          <label className="block text-xs font-bold text-ink">Nickname<input className={field} required value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="Ada-Star" /></label>
          <div>
            <p className="text-xs font-bold text-ink">Born <span className="font-normal text-slate">(month and year, never shown)</span></p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <select className={field} required value={form.birthMonth} onChange={(e) => setForm({ ...form, birthMonth: e.target.value })} aria-label="Month born"><option value="">Month</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
              <select className={field} required value={form.birthYear} onChange={(e) => setForm({ ...form, birthYear: e.target.value })} aria-label="Year born"><option value="">Year</option>{Array.from({ length: 11 }, (_, i) => year - 3 - i).map((y) => <option key={y} value={y}>{y}</option>)}</select>
            </div>
          </div>
          <label className="block text-xs font-bold text-ink">Your PIN to leave their profile <span className="font-normal text-slate">(4 digits)</span><input className={field} required inputMode="numeric" type="password" autoComplete="new-password" maxLength={4} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })} /></label>
          <div>
            <p className="text-xs font-bold text-ink">What they can use</p>
            {(Object.keys(ALLOW_LABEL) as (keyof KidAllow)[]).map((a) => <Switch key={a} on={form.allow[a]} label={ALLOW_LABEL[a]} sub={a === "life" ? "Only Notesville's residents: no real players, no invites, no Bonus Credits" : undefined} onChange={(v) => setForm({ ...form, allow: { ...form.allow, [a]: v } })} />)}
            {form.allow.life && <label className="flex items-center justify-between py-1.5 text-sm">Play time a day<select className="rounded-lg border border-rule px-2 py-1 text-sm" value={form.playMinutes} onChange={(e) => setForm({ ...form, playMinutes: Number(e.target.value) })}>{PLAY_MINUTES.map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>}
            <p className="flex justify-between py-1.5 text-sm text-slate"><span>Messages, moments, comments, a public profile, buying</span><span className="text-xs">never</span></p>
          </div>
          <label className="flex items-start gap-2 text-xs text-ink"><input type="checkbox" className="mt-0.5" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} /> I&apos;m their parent or guardian and I consent to NotesApp keeping their practice progress. I can delete their profile and everything in it at any time.</label>
          <div className="flex gap-2"><button className={btn} disabled={busy}>Add {form.nickname || "them"}</button><button type="button" className={ghost} onClick={() => setAdding(false)}>Cancel</button></div>
        </form>
      ))}
      <div className="card mt-6 p-4 text-sm"><p className="font-bold text-ink">Each week you get</p><p className="text-slate">An email on Sunday evening: what each child practised on Naija Exam Prep, scores by topic, and any mock exams.</p></div>
    </div>
  );
}
