"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { capi, field } from "@/components/community/api";

type Run = { id: string; name: string };

// Under "Choose what shows" on Your site: the member's community as a page of their site (<site>/community, on their own domain too; owner,
// 22 Oct 2026). Shown to anyone who runs a community (owner or admin): link one here, or switch its page on and off. Saved straight away
// through /api/site/community, like the panel under the kits (components/site-settings/CommunityPanel.tsx).
export default function CommunityPageCard({ linked, page, domain, onSave }: {
  linked: string; page: boolean; domain: string | null; onSave: (cid: string, page: boolean) => Promise<void>;
}) {
  const [run, setRun] = useState<Run[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [on, setOn] = useState(page); // switches straight away; put back if the save fails
  useEffect(() => setOn(page), [page]);
  useEffect(() => { capi<{ communities: Run[] }>("/api/community?run=1").then((d) => setRun(d.communities)).catch(() => setRun([])); }, []);
  if (!run || (!run.length && !linked)) return null; // nothing to show for someone who doesn't run a community
  const current = run.find((c) => c.id === linked);
  async function save(cid: string, on: boolean) {
    const was = page;
    setBusy(true); setErr(""); setOn(on);
    try { await onSave(cid, on); } catch (e) { setOn(was); setErr(e instanceof Error ? e.message : "Couldn't save that."); } finally { setBusy(false); }
  }
  const where = domain ? `${domain}/community` : "your site's /community";
  return (
    <div className={`${field} mt-3 flex items-start gap-3 ${linked && on ? "border-crimson" : ""}`}>
      <input type="checkbox" aria-label="Community page" checked={!!linked && on} disabled={!linked || busy} onChange={(e) => save(linked, e.target.checked)} className="mt-1" />
      <span className="min-w-0 flex-1">
        <span className="block font-ui text-sm font-bold text-ink">Community</span>
        <span className="mt-1 block text-xs text-slate">
          {linked
            ? <>Your community, {current?.name ?? linked}, as a page of your site at <strong className="text-ink">{where}</strong>, with a link in your menu: members join, post, chat and go live without leaving your site.</>
            : <>Show a community you run as a page of your site, at {where}, with a link in your menu.</>}
        </span>
        {!linked && (
          <span className="mt-2 flex flex-wrap items-center gap-2">
            {run.map((c) => <button key={c.id} type="button" disabled={busy} onClick={() => save(c.id, true)} className="rounded-full border border-crimson px-3 py-1 text-xs font-semibold text-crimson hover:bg-crimson hover:text-paper">Link {c.name}</button>)}
          </span>
        )}
        {linked && <Link href={`/c/${linked}?tab=admin`} className="mt-1 block text-xs text-crimson underline">Manage the community</Link>}
        {err && <span className="mt-1 block text-xs text-crimson" role="alert">{err}</span>}
      </span>
    </div>
  );
}
