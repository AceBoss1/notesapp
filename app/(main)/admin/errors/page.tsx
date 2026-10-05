"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";

type Row = { id: string; message: string; stackTop?: string; stack?: string; route?: string; source: "server" | "client"; count: number; firstSeenAt: string; lastSeenAt: string; lastUrl?: string };

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export default function AdminErrorsPage() {
  const { user, loading } = useAdminAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/admin/errors", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't load");
      setRows(j.errors);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load");
    }
  }, [user]);
  useEffect(() => {
    load();
  }, [load]);

  async function clear(id: string) {
    if (!user) return;
    await fetch("/api/admin/errors", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ action: "clear", id }) });
    load();
  }

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const last24 = (rows ?? []).filter((r) => Date.now() - new Date(r.lastSeenAt).getTime() < 86_400_000);
  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="font-display text-4xl">Errors</h1>
      <p className="mt-2 text-sm text-slate">
        Unexpected server and browser errors, grouped (same error, one row with a count). Each new one also emails support. Rows disappear on their own after 30 days; clear one once it is fixed.
        {rows && <> {last24.length} seen in the last 24 hours, {rows.length} in total.</>}
      </p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {rows?.length === 0 && <p className="card mt-8 p-5 text-sm text-slate">No errors recorded. 🎉</p>}
      <ul className="mt-8 space-y-3">
        {rows?.map((r) => (
          <li key={r.id} className="card p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold text-ink">{r.message}</p>
              <span className="rounded-full bg-paper px-3 py-0.5 font-mono text-[11px] uppercase">{r.source} · {r.count}×</span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-slate">{r.route || "—"} · first {ago(r.firstSeenAt)} · last {ago(r.lastSeenAt)}{r.lastUrl ? ` · ${r.lastUrl}` : ""}</p>
            {r.stackTop && <p className="mt-1 font-mono text-[11px] text-slate">{r.stackTop}</p>}
            <div className="mt-2 flex gap-3 text-xs font-semibold">
              {r.stack && <button onClick={() => setOpen(open === r.id ? null : r.id)} className="text-crimson">{open === r.id ? "Hide" : "Show"} stack</button>}
              <button onClick={() => clear(r.id)} className="text-slate hover:text-crimson">Clear</button>
            </div>
            {open === r.id && <pre className="mt-2 overflow-x-auto bg-paper p-3 text-[11px] text-ink">{r.stack}</pre>}
          </li>
        ))}
      </ul>
    </section>
  );
}
