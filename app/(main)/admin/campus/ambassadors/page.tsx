"use client";

import { useState } from "react";
import Link from "next/link";
import { CampusPage, Notice, ago, btn, card, input, placeOf, useCampus, useCampusView } from "@/components/campus/CampusKit";
import SelectBox from "@/components/ui/SelectBox";
import type { CampusMember } from "@/lib/campus";

// Admin → Campus → Ambassadors (lib/campus.ts): a coordinator gives her ambassadors access by their #NotesApp @username or email, with
// their campus, and takes it away. They get the Campus pages only (their tasks, their numbers and link), never anything else in the admin
// area. A lead can add someone to a chosen coordinator's team.
export default function CampusAmbassadorsPage() {
  const { me, ready, denied, call } = useCampus();
  const lead = !!me?.lead;
  const coordinator = me?.member?.role === "coordinator";
  const { data, reload, error } = useCampusView<{ team: CampusMember[] }>("team", {}, ready && (lead || coordinator));
  const all = data?.team ?? [];
  const coordinators = all.filter((m) => m.role === "coordinator");
  const ambassadors = all.filter((m) => m.role === "ambassador");
  const names = Object.fromEntries(coordinators.map((c) => [c.uid, c.name]));
  const [f, setF] = useState({ who: "", campus: "", state: "", coordinatorUid: "" });
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (body: Record<string, unknown>, done: string) => {
    setBusy(true); setErr(""); setNote("");
    try { await call({ body }); setNote(done); await reload(); return true; } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); return false; } finally { setBusy(false); }
  };
  const roleDenied = !!me && !lead && !coordinator;

  return (
    <CampusPage title="Ambassadors" me={me} denied={denied || roleDenied}
      intro="Give your ambassadors team access with their #NotesApp @username or email (they sign up first, free). They see their tasks, their sign-ups and their link in Campus, and nothing else in the admin area.">
      <Notice error={err || error} note={note} />
      {(coordinator || lead) && (
        <section className={`${card} mb-5`} aria-labelledby="add">
          <h2 id="add" className="font-ui text-base font-semibold text-ink">Add an ambassador</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block font-ui text-[13px] text-slate">@username or email</span><input className={input} value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} placeholder="@chioma or chioma@example.com" autoComplete="off" /></label>
            <label className="block"><span className="mb-1.5 block font-ui text-[13px] text-slate">Campus</span><input className={input} value={f.campus} maxLength={120} onChange={(e) => setF({ ...f, campus: e.target.value })} placeholder="University of Lagos" /></label>
            <label className="block"><span className="mb-1.5 block font-ui text-[13px] text-slate">State (optional)</span><input className={input} value={f.state} maxLength={40} onChange={(e) => setF({ ...f, state: e.target.value })} placeholder="Lagos" /></label>
            {lead && !coordinator && <SelectBox label="Coordinator" value={f.coordinatorUid} onChange={(coordinatorUid) => setF({ ...f, coordinatorUid })} options={[{ value: "", label: "Choose a coordinator" }, ...coordinators.map((c) => ({ value: c.uid, label: c.name }))]} />}
          </div>
          <button type="button" disabled={busy || !f.who.trim() || !f.campus.trim() || (lead && !coordinator && !f.coordinatorUid)} className={`${btn} mt-4`}
            onClick={() => void act({ action: "ambassador", ...f }, "Added. They've been told in their notifications.").then((ok) => ok && setF({ who: "", campus: "", state: "", coordinatorUid: f.coordinatorUid }))}>
            {busy ? "Adding…" : "Give team access"}
          </button>
        </section>
      )}
      <section className={`${card} p-0`} aria-labelledby="list">
        <h2 id="list" className="p-5 pb-3 font-ui text-base font-semibold text-ink">{lead && !coordinator ? "Every ambassador" : "Your ambassadors"} ({ambassadors.length})</h2>
        {!data ? <p className="px-5 pb-5 font-ui text-sm text-slate">Loading…</p> : ambassadors.length === 0 ? <p className="px-5 pb-5 font-ui text-sm text-slate">No ambassadors yet.</p> : (
          <ul className="divide-y divide-rule border-t border-rule">
            {ambassadors.map((m) => (
              <li key={m.uid} className="flex flex-wrap items-center gap-3 px-5 py-3 font-ui text-sm">
                <span className="min-w-0 flex-1">
                  <Link href={`/u/${m.username}`} className="font-semibold text-ink hover:text-crimson">{m.name}</Link> <span className="text-slate">@{m.username}</span>
                  <span className="block text-xs text-slate">{placeOf(m)}{lead && m.coordinatorUid ? ` · ${names[m.coordinatorUid] ?? "another coordinator"}'s team` : ""} · added {ago(m.addedAt)} · checked in {ago(m.lastCheckIn)}</span>
                </span>
                {(lead || m.coordinatorUid === me?.member?.uid) && (
                  <button type="button" disabled={busy} onClick={() => { if (confirm(`Take ${m.name} off the campus team? They lose access to Campus at once; what they reported on tasks stays.`)) void act({ action: "remove", uid: m.uid }, `${m.name} is off the team.`); }}
                    className="font-semibold text-red-700 disabled:opacity-50">Remove</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </CampusPage>
  );
}
