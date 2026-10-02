"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, reload, sendEmailVerification, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUid, UserProfile } from "@/lib/users";
import { CAC_SEARCH_URL, ORG_SEATS, ORG_TRIAL_DAYS, isOrganisation } from "@/lib/org";

const field = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";

async function call(user: User, body: unknown) {
  const res = await fetch("/api/org", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken(true)}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Something went wrong.");
  return json;
}

function Step({ done, title, children }: { done: boolean; title: string; children?: React.ReactNode }) {
  return (
    <li className="card p-4">
      <p className="font-ui text-sm font-bold text-ink"><span className={done ? "text-crimson" : "text-slate"}>{done ? "✓" : "○"}</span> {title}</p>
      {children && <div className="mt-1 text-sm text-slate">{children}</div>}
    </li>
  );
}

export default function OrganisationPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [rc, setRc] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function refresh(u: User) {
    await reload(u).catch(() => {});
    setProfile(await getUserByUid(u.uid));
  }
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (!u) return router.replace("/login");
        setUser(u);
        refresh(u);
      }),
    [router]
  );

  async function run(body: unknown, ok: string) {
    if (!user) return;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const r = await call(user, body);
      setMsg(r.pending ? "Sent — an admin will review your request to convert this account." : ok);
      await refresh(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (profile === undefined || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (!profile) return <div className="px-6 py-24 text-center text-slate">Profile not found.</div>;

  const org = profile.org;
  const trialActive = !!profile.trialUntil && new Date(profile.trialUntil).getTime() > Date.now();
  const paid = ["business", "enterprise"].includes(profile.accountTier);

  if (!isOrganisation(profile)) {
    return (
      <section className="mx-auto max-w-xl px-4 py-14 sm:px-6">
        <span className="eyebrow">Organisation</span>
        <h1 className="mt-3 font-display text-3xl text-ink">Set up an organisation account</h1>
        <p className="mt-2 text-sm text-slate">
          For companies, NGOs, churches, schools and clubs. New organisation accounts get {ORG_TRIAL_DAYS} days of Business free.{" "}
          <Link href="/organisations" className="text-crimson underline">How it works</Link>. If this account is more than a day old, an admin approves the conversion first.
        </p>
        <label className="mt-6 block text-xs text-slate">CAC registration number
          <input value={rc} onChange={(e) => setRc(e.target.value)} placeholder="RC1234567" className={`${field} font-mono`} />
        </label>
        {error && <p className="mt-3 text-sm text-crimson">{error}</p>}
        {msg && <p className="mt-3 text-sm text-ink">{msg}</p>}
        <button disabled={busy || !rc.trim()} onClick={() => run({ action: "register", rcNumber: rc }, "Done — this is now an organisation account.")} className="btn-primary mt-4">
          {busy ? "Please wait…" : "Make this an organisation"}
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <span className="eyebrow">Organisation</span>
      <h1 className="mt-3 font-display text-3xl text-ink">{profile.displayName}</h1>
      <p className="mt-1 text-sm text-slate">
        Registration {org?.rcNumber} ·{" "}
        {org?.rcStatus === "verified" ? "confirmed by #NotesApp" : org?.rcStatus === "rejected" ? "not confirmed" : "waiting for #NotesApp to confirm"}
      </p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {msg && <p className="mt-4 text-sm text-ink">{msg}</p>}

      <ol className="mt-6 space-y-3">
        <Step done title="Organisation account created">Your channel is at <Link href={`/u/${profile.username}`} className="text-crimson underline">/u/{profile.username}</Link>.</Step>
        <Step done={user.emailVerified} title="Verify your work email">
          {!user.emailVerified && (
            <>
              Open the link we emailed you, then{" "}
              <button onClick={() => refresh(user)} className="text-crimson underline">I&apos;ve verified it</button>
              {" · "}
              <button onClick={() => sendEmailVerification(user).then(() => setMsg("Verification email sent.")).catch(() => setError("Couldn't send it just now."))} className="text-crimson underline">resend</button>
            </>
          )}
        </Step>
        <Step done={trialActive || paid || !!profile.trialUsedAt} title={`Start your free ${ORG_TRIAL_DAYS}-day Business trial`}>
          {trialActive ? (
            <>Running until {new Date(profile.trialUntil!).toDateString()}. <Link href="/pricing" className="text-crimson underline">Keep Business after the trial</Link></>
          ) : paid ? (
            <>You&apos;re on {profile.accountTier === "enterprise" ? "Enterprise" : "Business"}.</>
          ) : (
            <button disabled={busy || !user.emailVerified} onClick={() => run({ action: "start_trial" }, "Your free trial has started.")} className="btn-primary !px-4 !py-2 text-xs">
              {user.emailVerified ? "Start free trial" : "Verify your email first"}
            </button>
          )}
        </Step>
        <Step done={org?.rcStatus === "verified"} title="We confirm your registration">
          {org?.rcStatus === "verified" && <>Confirmed. Your maroon ✔ shows once you&apos;re on a plan that includes it (Business or Enterprise).</>}
          {org?.rcStatus === "unverified" && (
            <>An admin checks your number on the <a href={CAC_SEARCH_URL} target="_blank" rel="noopener noreferrer" className="text-crimson underline">CAC register</a>. Until then you can publish, but your channel and posts show an &ldquo;unverified organisation&rdquo; notice.</>
          )}
          {org?.rcStatus === "rejected" && (
            <>
              <span className="text-crimson">{org.rcNote || "We couldn't confirm that number."}</span> Send a corrected number:
              <span className="mt-2 flex gap-2">
                <input value={rc} onChange={(e) => setRc(e.target.value)} placeholder="RC1234567" className={`${field} mt-0 max-w-[12rem] font-mono`} />
                <button disabled={busy || !rc.trim()} onClick={() => run({ action: "resubmit", rcNumber: rc }, "Sent for review.")} className="btn-primary !px-4 !py-2 text-xs">Resubmit</button>
              </span>
            </>
          )}
        </Step>
        <Step done={false} title="Set up your channel">
          Add your logo, description and website. <Link href="/profile/edit" className="text-crimson underline">Edit profile</Link>
        </Step>
        <Step done={!!profile.goldBadge} title="Optional: gold badge (Corporate track)">
          Endorsed or identity-checked by #NotesApp. <Link href="/badges" className="text-crimson underline">Apply</Link>
        </Step>
        <Step done={false} title="Invite your team">
          Seats: {ORG_SEATS[profile.accountTier] ?? "agreed with us"} on your plan. Team invitations are coming next.
        </Step>
      </ol>
    </section>
  );
}
