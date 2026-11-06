"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  AGREE_TEXT, CALL_NAME, KINDS, KIND_LABEL, LIMITS, OPEN_STATUSES, PICKS_PER_QUARTER, REGIONS, REGION_LABEL, SECTORS, SECTOR_LABEL,
  STAGES, STAGE_LABEL, STATUS_LABEL, notPickedNote,
  type CallSettings, type MyApplication,
} from "@/lib/ventures";

// The Rewrite the Playbook pitch (lib/ventures-server.ts sendPitch), with the member's own pitches below it. Signed in only; the API checks
// everything again (18 and over, verified email, emerging markets, the call not paused, up to 3 pitches a quarter). Rolling: the team
// picks up to 3 a quarter; a pitch not picked shows the team's advice and an invitation to try again next quarter.
type Data = { call: CallSettings; quarter: string; mine: MyApplication[]; signedIn: boolean };
const field = "mt-1 block w-full rounded-xl border border-rule bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-crimson";
const label = "block text-sm font-semibold text-ink";
const hint = "mt-1 text-xs font-normal text-slate";
const EMPTY = { kind: "product", sector: "", stage: "", region: "", countries: "", title: "", oneLiner: "", problem: "", solution: "", whyYou: "", traction: "", teamSize: "1", links: "", emergingMarkets: false, agree: false };

async function call<T>(user: User | null, method: "GET" | "POST", body?: unknown): Promise<T> {
  const r = await fetch("/api/ventures", { method, cache: "no-store", headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong.");
  return j as T;
}

export default function PitchForm() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [data, setData] = useState<Data | null>(null);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const load = (u: User | null) => call<Data>(u, "GET").then(setData).catch(() => setData({ call: { open: true, picksPerQuarter: PICKS_PER_QUARTER }, quarter: "", mine: [], signedIn: !!u }));
  useEffect(() => { if (user !== undefined) void load(user); }, [user?.uid, user === undefined]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  if (user === undefined || !data) return <p className="text-sm text-slate">Loading…</p>;
  const closed = !data.call.open;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await call(user!, "POST", { action: "apply", ...f, teamSize: Number(f.teamSize), links: f.links.split(/\s+/).filter(Boolean) });
      setF(EMPTY);
      setMsg({ ok: true, text: "Your pitch is in. It's kept confidential, and a person reads every one. We'll tell you in your NotesApp notifications as it moves on." });
      await load(user!);
      document.getElementById("mine")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't send your pitch." }); }
    finally { setBusy(false); }
  }
  const withdraw = async (id: string, title: string) => {
    if (!confirm(`Withdraw "${title}"? You can pitch it again while the round is open.`)) return;
    try { await call(user!, "POST", { action: "withdraw", id }); await load(user!); } catch (err) { alert(err instanceof Error ? err.message : "Couldn't withdraw it."); }
  };

  const count = (k: "oneLiner" | "problem" | "solution" | "whyYou" | "traction") => <span className="float-right text-[11px] font-normal text-slate">{f[k].length}/{LIMITS[k]}</span>;
  return (
    <div>
      {!user ? (
        <div className="rounded-[22px] border border-rule bg-card p-6">
          <p className="font-display text-2xl text-ink">Sign in to pitch</p>
          <p className="mt-1 text-sm text-slate">You pitch with your NotesApp account, so we can reply to you here. It&apos;s free, and every pitch is kept confidential.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/login?next=/ventures%23apply" className="rounded-full bg-crimson px-5 py-2.5 font-ui text-sm font-semibold text-paper">Sign in</Link>
            <Link href="/signup?next=/ventures%23apply" className="rounded-full border border-rule px-5 py-2.5 font-ui text-sm font-semibold text-ink">Create an account</Link>
          </div>
        </div>
      ) : closed ? (
        <div className="rounded-[22px] border border-rule bg-card p-6">
          <p className="font-display text-2xl text-ink">Pitches are paused for now</p>
          <p className="mt-1 text-sm text-slate">Thank you to everyone who pitched. Follow <Link href="/u/notesapp" className="text-crimson underline">#NotesApp</Link> to hear when {CALL_NAME} opens again.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-5 rounded-[22px] border border-rule bg-card p-5 sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-2xl text-ink">Your pitch</p>
            <p className="text-xs font-semibold text-crimson">Rolling · we pick {data.call.picksPerQuarter} a quarter{data.quarter ? ` · now ${data.quarter}` : ""}</p>
          </div>

          <fieldset>
            <legend className={label}>What are you pitching?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <label key={k} className={`cursor-pointer rounded-full border px-4 py-2 text-sm ${f.kind === k ? "border-crimson bg-crimson text-paper" : "border-rule text-ink"}`}>
                  <input type="radio" name="kind" value={k} checked={f.kind === k} onChange={set("kind")} className="sr-only" />{KIND_LABEL[k]}
                </label>
              ))}
            </div>
          </fieldset>

          <label className={label}>Its name<input required maxLength={LIMITS.title} value={f.title} onChange={set("title")} className={field} placeholder="What you'd call it" /></label>
          <label className={label}>Your one-line pitch {count("oneLiner")}<input required maxLength={LIMITS.oneLiner} value={f.oneLiner} onChange={set("oneLiner")} className={field} placeholder="It helps [who] do [what], without [the pain]." /></label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className={label}>The emerging market it&apos;s for
              <select required value={f.region} onChange={set("region")} className={field}><option value="">Choose a region</option>{REGIONS.map((r) => <option key={r} value={r}>{REGION_LABEL[r]}</option>)}</select>
            </label>
            <label className={label}>Countries<input required maxLength={LIMITS.countries} value={f.countries} onChange={set("countries")} className={field} placeholder="Nigeria, Ghana, Kenya…" /></label>
            <label className={label}>Area
              <select required value={f.sector} onChange={set("sector")} className={field}><option value="">Choose one</option>{SECTORS.map((s) => <option key={s} value={s}>{SECTOR_LABEL[s]}</option>)}</select>
            </label>
            <label className={label}>How far along is it?
              <select required value={f.stage} onChange={set("stage")} className={field}><option value="">Choose one</option>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
            </label>
          </div>

          <label className={label}>The problem {count("problem")}<span className={hint + " block"}>Who has it, how they deal with it today, and why that isn&apos;t good enough. What do people already do that a product could make easier?</span>
            <textarea required rows={5} minLength={40} maxLength={LIMITS.problem} value={f.problem} onChange={set("problem")} className={field} /></label>
          <label className={label}>Your idea {count("solution")}<span className={hint + " block"}>What you&apos;d build, how it works, and why the crowd would jump into it.</span>
            <textarea required rows={5} minLength={40} maxLength={LIMITS.solution} value={f.solution} onChange={set("solution")} className={field} /></label>
          <label className={label}>Why you {count("whyYou")}<span className={hint + " block"}>What you know about this problem that others don&apos;t, and what you&apos;ve done before.</span>
            <textarea required rows={4} minLength={20} maxLength={LIMITS.whyYou} value={f.whyYou} onChange={set("whyYou")} className={field} /></label>
          <label className={label}>Traction so far (optional) {count("traction")}<span className={hint + " block"}>Users, sales, a waitlist, pilots, anything that shows people want it. &quot;None yet&quot; is fine.</span>
            <textarea rows={3} maxLength={LIMITS.traction} value={f.traction} onChange={set("traction")} className={field} /></label>

          <div className="grid gap-5 sm:grid-cols-[160px,1fr]">
            <label className={label}>People on the team<input type="number" required min={1} max={LIMITS.teamSize} value={f.teamSize} onChange={set("teamSize")} className={field} /></label>
            <label className={label}>Links (optional)<textarea rows={2} value={f.links} onChange={set("links")} className={field} placeholder={"https://… (a demo, a deck, your LinkedIn); one per line, up to 5"} /></label>
          </div>

          <div className="grid gap-3 rounded-2xl bg-field p-4 text-sm text-ink">
            <label className="flex items-start gap-2.5"><input type="checkbox" required checked={f.emergingMarkets} onChange={set("emergingMarkets")} className="mt-1" />
              <span><b>This idea is for people or businesses in emerging markets.</b> Only ideas and ventures for emerging markets are welcome.</span></label>
            <label className="flex items-start gap-2.5"><input type="checkbox" required checked={f.agree} onChange={set("agree")} className="mt-1" />
              <span>{AGREE_TEXT} <a href="#terms" className="font-semibold text-crimson underline">The terms</a></span></label>
          </div>

          {msg && !msg.ok && <p className="text-sm text-red-700" role="alert">{msg.text}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy} className="rounded-full bg-crimson px-7 py-3 font-ui text-sm font-bold text-paper disabled:opacity-50">{busy ? "Sending…" : "Send my pitch"}</button>
            <p className="text-xs text-slate">Kept confidential. Up to {LIMITS.perQuarter} pitches a quarter.</p>
          </div>
        </form>
      )}
      {msg?.ok && <p className="mt-4 rounded-2xl bg-green-50 p-4 text-sm text-green-800" role="status">{msg.text}</p>}

      {user && data.mine.length > 0 && (
        <section id="mine" className="mt-8 scroll-mt-24" aria-label="Your pitches">
          <h3 className="font-display text-2xl text-ink">Your pitches</h3>
          <ul className="mt-3 space-y-2">
            {data.mine.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-rule bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-ui font-bold text-ink">{a.title} <span className="text-xs font-normal text-slate">· {a.quarter} · {REGION_LABEL[a.region]}</span></p>
                  <p className="truncate text-sm text-slate">{a.oneLiner}</p>
                  {a.advice && <p className="mt-2 rounded-xl bg-field p-3 text-sm text-ink"><b>Advice from the team:</b> <span className="whitespace-pre-wrap">{a.advice}</span></p>}
                  {a.status === "not-picked" && <p className="mt-2 text-xs text-slate">{notPickedNote(data.call.picksPerQuarter)}</p>}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${a.status === "picked" ? "bg-green-100 text-green-800" : a.status === "shortlisted" ? "bg-amber-100 text-amber-900" : "bg-field text-ink"}`}>{STATUS_LABEL[a.status]}</span>
                {OPEN_STATUSES.includes(a.status) && <button type="button" onClick={() => void withdraw(a.id, a.title)} className="text-xs text-slate underline">Withdraw</button>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
