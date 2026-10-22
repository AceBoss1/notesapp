"use client";
import { communityUrl } from "./place";

import { useCallback, useEffect, useState } from "react";
import { uploadToR2 } from "@/lib/upload";
import { JOIN_MODES, QUESTIONS_MAX, SLOW_MODES, SPACES_MAX, can, type PublicView, type Role, type Space } from "@/lib/community";
import { capi, field, small, ago } from "./api";

// The admin tools (what Facebook gives a group's admins, made simpler): requests to join with their answers, settings (name, pictures,
// about and contact, how people join, join questions, what non-members see, slow mode, Spaces), the invite link, banned members and
// insights. Moderators see the requests and the banned.
type Settings = { name: string; tagline: string; about: string; contact: string; avatar: string; cover: string; joinMode: string; questions: string[]; publicView: PublicView; slowModeSec: number; spaces: Space[] };
type Req = { uid: string; username: string; displayName: string; avatar: string; joinedAt: string; answers?: string[] };
type Insights = { members: number; pending: number; banned: number; joined7: number; joined30: number; posts30: number; comments30: number; activeMembers30: number; topContributors: { name: string; n: number }[] };

export default function Admin({ cid, role, questions, initial, inviteCode, onSaved }: { cid: string; role: Role; questions: string[]; initial: Settings | null; inviteCode?: string; onSaved: () => void }) {
  return (
    <div className="space-y-8">
      <Requests cid={cid} questions={questions} onChange={onSaved} />
      {can(role, "insights") && <InsightsCard cid={cid} />}
      {can(role, "settings") && initial && <SettingsForm cid={cid} initial={initial} onSaved={onSaved} />}
      {can(role, "settings") && <InviteCard cid={cid} code={inviteCode} />}
      <Banned cid={cid} />
    </div>
  );
}

function Requests({ cid, questions, onChange }: { cid: string; questions: string[]; onChange: () => void }) {
  const [list, setList] = useState<Req[] | null>(null);
  const load = useCallback(() => capi<{ members: Req[] }>(`/api/community?id=${cid}&members=pending`).then((d) => setList(d.members)).catch(() => setList([])), [cid]);
  useEffect(() => { load(); }, [load]);
  const decide = async (uid: string, approve: boolean) => { await capi("/api/community", { action: "decide", id: cid, uid, approve }).catch((e) => alert(e.message)); load(); onChange(); };
  return (
    <section className="card p-5">
      <h3 className="font-display text-xl text-ink">Requests to join</h3>
      {list === null ? <p className="mt-2 text-sm text-slate">Loading…</p> : !list.length ? <p className="mt-2 text-sm text-slate">No one is waiting.</p> : (
        <ul className="mt-3 divide-y divide-rule">{list.map((r) => (
          <li key={r.uid} className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1"><span className="font-ui text-sm font-bold text-ink">{r.displayName}</span> <span className="text-xs text-slate">@{r.username} · asked {ago(r.joinedAt)}</span></span>
              <button className="btn-primary !px-3 !py-1 text-xs" onClick={() => decide(r.uid, true)}>Approve</button>
              <button className={small} onClick={() => decide(r.uid, false)}>Decline</button>
            </div>
            {r.answers?.some(Boolean) && <dl className="mt-2 space-y-1 text-xs">{questions.map((q, i) => <div key={i}><dt className="text-slate">{q}</dt><dd className="text-ink">{r.answers?.[i] || "—"}</dd></div>)}</dl>}
          </li>
        ))}</ul>
      )}
    </section>
  );
}

function InsightsCard({ cid }: { cid: string }) {
  const [d, setD] = useState<Insights | null>(null);
  useEffect(() => { capi<{ insights: Insights }>(`/api/community?id=${cid}&insights=1`).then((r) => setD(r.insights)).catch(() => {}); }, [cid]);
  if (!d) return null;
  const tiles: [string, number][] = [["Members", d.members], ["Joined this week", d.joined7], ["Joined in 30 days", d.joined30], ["Active in 30 days", d.activeMembers30], ["Posts in 30 days", d.posts30], ["Comments in 30 days", d.comments30], ["Waiting to join", d.pending], ["Banned", d.banned]];
  return (
    <section className="card p-5">
      <h3 className="font-display text-xl text-ink">Insights</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{tiles.map(([k, v]) => <div key={k} className="rounded-xl bg-paper p-3"><p className="text-xs text-slate">{k}</p><p className="font-display text-2xl text-ink">{v}</p></div>)}</div>
      {d.topContributors.length > 0 && <p className="mt-3 text-xs text-slate">Most active this month: {d.topContributors.map((t) => `${t.name} (${t.n})`).join(", ")}</p>}
    </section>
  );
}

function Picture({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {value ? <img src={value} alt="" className="h-14 w-20 rounded-lg object-cover" /> : <span className="flex h-14 w-20 items-center justify-center rounded-lg border border-dashed border-rule text-slate">🖼️</span>}
      <label className={`${small} cursor-pointer`}>{busy ? "Uploading…" : value ? `Change ${label}` : `Add ${label}`}<input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy(true); try { onChange(await uploadToR2(f, "journal")); } finally { setBusy(false); } }} /></label>
      {value && <button className="text-xs text-slate underline" onClick={() => onChange("")}>Remove</button>}
    </div>
  );
}

const VIEW_LABELS: [keyof PublicView, string][] = [
  ["general", "The General channel (read only, with slow mode for members)"], ["about", "About"], ["contact", "Contact"],
  ["events", "Public events"], ["members", "The member list"], ["join", "A Join button"],
];
function SettingsForm({ cid, initial, onSaved }: { cid: string; initial: Settings; onSaved: () => void }) {
  const [s, setS] = useState<Settings>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true); setMsg("");
    try { await capi("/api/community", { action: "settings", id: cid, settings: s }); setMsg("Saved."); onSaved(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save."); }
    finally { setBusy(false); }
  }
  return (
    <section className="card p-5">
      <h3 className="font-display text-xl text-ink">Settings</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate">Name<input value={s.name} onChange={(e) => set("name", e.target.value)} maxLength={60} className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate">One line about you<input value={s.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={140} className={`${field} mt-1`} /></label>
        <Picture value={s.avatar} label="logo" onChange={(v) => set("avatar", v)} />
        <Picture value={s.cover} label="cover" onChange={(v) => set("cover", v)} />
        <label className="text-xs text-slate sm:col-span-2">About<textarea value={s.about} onChange={(e) => set("about", e.target.value)} maxLength={4000} rows={4} className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate sm:col-span-2">Contact (address, phone, email, service times)<textarea value={s.contact} onChange={(e) => set("contact", e.target.value)} maxLength={1000} rows={3} className={`${field} mt-1`} /></label>
      </div>

      <h4 className="mt-6 font-ui text-sm font-bold text-ink">How people join</h4>
      <div className="mt-2 space-y-1 text-sm">{JOIN_MODES.map((m) => <label key={m.id} className="flex items-center gap-2"><input type="radio" checked={s.joinMode === m.id} onChange={() => set("joinMode", m.id)} />{m.label}</label>)}</div>
      <p className="mt-3 text-xs text-slate">Join questions (asked when people ask to join; up to {QUESTIONS_MAX}), e.g. &ldquo;Which branch do you attend?&rdquo;</p>
      {s.questions.map((q, i) => <div key={i} className="mt-1 flex gap-2"><input value={q} maxLength={200} onChange={(e) => set("questions", s.questions.map((x, j) => (j === i ? e.target.value : x)))} className={field} aria-label={`Question ${i + 1}`} /><button className={small} onClick={() => set("questions", s.questions.filter((_, j) => j !== i))}>Remove</button></div>)}
      {s.questions.length < QUESTIONS_MAX && <button className={`${small} mt-2`} onClick={() => set("questions", [...s.questions, ""])}>+ Add a question</button>}

      <h4 className="mt-6 font-ui text-sm font-bold text-ink">What people who aren&apos;t members see</h4>
      <p className="text-xs text-slate">Your home page (name, pictures and the line about you) always shows. Choose the rest.</p>
      <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{VIEW_LABELS.map(([k, label]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={s.publicView[k]} onChange={(e) => set("publicView", { ...s.publicView, [k]: e.target.checked })} />{label}</label>)}</div>
      <label className="mt-4 flex items-center gap-2 text-sm">Slow mode for members
        <select value={s.slowModeSec} onChange={(e) => set("slowModeSec", Number(e.target.value))} className="rounded-lg border border-rule bg-card px-2 py-1">
          {SLOW_MODES.map((n) => <option key={n} value={n}>{n === 0 ? "Off" : n < 60 ? `${n} seconds` : `${n / 60} minute${n === 60 ? "" : "s"}`}</option>)}
        </select>
      </label>

      <h4 className="mt-6 font-ui text-sm font-bold text-ink">Spaces</h4>
      <p className="text-xs text-slate">Public Spaces anyone can read; members-only Spaces never leave the community. General is always there, for announcements.</p>
      {s.spaces.map((sp, i) => (
        <div key={i} className="mt-2 grid gap-2 sm:grid-cols-[1fr,9rem,10rem,auto]">
          <input value={sp.name} maxLength={40} onChange={(e) => set("spaces", s.spaces.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={field} aria-label="Space name" />
          <select value={sp.visibility} onChange={(e) => set("spaces", s.spaces.map((x, j) => (j === i ? { ...x, visibility: e.target.value as Space["visibility"] } : x)))} className={field} aria-label="Who can read"><option value="public">Public</option><option value="members">Members only</option></select>
          <select value={sp.whoPosts} onChange={(e) => set("spaces", s.spaces.map((x, j) => (j === i ? { ...x, whoPosts: e.target.value as Space["whoPosts"] } : x)))} className={field} aria-label="Who can post"><option value="members">Members post</option><option value="admins">Admins post</option></select>
          <button className={small} onClick={() => set("spaces", s.spaces.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      {s.spaces.length < SPACES_MAX && <button className={`${small} mt-2`} onClick={() => set("spaces", [...s.spaces, { id: "", name: "", visibility: "members", whoPosts: "members" }])}>+ Add a Space</button>}

      <div className="mt-6 flex items-center gap-3"><button className="btn-primary !px-4 !py-2 text-xs" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save settings"}</button>{msg && <span className="text-sm text-ink" role="status">{msg}</span>}</div>
    </section>
  );
}

function InviteCard({ cid, code: initial }: { cid: string; code?: string }) {
  const [code, setCode] = useState(initial ?? "");
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" && code ? communityUrl(cid, `?invite=${code}`) : "";
  return (
    <section className="card p-5">
      <h3 className="font-display text-xl text-ink">Invite link</h3>
      <p className="mt-1 text-xs text-slate">Anyone with this link joins straight away, whatever your join setting. Make a new one to stop the old one working.</p>
      <div className="mt-2 flex flex-wrap gap-2"><input readOnly value={link} className={`${field} min-w-0 flex-1 font-mono text-xs`} aria-label="Invite link" />
        <button className={small} onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button>
        <button className={small} onClick={async () => { const r = await capi<{ inviteCode: string }>("/api/community", { action: "invite_rotate", id: cid }); setCode(r.inviteCode); setCopied(false); }}>Make a new link</button>
      </div>
    </section>
  );
}

function Banned({ cid }: { cid: string }) {
  const [list, setList] = useState<Req[] | null>(null);
  const load = useCallback(() => capi<{ members: Req[] }>(`/api/community?id=${cid}&members=banned`).then((d) => setList(d.members)).catch(() => setList([])), [cid]);
  useEffect(() => { load(); }, [load]);
  if (!list?.length) return null;
  return (
    <section className="card p-5">
      <h3 className="font-display text-xl text-ink">Banned</h3>
      <ul className="mt-2 divide-y divide-rule">{list.map((m) => <li key={m.uid} className="flex items-center gap-3 py-2 text-sm"><span className="flex-1">{m.displayName || m.uid} {m.username && <span className="text-xs text-slate">@{m.username}</span>}</span><button className={small} onClick={async () => { await capi("/api/community", { action: "unban", id: cid, uid: m.uid }); load(); }}>Unban</button></li>)}</ul>
    </section>
  );
}
