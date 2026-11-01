"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { formatNaira } from "@/lib/booking-time";
import { capi } from "./api";

// The giver's receipts (/giving): what they gave, to which fund, the charges, what they paid and what the community received.
type Gift = { reference: string; cid: string; communityName: string; fund: string; note: string; anonymous: boolean; giftKobo: number; paidKobo: number; bandKobo: number; cardChargeKobo: number; netKobo: number; covered: boolean; payWith: string; status: string; createdAt: string };

export default function MyGiving() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [list, setList] = useState<Gift[] | null>(null);
  const [open, setOpen] = useState("");
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => { if (user) capi<{ gifts: Gift[] }>("/api/giving").then((d) => setList(d.gifts)).catch(() => setList([])); }, [user]);
  if (user === null) return <p className="card p-6 text-sm text-slate"><Link href="/login?next=/giving" className="text-crimson underline">Sign in</Link> to see your giving.</p>;
  if (!list) return <p className="text-sm text-slate">Loading…</p>;
  if (!list.length) return <p className="card p-6 text-sm text-slate">No gifts yet. Communities that take gifts have a Give button.</p>;
  const year = new Date().getFullYear();
  const thisYear = list.filter((g) => g.status === "paid" && new Date(g.createdAt).getFullYear() === year).reduce((n, g) => n + g.giftKobo, 0);
  return (
    <div>
      <p className="text-sm text-ink">Given in {year}: <b>{formatNaira(thisYear)}</b></p>
      <ul className="mt-4 space-y-3">{list.map((g) => (
        <li key={g.reference} className="card p-4">
          <button className="flex w-full flex-wrap items-baseline gap-x-3 text-left" onClick={() => setOpen(open === g.reference ? "" : g.reference)} aria-expanded={open === g.reference}>
            <span className="font-semibold text-ink">{formatNaira(g.giftKobo)}</span>
            <span className="text-sm text-ink">{g.communityName} · {g.fund}</span>
            {g.status === "refunded" && <span className="text-xs font-semibold text-crimson">Refunded</span>}
            <span className="ml-auto text-xs text-slate">{new Date(g.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" })} · Receipt</span>
          </button>
          {open === g.reference && (
            <dl className="mt-3 space-y-1 border-t border-rule pt-3 text-sm">
              <Row k="Community" v={<Link href={`/c/${g.cid}`} className="underline">{g.communityName}</Link>} />
              <Row k="Fund" v={g.fund} />
              <Row k="Gift" v={formatNaira(g.giftKobo)} />
              {g.cardChargeKobo > 0 && <Row k="Card charge (Paystack)" v={formatNaira(g.cardChargeKobo)} />}
              <Row k="Charge" v={formatNaira(g.bandKobo)} />
              <Row k="You paid" v={`${formatNaira(g.paidKobo)}${g.payWith === "wallet" ? " from your wallet" : ""}`} />
              <Row k={`${g.communityName} received`} v={`${formatNaira(g.netKobo)}${g.covered ? " (you covered the charges)" : ""}`} />
              {g.note && <Row k="Note" v={g.note} />}
              {g.anonymous && <Row k="Anonymous" v="The admins don't see your name" />}
              <Row k="Date" v={new Date(g.createdAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })} />
              <Row k="Receipt number" v={<span className="font-mono text-xs">{g.reference}</span>} />
              <button className="mt-2 text-xs text-crimson underline" onClick={() => window.print()}>Print</button>
            </dl>
          )}
        </li>
      ))}</ul>
    </div>
  );
}
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-4"><dt className="text-slate">{k}</dt><dd className="text-right text-ink">{v}</dd></div>;
