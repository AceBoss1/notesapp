"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { getAllUsersForAdmin, UserProfile, UserRole, AccountTier } from "@/lib/users";
import { getAllBadgeRequests, resolveBadgeRequest, getAllSuspensions, suspendUser, unsuspendUser, rejectAppeal, updateUserRole, updateUserTier, setGoldBadge, resolveTierRequest } from "@/lib/moderation";
import { GOLD_KIND_LABEL, GOLD_KIND_LIVE, GoldBadgeKind } from "@/lib/badges";
import { TIERS } from "@/lib/tiers";
import { ADMIN_PROFILES } from "@/lib/admin";

const FOUNDER_USERNAMES = Object.values(ADMIN_PROFILES).map((p) => p.username);

const ASSIGNABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: "reader", label: "Reader" },
  { value: "staff", label: "Staff (in-house writer)" },
  { value: "volunteer", label: "Volunteer (contributing writer)" },
];

export default function AdminUsersPage() {
  const { user, loading } = useAdminAuth();
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [error, setError] = useState("");
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [badgeRequests, setBadgeRequests] = useState<Awaited<ReturnType<typeof getAllBadgeRequests>>>({});
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [suspendReasonFor, setSuspendReasonFor] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  function reload() {
    getAllUsersForAdmin()
      .then(async (rawList) => {
        const suspensions = await getAllSuspensions().catch(() => ({}) as Record<string, UserProfile["suspension"]>);
        const list = rawList.map((u) => ({ ...u, suspension: suspensions[u.uid] ?? u.suspension }));
        setUsers(list);
        getAllBadgeRequests().then(setBadgeRequests).catch(() => {});
        // Emails come from Firebase Auth via an admin-only endpoint.
        try {
          const res = await fetch("/api/admin/user-emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user!.getIdToken()}` },
            body: JSON.stringify({ uids: list.map((u) => u.uid) }),
          });
          if (res.ok) setEmails((await res.json()).emails || {});
        } catch {
          /* emails are a convenience; the list still works without them */
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"));
  }

  useEffect(() => {
    if (!user) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) {
    return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  }

  async function handleSuspend(uid: string, username: string) {
    if (!suspendReason.trim() || !user) return;
    setBusyUid(uid);
    try {
      await suspendUser(uid, username, suspendReason.trim(), user.uid);
      setSuspendReasonFor(null);
      setSuspendReason("");
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleUnsuspend(uid: string, username: string, upheld: boolean) {
    if (!user) return;
    setBusyUid(uid);
    try {
      await unsuspendUser(uid, username, user.uid, upheld);
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleRejectAppeal(uid: string, username: string) {
    if (!user) return;
    setBusyUid(uid);
    try {
      await rejectAppeal(uid, username, user.uid);
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleTierRequest(u: UserProfile, approve: boolean) {
    if (!user) return;
    setBusyUid(u.uid);
    try {
      await resolveTierRequest(u.uid, u.username, user.uid, approve);
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleBadgeRequest(uid: string, approve: boolean) {
    if (!user) return;
    setBusyUid(uid);
    try {
      await resolveBadgeRequest(uid, user.uid, approve);
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleGoldChange(uid: string, value: string) {
    setBusyUid(uid);
    try {
      await setGoldBadge(uid, (value || null) as GoldBadgeKind | null);
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleTierChange(uid: string, tier: AccountTier) {
    setBusyUid(uid);
    try {
      await updateUserTier(uid, tier);
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleRoleChange(uid: string, username: string, role: UserRole) {
    setBusyUid(uid);
    try {
      await updateUserRole(uid, username, role);
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14">
      <Link
        href="/admin"
        className="block font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright"
      >
        ← Dashboard
      </Link>
      <p className="eyebrow mt-6">
        {users ? `${users.length} Registered` : ""}
      </p>
      <h1 className="font-display text-4xl mt-3">Users</h1>
      <p className="mt-3 text-sm text-slate max-w-xl">
        Everyone who's signed up to comment or like on the site, plus the
        two founder accounts. Shared with Precheks — same `users`
        collection — so anyone who's ever signed up on either site shows
        up here.
      </p>
      <p className="mt-3 text-sm text-slate max-w-xl">
        The role dropdown labels an account "Staff" or "Volunteer" — it
        doesn't grant publishing rights yet. Only the two founder emails
        can publish today (firestore.rules' isAdmin()); role-based
        publish permission needs a Firebase custom-claims migration
        first — see the README before wiring that up.
      </p>

      {error && <p className="mt-6 text-sm text-red-700">{error}</p>}

      {!users ? (
        <p className="mt-8 text-slate">Loading…</p>
      ) : (
        <div className="mt-8 divide-y divide-rule">
          {users.map((u) => {
            const isFounder = FOUNDER_USERNAMES.includes(u.username);
            const suspended = u.suspended === true;
            const pendingAppeal = suspended && u.suspension?.appealStatus === "pending";

            return (
              <div key={u.uid} className="py-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <Link href={`/u/${u.username}`} className="flex items-center gap-3 group">
                    <Image
                      src={suspended ? "/images/brand/suspended-avatar.png" : u.avatar}
                      alt={u.displayName}
                      width={40}
                      height={40}
                      className="rounded-full object-cover w-10 h-10"
                    />
                    <div>
                      <p className="font-ui font-semibold text-ink group-hover:text-crimson-bright">
                        {u.displayName}{" "}
                        <span className="font-mono text-xs text-crimson-bright">
                          @{u.username}
                        </span>
                      </p>
                      <p className="text-xs text-slate mt-0.5">{emails[u.uid] || "—"}</p>
                    {badgeRequests[u.uid]?.status === "pending" && (
                      <div className="mt-2 border border-amber-200 bg-amber-50 p-2 text-xs text-ink">
                        <p className="font-semibold">Applied for the gold badge ({(badgeRequests[u.uid].kind ?? "endorsement")}, {(badgeRequests[u.uid].track ?? "personal")})</p>
                        {badgeRequests[u.uid].kind === "identity" && (
                          <p className="mt-0.5 text-slate">Deposit paid {badgeRequests[u.uid].depositPaidAt?.slice(0, 10)} — {badgeRequests[u.uid].dojah ? "Dojah's result is below; " : "no Dojah result yet (it arrives by webhook) — or check "}the Dojah dashboard (reference na_{u.uid}) before approving.</p>
                        )}
                        {badgeRequests[u.uid].dojah && (
                          <p className={`mt-0.5 font-semibold ${badgeRequests[u.uid].dojah!.passed ? "text-green-700" : badgeRequests[u.uid].dojah!.terminal ? "text-crimson" : "text-slate"}`}>
                            Dojah: {badgeRequests[u.uid].dojah!.verificationStatus} — {badgeRequests[u.uid].dojah!.passed ? "every step passed" : badgeRequests[u.uid].dojah!.terminal ? "needs your review (a step failed or is missing)" : "still in progress"}
                            <span className="ml-2 font-normal text-slate">{Object.entries(badgeRequests[u.uid].dojah!.steps).map(([k, v]) => `${k} ${v ? "✓" : "✗"}`).join(" · ")}</span>
                          </p>
                        )}
                        <p className="mt-0.5 whitespace-pre-line text-slate">“{badgeRequests[u.uid].message}”</p>
                        <div className="mt-1.5 flex gap-2">
                          <button disabled={busyUid === u.uid} onClick={() => handleBadgeRequest(u.uid, true)} className="rounded-full border border-rule px-3 py-0.5 hover:border-crimson hover:text-crimson disabled:opacity-40">Approve (they then pay)</button>
                          <button disabled={busyUid === u.uid} onClick={() => handleBadgeRequest(u.uid, false)} className="rounded-full border border-rule px-3 py-0.5 hover:border-crimson hover:text-crimson disabled:opacity-40">Decline</button>
                        </div>
                      </div>
                    )}
                    {u.tierRequest?.status === "pending" && (
                      <div className="mt-2 border border-amber-200 bg-amber-50 p-2 text-xs text-ink">
                        <p className="font-semibold">Applied for Free Basic</p>
                        <p className="mt-0.5 text-slate">“{u.tierRequest.message}”</p>
                        <div className="mt-1.5 flex gap-2">
                          <button disabled={busyUid === u.uid} onClick={() => handleTierRequest(u, true)} className="rounded-full border border-rule px-3 py-0.5 hover:border-crimson hover:text-crimson disabled:opacity-40">Approve</button>
                          <button disabled={busyUid === u.uid} onClick={() => handleTierRequest(u, false)} className="rounded-full border border-rule px-3 py-0.5 hover:border-crimson hover:text-crimson disabled:opacity-40">Reject</button>
                        </div>
                      </div>
                    )}
                    </div>
                  </Link>

                  <div className="flex items-center gap-3 flex-wrap">
                    {suspended && (
                      <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 bg-red-100 text-red-800">
                        Suspended
                      </span>
                    )}
                    {isFounder ? (
                      <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 bg-crimson/10 text-crimson-bright">
                        admin
                      </span>
                    ) : (
                      <>
                      <select
                        title="Gold badge (endorsement is live; identity check is coming soon and stays hidden)"
                        value={u.goldBadge?.kind || ""}
                        disabled={busyUid === u.uid}
                        onChange={(e) => handleGoldChange(u.uid, e.target.value)}
                        className="border border-rule bg-card px-2 py-1 font-mono text-xs disabled:opacity-50"
                      >
                        <option value="">No gold</option>
                        {(Object.keys(GOLD_KIND_LABEL) as GoldBadgeKind[]).filter((k) => GOLD_KIND_LIVE[k] || u.goldBadge?.kind === k).map((k) => (
                          <option key={k} value={k}>
                            Gold: {GOLD_KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                      <select
                        title="Account tier"
                        value={u.accountTier || "standard"}
                        disabled={busyUid === u.uid}
                        onChange={(e) => handleTierChange(u.uid, e.target.value as AccountTier)}
                        className="border border-rule bg-card px-2 py-1 font-mono text-xs disabled:opacity-50"
                      >
                        {TIERS.map((t) => (
                          <option key={t.tier} value={t.tier}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={u.role}
                        disabled={busyUid === u.uid}
                        onChange={(e) => handleRoleChange(u.uid, u.username, e.target.value as UserRole)}
                        className="border border-rule bg-card px-2 py-1 font-mono text-xs disabled:opacity-50"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      </>
                    )}
                    <p className="text-xs text-slate font-mono">
                      {new Date(u.createdAt).toLocaleDateString("en-NG", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    {!isFounder &&
                      (suspended ? (
                        <button
                          onClick={() => handleUnsuspend(u.uid, u.username, false)}
                          disabled={busyUid === u.uid}
                          className="border border-rule px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50"
                        >
                          Unsuspend
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            setSuspendReasonFor(suspendReasonFor === u.uid ? null : u.uid)
                          }
                          className="border border-rule px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson"
                        >
                          Suspend
                        </button>
                      ))}
                  </div>
                </div>

                {suspendReasonFor === u.uid && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      placeholder="Reason (shown in the moderation record)"
                      className="flex-1 border border-rule bg-card px-3 py-2 text-sm focus:border-crimson outline-none"
                    />
                    <button
                      onClick={() => handleSuspend(u.uid, u.username)}
                      disabled={busyUid === u.uid || !suspendReason.trim()}
                      className="bg-crimson text-paper font-ui text-xs font-semibold px-4 py-2 hover:bg-crimson-bright transition-colors disabled:opacity-50"
                    >
                      Confirm Suspend
                    </button>
                  </div>
                )}

                {suspended && u.suspension && (
                  <div className="mt-3 rounded-lg bg-paper p-4 text-sm">
                    <p className="text-slate">
                      <span className="font-semibold text-ink">Reason:</span> {u.suspension.reason}
                    </p>
                    {pendingAppeal && (
                      <div className="mt-3 border-t border-rule pt-3">
                        <p className="font-semibold text-ink">Appeal submitted:</p>
                        <p className="mt-1 text-slate">&ldquo;{u.suspension.appealText}&rdquo;</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleUnsuspend(u.uid, u.username, true)}
                            disabled={busyUid === u.uid}
                            className="bg-crimson text-paper font-ui text-xs font-semibold px-4 py-2 hover:bg-crimson-bright transition-colors disabled:opacity-50"
                          >
                            Uphold — Unsuspend
                          </button>
                          <button
                            onClick={() => handleRejectAppeal(u.uid, u.username)}
                            disabled={busyUid === u.uid}
                            className="border border-rule px-4 py-2 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50"
                          >
                            Reject — Stays Suspended
                          </button>
                        </div>
                      </div>
                    )}
                    {u.suspension.appealStatus === "rejected" && (
                      <p className="mt-2 font-mono text-xs text-slate">Appeal rejected — status quo remains.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
