"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ROLE_LABEL, type StaffRole } from "@/lib/books";
import { ROLE_ABOUT } from "@/components/books/Staff";

// A Business books staff invitation (lib/books-staff-server.ts): who invited you, as what, what that role can and can't do, and Accept or
// Decline. Reached from the bell, the email, or /invites.
type Invite = { id: string; ownerName: string; ownerUsername: string; role: StaffRole; status: string; createdAt: string; viewer: "invitee" | "owner"; ownerUid: string };
const CAN: Record<StaffRole, { can: string[]; cannot: string[] }> = {
  cashier: { can: ["Record sales, with Customer owes", "Record payments customers bring", "See the sales you recorded today", "Print or share receipts, by WhatsApp or link", "Tell Nana a sale in a sentence"], cannot: ["See profit, costs or the expenses list", "Export, import or change settings", "See other staff's entries", "See the shop's payouts or bank details"] },
  manager: { can: ["Everything in the books: sales, expenses and purchases", "Money owed, reminders and receipts", "Profit and loss, stock, imports and exports"], cannot: ["Change the books' settings", "Invite or remove staff", "See the shop's payouts or bank details"] },
};

export default function BooksInvitePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [inv, setInv] = useState<Invite | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const id = decodeURIComponent(params.id);
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) return router.replace(`/login?next=/invites/books/${encodeURIComponent(id)}`);
    setUser(u);
    const r = await fetch(`/api/books/staff?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${await u.getIdToken()}` } });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setInv(j); else setErr(j.error || "That invitation isn't available.");
  }), [router, id]);
  const answer = async (accept: boolean) => {
    if (!user) return;
    setBusy(true); setErr("");
    const r = await fetch("/api/books/staff", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ action: accept ? "accept" : "decline", id }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Couldn't do that.");
    setDone(accept ? j.owner : "declined");
  };
  if (err && !inv) return <div className="mx-auto max-w-xl px-4 py-16"><p className="card p-5 text-sm text-ink">{err} <Link href="/invites" className="text-crimson underline">Your invitations</Link></p></div>;
  if (!inv) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const r = CAN[inv.role];
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="eyebrow">Business books · staff invitation</p>
      <h1 className="mt-2 font-display text-4xl text-ink">{inv.ownerName} invited you as {inv.role === "cashier" ? "a Cashier" : "a Manager"}</h1>
      <p className="mt-3 text-[15px] text-slate">{ROLE_ABOUT[inv.role]}</p>
      <div className="card mt-5 grid gap-4 p-5 text-sm sm:grid-cols-2">
        <div><p className="font-ui font-bold text-ink">You can</p><ul className="mt-2 space-y-1.5 text-ink">{r.can.map((x) => <li key={x}>✓ {x}</li>)}</ul></div>
        <div><p className="font-ui font-bold text-ink">You can&apos;t</p><ul className="mt-2 space-y-1.5 text-slate">{r.cannot.map((x) => <li key={x}>– {x}</li>)}</ul></div>
      </div>
      <p className="mt-3 text-xs text-slate">Every entry you make shows that you made it, and {inv.ownerName} can change your role or remove you at any time. You can leave whenever you like.</p>
      {err && <p className="mt-3 text-sm text-red-700" role="alert">{err}</p>}
      {done ? (
        done === "declined" ? <p className="card mt-5 p-4 text-sm text-ink">Declined. {inv.ownerName} will see that.</p> : (
          <div className="card mt-5 p-5"><p className="font-ui font-bold text-ink">You&apos;re on {inv.ownerName}&apos;s books as {ROLE_LABEL[inv.role]}.</p><Link href={`/profile/books?owner=${encodeURIComponent(done)}`} className="btn-primary mt-3 inline-flex">Open their books</Link></div>
        )
      ) : inv.viewer === "invitee" && inv.status === "pending" ? (
        <div className="mt-5 flex gap-3"><button onClick={() => answer(true)} disabled={busy} className="btn-primary flex-1">Accept</button><button onClick={() => answer(false)} disabled={busy} className="btn-ghost flex-1">Decline</button></div>
      ) : <p className="card mt-5 p-4 text-sm text-slate">This invitation is {inv.status}.</p>}
    </div>
  );
}
