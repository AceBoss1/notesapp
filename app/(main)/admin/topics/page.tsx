"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import { hashtag } from "@/lib/topics";
import { subtopicHashtag } from "@/lib/subtopics";

type Row = { kind: "topic" | "category"; parent: string; slug: string; label: string; uses: number; createdAt: string };

// Admin → Topics (lib/subtopics-server.ts): the subtopics and Market subcategories members have created from Nana's suggestions, newest
// first. Rename one (it reads differently from now on) or remove it from the lists. Content and moderation staff.
export default function AdminTopicsPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/topics");
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<"topic" | "category">("topic");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(""); }
  }, []);
  const load = useCallback(() => run("load", async () => setRows((await call()).rows)), [call, run]);
  useEffect(() => { if (user) void load(); }, [user, load]);
  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const shown = rows.filter((r) => r.kind === kind);
  const key = (r: Row) => `${r.kind}/${r.parent}/${r.slug}`;
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-4xl">Topics</h1>
      <p className="mt-2 text-sm text-slate">Subtopics and Market subcategories that members created from Nana&apos;s suggestions. They go live straight away; rename or remove any that don&apos;t belong.</p>
      <div className="mt-5 flex gap-2">
        {(["topic", "category"] as const).map((k) => <button key={k} onClick={() => setKind(k)} className={`rounded-full px-4 py-1.5 font-ui text-sm font-semibold ${kind === k ? "bg-crimson text-paper" : "border border-rule"}`}>{k === "topic" ? "Subtopics" : "Market subcategories"}</button>)}
      </div>
      {error && <p className="mt-4 text-sm text-crimson" role="alert">{error}</p>}
      {shown.length === 0 ? <p className="mt-6 text-sm text-slate">{busy === "load" ? "Loading…" : "None yet."}</p> : (
        <ul className="mt-5 divide-y divide-rule rounded-2xl border border-rule bg-card">
          {shown.map((r) => (
            <li key={key(r)} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-ui font-semibold text-ink">{r.kind === "topic" ? <>{hashtag(r.parent)} › {subtopicHashtag(r.label)}</> : <>{r.parent} › {r.label}</>}</p>
                <p className="text-xs text-slate">Used {r.uses} time{r.uses === 1 ? "" : "s"} · added {r.createdAt.slice(0, 10)}</p>
              </div>
              <input value={names[key(r)] ?? r.label} onChange={(e) => setNames((n) => ({ ...n, [key(r)]: e.target.value }))} aria-label={`New name for ${r.label}`} className="w-40 rounded-lg border border-rule bg-paper px-3 py-1.5 text-sm" />
              <button disabled={!!busy || (names[key(r)] ?? r.label) === r.label} onClick={() => run(key(r), async () => { await call({ action: "rename", kind: r.kind, parent: r.parent, slug: r.slug, label: names[key(r)] }); await load(); })} className="btn-ghost !px-3 !py-1.5 text-xs disabled:opacity-40">Rename</button>
              <button disabled={!!busy} onClick={() => { if (confirm(`Remove ${r.label}? It leaves the suggestions; content already saved with it keeps it.`)) void run(key(r), async () => { await call({ action: "remove", kind: r.kind, parent: r.parent, slug: r.slug }); await load(); }); }} className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
