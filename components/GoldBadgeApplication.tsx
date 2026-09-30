"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUid, UserProfile } from "@/lib/users";
import { getBadgeRequest, BadgeRequest } from "@/lib/moderation";
import { GOLD_KIND_LIVE, GOLD_KIND_LABEL } from "@/lib/badges";
import { GOLD_PRICING, GoldTrack } from "@/lib/gold";
import { formatNaira } from "@/lib/booking-time";
import { startCheckout } from "@/lib/checkout";

// Gold badge (/badges): apply → (identity: pay deposit) → admin review →
// approved → subscribe. Same prices on every plan tier. Text only — no ID uploads.
export default function GoldBadgeApplication() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [request, setRequest] = useState<BadgeRequest | null>(null);
  const [track, setTrack] = useState<GoldTrack>("personal");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh(u: User) {
    setProfile(await getUserByUid(u.uid));
    setRequest(await getBadgeRequest(u.uid));
  }
  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); if (u) refresh(u); }), []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const res = await fetch("/api/badge-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user!.getIdToken()}` },
        body: JSON.stringify({ message, kind: "endorsement", track }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't submit");
      setMessage("");
      await refresh(user!);
    });
  };

  const price = GOLD_PRICING[request?.track ?? track];
  let body;
  if (user === undefined) return null;
  if (!user) {
    body = <p className="mt-2 text-sm text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to apply.</p>;
  } else if (request?.status === "active" || (profile?.goldBadge && !request)) {
    body = (
      <div className="mt-2 text-sm text-ink">
        <p>Your gold badge is active and renews monthly.</p>
        <button
          disabled={busy}
          onClick={() => confirm("Stop renewing? You keep the badge until the paid period ends.") && run(async () => {
            const res = await fetch("/api/billing/cancel-tier", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
              body: JSON.stringify({ which: "gold" }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Couldn't cancel");
            await refresh(user);
          })}
          className="mt-2 text-xs text-crimson underline"
        >
          Cancel renewal
        </button>
      </div>
    );
  } else if (request?.status === "pending") {
    body = <p className="mt-2 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-ink">Your application is waiting for review.</p>;
  } else if (request?.status === "approved") {
    body = (
      <div className="mt-2">
        <p className="text-sm text-ink">Approved — {GOLD_KIND_LABEL[request.kind ?? "endorsement"]}. Subscribe to switch the gold badge on.</p>
        <button disabled={busy} onClick={() => run(() => startCheckout(user, { kind: "gold" }))} className="btn-primary mt-3 !px-4 !py-2 text-xs">
          {busy ? "Starting…" : `Subscribe — ${formatNaira(price.monthlyKobo)}/month`}
        </button>
      </div>
    );
  } else if (request?.status === "awaiting_deposit") {
    body = (
      <div className="mt-2">
        <p className="text-sm text-ink">
          Pay the {formatNaira(price.identityDepositKobo)} identity-check deposit to start review. It covers the third-party check and is
          <strong> non-refundable</strong>, whether or not the check passes.
        </p>
        <button disabled={busy} onClick={() => run(() => startCheckout(user, { kind: "gold_deposit" }))} className="btn-primary mt-3 !px-4 !py-2 text-xs">
          {busy ? "Starting…" : `Pay ${formatNaira(price.identityDepositKobo)} deposit`}
        </button>
      </div>
    );
  } else {
    body = (
      <form onSubmit={apply} className="mt-3">
        {request?.status === "rejected" && <p className="mb-2 text-sm text-slate">Your last application wasn&apos;t approved. You can apply again with more detail.</p>}
        <div className="flex flex-wrap gap-4 text-sm">
          {(Object.keys(GOLD_PRICING) as GoldTrack[]).map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input type="radio" name="track" checked={track === t} onChange={() => setTrack(t)} />
              {GOLD_PRICING[t].label} — {formatNaira(GOLD_PRICING[t].monthlyKobo)}/month
            </label>
          ))}
        </div>
        <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={800} required
          placeholder="Who you are (or your organisation), what you publish, and links that back it up (website, LinkedIn, published work)."
          className="mt-3 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-gold" />
        <button disabled={busy} className="btn-primary mt-3 !px-4 !py-2 text-xs">{busy ? "Sending…" : "Apply for endorsement"}</button>
        <p className="mt-2 text-[11px] text-slate">
          No fee to apply or to be reviewed. If approved, the badge costs {formatNaira(GOLD_PRICING[track].monthlyKobo)}/month on any plan.
          Please don&apos;t send ID documents — we don&apos;t collect them.
          {!GOLD_KIND_LIVE.identity && " Identity-checked gold (with a one-off verification deposit) is coming soon."}
        </p>
      </form>
    );
  }
  return (
    <div className="card mt-6 p-6">
      <p className="font-ui text-sm font-bold text-ink">Gold badge</p>
      {body}
      {error && <p className="mt-2 text-sm text-crimson">{error}</p>}
    </div>
  );
}
