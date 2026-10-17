"use client";

import { useState } from "react";
import { api } from "@/lib/moments-client";
import Avatar from "@/components/Avatar";
import { NameBadgeIcons } from "@/components/PersonName";
import { GROUP_MEMBERS_MAX, type GroupInfo } from "@/lib/messages-rules";
import { uploadToR2 } from "@/lib/upload";
import GroupAvatar from "./GroupAvatar";

export type GroupMember = { uid: string; username: string; displayName: string; avatar: string; admin: boolean };

// Who is in a group, and the controls the viewer is allowed: an admin renames the group, adds people (usernames), removes people and makes
// others admins; anyone can leave. Team rooms follow the team automatically, so they only list who is in.
export default function GroupMembers({ cid, group, members, banned = [], meUid, onChanged, onLeft }: { cid: string; group: GroupInfo; members: GroupMember[]; banned?: GroupMember[]; meUid: string; onChanged: () => void; onLeft: () => void }) {
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
            <span className="min-w-0 flex-1"><span className="font-bold text-ink">{m.displayName}{m.uid === meUid ? " (you)" : ""}</span><NameBadgeIcons username={m.username} size={13} /> <span className="text-slate">@{m.username}</span>{m.admin && <span className="ml-2 rounded bg-crimson/10 px-1.5 py-0.5 text-[10px] font-bold text-crimson">{team ? "team" : "admin"}</span>}</span>
            {isAdmin && !team && m.uid !== meUid && (
              <span className="flex gap-1">
                <button disabled={busy} onClick={() => act({ action: "admin", uid: m.uid, admin: !m.admin })} className={small}>{m.admin ? "Remove admin" : "Make admin"}</button>
                <button disabled={busy} onClick={() => { if (confirm(`Remove ${m.displayName} from the group?`)) void act({ action: "remove", uid: m.uid }); }} className={small}>Remove</button>
                {!m.admin && <button disabled={busy} onClick={() => { if (confirm(`Ban ${m.displayName}? They are removed and can't be added back until you unban them.`)) void act({ action: "ban", uid: m.uid, ban: true }); }} className={`${small} text-red-700`}>Ban</button>}
              </span>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-red-700" role="alert">{error}</p>}
      {!isAdmin && !team && (
        <p className="mt-3 border-t border-rule pt-3 text-[11px] text-slate">
          Only the group&apos;s admin{group.adminUids.length === 1 ? "" : "s"} ({members.filter((m) => m.admin).map((m) => m.displayName).join(", ") || "none yet"}) can add or remove people, ban members, remove messages, change the picture or switch member messages off. To flag a message to #NotesApp, use Report on it.
        </p>
      )}
      {isAdmin && !team && (
        <div className="mt-3 grid gap-3 border-t border-rule pt-3 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <GroupAvatar title={group.title} size={48} src={group.avatar} />
            <div className="text-[11px] text-slate">
              <label className="block cursor-pointer font-semibold text-crimson underline">Change group picture
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={busy} onChange={async (e) => {
                  const f = e.target.files?.[0]; e.target.value = "";
                  if (!f) return;
                  setBusy(true); setError("");
                  try { const url = await uploadToR2(f, "avatar"); await api(`/api/messages/groups/${cid}`, { body: { action: "avatar", url } }); onChanged(); }
                  catch (err) { setError(err instanceof Error ? err.message : "Couldn't use that picture."); }
                  finally { setBusy(false); }
                }} />
              </label>
              {group.avatar && <button type="button" disabled={busy} onClick={() => void act({ action: "avatar", url: "" })} className="mt-1 underline">Remove picture</button>}
            </div>
          </div>
          <label className="flex items-start gap-2 text-xs text-ink">
            <input type="checkbox" className="mt-0.5" checked={group.sendLocked === true} disabled={busy} onChange={(e) => void act({ action: "lock", locked: e.target.checked })} />
            <span>Only admins can send messages<span className="block text-[11px] text-slate">Everyone can still read. Switch it off to let all members write again.</span></span>
          </label>
        </div>
      )}
      {isAdmin && !team && banned.length > 0 && (
        <div className="mt-3 border-t border-rule pt-3 text-xs">
          <p className="font-semibold text-ink">Banned ({banned.length})</p>
          <ul className="mt-1 divide-y divide-rule">{banned.map((b) => <li key={b.uid} className="flex items-center gap-2 py-1.5"><span className="flex-1 text-slate">{b.displayName} @{b.username}</span><button disabled={busy} onClick={() => void act({ action: "ban", uid: b.uid, ban: false })} className={small}>Unban</button></li>)}</ul>
        </div>
      )}
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
