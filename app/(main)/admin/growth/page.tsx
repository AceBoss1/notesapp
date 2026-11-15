"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import {
  ANY_VALUE_TEXT, CHANNEL_ICON, CHANNEL_LABEL, RANGES, VALUE_TEXT, type Channel, type Funnel, type GrowthReport, type RangeDays,
} from "@/lib/growth";

type Tab = "overview" | "funnel" | "back" | "creators";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Every channel" },
  { key: "funnel", label: "Funnel" },
  { key: "back", label: "Comes back?" },
  { key: "creators", label: "Creator links" },
];
const p = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n}%`);
const n = (v: number) => v.toLocaleString("en-NG");
const weekLabel = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); return `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`; };

function Tile({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="card p-4">
      <p className="font-display text-3xl text-ink">{value}</p>
      <p className="mt-1 text-sm text-slate">{label}</p>
      {note && <p className="mt-1 text-xs text-slate">{note}</p>}
    </div>
  );
}

function FunnelView({ f, channel, days }: { f: Funnel; channel: Channel | "all"; days: number }) {
  const top = Math.max(1, ...f.steps.map((s) => s.count));
  const what = channel !== "all" && VALUE_TEXT[channel] ? VALUE_TEXT[channel] : ANY_VALUE_TEXT;
  return (
    <div>
      <h3 className="font-ui text-base font-bold text-ink">Funnel, last {days} days</h3>
      <ul className="mt-3 space-y-2">
        {f.steps.map((s) => (
          <li key={s.key} className="grid grid-cols-[7.5rem_1fr] items-center gap-3 text-sm">
            <span className="text-ink">{s.label}</span>
            <span className="flex items-center gap-2">
              <span className="h-4 rounded bg-crimson/80" style={{ width: `${Math.max(2, Math.round((s.count / top) * 100))}%` }} aria-hidden="true" />
              <span className="tabular-nums text-ink">{n(s.count)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-ink">
        &ldquo;First value&rdquo;{channel !== "all" ? ` for ${CHANNEL_LABEL[channel]}` : ""} = {what}. Each channel has its own, so a job-seeker and a student are each judged on what they came for.
      </p>
      <h3 className="mt-5 font-ui text-base font-bold text-ink">Where they drop</h3>
      <div className="card mt-2 p-4 text-sm text-ink">
        {f.drop ? <p>{f.drop.from} → {f.drop.to}: <b>{f.drop.pct}% leave</b> here, the most of any step.</p> : <p className="text-slate">Not enough people yet to say.</p>}
        {(f.notYet.week1 > 0 || f.notYet.week4 > 0) && (
          <p className="mt-2 text-xs text-slate">{n(f.notYet.week1)} joined less than two weeks ago and {n(f.notYet.week4)} less than five, so their week 1 and week 4 aren&apos;t final yet.</p>
        )}
      </div>
    </div>
  );
}

// Admin → Growth (docs/GROWTH.md): where members come from, whether they reach first value and whether they come back. Counted at
// most once an hour from the growth records, never per page view. Counts and percentages only.
export default function AdminGrowthPage() {
  const { user, loading } = useAdminAuth();
  const [data, setData] = useState<{ report: GrowthReport; asOf: string } | null>(null);
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState(0);
  const [days, setDays] = useState<RangeDays>(30);
  const [tab, setTab] = useState<Tab>("overview");
  const [channel, setChannel] = useState<Channel | "all">("all");

  useEffect(() => {
    if (!user) return;
    if (fresh) setData(null);
    setError("");
    user.getIdToken().then((t) => fetch(`/api/admin/growth${fresh ? "?fresh=1" : ""}`, { headers: { Authorization: `Bearer ${t}` } }))
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "Couldn't load"); setData(j); })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load"));
  }, [user, fresh]);

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const rep = data?.report;
  const r = rep?.ranges[String(days)];
  const funnel = r ? r.funnels[channel] ?? r.funnels.all : undefined;

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <h1 className="font-display text-4xl text-ink">Growth</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate">
        Where members come from and whether they stay: each member&apos;s first visit is followed through install, sign-up, first value and coming back in
        week 1 and week 4. First-party only: no ad cookies, nothing sold. Counted at most once an hour.
      </p>
      {error && <p className="mt-4 text-sm text-crimson" role="alert">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-2" role="tablist" aria-label="Growth views">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`rounded-full border px-4 py-1.5 font-ui text-sm font-semibold ${tab === t.key ? "border-crimson bg-crimson text-paper" : "border-rule bg-card text-ink hover:border-crimson"}`}>{t.label}</button>
        ))}
      </div>
      {tab !== "back" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {RANGES.map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d}
              className={`rounded-full border px-4 py-1.5 font-ui text-sm font-semibold ${days === d ? "border-crimson bg-crimson text-paper" : "border-rule bg-card text-ink hover:border-crimson"}`}>{d} days</button>
          ))}
        </div>
      )}

      {!rep || !r ? (
        !error && <p className="mt-8 text-sm text-slate">Counting…</p>
      ) : (
        <div className="mt-6">
          {tab === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile value={n(r.signups)} label="new sign-ups" />
                <Tile value={n(r.installs)} label="app installs" />
                <Tile value={p(r.valuePct)} label="reached first value" />
                <Tile value={p(r.week4Pct)} label="back in week 4" note={r.week4Base ? `of ${n(r.week4Base)} who joined ${days} days before their week 4 ended` : "Nobody has had a week 4 yet."} />
              </div>
              <div className="card mt-5 overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-slate"><th className="px-4 py-2 font-semibold">Channel</th><th className="px-3 py-2 text-right font-semibold">Sign-ups</th><th className="px-3 py-2 text-right font-semibold">Value</th><th className="px-4 py-2 text-right font-semibold">Wk 4</th></tr></thead>
                  <tbody>
                    {r.channels.length === 0 && <tr><td colSpan={4} className="border-t border-rule px-4 py-4 text-slate">No visits or sign-ups measured in these {days} days yet.</td></tr>}
                    {r.channels.map((c) => (
                      <tr key={c.channel} className="border-t border-rule">
                        <td className="px-4 py-2"><button type="button" className="text-left text-ink hover:text-crimson" onClick={() => { setChannel(c.channel); setTab("funnel"); }}><span aria-hidden="true">{CHANNEL_ICON[c.channel]} </span>{CHANNEL_LABEL[c.channel]}</button></td>
                        <td className="px-3 py-2 text-right tabular-nums">{n(c.signups)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p(c.valuePct)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{p(c.week4Pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate">Tap a channel to see its funnel. Wk 4 counts members whose week 4 is over.</p>
            </>
          )}

          {tab === "funnel" && funnel && (
            <>
              <label className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate">
                Channel
                <select value={channel} onChange={(e) => setChannel(e.target.value as Channel | "all")} className="rounded-lg border border-rule bg-card px-3 py-1.5 text-sm text-ink">
                  <option value="all">Every channel</option>
                  {r.channels.map((c) => <option key={c.channel} value={c.channel}>{CHANNEL_LABEL[c.channel]}</option>)}
                </select>
              </label>
              <div className="card p-5"><FunnelView f={funnel} channel={r.funnels[channel] ? channel : "all"} days={days} /></div>
            </>
          )}

          {tab === "back" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="card overflow-x-auto p-5">
                <h3 className="font-ui text-base font-bold text-ink">Weekly cohorts: back in week…</h3>
                {rep.cohorts.length === 0 ? <p className="mt-3 text-sm text-slate">No one has joined since measuring began.</p> : (
                  <table className="mt-3 w-full border-separate border-spacing-1 text-center text-xs">
                    <thead><tr className="text-slate"><th className="text-left font-semibold">Joined</th><th className="font-semibold">People</th>{[1, 2, 3, 4].map((w) => <th key={w} className="font-semibold">{w}</th>)}</tr></thead>
                    <tbody>
                      {rep.cohorts.map((c) => (
                        <tr key={c.week}>
                          <td className="whitespace-nowrap text-left text-slate">{weekLabel(c.week)}</td>
                          <td className="tabular-nums text-slate">{n(c.joined)}</td>
                          {c.back.map((v, i) => (
                            <td key={i} className={`rounded-md py-2 font-semibold tabular-nums ${v === null ? "text-slate" : "text-paper"}`}
                              style={v === null ? undefined : { background: `rgba(166, 9, 61, ${0.35 + Math.min(1, v / 70) * 0.65})` }}>{v === null ? "" : `${v}%`}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="mt-2 text-xs text-slate">A week shows once it is over for everyone who joined that week.</p>
              </div>
              <div className="card overflow-x-auto p-5">
                <h3 className="font-ui text-base font-bold text-ink">What brings them back</h3>
                <table className="mt-3 w-full text-sm">
                  <thead><tr className="text-left text-slate"><th className="py-1.5 font-semibold">Return trigger</th><th className="py-1.5 text-right font-semibold">Returns</th></tr></thead>
                  <tbody>
                    {rep.triggers.map((t) => (
                      <tr key={t.trigger} className="border-t border-rule"><td className="py-2">{t.icon && <span aria-hidden="true">{t.icon} </span>}{t.label}</td><td className="py-2 text-right tabular-nums">{t.returns ? `${t.pct}%` : "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-slate">Each day a member comes back in their first five weeks, counted against the bell, email or reminder link they came in through.</p>
              </div>
            </div>
          )}

          {tab === "creators" && (
            <>
              <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-ink">
                Creators already earn referral rewards (milestones). This shows the same people, joined through a creator&apos;s link or code, so we can see which
                creators bring members who stay. Teens and children are never counted here.
              </p>
              <div className="card mt-4 overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-slate"><th className="px-4 py-2 font-semibold">Creator</th><th className="px-3 py-2 text-right font-semibold">Joined</th><th className="px-3 py-2 text-right font-semibold">Installed</th><th className="px-3 py-2 text-right font-semibold">Active</th><th className="px-4 py-2 text-right font-semibold">Wk 4</th></tr></thead>
                  <tbody>
                    {r.creators.length === 0 && <tr><td colSpan={5} className="border-t border-rule px-4 py-4 text-slate">Nobody joined through a creator&apos;s link in these {days} days.</td></tr>}
                    {r.creators.map((c) => (
                      <tr key={c.username} className="border-t border-rule">
                        <td className="px-4 py-2 font-mono text-ink">@{c.username}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{n(c.joined)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{n(c.installed)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{n(c.active)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{p(c.week4Pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate">Joined, installed and active: members who joined in these days; active means seen in the last two weeks. Wk 4: of everyone they brought whose week 4 is over.</p>
            </>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setFresh((x) => x + 1)} className="btn-ghost !px-4 !py-2 text-xs">Count again now</button>
            {data && <span className="text-xs text-slate">Counted {new Date(data.asOf).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
