"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getUserByUid, hasVerifiedBadge, UserProfile } from "@/lib/users";
import { BADGE_PRICE_KOBO, badgeIncluded } from "@/lib/tiers";
import { formatNaira } from "@/lib/booking-time";
import { startCheckout } from "@/lib/checkout";
import VerifiedBadge from "@/components/VerifiedBadge";

// Verified-badge status + buy/cancel. Free on Business/Enterprise,
// ₦999/month add-on for everyone else. `pitch` = the pricing-page variant.
export default function BadgeCard({ pitch = false }: { pitch?: boolean }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sub, setSub] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        if (!u) return;
        setProfile(await getUserByUid(u.uid));
        getDoc(doc(db, "badgeSubscriptions", u.uid)).then((s) => setSub(s.exists() ? s.data() : null)).catch(() => {});
      }),
    []
  );

  if (user === undefined) return null;

  async function buy() {
    if (!user) return;
    setBusy(true);
    setMsg(null);
    try {
      await startCheckout(user, { kind: "badge" });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't start payment.");
      setBusy(false);
    }
  }

  async function cancel() {
    if (!user || !confirm("Stop auto-renewal? You keep the badge until the end of the period you've paid for.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/billing/cancel-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ which: "badge" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't cancel");
      setSub((s) => (s ? { ...s, status: "cancelled" } : s));
      setMsg(`Auto-renewal stopped. You keep the badge until ${String(json.accessUntil).slice(0, 10)}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't cancel");
    } finally {
      setBusy(false);
    }
  }

  const included = profile ? badgeIncluded(profile.accountTier) || ["admin", "staff", "volunteer"].includes(profile.role) : false;
  const active = !!sub && sub.status !== "expired" && new Date(sub.currentPeriodEnd).getTime() > Date.now();

  let body: React.ReactNode;
  if (!user) {
    body = <p className="mt-2 text-sm text-slate">Sign in to add the badge to your account.</p>;
  } else if (included) {
    body = <p className="mt-2 text-sm text-slate">Included free with your account — it shows next to your name.</p>;
  } else if (active) {
    body = (
      <>
        <p className="mt-2 text-sm text-slate">
          Active · {sub!.status === "active" ? `renews around ${String(sub!.currentPeriodEnd).slice(0, 10)}` : `ends ${String(sub!.currentPeriodEnd).slice(0, 10)} (auto-renewal off)`}
        </p>
        {sub!.status === "active" && (
          <button onClick={cancel} disabled={busy} className="mt-3 rounded-full border border-rule px-4 py-1.5 text-xs hover:border-crimson hover:text-crimson disabled:opacity-40">
            {busy ? "Working…" : "Cancel auto-renewal"}
          </button>
        )}
      </>
    );
  } else {
    body = (
      <button onClick={buy} disabled={busy || !profile} className="btn-primary mt-3 !px-5 !py-2 text-xs disabled:opacity-50">
        {busy ? "Redirecting…" : `Add the badge · ${formatNaira(BADGE_PRICE_KOBO)}/month`}
      </button>
    );
  }

  return (
    <div className="card p-6">
      <p className="eyebrow flex items-center gap-2">
        <VerifiedBadge size={14} /> Verified badge
      </p>
      {pitch && (
        <p className="mt-2 text-sm text-slate">
          Show the ✔ next to your name on your profile, posts and in search. <strong className="text-ink">Free on Business and Enterprise</strong>;
          Free Standard, Free Basic and Pro can add it for {formatNaira(BADGE_PRICE_KOBO)}/month — cancel any time.
        </p>
      )}
      {profile && hasVerifiedBadge(profile) && !pitch && <p className="mt-2 text-xs text-slate">Your badge is showing now.</p>}
      {body}
      {msg && <p className="mt-2 text-xs text-slate">{msg}</p>}
      <p className="mt-3 text-[11px] text-slate">
        The badge shows an account in good standing with an active plan or subscription; it is not an identity check or an endorsement.
      </p>
    </div>
  );
}
