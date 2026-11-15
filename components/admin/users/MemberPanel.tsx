"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { formatNaira } from "@/lib/booking-time";
import ReasonDialog from "./ReasonDialog";

// One member's full picture on Admin → Users (lib/admin-members-server.ts detail): account, money, activity, trust, who viewed their
// details, staff notes, the change history, and the actions. Each part shows only for the departments it belongs to (the server leaves
// the others out). Opens as a panel from the right (full screen on a phone).
type Detail = {
  account: {
    uid: string; username: string; displayName: string; role: string; tier: string; kind: string; createdAt: string; suspended: boolean; trialUntil: string | null;
    verified: boolean; providers: string[]; disabled: boolean; lastSignIn: string | null; lastSeen: string | null;
    campus: { role: string; country: string; campus: string; campusLead: boolean } | null; referredBy: string | null; referred: number;
  };
  money: null | {
    payments: { reference: string; kind: string; amountKobo: number; currency: string; status: string; createdAt: string }[]; paymentsCount: number; paidKobo: number;
    sales: { count: number; heldKobo: number; availableKobo: number; paidOutKobo: number };
    wallet: null | { creditKobo: number; bonusKobo: number; heldKobo: number; activity: { id: string; label: string; creditKobo: number; bonusKobo: number; at: string }[] };
  };
  activity: { booked: { reference: string; date: string; status: string; with: string }[]; bookedCount: number; hosted: { reference: string; date: string; status: string; with: string }[]; hostedCount: number };
  trust: null | { reports: { id: string; kind: string; reason: string; status: string; outcome: string | null; createdAt: string }[]; reportsCount: number; reportsFiled: number;
    suspension: null | { reason: string; suspendedAt: string; until: string | null; appealStatus: string; liftedAt: string | null } };
  views: null | { id: string; at: string; adminName: string; label: string; reason: string }[];
  notes: { id: string; text: string; byUid: string; byName: string; at: string }[];
  history: { id: string; what: string; detail: string; byName: string; at: string }[];
  can: { notify: boolean; emails: boolean; exportData: boolean; duplicates: boolean; suspend: boolean };
};

const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "never");
export const ago = (iso?: string | null, now = Date.now()) => {
  if (!iso) return "never";
  const m = Math.floor((now - Date.parse(iso)) / 60_000);
  return m < 2 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`;
};
const money = (k: number, c = "NGN") => (c === "NGN" ? formatNaira(k) : `${(k / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })} ${c}`);

export async function membersCall<T>(user: User, init: { uid?: string; body?: Record<string, unknown> }): Promise<T> {
  const r = await fetch(`/api/admin/members${init.body ? "" : `?uid=${encodeURIComponent(init.uid ?? "")}`}`, {
    method: init.body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong.");
  return j as T;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-t border-rule px-5 py-4"><h3 className="font-mono text-[11px] uppercase tracking-[0.12em] text-crimson-bright">{title}</h3><div className="mt-2 font-ui text-sm text-ink">{children}</div></section>;
}
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-3 py-0.5"><span className="text-slate">{k}</span><span className="text-right">{v}</span></div>;

export default function MemberPanel({ user, uid, onClose, onChanged }: { user: User; uid: string; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // The signed-in staff member, kept in a ref so a new object for the same person doesn't reload the panel.
  const me = useRef(user);
  me.current = user;
  const load = useCallback(async () => {
    setError("");
    try { setD(await membersCall<Detail>(me.current, { uid })); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load."); }
  }, [uid]);
  useEffect(() => { setD(null); void load(); }, [load]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const act = async (body: Record<string, unknown>, done: string) => {
    setBusy(true); setError(""); setFlash("");
    try { const out = await membersCall<unknown>(user, { body }); setFlash(done); await load(); onChanged(); return out; } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); return null; } finally { setBusy(false); }
  };
  const doExport = async (reason: string, n: string) => {
    setBusy(true); setExportError("");
    try {
      const data = await membersCall<unknown>(user, { body: { action: "export", uid, reason, note: n } });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      a.download = `notesapp-member-${d?.account.username ?? uid}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setExporting(false); setFlash("Exported. It's in the view log."); await load();
    } catch (e) { setExportError(e instanceof Error ? e.message : "Couldn't export."); } finally { setBusy(false); }
  };

  const a = d?.account;
  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={a ? `${a.displayName}, member details` : "Member details"}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto bg-paper shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-rule bg-paper px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-ui text-lg font-semibold text-ink">{a?.displayName ?? "Loading…"}</p>
            {a && <p className="truncate font-mono text-xs text-slate">@{a.username} · {a.uid}</p>}
          </div>
          {a && <Link href={`/u/${a.username}`} className="font-ui text-sm font-semibold text-crimson">Profile</Link>}
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-ink hover:bg-field">✕</button>
        </div>
        {error && <p className="px-5 pt-3 font-ui text-sm text-crimson" role="alert">{error}</p>}
        {flash && <p className="px-5 pt-3 font-ui text-sm text-green-700" role="status">{flash}</p>}
        {!d ? <p className="p-5 font-ui text-sm text-slate">Loading…</p> : (
          <>
            <Section title="Account">
              <Row k="Plan" v={<>{a!.tier}{a!.trialUntil && Date.parse(a!.trialUntil) > Date.now() ? ` (trial until ${day(a!.trialUntil)})` : ""}</>} />
              <Row k="Role" v={a!.role} />
              {a!.kind === "organisation" && <Row k="Kind" v="Organisation" />}
              <Row k="Joined" v={day(a!.createdAt)} />
              <Row k="Email" v={a!.verified ? <span className="text-green-700">✓ confirmed</span> : <span className="text-amber-700">not confirmed</span>} />
              <Row k="Signs in with" v={a!.providers.join(", ") || "—"} />
              <Row k="Last signed in" v={when(a!.lastSignIn)} />
              <Row k="Last seen" v={ago(a!.lastSeen)} />
              {a!.disabled && <Row k="Sign-in" v={<b className="text-red-700">disabled</b>} />}
              {a!.suspended && <Row k="Status" v={<b className="text-red-700">suspended</b>} />}
            </Section>

            {d.money && (
              <Section title="Money">
                {d.money.wallet && <Row k="Wallet" v={<>{formatNaira(d.money.wallet.creditKobo)} credit · {formatNaira(d.money.wallet.bonusKobo)} bonus{d.money.wallet.heldKobo ? ` · ${formatNaira(d.money.wallet.heldKobo)} held` : ""}</>} />}
                <Row k="Paid us (naira)" v={`${formatNaira(d.money.paidKobo)} · ${d.money.paymentsCount} payment${d.money.paymentsCount === 1 ? "" : "s"}`} />
                <Row k="As a seller" v={`${d.money.sales.count} sale${d.money.sales.count === 1 ? "" : "s"} · ${formatNaira(d.money.sales.heldKobo)} held · ${formatNaira(d.money.sales.availableKobo)} due · ${formatNaira(d.money.sales.paidOutKobo)} paid out`} />
                {d.money.payments.length > 0 && (
                  <ul className="mt-2 divide-y divide-rule rounded-[10px] border border-rule bg-card text-[13px]">
                    {d.money.payments.map((p) => <li key={p.reference} className="flex justify-between gap-3 px-3 py-2"><span className="min-w-0 truncate">{day(p.createdAt)} · {p.kind} · <span className="font-mono text-xs text-slate">{p.reference}</span></span><span className="shrink-0">{money(p.amountKobo, p.currency)} · {p.status}</span></li>)}
                  </ul>
                )}
                {d.money.wallet && d.money.wallet.activity.length > 0 && (
                  <details className="mt-2"><summary className="cursor-pointer text-[13px] font-semibold text-crimson">Wallet activity</summary>
                    <ul className="mt-1 divide-y divide-rule text-[13px]">{d.money.wallet.activity.map((t) => <li key={t.id} className="flex justify-between gap-3 py-1.5"><span className="truncate">{day(t.at)} · {t.label}</span><span className="shrink-0">{formatNaira(t.creditKobo + t.bonusKobo)}</span></li>)}</ul>
                  </details>
                )}
              </Section>
            )}

            <Section title="Activity">
              <Row k="Sessions booked" v={d.activity.bookedCount} />
              <Row k="Sessions hosted" v={d.activity.hostedCount} />
              <Row k="Referred by" v={a!.referredBy ? <Link href={`/u/${a!.referredBy}`} className="text-crimson underline">@{a!.referredBy}</Link> : "—"} />
              <Row k="Brought" v={`${a!.referred} member${a!.referred === 1 ? "" : "s"}`} />
              {a!.campus && <Row k="Campus" v={`${a!.campus.campusLead ? "Campus Lead" : a!.campus.role} · ${a!.campus.campus}, ${a!.campus.country}`} />}
              {[...d.activity.booked.map((b) => ({ ...b, as: "booked with" })), ...d.activity.hosted.map((b) => ({ ...b, as: "hosted" }))].slice(0, 6).map((b) => <p key={`${b.as}${b.reference}`} className="text-[13px] text-slate">{b.date} · {b.as} {b.with && `@${b.with}`} · {b.status}</p>)}
            </Section>

            {d.trust && (
              <Section title="Trust">
                <Row k="Reports against them" v={d.trust.reportsCount} />
                <Row k="Reports they filed" v={d.trust.reportsFiled} />
                {d.trust.suspension && <Row k="Suspension" v={<>{d.trust.suspension.reason || "—"}<br /><span className="text-xs text-slate">{day(d.trust.suspension.suspendedAt)}{d.trust.suspension.until ? ` until ${day(d.trust.suspension.until)}` : ""}{d.trust.suspension.liftedAt ? ` · lifted ${day(d.trust.suspension.liftedAt)}` : ""} · appeal {d.trust.suspension.appealStatus}</span></>} />}
                {d.trust.reports.map((r) => <p key={r.id} className="text-[13px] text-slate">{day(r.createdAt)} · {r.kind} · {r.reason} · {r.status}{r.outcome ? ` (${r.outcome})` : ""}</p>)}
                {d.trust.reportsCount > 0 && <Link href="/admin/reports" className="text-[13px] font-semibold text-crimson">Open Reports →</Link>}
              </Section>
            )}

            {d.views && (
              <Section title="Who viewed their details">
                {d.views.length === 0 ? <p className="text-slate">No one yet.</p> : d.views.map((v) => <p key={v.id} className="text-[13px] text-slate">{when(v.at)} · {v.adminName} · {v.label} · {v.reason}</p>)}
              </Section>
            )}

            <Section title="Actions">
              <div className="flex flex-wrap gap-2">
                {d.can.emails && !a!.verified && <button type="button" disabled={busy} onClick={() => void act({ action: "verify", uid }, "Confirmation email sent.")} className="btn-ghost !px-3 !py-1.5 text-xs">Resend confirmation email</button>}
                {d.can.emails && <button type="button" disabled={busy} onClick={() => { if (confirm("Send them a link to choose a new password?")) void act({ action: "reset", uid }, "Password reset link sent."); }} className="btn-ghost !px-3 !py-1.5 text-xs">Send password reset link</button>}
                {d.can.exportData && <button type="button" disabled={busy} onClick={() => setExporting(true)} className="btn-ghost !px-3 !py-1.5 text-xs">Export their data</button>}
              </div>
              {d.can.notify && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-ink">Send them a notification from #NotesApp
                    <textarea rows={2} maxLength={280} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. Your refund has been sent; it can take 3 working days." className="mt-1 w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm font-normal" />
                  </label>
                  <button type="button" disabled={busy || msg.trim().length < 5} onClick={() => void act({ action: "notify", uids: [uid], message: msg }, "Sent to their notifications.").then((ok) => ok && setMsg(""))} className="btn-primary mt-2 !px-4 !py-1.5 text-xs">Send</button>
                </div>
              )}
            </Section>

            <Section title={`Staff notes (${d.notes.length})`}>
              <textarea rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Only staff see these. e.g. Called about the refund, sorted." className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm" />
              <button type="button" disabled={busy || note.trim().length < 2} onClick={() => void act({ action: "note", uid, text: note }, "Note saved.").then((ok) => ok && setNote(""))} className="btn-primary mt-2 !px-4 !py-1.5 text-xs">Add note</button>
              <ul className="mt-3 space-y-2">
                {d.notes.map((n) => (
                  <li key={n.id} className="rounded-[10px] border border-rule bg-card p-3 text-[13px]">
                    <p className="whitespace-pre-line text-ink">{n.text}</p>
                    <p className="mt-1 flex justify-between gap-2 text-xs text-slate"><span>{n.byName} · {when(n.at)}</span>{n.byUid === user.uid && <button type="button" onClick={() => { if (confirm("Delete this note?")) void act({ action: "deleteNote", id: n.id }, "Note deleted."); }} className="font-semibold text-red-700">Delete</button>}</p>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title={`History (${d.history.length})`}>
              {d.history.length === 0 ? <p className="text-slate">No changes recorded yet.</p> : (
                <ul className="space-y-1 text-[13px]">{d.history.map((h) => <li key={h.id}><span className="text-slate">{when(h.at)} · {h.byName}:</span> <b>{h.what}</b>{h.detail ? ` · ${h.detail}` : ""}</li>)}</ul>
              )}
            </Section>
          </>
        )}
      </aside>
      {exporting && (
        <ReasonDialog title="Export their data?" note="A copy of everything we hold about them, as a file. Your name, the time and your reason go in the view log." action="Export" busy={busy} error={exportError}
          onCancel={() => setExporting(false)} onSubmit={(r, n) => void doExport(r, n)} />
      )}
    </div>
  );
}
