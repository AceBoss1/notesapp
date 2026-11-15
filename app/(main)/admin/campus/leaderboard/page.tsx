"use client";

import { useState } from "react";
import { CampusPage, card, useCampus, useCampusView } from "@/components/campus/CampusKit";
import SelectBox from "@/components/ui/SelectBox";
import { CAMPUS_COUNTRIES, countryName, type Level } from "@/lib/campus";
import type { BoardRow } from "@/lib/campus-server";

// Admin → Campus → Leaderboard (lib/campus.ts POINTS and LEVELS; owner, 15 Nov 2026: "make the gamified leaderboard available for
// ambassadors"). Every ambassador sees it: their team or the whole country, this month or all time, ranked by points, with medals for the
// top three and each one's level; their own place is highlighted (and shown under the list when they're further down).
type Board = {
  scope: "team" | "country"; period: "month" | "all"; country: string; month: string; total: number; rows: BoardRow[];
  rules: { points: { signup: number; approved: number; onTime: number }; levels: readonly Level[] };
  standing: { rank: number | null; of: number; points: number; pointsAll: number; level: Level; next: Level | null; toNext: number } | null;
};

export default function CampusLeaderboardPage() {
  const { me, ready, denied } = useCampus();
  const lead = !!me?.lead;
  // Ambassadors and coordinators start on their team; leads on the country.
  const [picked, setScope] = useState<"team" | "country" | null>(null);
  const scope = picked ?? (me?.member ? "team" : "country");
  const [period, setPeriod] = useState<"month" | "all">("month");
  const [country, setCountry] = useState("NG");
  const { data, error } = useCampusView<Board>("leaderboard", { scope, period, country: lead ? country : undefined }, ready);
  const month = data ? new Date(`${data.month}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long" }) : "this month";
  const s = data?.standing;
  const pill = (on: boolean) => `rounded-full px-4 py-1.5 font-ui text-[13px] ${on ? "bg-crimson font-semibold text-paper" : "text-slate hover:text-ink"}`;

  return (
    <CampusPage title="Leaderboard" me={me} denied={denied}
      intro="Points for every member who joins with your link or code, every task your coordinator approves, and a bonus for finishing on time. The board starts again each month; your level comes from all your points and never goes down.">
      {error && <p className="mb-4 font-ui text-sm text-crimson" role="alert">{error}</p>}

      {s && (
        <section className="mb-5 overflow-hidden rounded-[14px] bg-gradient-to-br from-crimson-deep via-crimson to-crimson-bright p-5 text-white shadow-lg" aria-label="Your standing">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] opacity-80">Your level</p>
          <p className="mt-1 font-display text-3xl font-medium"><span aria-hidden>{s.level.emoji}</span> {s.level.name}</p>
          <div className="mt-3 grid grid-cols-3 gap-3 font-ui">
            <div><b className="block text-2xl">{s.rank ? `#${s.rank}` : "–"}</b><span className="text-xs opacity-80">of {s.of} · {data?.scope === "team" ? "your team" : countryName(data?.country ?? "")}</span></div>
            <div><b className="block text-2xl">{s.points}</b><span className="text-xs opacity-80">points {period === "month" ? `in ${month}` : "in all"}</span></div>
            <div><b className="block text-2xl">{s.pointsAll}</b><span className="text-xs opacity-80">points in all</span></div>
          </div>
          {s.next ? (
            <>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20" aria-hidden>
                <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, Math.round(((s.pointsAll - s.level.min) / (s.next.min - s.level.min)) * 100))}%` }} />
              </div>
              <p className="mt-2 font-ui text-xs opacity-90">{s.toNext} points to {s.next.emoji} {s.next.name}</p>
            </>
          ) : <p className="mt-3 font-ui text-xs opacity-90">The top level. Legendary.</p>}
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex rounded-full border border-rule bg-card p-[3px]" role="group" aria-label="Who">
          {(!lead || me?.member) && <button type="button" onClick={() => setScope("team")} aria-pressed={scope === "team"} className={pill(scope === "team")}>{me?.member?.role === "coordinator" ? "My team" : "Our team"}</button>}
          <button type="button" onClick={() => setScope("country")} aria-pressed={scope === "country"} className={pill(scope === "country")}>{lead ? "Country" : countryName(me?.member?.country ?? "NG")}</button>
        </div>
        <div className="flex rounded-full border border-rule bg-card p-[3px]" role="group" aria-label="When">
          <button type="button" onClick={() => setPeriod("month")} aria-pressed={period === "month"} className={pill(period === "month")}>{month}</button>
          <button type="button" onClick={() => setPeriod("all")} aria-pressed={period === "all"} className={pill(period === "all")}>All time</button>
        </div>
        {lead && <div className="w-48"><SelectBox label="Country" hideLabel value={country} onChange={setCountry} options={CAMPUS_COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` }))} /></div>}
      </div>

      <section className={`${card} p-0`} aria-label="Leaderboard">
        {!data ? <p className="p-5 font-ui text-sm text-slate">Loading…</p> : data.rows.length === 0 ? <p className="p-5 font-ui text-sm text-slate">No ambassadors here yet.</p> : (
          <ol className="divide-y divide-rule">
            {data.rows.map((r, i) => {
              const gap = i > 0 && r.rank > data.rows[i - 1].rank + 1 && r.me && i === data.rows.length - 1;
              return (
                <li key={`${r.rank}-${r.name}-${i}`} className={`${gap ? "border-t-4 border-dashed border-rule" : ""}`}>
                  <div className={`flex items-center gap-3 px-4 py-3 font-ui sm:px-5 ${r.me ? "bg-crimson-bright/10" : ""}`} aria-current={r.me ? "true" : undefined}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${r.medal ? "text-xl" : "bg-field text-slate"}`}>{r.medal ?? r.rank}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[15px] text-ink">{r.name}{r.me && <span className="ml-1.5 rounded-full bg-crimson-bright px-2 py-0.5 text-[10px] font-bold uppercase text-white">You</span>}</b>
                      <span className="block truncate text-xs text-slate"><span aria-hidden>{r.level.emoji}</span> {r.level.name} · {r.campus}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <b className="block font-display text-xl text-ink">{r.points}</b>
                      <span className="text-[11px] text-slate">{r.signups} sign-up{r.signups === 1 ? "" : "s"} · {r.approved} task{r.approved === 1 ? "" : "s"}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      {data && data.total > 50 && <p className="mt-2 font-ui text-xs text-slate">Showing the top 50 of {data.total}.</p>}

      {data && (
        <section className={`${card} mt-5`} aria-labelledby="how">
          <h2 id="how" className="font-ui text-base font-semibold text-ink">How points work</h2>
          <ul className="mt-2 space-y-1 font-ui text-sm text-slate">
            <li><b className="text-ink">+{data.rules.points.signup}</b> for every member who joins with your link or code</li>
            <li><b className="text-ink">+{data.rules.points.approved}</b> for every task your coordinator approves</li>
            <li><b className="text-ink">+{data.rules.points.onTime}</b> more when you finished it by its due date</li>
          </ul>
          <p className="mt-3 font-ui text-sm text-slate">Levels: {data.rules.levels.map((l) => `${l.emoji} ${l.name} (${l.min}+)`).join(" · ")}</p>
          <p className="mt-2 font-ui text-xs text-slate">Ambassadors see each other by first name and initial with their campus. Months run in {countryName(data.country)}&apos;s own time.</p>
        </section>
      )}
    </CampusPage>
  );
}
