"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { passkeysSupported, signInWithPasskey } from "@/lib/passkeys-client";

// "Sign in with a passkey": the device's fingerprint, face, screen lock or security key instead of a password (lib/passkeys.ts).
// Shown only where the browser supports passkeys. `onSignedIn` carries on as a password sign-in would.
export default function PasskeySignIn({ onSignedIn, className = "" }: { onSignedIn: (u: User) => Promise<void> | void; className?: string }) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setOk(passkeysSupported()), []);
  if (!ok) return null;
  async function go() {
    setBusy(true); setError("");
    try { await onSignedIn(await signInWithPasskey()); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't sign in with a passkey"); }
    finally { setBusy(false); }
  }
  return (
    <div className={className}>
      <div className="flex items-center gap-3 text-xs text-slate" aria-hidden="true"><span className="h-px flex-1 bg-rule" />or<span className="h-px flex-1 bg-rule" /></div>
      <button type="button" onClick={go} disabled={busy}
        className="mt-4 w-full rounded-full border border-rule bg-card px-6 py-3 font-ui font-semibold text-ink hover:border-crimson disabled:opacity-50">
        {busy ? "Waiting for your device…" : "Sign in with a passkey"}
      </button>
      <p className="mt-2 text-xs text-slate">Use your fingerprint, face, screen lock or security key. Add a passkey in Account settings after you sign in.</p>
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}
