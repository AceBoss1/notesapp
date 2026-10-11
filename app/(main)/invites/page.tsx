"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Link from "next/link";
import { CoAuthorInvite, canAcceptCoAuthor } from "@/lib/coauthors";
import { getUserByUid, UserProfile } from "@/lib/users";
import { useMemberships } from "@/lib/useMemberships";
import PageHero from "@/components/PageHero";

// Co-author invitations addressed to the signed-in member.
export default function InvitesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [invites, setInvites] = useState<CoAuthorInvite[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const { orgs, invites: teamInvites } = useMemberships(user);
  const [teamDone, setTeamDone] = useState<Record<string, string>>({});

  async function respondTeam(body: Record<string, unknown>, key: string, done: string) {
    if (!user) return;
    setError("");
    try {
      const res = await fetch("/api/org/team", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setTeamDone((d) => ({ ...d, [key]: done }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

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
    <>
      <PageHero eyebrow="Co-authoring" title={<>Co-author invites</>}>
        <p>If you accept, you&apos;re listed as a co-author when the post is published and receive the share shown of what that post
        earns. The split is locked at publishing.</p>
      </PageHero>
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      {profile && !canAcceptCoAuthor(profile) && (
        <p className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-ink">
          You can see invites on any account, but to <strong>accept</strong> one you need a publishing account, because your share is paid out to a
          publisher. <Link href="/profile/publishing" className="text-crimson underline">Apply for Free Basic</Link> (free), then come back.
        </p>
      )}
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {(teamInvites.length > 0 || (orgs || []).length > 0) && (
        <div className="card mt-8 p-5 text-sm">
          <p className="font-ui font-bold text-ink">Organisation teams</p>
          {teamInvites.map((t) => (
            <div key={t.id} className="mt-3 border-t border-rule pt-3">
              <p className="text-ink">{t.orgName} invited you to join as {t.role === "admin" ? "an admin" : "a writer"}.</p>
              <p className="mt-1 text-xs text-slate">Posts you write for them are published under their name, and what those posts earn goes to the organisation.</p>
              {teamDone[t.id] ? <p className="mt-2 text-xs text-slate">{teamDone[t.id]}</p> : (
                <p className="mt-2 flex gap-4 text-xs font-semibold">
                  <button onClick={() => respondTeam({ action: "accept", inviteId: t.id }, t.id, "Joined — you can now post as this organisation from New entry.")} className="text-crimson">Accept</button>
                  <button onClick={() => respondTeam({ action: "decline", inviteId: t.id }, t.id, "Declined.")} className="text-slate hover:text-crimson">Decline</button>
                </p>
              )}
            </div>
          ))}
          {(orgs || []).map((o) => (
            <p key={o.uid} className="mt-3 flex items-center justify-between border-t border-rule pt-3 text-xs text-slate">
              <span>You write for <strong className="text-ink">{o.displayName}</strong> as {o.role}.</span>
              {teamDone[`left_${o.uid}`] ? <span>Left.</span> : <button onClick={() => confirm(`Leave ${o.displayName}?`) && respondTeam({ action: "leave", orgUid: o.uid }, `left_${o.uid}`, "Left.")} className="font-semibold hover:text-crimson">Leave</button>}
            </p>
          ))}
        </div>
      )}
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
    </>
  );
}
