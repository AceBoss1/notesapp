"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  onAuthStateChanged,
  User,
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
  updatePassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUid, UserProfile } from "@/lib/users";

const input = "mt-2 w-full border border-rule bg-card px-4 py-3 font-body focus:border-gold outline-none";
const btn = "bg-ink text-paper px-5 py-2 font-ui text-sm font-semibold hover:bg-crimson-deep transition-colors disabled:opacity-50";

function authMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || "";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "Current password is incorrect.";
  if (code.includes("email-already-in-use")) return "That email is already used by another account.";
  if (code.includes("invalid-email")) return "That email address isn't valid.";
  if (code.includes("weak-password")) return "New password must be at least 6 characters.";
  if (code.includes("too-many-requests")) return "Too many attempts — wait a few minutes and try again.";
  if (code.includes("requires-recent-login")) return "Please sign out and back in, then try again.";
  return err instanceof Error ? err.message : "Something went wrong.";
}

type Msg = { ok: boolean; text: string } | null;

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);

  const [username, setUsername] = useState("");
  const [usernameMsg, setUsernameMsg] = useState<Msg>(null);
  const [emailPw, setEmailPw] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<Msg>(null);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState("");

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        if (!u) {
          router.replace("/login");
          return;
        }
        setUser(u);
        const p = await getUserByUid(u.uid);
        setProfile(p);
        setUsername(p?.username ?? "");
        setReady(true);
      }),
    [router]
  );

  async function reauth(password: string) {
    if (!user?.email) throw new Error("No email on this account.");
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  }

  async function changeUsername(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy("username");
    setUsernameMsg(null);
    try {
      const res = await fetch("/api/account/username", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't change username.");
      setProfile((p) => (p ? { ...p, username: data.username } : p));
      setUsername(data.username);
      setUsernameMsg({ ok: true, text: `Done — you're now @${data.username}. Your old links keep working.` });
    } catch (err) {
      setUsernameMsg({ ok: false, text: err instanceof Error ? err.message : "Failed." });
    } finally {
      setBusy("");
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy("email");
    setEmailMsg(null);
    try {
      await reauth(emailPw);
      await verifyBeforeUpdateEmail(user, newEmail.trim());
      setEmailPw("");
      setEmailMsg({ ok: true, text: `We sent a confirmation link to ${newEmail.trim()}. Your email changes once you click it; until then keep using ${user.email}.` });
      setNewEmail("");
    } catch (err) {
      setEmailMsg({ ok: false, text: authMessage(err) });
    } finally {
      setBusy("");
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy("pw");
    setPwMsg(null);
    try {
      await reauth(curPw);
      await updatePassword(user, newPw);
      setCurPw("");
      setNewPw("");
      setPwMsg({ ok: true, text: "Password updated." });
    } catch (err) {
      setPwMsg({ ok: false, text: authMessage(err) });
    } finally {
      setBusy("");
    }
  }

  if (!ready || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;

  const note = (m: Msg) => m && <p className={`mt-3 text-sm ${m.ok ? "text-green-700" : "text-crimson"}`}>{m.text}</p>;

  return (
    <section className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-14">
      <p className="eyebrow">{profile ? `@${profile.username}` : "Account"}</p>
      <h1 className="font-display text-4xl mt-3">Account settings</h1>
      <p className="mt-2 text-sm text-slate">
        Name, bio and photo are on <Link href="/profile/edit" className="text-crimson">Edit profile</Link>.
      </p>

      <form onSubmit={changeUsername} className="card mt-8 p-6">
        <h2 className="font-display text-xl">Username</h2>
        <p className="mt-1 text-sm text-slate">
          Your profile lives at notesapp.name.ng/u/{profile?.username}. You can change it once every 30 days; your old
          link keeps redirecting to you and the old name stays reserved.
        </p>
        <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24))} className={input} aria-label="Username" />
        <button className={`${btn} mt-4`} disabled={busy === "username" || !username || username === profile?.username}>
          {busy === "username" ? "Saving…" : "Change username"}
        </button>
        {note(usernameMsg)}
      </form>

      <form onSubmit={changeEmail} className="card mt-6 p-6">
        <h2 className="font-display text-xl">Email</h2>
        <p className="mt-1 text-sm text-slate">
          Current: <span className="font-mono">{user.email}</span>. We email a confirmation link to the new address
          before switching. Your email is never shown publicly.
        </p>
        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="New email address" className={input} required />
        <input type="password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} placeholder="Current password" className={input} required autoComplete="current-password" />
        <button className={`${btn} mt-4`} disabled={busy === "email"}>{busy === "email" ? "Sending…" : "Send confirmation link"}</button>
        {note(emailMsg)}
      </form>

      <form onSubmit={changePassword} className="card mt-6 p-6">
        <h2 className="font-display text-xl">Password</h2>
        <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="Current password" className={input} required autoComplete="current-password" />
        <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password (6+ characters)" className={input} required minLength={6} autoComplete="new-password" />
        <button className={`${btn} mt-4`} disabled={busy === "pw"}>{busy === "pw" ? "Saving…" : "Change password"}</button>
        {note(pwMsg)}
        <p className="mt-3 text-xs text-slate">Forgot it? <Link href="/forgot-password" className="text-crimson">Reset by email</Link>.</p>
      </form>
    </section>
  );
}
