"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ROLE_LABEL, naira, type StaffRole } from "@/lib/books";
import { Badge, Icon, field, pill, type Api } from "./shared";
import { EntryList } from "./Home";
import type { Entry } from "@/lib/books";

// Staff on the books (docs/BUSINESS-BOOKS.md, step 10; lib/books-staff-server.ts): invite a Cashier or a Manager by @username or email
// (they accept on /invites/books/<id>, from the bell and the email), change their role, or remove them. The owner and an organisation's
// admins only. Seats come with the plan: Business and Enterprise.
type View = { seats: number | null; used: number; tier: string; staff: { uid: string; username: string; name: string; role: StaffRole; addedAt: string }[]; invites: { id: string; inviteeUsername: string; inviteeName: string; role: StaffRole; createdAt: string }[] };
export const ROLE_ABOUT: Record<StaffRole, string> = {
  cashier: "Records sales and payments received, sees the sales they recorded today, and prints or shares receipts. No profit, no expenses list, no costs, no exports, no settings.",
  manager: "Everything in the books (sales, expenses, money owed, profit and loss, stock, imports and exports) except settings and staff.",
};

export default function Staff({ api }: { api: Api }) {
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [who, setWho] = useState("");
  const [role, setRole] = useState<StaffRole>("cashier");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<View>("view=staff").then((d) => { setV(d); setErr(""); }).catch((e) => setErr(e.message)), [api]);
  useEffect(() => { load(); }, [load]);
  const act = async (body: Record<string, unknown>, ok: string) => { setMsg(""); setErr(""); try { await api("", body); setMsg(ok); await load(); } catch (e) { setErr((e as Error).message); } };
  const invite = async () => { if (!who.trim()) return setErr("Enter their @username or email."); setBusy(true); await act({ action: "staffInvite", identifier: who, role }, `Invitation sent. They'll see it in their bell and email.`); setWho(""); setBusy(false); };

  if (!v) return <p className="text-sm text-slate">{err || "Loading your staff…"}</p>;
  const full = v.seats !== null && v.used >= v.seats;
  return (
    <div>
      <p className="eyebrow">Business books · staff</p>
      <h1 className="mt-1 font-display text-4xl text-ink">Staff</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-slate">Let a cashier record sales at the counter, or a manager keep the books with you. Every entry shows who made it, and you can see each person&apos;s sales. Nobody but you changes settings or staff.</p>

      {v.seats === 0 ? (
        <div className="card mt-5 p-5 text-sm">
          <p className="font-ui font-bold text-ink">Staff come with Business and Enterprise</p>
          <p className="mt-1 text-slate">Business has staff seats for cashiers and managers (see the plans); on Enterprise the number is agreed with you.</p>
          <Link href="/pricing" className="btn-primary mt-3 inline-flex">See the plans</Link>
        </div>
      ) : (
        <section className="card mt-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-ui text-lg font-bold text-ink">Invite someone</h2><span className="text-sm text-slate">{v.seats === null ? `${v.used} staff` : `${v.used} of ${v.seats} seats used`}</span></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="@username or email" aria-label="Their @username or email" className={field} disabled={full} />
            <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} aria-label="Role" className={`${field} sm:w-40`} disabled={full}><option value="cashier">Cashier</option><option value="manager">Manager</option></select>
            <button onClick={invite} disabled={busy || full} className="btn-primary">{busy ? "Sending…" : "Send invitation"}</button>
          </div>
          <p className="mt-2 text-[13px] text-slate"><b className="text-ink">{ROLE_LABEL[role]}:</b> {ROLE_ABOUT[role]}</p>
          {full && <p className="mt-2 text-sm text-amber-800">All seats are in use. Remove someone, or ask us about Enterprise.</p>}
          <p className="mt-2 text-[13px] text-slate">They need a #NotesApp account (free). They accept from their bell or the email we send.</p>
        </section>
      )}
      {err && <p className="mt-3 text-sm text-red-700" role="alert">{err}</p>}
      {msg && <p className="mt-3 text-sm text-ink" role="status">{msg}</p>}

      {v.invites.length > 0 && (
        <section className="card mt-4 p-5">
          <h2 className="font-ui text-lg font-bold text-ink">Waiting for an answer</h2>
          <ul className="mt-2 divide-y divide-rule">
            {v.invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span><span className="font-ui font-semibold text-ink">{i.inviteeName || `@${i.inviteeUsername}`}</span> <Badge>{ROLE_LABEL[i.role]}</Badge><span className="block text-xs text-slate">Invited {new Date(i.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></span>
                <button onClick={() => act({ action: "staffRevoke", inviteId: i.id }, "Invitation withdrawn.")} className="text-xs font-semibold text-slate hover:text-crimson">Withdraw</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mt-4 p-5">
        <h2 className="font-ui text-lg font-bold text-ink">On your books</h2>
        {v.staff.length ? (
          <ul className="mt-2 divide-y divide-rule">
            {v.staff.map((m) => <StaffRow key={m.uid} api={api} m={m} onRole={(r) => act({ action: "staffRole", uid: m.uid, role: r }, `${m.name} is now ${ROLE_LABEL[r].toLowerCase() === "manager" ? "a manager" : "a cashier"}.`)} onRemove={() => window.confirm(`Remove ${m.name} from your books? Their entries stay.`) && act({ action: "staffRemove", uid: m.uid }, `${m.name} was removed.`)} />)}
          </ul>
        ) : <p className="mt-2 text-sm text-slate">No staff yet.</p>}
      </section>
    </div>
  );
}

function StaffRow({ api, m, onRole, onRemove }: { api: Api; m: View["staff"][number]; onRole: (r: StaffRole) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  useEffect(() => { if (open && !entries) api<{ entries: Entry[] }>(`view=entries&kind=sale&period=week&back=0&by=${encodeURIComponent(m.uid)}`).then((r) => setEntries(r.entries)).catch(() => setEntries([])); }, [open, entries, api, m.uid]);
  const total = (entries ?? []).filter((e) => !e.voidedAt && e.kind === "sale").reduce((n, e) => n + e.totalKobo, 0);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="min-w-0"><span className="font-ui font-semibold text-ink">{m.name}</span>{m.username && <span className="ml-1 text-slate">@{m.username}</span>}<span className="block text-xs text-slate">Since {new Date(m.addedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span></span>
        <span className="flex items-center gap-2">
          <select value={m.role} onChange={(e) => onRole(e.target.value as StaffRole)} aria-label={`${m.name}'s role`} className={`${field} !w-32 !py-1.5`}><option value="cashier">Cashier</option><option value="manager">Manager</option></select>
          <button onClick={() => setOpen(!open)} className={`${pill} !py-1.5`}><Icon name="bag" className="h-4 w-4" />Their sales</button>
          <button onClick={onRemove} className="text-xs font-semibold text-slate hover:text-crimson">Remove</button>
        </span>
      </div>
      {open && <div className="mt-2 rounded-2xl bg-field p-3">{entries === null ? <p className="text-sm text-slate">Loading…</p> : entries.length ? <><p className="text-sm text-slate">This week: {entries.filter((e) => !e.voidedAt).length} sales, {naira(total)}</p><EntryList entries={entries.slice(0, 10)} api={api} categories={[]} onChanged={() => setEntries(null)} /></> : <p className="text-sm text-slate">No sales from {m.name} this week.</p>}</div>}
    </li>
  );
}
