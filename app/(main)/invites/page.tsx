"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Link from "next/link";
import { CoAuthorInvite, canAcceptCoAuthor } from "@/lib/coauthors";
import { accessLabel, accessOf, invitePath } from "@/lib/invite-terms";
import { getUserByUid, UserProfile } from "@/lib/users";
import { useMemberships } from "@/lib/useMemberships";
import PageHero from "@/components/PageHero";

// Co-author invitations addressed to the signed-in member. Each opens the accept screen (/invites/journal/<id>) with the terms; an
// accepted one opens the draft (when they can see it) and can be left before the post is published.
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

  async function leave(i: CoAuthorInvite) {
    if (!user || !window.confirm(`Leave "${i.noteTitle}"? You won't see the draft any more, and you won't be credited or share its earnings.`)) return;
    setBusy(i.noteId);
    setError("");
    try {
      const res = await fetch("/api/coauthors", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ action: "leave", inviteId: `${i.noteId}_${i.inviteeUid}` }),
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
        <p>Open an invite to read exactly what you&apos;d agree to: your access to the draft, your share of what the post earns and the
        credit. The split is locked at publishing. Co-tutor invitations for courses are on <Link href="/academy/teach">Teach</Link>.</p>
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
                From {i.leadName} (@{i.leadUsername}) · {accessLabel(accessOf("journal", i))} · your share <strong className="text-ink">{i.percent}%</strong> · {i.status}
                {i.agreedAt ? ` on ${new Date(i.agreedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
              </p>
              {i.change && <p className="mt-1 text-xs font-semibold text-amber-800">New terms proposed: {accessLabel(i.change.access).toLowerCase()}, {i.change.percent}%.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {(i.status === "pending" || i.change) && (
                  <Link href={invitePath("journal", `${i.noteId}_${i.inviteeUid}`)} className="btn-primary !px-4 !py-2 text-xs">Review and answer</Link>
                )}
                {i.status === "accepted" && accessOf("journal", i) !== "credit" && (
                  <Link href={`/write/${i.noteId}/shared`} className="btn-ghost !px-4 !py-2 text-xs">{accessOf("journal", i) === "edit" ? "Open the draft" : "Read the draft"}</Link>
                )}
                {i.status === "accepted" && (
                  <Link href={invitePath("journal", `${i.noteId}_${i.inviteeUid}`)} className="btn-ghost !px-4 !py-2 text-xs">Your terms</Link>
                )}
                {i.status === "accepted" && (
                  <button disabled={busy === i.noteId} onClick={() => leave(i)} className="text-xs text-slate underline hover:text-crimson disabled:opacity-50">Leave</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
    </>
  );
}
