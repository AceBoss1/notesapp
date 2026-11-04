"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { googleRedirectResult, linkGoogle, linkedinReturn, myMethods, startLinkedIn, unlinkMethod } from "@/lib/social-auth-client";
import { canRemove, type MethodsSummary, type SocialProvider } from "@/lib/social-auth";
import { GoogleMark, LinkedInMark } from "@/components/SocialSignIn";

// Account settings → Sign-in methods: which ways into the account are on (password, passkeys, Google, LinkedIn), with Link and
// Unlink for Google and LinkedIn. The last way in can't be removed. Linking emails the account (lib/social-auth-server.ts).
export default function SignInMethods({ user }: { user: User }) {
  const [m, setM] = useState<MethodsSummary | null>(null);
  const [busy, setBusy] = useState<"" | SocialProvider>("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => myMethods(user).then(setM).catch((e) => setMsg({ ok: false, text: e.message })), [user]);

  async function run(which: SocialProvider, f: () => Promise<unknown>, ok?: string) {
    setBusy(which); setMsg(null);
    try { await f(); if (ok) setMsg({ ok: true, text: ok }); await load(); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong" }); }
    finally { setBusy(""); }
  }

  useEffect(() => {
    load();
    // Back from LinkedIn (link mode) or from a Google link by redirect.
    if (/^#li(_error)?=/.test(window.location.hash)) {
      void run("linkedin", async () => {
        const r = await linkedinReturn(user);
        if (r?.kind !== "linked") throw new Error("LinkedIn wasn't linked. Try again.");
      }, "LinkedIn is linked. Next time, Continue with LinkedIn signs you in.");
    } else {
      googleRedirectResult().then((r) => { if (r?.kind === "linked") { setMsg({ ok: true, text: "Google is linked. Next time, Continue with Google signs you in." }); load(); } }).catch((e) => setMsg({ ok: false, text: e.message }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const unlink = (p: SocialProvider, label: string) => {
    if (!confirm(`Unlink ${label}? You won't be able to sign in with it any more (you can link it again later).`)) return;
    void run(p, () => unlinkMethod(user, p), `${label} is unlinked.`);
  };

  const row = (icon: React.ReactNode, title: string, detail: string, action: React.ReactNode) => (
    <li className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rule bg-card">{icon}</span>
        <div className="min-w-0">
          <p className="font-semibold text-ink">{title}</p>
          <p className="truncate text-xs text-slate">{detail}</p>
        </div>
      </div>
      {action}
    </li>
  );
  const on = (t: string) => <span className="rounded-full bg-green-100 px-2 py-0.5 font-ui text-[11px] font-semibold text-green-800">{t}</span>;
  const linkBtn = (p: SocialProvider, label: string, f: () => void) => (
    <button type="button" onClick={f} disabled={!!busy} className="rounded-full bg-crimson px-4 py-1.5 font-ui text-xs font-semibold text-paper disabled:opacity-50">{busy === p ? "Waiting…" : `Link ${label}`}</button>
  );
  const unlinkBtn = (p: SocialProvider, label: string) => (
    m && canRemove(m, p)
      ? <button type="button" onClick={() => unlink(p, label)} disabled={!!busy} className="rounded-full border border-red-300 px-3 py-1 font-ui text-xs font-semibold text-red-700 disabled:opacity-50">{busy === p ? "Unlinking…" : "Unlink"}</button>
      : <span className="text-xs text-slate" title="Add another way to sign in first">Your only way in</span>
  );

  return (
    <div className="card mt-6 p-6" id="sign-in-methods">
      <h2 className="font-display text-xl">Sign-in methods</h2>
      <p className="mt-1 text-sm text-slate">The ways you can sign in to this account. Link Google or LinkedIn to sign in with one tap; we email you whenever a new one is linked. You always keep at least one.</p>
      {!m ? <p className="mt-4 text-sm text-slate">Loading…</p> : (
        <ul className="mt-4 divide-y divide-rule rounded border border-rule">
          {row(<span aria-hidden="true">🔑</span>, "Email and password", m.password ? user.email || "On" : "Not set: use Forgot password to add one", m.password ? on("On") : <a href="/forgot-password" className="font-ui text-xs font-semibold text-crimson">Set a password</a>)}
          {row(<span aria-hidden="true">👆</span>, "Passkeys", m.passkeys ? `${m.passkeys} on this account` : "None yet", <a href="#passkeys" className="font-ui text-xs font-semibold text-crimson">{m.passkeys ? "Manage" : "Add one"}</a>)}
          {row(<GoogleMark />, "Google", m.google ? `Linked${m.googleEmail ? `: ${m.googleEmail}` : ""}` : "Not linked",
            m.google ? <span className="flex items-center gap-2">{on("Linked")}{unlinkBtn("google", "Google")}</span> : linkBtn("google", "Google", () => run("google", async () => { const r = await linkGoogle(user); if (r.kind === "redirecting") return; }, "Google is linked. Next time, Continue with Google signs you in.")))}
          {(m.linkedinAvailable || m.linkedin) && row(<LinkedInMark />, "LinkedIn", m.linkedin ? `Linked${m.linkedinName ? `: ${m.linkedinName}` : ""}` : "Not linked",
            m.linkedin ? <span className="flex items-center gap-2">{on("Linked")}{unlinkBtn("linkedin", "LinkedIn")}</span> : linkBtn("linkedin", "LinkedIn", () => { setBusy("linkedin"); setMsg(null); startLinkedIn("link", user).catch((e) => { setBusy(""); setMsg({ ok: false, text: e.message }); }); }))}
        </ul>
      )}
      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
    </div>
  );
}
