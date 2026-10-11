"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";

const ghost = "rounded-full border border-rule px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50";
const solid = "rounded-full bg-crimson px-4 py-2 font-ui text-xs font-semibold text-paper hover:bg-crimson-bright disabled:opacity-50";
const RANGES = [["this_week", "This week"], ["last_week", "Last week"], ["last_30_days", "Last 30 days"]] as const;

// The team hub's Granola panel. Each person connects their own Granola account (it opens Granola to approve access, then returns here).
// Meeting notes are read from Granola when you ask and are not kept by #NotesApp; only the follow-ups you tick become work items.
export default function GranolaPanel({ user, onAdd }: { user: User; onAdd: (titles: string[]) => Promise<void> }) {
  const [status, setStatus] = useState<{ connected: boolean; canConnect: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [range, setRange] = useState<string>("this_week");
  const [list, setList] = useState("");
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<{ text: string; items: string[] } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const call = useCallback(async (body?: Record<string, unknown>) => {
    const r = await fetch("/api/admin/granola", body
      ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body) }
      : { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    const j = await r.json();
    if (!r.ok) { if (j.reconnect) setStatus((s) => (s ? { ...s, connected: false } : s)); throw new Error(j.error || "Something went wrong"); }
    return j;
  }, [user]);
  useEffect(() => { call().then(setStatus).catch(() => setStatus({ connected: false, canConnect: false })); }, [call]);
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("granola");
    if (!g) return;
    setOpen(true);
    if (g === "connected") setNote("Granola is connected.");
    else setError(g === "denied" ? "You didn't approve access in Granola." : "Connecting to Granola didn't work. Please try again.");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const run = async <T,>(fn: () => Promise<T>, ok = "") => {
    setBusy(true); setError(""); setNote("");
    try { const r = await fn(); if (ok) setNote(ok); return r; } catch (e) { setError((e as Error).message); return undefined; } finally { setBusy(false); }
  };
  const connect = () => run(async () => { const { url } = await call({ action: "start" }); window.location.href = url; });

  if (!status) return null;
  return (
    <section className="card mt-6 p-5" aria-labelledby="granola-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="granola-h" className="font-display text-2xl text-ink">Meetings from Granola</h2>
          <p className="text-xs text-slate">{status.connected ? "Connected to your Granola account." : "Bring your meeting notes and follow-ups into the hub."}</p>
        </div>
        <div className="flex gap-2">
          {status.connected ? <>
            <button type="button" className={ghost} onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Hide" : "Open"}</button>
            <button type="button" className={ghost} disabled={busy} onClick={() => run(async () => { await call({ action: "disconnect" }); setStatus({ ...status, connected: false }); setList(""); setAnswer(null); }, "Disconnected. Your notes stay in Granola.")}>Disconnect</button>
          </> : <button type="button" className={solid} disabled={busy || !status.canConnect} onClick={connect} title={status.canConnect ? "" : "Not set up on the server yet"}>Connect Granola</button>}
        </div>
      </div>
      {!status.connected && <p className="mt-2 text-xs text-slate">You need a Granola account (the meeting-notes MCP access is switched on at <a className="underline" href="https://granola.ai/mcp-signup" target="_blank" rel="noreferrer">granola.ai/mcp-signup</a>). Each team member connects their own. We keep only an encrypted access key, and read notes from Granola when you ask; we don&apos;t store them.</p>}
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mt-3 text-sm text-green-700" role="status">{note}</p>}

      {status.connected && open && (
        <div className="mt-4 space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Which meetings" value={range} onChange={(e) => setRange(e.target.value)} className="rounded-lg border border-rule bg-card px-2 py-1.5 text-sm">{RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <button type="button" className={ghost} disabled={busy} onClick={async () => { const r = await run(() => call({ action: "meetings", range })); if (r) setList(r.text || "No meetings found for that time."); }}>Show meetings</button>
            </div>
            {list && <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-paper p-3 font-body text-sm text-ink">{list}</pre>}
          </div>
          <form onSubmit={async (e) => { e.preventDefault(); const r = await run(() => call({ action: "ask", query: q })); if (r) { setAnswer({ text: r.text, items: r.items ?? [] }); setPicked(new Set()); } }}>
            <label className="block text-xs text-slate">Ask your meeting notes
              <span className="mt-1 flex gap-2"><input className="block w-full rounded-lg border border-rule bg-card px-3 py-2 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example: What follow-ups came out of this week's meetings?" maxLength={600} /><button className={solid} disabled={busy || q.trim().length < 3}>{busy ? "Asking…" : "Ask"}</button></span>
            </label>
          </form>
          {answer && (
            <div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-paper p-3 font-body text-sm text-ink">{answer.text || "Granola had nothing to say about that."}</pre>
              {answer.items.length > 0 && (
                <div className="mt-3">
                  <p className="font-ui text-sm font-bold text-ink">Add to this week&apos;s work</p>
                  <ul className="mt-2 space-y-1">
                    {answer.items.map((t) => (
                      <li key={t}><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={picked.has(t)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(t); else n.delete(t); return n; })} />{t}</label></li>
                    ))}
                  </ul>
                  <button type="button" className={`${solid} mt-3`} disabled={busy || picked.size === 0} onClick={() => run(async () => { await onAdd([...picked]); setPicked(new Set()); }, "Added to this week's work.")}>Add {picked.size || ""} to the work board</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
