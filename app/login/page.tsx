"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ensureAdminProfile } from "@/lib/users";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await ensureAdminProfile(cred.user); // no-op for regular readers
      router.push("/");
    } catch (err) {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-sm px-4 py-24">
      <p className="eyebrow">Welcome Back</p>
      <h1 className="font-display text-3xl mt-3">Sign in</h1>
      <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
        <label className="block">
          <span className="eyebrow">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full border border-rule bg-card px-4 py-3 font-body focus:border-crimson outline-none"
          />
        </label>
        <label className="block">
          <span className="eyebrow">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full border border-rule bg-card px-4 py-3 font-body focus:border-crimson outline-none"
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-crimson text-paper font-ui font-semibold px-6 py-3 hover:bg-crimson-deep hover:text-paper transition-colors disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate">
        New here?{" "}
        <a href="/signup" className="text-crimson-bright font-semibold">
          Create an account
        </a>
      </p>
    </section>
  );
}
