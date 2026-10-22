"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROOT_DOMAIN } from "@/lib/host";
import { COMMUNITY_FREE_MEMBERS, cleanSlug } from "@/lib/community";
import { COMMUNITY_FEATURES } from "@/lib/community-features";
import { capi, field } from "@/components/community/api";

type Run = { id: string; name: string; avatar: string; memberCount: number; role: string };

// On "Your site", under the kits, for sites on a kit that opens Community (lib/site-kits.ts COMMUNITY_KITS: Churches and NGOs; owner,
// 22 Oct 2026). Start the organisation's community right here (name, address and line filled in from the profile and the site's banner),
// or link one they already run; a linked community opens inside the site at /community (on their own domain too), with a link in the
// site's menu (/api/site/community).
export default function CommunityPanel({ linked, name, username, tagline, onLinked }: {
  linked: string; name: string; username: string; tagline: string; onLinked: (cid: string) => Promise<void>;
}) {
  const [run, setRun] = useState<Run[] | null>(null);
  const [form, setForm] = useState({ name, slug: cleanSlug(username) || cleanSlug(name), tagline });
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { capi<{ communities: Run[] }>("/api/community?run=1").then((d) => setRun(d.communities)).catch(() => setRun([])); }, [linked]);
  const current = run?.find((c) => c.id === linked);

  async function link(cid: string) {
    setBusy(cid || "unlink"); setErr(""); setMsg("");
    try { await onLinked(cid); setMsg(cid ? "Linked: it now opens inside your site, at /community, with a link in your menu." : "Unlinked: the Community page is off your site."); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't do that."); }
    finally { setBusy(""); }
  }
  async function start() {
    setBusy("start"); setErr(""); setMsg("");
    try {
      const r = await capi<{ community: { id: string; name: string } }>("/api/community", { action: "create", name: form.name, id: form.slug || form.name, tagline: form.tagline });
      await onLinked(r.community.id);
      setRun((x) => [...(x ?? []), { id: r.community.id, name: r.community.name, avatar: "", memberCount: 1, role: "owner" }]);
      setStarting(false);
      setMsg(`${r.community.name} is live and linked to your site.`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't start the community."); }
    finally { setBusy(""); }
  }

  return (
    <section id="community-panel" className="card mt-6 scroll-mt-24 border-2 border-crimson/30 p-6" aria-labelledby="community-h">
      <p className="eyebrow">Your kit comes with Community</p>
      <h2 id="community-h" className="mt-1 font-display text-xl text-ink">Bring your members together</h2>
      <p className="mt-1 text-sm text-slate">
        A home for your members on #NotesApp, run by your own admins:{" "}
        {COMMUNITY_FEATURES.map((f, i) => <span key={f.slug}>{i ? (i === COMMUNITY_FEATURES.length - 1 ? " and " : ", ") : ""}<Link href={`/community/${f.slug}`} className="text-crimson underline" target="_blank">{f.name}</Link></span>)}
        . Link it here and it opens inside your site (on your own domain too), with a Community link in your menu.
      </p>

      {run === null ? <p className="mt-4 text-sm text-slate">Loading…</p> : current ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-paper p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-ui text-sm font-bold text-ink">✓ {current.name}</p>
            <p className="text-xs text-slate">{ROOT_DOMAIN}/c/{current.id} · {current.memberCount.toLocaleString()} {current.memberCount === 1 ? "member" : "members"} · on your site at /community</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link href={`/c/${current.id}`} className="btn-primary !px-4 !py-2 text-xs">Open it</Link>
            <Link href={`/c/${current.id}?tab=admin`} className="rounded-full border border-rule px-4 py-2 font-ui text-xs font-semibold text-ink hover:border-crimson">Admin</Link>
            <button type="button" disabled={!!busy} onClick={() => link("")} className="text-xs font-semibold text-slate underline hover:text-crimson">{busy === "unlink" ? "Unlinking…" : "Unlink"}</button>
          </div>
        </div>
      ) : (
        <>
          {run.length > 0 && (
            <div className="mt-4">
              <p className="font-ui text-sm font-bold text-ink">Link a community you run</p>
              <ul className="mt-2 space-y-2">
                {run.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-rule p-3">
                    <span className="min-w-0"><span className="block truncate font-ui text-sm font-semibold text-ink">{c.name}</span><span className="text-xs text-slate">{ROOT_DOMAIN}/c/{c.id} · {c.role === "owner" ? "you own it" : "you're an admin"}</span></span>
                    <button type="button" disabled={!!busy} onClick={() => link(c.id)} className="btn-primary shrink-0 !px-4 !py-2 text-xs">{busy === c.id ? "Linking…" : "Link to my site"}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {run.length > 0 && !starting ? (
            <button type="button" onClick={() => setStarting(true)} className="mt-3 text-sm font-semibold text-crimson underline">Or start a new one</button>
          ) : (
            <div className="mt-4 rounded-2xl bg-paper p-4">
              <p className="font-ui text-sm font-bold text-ink">Start your community</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block min-w-0 text-xs text-slate">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} className={`${field} mt-1 w-full`} /></label>
                <label className="block min-w-0 text-xs text-slate">Address
                  <span className="mt-1 flex items-center rounded-xl border border-rule bg-card pl-3 text-sm text-slate focus-within:border-crimson">
                    {ROOT_DOMAIN}/c/<input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} maxLength={40} className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-ink focus:outline-none" aria-label="Address" />
                  </span>
                </label>
                <label className="block min-w-0 text-xs text-slate sm:col-span-2">A line about it<input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} maxLength={120} placeholder="Sundays 8am & 10:30am · Lekki Phase 1" className={`${field} mt-1 w-full`} /></label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" disabled={!!busy || form.name.trim().length < 3} onClick={start} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">{busy === "start" ? "Starting…" : "Start and link it"}</button>
                <p className="text-xs text-slate">{`Free up to ${COMMUNITY_FREE_MEMBERS} members; on Business, no limit and private Circles.`} You can change the name, picture and who can join after.</p>
              </div>
            </div>
          )}
        </>
      )}
      {msg && <p className="mt-3 text-sm text-ink" role="status">{msg} {current && <Link href={`/c/${current.id}?tab=admin`} className="font-semibold text-crimson">Set it up →</Link>}</p>}
      {err && <p className="mt-3 text-sm text-crimson" role="alert">{err}</p>}
    </section>
  );
}
