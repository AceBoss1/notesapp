"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { reviewTitle } from "@/lib/site-review";
import { FIX_HREF, siteNana, type ReadView, type ReviewView } from "./api";

// Review my site (docs/SITE_NANA.md): the free checklist, and Nana's optional read with her rewrites and the last 30 days' numbers.
export default function SiteReview({ user }: { user: User }) {
  const [tab, setTab] = useState<"list" | "nana">("list");
  const [r, setR] = useState<ReviewView | null>(null);
  const [read, setRead] = useState<ReadView | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [used, setUsed] = useState<Record<string, "used" | "no">>({});

  const load = () => siteNana<ReviewView>(user, undefined, "?review=1").then(setR).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function askNana() {
    setBusy("read"); setErr("");
    try { const x = await siteNana<ReadView>(user, { action: "read" }); setRead(x); setUsed({}); if (x.notice) setErr(x.notice); }
    catch (e) { setErr(e instanceof Error ? e.message : "Nana couldn't read your site just now."); }
    finally { setBusy(""); }
  }
  async function use(field: "headline" | "subline", text: string) {
    setBusy(field); setErr("");
    try { await siteNana(user, { action: "rewrite", field, text }); setUsed((u) => ({ ...u, [field]: "used" })); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save that."); }
    finally { setBusy(""); }
  }

  if (!r) return <p className="py-16 text-center text-slate" role="status">{err || "Checking your site…"}</p>;
  const dot = { high: "bg-[#E0123E]", mid: "bg-[#D98A1E]", low: "bg-[#8a7f79]" };
  const max = read ? Math.max(1, read.funnel.visits) : 1;
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex rounded-full bg-field p-1 text-sm font-bold" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "list"} onClick={() => setTab("list")} className={`flex-1 rounded-full py-1.5 ${tab === "list" ? "bg-card text-crimson shadow" : "text-slate"}`}>Checklist</button>
        <button type="button" role="tab" aria-selected={tab === "nana"} onClick={() => setTab("nana")} className={`flex-1 rounded-full py-1.5 ${tab === "nana" ? "bg-card text-crimson shadow" : "text-slate"}`}>Nana&apos;s read</button>
      </div>

      {tab === "list" ? (
        <>
          <h2 className="mt-5 font-display text-2xl text-ink">{reviewTitle(r.findings.length)}</h2>
          <p className="mt-1 text-sm text-slate">{r.findings.length ? "Most important first. Checked just now against your live site." : "Your site has a banner, a button that works, prices and a way to reach you."}</p>
          <ol className="mt-4 flex flex-col gap-3">
            {r.findings.map((f, i) => (
              <li key={f.id} className="flex gap-3 rounded-2xl border border-rule bg-card p-4 text-sm">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white ${dot[f.weight]}`} aria-label={`${f.weight === "high" ? "Most important" : f.weight === "mid" ? "Important" : "Worth doing"}: ${i + 1}`}>{i + 1}</span>
                <span>
                  <b className="block text-ink">{f.title}</b>
                  <span className="text-slate">{f.why}</span>
                  <span className="mt-1 block font-semibold">
                    <Link href={FIX_HREF[f.fix.at]} className="text-crimson">{f.fix.label} →</Link>
                    {f.nana && <> · <Link href="/profile/site/nana" className="text-crimson">Ask Nana to draft it</Link></>}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          {r.fine.length > 0 && <p className="mt-4 rounded-2xl border border-[#b9e2d1] bg-[#e9f7f1] px-4 py-3 text-sm text-[#17694a]">✓ {r.fine.length} thing{r.fine.length === 1 ? " is" : "s are"} fine: {r.fine.join(", ")}.</p>}
          <p className="mt-4 text-center text-xs text-slate">The checklist is free and uses no Nana. <a href={`/s/${r.username}`} target="_blank" rel="noopener noreferrer" className="underline">View your site</a></p>
        </>
      ) : (
        <>
          {!read ? (
            <div className="mt-5 text-center">
              <p className="text-sm text-slate">Nana reads the words on your site, what the checklist found and your last 30 days of visits, then suggests better lines for your banner and a few tips. Nothing changes unless you say so.</p>
              <button type="button" onClick={askNana} disabled={!!busy} className="btn-primary mt-4 !px-5 !py-2.5 text-sm">{busy === "read" ? "Nana is reading…" : "Ask Nana to read my site"}</button>
              <p className="mt-3 text-xs text-slate">Uses your Nana allowance. She reads only what is public on your site, and your visit numbers.</p>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-3">
              <div className="rounded-2xl border border-rule bg-card p-4 text-sm">
                <p className="font-ui font-bold text-ink">Last {read.funnel.days} days</p>
                {[[read.funnel.visits, "visits"], [read.funnel.shopViews, "looks at your shop items"], [read.funnel.orders + read.funnel.bookings, "orders and bookings"]].map(([n, label]) => (
                  <div key={label as string} className="mt-1.5 flex items-center gap-2"><i className="block h-3.5 rounded bg-crimson/85" style={{ width: `${Math.max(2, ((n as number) / max) * 60)}%` }} /><span>{n} {label}</span></div>
                ))}
                {read.funnel.pages ? <p className="mt-2 text-xs text-slate">Most visited: {read.funnel.pages.map((p) => `${p.label} (${p.visits})`).join(", ") || "nothing yet"}.</p>
                  : <p className="mt-2 text-xs text-slate">Visits by page come with Business.</p>}
              </div>
              {read.read.rewrites.map((w) => (
                <div key={w.field} className="flex flex-col gap-1.5">
                  <p className="rounded-2xl border border-[#f0cbd6] bg-gradient-to-br from-card to-[#fbeff3] px-4 py-3 text-sm"><b className="text-crimson">Nana:</b> {w.why || `A clearer ${w.field === "headline" ? "headline" : "line under it"}.`}</p>
                  {w.was && <p className="rounded-lg border border-[#f3c6cf] bg-[#fff1f3] px-3 py-1.5 text-sm text-[#6b2a37] line-through">{w.was}</p>}
                  <p className="rounded-lg border border-[#b9e2d1] bg-[#e9f7f1] px-3 py-1.5 text-sm font-semibold text-[#17694a]">{w.now}</p>
                  {used[w.field] ? <p className="text-xs text-slate">{used[w.field] === "used" ? "✓ On your site now." : "Left as it was."}</p> : (
                    <div className="flex gap-2 text-xs font-semibold">
                      <button type="button" disabled={!!busy} onClick={() => use(w.field, w.now)} className="rounded-full bg-[#0F8B8D] px-3 py-1 text-white">{busy === w.field ? "Saving…" : "Use this"}</button>
                      <button type="button" disabled={!!busy} onClick={askNana} className="rounded-full border border-rule px-3 py-1">Another</button>
                      <button type="button" onClick={() => setUsed((u) => ({ ...u, [w.field]: "no" }))} className="rounded-full border border-rule px-3 py-1">No thanks</button>
                    </div>
                  )}
                </div>
              ))}
              {read.read.tips.map((tip, i) => <p key={i} className="rounded-2xl border border-[#f0cbd6] bg-gradient-to-br from-card to-[#fbeff3] px-4 py-3 text-sm"><b className="text-crimson">Nana:</b> {tip}</p>)}
              {!read.read.rewrites.length && !read.read.tips.length && <p className="text-sm text-slate">Nana has nothing to add to the checklist this time.</p>}
            </div>
          )}
        </>
      )}
      {err && <p className="mt-3 rounded-xl bg-[#FFF4D6] px-4 py-3 text-sm text-[#5a4300]" role="alert">{err}</p>}
    </section>
  );
}
