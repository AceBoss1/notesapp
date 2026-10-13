"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/moments-client";
import Avatar from "@/components/Avatar";
import { type FollowPage, type ListedPerson } from "@/lib/social-graph";

type Kind = "followers" | "following";
const NA_USERNAME = "na-notesapp";

// "Followers · Following" under a profile. Each opens the list, 30 at a time. Shown only when both you and they have lists switched on (your own always);
// otherwise the dialog says why. On @na-notesapp the owner can also remove an account from what it follows.
export default function FollowLists({ username, owner = false, followerCount }: { username: string; owner?: boolean; followerCount?: number | null }) {
  const [open, setOpen] = useState<Kind | null>(null);
  return (
    <>
      <p className="mt-1 flex gap-4 font-ui text-xs font-semibold text-crimson">
        <button type="button" onClick={() => setOpen("followers")} className="underline-offset-2 hover:underline">Followers{typeof followerCount === "number" ? ` (${followerCount})` : ""}</button>
        <button type="button" onClick={() => setOpen("following")} className="underline-offset-2 hover:underline">Following</button>
      </p>
      {open && <ListDialog username={username} start={open} owner={owner && username === NA_USERNAME} onClose={() => setOpen(null)} />}
    </>
  );
}

function ListDialog({ username, start, owner, onClose }: { username: string; start: Kind; owner: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<Kind>(start);
  const [people, setPeople] = useState<ListedPerson[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<{ text: string; reason?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (k: Kind, after: string | null) => {
    setLoading(true);
    try {
      const page = await api<FollowPage>(`/api/follows?username=${encodeURIComponent(username)}&list=${k}${after ? `&after=${encodeURIComponent(after)}` : ""}`);
      setPeople((p) => (after ? [...p, ...page.people] : page.people));
      setNext(page.next);
      if (page.total !== null) setTotal(page.total);
      setError(null);
    } catch (e) {
      setError({ text: e instanceof Error ? e.message : "Couldn't load that list." });
    } finally { setLoading(false); }
  }, [username]);

  useEffect(() => { setPeople([]); setNext(null); setTotal(null); setError(null); load(kind, null); }, [kind, load]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  async function unfollow(u: string) {
    try { await api("/api/follows/official", { body: { username: u, follow: false } }); setPeople((p) => p.filter((x) => x.username !== u)); setTotal((t) => (t === null ? t : Math.max(0, t - 1))); }
    catch (e) { setError({ text: e instanceof Error ? e.message : "Couldn't do that." }); }
  }

  const tab = (k: Kind, label: string) => (
    <button type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`rounded-full border px-4 py-1.5 font-ui text-sm font-semibold ${kind === k ? "border-crimson bg-crimson text-paper" : "border-rule text-ink hover:border-crimson"}`}>{label}</button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`@${username} followers and following`} onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">@{username}</h2>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-sm text-slate hover:bg-paper" aria-label="Close">✕</button>
        </div>
        <div role="tablist" className="mt-3 flex gap-2">{tab("followers", "Followers")}{tab("following", "Following")}</div>
        {total !== null && !error && <p className="mt-3 font-mono text-xs text-slate">{total.toLocaleString("en-NG")} {kind === "followers" ? (total === 1 ? "follower" : "followers") : "following"}</p>}
        <div className="mt-3 min-h-[8rem] flex-1 overflow-y-auto">
          {error && (
            <p className="rounded-xl border border-rule bg-paper p-4 text-sm text-ink" role="alert">
              {error.text} {/Sign in/i.test(error.text) && <Link href="/login" className="text-crimson underline">Sign in</Link>}
              {/switched off/i.test(error.text) && <Link href="/profile/account" className="text-crimson underline">Open privacy settings</Link>}
            </p>
          )}
          {!error && (
            <ul className="divide-y divide-rule">
              {people.map((p) => (
                <li key={p.username} className="flex items-center gap-3 py-2.5">
                  <Link href={`/u/${p.username}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar src={p.avatar} alt={p.displayName} size={40} square={p.isOrg} />
                    <span className="min-w-0"><span className="block truncate font-bold text-ink">{p.displayName}</span><span className="block truncate text-xs text-slate">@{p.username}{p.channel ? " · channel" : p.isOrg ? " · organisation" : ""}</span></span>
                  </Link>
                  {owner && kind === "following" && <button type="button" onClick={() => unfollow(p.username)} className="rounded-full border border-rule px-3 py-1 font-ui text-xs font-semibold hover:border-crimson">Unfollow</button>}
                </li>
              ))}
            </ul>
          )}
          {loading && <p className="py-3 text-sm text-slate">Loading…</p>}
          {!loading && !error && !people.length && <p className="py-3 text-sm text-slate">{kind === "followers" ? "No followers yet." : "Not following anyone yet."}</p>}
          {!loading && next && !error && <button type="button" onClick={() => load(kind, next)} className="btn-ghost mt-3 !px-4 !py-2 text-xs">Show more</button>}
        </div>
      </div>
    </div>
  );
}
