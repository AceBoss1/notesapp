"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { CoAuthorInvite, MAX_CO_AUTHORS, MIN_CO_PERCENT, MIN_LEAD_PERCENT, inviteId, leadPercent, minPercentFor } from "@/lib/coauthors";
import { accessLabel, accessOf, accessRank, helpHref, type InviteAccess } from "@/lib/invite-terms";

const field = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-gold";

async function call(body: Record<string, unknown>) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in first.");
  const res = await fetch("/api/coauthors", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Something went wrong.");
  return json as { applied?: boolean; proposed?: boolean };
}
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// "Can view" or "Can view and edit", with what each means for a journal draft.
function AccessChoice({ value, onChange }: { value: InviteAccess; onChange: (a: InviteAccess) => void }) {
  return (
    <fieldset>
      <legend className="text-xs text-slate">What they can do</legend>
      <div className="mt-1 grid gap-2 sm:grid-cols-2" role="radiogroup">
        {(["view", "edit"] as const).map((a) => (
          <button key={a} type="button" role="radio" aria-checked={value === a} onClick={() => onChange(a)}
            className={`px-3 py-2 text-left text-sm ${value === a ? "border-2 border-crimson bg-card" : "border border-rule bg-card"}`}>
            <b className="font-ui">{accessLabel(a)}</b>
            <span className="block text-xs text-slate">
              {a === "view" ? `Read the draft before it's published, to review it. No editing. Share from 0%.` : `Read and edit the draft's title and text. Share from ${MIN_CO_PERCENT}%.`}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// Lead author's panel on a DRAFT: invite co-authors with an access level and their share of the post's earnings, change either later,
// withdraw an invite. Everyone reads the terms and agrees before they're listed; the split is locked when the post is published.
export default function CoAuthorsPanel({ noteId, leadUid }: { noteId: string; leadUid: string }) {
  const [invites, setInvites] = useState<CoAuthorInvite[]>([]);
  const [username, setUsername] = useState("");
  const [access, setAccess] = useState<InviteAccess>("edit");
  const [percent, setPercent] = useState(20);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, "coAuthorInvites"), where("leadUid", "==", leadUid), where("noteId", "==", noteId)));
      setInvites(snap.docs.map((d) => d.data() as CoAuthorInvite).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)));
    } catch {
      /* panel just shows empty */
    }
  }, [leadUid, noteId]);
  useEffect(() => {
    load();
  }, [load]);

  async function run(body: Record<string, unknown>, done?: (r: { applied?: boolean; proposed?: boolean }) => string) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const r = await call(body);
      if (done) setNote(done(r));
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const live = invites.filter((i) => i.status === "pending" || i.status === "accepted");
  const mine = leadPercent(invites);
  const label: Record<string, string> = { pending: "waiting for them", accepted: "accepted", declined: "declined", revoked: "withdrawn", expired: "expired" };

  return (
    <div className="card p-5">
      <p className="eyebrow">Co-authors</p>
      <p className="mt-2 text-sm text-slate">
        Invite up to {MAX_CO_AUTHORS} members. Choose what each can do with this draft and their share of the post&apos;s earnings. They read
        the terms and agree before they&apos;re listed; publishing, the split and invitations stay with you, and the split locks when you
        publish. Invites still waiting at publish time expire. <Link href={helpHref("journal")} className="text-crimson underline">How co-authoring works</Link>
      </p>
      <p className="mt-2 font-mono text-xs text-ink">You keep {mine}% (minimum {MIN_LEAD_PERCENT}%).</p>

      {invites.length > 0 && (
        <ul className="mt-3 divide-y divide-rule text-sm">
          {invites.map((i) => {
            const a = accessOf("journal", i);
            const id = inviteId(noteId, i.inviteeUid);
            const open = i.status === "pending" || i.status === "accepted";
            return (
              <li key={i.inviteeUid} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    @{i.inviteeUsername} · {accessLabel(a)} · {i.percent}% <span className="text-xs text-slate">({label[i.status]})</span>
                    {i.status === "accepted" && <span className="block text-xs text-slate">{i.agreedAt ? `Accepted on ${day(i.agreedAt)}` : "Accepted before terms were recorded"}</span>}
                    {i.change && <span className="block text-xs font-semibold text-amber-800">Proposed: {accessLabel(i.change.access).toLowerCase()}, {i.change.percent}%. Waiting for them to agree.</span>}
                  </span>
                  {open && (
                    <span className="flex gap-3">
                      <button type="button" disabled={busy} onClick={() => setEditing(editing === id ? null : id)} className="text-xs text-ink underline">{editing === id ? "Close" : "Change"}</button>
                      <button type="button" disabled={busy} onClick={() => run({ action: "revoke", inviteId: id }, () => (i.status === "accepted" ? "Removed. They've been told." : "Invite withdrawn."))} className="text-xs text-crimson underline">
                        {i.status === "accepted" ? "Remove" : "Withdraw"}
                      </button>
                    </span>
                  )}
                </div>
                {open && editing === id && (
                  <ChangeForm invite={i} busy={busy} onSave={async (b) => {
                    if (await run({ action: "change", inviteId: id, ...b }, (r) => (r.proposed ? "Sent: they'll be asked to agree. Their current terms stay until they do." : r.applied ? "Changed. They've been told." : "Nothing changed."))) setEditing(null);
                  }} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {live.length < MAX_CO_AUTHORS && (
        <div className="mt-4 grid gap-3 border-t border-rule pt-4">
          <p className="font-ui text-sm font-bold text-ink">Invite a co-author</p>
          <label className="text-xs text-slate">Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" className={field} />
          </label>
          <AccessChoice value={access} onChange={(a) => { setAccess(a); if (a === "edit" && percent < MIN_CO_PERCENT) setPercent(MIN_CO_PERCENT); }} />
          <div className="grid gap-3 sm:grid-cols-[120px,auto] sm:items-end">
            <label className="text-xs text-slate">Their share (%)
              <input type="number" min={minPercentFor(access)} max={100 - MIN_LEAD_PERCENT} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className={field} />
            </label>
            <button
              type="button"
              disabled={busy || !username.trim()}
              onClick={() => run({ action: "invite", noteId, username, percent, access }, () => "Invite sent. They'll see the terms before they accept.").then((ok) => ok && setUsername(""))}
              className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50"
            >
              Send invite
            </button>
          </div>
        </div>
      )}
      {note && <p className="mt-3 text-sm text-emerald-800">{note}</p>}
      {error && <p className="mt-3 text-sm text-crimson">{error}</p>}
    </div>
  );
}

function ChangeForm({ invite, busy, onSave }: { invite: CoAuthorInvite; busy: boolean; onSave: (b: { access: InviteAccess; percent: number }) => void }) {
  const cur = accessOf("journal", invite);
  const [access, setAccess] = useState<InviteAccess>(invite.change?.access ?? (cur === "edit" ? "edit" : "view"));
  const [percent, setPercent] = useState(invite.change?.percent ?? invite.percent);
  const asks = invite.status === "accepted" && (accessRank(access) > accessRank(cur) || percent !== invite.percent);
  return (
    <div className="mt-2 grid gap-3 bg-paper p-3">
      <AccessChoice value={access} onChange={setAccess} />
      <label className="w-32 text-xs text-slate">Their share (%)
        <input type="number" min={minPercentFor(access)} max={100 - MIN_LEAD_PERCENT} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className={field} />
      </label>
      <p className="text-xs text-slate">
        {invite.status === "pending" ? "They haven't answered yet: the invite is updated and they're told." : asks ? "More access or a different share needs their agreement: they're asked, and their current terms stay until they agree." : "Less access applies straight away, and they're told."}
      </p>
      <button type="button" disabled={busy} onClick={() => onSave({ access, percent })} className="btn-primary w-full !px-4 !py-2 text-xs disabled:opacity-50 sm:w-auto">{asks ? "Ask them to agree" : "Save"}</button>
    </div>
  );
}
