"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  AGREE_TEXT, APP_STATUS_LABEL, LIMITS, OPEN_APP, PORTAL_PATH, SERVICES, SERVICE_LABEL, TRACK, TRACKS, partnerPath,
  type MyApplication, type Service, type Track,
} from "@/lib/partner-network";
import { partnersCall } from "./partners-client";

// Apply to the NotesApp Partner Network (lib/partner-network-server.ts applyPartner), with the member's own applications below. Signed in
// only; the API checks everything again (18 and over, verified email, one open application a track, three at most).
type Mine = { applications: MyApplication[]; partners: { id: string; name: string; track: Track }[]; memberships: unknown[] };
const field = "mt-1 block w-full rounded-xl border border-rule bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-crimson";
const label = "block text-sm font-semibold text-ink";
const hint = "mt-1 text-xs font-normal text-slate";
const EMPTY = { track: "" as Track | "", orgName: "", website: "", countries: "", reach: "", about: "", plan: "", services: [] as Service[], agree: false };

export default function PartnerApplyForm({ initialTrack }: { initialTrack?: Track }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [mine, setMine] = useState<Mine | null>(null);
  const [f, setF] = useState<typeof EMPTY>({ ...EMPTY, track: initialTrack ?? "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const load = (u: User) => partnersCall<{ mine: Mine }>(u, "/api/partners", "GET").then((j) => setMine(j.mine)).catch(() => setMine(null));
  useEffect(() => { if (user) void load(user); }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  // A track chosen on the page (the "Apply for this track" links) fills the form.
  useEffect(() => {
    const pick = () => {
      const t = new URLSearchParams(window.location.search).get("track") ?? window.location.hash.replace(/^#apply-/, "");
      if (!TRACKS.includes(t as Track)) return;
      setF((x) => ({ ...x, track: t as Track }));
      if (window.location.hash.startsWith("#apply-")) document.getElementById("apply")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    pick(); window.addEventListener("hashchange", pick); return () => window.removeEventListener("hashchange", pick);
  }, []);

  if (user === undefined) return <p className="text-sm text-slate">Loading…</p>;
  if (!user) return (
    <div className="rounded-[22px] border border-rule bg-card p-6">
      <p className="text-ink">Sign in to apply. You apply with your own NotesApp account, for yourself or for an organisation you represent.</p>
      <p className="mt-4 flex flex-wrap gap-3"><Link href="/login?next=/partners%23apply" className="rounded-full bg-crimson px-5 py-2.5 font-ui text-sm font-bold text-paper">Sign in</Link><Link href="/signup?next=/partners%23apply" className="rounded-full border border-rule px-5 py-2.5 font-ui text-sm font-semibold text-ink">Create an account</Link></p>
    </div>
  );
  const t = f.track ? TRACK[f.track] : null;
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });
  const toggle = (s: Service) => setF({ ...f, services: f.services.includes(s) ? f.services.filter((x) => x !== s) : [...f.services, s] });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await partnersCall(user!, "/api/partners", "POST", { action: "apply", ...f, reach: Number(f.reach) });
      setF(EMPTY);
      setMsg({ ok: true, text: "Your application is in. A person on the partnerships team reviews every one; we'll tell you in your NotesApp notifications." });
      await load(user!);
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't send your application." }); }
    finally { setBusy(false); }
  }
  const withdraw = async (id: string) => {
    if (!confirm("Withdraw this application?")) return;
    try { await partnersCall(user!, "/api/partners", "POST", { action: "withdraw", id }); await load(user!); } catch (err) { alert(err instanceof Error ? err.message : "Couldn't withdraw it."); }
  };

  return (
    <div className="space-y-8">
      {mine && (mine.partners.length > 0 || mine.applications.length > 0) && (
        <div id="mine" className="scroll-mt-24 rounded-[22px] border border-rule bg-card p-5">
          <p className="font-ui text-sm font-bold text-ink">Your partnerships</p>
          {mine.partners.length > 0 && <p className="mt-2 text-sm text-ink">You run {mine.partners.map((p, i) => <span key={p.id}>{i ? ", " : ""}<Link href={partnerPath(p.id)} className="text-crimson underline">{p.name}</Link></span>)}. <Link href={PORTAL_PATH} className="font-semibold text-crimson underline">Open your partner portal</Link></p>}
          <ul className="mt-3 space-y-2 text-sm">
            {mine.applications.map((a) => (
              <li key={a.id} className="rounded-xl bg-field/60 p-3">
                <p className="text-ink"><b>{a.orgName}</b> · {TRACK[a.track].label} · {a.createdAt.slice(0, 10)}</p>
                <p className="mt-0.5 text-xs font-semibold text-slate">{APP_STATUS_LABEL[a.status]}</p>
                {a.feedback && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-card p-2 text-xs text-ink"><b>From the partnerships team:</b> {a.feedback}</p>}
                {OPEN_APP.includes(a.status) && <button type="button" onClick={() => void withdraw(a.id)} className="mt-2 text-xs text-crimson underline">Withdraw</button>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <label className={label}>Partner track
          <select required value={f.track} onChange={set("track")} className={field}>
            <option value="">Choose a track…</option>
            {TRACKS.map((k) => <option key={k} value={k}>{TRACK[k].emoji} {TRACK[k].label}</option>)}
          </select>
          {t && <span className={hint + " block"}>{t.who}</span>}
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={label}>{f.track === "chapters" ? "Your chapter's name" : "Your organisation's name"}
            <input required maxLength={LIMITS.orgName} value={f.orgName} onChange={set("orgName")} className={field} placeholder={f.track === "chapters" ? "NotesApp UNILAG" : f.track === "solutions" ? "Your agency, or your own name" : ""} />
          </label>
          <label className={label}>Website{f.track === "solutions" || f.track === "chapters" ? " (optional)" : ""}
            <input type="url" maxLength={LIMITS.website} value={f.website} onChange={set("website")} className={field} placeholder="https://" required={!!f.track && f.track !== "solutions" && f.track !== "chapters"} />
          </label>
          <label className={label}>Where you work
            <input required maxLength={LIMITS.country} value={f.countries} onChange={set("countries")} className={field} placeholder="Lagos, Nigeria · Ghana · online" />
          </label>
          <label className={label}>{t?.reachLabel ?? "How many people you reach"}
            <input required type="number" min={0} inputMode="numeric" value={f.reach} onChange={set("reach")} className={field} />
            {t && <span className={hint + " block"}>{t.reachHint}</span>}
          </label>
        </div>
        {f.track === "solutions" && (
          <fieldset>
            <legend className={label}>Services you offer</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SERVICES.map((s) => (
                <button key={s} type="button" aria-pressed={f.services.includes(s)} onClick={() => toggle(s)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${f.services.includes(s) ? "border-crimson bg-crimson text-paper" : "border-rule text-ink"}`}>{SERVICE_LABEL[s]}</button>
              ))}
            </div>
          </fieldset>
        )}
        <label className={label}>About you
          <textarea required rows={4} maxLength={LIMITS.about} value={f.about} onChange={set("about")} className={field} />
          <span className={hint + " block"}>Who you are and who you serve. If you&apos;re approved, this starts your listing (you can edit it).</span>
        </label>
        <label className={label}>Your plan with #NotesApp
          <textarea required rows={4} maxLength={LIMITS.plan} value={f.plan} onChange={set("plan")} className={field} />
          <span className={hint + " block"}>What you&apos;d do in your first 90 days as a partner, and what you&apos;d need from us.</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" checked={f.agree} onChange={set("agree")} className="mt-1" required />
          <span>{AGREE_TEXT} <a href="#terms" className="text-crimson underline">Read the terms</a></span>
        </label>
        {msg && <p role="status" className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-crimson/10 text-crimson"}`}>{msg.text}</p>}
        <button type="submit" disabled={busy} className="rounded-full bg-crimson px-7 py-3 font-ui text-sm font-bold text-paper disabled:opacity-50">{busy ? "Sending…" : "Apply"}</button>
      </form>
    </div>
  );
}
