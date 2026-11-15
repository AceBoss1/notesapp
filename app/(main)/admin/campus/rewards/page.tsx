"use client";

import { useState } from "react";
import { CampusPage, Notice, btn, btnGhost, card, input, useCampus, useCampusView } from "@/components/campus/CampusKit";
import SelectBox from "@/components/ui/SelectBox";
import { CAMPUS_COUNTRIES, LEVELS, REWARD_KINDS, campusDay, countryName, rewardKind, type CampusReward, type RewardClaim, type RewardKind } from "@/lib/campus";
import { NIGERIAN_STATES } from "@/lib/merch";

// Admin → Campus → Rewards (lib/campus.ts; owner, 15 Nov 2026: "add ... partner rewards, also we want to offer our merchs to them").
// Ambassadors see the rewards for their country, whether they can claim each (and what's missing when they can't), and their claims;
// #NotesApp merch is free, sent to the address they give. The programme's leads post rewards and approve or decline claims (an approved
// merch claim goes to Admin → Merch to be printed and sent); coordinators follow their team's claims.
type Row = CampusReward & { left: number | null };
type Data = { rewards: Row[]; mine: RewardClaim[]; claims: RewardClaim[]; eligible: Record<string, { ok: boolean; why?: string }>; merch: { id: string; name: string; sizes: string[] }[] };
const STATUS: Record<RewardClaim["status"], string> = { pending: "bg-amber-50 text-amber-800", approved: "bg-green-50 text-green-700", declined: "bg-red-50 text-red-700" };

export default function CampusRewardsPage() {
  const { me, ready, denied, call } = useCampus();
  const lead = !!me?.lead;
  const ambassador = me?.member?.role === "ambassador" && !lead;
  const { data, error, reload } = useCampusView<Data>("rewards", {}, ready);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const act = async (body: Record<string, unknown>, done: string) => {
    setBusy(true); setErr(""); setNote("");
    try { await call({ body }); setNote(done); await reload(); return true; } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); return false; } finally { setBusy(false); }
  };
  const mine = Object.fromEntries((data?.mine ?? []).map((c) => [c.rewardId, c]));
  const merchName = (id?: string) => data?.merch.find((m) => m.id === id)?.name;

  return (
    <CampusPage title="Rewards" me={me} denied={denied}
      intro={ambassador ? "Internships and scholarships from our partners, perks, and #NotesApp merch for ambassadors. Each says who can claim it; your level and your place on the board count." : "Partner rewards and #NotesApp merch for ambassadors, and their claims."}>
      <Notice error={err || error} note={note} />
      {lead && <NewReward busy={busy} merch={data?.merch ?? []} onSave={(b) => act({ action: "reward", ...b }, "Reward posted. The ambassadors it's for have been told.")} />}

      {!data ? <p className="font-ui text-sm text-slate">Loading…</p> : data.rewards.length === 0 ? <p className={`${card} font-ui text-sm text-slate`}>No rewards right now. New ones appear here, and you&apos;ll get a notification.</p> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.rewards.map((r) => {
            const k = rewardKind(r.kind);
            const claim = mine[r.id];
            const el = data.eligible[r.id];
            const rules = [r.minLevel && `${LEVELS.find((l) => l.name === r.minLevel)?.emoji ?? ""} ${r.minLevel} or above`, r.topN && `Top ${r.topN} this month`, r.leadsOnly && "Campus Leads", r.left !== null && `${r.left} place${r.left === 1 ? "" : "s"} left`].filter(Boolean);
            return (
              <li key={r.id} className={`${card} flex flex-col ${!r.active ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-3">
                  <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-crimson-bright/10 text-2xl">{k.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-crimson-bright">{k.label}{r.partner && r.partner !== "#NotesApp" ? ` · ${r.partner}` : ""}</span>
                    <h2 className="font-ui text-base font-semibold text-ink">{r.title}</h2>
                    <p className="font-ui text-xs text-slate">{r.country === "all" ? "Every country" : countryName(r.country)} · claim by {r.closesOn}{!r.active ? " · closed" : ""}</p>
                  </span>
                </div>
                {r.kind === "merch" && <p className="mt-2 font-ui text-sm text-ink">Free {merchName(r.merchItemId) ?? "merch"}, sent to you.</p>}
                {r.details && <p className="mt-2 whitespace-pre-line font-ui text-sm text-slate">{r.details}</p>}
                {r.partnerUrl && <a href={r.partnerUrl} target="_blank" rel="noopener noreferrer" className="mt-2 font-ui text-sm font-semibold text-crimson underline">About {r.partner}</a>}
                {rules.length > 0 && <p className="mt-3 flex flex-wrap gap-1.5">{rules.map((x) => <span key={String(x)} className="rounded-full bg-field px-2.5 py-0.5 font-ui text-xs text-ink">{x}</span>)}</p>}
                <div className="mt-auto pt-4">
                  {ambassador && (claim && claim.status !== "declined" ? (
                    <p className={`rounded-[10px] px-3 py-2 font-ui text-sm font-semibold ${STATUS[claim.status]}`}>{claim.status === "pending" ? "Claimed: waiting for a decision" : r.kind === "merch" ? "Approved: your merch is on the way" : "Approved 🎉"}</p>
                  ) : claiming === r.id ? (
                    <ClaimForm r={r} country={me?.member?.country ?? "NG"} sizes={data.merch.find((m) => m.id === r.merchItemId)?.sizes ?? []} busy={busy}
                      onCancel={() => setClaiming(null)} onClaim={(b) => act({ action: "claim", id: r.id, ...b }, "Claimed. You'll get a notification when it's decided.").then((ok) => ok && setClaiming(null))} />
                  ) : (
                    <>
                      {claim?.status === "declined" && <p className="mb-2 font-ui text-xs text-red-700">Not approved last time: {claim.decisionNote}</p>}
                      {el?.ok ? <button type="button" onClick={() => setClaiming(r.id)} className={btn}>Claim</button> : <p className="font-ui text-sm text-slate">🔒 {el?.why}</p>}
                    </>
                  ))}
                  {lead && r.active && <button type="button" disabled={busy} onClick={() => { if (confirm(`Close "${r.title}"? Ambassadors won't see it any more; claims already made stay.`)) void act({ action: "closeReward", id: r.id }, "Closed."); }} className={btnGhost}>Close it</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!ambassador && data && (
        <section className={`${card} mt-6 p-0`} aria-labelledby="claims">
          <h2 id="claims" className="p-5 pb-3 font-ui text-base font-semibold text-ink">Claims ({data.claims.length})</h2>
          {data.claims.length === 0 ? <p className="px-5 pb-5 font-ui text-sm text-slate">No claims yet.</p> : (
            <ul className="divide-y divide-rule border-t border-rule">
              {data.claims.map((c) => <ClaimRow key={c.id} c={c} lead={lead} busy={busy} onDecide={(verdict, n) => act({ action: "decide", id: c.id, verdict, note: n }, verdict === "approved" ? (c.kind === "merch" ? "Approved. It's in Admin → Merch to be printed and sent." : "Approved.") : "Declined.")} />)}
            </ul>
          )}
        </section>
      )}
    </CampusPage>
  );
}

function ClaimForm({ r, country, sizes, busy, onClaim, onCancel }: { r: Row; country: string; sizes: string[]; busy: boolean; onClaim: (b: Record<string, unknown>) => void; onCancel: () => void }) {
  const [f, setF] = useState({ note: "", size: sizes[0] ?? "", fullName: "", phone: "", street: "", city: "", state: country === "NG" ? "Lagos" : "" });
  const merch = r.kind === "merch";
  return (
    <div className="space-y-3 rounded-[10px] border border-rule bg-paper p-3">
      {merch && sizes.length > 0 && <SelectBox label="Size" value={f.size} onChange={(size) => setF({ ...f, size })} options={sizes.map((s) => ({ value: s, label: s }))} />}
      {merch && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={input} placeholder="Full name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} autoComplete="name" />
          <input className={input} placeholder={country === "NG" ? "Phone (080…)" : "Phone (+254…)"} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" />
          <input className={`${input} sm:col-span-2`} placeholder="Street address" value={f.street} onChange={(e) => setF({ ...f, street: e.target.value })} autoComplete="street-address" />
          <input className={input} placeholder="City or town" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          {country === "NG"
            ? <SelectBox label="State" hideLabel value={f.state} onChange={(state) => setF({ ...f, state })} options={NIGERIAN_STATES.map((s) => ({ value: s, label: s }))} />
            : <input className={input} placeholder={`Region and country, e.g. Nairobi County, ${countryName(country)}`} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} />}
        </div>
      )}
      <textarea rows={2} className={input} placeholder={merch ? "Anything we should know (optional)" : "Why you'd be great for this (optional)"} value={f.note} maxLength={1000} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => onClaim({ note: f.note, ...(merch ? { size: f.size || undefined, address: { fullName: f.fullName, phone: f.phone, street: f.street, city: f.city, state: f.state } } : {}) })} className={btn}>{busy ? "Sending…" : "Send my claim"}</button>
        <button type="button" onClick={onCancel} className={btnGhost}>Cancel</button>
      </div>
    </div>
  );
}

function ClaimRow({ c, lead, busy, onDecide }: { c: RewardClaim; lead: boolean; busy: boolean; onDecide: (v: "approved" | "declined", note: string) => Promise<boolean> }) {
  const [decline, setDecline] = useState<string | null>(null);
  return (
    <li className="px-5 py-3 font-ui text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <b className="min-w-0 flex-1 truncate text-ink">{c.name} <span className="font-normal text-slate">· {c.campus}, {countryName(c.country)}</span></b>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[c.status]}`}>{c.status === "pending" ? "Waiting" : c.status === "approved" ? "Approved" : "Declined"}</span>
      </div>
      <p className="mt-0.5 text-[13px] text-slate">{rewardKind(c.kind).emoji} {c.rewardTitle}{c.size ? ` · size ${c.size}` : ""}{c.address ? ` · to ${c.address.city}, ${c.address.state}` : ""}{c.note ? ` · “${c.note}”` : ""}</p>
      {c.decisionNote && <p className="mt-0.5 text-[13px] text-slate">Note: {c.decisionNote}</p>}
      {lead && c.status === "pending" && (decline === null ? (
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={busy} onClick={() => void onDecide("approved", "")} className="rounded-full bg-green-700 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Approve</button>
          <button type="button" disabled={busy} onClick={() => setDecline("")} className="rounded-full border border-rule px-4 py-1.5 text-xs font-semibold text-ink">Decline</button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <input className={`${input} min-w-0 flex-1`} value={decline} onChange={(e) => setDecline(e.target.value)} placeholder="Why (they'll see this)" />
          <button type="button" disabled={busy || !decline.trim()} onClick={() => void onDecide("declined", decline).then((ok) => ok && setDecline(null))} className={btnGhost}>Decline</button>
          <button type="button" onClick={() => setDecline(null)} className="text-sm text-slate">Cancel</button>
        </div>
      ))}
    </li>
  );
}

function NewReward({ busy, merch, onSave }: { busy: boolean; merch: { id: string; name: string }[]; onSave: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const blank = { country: "NG", kind: "merch" as RewardKind, title: "", partner: "", partnerUrl: "", details: "", merchItemId: "tshirt", minLevel: "Rookie", topN: "", leadsOnly: false, slots: "", closesOn: "" };
  const [f, setF] = useState(blank);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={`${btn} mb-5`}>+ New reward</button>;
  const label = (t: string, el: React.ReactNode, wide = false) => <label className={`block ${wide ? "sm:col-span-2" : ""}`}><span className="mb-1.5 block font-ui text-[13px] text-slate">{t}</span>{el}</label>;
  return (
    <section className={`${card} mb-5`} aria-labelledby="new-reward">
      <h2 id="new-reward" className="font-ui text-base font-semibold text-ink">New reward</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SelectBox label="Kind" value={f.kind} onChange={(kind) => setF({ ...f, kind })} options={REWARD_KINDS.map((k) => ({ value: k.id, label: `${k.emoji} ${k.label}` }))} />
        <SelectBox label="Country" value={f.country} onChange={(country) => setF({ ...f, country })} options={[...CAMPUS_COUNTRIES.map((c) => ({ value: c.code as string, label: `${c.flag} ${c.name}` })), { value: "all", label: "Every country" }]} />
        {label("Title", <input className={input} value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={f.kind === "merch" ? "Welcome T-shirt" : "Summer internship"} />, true)}
        {f.kind === "merch"
          ? <SelectBox label="Merch item (free to them)" value={f.merchItemId} onChange={(merchItemId) => setF({ ...f, merchItemId })} options={merch.map((m) => ({ value: m.id, label: m.name }))} />
          : label("Partner", <input className={input} value={f.partner} maxLength={80} onChange={(e) => setF({ ...f, partner: e.target.value })} placeholder="Company name" />)}
        {f.kind !== "merch" && label("Partner link (optional)", <input className={input} value={f.partnerUrl} onChange={(e) => setF({ ...f, partnerUrl: e.target.value })} placeholder="https://" />)}
        {label("Last day to claim", <input type="date" className={input} min={campusDay("GH")} value={f.closesOn} onChange={(e) => setF({ ...f, closesOn: e.target.value })} />)}
        <SelectBox label="Lowest level" value={f.minLevel} onChange={(minLevel) => setF({ ...f, minLevel })} options={LEVELS.map((l) => ({ value: l.name as string, label: l.min ? `${l.emoji} ${l.name} (${l.min}+ points)` : "Anyone" }))} />
        {label("Only the top N this month (optional)", <input type="number" min={1} className={input} value={f.topN} onChange={(e) => setF({ ...f, topN: e.target.value })} />)}
        {label("Places (optional)", <input type="number" min={1} className={input} value={f.slots} onChange={(e) => setF({ ...f, slots: e.target.value })} />)}
        {label("Details (optional)", <textarea rows={3} className={input} value={f.details} maxLength={2000} onChange={(e) => setF({ ...f, details: e.target.value })} />, true)}
        <label className="flex items-center gap-2 font-ui text-sm text-ink sm:col-span-2"><input type="checkbox" checked={f.leadsOnly} onChange={(e) => setF({ ...f, leadsOnly: e.target.checked })} /> Campus Leads only</label>
      </div>
      <div className="mt-5 flex gap-2">
        <button type="button" disabled={busy || !f.title.trim() || !f.closesOn} className={btn}
          onClick={() => void onSave({ ...f, partner: f.kind === "merch" ? "#NotesApp" : f.partner, partnerUrl: f.partnerUrl || undefined, topN: f.topN || undefined, slots: f.slots || undefined }).then((ok) => { if (ok) { setOpen(false); setF(blank); } })}>Post the reward</button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Cancel</button>
      </div>
    </section>
  );
}
