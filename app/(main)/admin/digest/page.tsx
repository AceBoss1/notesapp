"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";

type Status = {
  on: boolean; forcedByVercel: boolean; switchedAt: string | null; linkSecret: string | null; emailReady: boolean; perRun: number;
  thisWeek: { id: string; sent: number; done: boolean }; nextSendAt: string;
};
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });

// Admin → Weekly digest: see this week's digest as you'd get it, send it to yourself, and switch the Sunday send on or off
// (lib/digest-server.ts). Owner and super admins only.
export default function AdminDigestPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/digest");
  const [status, setStatus] = useState<Status | null>(null);
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(""); setMsg("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(""); }
  }, []);
  useEffect(() => { if (user) void run("load", async () => setStatus(await call())); }, [user, call, run]);

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const ready = !!status?.linkSecret && !!status?.emailReady;
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-4xl">Weekly digest</h1>
      <p className="mt-2 text-sm text-slate">Every Sunday from 5 PM Lagos time, up to five of the week&apos;s journals to each member with a confirmed email: people they follow first, then their interests, then the most liked. Members can unsubscribe from any digest or in Account settings.</p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {msg && <p className="mt-4 text-sm text-emerald-800">{msg}</p>}

      {status && (
        <div className={`card mt-6 p-5 ${status.on ? "border-emerald-300" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-ui text-lg font-bold text-ink">{status.on ? "On" : "Off"}</p>
              <p className="text-sm text-slate">{status.on ? `Next send: ${when(status.nextSendAt)}` : "Nothing is sent while it's off."}</p>
            </div>
            {status.forcedByVercel ? (
              <p className="max-w-xs text-xs text-slate">On because WEEKLY_DIGEST=on is set in Vercel. Remove it there to use this switch.</p>
            ) : (
              <button
                disabled={!!busy || (!status.on && !ready)}
                onClick={() => {
                  if (!status.on && !confirm(`Turn the weekly digest on? From ${when(status.nextSendAt)} it emails every member with a confirmed email, ${status.perRun} per run (about every 15 minutes). Resend's free plan allows 100 emails a day for everything.`)) return;
                  void run("switch", async () => { setStatus(await call({ action: status.on ? "turn_off" : "turn_on" })); setMsg(status.on ? "Turned off." : "Turned on."); });
                }}
                className={`${status.on ? "btn-ghost" : "btn-primary"} !px-5 !py-2 text-sm`}
              >
                {busy === "switch" ? "Saving…" : status.on ? "Turn off" : "Turn on"}
              </button>
            )}
          </div>
          <ul className="mt-4 space-y-1 border-t border-rule pt-3 text-sm">
            <li>{status.emailReady ? "✓" : "✕"} Email (Resend) {status.emailReady ? "is set up" : "isn't set up: add RESEND_API_KEY in Vercel"}</li>
            <li>{status.linkSecret ? "✓" : "✕"} Unsubscribe links are signed {status.linkSecret ? `with ${status.linkSecret}` : ": add EMAIL_LINK_SECRET in Vercel"}</li>
            <li className="text-slate">This week ({status.thisWeek.id}): {status.thisWeek.sent} sent{status.thisWeek.done ? ", finished" : ""} · {status.perRun} per run (DIGEST_PER_RUN)</li>
          </ul>
          {status.switchedAt && <p className="mt-2 text-xs text-slate">Switch last changed {when(status.switchedAt)}.</p>}
        </div>
      )}

      <h2 className="mt-10 font-display text-2xl">This week&apos;s digest</h2>
      <p className="mt-2 text-sm text-slate">As you would get it. Sending a test works while the digest is off.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={!!busy} onClick={() => run("preview", async () => { const j = await call({ action: "preview" }); setHtml(j.html); })} className="btn-ghost !px-4 !py-2 text-xs">{busy === "preview" ? "Loading…" : "Preview"}</button>
        <button disabled={!!busy} onClick={() => run("test", async () => { const j = await call({ action: "send_test" }); setMsg(`Sent to ${j.to}. Check your inbox (and spam).`); })} className="btn-primary !px-4 !py-2 text-xs">{busy === "test" ? "Sending…" : "Send me a test"}</button>
      </div>
      {html && <iframe title="Weekly digest preview" srcDoc={html} sandbox="" className="mt-4 h-[900px] w-full rounded border border-rule bg-white" />}
    </section>
  );
}
