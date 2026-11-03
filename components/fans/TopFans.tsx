"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { FAN_ACTIONS, KOBO_PER_POINT, VEHICLE_LABEL, firstName, rankBadge, type Vehicle } from "@/lib/fans";
import type { FanBoard } from "@/lib/fans-server";
import { RankChip, TierChip } from "@/components/fans/FanBadges";
import Avatar from "@/components/Avatar";

// A creator's Top fans (mockup approved 3 Nov 2026): the podium, places 4–99, and the viewer's own fan level with how points are earned,
// plus, for a top-three fan, the pick of their live entrance vehicle.
export default function TopFans({ username }: { username: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [b, setB] = useState<FanBoard | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (user === undefined) return;
    (async () => {
      const r = await fetch(`/api/fans/board?username=${encodeURIComponent(username)}`, user ? { headers: { Authorization: `Bearer ${await user.getIdToken()}` } } : {});
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't load the fans.");
      setB(j);
    })().catch((e) => setErr(e.message));
  }, [user, username]);
  async function pick(place: number, vehicle: Vehicle) {
    if (!user) return;
    const r = await fetch("/api/fans/vehicle", { method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ place, vehicle }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setNote(j.error || "Couldn't save that."); return; }
    setNote("Saved: that's how you'll arrive."); setB((x) => (x && x.me ? { ...x, me: { ...x.me, picks: { ...x.me.picks, [String(place)]: vehicle } } } : x));
  }
  if (err) return <p className="mx-auto max-w-3xl px-4 py-16 text-sm text-crimson">{err}</p>;
  if (!b) return <p className="mx-auto max-w-3xl px-4 py-16 text-sm text-slate">Loading…</p>;
  const fn = firstName(b.creator.displayName);
  const pod = [b.rows.find((r) => r.place === 2), b.rows.find((r) => r.place === 1), b.rows.find((r) => r.place === 3)];
  const rest = b.rows.filter((r) => r.place > 3);
  const podBg: Record<number, string> = { 1: "bg-[#FFF4D6]", 2: "bg-[#F1F2F5]", 3: "bg-[#F8E7DA]" };
  return (
    <section className="mx-auto max-w-[1080px] px-4 pb-16 pt-6 sm:px-6">
      <p className="font-ui text-[11px] font-bold uppercase tracking-[0.12em] text-slate"><Link href={`/u/${b.creator.username}`} className="hover:text-crimson">{b.creator.displayName}</Link> · Fans</p>
      <h1 className="mb-4 mt-1 font-display text-4xl text-ink">Top fans</h1>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="min-w-0 rounded-2xl border border-rule bg-card">
          {b.hidden ? <p className="p-6 text-sm text-slate">{fn} keeps their Top fans list private. Fan badges still show next to names in {fn}&apos;s space.</p>
            : !b.rows.length ? <p className="p-6 text-sm text-slate">No fans on the list yet. Subscribing, gifts, comments, reactions and shares all count.</p>
            : <>
              <div className="grid grid-cols-3 items-end gap-2 p-3 sm:gap-3 sm:p-4">
                {pod.map((r, i) => r ? (
                  <Link key={r.uid} href={`/u/${r.username}`} className={`min-w-0 rounded-2xl px-1.5 py-3 text-center ${podBg[r.place]} ${i === 1 ? "pt-5" : ""}`}>
                    <span className="mx-auto block w-fit"><Avatar src={r.avatar} alt={r.displayName} size={i === 1 ? 56 : 42} /></span>
                    <b className="mt-1 block truncate font-ui text-sm text-ink">{r.displayName}</b>
                    <span className="mt-1 flex flex-col items-center gap-1 [&>span]:whitespace-normal [&>span]:text-center"><RankChip rank={r.badge} />{r.tier && <TierChip tier={r.tier} />}</span>
                  </Link>
                ) : <span key={i} />)}
              </div>
              {rest.map((r) => (
                <Link key={r.uid} href={`/u/${r.username}`} className="flex items-center gap-3 border-t border-rule px-4 py-2.5 hover:bg-paper">
                  <span className="w-7 text-center font-ui font-extrabold text-slate">{r.place}</span>
                  <Avatar src={r.avatar} alt={r.displayName} size={36} />
                  <span className="min-w-0 flex-1"><b className="block truncate font-ui text-sm text-ink">{r.displayName}</b><span className="flex flex-wrap gap-1"><RankChip rank={r.badge} />{r.tier && <TierChip tier={r.tier} />}</span></span>
                  <span className="font-ui font-extrabold text-crimson">{r.points.toLocaleString("en-NG")}</span>
                </Link>
              ))}
            </>}
        </div>
        <div className="space-y-3">
          {b.me && (
            <div className="rounded-2xl border border-rule bg-card p-4">
              <b className="font-ui text-ink">Your fan level with {fn}</b>
              <p className="mt-1 text-sm text-slate">{b.me.place ? `#${b.me.place} of ${b.me.fans.toLocaleString("en-NG")} fans` : "Not on the list yet"} · {b.me.points.toLocaleString("en-NG")} points</p>
              {b.me.place && rankBadge(b.me.place, fn) && <div className="mt-2"><RankChip rank={rankBadge(b.me.place, fn)!} /></div>}
              {b.me.next && <p className="mt-2 text-xs text-slate">{b.me.next.needed.toLocaleString("en-NG")} more point{b.me.next.needed === 1 ? "" : "s"} to reach {b.me.next.place === 1 ? "#1" : `the top ${b.me.next.place}`}.</p>}
              {b.me.vehicles && b.me.place && (
                <div className="mt-3 rounded-xl bg-paper p-3">
                  <p className="text-sm font-semibold text-ink">Your entrance in {fn}&apos;s lives</p>
                  <div className="mt-2 flex gap-2">{b.me.vehicles.map((v) => {
                    const on = (b.me!.picks[String(b.me!.place)] ?? b.me!.vehicles![0]) === v;
                    return <button key={v} type="button" onClick={() => pick(b.me!.place!, v)} aria-pressed={on} className={`flex-1 rounded-xl border px-2 py-2 text-sm ${on ? "border-crimson bg-card font-bold" : "border-rule"}`}><span className="block text-2xl">{VEHICLE_LABEL[v].emoji}</span>{VEHICLE_LABEL[v].arrive.replace(/^\w+ (in|up)/, (m) => m)}</button>;
                  })}</div>
                  {note && <p className="mt-2 text-xs text-slate" role="status">{note}</p>}
                </div>
              )}
              <table className="mt-3 w-full text-xs">
                <tbody>
                  <tr><td className="py-1">Subscribed (Premium, VIP or VVIP)</td><td className="text-right font-bold">1 point per ₦{(KOBO_PER_POINT / 100).toLocaleString("en-NG")} paid</td></tr>
                  <tr><td className="py-1">Gifts</td><td className="text-right font-bold">1 point per ₦{(KOBO_PER_POINT / 100).toLocaleString("en-NG")}</td></tr>
                  {Object.values(FAN_ACTIONS).map((a) => <tr key={a.label}><td className="py-1">{a.label}</td><td className="text-right"><b>{a.points}</b> ({a.perDay} a day)</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
          {!user && <p className="rounded-2xl border border-rule bg-card p-4 text-sm text-slate"><Link href={`/login?next=/u/${b.creator.username}/fans`} className="font-semibold text-crimson">Sign in</Link> to see your fan level with {fn}.</p>}
          <div className="rounded-2xl border border-rule bg-card p-4 text-xs text-slate">
            <b className="text-sm text-ink">Badges</b>
            <p className="mt-2">🥇 #1 · 🥈 #2 · 🥉 #3 · 🏅 #4–10 · 🎖 #11–99 &ldquo;{fn}&apos;s Top Fan&rdquo;, and 🏆 VVIP, 🛡 Army (VIP), 🌄 Starter (Premium) for subscribers. They show next to your name wherever {fn} posts. In {fn}&apos;s lives, the #1 fan with VVIP arrives by yacht or private jet; #2 and #3 with any subscription by SUV or sports car, e-bike or bicycle. <Link href="/help/fan-levels" className="text-crimson underline">How fan levels work</Link></p>
          </div>
        </div>
      </div>
    </section>
  );
}
