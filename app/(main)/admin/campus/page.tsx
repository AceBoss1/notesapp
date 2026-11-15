"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CampusPage, Stat, ago, card, placeOf, useCampus, useCampusView } from "@/components/campus/CampusKit";
import SelectBox from "@/components/ui/SelectBox";
import { CAMPUS_COUNTRIES } from "@/lib/campus";
import { referralLink } from "@/lib/referrals";
import type { AmbassadorStats } from "@/lib/campus-server";
import type { CampusMember } from "@/lib/campus";

// Admin → Campus → Overview (lib/campus.ts). A coordinator: her team, who's bringing sign-ups this month and who's behind on tasks. A lead:
// a country, or one coordinator's team. An ambassador ("My campus"): her own numbers and her referral link.
type Overview = { month: string; today: string; totals: { ambassadors: number; signupsMonth: number; signupsAll: number; done: number; open: number; overdue: number; tasks: number }; ambassadors: AmbassadorStats[] };

export default function CampusOverviewPage() {
  const { me, ready, denied } = useCampus();
  const [country, setCountry] = useState<string>("NG");
  const [coord, setCoord] = useState("");
  const lead = !!me?.lead;
  const ambassador = me?.member?.role === "ambassador" && !lead;
  const { data, error } = useCampusView<Overview>("overview", { country: lead ? country : undefined, coordinator: lead ? coord : undefined }, ready);
  const team = useCampusView<{ team: CampusMember[] }>("team", { country }, ready && lead);
  const coordinators = (team.data?.team ?? []).filter((m) => m.role === "coordinator");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const month = data ? new Date(`${data.month}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long" }) : "this month";

  if (ambassador && me?.member) {
    const s = data?.ambassadors[0];
    const link = origin ? referralLink(origin, me.member.username) : "";
    return (
      <CampusPage title="My campus" me={me} denied={denied}
        intro={<>You&apos;re a #NotesApp campus ambassador at <b className="text-ink">{placeOf(me.member)}</b>{me.coordinator ? <> with <b className="text-ink">{me.coordinator.name}</b> as your coordinator</> : null}.</>}>
        {error && <p className="mb-4 font-ui text-sm text-crimson" role="alert">{error}</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={`Sign-ups in ${month}`} value={s?.signupsMonth ?? "…"} note="With your link or code" />
          <Stat label="Sign-ups, all time" value={s?.signupsAll ?? "…"} />
          <Stat label="Tasks done" value={s?.done ?? "…"} tone="good" />
          <Stat label="Tasks open" value={s ? s.open : "…"} note={s?.overdue ? `${s.overdue} overdue` : undefined} tone={s?.overdue ? "bad" : undefined} />
        </div>
        <div className={`${card} mt-4`}>
          <h2 className="font-ui text-base font-semibold text-ink">Your link and code</h2>
          <p className="mt-2 font-ui text-sm text-slate">Everyone who joins with your link, or types your code <b className="text-ink">{me.member.username}</b> at checkout, counts as your sign-up. You also earn from the plans they pay for, as in the <Link href="/profile/referrals" className="text-crimson underline">referral programme</Link>.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-[10px] bg-paper px-3 py-2.5 font-mono text-[13px] text-ink">{link || "…"}</code>
            <button type="button" onClick={() => void navigator.clipboard?.writeText(link)} className="rounded-full border border-rule bg-card px-4 py-2 font-ui text-sm font-semibold text-ink hover:border-crimson">Copy</button>
          </div>
        </div>
        {s && (
          <Link href="/admin/campus/leaderboard" className="mt-4 flex items-center gap-4 rounded-[14px] bg-gradient-to-br from-crimson-deep via-crimson to-crimson-bright p-5 text-white shadow-lg">
            <span aria-hidden className="text-4xl">{s.level.emoji}</span>
            <span className="min-w-0 flex-1 font-ui"><b className="block font-display text-2xl font-medium">{s.level.name}</b><span className="text-sm opacity-90">{s.pointsMonth} points in {month} · {s.pointsAll} in all</span></span>
            <span className="shrink-0 font-ui text-sm font-semibold">Leaderboard →</span>
          </Link>
        )}
        <Link href="/admin/campus/tasks" className="mt-4 inline-block font-ui text-sm font-semibold text-crimson">Your tasks →</Link>
      </CampusPage>
    );
  }

  return (
    <CampusPage title="Campus" me={me} denied={denied}
      intro={lead ? "Every campus team in a country: how many members each ambassador brought this month and in all, and how their tasks are going." : "Your ambassadors: how many members each brought this month and in all, how their tasks are going, and when they last checked in."}>
      {lead && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <SelectBox label="Country" value={country} onChange={(c) => { setCountry(c); setCoord(""); }} options={CAMPUS_COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` }))} />
          <SelectBox label="Team" value={coord} onChange={setCoord} options={[{ value: "", label: "Every coordinator" }, ...coordinators.map((c) => ({ value: c.uid, label: `${c.name} (@${c.username})` }))]} />
        </div>
      )}
      {error && <p className="mb-4 font-ui text-sm text-crimson" role="alert">{error}</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ambassadors" value={data?.totals.ambassadors ?? "…"} />
        <Stat label={`Sign-ups in ${month}`} value={data?.totals.signupsMonth ?? "…"} note={data ? `${data.totals.signupsAll} in all` : undefined} />
        <Stat label="Tasks done" value={data?.totals.done ?? "…"} tone="good" />
        <Stat label="Tasks overdue" value={data?.totals.overdue ?? "…"} tone={data?.totals.overdue ? "bad" : undefined} note={data ? `${data.totals.open} still open` : undefined} />
      </div>

      <section className={`${card} mt-4 overflow-hidden p-0`} aria-labelledby="board">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
          <h2 id="board" className="font-ui text-base font-semibold text-ink">Ambassadors, most sign-ups in {month} first</h2>
          {!lead && <Link href="/admin/campus/ambassadors" className="font-ui text-sm font-semibold text-crimson">Add ambassadors →</Link>}
        </div>
        {!data ? <p className="px-5 pb-5 font-ui text-sm text-slate">Loading…</p> : data.ambassadors.length === 0 ? (
          <p className="px-5 pb-5 font-ui text-sm text-slate">No ambassadors yet.{!lead && <> <Link href="/admin/campus/ambassadors" className="text-crimson underline">Add your first</Link>.</>}</p>
        ) : (
          <>
            {/* Phones: one card each; wider screens: the table. */}
            <ul className="divide-y divide-rule border-t border-rule md:hidden">
              {data.ambassadors.map((a, i) => (
                <li key={a.uid} className="p-4 font-ui text-sm">
                  <div className="flex items-baseline justify-between gap-3"><b className="truncate text-ink">{i + 1}. {a.name}</b><span className="shrink-0 font-semibold text-ink">{a.signupsMonth} <span className="font-normal text-slate">this month</span></span></div>
                  <p className="mt-0.5 truncate text-xs text-slate">{placeOf(a)} · checked in {ago(a.lastCheckIn)}</p>
                  <p className="mt-1 text-xs text-slate"><span aria-hidden>{a.level.emoji}</span> {a.level.name} · {a.pointsMonth} pts · {a.signupsAll} in all · {a.done} done · {a.open} open{a.overdue ? <b className="text-red-700"> · {a.overdue} overdue</b> : null}</p>
                </li>
              ))}
            </ul>
            <table className="hidden w-full border-t border-rule font-ui text-sm md:table">
              <thead className="bg-field text-left text-[13px] text-slate">
                <tr><th className="px-4 py-2.5 font-semibold">#</th><th className="px-4 py-2.5 font-semibold">Ambassador</th><th className="px-4 py-2.5 font-semibold">Campus</th><th className="px-4 py-2.5 text-right font-semibold">{month}</th><th className="px-4 py-2.5 text-right font-semibold">All time</th><th className="px-4 py-2.5 font-semibold">Tasks</th><th className="px-4 py-2.5 font-semibold">Checked in</th></tr>
              </thead>
              <tbody className="divide-y divide-rule text-ink">
                {data.ambassadors.map((a, i) => (
                  <tr key={a.uid}>
                    <td className="px-4 py-3 text-slate">{i + 1}</td>
                    <td className="px-4 py-3"><Link href={`/u/${a.username}`} className="font-semibold hover:text-crimson">{a.name}</Link><span className="block text-xs text-slate">@{a.username} · <span aria-hidden>{a.level.emoji}</span> {a.level.name} · {a.pointsMonth} pts</span></td>
                    <td className="px-4 py-3 text-slate">{placeOf(a)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{a.signupsMonth}</td>
                    <td className="px-4 py-3 text-right">{a.signupsAll}</td>
                    <td className="px-4 py-3 text-[13px]">{a.done} done · {a.open} open{a.overdue ? <b className="text-red-700"> · {a.overdue} overdue</b> : null}{a.redo ? <span className="text-amber-700"> · {a.redo} to redo</span> : null}</td>
                    <td className={`px-4 py-3 text-[13px] ${!a.lastCheckIn || Date.now() - Date.parse(a.lastCheckIn) > 7 * 86_400_000 ? "text-red-700" : "text-slate"}`}>{ago(a.lastCheckIn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
      <p className="mt-3 font-ui text-xs text-slate">Sign-ups are new members who joined with the ambassador&apos;s link or code, counted by the country&apos;s own day. &ldquo;Checked in&rdquo; is the last time they opened Campus or reported on a task, not when they were last online.</p>
    </CampusPage>
  );
}
