"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { getAllUsers, UserProfile, UserRole } from "@/lib/users";
import { suspendUser, unsuspendUser, rejectAppeal, updateUserRole } from "@/lib/moderation";
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
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [suspendReasonFor, setSuspendReasonFor] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  function reload() {
    getAllUsers()
      .then(setUsers)
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

  async function handleSuspend(uid: string) {
    if (!suspendReason.trim() || !user) return;
    setBusyUid(uid);
    try {
      await suspendUser(uid, suspendReason.trim(), user.uid);
      setSuspendReasonFor(null);
      setSuspendReason("");
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleUnsuspend(uid: string, upheld: boolean) {
    if (!user) return;
    setBusyUid(uid);
    try {
      await unsuspendUser(uid, user.uid, upheld);
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleRejectAppeal(uid: string) {
    if (!user) return;
    setBusyUid(uid);
    try {
      await rejectAppeal(uid, user.uid);
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleRoleChange(uid: string, role: UserRole) {
    setBusyUid(uid);
    try {
      await updateUserRole(uid, role);
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14">
      <Link
        href="/admin"
        className="font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright"
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
                      <p className="text-xs text-slate mt-0.5">{u.email}</p>
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
                      <select
                        value={u.role}
                        disabled={busyUid === u.uid}
                        onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                        className="border border-rule bg-card px-2 py-1 font-mono text-xs disabled:opacity-50"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
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
                          onClick={() => handleUnsuspend(u.uid, false)}
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
                      onClick={() => handleSuspend(u.uid)}
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
                            onClick={() => handleUnsuspend(u.uid, true)}
                            disabled={busyUid === u.uid}
                            className="bg-crimson text-paper font-ui text-xs font-semibold px-4 py-2 hover:bg-crimson-bright transition-colors disabled:opacity-50"
                          >
                            Uphold — Unsuspend
                          </button>
                          <button
                            onClick={() => handleRejectAppeal(u.uid)}
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
