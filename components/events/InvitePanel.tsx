"use client";

import { useEffect, useState } from "react";
import { useMember } from "@/lib/member-client";
import { formatNaira } from "@/lib/booking-time";
import { startCheckout } from "@/lib/checkout";
import { EMAILS_PER_SEND, INVITE_MESSAGE_MAX } from "@/lib/event-invites";
import { capi, field } from "@/components/community/api";
import DiscountCodeField from "@/components/DiscountCodeField";

// Invite people to an event or a meeting (lib/event-invites.ts): your followers and pasted email addresses, counted against this week's
// invitations for your plan (Admin → Pricing), with add-on packs for more. People already going or booked aren't invited again.
type Week = { allowance: number; sent: number; left: number; followers: number; pack?: { sends: number; until: string }; packs: { id: string; sends: number; priceKobo: number }[] };
export default function InvitePanel({ kind, id }: { kind: "event" | "meeting"; id: string }) {
  const { user } = useMember();
  const [w, setW] = useState<Week | null>(null);
  const [open, setOpen] = useState(false);
  const [followers, setFollowers] = useState(true);
  const [emails, setEmails] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pick, setPick] = useState<string>("");
  const [disc, setDisc] = useState<{ code: string; discountKobo: number } | null>(null);
  const load = () => capi<Week>("/api/event-invites").then(setW).catch(() => {});
  useEffect(() => { if (open && !w) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return <button className="btn-ghost !px-4 !py-2 text-xs" onClick={() => setOpen(true)}>✉ Invite people</button>;
  async function send() {
    setBusy(true); setMsg("");
    try {
      const r = await capi<{ invited: number; notInvited: number; skipped: number; left: number }>("/api/event-invites", { kind, id, followers, emails, message });
      setMsg(`Invited ${r.invited.toLocaleString()}.${r.notInvited ? ` ${r.notInvited.toLocaleString()} more didn't fit this week's invitations.` : ""}${r.skipped ? ` ${r.skipped} addresses didn't look right.` : ""} ${r.left.toLocaleString()} left this week.`);
      setEmails(""); await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't send."); }
    finally { setBusy(false); }
  }
  return (
    <section className="card mt-4 p-4">
      <div className="flex items-center justify-between"><h2 className="font-ui text-sm font-bold">Invite people</h2><button className="text-xs text-slate" onClick={() => setOpen(false)}>Close</button></div>
      {!w ? <p className="mt-2 text-sm text-slate">Loading…</p> : <>
        <p className="mt-1 text-xs text-slate"><b className="text-ink">{w.left.toLocaleString()}</b> of {w.allowance.toLocaleString()} invitations left this week (Monday to Sunday). Reminders to people already in are always free.</p>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={followers} onChange={(e) => setFollowers(e.target.checked)} /> My followers ({w.followers.toLocaleString()})</label>
        <label className="mt-3 block text-xs text-slate">Email addresses (up to {EMAILS_PER_SEND}, one per line or separated by commas)<textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={3} className={`${field} mt-1`} placeholder="ada@example.com, tolu@example.com" /></label>
        <label className="mt-3 block text-xs text-slate">A note (optional)<textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={INVITE_MESSAGE_MAX} className={`${field} mt-1`} /></label>
        <div className="mt-3 flex flex-wrap items-center gap-3"><button className="btn-primary !px-4 !py-2 text-xs" disabled={busy || !w.left} onClick={send}>{busy ? "Sending…" : "Send invitations"}</button>{msg && <span className="text-sm text-ink" role="status">{msg}</span>}</div>
        <details className="mt-4 text-xs text-slate">
          <summary className="cursor-pointer">Need more invitations?{w.pack ? ` (pack: ${w.pack.sends.toLocaleString()} more a week until ${new Date(w.pack.until).toDateString()})` : ""}</summary>
          <ul className="mt-2 space-y-2">
            {w.packs.map((p) => (
              <li key={p.id}><label className="flex cursor-pointer items-center justify-between gap-3"><span><input type="radio" name="pack" checked={pick === p.id} onChange={() => { setPick(p.id); setDisc(null); }} className="mr-2" />{p.sends.toLocaleString()} more a week for a month</span><b className="text-ink">{formatNaira(p.priceKobo)}</b></label></li>
            ))}
          </ul>
          {pick && (() => { const p = w.packs.find((x) => x.id === pick)!; return (
            <div className="mt-2 space-y-2">
              <DiscountCodeField key={pick} target="invite_pack" subtotalKobo={p.priceKobo} onChange={setDisc} />
              <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={!user} onClick={() => user && startCheckout(user, { kind: "invite_pack", pack: p.id, ...(disc ? { code: disc.code } : {}) }, { payWith: "card" }).catch((e) => alert(e.message))}>Pay {formatNaira(Math.max(0, p.priceKobo - (disc?.discountKobo ?? 0)))}</button>
            </div>
          ); })()}
          <p className="mt-2">Business includes 5,000 a week; upgrading your plan also raises it. Prices are set in Admin → Pricing.</p>
        </details>
      </>}
    </section>
  );
}
