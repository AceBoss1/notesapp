"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUid, AccountTier } from "@/lib/users";
import { startCheckout } from "@/lib/checkout";
import { api } from "@/lib/moments-client";
import DiscountCodeField from "@/components/DiscountCodeField";

// A referred friend's first-month offer (lib/referrals.ts), asked once per page however many plan buttons there are.
let offerAsk: Promise<{ from: string } | null> | null = null;
const referralOffer = () => (offerAsk ??= api<{ offer: { from: string } | null }>("/api/referrals").then((r) => r.offer).catch(() => null));

// Pricing-table button for a paid plan: monthly/yearly toggle + checkout.
export default function UpgradeButton({ tier, label }: { tier: "pro" | "business"; label: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [current, setCurrent] = useState<AccountTier | null>(null);
  const [interval, setInterval] = useState<"monthly" | "annually">("monthly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<{ from: string } | null>(null);
  const [code, setCode] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        if (u) {
          setCurrent((await getUserByUid(u.uid))?.accountTier ?? null);
          setOffer(await referralOffer());
        }
      }),
    []
  );

  if (user === undefined) return null;
  if (!user) {
    return (
      <Link href="/signup" className="btn-primary mt-3 inline-block !px-4 !py-2 text-xs">
        Sign up to get {label}
      </Link>
    );
  }
  if (current === tier) {
    return <p className="mt-3 text-xs font-semibold text-crimson">✓ Your plan</p>;
  }

  async function go() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await startCheckout(user, { kind: "tier", tier, interval, ...(code ? { code } : {}) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start payment.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 max-w-[12rem]">
      <div className="flex overflow-hidden rounded-full border border-rule text-xs">
        {(["monthly", "annually"] as const).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => { setInterval(i); setCode(null); }}
            className={`flex-1 px-3 py-1 ${interval === i ? "bg-crimson text-paper" : "text-paper/80"}`}
          >
            {i === "monthly" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>
      <button onClick={go} disabled={busy} className="btn-primary mt-2 w-full !px-4 !py-2 text-xs disabled:opacity-50">
        {busy ? "Redirecting…" : `Get ${label}`}
      </button>
      <DiscountCodeField key={interval} target="plan" subtotalKobo={0} plan={{ tier, interval }} onDark autoPick={!offer} onChange={(c) => setCode(c?.code ?? null)} className="mt-2 text-xs" />
      {offer && !code && (
        <p className="mt-1 text-[11px] font-normal opacity-90">
          Invited by @{offer.from}: {interval === "monthly" ? "your first month is free (a ₦100 card check, given back)" : "one month off your first year"}.
        </p>
      )}
      {error && <p className="mt-1 text-[11px] font-normal text-crimson">{error}</p>}
    </div>
  );
}
