"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import GiftArt, { GiftArtStyles } from "@/components/GiftArt";
import { GIFT_POINT_KOBO, giftNaira, isGiftMotif, withdrawRuleText, GIFT_SETTINGS } from "@/lib/gift-catalogue";
import type { ReceivedRow, ReceivedView } from "@/lib/gift-earnings-server";
import { useLivePricing } from "@/lib/useLivePricing";
import WeeklyGiftBoards from "@/components/gifts/WeeklyGiftBoards";

// A profile's Gifts tab, after Media (owner, 4 Nov 2026; docs/LIVE_ECONOMY.md phase 2). Everyone sees the gifts this member received,
// each with its count and value, the archived ones folded under "Archived", their gift points and this week's Top gifters. The member
// themselves also sees what is ready to withdraw (past the 7-day review) and what is still in review, a Withdraw button, Archive on
// each gift, and their recent withdrawals. Figures come from the server; the withdrawal line is the one set in Admin → Pricing → Gifts.
export default function ReceivedGifts({ username, user }: { username: string; user: User | null | undefined }) {
  useLivePricing();
  const [data, setData] = useState<ReceivedView | null | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const headers: Record<string, string> = user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {};
    const r = await fetch(`/api/gifts/received?username=${encodeURIComponent(username)}`, { headers });
    setData(r.ok ? await r.json() : null);
  }, [username, user]);
  useEffect(() => { if (user !== undefined) load().catch(() => setData(null)); }, [user, load]);

  const post = async (body: Record<string, unknown>, key: string) => {
    if (!user) return;
    setBusy(key); setNote(null);
    try {
      const r = await fetch("/api/gifts/received", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't do that.");
      if (j.message) setNote({ ok: true, text: j.message });
      await load();
    } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Couldn't do that." }); }
    finally { setBusy(null); }
  };

  if (data === undefined) return <div className="mt-5 h-40 animate-pulse rounded-2xl bg-rule/40" />;
  if (data === null) return <p className="mt-5 text-sm text-slate">Gifts aren&apos;t shown here.</p>;
  const m = data.money;
  const own = !!m;
  const autoBelow = m?.autoBelowKobo ?? GIFT_SETTINGS.economy.autoWithdrawMaxKobo;
  const row = (r: ReceivedRow) => (
    <tr key={r.key} className="border-t border-rule" data-gift-row={r.key}>
      <td className="px-3 py-3"><span className="flex items-center gap-2">{isGiftMotif(r.animId) ? <GiftArt id={r.animId} size={32} motion="still" /> : <span className="flex h-8 w-8 items-center justify-center text-lg">🎁</span>}<span className="font-ui text-sm text-ink">{r.name}</span></span></td>
      <td className="px-3 py-3 font-mono text-sm text-ink">{r.count.toLocaleString("en-NG")}</td>
      <td className="px-3 py-3 font-mono text-sm text-ink">{giftNaira(r.valueKobo)}</td>
      {own && (
        <td className="px-3 py-3 text-right">
          <button type="button" disabled={!!busy} onClick={() => post({ action: r.archived ? "unarchive" : "archive", key: r.key }, r.key)} className="font-ui text-xs font-semibold text-slate hover:text-crimson disabled:opacity-50">
            {busy === r.key ? "…" : r.archived ? "Unarchive" : "Archive"}
          </button>
        </td>
      )}
    </tr>
  );

  return (
    <div className="mt-5 space-y-4" data-received-gifts>
      <GiftArtStyles />
      {own && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-5" data-withdraw-card>
            <p className="text-sm text-slate">Ready to withdraw (past the 7-day review)</p>
            <p className="mt-1 font-display text-4xl text-crimson">{giftNaira(m.readyKobo)}</p>
            <p className="mt-2 text-sm text-slate">{withdrawRuleText({ ...GIFT_SETTINGS, economy: { ...GIFT_SETTINGS.economy, autoWithdrawMaxKobo: autoBelow } })}</p>
            {m.payoutReady ? (
              <button type="button" disabled={!!busy || m.readyKobo <= 0} onClick={() => post({ action: "withdraw" }, "withdraw")} className="mt-4 rounded-full bg-crimson px-6 py-3 font-ui text-sm font-bold text-paper hover:bg-crimson-bright disabled:opacity-50">
                {busy === "withdraw" ? "Sending…" : `Withdraw ${giftNaira(m.readyKobo)}`}
              </button>
            ) : (
              <p className="mt-4 text-sm text-ink">Add your bank account under <Link href="/profile/publishing" className="font-semibold text-crimson underline">Rates &amp; payouts</Link> to withdraw.</p>
            )}
            {note && <p className={`mt-3 text-sm ${note.ok ? "text-emerald-700" : "text-crimson"}`} role={note.ok ? "status" : "alert"}>{note.text}</p>}
          </div>
          <div className="card p-5">
            <p className="text-sm text-slate">In review</p>
            <p className="mt-1 font-display text-3xl text-ink">{giftNaira(m.inReviewKobo)}</p>
            <p className="mt-1 text-sm text-slate">Ready 7 days after each gift{m.nextReleaseAt ? `; the next on ${new Date(m.nextReleaseAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}` : ""}.</p>
            <p className="mt-3 text-sm text-ink">This week: {data.week.place ? `#${data.week.place} on Top gifted` : "not on Top gifted yet"} · {data.points.total.toLocaleString("en-NG")} gift points</p>
          </div>
        </div>
      )}
      {!own && (
        <p className="text-sm text-slate">{data.owner.displayName} has {data.points.total.toLocaleString("en-NG")} gift points ({data.points.thisWeek.toLocaleString("en-NG")} this week){data.week.place ? ` and is #${data.week.place} on Top gifted this week` : ""}.</p>
      )}
      {own && <p className="text-xs text-slate">Your gift points: {data.points.total.toLocaleString("en-NG")} in all, {data.points.thisWeek.toLocaleString("en-NG")} this week (1 point for each {giftNaira(GIFT_POINT_KOBO)} you spend on gifts).</p>}

      <div className="overflow-hidden rounded-2xl border border-rule bg-card">
        <table className="w-full text-left">
          <thead><tr className="bg-crimson text-[13px] text-white"><th className="px-3 py-2">Gift</th><th className="px-3 py-2">Count</th><th className="px-3 py-2">Value</th>{own && <th className="px-3 py-2" />}</tr></thead>
          <tbody>
            {data.rows.map(row)}
            {data.rows.length === 0 && <tr><td colSpan={own ? 4 : 3} className="px-3 py-4 text-sm text-slate">{data.archived.kinds ? "Everything is archived." : "No gifts yet."}</td></tr>}
            {data.archived.kinds > 0 && (
              <tr className="border-t border-rule text-slate">
                <td className="px-3 py-3 font-ui text-sm">Archived · {data.archived.kinds} kind{data.archived.kinds === 1 ? "" : "s"}</td>
                <td className="px-3 py-3 font-mono text-sm">{data.archived.count.toLocaleString("en-NG")}</td>
                <td className="px-3 py-3 font-mono text-sm">{giftNaira(data.archived.valueKobo)}</td>
                <td className="px-3 py-3 text-right" colSpan={own ? 1 : 0}><button type="button" onClick={() => setShowArchived((v) => !v)} className="font-ui text-xs font-semibold text-ink hover:text-crimson">{showArchived ? "Hide" : "Show"}</button></td>
              </tr>
            )}
            {showArchived && data.archived.rows.map(row)}
          </tbody>
        </table>
      </div>
      {own && <p className="text-xs text-slate">Archive takes a gift out of this list; it keeps its count and value under Archived, and what it earned can still be withdrawn.</p>}

      {own && m.withdrawals.length > 0 && (
        <div className="card p-4">
          <p className="font-ui text-sm font-bold text-ink">Your withdrawals</p>
          <ul className="mt-2 divide-y divide-rule text-sm">
            {m.withdrawals.map((w) => (
              <li key={w.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{new Date(w.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })} · {giftNaira(w.amountKobo)}</span>
                <span className="text-slate">{w.status}{w.failureReason ? ` (${w.failureReason})` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <WeeklyGiftBoards user={user} creator={username} />
    </div>
  );
}
