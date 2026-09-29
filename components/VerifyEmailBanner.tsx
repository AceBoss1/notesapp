"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, sendEmailVerification, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

// Shown site-wide to signed-in accounts whose email isn't verified.
// Payments are blocked server-side until it is (app/api/paystack/
// initialize), so this is where people find out why and fix it.
export default function VerifyEmailBanner() {
  const [user, setUser] = useState<User | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!user || user.emailVerified) return null;

  async function resend() {
    if (!user) return;
    setBusy(true);
    setMsg("");
    try {
      await sendEmailVerification(user);
      setMsg(`Verification link sent to ${user.email}.`);
      setCooldown(60);
    } catch (err) {
      const code = (err as { code?: string }).code;
      setMsg(code === "auth/too-many-requests" ? "Please wait a few minutes before requesting another email." : "Couldn't send the email. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (!user) return;
    setBusy(true);
    await user.reload();
    await user.getIdToken(true); // server reads email_verified from the token
    setBusy(false);
    if (user.emailVerified) {
      setUser(null);
      window.location.reload();
    } else {
      setMsg("Not verified yet — open the link in your email first.");
    }
  }

  return (
    <div className="border-b border-rule bg-amber-50 px-4 py-2 text-center text-xs text-ink">
      <span>Verify your email to pay for sessions and subscriptions. </span>
      <button onClick={resend} disabled={busy || cooldown > 0} className="font-semibold text-crimson underline disabled:opacity-50">
        {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
      </button>
      <span> · </span>
      <button onClick={check} disabled={busy} className="font-semibold text-crimson underline disabled:opacity-50">
        I've verified
      </button>
      {msg && <span className="ml-2 text-slate">{msg}</span>}
    </div>
  );
}
