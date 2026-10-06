"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import type { Orphans } from "@/lib/media-cleanup";

type Diag = { tokenSet: boolean; accountIdEnding: string; ok: boolean; status: number; code: string; message: string };

// Video storage: tests the Cloudflare Stream connection (the exact reply, for when /status says Video courses is down) and
// clears out files that nothing uses any more (deleted items, abandoned uploads).
export default function AdminStreamPage() {
  const { user, loading } = useAdminAuth();
  const [diag, setDiag] = useState<Diag | null>(null);
  const [orphans, setOrphans] = useState<Orphans | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const call = useCallback(async (path: string, init?: RequestInit) => {
    const r = await fetch(path, { ...init, headers: { Authorization: `Bearer ${await user!.getIdToken()}`, "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);

  const test = useCallback(async (scan: boolean) => {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const j = await call(`/api/admin/stream${scan ? "?scan=1" : ""}`);
      setDiag(j.diagnostics);
      if (scan) setOrphans(j.orphans);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, [call]);
  useEffect(() => { if (user) void test(false); }, [user, test]);

  async function clean() {
    if (!orphans || !confirm(`Delete ${orphans.videos.length} video(s), ${orphans.objects.length} stored file(s) and ${orphans.records.length} record(s) nothing uses? This can't be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      const j = await call("/api/admin/stream", { method: "POST" });
      setMsg(`Removed ${j.removed.videos} video(s), ${j.removed.objects} file(s) and ${j.removed.records} record(s).`);
      setOrphans(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const total = orphans ? orphans.videos.length + orphans.objects.length + orphans.records.length : 0;
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-4xl">Video storage</h1>
      <p className="mt-2 text-sm text-slate">Cloudflare Stream hosts the video lessons of view-only items and courses; PDF lessons and downloads sit in the private bucket.</p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {msg && <p className="mt-4 text-sm text-emerald-800">{msg}</p>}

      <h2 className="mt-10 font-display text-2xl">Connection</h2>
      {diag && (
        <div className={`card mt-3 p-4 text-sm ${diag.ok ? "border-emerald-300" : "border-crimson"}`}>
          <p className="font-ui font-bold text-ink">{diag.ok ? "Connected" : "Not working"}</p>
          <p className="mt-1 text-slate">{diag.message}</p>
          <p className="mt-2 font-mono text-xs text-slate">token {diag.tokenSet ? "set" : "NOT set"} · account {diag.accountIdEnding || "—"}{diag.status ? ` · HTTP ${diag.status}` : ""}{diag.code ? ` · code ${diag.code}` : ""}</p>
        </div>
      )}
      <button onClick={() => test(false)} disabled={busy} className="btn-ghost mt-3 !px-4 !py-2 text-xs">Test connection</button>

      <h2 className="mt-10 font-display text-2xl">Clean up unused files</h2>
      <p className="mt-2 text-sm text-slate">Finds videos and files that no item uses any more: left behind when a seller deleted an item or abandoned an upload. Anything a buyer can still open is kept, and anything under a day old is left alone.</p>
      <button onClick={() => test(true)} disabled={busy} className="btn-primary mt-3 !px-4 !py-2 text-xs">{busy ? "Working…" : "Scan"}</button>
      {orphans && (
        <div className="card mt-4 p-4 text-sm">
          <p className="text-ink">
            {total === 0 ? "Nothing to clean up." : <>Found <strong>{orphans.videos.length}</strong> video(s), <strong>{orphans.objects.length}</strong> stored file(s) and <strong>{orphans.records.length}</strong> record(s) of deleted items.</>}
          </p>
          {!orphans.streamChecked && <p className="mt-1 text-xs text-slate">Stream isn&apos;t configured, so videos weren&apos;t checked.</p>}
          {!orphans.bucketChecked && <p className="mt-1 text-xs text-slate">Private storage isn&apos;t configured, so files weren&apos;t checked.</p>}
          {orphans.videos.length > 0 && <ul className="mt-2 max-h-40 overflow-auto font-mono text-xs text-slate">{orphans.videos.map((v) => <li key={v.uid}>{v.name || v.uid} · {v.minutes} min</li>)}</ul>}
          {total > 0 && <button onClick={clean} disabled={busy} className="btn-primary mt-3 !px-4 !py-2 text-xs">Delete them</button>}
        </div>
      )}
    </section>
  );
}
