"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmailAuthProvider, reauthenticateWithCredential, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

// "Your data" on /profile/account: download a copy, or delete the account (Nigeria Data Protection Act rights).
export default function AccountData({ user, username }: { user: User; username: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [blockers, setBlockers] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");

  async function download() {
    setBusy("export");
    setMsg("");
    try {
      const res = await fetch("/api/account/export", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't prepare your data.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `notesapp-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't prepare your data.");
    } finally {
      setBusy("");
    }
  }

  async function startDelete() {
    setBusy("check");
    setMsg("");
    try {
      const res = await fetch("/api/account/delete", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't check your account.");
      setBlockers(j.blockers);
      setOpen(j.blockers.length === 0);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't check your account.");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    setBusy("delete");
    setMsg("");
    try {
      if (!user.email) throw new Error("This account has no email to re-confirm with.");
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken(true)}` },
        body: JSON.stringify({ confirm }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.blockers) setBlockers(j.blockers);
        throw new Error(j.error || "Couldn't delete the account.");
      }
      await signOut(auth).catch(() => {});
      router.replace("/?deleted=1");
    } catch (e) {
      const code = (e as { code?: string })?.code || "";
      setMsg(code.includes("wrong-password") || code.includes("invalid-credential") ? "That password isn't right." : e instanceof Error ? e.message : "Couldn't delete the account.");
      setBusy("");
    }
  }

  return (
    <div className="mt-12 border-t border-rule pt-8">
      <h2 className="font-display text-2xl">Your data</h2>
      <p className="mt-2 max-w-xl text-sm text-slate">
        You can download a copy of what we hold about you, or delete your account. Deleting removes your profile, posts, comments, store items, follows and notifications.
        Payment, payout and order records are kept without your personal details, because tax and dispute rules require it. See the <a href="/privacy" className="text-crimson underline">Privacy Policy</a>.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={download} disabled={!!busy} className="rounded-full border border-rule px-4 py-2 text-xs font-semibold hover:border-crimson hover:text-crimson disabled:opacity-50">{busy === "export" ? "Preparing…" : "Download my data (JSON)"}</button>
        {!open && <button onClick={startDelete} disabled={!!busy} className="rounded-full border border-rule px-4 py-2 text-xs font-semibold text-crimson hover:border-crimson disabled:opacity-50">{busy === "check" ? "Checking…" : "Delete my account"}</button>}
      </div>
      {blockers && blockers.length > 0 && (
        <div className="mt-4 border border-amber-200 bg-amber-50 p-4 text-sm text-ink">
          <p className="font-semibold">You can&apos;t delete your account yet:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
      )}
      {open && (
        <div className="mt-4 max-w-md space-y-3 border border-rule p-4 text-sm">
          <p className="font-semibold text-crimson">This can&apos;t be undone.</p>
          <label className="block text-xs text-slate">Type your username (<span className="font-mono">{username}</span>) to confirm
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full border border-rule bg-card px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs text-slate">Your password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full border border-rule bg-card px-3 py-2 text-sm" autoComplete="current-password" />
          </label>
          <div className="flex gap-3">
            <button onClick={remove} disabled={!!busy || confirm.trim().toLowerCase() !== username.toLowerCase() || !password} className="rounded-full bg-crimson px-4 py-2 text-xs font-semibold text-paper disabled:opacity-50">{busy === "delete" ? "Deleting…" : "Delete my account for good"}</button>
            <button onClick={() => { setOpen(false); setBlockers(null); }} className="text-xs text-slate">Cancel</button>
          </div>
        </div>
      )}
      {msg && <p className="mt-3 text-sm text-crimson">{msg}</p>}
    </div>
  );
}
