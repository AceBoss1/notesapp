"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import PasswordInput from "@/components/PasswordInput";
import { useAuthUser } from "./useAuthUser";
import { AI_PROVIDERS, PROVIDER_INFO, type AiProvider } from "@/lib/ai-providers";
import type { ProviderStatus } from "@/lib/ai-connect";
import { AI_PER_DAY, JOB_STATUS_LABEL, SENIORITY, SENIORITY_LABEL, hourText, type Board, type CvReview, type JobStatus, type NjProfile, type NjRun, type NjSettings, type ShortJob } from "@/lib/nana-jobs";

// Nana Jobs (/jobs/nana; docs/NANA_JOBS.md, mockups in docs/mockups/nana-jobs/): set up in four steps (connect your AI, your CV and your
// scoring profile, where to look, when to send it), then the daily shortlist with statuses, the run's funnel and a cover-note helper.
type State = {
  profile: NjProfile; settings: NjSettings; steps: { ai: boolean; profile: boolean; sources: boolean; when: boolean }; setupDone: boolean; nextRunAt: string | null;
  providers: { providers: ProviderStatus[]; canConnect: boolean }; using: AiProvider | null;
  cv: { has: boolean; updatedAt?: string; chars?: number; fileName?: string; review: CvReview | null };
  run: NjRun | null;
};
type View = "intro" | "ai" | "cv" | "profile" | "sources" | "when" | "list";

async function api<T>(user: User, url: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "Something went wrong"), { status: r.status });
  return j as T;
}

const ICON: Record<AiProvider, string> = { gemini: "✨", groq: "⚡", anthropic: "🧠", openai: "🤖" };
const field = "block w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink outline-none focus:border-crimson";
const chip = (on: boolean) => `inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${on ? "border-crimson bg-crimson text-paper" : "border-rule bg-card text-ink"}`;
const Note = ({ children }: { children: React.ReactNode }) => <div className="rounded-xl border border-[#F1D48A] bg-[#FFF4D6] px-3 py-2 text-sm leading-snug text-[#5a4300]">{children}</div>;
const Label = ({ children }: { children: React.ReactNode }) => <p className="mt-4 text-sm font-bold text-ink">{children}</p>;
const Mini = ({ children }: { children: React.ReactNode }) => <p className="mt-2 text-xs leading-snug text-slate">{children}</p>;

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange?.(!on)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-crimson" : "bg-[#cfc3bc]"} ${disabled ? "opacity-70" : ""}`}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${on ? "right-1" : "left-1"}`} />
    </button>
  );
}

// A list edited as chips with a "+" that opens a small input.
function ChipList({ items, onChange, on = false, add = "＋", placeholder, label }: { items: string[]; onChange: (v: string[]) => void; on?: boolean; add?: string; placeholder: string; label: string }) {
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState("");
  const commit = () => { const t = v.trim(); if (t && !items.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...items, t]); setV(""); setAdding(false); };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {items.map((x) => (
        <span key={x} className={chip(on)}>{x}<button type="button" aria-label={`Remove ${x}`} onClick={() => onChange(items.filter((y) => y !== x))} className="ml-0.5 opacity-70 hover:opacity-100">×</button></span>
      ))}
      {adding ? (
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") setAdding(false); }}
          placeholder={placeholder} aria-label={label} className="w-40 rounded-full border border-crimson bg-card px-3 py-1 text-sm outline-none" />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={chip(false)} aria-label={`Add ${label}`}>{add}</button>
      )}
    </div>
  );
}

const ago = (iso: string | null) => {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "posted today" : d === 1 ? "posted yesterday" : `posted ${d} days ago`;
};

export default function NanaJobs() {
  const user = useAuthUser();
  const [st, setSt] = useState<State | null>(null);
  const [blocked, setBlocked] = useState("");
  const [view, setView] = useState<View>("intro");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try { const s = await api<State>(user, "/api/jobs/nana"); setSt(s); setView((v) => (v === "intro" && s.setupDone && s.run ? "list" : v)); }
    catch (e) { if ((e as { status?: number }).status === 403) setBlocked((e as Error).message); else setError((e as Error).message); }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  async function act<T>(label: string, fn: () => Promise<T>, done?: string): Promise<T | undefined> {
    setBusy(label); setError(""); setMsg("");
    try { const r = await fn(); if (done) setMsg(done); return r; }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); return undefined; }
    finally { setBusy(""); }
  }
  const save = (body: Record<string, unknown>, done?: string) => act("save", async () => { const s = await api<State>(user!, "/api/jobs/nana", "POST", body); setSt(s); return s; }, done);
  const go = (v: View) => { setView(v); setError(""); setMsg(""); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (user === undefined) return <p className="py-16 text-center text-sm text-slate">Loading…</p>;
  if (!user) return (
    <div className="card mt-5 p-6">
      <h2 className="font-display text-2xl text-ink">Your shortlist, every morning</h2>
      <p className="mt-2 text-sm text-slate">Nana reads hundreds of openings so you read ten. You bring the AI, so the cost is on your own account, often free.</p>
      <div className="mt-4 flex flex-wrap gap-2"><Link href="/login?next=%2Fjobs%2Fnana" className="btn-primary !py-2">Sign in to start</Link><Link href="/nana-jobs" className="btn-ghost !py-2">How it works</Link></div>
    </div>
  );
  if (blocked) return <div className="mt-5"><Note>{blocked} <Link href="/explore?tab=jobs" className="font-semibold underline">Open the job board</Link></Note></div>;
  if (!st) return error ? <p className="mt-5 text-sm text-red-700" role="alert">{error}</p> : <p className="py-16 text-center text-sm text-slate">Loading…</p>;

  const steps: { id: View; label: string; done: boolean }[] = [
    { id: "ai", label: "Connect your AI", done: st.steps.ai },
    { id: "cv", label: "What you've done and what you want", done: st.steps.profile },
    { id: "sources", label: "Where to look", done: st.steps.sources },
    { id: "when", label: "When to send it", done: st.steps.when },
  ];
  const stepNo = (v: View) => (v === "ai" ? 1 : v === "cv" || v === "profile" ? 2 : v === "sources" ? 3 : 4);
  const flash = (<>{error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}{msg && <p className="mt-3 text-sm text-green-800" role="status">{msg}</p>}</>);
  const StepHead = ({ title, sub }: { title: string; sub?: string }) => (
    <div>
      <button type="button" onClick={() => go(st.setupDone ? "list" : "intro")} className="text-sm font-semibold text-crimson">← {st.setupDone ? "Today's shortlist" : "Nana Jobs"}</button>
      <p className="mt-3 font-ui text-xs font-semibold uppercase tracking-wide text-slate">Step {stepNo(view)} of 4</p>
      <h2 className="mt-1 font-display text-2xl text-ink">{title}</h2>
      {sub && <p className="mt-1 text-sm text-slate">{sub}</p>}
    </div>
  );

  // ---- 1 · /jobs → Nana Jobs ----
  if (view === "intro") return (
    <div className="mx-auto mt-5 max-w-xl">
      <h2 className="font-display text-2xl text-ink sm:text-3xl">Your shortlist, every morning</h2>
      <p className="mt-2 text-sm text-slate">Nana reads hundreds of openings so you read ten. You bring the AI, so the cost is on your own account, often free.</p>
      <div className="card mt-4 divide-y divide-rule px-4">
        {steps.map((s, i) => (
          <button key={s.id} type="button" onClick={() => go(s.id)} className="flex w-full items-center justify-between py-3 text-left text-sm text-ink hover:text-crimson">
            <span>{i + 1} · {s.label}</span><span aria-label={s.done ? "done" : "to do"} className={s.done ? "text-green-700" : "text-slate"}>{s.done ? "✓" : "○"}</span>
          </button>
        ))}
      </div>
      <div className="mt-4"><Note>No AI yet? You still get a free keyword ranking, marked <b>~ rough</b>, until you connect one.</Note></div>
      <button type="button" onClick={() => go(st.setupDone ? "list" : steps.find((s) => !s.done)?.id ?? "when")} className="btn-primary mt-6 w-full">{st.setupDone ? "See today's shortlist" : "Set up Nana Jobs"}</button>
      <p className="mt-3 text-center text-xs text-slate">It finds and ranks. It never applies for you. <Link href="/nana-jobs" className="underline">How it works</Link></p>
    </div>
  );

  if (view === "ai") return <AiStep st={st} setSt={setSt} user={user} head={<StepHead title="Connect your AI" />} save={save} next={() => go("cv")} />;
  if (view === "cv") return <CvStep st={st} user={user} head={<StepHead title="Start from your CV" sub="Upload your CV or paste it. Your AI reads it and gives you an honest review, the roles that fit, and a profile to start from." />} reload={load} save={save} next={() => go("profile")} />;
  if (view === "profile") return <ProfileStep st={st} head={<StepHead title="What Nana scores you on" />} busy={busy} flash={flash} back={() => go("cv")} onSave={async (p) => { if (await save({ profile: p })) go("sources"); }} />;
  if (view === "sources") return <SourcesStep st={st} setSt={setSt} user={user} head={<StepHead title="Where to look" />} busy={busy} flash={flash} back={() => go("profile")} onSave={async (s) => { if (await save({ settings: s, step: "sources" })) go("when"); }} />;
  if (view === "when") return (
    <div className="mx-auto mt-5 max-w-xl">
      <StepHead title="When to send it" sub="A daily run at your time, plus on demand. Bell on and email off to start with." />
      <AlertSettings st={st} onChange={(s) => setSt({ ...st, settings: { ...st.settings, ...s } })} />
      <div className="mt-4"><Note>Why there&apos;s no &quot;auto-apply&quot;: a bot that applies everywhere gets you blocked and wastes good chances. Nana finds the jobs and helps you write. You press Apply.</Note></div>
      {flash}
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={() => go("sources")} className="btn-ghost !py-2">Back</button>
        <button type="button" disabled={!!busy} className="btn-primary flex-1 !py-2 disabled:opacity-50" onClick={async () => {
          const s = await save({ settings: st.settings, step: "when", finish: true });
          if (!s) return;
          go("list");
          await act("run", async () => { const r = await api<{ run: NjRun }>(user, "/api/jobs/nana/run", "POST", {}); setSt({ ...s, run: r.run }); });
        }}>{busy ? "Saving…" : st.setupDone ? "Save" : "Finish and find my jobs"}</button>
      </div>
    </div>
  );

  // ---- 5 and 6 · the shortlist and today's run ----
  return <Shortlist st={st} setSt={setSt} user={user} busy={busy} act={act} flash={flash} go={go} />;
}

// ---- 2 · Connect your AI ----
function AiStep({ st, setSt, user, head, save, next }: { st: State; setSt: (s: State) => void; user: User; head: React.ReactNode; save: (b: Record<string, unknown>, done?: string) => Promise<unknown>; next: () => void }) {
  const status = (p: AiProvider) => st.providers.providers.find((x) => x.provider === p);
  const [sel, setSel] = useState<AiProvider>(st.settings.provider || st.using || "gemini");
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const s = status(sel);
  async function call(method: "POST" | "DELETE") {
    setBusy(true); setError(""); setNote("");
    try {
      const r = method === "POST" ? await api<{ providers: ProviderStatus[] }>(user, "/api/jobs/nana/ai", "POST", { provider: sel, key, baseUrl, model }) : await api<{ providers: ProviderStatus[] }>(user, `/api/jobs/nana/ai?provider=${sel}`, "DELETE");
      const connected = r.providers.filter((p) => p.connected).map((p) => p.provider);
      setSt({ ...st, providers: { ...st.providers, providers: r.providers }, steps: { ...st.steps, ai: connected.length > 0 } });
      setKey("");
      if (method === "POST") {
        // A free AI is used straight away; a paid one only because the member is connecting it here on purpose.
        await save({ settings: { provider: sel } });
        setNote(`Connected. Nana Jobs will use ${PROVIDER_INFO[sel].label}.`);
      } else { if (st.settings.provider === sel) await save({ settings: { provider: "" } }); setNote("Removed. The key has been deleted."); }
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }
  const using = st.settings.provider && status(st.settings.provider)?.connected ? st.settings.provider : st.using;
  return (
    <div className="mx-auto mt-5 max-w-xl">
      {head}
      <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Your AI">
        {AI_PROVIDERS.map((p) => {
          const info = PROVIDER_INFO[p], ps = status(p);
          return (
            <button key={p} type="button" role="radio" aria-checked={sel === p} onClick={() => { setSel(p); setError(""); setNote(""); }}
              className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left ${sel === p ? "border-crimson bg-[#fbf0f3]" : "border-rule bg-card hover:border-crimson"}`}>
              <span className="text-xl" aria-hidden>{ICON[p]}</span>
              <span className="min-w-0">
                <b className="block text-[15px] text-ink">{info.label}{info.free ? " · free" : ""}</b>
                <span className="block text-sm text-slate">{p === "anthropic" ? "Best reasons. About $1 a month at 25 jobs a day." : info.blurb}</span>
                {ps?.connected && <span className="mt-0.5 block text-sm font-semibold text-ink">{p === "anthropic" ? "Already connected for Nana" : "Connected"} ✓ <span className="font-mono">••••{ps.last4}</span>{using === p ? " · in use" : ""}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {!st.providers.canConnect && !s?.connected ? <Mini>Connecting your own AI isn&apos;t switched on yet. Please <Link href="/contact" className="underline">contact us</Link>.</Mini> : s?.connected ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {using !== sel && <button type="button" disabled={busy} onClick={async () => { await save({ settings: { provider: sel } }, `Nana Jobs will use ${PROVIDER_INFO[sel].label}.`); }} className="btn-primary !py-2">Use {PROVIDER_INFO[sel].label} for Nana Jobs</button>}
          <button type="button" disabled={busy} onClick={() => call("DELETE")} className="btn-ghost !py-2">Remove{sel === "anthropic" ? " (Nana stops using it too)" : ""}</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); call("POST"); }} className="mt-3 grid gap-2">
          {sel === "openai" && <>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Base URL (https://api.openai.com/v1, https://openrouter.ai/api/v1 …)" aria-label="Base URL" className={field} />
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model, as your provider writes it" aria-label="Model" className={field} />
          </>}
          <div className="flex items-center gap-2 rounded-xl border border-rule bg-card pl-1 pr-1">
            <div className="min-w-0 flex-1"><PasswordInput what="key" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} placeholder={`Paste your key… (${PROVIDER_INFO[sel].keyHint})`} aria-label={`${PROVIDER_INFO[sel].label} key`} className="w-full bg-transparent px-2 py-2 font-mono text-sm text-ink outline-none" /></div>
            <button type="submit" disabled={busy || key.trim().length < 8} className="rounded-full px-3 py-1.5 font-ui text-sm font-semibold text-crimson disabled:opacity-40">{busy ? "Checking…" : "Check"}</button>
          </div>
          <p className="text-xs text-slate">Get a key at <a href={PROVIDER_INFO[sel].keyUrl} target="_blank" rel="noopener noreferrer" className="underline">{new URL(PROVIDER_INFO[sel].keyUrl).host}</a>{PROVIDER_INFO[sel].free ? " (free, no card)" : " (you can set a spending limit there)"}.</p>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mt-3 text-sm text-green-800" role="status">{note}</p>}
      <Mini>The key is checked with a free call, then kept encrypted. Only its last 4 characters are ever shown. A paid AI is never picked unless you choose it. Remove it any time.</Mini>
      <div className="mt-6 flex gap-2"><button type="button" onClick={next} className="btn-primary flex-1 !py-2">{st.steps.ai ? "Next: your CV" : "Skip for now"}</button></div>
    </div>
  );
}

// ---- 2b · Start from your CV (the owner's addition, 12 Nov 2026) ----
function CvStep({ st, user, head, reload, save, next }: { st: State; user: User; head: React.ReactNode; reload: () => Promise<void>; save: (b: Record<string, unknown>) => Promise<unknown>; next: () => void }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const review = st.cv.review;
  async function pick(f: File | undefined) {
    if (!f) return;
    setError(""); setBusy("read");
    try { const { cvFileText } = await import("@/lib/cv-extract"); setText((await cvFileText(f)).slice(0, 30_000)); setFileName(f.name); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't read that file."); }
    finally { setBusy(""); }
  }
  async function send(body: Record<string, unknown>) {
    setBusy("review"); setError(""); setNote("");
    try { const r = await api<{ review: CvReview | null; note: string }>(user, "/api/jobs/nana/cv", "POST", body); setNote(r.note); setText(""); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(""); }
  }
  async function useIt() {
    if (!review) return;
    const p = review.profile;
    const merge = (a: string[], b: string[]) => [...a, ...b.filter((x) => !a.some((y) => y.toLowerCase() === x.toLowerCase()))];
    const cur = st.profile;
    const ok = await save({ profile: { roles: merge(p.roles, cur.roles).slice(0, 8), shipped: merge(cur.shipped, p.shipped), skills: merge(cur.skills, p.skills), cities: merge(cur.cities, p.cities), country: p.country || cur.country, remote: p.remote, seniority: p.seniority } });
    if (ok) next();
  }
  return (
    <div className="mx-auto mt-5 max-w-xl">
      {head}
      {!review || text ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-ghost cursor-pointer !py-2">📄 Upload PDF or Word<input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} /></label>
            {fileName && <span className="text-sm text-slate">{fileName}</span>}
          </div>
          <label className="mt-3 block text-sm text-slate">…or paste the text
            <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your CV here" className={`mt-1 ${field}`} />
          </label>
          <button type="button" disabled={!!busy || text.trim().length < 200} onClick={() => send({ text, fileName })} className="btn-primary mt-3 w-full !py-2 disabled:opacity-50">{busy === "review" ? "Your AI is reading it…" : busy === "read" ? "Reading the file…" : st.steps.ai ? "Review my CV" : "Save my CV"}</button>
          {!st.steps.ai && <Mini>Connect your AI first (step 1) to have it reviewed. Your CV is kept until then.</Mini>}
          {st.cv.has && !review && st.steps.ai && <button type="button" disabled={!!busy} onClick={() => send({ again: true })} className="mt-2 text-sm font-semibold text-crimson">Review the CV I saved</button>}
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <div className="card p-4">
            <p className="text-sm font-bold text-ink">What&apos;s strong</p>
            <ul className="mt-1 space-y-1 text-sm text-[#17694a]">{review.strengths.map((x) => <li key={x}>✓ {x}</li>)}</ul>
            {review.gaps.length > 0 && <><p className="mt-3 text-sm font-bold text-ink">Gaps</p><ul className="mt-1 space-y-1 text-sm text-[#8c4a00]">{review.gaps.map((x) => <li key={x}>⚠ {x}</li>)}</ul></>}
            {review.fixes.length > 0 && <><p className="mt-3 text-sm font-bold text-ink">Quick fixes to your CV</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">{review.fixes.map((x) => <li key={x}>{x}</li>)}</ul></>}
          </div>
          <div className="card p-4">
            <p className="text-sm font-bold text-ink">Roles that fit</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{review.roles.map((r) => <span key={r} className={chip(review.profile.roles.includes(r))}>{r}</span>)}</div>
            <p className="mt-3 text-sm font-bold text-ink">Things you&apos;ve shipped (from your CV only)</p>
            <ul className="mt-1 space-y-0.5 text-sm text-ink">{review.profile.shipped.length ? review.profile.shipped.map((x) => <li key={x}>• {x}</li>) : <li className="text-slate">None found with enough detail. Add your own on the next screen.</li>}</ul>
            <p className="mt-3 text-sm text-slate">{SENIORITY_LABEL[review.profile.seniority]} · {[...review.profile.cities, review.profile.country].filter(Boolean).join(", ")}{review.profile.remote ? " · open to remote" : ""}{review.profile.skills.length ? ` · ${review.profile.skills.slice(0, 6).join(", ")}` : ""}</p>
          </div>
          <button type="button" disabled={!!busy} onClick={useIt} className="btn-primary w-full !py-2">Use this to fill in my profile</button>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <button type="button" onClick={() => setText(" ")} className="font-semibold text-crimson">Upload a newer CV</button>
            <button type="button" disabled={!!busy} onClick={async () => { await api(user, "/api/jobs/nana/cv", "DELETE"); setNote("Your CV and its review are deleted."); await reload(); }} className="text-slate underline">Delete my CV</button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mt-3 text-sm text-green-800" role="status">{note}</p>}
      <Mini>Your CV is kept encrypted and used only for Nana Jobs, by your own AI. Firms never see it. Delete it any time.</Mini>
      <button type="button" onClick={next} className="btn-ghost mt-5 w-full !py-2">{review ? "Fill it in myself" : "Skip: fill in my profile myself"}</button>
    </div>
  );
}

// ---- 3 · Your scoring profile ----
function ProfileStep({ st, head, busy, flash, back, onSave }: { st: State; head: React.ReactNode; busy: string; flash: React.ReactNode; back: () => void; onSave: (p: NjProfile) => void }) {
  const [p, setP] = useState<NjProfile>(st.profile);
  const [shipped, setShipped] = useState(st.profile.shipped.join("\n"));
  const set = (k: Partial<NjProfile>) => setP({ ...p, ...k });
  return (
    <div className="mx-auto mt-5 max-w-xl">
      {head}
      <Label>Roles you want</Label>
      <ChipList items={p.roles} onChange={(roles) => set({ roles })} on placeholder="Backend engineer" label="a role" />
      <Label>Things you&apos;ve actually shipped (Nana may only claim these)</Label>
      <textarea rows={6} value={shipped} onChange={(e) => setShipped(e.target.value)} placeholder={"One per line, with the real figure if you have one.\nPayments ledger on Postgres, 40k payouts a month"} className={`mt-2 ${field}`} aria-label="Things you've shipped" />
      <Mini>{st.cv.review ? "Filled in from your CV. Edit freely." : "One per line. Nana's reasons and cover notes use only these."}</Mini>
      <Label>Skills and tools</Label>
      <ChipList items={p.skills} onChange={(skills) => set({ skills })} placeholder="Postgres" label="a skill" />
      <Label>Where you can work</Label>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button type="button" aria-pressed={p.remote} onClick={() => set({ remote: !p.remote })} className={chip(p.remote)}>Remote, worldwide{p.remote ? " ✓" : ""}</button>
        {p.cities.map((c) => <span key={c} className={chip(true)}>On-site: {c}<button type="button" aria-label={`Remove ${c}`} onClick={() => set({ cities: p.cities.filter((x) => x !== c) })} className="ml-0.5 opacity-70">×</button></span>)}
        <ChipInline onAdd={(c) => set({ cities: [...p.cities, c] })} add="＋ city" placeholder="Lagos" label="a city" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-slate">Country you live in<input value={p.country} onChange={(e) => set({ country: e.target.value })} className={`mt-1 ${field}`} /></label>
        <label className="text-xs text-slate">Your level<select value={p.seniority} onChange={(e) => set({ seniority: e.target.value as NjProfile["seniority"] })} className={`mt-1 ${field}`}>{SENIORITY.map((s) => <option key={s} value={s}>{SENIORITY_LABEL[s]}</option>)}</select></label>
      </div>
      <Label>Lowest pay you&apos;ll take</Label>
      <input value={p.payFloor} onChange={(e) => set({ payFloor: e.target.value })} placeholder="$2,500 / month · or ₦1,200,000" className={`mt-2 ${field}`} aria-label="Lowest pay you'll take" />
      <Label>Deal-breakers</Label>
      <ChipList items={p.dealBreakers} onChange={(dealBreakers) => set({ dealBreakers })} placeholder="Unpaid trial" label="a deal-breaker" />
      <Mini>All of this stays private: firms never see it, and it isn&apos;t your public profile. &quot;Remote, but only from the US&quot; is dropped for someone in Lagos.</Mini>
      {flash}
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={back} className="btn-ghost !py-2">Back</button>
        <button type="button" disabled={!!busy || !p.roles.length} onClick={() => onSave({ ...p, shipped: shipped.split("\n").map((x) => x.trim()).filter(Boolean) })} className="btn-primary flex-1 !py-2 disabled:opacity-50">{busy ? "Saving…" : "Save and next"}</button>
      </div>
    </div>
  );
}
function ChipInline({ onAdd, add, placeholder, label }: { onAdd: (v: string) => void; add: string; placeholder: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  const commit = () => { if (v.trim()) onAdd(v.trim()); setV(""); setOpen(false); };
  return open ? <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} placeholder={placeholder} aria-label={label} className="w-32 rounded-full border border-crimson bg-card px-3 py-1 text-sm outline-none" />
    : <button type="button" onClick={() => setOpen(true)} className={chip(false)}>{add}</button>;
}

// ---- 4 · Where to look ----
function SourcesStep({ st, setSt, user, head, busy, flash, back, onSave }: { st: State; setSt: (s: State) => void; user: User; head: React.ReactNode; busy: string; flash: React.ReactNode; back: () => void; onSave: (s: Partial<NjSettings>) => void }) {
  const [feeds, setFeeds] = useState(st.settings.feeds);
  const [boards, setBoards] = useState(st.settings.boards);
  return (
    <div className="mx-auto mt-5 max-w-xl">
      {head}
      <div className="card mt-4 divide-y divide-rule px-4">
        <div className="flex items-center justify-between gap-3 py-3 text-sm"><span>🟥 Notes Jobs (verified firms)</span><Toggle on label="Notes Jobs, always on" disabled /></div>
        <div className="flex items-center justify-between gap-3 py-3 text-sm"><span>🌍 RemoteOK, Remotive, Himalayas, Arbeitnow</span><Toggle on={feeds} onChange={setFeeds} label="Open job feeds" /></div>
        <div className="flex items-center justify-between gap-3 py-3 text-sm"><span>🏢 Company job boards (Greenhouse, Lever, Ashby)</span><Toggle on={boards} onChange={setBoards} label="Company job boards" /></div>
      </div>
      <Companies st={st} setSt={setSt} user={user} />
      <div className="mt-4"><Note><b>No LinkedIn or Indeed scraping.</b> Both forbid it. Coming next: forward your LinkedIn job-alert emails to your own Nana Jobs address and they&apos;ll be read too.</Note></div>
      {flash}
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={back} className="btn-ghost !py-2">Back</button>
        <button type="button" disabled={!!busy} onClick={() => onSave({ feeds, boards })} className="btn-primary flex-1 !py-2 disabled:opacity-50">{busy ? "Saving…" : "Save and next"}</button>
      </div>
    </div>
  );
}
function Companies({ st, setSt, user }: { st: State; setSt: (s: State) => void; user: User }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = st.settings.companies;
  const apply = (companies: Board[]) => setSt({ ...st, settings: { ...st.settings, companies } });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setError("");
    try { apply((await api<{ companies: Board[] }>(user, "/api/jobs/nana/companies", "POST", { name })).companies); setName(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn't check it"); }
    finally { setBusy(false); }
  }
  return (
    <div>
      <Label>Companies you&apos;re watching · {list.length}</Label>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {list.map((c) => (
          <span key={c.name} className={`${chip(false)} ${c.ok ? "" : "text-slate"}`}>{c.name.toLowerCase()} {c.ok ? "✓" : "✗ no public board"}
            <button type="button" aria-label={`Stop watching ${c.name}`} onClick={async () => apply((await api<{ companies: Board[] }>(user, `/api/jobs/nana/companies?name=${encodeURIComponent(c.name)}`, "DELETE")).companies)} className="ml-0.5 opacity-60">×</button>
          </span>
        ))}
        <form onSubmit={add} className="inline-flex items-center gap-1">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="＋ add" aria-label="Add a company" className="w-28 rounded-full border border-rule bg-card px-3 py-1 text-sm outline-none focus:border-crimson" />
          {name.trim() && <button className="rounded-full bg-crimson px-3 py-1 text-sm font-semibold text-paper" disabled={busy}>{busy ? "Checking…" : "Add"}</button>}
        </form>
      </div>
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      <Mini>Type a company. We check whether it has a public board before adding it.</Mini>
    </div>
  );
}

// ---- 6 · Alerts (in the set-up and on the shortlist) ----
function AlertSettings({ st, onChange }: { st: State; onChange: (s: Partial<NjSettings>) => void }) {
  const s = st.settings;
  return (
    <div className="card mt-4 divide-y divide-rule px-4">
      <div className="flex items-center justify-between gap-3 py-3 text-sm"><span>🔔 Bell when it&apos;s ready</span><Toggle on={s.bell} onChange={(bell) => onChange({ bell })} label="Bell when it's ready" /></div>
      <div className="flex items-center justify-between gap-3 py-3 text-sm"><span>✉️ Email the list</span><Toggle on={s.email} onChange={(email) => onChange({ email })} label="Email the list" /></div>
      <label className="flex items-center justify-between gap-3 py-3 text-sm"><span>Time</span>
        <select value={s.hour} onChange={(e) => onChange({ hour: Number(e.target.value) })} className="rounded-lg border border-rule bg-card px-2 py-1 font-semibold">{Array.from({ length: 18 }, (_, i) => i + 5).map((h) => <option key={h} value={h}>{hourText(h)}</option>)}</select>
      </label>
      <label className="flex items-center justify-between gap-3 py-3 text-sm"><span>Jobs read by AI each day</span>
        <select value={s.aiPerDay} onChange={(e) => onChange({ aiPerDay: Number(e.target.value) })} className="rounded-lg border border-rule bg-card px-2 py-1 font-semibold">{[5, 10, 15, 25, 40, AI_PER_DAY.max].map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
    </div>
  );
}

// ---- 5 · Today's shortlist, and 6 · today's run ----
function Shortlist({ st, setSt, user, busy, act, flash, go }: { st: State; setSt: (s: State) => void; user: User; busy: string; act: <T>(l: string, fn: () => Promise<T>, done?: string) => Promise<T | undefined>; flash: React.ReactNode; go: (v: View) => void }) {
  const run = st.run;
  const [cover, setCover] = useState<{ hash: string; text: string } | null>(null);
  const runNow = () => act("run", async () => { const r = await api<{ run: NjRun }>(user, "/api/jobs/nana/run", "POST", {}); setSt({ ...st, run: r.run }); });
  const setStatus = (j: ShortJob, status: JobStatus | null) => act("status", async () => {
    await api(user, "/api/jobs/nana/status", "POST", { hash: j.hash, status });
    setSt({ ...st, run: run ? { ...run, jobs: run.jobs.map((x) => (x.hash === j.hash ? { ...x, status: status ?? undefined } : x)).filter((x) => x.status !== "not_for_me") } : run });
  });
  const writeCover = (j: ShortJob) => act("cover", async () => { const r = await api<{ note: string }>(user, "/api/jobs/nana/cover", "POST", { hash: j.hash }); setCover({ hash: j.hash, text: r.note }); });
  const saveAlerts = async (s: Partial<NjSettings>) => { const next = { ...st, settings: { ...st.settings, ...s } }; setSt(next); await act("save", async () => setSt(await api<State>(user, "/api/jobs/nana", "POST", { settings: s }))); };
  const coverTarget = run?.jobs.find((j) => j.status === "interested") ?? run?.jobs[0];
  const f = run?.funnel;
  const rows: [string, number][] = f ? [["Collected", f.collected], ["No repeats", f.unique], ["Fit your rules", f.fit], ["Keyword top", f.keywordTop], ["Read by AI", f.readByAi], ["Links alive", f.alive]] : [];
  const max = Math.max(1, f?.collected ?? 1);
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[1.35fr,1fr]">
      <section aria-label="Today's shortlist">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl text-ink">🧭 Today&apos;s shortlist{run ? ` · ${run.jobs.length}` : ""}</h2>
          <button type="button" onClick={runNow} disabled={!!busy} className="rounded-full border border-rule bg-card px-4 py-1.5 font-ui text-sm font-semibold hover:border-crimson disabled:opacity-50">{busy === "run" ? "Nana is reading…" : "Run now"}</button>
        </div>
        {run && <p className="mt-1 text-xs text-slate">{new Date(run.at).toLocaleString("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })} Lagos{run.provider ? ` · read by ${PROVIDER_INFO[run.provider].label}` : ""}{st.nextRunAt ? ` · next run ${new Date(st.nextRunAt).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}` : ""}</p>}
        {flash}
        {run?.error && <div className="mt-3"><Note>{run.jobs.some((j) => j.rough) ? <>Your AI didn&apos;t answer for some of these (&quot;{run.error}&quot;), so they carry the free keyword score, marked <b>~ rough</b>.</> : <>Your AI didn&apos;t answer for a few openings (&quot;{run.error}&quot;). They kept their keyword score and didn&apos;t make the list.</>}</Note></div>}
        {run?.note && !run.error && <p className="mt-3 text-sm text-slate">{run.note}</p>}
        {!run ? <p className="mt-4 text-sm text-slate">{busy === "run" ? "Reading today's openings… this can take a minute." : "No shortlist yet. Press Run now, or wait for your morning run."}</p>
          : run.jobs.length === 0 ? <p className="mt-4 text-sm text-slate">Nothing fits your rules today. Try more roles, or switch on more sources.</p>
          : <div className="mt-3 grid gap-3">{run.jobs.map((j) => (
            <article key={j.hash} className={`rounded-2xl border border-rule bg-card p-4 text-sm ${j.rough ? "opacity-90" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-ink">{j.title} · {j.notesJobId ? `Notes Jobs: ${j.company}` : j.company}</p>
                <span className={`font-display text-2xl leading-none text-crimson ${j.rough ? "italic" : ""}`} title={j.rough ? "Rough keyword score" : "Your AI's score out of 100"}>{j.rough ? "~" : ""}{j.score}</span>
              </div>
              <p className="mt-1 text-xs text-slate">{[j.location, j.notesJobId ? "verified firm" : j.sourceLabel, ago(j.postedAt), j.link === "live" && !j.notesJobId ? "link checked ✓" : ""].filter(Boolean).join(" · ")}{j.notesJobId && <> · <b className="text-ink">Apply on #NotesApp</b></>}</p>
              {j.rough && !j.reason ? <p className="mt-1 text-xs text-slate">~ rough: {run.error ? `your AI didn't answer ("${run.error}")` : "not read by an AI"}</p> : <>
                {j.reason && <p className="mt-1.5 text-[#17694a]">{j.rough ? "~ " : "✓ "}{j.reason}</p>}
                {j.risk && <p className="mt-0.5 text-[#8c4a00]">⚠ {j.risk}</p>}
              </>}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {(["interested", "applied", "not_for_me"] as JobStatus[]).map((s) => (
                  <button key={s} type="button" aria-pressed={j.status === s} onClick={() => setStatus(j, j.status === s ? null : s)} className={`${chip(j.status === s)} !py-0.5 text-xs`}>{s === "interested" && j.status === s ? "⭐ " : ""}{JOB_STATUS_LABEL[s]}</button>
                ))}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-3 text-xs font-semibold">
                {j.notesJobId ? <Link href={`/jobs/${j.notesJobId}`} className="rounded-full bg-crimson px-3 py-1 text-paper">Apply on #NotesApp</Link>
                  : <a href={j.url} target="_blank" rel="noopener noreferrer nofollow" className="text-crimson underline">Open the firm&apos;s page ↗</a>}
                <button type="button" disabled={!!busy} onClick={() => writeCover(j)} className="text-crimson underline disabled:opacity-50">{busy === "cover" && cover?.hash !== j.hash ? "Cover note" : "✍️ Cover note"}</button>
              </div>
              {cover?.hash === j.hash && (
                <div className="mt-3">
                  <textarea rows={7} defaultValue={cover.text} className={field} aria-label="Your cover note" />
                  <p className="mt-1 text-xs text-slate">Written by your AI from your &quot;shipped&quot; list only. Check it, make it yours, then apply yourself.</p>
                </div>
              )}
            </article>
          ))}</div>}
      </section>
      <aside className="grid h-fit gap-4" aria-label="Today's run">
        {f && (
          <div className="card p-4">
            <p className="font-ui text-sm font-bold text-ink">Nana Jobs · today&apos;s run</p>
            <div className="mt-2 grid gap-1.5 text-xs">
              {rows.map(([label, n]) => (
                <div key={label} className="flex items-center gap-2"><span className="w-24 shrink-0 text-slate">{label}</span><i className="block h-3.5 rounded bg-crimson/85" style={{ width: `${Math.max(3, Math.sqrt(n / max) * 60)}%` }} /><span className="font-semibold text-ink">{n.toLocaleString("en-GB")}</span></div>
              ))}
            </div>
          </div>
        )}
        <AlertSettings st={st} onChange={saveAlerts} />
        <Note>Why there&apos;s no &quot;auto-apply&quot;: a bot that applies everywhere gets you blocked and wastes good chances. Nana finds the jobs and helps you write. You press Apply.</Note>
        {coverTarget && <button type="button" disabled={!!busy} onClick={() => writeCover(coverTarget)} className="btn-ghost w-full !py-2">✍️ Help me write a cover note (Nana)</button>}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm font-semibold text-crimson">
          <button type="button" onClick={() => go("ai")}>Your AI</button><button type="button" onClick={() => go("cv")}>Your CV</button><button type="button" onClick={() => go("profile")}>Your profile</button><button type="button" onClick={() => go("sources")}>Where to look</button>
        </div>
      </aside>
    </div>
  );
}
