"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { signUpProfile, isUsernameTaken, getAllUsers, UserProfile } from "@/lib/users";
import { followJournal } from "@/lib/follows";
import { MANDATORY_JOURNALS, MANDATORY_USERNAMES, isReservedUsername } from "@/lib/journals-directory";
import Avatar from "@/components/Avatar";

const OPTIONAL_REQUIRED = 2; // "2 more of their choice" — total target is 3 mandatory + 2 = 5

function normalizeUsername(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

export default function SignupPage() {
  const [step, setStep] = useState<"account" | "follow">("account");

  // Step 1 — account
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Step 2 — follow onboarding
  const [newUser, setNewUser] = useState<User | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [candidates, setCandidates] = useState<UserProfile[] | null>(null);
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [finishing, setFinishing] = useState(false);
  const [mandatoryWritten, setMandatoryWritten] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleanUsername = normalizeUsername(username);
    if (cleanUsername.length < 3) {
      setError("Username must be at least 3 characters (letters, numbers, _).");
      return;
    }
    if (isReservedUsername(cleanUsername)) {
      // Matches firestore.rules' usernames/{username} create rule
      // exactly — this is a friendlier client-side message for the
      // same restriction, not a separate rule of its own.
      setError('Usernames can\'t contain "notesapp" — that\'s reserved for the platform.');
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
      setNewUser(cred.user);
      setNewUsername(cleanUsername);
      setStep("follow");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setLoading(false);
    }
  }

  // The 3 mandatory journals — @NotesApp + both founders — are written
  // the moment step 2 opens, not left for the member to opt into.
  // Free-tier members can't unfollow these (lib/follows.ts + rules
  // enforce it), which is why there's no checkbox for them below.
  useEffect(() => {
    if (step !== "follow" || !newUser || mandatoryWritten) return;
    Promise.all(
      MANDATORY_JOURNALS.map((j) => followJournal(newUser.uid, j.username, true))
    ).then(() => setMandatoryWritten(true));
  }, [step, newUser, mandatoryWritten]);

  useEffect(() => {
    if (step !== "follow") return;
    getAllUsers()
      .then((all) =>
        setCandidates(
          all.filter(
            (u) => u.uid !== newUser?.uid && !MANDATORY_USERNAMES.includes(u.username)
          )
        )
      )
      .catch(() => setCandidates([]));
  }, [step, newUser]);

  const filtered = useMemo(() => {
    if (!candidates) return [];
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (u) => u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
    );
  }, [candidates, search]);

  const optionalTarget = Math.min(OPTIONAL_REQUIRED, candidates?.length ?? 0);
  const canContinue = mandatoryWritten && chosen.size >= optionalTarget;

  function toggle(username: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(username)) {
        next.delete(username);
      } else if (next.size < OPTIONAL_REQUIRED) {
        next.add(username);
      }
      return next;
    });
  }

  async function handleFinish() {
    if (!newUser) return;
    setFinishing(true);
    try {
      await Promise.all(
        [...chosen].map((username) => followJournal(newUser.uid, username, false))
      );
      router.push(`/u/${newUsername}`);
    } finally {
      setFinishing(false);
    }
  }

  if (step === "follow") {
    const totalFollowing = 3 + chosen.size;
    return (
      <section className="mx-auto max-w-xl px-4 py-20">
        <p className="eyebrow">Almost there</p>
        <h1 className="font-display text-3xl mt-3">Follow 5 journals to continue</h1>
        <p className="mt-2 text-sm text-slate">
          You're following {totalFollowing} of 5. Your feed starts with
          the official #NotesApp journal and both founders — every new
          member does.
        </p>

        <div className="mt-6 grid gap-3">
          {MANDATORY_JOURNALS.map((j) => (
            <div key={j.username} className="card flex items-center gap-3 p-4">
              <Avatar src={j.avatar} alt={j.displayName} size={40} />
              <div className="flex-1">
                <p className="font-ui text-sm font-semibold text-ink">{j.displayName}</p>
                <p className="font-mono text-xs text-slate">@{j.username}</p>
              </div>
              <span className="rounded-full bg-crimson/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wideish text-crimson-bright">
                ✓ Auto-followed
              </span>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <p className="eyebrow">
            Choose {optionalTarget} more{optionalTarget < OPTIONAL_REQUIRED ? " (that's everyone else here so far)" : ""}
          </p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search journals by name or @username"
            className="mt-3 w-full border border-rule bg-card px-4 py-3 font-body focus:border-crimson outline-none"
          />

          {candidates === null ? (
            <p className="mt-6 text-sm text-slate">Loading…</p>
          ) : candidates.length === 0 ? (
            <p className="mt-6 text-sm text-slate">
              No other journals to follow yet — more professionals are
              joining soon. You can continue with just the 3 above.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {filtered.map((u) => {
                const isChosen = chosen.has(u.username);
                const disabled = !isChosen && chosen.size >= OPTIONAL_REQUIRED;
                return (
                  <button
                    key={u.uid}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(u.username)}
                    className={`card flex items-center gap-3 p-4 text-left transition-colors disabled:opacity-40 ${
                      isChosen ? "border-crimson bg-crimson/5" : "hover:border-crimson"
                    }`}
                  >
                    <Avatar src={u.avatar} alt={u.displayName} size={40} />
                    <div className="flex-1">
                      <p className="font-ui text-sm font-semibold text-ink">{u.displayName}</p>
                      <p className="font-mono text-xs text-slate">@{u.username}</p>
                    </div>
                    <span
                      className={`font-ui text-xs font-semibold ${
                        isChosen ? "text-crimson-bright" : "text-slate"
                      }`}
                    >
                      {isChosen ? "✓ Following" : "Follow"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={handleFinish}
          disabled={!canContinue || finishing}
          className="btn-primary mt-10 w-full disabled:opacity-40"
        >
          {finishing ? "Setting up your feed…" : "Continue"}
        </button>
      </section>
    );
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
          className="bg-crimson text-paper font-ui font-semibold px-6 py-3 hover:bg-crimson-bright transition-colors disabled:opacity-50"
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
