"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import {
  HOLDERS, PERSON_LABEL, ROUND_NAMES, SCENARIOS, fmtNgn, fmtPct, fmtUsd, optionPath, roundMath, runModel, runway, startingSplit,
  type Business, type Company, type Founders, type PersonKey, type Round,
} from "@/lib/vision";

type Payload = { viewer: PersonKey; real: PersonKey; canSwitch: boolean; people: PersonKey[]; founders?: Founders; option?: { pct: number; shares: number; fullyDiluted: number } };
const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const field = "mt-1 block w-full rounded-lg border border-rule bg-card px-2 py-1.5 text-sm";
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 font-ui text-xs font-semibold ${on ? "border-crimson bg-crimson text-paper" : "border-rule hover:border-crimson"}`;
const fresh = (k: "worst" | "base" | "vision") => { const s = SCENARIOS.find((x) => x.key === k)!; return { company: { ...s.company, rounds: s.company.rounds.map((r) => ({ ...r })), classB: [true, false, false] as [boolean, boolean, boolean] }, business: { ...s.business } }; };
// The holder rows that belong to each person, so the page can focus on "you".
const ROW: Partial<Record<PersonKey, number>> = { emmanuel: 0, chimdinma: 1, akujuobi: 2 };

function Slider({ label, value, min, max, step, show, onChange, disabled }: { label: string; value: number; min: number; max: number; step: number; show: string; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <label className="block text-xs text-slate">
      <span className="flex justify-between"><span>{label}</span><span className="font-mono text-ink">{show}</span></span>
      <input type="range" className="mt-1 w-full accent-crimson" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
const Tile = ({ label, value, note, ngn }: { label: string; value: string; note?: string; ngn?: string }) => (
  <div className="card p-3"><p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">{label}</p><p className="mt-1 font-display text-2xl text-ink">{value}</p>{ngn && <p className="font-mono text-xs text-slate">{ngn}</p>}{note && <p className="mt-1 text-xs text-slate">{note}</p>}</div>
);

// The founders' and C-suite's slider model of the company's future. It opens focused on whoever is signed in: a founder sees their own stake, value, vote
// and cash multiple with their row highlighted; Nora Bawa sees her own option and the company's rounds, not the founders' split. The owner can view as anyone.
export default function VisionPage() {
  const { user, loading } = useAdminAuth();
  const [as, setAs] = useState<PersonKey | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState<string>("base");
  const [hold, setHold] = useState<"stake" | "valuation">("stake"); // what stays put when the raise changes
  const [{ company, business }, setM] = useState(() => fresh("base"));
  const [fnd, setFnd] = useState<Founders | null>(null);

  const load = useCallback(async () => {
    setError("");
    const r = await fetch(`/api/admin/vision${as ? `?as=${as}` : ""}`, { headers: { Authorization: `Bearer ${await user!.getIdToken()}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    setData(j); setFnd(j.founders ?? null);
  }, [user, as]);
  useEffect(() => { if (user) load().catch((e) => setError(e.message)); }, [user, load]);

  const setCo = (p: Partial<Company>) => { setPreset("custom"); setM((m) => ({ ...m, company: { ...m.company, ...p } })); };
  const setBiz = (p: Partial<Business>) => { setPreset("custom"); setM((m) => ({ ...m, business: { ...m.business, ...p } })); };
  const setRound = (i: number, p: Partial<Round>) => setCo({ rounds: company.rounds.map((r, k) => (k === i ? { ...r, ...p } : r)) });
  // Raise, share sold and post-money are linked: post-money = raise / share sold. Changing the raise keeps the share sold (or the valuation, as chosen above);
  // changing the share sold recalculates the post-money; changing the post-money recalculates the share sold.
  const editRaise = (i: number, raise: number) => { const r = company.rounds[i]; setRound(i, hold === "stake" && r.raise > 0 && r.post > 0 ? { raise, post: Math.round((raise * r.post) / r.raise) } : { raise }); };
  const editStake = (i: number, pct: number) => { const r = company.rounds[i]; if (pct > 0 && r.raise > 0) setRound(i, { post: Math.round((r.raise * 100) / pct) }); };
  const setF = (p: Partial<Founders>) => { setPreset("custom"); setFnd((f) => (f ? { ...f, ...p } : f)); };

  const me = data?.viewer;
  const model = useMemo(() => (fnd ? runModel(fnd, company) : null), [fnd, company]);
  const opt = useMemo(() => (data?.option ? optionPath(data.option.pct, company) : null), [data, company]);
  const rw = useMemo(() => runway(business), [business]);
  const rmath = useMemo(() => roundMath(company), [company]);

  if (loading) return <p className="p-8 text-slate">Loading…</p>;
  if (!user) return <p className="p-8 text-slate">Admins only.</p>;

  const fx = business.fx || 1333;
  const ngn = (usd: number) => fmtNgn(usd * fx);
  // Dollar amounts with the naira under them, in a table cell.
  const money = (usd: number) => <><div>{fmtUsd(usd)}</div><div className="text-[10px] font-normal text-slate">{ngn(usd)}</div></>;
  const mine = me ? ROW[me] : undefined;
  const lastStage = model?.last;
  const finalValue = model?.finalValue ?? opt?.[opt.length - 1]?.post ?? 0;
  const cashIn = me === "chimdinma" ? fnd?.cCash : me === "akujuobi" ? fnd?.aCash : undefined;
  const notes: { tone: string; text: string }[] = [];
  if (model && lastStage && me) {
    const resv = lastStage.v[4] + lastStage.v[5];
    const eVote = lastStage.vote[0];
    if (eVote < 0.5) notes.push({ tone: "text-red-700", text: `Emmanuel holds ${fmtPct(eVote)} of the votes at the last stage. Under Delaware's default rules most decisions pass by a majority of the votes, so he could be outvoted. Class B stock or a voting agreement would change that.` });
    else notes.push({ tone: "text-green-700", text: `Emmanuel holds ${fmtPct(eVote)} of the votes at the last stage${company.dual !== "never" && company.classB[0] ? " with Class B stock. Delaware counsel must confirm the charter and any listing rules allow it" : ""}.` });
    if (me !== "emmanuel" && mine !== undefined) notes.push({ tone: "text-ink", text: `Your own vote is ${fmtPct(lastStage.vote[mine])} at the last stage: ${fmtPct(lastStage.v[mine])} of the shares${company.dual !== "never" && company.classB[mine] ? ` with ${company.V} votes each` : " with one vote each"}.` });
    if (resv > 0.2) notes.push({ tone: "text-amber-700", text: `Unissued reserves are ${fmtPct(resv)} of the company at the last stage. Investors usually accept 10 to 15% and push back above 20%.` });
    if (company.poolAt === "preA") notes.push({ tone: "text-amber-700", text: "The pool is set to appear just before Series A, but Nora's grant and the Plan assume it exists at formation. Choose “At formation” to match the documents." });
    if (!model.last.v.slice(6).some((x) => x > 0)) notes.push({ tone: "text-amber-700", text: "No outside round is switched on, so ownership only changes through the pool." });
  }
  if (rw.surplus < 0) notes.push({ tone: "text-red-700", text: `Revenue does not cover the monthly burn at this conversion. Cash lasts ${Number.isFinite(rw.monthsWithRevenue) ? rw.monthsWithRevenue.toFixed(1) : "-"} months unless a round closes.` });
  else notes.push({ tone: "text-green-700", text: "Revenue covers the monthly burn at this conversion." });
  if (finalValue >= 1e9) notes.push({ tone: "text-amber-700", text: `A ${fmtUsd(finalValue)} (${ngn(finalValue)}) valuation is a vision case. Paper value ignores liquidation preferences and tax. Do not quote it to investors, staff or the public.` });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link href="/admin/team" className="font-ui text-xs font-semibold text-crimson">← Team hub</Link>
      <h1 className="mt-2 font-display text-4xl text-ink">Vision model</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate">
        Move the sliders to see how funding rounds, the staff pool and a possible dual-class vote change what is owned and what it is worth on paper, and how long cash lasts. A planning tool for the founders and the C-suite. Not a
        forecast and not an offer of securities.
      </p>
      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
      {data && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="font-ui text-xs font-semibold text-slate">Showing</span>
            <span className="rounded-full bg-crimson/10 px-3 py-1 font-ui text-xs font-semibold text-crimson">{PERSON_LABEL[data.viewer]}</span>
            {data.canSwitch && <>
              <span className="ml-2 font-ui text-xs text-slate">View as:</span>
              {data.people.map((p) => <button key={p} type="button" className={chip(data.viewer === p)} onClick={() => setAs(p === data.real ? null : p)}>{PERSON_LABEL[p].split(" ")[0]}</button>)}
            </>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="font-ui text-xs font-semibold text-slate">Scenario</span>
            {SCENARIOS.map((s) => <button key={s.key} type="button" className={chip(preset === s.key)} onClick={() => { setPreset(s.key); setM(fresh(s.key)); }}>{s.label}</button>)}
            <span className="text-xs text-slate">{SCENARIOS.find((s) => s.key === preset)?.note ?? "Custom settings"}</span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {model && lastStage && me && (<>
              {me === "emmanuel" ? <>
                <Tile label="You own" value={fmtPct(lastStage.v[0])} note={`of the company at the last stage (starts at ${fmtPct(model.snaps[0].v[0])})`} />
                <Tile label="Your paper value" value={fmtUsd(lastStage.v[0] * model.finalValue)} ngn={ngn(lastStage.v[0] * model.finalValue)} note="stake × last post-money" />
                <Tile label="Your voting power" value={fmtPct(lastStage.vote[0])} note="reserves carry no votes" />
                <Tile label="The three founders own" value={fmtPct(lastStage.v[0] + lastStage.v[1] + lastStage.v[2])} note={`votes ${fmtPct(lastStage.vote[0] + lastStage.vote[1] + lastStage.vote[2])}`} />
              </> : <>
                <Tile label="You own" value={fmtPct(lastStage.v[mine!])} note={`at the last stage (starts at ${fmtPct(model.snaps[0].v[mine!])})`} />
                <Tile label="Your paper value" value={fmtUsd(lastStage.v[mine!] * model.finalValue)} ngn={ngn(lastStage.v[mine!] * model.finalValue)} note={cashIn ? `on US$${cashIn.toLocaleString("en-US")} paid in plus work: ${(lastStage.v[mine!] * model.finalValue / cashIn).toLocaleString("en-US", { maximumFractionDigits: 0 })}x` : "stake × last post-money"} />
                <Tile label="Your voting power" value={fmtPct(lastStage.vote[mine!])} note={company.dual !== "never" && company.classB[mine!] ? `${company.V} votes a share` : "one vote a share"} />
                <Tile label="Emmanuel's voting power" value={fmtPct(lastStage.vote[0])} note="the CEO's seat" />
              </>}
            </>)}
            {opt && data.option && (<>
              <Tile label="Your option" value={fmtPct(opt[opt.length - 1].pct)} note={`of the company at the last stage (starts at ${data.option.pct.toFixed(2)}%)`} />
              <Tile label="Your option, paper value" value={fmtUsd(opt[opt.length - 1].pct * finalValue)} ngn={ngn(opt[opt.length - 1].pct * finalValue)} note="before the exercise price and tax" />
              <Tile label="Shares at grant" value={data.option.shares.toLocaleString("en-US")} note={`of ${data.option.fullyDiluted.toLocaleString("en-US")} fully diluted`} />
              <Tile label="How it vests" value="90-day cliff" note="then monthly over 36 months, plus milestone tranches" />
            </>)}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="card space-y-4 p-4">
              <p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">Company</p>
              <Slider label="Option pool, % fully diluted" value={company.pool} min={0} max={25} step={1} show={`${company.pool}%`} onChange={(n) => setCo({ pool: n })} disabled={!!opt} />
              <label className="block text-xs text-slate">Pool created<select className={field} value={company.poolAt} disabled={!!opt} onChange={(e) => setCo({ poolAt: e.target.value as Company["poolAt"] })}><option value="formation">At formation (our documents)</option><option value="preA">Just before Series A</option><option value="none">No pool</option></select></label>
              {fnd && <>
                <p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">Founders and bridge</p>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={fnd.trackB} onChange={(e) => setF({ trackB: e.target.checked })} /> Bridge: angels and FEBO reserve</label>
                <Slider label="Angel bridge raised" value={fnd.bridge} min={0} max={30000} step={1000} show={`${fmtUsd(fnd.bridge)} · ${ngn(fnd.bridge)}`} onChange={(n) => setF({ bridge: n })} disabled={!fnd.trackB} />
                <Slider label="Chimdinma, % of founders' stock" value={fnd.cPct} min={2} max={25} step={0.5} show={`${fnd.cPct}%`} onChange={(n) => setF({ cPct: n })} />
                <Slider label="Akujuobi, % of founders' stock" value={fnd.aPct} min={2} max={25} step={0.5} show={`${fnd.aPct}%`} onChange={(n) => setF({ aPct: n })} />
                <p className="text-xs text-slate">Emmanuel holds the remainder: <span className="font-mono text-ink">{startingSplit(fnd).e.toFixed(1)}%</span></p>
                <p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">Voting</p>
                <label className="block text-xs text-slate">Dual-class stock in effect<select className={field} value={company.dual} onChange={(e) => setCo({ dual: e.target.value as Company["dual"] })}><option value="never">Never</option><option value="last">Only at the last stage</option><option value="all">All stages</option></select></label>
                <Slider label="Class B votes per share" value={company.V} min={2} max={20} step={1} show={`${company.V}x`} onChange={(n) => setCo({ V: n })} />
                <div className="flex flex-wrap gap-3 text-xs">
                  {(["Emmanuel", "Chimdinma", "Akujuobi"] as const).map((n, i) => <label key={n} className="flex items-center gap-1.5"><input type="checkbox" checked={company.classB[i]} onChange={(e) => { const b = [...company.classB] as Company["classB"]; b[i] = e.target.checked; setCo({ classB: b }); }} /> {n} holds Class B</label>)}
                </div>
              </>}
              <p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">Business case</p>
              <Slider label="Registered users" value={business.users} min={5000} max={500000} step={5000} show={business.users.toLocaleString("en-US")} onChange={(n) => setBiz({ users: n })} />
              <Slider label="Paying conversion" value={business.conv} min={0.1} max={3} step={0.05} show={`${business.conv.toFixed(2)}%`} onChange={(n) => setBiz({ conv: n })} />
              <Slider label="Monthly churn" value={business.churn} min={2} max={20} step={1} show={`${business.churn}%`} onChange={(n) => setBiz({ churn: n })} />
              <label className="block text-xs text-slate">Monthly burn (₦)<input className={field} inputMode="numeric" value={business.burn} onChange={(e) => setBiz({ burn: Number(e.target.value) || 0 })} /></label>
              <label className="block text-xs text-slate">Cash on hand (₦)<input className={field} inputMode="numeric" value={business.cash} onChange={(e) => setBiz({ cash: Number(e.target.value) || 0 })} /></label>
              <label className="block text-xs text-slate">₦ per US$<input className={field} inputMode="numeric" value={business.fx} onChange={(e) => setBiz({ fx: Number(e.target.value) || 0 })} /></label>
            </div>

            <div className="min-w-0 space-y-6">
              <div className="card overflow-x-auto p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">Funding rounds (edit any value)</p>
                  <label className="flex items-center gap-2 text-xs text-slate">When I change a raise, keep
                    <select className="rounded border border-rule bg-card px-1.5 py-1 text-xs" value={hold} onChange={(e) => setHold(e.target.value as "stake" | "valuation")}><option value="stake">the share sold (post-money follows)</option><option value="valuation">the post-money</option></select>
                  </label>
                </div>
                <table className="mt-2 w-full text-xs">
                  <thead><tr className="text-left text-slate"><th className="py-1">Round</th><th>On</th><th>Raise (US$)</th><th>Share sold %</th><th>Post-money (US$)</th><th>Pool target after round %</th></tr></thead>
                  <tbody>
                    {company.rounds.map((r, i) => (
                      <tr key={i} className="border-t border-rule">
                        <td className="py-1.5 pr-2">{i === 5 ? <input aria-label="Exit name" className={`${field} !mt-0 w-32`} value={r.name} onChange={(e) => setRound(i, { name: e.target.value })} /> : ROUND_NAMES[i]}</td>
                        <td><input type="checkbox" aria-label={`${ROUND_NAMES[i]} on`} checked={r.on} onChange={(e) => setRound(i, { on: e.target.checked })} /></td>
                        <td className="pr-2"><input aria-label={`${ROUND_NAMES[i]} raise`} className={`${field} !mt-0 w-28`} inputMode="numeric" value={r.raise} onChange={(e) => editRaise(i, Number(e.target.value) || 0)} /><div className="font-mono text-[10px] text-slate">{ngn(r.raise)}</div></td>
                        <td className="pr-2"><input aria-label={`${ROUND_NAMES[i]} share sold`} className={`${field} !mt-0 w-20`} type="number" step="any" min="0" disabled={!r.on} value={r.on && r.post > 0 ? Number(((r.raise / r.post) * 100).toFixed(2)) : 0} onChange={(e) => editStake(i, Number(e.target.value) || 0)} /></td>
                        <td className="pr-2"><input aria-label={`${ROUND_NAMES[i]} post-money`} className={`${field} !mt-0 w-32`} inputMode="numeric" value={r.post} onChange={(e) => setRound(i, { post: Number(e.target.value) || 0 })} /><div className="font-mono text-[10px] text-slate">{ngn(r.post)}</div></td>
                        <td><input aria-label={`${ROUND_NAMES[i]} pool target`} className={`${field} !mt-0 w-16`} inputMode="numeric" value={r.target} onChange={(e) => setRound(i, { target: Number(e.target.value) || 0 })} /><div className="font-mono text-[10px] text-slate">{r.on && rmath[i].t > 0 ? `top-up ${(rmath[i].t * 100).toFixed(2)}%` : "no top-up"}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-slate">The last row is the exit or listing: for an IPO the raise is what the public buys; for a sale set the raise to 0 and the post-money to the price. Pool target: leave 0 for no top-up; set it (for example 15) and the model adds the shares needed to bring the pool back to that size after the round, taken from existing holders.</p>
              </div>

              {model && (
                <div className="card overflow-x-auto p-4">
                  <p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">Who owns what, stage by stage</p>
                  <table className="mt-2 w-full text-xs">
                    <thead><tr className="text-right text-slate"><th className="py-1 text-left">Holder</th>{model.snaps.map((s, i) => <th key={i} className="px-2">{s.name}</th>)}<th className="px-2">Paper value</th></tr></thead>
                    <tbody className="font-mono">
                      {HOLDERS.concat(company.rounds.map((r, i) => (i === 5 ? `${r.name} public float` : `${r.name} investor`))).map((h, k) => {
                        if (!model.snaps.some((s) => s.v[k] > 1e-9)) return null;
                        const own = mine === k;
                        return (
                          <tr key={k} className={`border-t border-rule text-right ${own ? "bg-crimson/10 font-bold text-crimson" : ""}`}>
                            <td className="whitespace-nowrap py-1.5 text-left font-ui">{own ? `${h} (you)` : h}</td>
                            {model.snaps.map((s, i) => <td key={i} className="px-2">{fmtPct(s.v[k])}</td>)}
                            <td className="px-2">{model.finalValue ? money(model.last.v[k] * model.finalValue) : "-"}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-rule text-right"><td className="py-1.5 text-left font-ui">{me === "emmanuel" || mine === undefined ? "Emmanuel's voting power" : "Your voting power"}</td>{model.snaps.map((s, i) => <td key={i} className="px-2">{fmtPct(s.vote[mine ?? 0])}</td>)}<td /></tr>
                      <tr className="text-right"><td className="py-1.5 text-left font-ui">Three founders' voting power</td>{model.snaps.map((s, i) => <td key={i} className="px-2">{fmtPct(s.vote[0] + s.vote[1] + s.vote[2])}</td>)}<td /></tr>
                      <tr className="text-right"><td className="py-1.5 text-left font-ui">Post-money</td>{model.snaps.map((s, i) => <td key={i} className="px-2">{s.post ? money(s.post) : "-"}</td>)}<td /></tr>
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-slate">Paper value is stake × the last post-money. It ignores liquidation preferences, tax and shares not yet granted, so it is not what anyone would receive.</p>
                </div>
              )}

              {opt && (
                <div className="card overflow-x-auto p-4">
                  <p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">Your option, stage by stage</p>
                  <table className="mt-2 w-full text-xs">
                    <thead><tr className="text-right text-slate"><th className="py-1 text-left">&nbsp;</th>{opt.map((s, i) => <th key={i} className="px-2">{s.name}</th>)}</tr></thead>
                    <tbody className="font-mono">
                      <tr className="text-right"><td className="py-1.5 text-left font-ui">Your share of the company</td>{opt.map((s, i) => <td key={i} className="px-2">{fmtPct(s.pct)}</td>)}</tr>
                      <tr className="text-right"><td className="py-1.5 text-left font-ui">Paper value, before exercise price</td>{opt.map((s, i) => <td key={i} className="px-2">{s.post ? money(s.pct * s.post) : "-"}</td>)}</tr>
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-slate">Each round shrinks every holder&apos;s share by the share it sells and any pool top-up; the number of shares in your grant does not change. Only vested options can be exercised, and the exercise price is set from an independent valuation.</p>
                </div>
              )}

              <div className="card p-4">
                <p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">Cash and runway</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Tile label="Net revenue a month" value={naira(rw.mrr)} note={`about ${fmtUsd(rw.mrr / (business.fx || 1333))}`} />
                  <Tile label="Left after burn, a month" value={`${rw.surplus < 0 ? "-" : ""}${naira(Math.abs(rw.surplus))}`} />
                  <Tile label="Break-even conversion" value={`${rw.breakEvenConv.toFixed(2)}%`} />
                  <Tile label="Net revenue, first 12 months" value={naira(rw.cum12)} note={`about ${fmtUsd(rw.cum12 / (business.fx || 1333))}`} />
                  <Tile label="Cash after 12 months" value={`${rw.cashAfter12 < 0 ? "-" : ""}${naira(Math.abs(rw.cashAfter12))}`} />
                  <Tile label="Runway on cash alone" value={Number.isFinite(rw.monthsOnCash) ? `${rw.monthsOnCash.toFixed(1)} months` : "-"} />
                </div>
                <p className="mt-3 text-xs text-slate">Planning case: ₦79.59 of net recurring revenue per user for each 1% of conversion, after gateway fees and the commission given up; churn applies after the first month (100,000 users at 1% is ₦7,958,600 a month).</p>
              </div>

              <div className="card p-4">
                <p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">What to look at</p>
                <ul className="mt-2 space-y-2 text-sm">{notes.map((n, i) => <li key={i} className={n.tone}>{n.text}</li>)}</ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
