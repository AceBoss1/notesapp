"use client";

import { useState } from "react";
import { api } from "@/lib/moments-client";
import Avatar from "@/components/Avatar";
import { GROUP_MEMBERS_MAX, type GroupInfo } from "@/lib/messages-rules";

export type GroupMember = { uid: string; username: string; displayName: string; avatar: string; admin: boolean };

// Who is in a group, and the controls the viewer is allowed: an admin renames the group, adds people (usernames), removes people and makes
// others admins; anyone can leave. Team rooms follow the team automatically, so they only list who is in.
export default function GroupMembers({ cid, group, members, meUid, onChanged, onLeft }: { cid: string; group: GroupInfo; members: GroupMember[]; meUid: string; onChanged: () => void; onLeft: () => void }) {
  const isAdmin = group.adminUids.includes(meUid);
  const team = group.scope === "team";
  const [title, setTitle] = useState(group.title);
  const [names, setNames] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function act(body: Record<string, unknown>, after?: () => void) {
    setBusy(true); setError("");
    try { await api(`/api/messages/groups/${cid}`, { body }); (after ?? onChanged)(); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  const small = "rounded border border-rule px-2 py-0.5 text-[11px] font-semibold hover:border-crimson hover:text-crimson disabled:opacity-50";

  return (
    <section className="mb-4 rounded-lg border border-rule bg-card p-4 text-sm" aria-label="Group members">
      <p className="font-ui font-bold text-ink">{members.length} member{members.length === 1 ? "" : "s"}{team ? " · the team" : ` (up to ${GROUP_MEMBERS_MAX})`}</p>
      <ul className="mt-2 divide-y divide-rule">
        {members.map((m) => (
          <li key={m.uid} className="flex flex-wrap items-center gap-2 py-2">
            <Avatar src={m.avatar} alt={m.displayName} size={28} />
            <span className="min-w-0 flex-1"><span className="font-bold text-ink">{m.displayName}{m.uid === meUid ? " (you)" : ""}</span> <span className="text-slate">@{m.username}</span>{m.admin && <span className="ml-2 rounded bg-crimson/10 px-1.5 py-0.5 text-[10px] font-bold text-crimson">{team ? "team" : "admin"}</span>}</span>
            {isAdmin && !team && m.uid !== meUid && (
              <span className="flex gap-1">
                <button disabled={busy} onClick={() => act({ action: "admin", uid: m.uid, admin: !m.admin })} className={small}>{m.admin ? "Remove admin" : "Make admin"}</button>
                <button disabled={busy} onClick={() => { if (confirm(`Remove ${m.displayName} from the group?`)) void act({ action: "remove", uid: m.uid }); }} className={small}>Remove</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-red-700" role="alert">{error}</p>}
      {isAdmin && !team && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) void act({ action: "rename", title }); }} className="flex items-end gap-2">
            <label className="flex-1 text-[11px] text-slate">Group name<input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full border border-rule bg-paper px-2 py-1.5 text-sm" /></label>
            <button disabled={busy || !title.trim() || title === group.title} className={small}>Rename</button>
          </form>
          <form onSubmit={(e) => { e.preventDefault(); const u = names.split(/[\s,]+/).filter(Boolean); if (u.length) void act({ action: "add", usernames: u }, () => { setNames(""); onChanged(); }); }} className="flex items-end gap-2">
            <label className="flex-1 text-[11px] text-slate">Add people (usernames)<input value={names} onChange={(e) => setNames(e.target.value)} placeholder="@amaka, @tunde" className="mt-1 block w-full border border-rule bg-paper px-2 py-1.5 text-sm" /></label>
            <button disabled={busy || !names.trim()} className={small}>Add</button>
          </form>
          <p className="text-[11px] text-slate sm:col-span-2">You can add people you follow or who follow you.</p>
        </div>
      )}
      {!team && <button disabled={busy} onClick={() => { if (confirm("Leave this group? You won't see its messages any more.")) void act({ action: "leave" }, onLeft); }} className="mt-3 text-xs text-slate underline">Leave group</button>}
    </section>
  );
}
