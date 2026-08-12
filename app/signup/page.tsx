"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { signUpProfile, isUsernameTaken } from "@/lib/users";

function normalizeUsername(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleanUsername = normalizeUsername(username);
    if (cleanUsername.length < 3) {
      setError("Username must be at least 3 characters (letters, numbers, _).");
      return;
    }

    setLoading(true);
    try {
      if (await isUsernameTaken(cleanUsername)) {
        setError("That username is already taken.");
        setLoading(false);
        return;
      }
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await signUpProfile({
        uid: cred.user.uid,
        email,
        username: cleanUsername,
        displayName: displayName || cleanUsername,
      });
      router.push(`/u/${cleanUsername}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-sm px-4 py-24">
      <p className="eyebrow">Join #NotesApp</p>
      <h1 className="font-display text-3xl mt-3">Create your account</h1>
      <p className="mt-2 text-sm text-slate">
        Comment on journals, like your favorites, and get your own
        @username — the same account works on Precheks too.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
        <label className="block">
          <span className="eyebrow">Display Name</span>
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-2 w-full border border-rule bg-card px-4 py-3 font-body focus:border-crimson outline-none"
          />
        </label>
        <label className="block">
          <span className="eyebrow">Username</span>
          <div className="mt-2 flex items-center border border-rule bg-card focus-within:border-crimson">
            <span className="pl-4 text-slate font-mono">@</span>
            <input
              required
              value={username}
              onChange={(e) => setUsername(normalizeUsername(e.target.value))}
              className="w-full px-2 py-3 font-mono outline-none bg-transparent"
            />
          </div>
        </label>
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
            minLength={6}
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
          {loading ? "Creating account…" : "Sign Up"}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate">
        Already have an account?{" "}
        <a href="/login" className="text-crimson-bright font-semibold">
          Sign in
        </a>
      </p>
    </section>
  );
}
