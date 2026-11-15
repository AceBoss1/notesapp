"use client";

import { useState } from "react";
import Link from "next/link";
import { CampusPage, Notice, ago, btn, btnGhost, card, input, placeOf, useCampus, useCampusView } from "@/components/campus/CampusKit";
import SelectBox from "@/components/ui/SelectBox";
import { CAMPUS_COUNTRIES, type CampusMember } from "@/lib/campus";

// Admin → Campus → Coordinators (lib/campus.ts): super admins, the Chief of Staff and Marketing appoint each country's coordinators (we start
// with Nigeria), move a coordinator's ambassadors to another, and remove a coordinator once her team has moved.
export default function CampusCoordinatorsPage() {
  const { me, ready, denied, call } = useCampus();
  const lead = !!me?.lead;
  const [country, setCountry] = useState<string>("NG");
  const { data, reload, error } = useCampusView<{ team: CampusMember[] }>("team", { country }, ready && lead);
  const all = data?.team ?? [];
  const coordinators = all.filter((m) => m.role === "coordinator");
  const size = (uid: string) => all.filter((m) => m.coordinatorUid === uid).length;
  const [f, setF] = useState({ who: "", campus: "", state: "" });
  const [move, setMove] = useState({ from: "", to: "" });
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (body: Record<string, unknown>, done: string) => {
    setBusy(true); setErr(""); setNote("");
    try { await call({ body }); setNote(done); await reload(); return true; } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); return false; } finally { setBusy(false); }
  };

  return (
    <CampusPage title="Coordinators" me={me} denied={denied || (!!me && !lead)}
      intro="Each country's campus coordinators. A coordinator gives her own ambassadors access, assigns them tasks and follows how they're doing; she sees only her own team.">
      <Notice error={err || error} note={note} />
      <div className="mb-5 max-w-xs"><SelectBox label="Country" value={country} onChange={setCountry} options={CAMPUS_COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` }))} /></div>
      <section className={`${card} mb-5`} aria-labelledby="appoint">
        <h2 id="appoint" className="font-ui text-base font-semibold text-ink">Appoint a coordinator</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="mb-1.5 block font-ui text-[13px] text-slate">@username or email</span><input className={input} value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} autoComplete="off" /></label>
          <label className="block"><span className="mb-1.5 block font-ui text-[13px] text-slate">Region or campus (optional)</span><input className={input} value={f.campus} maxLength={120} onChange={(e) => setF({ ...f, campus: e.target.value })} placeholder="South West" /></label>
          <label className="block"><span className="mb-1.5 block font-ui text-[13px] text-slate">State (optional)</span><input className={input} value={f.state} maxLength={40} onChange={(e) => setF({ ...f, state: e.target.value })} /></label>
        </div>
        <button type="button" disabled={busy || !f.who.trim()} className={`${btn} mt-4`}
          onClick={() => void act({ action: "coordinator", country, ...f }, "Appointed. They've been told in their notifications.").then((ok) => ok && setF({ who: "", campus: "", state: "" }))}>Appoint</button>
      </section>

      <section className={`${card} mb-5 p-0`} aria-labelledby="coords">
        <h2 id="coords" className="p-5 pb-3 font-ui text-base font-semibold text-ink">Coordinators ({coordinators.length})</h2>
        {!data ? <p className="px-5 pb-5 font-ui text-sm text-slate">Loading…</p> : coordinators.length === 0 ? <p className="px-5 pb-5 font-ui text-sm text-slate">None yet in this country.</p> : (
          <ul className="divide-y divide-rule border-t border-rule">
            {coordinators.map((c) => (
              <li key={c.uid} className="flex flex-wrap items-center gap-3 px-5 py-3 font-ui text-sm">
                <span className="min-w-0 flex-1">
                  <Link href={`/u/${c.username}`} className="font-semibold text-ink hover:text-crimson">{c.name}</Link> <span className="text-slate">@{c.username}</span>
                  <span className="block text-xs text-slate">{placeOf(c)} · {size(c.uid)} ambassador{size(c.uid) === 1 ? "" : "s"} · checked in {ago(c.lastCheckIn)}</span>
                </span>
                <button type="button" disabled={busy} onClick={() => { if (confirm(`Remove ${c.name} as coordinator?`)) void act({ action: "remove", uid: c.uid }, `${c.name} is no longer a coordinator.`); }} className="font-semibold text-red-700 disabled:opacity-50">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {coordinators.length > 1 && (
        <section className={card} aria-labelledby="move">
          <h2 id="move" className="font-ui text-base font-semibold text-ink">Move a team</h2>
          <p className="mt-1 font-ui text-sm text-slate">All of one coordinator&apos;s ambassadors go to another (for example before she leaves). Tasks already given stay with the first.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SelectBox label="From" value={move.from} onChange={(from) => setMove({ ...move, from })} options={[{ value: "", label: "Choose" }, ...coordinators.map((c) => ({ value: c.uid, label: `${c.name} (${size(c.uid)})` }))]} />
            <SelectBox label="To" value={move.to} onChange={(to) => setMove({ ...move, to })} options={[{ value: "", label: "Choose" }, ...coordinators.filter((c) => c.uid !== move.from).map((c) => ({ value: c.uid, label: c.name }))]} />
          </div>
          <button type="button" disabled={busy || !move.from || !move.to} className={`${btnGhost} mt-4`} onClick={() => void act({ action: "move", ...move }, "Team moved. The ambassadors have been told.")}>Move the team</button>
        </section>
      )}
    </CampusPage>
  );
}
