"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Link from "next/link";
import { CoAuthorInvite, canAcceptCoAuthor } from "@/lib/coauthors";
import { getUserByUid, UserProfile } from "@/lib/users";

// Co-author invitations addressed to the signed-in member.
export default function InvitesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [invites, setInvites] = useState<CoAuthorInvite[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const load = useCallback(async (u: User) => {
    const snap = await getDocs(query(collection(db, "coAuthorInvites"), where("inviteeUid", "==", u.uid)));
    setInvites(snap.docs.map((d) => d.data() as CoAuthorInvite).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (!u) return router.replace("/login");
        setUser(u);
        getUserByUid(u.uid).then(setProfile).catch(() => {});
        load(u).catch(() => setInvites([]));
      }),
    [router, load]
  );

  async function respond(i: CoAuthorInvite, accept: boolean) {
    if (!user) return;
    setBusy(i.noteId);
    setError("");
    try {
      const res = await fetch("/api/coauthors", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ action: "respond", inviteId: `${i.noteId}_${i.inviteeUid}`, accept }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
      await load(user).catch(() => {});
    }
  }

  if (invites === null) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  return (
    <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <p className="eyebrow">Co-authoring</p>
      <h1 className="mt-3 font-display text-4xl text-ink">Co-author invites</h1>
      <p className="mt-2 text-sm text-slate">
        If you accept, you&apos;re listed as a co-author when the post is published and receive the share shown of what that post
        earns. The split is locked at publishing.
      </p>
      {profile && !canAcceptCoAuthor(profile) && (
        <p className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-ink">
          You can see invites on any account, but to <strong>accept</strong> one you need a publishing account, because your share is paid out to a
          publisher. <Link href="/profile/publishing" className="text-crimson underline">Apply for Free Basic</Link> (free), then come back.
        </p>
      )}
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {invites.length === 0 ? (
        <p className="mt-8 text-sm text-slate">No invites yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {invites.map((i) => (
            <li key={`${i.noteId}_${i.inviteeUid}`} className="card p-5 text-sm">
              <p className="font-semibold text-ink">&ldquo;{i.noteTitle}&rdquo;</p>
              <p className="mt-1 text-slate">
                From {i.leadName} (@{i.leadUsername}) · your share <strong className="text-ink">{i.percent}%</strong> · {i.status}
              </p>
              {i.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button disabled={busy === i.noteId || (!!profile && !canAcceptCoAuthor(profile))} onClick={() => respond(i, true)} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">Accept</button>
                  <button disabled={busy === i.noteId} onClick={() => respond(i, false)} className="btn-ghost !px-4 !py-2 text-xs disabled:opacity-50">Decline</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
