"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { CAC_SEARCH_URL, OrgInfo } from "@/lib/org";
import { getAllNotes, NoteWithComputed, isNoteBy } from "@/lib/firestore-notes";
import { getUserByUsername } from "@/lib/users";

type Org = { uid: string; username: string; displayName: string; accountTier: string; trialUntil: string | null; org: OrgInfo | null; gold: string | null };
type Req = { uid: string; username?: string; displayName?: string; rcNumber: string; requestedAt: string };

export default function AdminOrganisationsPage() {
  const { user, loading } = useAdminAuth();
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [error, setError] = useState("");
  // Move posts from a person's journal into an organisation's channel.
  const [moveOrg, setMoveOrg] = useState("");
  const [source, setSource] = useState("");
  const [posts, setPosts] = useState<NoteWithComputed[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [moveMsg, setMoveMsg] = useState("");

  async function loadPosts() {
    setMoveMsg("");
    setPosts(null);
    const p = await getUserByUsername(source.trim().replace(/^@/, "").toLowerCase());
    if (!p) return setMoveMsg("No such @username.");
    const all = await getAllNotes({ publishedOnly: false });
    setPosts(all.filter((n) => isNoteBy(n, { uid: p.uid.startsWith("admin:") ? undefined : p.uid, username: p.username, displayName: p.displayName })));
    setPicked(new Set());
  }
  async function movePosts(undo = false) {
    if (!user || (!undo && !moveOrg) || picked.size === 0) return;
    if (!confirm(undo ? `Restore ${picked.size} post(s) to their original byline?` : `Move ${picked.size} post(s) into the organisation? Gifts and ad share from them will go to it.`)) return;
    setMoveMsg("");
    try {
      const res = await fetch("/api/admin/organisations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ action: undo ? "undo_move" : "move_posts", orgUid: moveOrg, noteIds: [...picked], writerUsername: source }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      setMoveMsg(undo ? `Restored ${j.restored} post(s).` : `Moved ${j.moved} post(s). Public lists refresh within a few minutes.`);
      await loadPosts();
    } catch (e) {
      setMoveMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  async function load() {
    if (!user) return;
    const res = await fetch("/api/admin/organisations", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Couldn't load.");
    setOrgs(j.organisations);
    setReqs(j.requests);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(action: string, uid: string, askNote = false) {
    let note: string | undefined;
    if (askNote) {
      note = window.prompt("Reason (sent to the organisation):")?.trim();
      if (!note) return;
    }
    setError("");
    try {
      const res = await fetch("/api/admin/organisations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user!.getIdToken()}` },
        body: JSON.stringify({ action, uid, note }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const order = { unverified: 0, rejected: 1, verified: 2 } as const;
  return (
    <section className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="font-display text-4xl">Organisations</h1>
      <p className="mt-2 text-sm text-slate">
        Check each registration number on the <a href={CAC_SEARCH_URL} target="_blank" rel="noopener noreferrer" className="text-crimson underline">CAC public search</a> — the name and status should match the channel — then verify or reject.
      </p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}

      {reqs.length > 0 && (
        <div className="card mt-8 p-5">
          <p className="font-ui text-sm font-bold text-ink">Requests to convert an existing account</p>
          {reqs.map((r) => (
            <div key={r.uid} className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3 text-sm">
              <p className="text-ink">{r.displayName} <span className="font-mono text-xs text-slate">@{r.username} · {r.rcNumber}</span></p>
              <span className="flex gap-4 text-xs font-semibold">
                <button onClick={() => act("approve_conversion", r.uid)} className="text-crimson">Approve</button>
                <button onClick={() => act("decline_conversion", r.uid, true)} className="text-slate hover:text-crimson">Decline</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card mt-8 p-5">
        <p className="font-ui text-sm font-bold text-ink">Move posts into an organisation</p>
        <p className="mt-1 text-xs text-slate">
          Pick the organisation and the person whose posts to move. Each moved post keeps its web address, is shown under the organisation&apos;s name and
          credits the person as &ldquo;Written by @person for #Org&rdquo;. Gifts and ad share from it go to the organisation. To undo a move, load the organisation&apos;s own @username here, tick the posts and press Undo.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs text-slate">Organisation
            <select value={moveOrg} onChange={(e) => setMoveOrg(e.target.value)} className="mt-1 w-full border border-rule bg-card px-3 py-2 text-sm">
              <option value="">Choose…</option>
              {(orgs || []).map((o) => <option key={o.uid} value={o.uid}>{o.displayName} (@{o.username})</option>)}
            </select>
          </label>
          <label className="text-xs text-slate">Move posts written by (@username)
            <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="@chimdinma" className="mt-1 w-full border border-rule bg-card px-3 py-2 text-sm" />
          </label>
          <button onClick={() => loadPosts().catch((e) => setMoveMsg(e.message))} disabled={!source.trim()} className="btn-ghost self-end !px-4 !py-2 text-xs">Load posts</button>
        </div>
        {posts && (
          <div className="mt-4">
            {posts.length === 0 ? <p className="text-sm text-slate">No posts found for that person.</p> : (
              <>
                <ul className="max-h-72 divide-y divide-rule overflow-y-auto border-y border-rule text-sm">
                  {posts.map((n) => (
                    <li key={n.id} className="flex items-center gap-3 py-2">
                      <input type="checkbox" checked={picked.has(n.id)} onChange={(e) => setPicked((cur) => { const next = new Set(cur); if (e.target.checked) next.add(n.id); else next.delete(n.id); return next; })} />
                      <span className="min-w-0 flex-1 truncate text-ink">{n.title}</span>
                      <span className="shrink-0 font-mono text-[11px] text-slate">{n.status}{n.authorUid && n.writerUid ? " · in an org" : ""}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button disabled={!moveOrg || picked.size === 0} onClick={() => movePosts(false)} className="btn-primary !px-4 !py-2 text-xs">Move {picked.size || ""} selected</button>
                  <button disabled={picked.size === 0} onClick={() => movePosts(true)} className="btn-ghost !px-4 !py-2 text-xs">Undo move for selected</button>
                </div>
              </>
            )}
          </div>
        )}
        {moveMsg && <p className="mt-3 text-sm text-ink">{moveMsg}</p>}
      </div>

      <div className="mt-8 space-y-3">
        {orgs === null ? <p className="text-sm text-slate">Loading…</p> : orgs.length === 0 ? <p className="text-sm text-slate">No organisation accounts yet.</p> : [...orgs].sort((a, b) => order[a.org?.rcStatus ?? "unverified"] - order[b.org?.rcStatus ?? "unverified"]).map((o) => (
          <div key={o.uid} className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div>
              <p className="font-semibold text-ink"><a href={`/u/${o.username}`} className="hover:text-crimson">{o.displayName}</a> <span className="font-mono text-[11px] text-slate">@{o.username}</span></p>
              <p className="text-xs text-slate">{o.org?.rcNumber} · {o.org?.rcStatus} · plan {o.accountTier}{o.trialUntil ? ` (trial to ${o.trialUntil.slice(0, 10)})` : ""}</p>
              {o.org?.rcNote && <p className="text-xs text-crimson">{o.org.rcNote}</p>}
            </div>
            <div className="flex gap-4 text-xs font-semibold">
              {o.org?.rcStatus !== "verified" && <button onClick={() => act("verify", o.uid)} className="text-crimson">Verify</button>}
              <button onClick={() => act(o.gold ? "revoke_gold" : "grant_gold", o.uid)} className="text-crimson">{o.gold ? "Remove gold ✔" : "Give gold ✔ (endorsed)"}</button>
              {o.org?.rcStatus !== "rejected" && <button onClick={() => act("reject", o.uid, true)} className="text-slate hover:text-crimson">Reject</button>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
