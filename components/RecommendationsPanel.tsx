"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import Avatar from "@/components/Avatar";
import { RECOMMENDATION_MAX, RELATIONSHIPS, type Recommendation } from "@/lib/reviews";

type Data = { approved: Recommendation[]; waiting: Recommendation[]; mine: Recommendation | null };
const field = "mt-1 w-full rounded-lg border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { month: "short", year: "numeric" });

function Who({ r }: { r: Recommendation }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar src={r.authorAvatar} alt={r.authorName} size={40} square={r.authorIsOrg} />
      <div className="min-w-0">
        <p className="truncate font-ui text-sm font-bold text-ink">{r.authorUsername ? <Link href={`/u/${r.authorUsername}`} className="hover:underline">{r.authorName}</Link> : r.authorName}</p>
        <p className="text-xs text-slate">{r.relationship} · {dayLabel(r.createdAt)}</p>
      </div>
    </div>
  );
}

// Recommendations on a profile (a person or an organisation). Anyone signed in can write one for someone else; it shows publicly only after the
// person recommended approves it, and they can hide it later. One per pair; the author can rewrite or withdraw theirs.
export default function RecommendationsPanel({ subjectUid, subjectName, user }: { subjectUid: string; subjectName: string; user: User | null | undefined }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [relationship, setRelationship] = useState<string>(RELATIONSHIPS[0]);
  const [text, setText] = useState("");

  const call = useCallback(async (body?: Record<string, unknown>) => {
    const headers: Record<string, string> = user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {};
    const r = body ? await fetch("/api/recommendations", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) }) : await fetch(`/api/recommendations?subjectUid=${encodeURIComponent(subjectUid)}`, { headers });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user, subjectUid]);
  const load = useCallback(() => call().then(setData).catch(() => setData({ approved: [], waiting: [], mine: null })), [call]);
  useEffect(() => { if (user !== undefined) load(); }, [user, load]);
  const run = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setError(""); setNote("");
    try { await call(body); setNote(ok); await load(); return true; } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  };

  if (!data) return null;
  const isSelf = user?.uid === subjectUid;
  const canWrite = !!user && !isSelf;
  if (!data.approved.length && !data.waiting.length && !canWrite) return null;

  return (
    <section className="mt-14" id="recommendations" aria-label="Recommendations">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Recommendations{data.approved.length ? ` · ${data.approved.length}` : ""}</p>
        {canWrite && !open && <button type="button" onClick={() => { setOpen(true); setNote(""); if (data.mine) { setRelationship(data.mine.relationship); setText(data.mine.text); } }} className="rounded-full border border-rule px-4 py-1.5 font-ui text-xs font-semibold hover:border-crimson">{data.mine ? "Edit my recommendation" : `Recommend ${subjectName}`}</button>}
      </div>
      {note && <p className="mt-3 text-sm text-green-700" role="status">{note}</p>}

      {data.waiting.length > 0 && (
        <div className="card mt-4 border-amber-300 p-5">
          <p className="font-ui text-sm font-bold text-ink">Waiting for you ({data.waiting.length})</p>
          <p className="text-xs text-slate">Only recommendations you approve show on your profile. You can hide one later.</p>
          <ul className="mt-3 divide-y divide-rule">
            {data.waiting.map((r) => (
              <li key={r.id} className="py-3">
                <Who r={r} />
                <p className="mt-2 whitespace-pre-line text-sm text-ink">{r.text}</p>
                <div className="mt-2 flex gap-2">
                  {r.status === "pending" && <button type="button" disabled={busy} onClick={() => run({ action: "approve", id: r.id }, "Approved. It shows on your profile now.")} className="rounded-full bg-crimson px-4 py-1.5 font-ui text-xs font-semibold text-paper disabled:opacity-50">Show on my profile</button>}
                  {r.status === "hidden" && <button type="button" disabled={busy} onClick={() => run({ action: "approve", id: r.id }, "It shows on your profile again.")} className="rounded-full border border-rule px-4 py-1.5 font-ui text-xs font-semibold disabled:opacity-50">Show again</button>}
                  {r.status === "pending" && <button type="button" disabled={busy} onClick={() => run({ action: "hide", id: r.id }, "Hidden.")} className="rounded-full border border-rule px-4 py-1.5 font-ui text-xs font-semibold disabled:opacity-50">Not now</button>}
                  {r.status === "hidden" && <span className="self-center text-xs text-slate">Hidden</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && canWrite && (
        <form className="card mt-4 p-5" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "write", subjectUid, relationship, text }, `Sent. It shows on ${subjectName}'s profile once they approve it.`)) { setOpen(false); setText(""); } }}>
          <p className="font-ui text-sm font-bold text-ink">Recommend {subjectName}</p>
          <label className="mt-3 block text-xs text-slate">How do you know them?
            <select className={field} value={relationship} onChange={(e) => setRelationship(e.target.value)}>{RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}</select>
          </label>
          <label className="mt-3 block text-xs text-slate">What should people know?
            <textarea className={field} rows={4} maxLength={RECOMMENDATION_MAX} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <p className="mt-1 text-xs text-slate">Be honest and specific. They approve it before it is public, and your name and picture appear with it.</p>
          {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button disabled={busy} className="rounded-full bg-crimson px-5 py-2 font-ui text-xs font-semibold text-paper hover:bg-crimson-bright disabled:opacity-50">{data.mine ? "Save" : "Send"}</button>
            <button type="button" className="rounded-full border border-rule px-4 py-2 font-ui text-xs font-semibold" onClick={() => setOpen(false)}>Cancel</button>
            {data.mine && <button type="button" disabled={busy} className="rounded-full border border-rule px-4 py-2 font-ui text-xs font-semibold text-crimson" onClick={async () => { if (await run({ action: "withdraw", id: data.mine!.id }, "Withdrawn.")) setOpen(false); }}>Withdraw</button>}
          </div>
        </form>
      )}
      {!open && error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      {!open && data.mine && data.mine.status !== "approved" && <p className="mt-3 text-xs text-slate">Your recommendation is {data.mine.status === "pending" ? "waiting for approval" : "hidden by them"}.</p>}

      {data.approved.length > 0 ? (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {data.approved.map((r) => (
            <li key={r.id} className="card p-5">
              <Who r={r} />
              <p className="mt-3 whitespace-pre-line text-sm text-ink">“{r.text}”</p>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-slate">{isSelf ? "No recommendations yet. Ask people you have worked with or helped to write one." : "No recommendations yet."}</p>}
    </section>
  );
}
