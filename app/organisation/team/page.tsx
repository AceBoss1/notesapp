"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { OrgInvite, OrgMember } from "@/lib/org";

type Team = { role: "owner" | "admin"; accountTier: string; teamEnabled: boolean; seatLimit: number | null; seatsUsed: number; members: OrgMember[]; invites: OrgInvite[] };
const field = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";

export default function TeamPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [orgUid, setOrgUid] = useState<string | null>(null); // null = my own organisation
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [role, setRole] = useState<"writer" | "admin">("writer");
  const [busy, setBusy] = useState(false);
  const [orgs, setOrgs] = useState<{ uid: string; displayName: string; role: string }[]>([]);

  const load = useCallback(async (u: User, org: string | null) => {
    const res = await fetch(`/api/org/team${org ? `?org=${org}` : ""}`, { headers: { Authorization: `Bearer ${await u.getIdToken()}` } });
    const j = await res.json();
    if (!res.ok) {
      setTeam(null);
      setError(j.error || "Couldn't load the team.");
      return;
    }
    setError("");
    setTeam(j);
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        if (!u) return router.replace("/login");
        setUser(u);
        // Orgs I'm an admin of (besides my own account, if it is one).
        const m = await fetch("/api/org/team?mine=1", { headers: { Authorization: `Bearer ${await u.getIdToken()}` } }).then((r) => r.json()).catch(() => ({ orgs: [] }));
        const admin = (m.orgs || []).filter((o: { role: string }) => o.role === "admin");
        setOrgs(admin);
        await load(u, null);
      }),
    [router, load]
  );

  async function act(body: Record<string, unknown>, ok: string) {
    if (!user) return;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/org/team", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ ...body, orgUid: orgUid ?? undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      setMsg(ok);
      setIdentifier("");
      await load(user, orgUid);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <span className="eyebrow">Organisation</span>
      <h1 className="mt-3 font-display text-3xl text-ink">Team</h1>
      <p className="mt-2 text-sm text-slate">
        Writers publish under the organisation&apos;s name (shown as &ldquo;by @person for #YourOrg&rdquo;) and everything their posts earn goes to the
        organisation&apos;s payout account — set by the owner under <Link href="/profile/publishing" className="text-crimson underline">Rates &amp; payouts</Link>.
        Admins can also edit and delete the organisation&apos;s posts and invite writers; only the owner adds admins.
      </p>
      {orgs.length > 0 && (
        <label className="mt-4 block text-xs text-slate">Organisation
          <select className={field} value={orgUid ?? ""} onChange={(e) => { const v = e.target.value || null; setOrgUid(v); if (user) load(user, v); }}>
            <option value="">My own organisation</option>
            {orgs.map((o) => <option key={o.uid} value={o.uid}>{o.displayName} (admin)</option>)}
          </select>
        </label>
      )}
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {msg && <p className="mt-4 text-sm text-ink">{msg}</p>}

      {team && (
        <>
          <p className="mt-6 text-sm text-ink">
            Seats: {team.seatsUsed} of {team.seatLimit ?? "as agreed"} used (the owner counts as one, and so do pending invitations).
          </p>
          {!team.teamEnabled && (
            <p className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-ink">
              Team members need the Business or Enterprise plan. <Link href="/organisation" className="text-crimson underline">Start the free trial</Link> or <Link href="/pricing" className="text-crimson underline">upgrade</Link>.
              If the plan ends, team members can&apos;t publish until it returns.
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              act({ action: "invite", identifier, role }, "Invitation sent.");
            }}
            className="card mt-6 grid gap-3 p-5 sm:grid-cols-[1fr_auto_auto]"
          >
            <label className="text-xs text-slate">@username or email of their #NotesApp account
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={field} placeholder="@ada or ada@example.com" />
            </label>
            <label className="text-xs text-slate">Role
              <select value={role} onChange={(e) => setRole(e.target.value as "writer" | "admin")} className={field}>
                <option value="writer">Writer</option>
                {team.role === "owner" && <option value="admin">Admin</option>}
              </select>
            </label>
            <button disabled={busy || !identifier.trim() || !team.teamEnabled} className="btn-primary self-end !px-4 !py-2 text-xs">Invite</button>
          </form>

          <h2 className="mt-8 font-ui text-sm font-bold text-ink">Members</h2>
          {team.members.length === 0 ? <p className="mt-2 text-sm text-slate">No team members yet.</p> : (
            <ul className="mt-2 divide-y divide-rule border-y border-rule text-sm">
              {team.members.map((m) => (
                <li key={m.memberUid} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="text-ink">{m.memberName} <span className="font-mono text-xs text-slate">@{m.memberUsername} · {m.role}</span></span>
                  <span className="flex gap-4 text-xs font-semibold">
                    {team.role === "owner" && <label className="flex items-center gap-1 font-normal text-slate"><input type="checkbox" checked={m.store === true} onChange={(e) => act({ action: "set_store_access", memberUid: m.memberUid, enabled: e.target.checked }, e.target.checked ? "They can now run the store and orders." : "Store access removed.")} /> runs the store</label>}
                    {team.role === "owner" && <button onClick={() => act({ action: "set_role", memberUid: m.memberUid, role: m.role === "admin" ? "writer" : "admin" }, "Role updated.")} className="text-crimson">Make {m.role === "admin" ? "writer" : "admin"}</button>}
                    {(team.role === "owner" || m.role === "writer") && <button onClick={() => confirm(`Remove @${m.memberUsername}? Their posts stay with the organisation.`) && act({ action: "remove", memberUid: m.memberUid }, "Removed.")} className="text-slate hover:text-crimson">Remove</button>}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {team.invites.length > 0 && (
            <>
              <h2 className="mt-8 font-ui text-sm font-bold text-ink">Pending invitations</h2>
              <ul className="mt-2 divide-y divide-rule border-y border-rule text-sm">
                {team.invites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-3">
                    <span className="text-ink">@{i.inviteeUsername} <span className="font-mono text-xs text-slate">· {i.role}</span></span>
                    {(team.role === "owner" || i.role === "writer") && <button onClick={() => act({ action: "revoke", inviteId: i.id }, "Invitation withdrawn.")} className="text-xs font-semibold text-slate hover:text-crimson">Withdraw</button>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
