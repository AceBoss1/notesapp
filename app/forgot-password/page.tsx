"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/user-not-found") {
        // Same message as success — don't reveal which emails have accounts.
        setSent(true);
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else if (code === "auth/invalid-email") {
        setError("That doesn't look like a valid email address.");
      } else {
        setError("Couldn't send the reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-sm px-4 py-24">
      <p className="eyebrow">Account</p>
      <h1 className="mt-3 font-display text-3xl">Reset your password</h1>
      {sent ? (
        <div className="mt-8 text-sm text-slate">
          <p>
            If an account exists for <span className="text-ink">{email}</span>, a reset link is on its way. Check your
            spam folder too — the link expires after an hour.
          </p>
          <Link href="/login" className="mt-6 inline-block font-semibold text-crimson-bright">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
          <label className="block">
            <span className="eyebrow">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full border border-rule bg-card px-4 py-3 font-body outline-none focus:border-crimson"
            />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-crimson px-6 py-3 font-ui font-semibold text-paper transition-colors hover:bg-crimson-deep disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
          <Link href="/login" className="text-sm text-slate">
            ← Back to sign in
          </Link>
        </form>
      )}
    </section>
  );
}
