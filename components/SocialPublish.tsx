"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import { LINKEDIN_LIMIT, X_LIMIT, xWeight } from "@/lib/social-text";

type Provider = "linkedin" | "x";
type Conn = { provider: Provider; label: string; configured: boolean; connected: boolean; name?: string; handle?: string; needsReconnect?: boolean };
type Result = { provider: Provider; ok: boolean; url?: string; error?: string; code?: "reconnect" | "already" };

// For the author, under their own post: post an excerpt with a link back to the full journal to their LinkedIn or X, in one go. They connect an
// account once, read and edit the words, and press Post. Nothing goes out without that last press. Hidden while no network is set up.
export default function SocialPublish({ noteId, authorUid }: { noteId: string; authorUid?: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [conns, setConns] = useState<Conn[] | null>(null);
  const [picked, setPicked] = useState<Record<Provider, boolean>>({ linkedin: true, x: true });
  const [texts, setTexts] = useState<Record<Provider, string> | null>(null);
  const [url, setUrl] = useState(""); // the link to the journal, which X posts always carry
  const [results, setResults] = useState<Result[] | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const isAuthor = !!user && !!authorUid && user.uid === authorUid;
  const load = useCallback(() => { api<{ connections: Conn[] }>("/api/social/connections").then((r) => setConns(r.connections)).catch(() => setConns([])); }, []);
  useEffect(() => { if (isAuthor) load(); }, [isAuthor, load]);

  // Back from a network's sign-in page: say how it went, then tidy the address.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("social");
    if (!s) return;
    setNotice(s === "connected" ? `${q.get("provider") === "x" ? "X" : "LinkedIn"} is connected. Write the post and press Post when you're happy with it.` : `${q.get("provider") === "x" ? "X" : "LinkedIn"} wasn't connected. You can try again.`);
    q.delete("social"); q.delete("provider");
    window.history.replaceState(null, "", `${window.location.pathname}${q.toString() ? `?${q}` : ""}`);
  }, []);

  if (!isAuthor || !conns || !conns.some((c) => c.configured)) return null;
  const live = conns.filter((c) => c.configured);
  const ready = live.filter((c) => c.connected && !c.needsReconnect && picked[c.provider]);

  async function connect(provider: Provider) {
    setBusy(true); setError("");
    try {
      const r = await api<{ url: string }>("/api/social/connect", { body: { provider, host: window.location.hostname, path: window.location.pathname } });
      window.location.href = r.url;
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't start the connection."); setBusy(false); }
  }
  async function disconnect(provider: Provider) {
    if (!confirm(`Disconnect ${provider === "x" ? "X" : "LinkedIn"}? We'll delete the saved access. You can connect again any time.`)) return;
    try { await api("/api/social/disconnect", { body: { provider } }); setTexts(null); load(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't disconnect."); }
  }
  async function write() {
    setBusy(true); setError(""); setResults(null);
    try { const r = await api<{ texts: Record<Provider, string>; url: string }>("/api/social/preview", { body: { noteId } }); setTexts(r.texts); setUrl(r.url); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't prepare the post."); }
    finally { setBusy(false); }
  }
  async function post(force = false) {
    if (!texts) return;
    setBusy(true); setError("");
    try {
      const r = await api<{ results: Result[] }>("/api/social/publish", { body: { noteId, targets: ready.map((c) => c.provider), texts, force } });
      setResults(r.results); load();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't post."); }
    finally { setBusy(false); }
  }
  // X posts always carry the link: it is added if the words no longer have it.
  const xFull = (t: string) => (url && !t.includes(url) ? `${t.trim()}\n\n${url}` : t);
  const over = (p: Provider) => (p === "x" ? xWeight(xFull(texts?.x ?? "")) > X_LIMIT : (texts?.linkedin.length ?? 0) > LINKEDIN_LIMIT);
  const small = "rounded border border-rule px-2 py-1 text-[11px] font-semibold hover:border-crimson hover:text-crimson disabled:opacity-50";

  return (
    <section className="mt-6 rounded-lg border border-rule bg-card p-5" aria-labelledby="share-networks">
      <h2 id="share-networks" className="font-display text-xl text-ink">Share this post to your networks</h2>
      <p className="mt-1 text-sm text-slate">We post a short excerpt with a link that opens the full journal here. You see and can change the words first, and nothing goes out until you press Post.</p>
      {notice && <p className="mt-3 text-sm text-ink" role="status">{notice}</p>}
      <ul className="mt-3 space-y-2">
        {live.map((c) => (
          <li key={c.provider} className="flex flex-wrap items-center gap-3 text-sm">
            <label className={`flex items-center gap-2 ${c.connected && !c.needsReconnect ? "text-ink" : "text-slate"}`}>
              <input type="checkbox" disabled={!c.connected || c.needsReconnect} checked={picked[c.provider] && c.connected && !c.needsReconnect} onChange={(e) => setPicked({ ...picked, [c.provider]: e.target.checked })} />
              <strong>{c.label}</strong>
            </label>
            {c.connected && !c.needsReconnect && <span className="text-xs text-slate">connected as {c.handle ? `@${c.handle}` : c.name}</span>}
            {c.connected && !c.needsReconnect && <button onClick={() => disconnect(c.provider)} className="text-xs text-slate underline">Disconnect</button>}
            {(!c.connected || c.needsReconnect) && <button disabled={busy} onClick={() => connect(c.provider)} className={small}>{c.needsReconnect ? `Reconnect ${c.label}` : `Connect ${c.label}`}</button>}
            {c.needsReconnect && <span className="text-xs text-crimson">The connection has expired.</span>}
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      {!texts && <button disabled={busy || !ready.length} onClick={write} className="btn-primary mt-4 !px-4 !py-2 text-xs disabled:opacity-50">{ready.length ? "Write the post" : "Connect an account to begin"}</button>}
      {texts && !results && (
        <div className="mt-4 space-y-3">
          {ready.map((c) => (
            <label key={c.provider} className="block text-[11px] text-slate">
              {c.label}
              <textarea value={texts[c.provider]} rows={c.provider === "x" ? 6 : 8} onChange={(e) => setTexts({ ...texts, [c.provider]: e.target.value })} className="mt-1 block w-full border border-rule bg-paper px-2 py-1.5 text-sm text-ink" />
              <span className={over(c.provider) ? "text-red-700" : ""}>{c.provider === "x" ? `${xWeight(xFull(texts.x))} of ${X_LIMIT}${texts.x.includes(url) ? " (a link counts as 23)" : " (with the link added after your words: a link counts as 23)"}` : `${texts.linkedin.length} of ${LINKEDIN_LIMIT}. The post also carries a card that opens the journal.`}</span>
            </label>
          ))}
          <span className="flex flex-wrap gap-2">
            <button disabled={busy || !ready.length || ready.some((c) => over(c.provider))} onClick={() => post()} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">{busy ? "Posting…" : `Post to ${ready.map((c) => c.label).join(" and ")}`}</button>
            <button onClick={() => setTexts(null)} className={small}>Cancel</button>
          </span>
        </div>
      )}
      {results && (
        <div className="mt-4 space-y-1.5 text-sm" role="status">
          {results.map((r) => (
            <p key={r.provider} className={r.ok ? "text-emerald-800" : "text-red-700"}>
              {r.provider === "x" ? "X" : "LinkedIn"}: {r.ok ? <>posted. <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">See it</a></> : <>{r.error} {r.code === "already" && <button onClick={() => { setResults(null); void post(true); }} className="underline">Post it again</button>}{r.code === "reconnect" && <button onClick={() => void connect(r.provider)} className="underline">Connect again</button>}</>}
            </p>
          ))}
          <button onClick={() => { setResults(null); setTexts(null); }} className={`${small} mt-2`}>Done</button>
        </div>
      )}
    </section>
  );
}
