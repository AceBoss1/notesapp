"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { getAllUsers, UserProfile } from "@/lib/users";

export default function AdminUsersPage() {
  const { user, loading } = useAdminAuth();
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    getAllUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"));
  }, [user]);

  if (loading || !user) {
    return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
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
        two founder accounts. This list is shared with Precheks — it's
        the same `users` collection — so anyone who's ever signed up on
        either site shows up here. Read-only view — to add or
        remove an admin account, do that directly in Firebase
        Authentication and update lib/admin.ts + firestore.rules.
      </p>

      {error && <p className="mt-6 text-sm text-red-700">{error}</p>}

      {!users ? (
        <p className="mt-8 text-slate">Loading…</p>
      ) : (
        <div className="mt-8 divide-y divide-rule">
          {users.map((u) => (
            <div key={u.uid} className="flex items-center justify-between py-4">
              <Link href={`/u/${u.username}`} className="flex items-center gap-3 group">
                <Image
                  src={u.avatar}
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
              <div className="text-right flex-shrink-0">
                <span
                  className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 ${
                    u.role === "admin"
                      ? "bg-crimson/10 text-crimson-bright"
                      : "bg-slate/10 text-slate"
                  }`}
                >
                  {u.role}
                </span>
                <p className="text-xs text-slate mt-1 font-mono">
                  {new Date(u.createdAt).toLocaleDateString("en-NG", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
