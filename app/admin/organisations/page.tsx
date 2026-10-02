"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { CAC_SEARCH_URL, OrgInfo } from "@/lib/org";

type Org = { uid: string; username: string; displayName: string; accountTier: string; trialUntil: string | null; org: OrgInfo | null };
type Req = { uid: string; username?: string; displayName?: string; rcNumber: string; requestedAt: string };

export default function AdminOrganisationsPage() {
  const { user, loading } = useAdminAuth();
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [error, setError] = useState("");

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
              {o.org?.rcStatus !== "rejected" && <button onClick={() => act("reject", o.uid, true)} className="text-slate hover:text-crimson">Reject</button>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
