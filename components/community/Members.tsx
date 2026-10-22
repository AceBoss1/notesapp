"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DEFAULT_AVATAR } from "@/lib/admin";
import { GROUP_MEMBERS_MAX } from "@/lib/messages-rules";
import { can, canActOn, canGiveRole, roleName, type Role } from "@/lib/community";
import { capi, field, small } from "./api";
import { mainHref } from "./place";

// The member list (members only, unless the admins show it publicly): roles first, then names, never phone numbers. Moderators and
// admins can remove or ban those below them; admins make moderators; the owner makes admins.
type M = { uid: string; username: string; displayName: string; avatar: string; role: Role; joinedAt: string };

export function useMembers(cid: string, as: string) {
  const [list, setList] = useState<M[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => capi<{ members: M[] }>(`/api/community?id=${cid}&members=active${as ? `&as=${as}` : ""}`).then((d) => { setList(d.members); setErr(""); }).catch((e) => { setErr(e.message); setList([]); }), [cid, as]);
  useEffect(() => { load(); }, [load]);
  return { list, err, load };
}

export default function Members({ cid, role, me, as }: { cid: string; role: Role | null; me: string | null; as: string }) {
  const { list, err, load } = useMembers(cid, as);
  const [q, setQ] = useState("");
  const act = async (body: Record<string, unknown>, ask?: string) => { if (ask && !confirm(ask)) return; try { await capi("/api/community", { id: cid, ...body }); load(); } catch (e) { alert(e instanceof Error ? e.message : "Couldn't do that."); } };
  const shown = (list ?? []).filter((m) => !q.trim() || `${m.displayName} ${m.username}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members" className={`${field} max-w-xs`} aria-label="Search members" />
      {err && <p className="mt-3 text-sm text-crimson">{err}</p>}
      {list === null ? <p className="mt-4 text-sm text-slate">Loading…</p> : (
        <ul className="mt-4 divide-y divide-rule rounded-2xl border border-rule bg-card">
          {shown.map((m) => (
            <li key={m.uid} className="flex flex-wrap items-center gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.avatar || DEFAULT_AVATAR} alt="" className="h-9 w-9 rounded-full object-cover" />
              <Link href={mainHref(`/u/${m.username}`)} className="min-w-0 flex-1"><span className="block truncate font-ui text-sm font-bold text-ink">{m.displayName}</span><span className="text-xs text-slate">@{m.username}{m.role !== "member" ? ` · ${roleName(m.role)}` : ""}</span></Link>
              {m.uid !== me && canActOn(role, m.role) && (
                <span className="flex flex-wrap gap-2">
                  {can(role, "set_role") && (
                    <select value={m.role} onChange={(e) => act({ action: "role", uid: m.uid, role: e.target.value })} className="rounded-lg border border-rule bg-card px-2 py-1 text-xs" aria-label="Role">
                      {(["member", "moderator", "admin"] as Role[]).filter((r) => r === m.role || canGiveRole(role, r)).map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
                    </select>
                  )}
                  <button className={small} onClick={() => act({ action: "remove", uid: m.uid }, `Remove ${m.displayName}? They can ask to join again.`)}>Remove</button>
                  <button className={small} onClick={() => act({ action: "ban", uid: m.uid }, `Ban ${m.displayName}? They can't come back until you unban them.`)}>Ban</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Circles: private rooms inside the community, each its own group chat (Business; up to the group-chat size for now).
type C = { id: string; title: string; members: number; mine: boolean };
export function Circles({ cid, role, allowed, as, me }: { cid: string; role: Role | null; allowed: boolean; as: string; me: string | null }) {
  const [list, setList] = useState<C[] | null>(null);
  const [title, setTitle] = useState("");
  const [pick, setPick] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const { list: members } = useMembers(cid, as);
  const load = useCallback(() => capi<{ circles: C[] }>(`/api/community?id=${cid}&circles=1`).then((d) => setList(d.circles)).catch(() => setList([])), [cid]);
  useEffect(() => { load(); }, [load]);
  async function create() {
    setErr("");
    try { await capi("/api/community", { action: "circle", id: cid, title, memberUids: pick }); setTitle(""); setPick([]); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't create it."); }
  }
  return (
    <div>
      {!allowed && <p className="card p-4 text-sm text-slate">Circles, private rooms for your teams (the choir, the youth, ushers, the board), come with Business.</p>}
      {list === null ? <p className="mt-4 text-sm text-slate">Loading…</p> : !list.length ? <p className="mt-4 text-sm text-slate">{can(role, "circles") ? "No Circles yet." : "You're not in any Circle yet."}</p> : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">{list.map((c) => (
          <li key={c.id} className="card flex items-center gap-3 p-4">
            <span className="min-w-0 flex-1"><span className="block font-ui text-sm font-bold text-ink">{c.title}</span><span className="text-xs text-slate">{c.members} {c.members === 1 ? "person" : "people"}</span></span>
            {c.mine && <Link href={mainHref(`/messages/${c.id}`)} className={small}>Open chat</Link>}
          </li>
        ))}</ul>
      )}
      {allowed && can(role, "circles") && (
        <div className="card mt-6 p-4">
          <p className="font-ui text-sm font-bold text-ink">New Circle</p>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Name, e.g. Choir" className={`${field} mt-2`} aria-label="Circle name" />
          <p className="mt-3 text-xs text-slate">Who&apos;s in it (up to {GROUP_MEMBERS_MAX - 1} besides you):</p>
          <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-rule p-2">
            {(members ?? []).filter((m) => m.uid && m.uid !== me).map((m) => <label key={m.uid} className="flex items-center gap-2 py-0.5 text-sm"><input type="checkbox" checked={pick.includes(m.uid)} onChange={(e) => setPick(e.target.checked ? [...pick, m.uid] : pick.filter((x) => x !== m.uid))} />{m.displayName} <span className="text-xs text-slate">@{m.username}</span></label>)}
          </div>
          <button className="btn-primary mt-3 !px-4 !py-2 text-xs" disabled={title.trim().length < 2} onClick={create}>Create the Circle</button>
          {err && <p className="mt-2 text-sm text-crimson" role="alert">{err}</p>}
        </div>
      )}
    </div>
  );
}
