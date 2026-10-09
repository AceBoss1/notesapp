"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

// Connect your own AI account: paste an Anthropic API key. It is checked, kept encrypted and used only for Nana, the writing help in drafts,
// sharing and messages, and the team hub, so the cost lands on the member's own account. The key is never shown again, only its last four characters.
type Status = { connected: boolean; last4?: string; connectedAt?: string; canConnect: boolean; platformAi: boolean };

export default function NanaConnect() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [status, setStatus] = useState<Status | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const call = useCallback(async (method: "GET" | "POST" | "DELETE", body?: unknown) => {
    const r = await fetch("/api/nana/connect", { method, headers: { Authorization: `Bearer ${await user!.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j as Status;
  }, [user]);
  useEffect(() => { if (user) call("GET").then(setStatus).catch((e) => setError(e.message)); }, [user, call]);

  async function run(fn: () => Promise<Status>, done: string) {
    setBusy(true); setError(""); setNote("");
    try { setStatus(await fn()); setKey(""); setNote(done); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  if (user === undefined) return <p className="text-sm text-slate">Loading…</p>;
  if (!user) return <p className="text-sm text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to connect your own AI account.</p>;
  if (!status) return error ? <p className="text-sm text-red-700" role="alert">{error}</p> : <p className="text-sm text-slate">Loading…</p>;
  if (!status.canConnect && !status.connected) return <p className="text-sm text-slate">Connecting your own AI account isn&apos;t switched on yet. Please <Link href="/contact" className="text-crimson underline">contact us</Link>.</p>;
  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mb-3 text-sm text-green-700" role="status">{note}</p>}
      {status.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-card p-4">
          <p className="text-sm text-ink"><strong>Connected</strong> · Anthropic key ending in <span className="font-mono">{status.last4}</span>{status.connectedAt ? ` · since ${new Date(status.connectedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}` : ""}</p>
          <button type="button" disabled={busy} onClick={() => run(() => call("DELETE"), "Disconnected. Your key has been deleted.")} className="border border-rule px-4 py-2 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50">Disconnect</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); run(() => call("POST", { key }), "Connected. Nana will use your AI account now."); }}>
          <label className="block text-xs text-slate">Your Anthropic API key
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} placeholder="sk-ant-…" className="mt-1 w-full border border-rule bg-card px-3 py-2 font-mono text-sm text-ink outline-none focus:border-crimson" />
          </label>
          <p className="mt-2 text-xs text-slate">Make one at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="underline">console.anthropic.com</a> (you can set a spending limit there). We check that it works, keep it encrypted, and use it only for the things above. Remove it any time.</p>
          <button type="submit" disabled={busy || key.trim().length < 20} className="btn-primary mt-3 disabled:opacity-50">{busy ? "Checking…" : "Connect"}</button>
        </form>
      )}
    </div>
  );
}
