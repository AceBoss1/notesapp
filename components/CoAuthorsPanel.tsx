"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { CoAuthorInvite, MAX_CO_AUTHORS, MIN_CO_PERCENT, MIN_LEAD_PERCENT, leadPercent } from "@/lib/coauthors";

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
}

// Lead author's panel on a DRAFT: invite co-authors, set their share of the
// post's earnings, withdraw an invite. Everyone must accept before they're
// listed; the split is locked when the post is published.
export default function CoAuthorsPanel({ noteId, leadUid }: { noteId: string; leadUid: string }) {
  const [invites, setInvites] = useState<CoAuthorInvite[]>([]);
  const [username, setUsername] = useState("");
  const [percent, setPercent] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await call(body);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const live = invites.filter((i) => i.status === "pending" || i.status === "accepted");
  const mine = leadPercent(invites);
  const label: Record<string, string> = { pending: "waiting", accepted: "accepted", declined: "declined", revoked: "withdrawn", expired: "expired" };

  return (
    <div className="card p-5">
      <p className="eyebrow">Co-authors</p>
      <p className="mt-2 text-sm text-slate">
        Invite up to {MAX_CO_AUTHORS} members and set each person&apos;s share of this post&apos;s earnings. They must accept before they&apos;re
        listed, and the split is locked once you publish. Invites still waiting at publish time expire.
      </p>
      <p className="mt-2 font-mono text-xs text-ink">You keep {mine}% (minimum {MIN_LEAD_PERCENT}%).</p>

      {invites.length > 0 && (
        <ul className="mt-3 divide-y divide-rule text-sm">
          {invites.map((i) => (
            <li key={i.inviteeUid} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                @{i.inviteeUsername} · {i.percent}% <span className="text-xs text-slate">({label[i.status]})</span>
              </span>
              {(i.status === "pending" || i.status === "accepted") && (
                <button type="button" disabled={busy} onClick={() => run({ action: "revoke", inviteId: `${noteId}_${i.inviteeUid}` })} className="text-xs text-crimson underline">
                  Withdraw
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {live.length < MAX_CO_AUTHORS && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr,120px,auto] sm:items-end">
          <label className="text-xs text-slate">Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" className={field} />
          </label>
          <label className="text-xs text-slate">Their share (%)
            <input type="number" min={MIN_CO_PERCENT} max={100 - MIN_LEAD_PERCENT} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className={field} />
          </label>
          <button
            type="button"
            disabled={busy || !username.trim()}
            onClick={() => run({ action: "invite", noteId, username, percent }).then(() => setUsername(""))}
            className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50"
          >
            Invite
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-crimson">{error}</p>}
    </div>
  );
}
