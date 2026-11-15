"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";

// Admin → People & Trust → Throwaway emails (the Moda admin redesign). Blocked domains (built in, and the ones added here, removable),
// adding more (one per line or separated by commas; ordinary providers refused), and the accounts already signed up with one: find them
// in every account's sign-in email (only the domain is shown), then suspend them with the throwaway reason. lib/throwaway-emails-server.ts.
type List = { builtIn: string[]; added: string[]; domains: string[] };
type Account = { uid: string; username: string | null; domain: string; blockedBy: string; status: "active" | "suspended"; admin: boolean };

const BUILT_IN_SHOWN = 6; // the built-in list is long: a few, then "+ n more built in"

export default function ThrowawayEmailsPage() {
  const { user, loading } = useAdminAuth();
  const [list, setList] = useState<List | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [allBuiltIn, setAllBuiltIn] = useState(false);
  const [accounts, setAccounts] = useState<Account[] | null>(null);

  const call = useCallback(async (body?: Record<string, unknown>) => {
    const r = await fetch("/api/admin/throwaway-emails", {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${await user!.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  }, [user]);

  useEffect(() => { if (user) call().then(setList).catch((e) => setError(e.message)); }, [user, call]);

  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what); setError(""); setNote("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(""); }
  };
  const add = () => run("add", async () => {
    const j = await call({ action: "add", text });
    setList(j); setText("");
    const added = (j.addedNow as string[]).length;
    const refused = (j.refused as { input: string; why: string }[]).map((r) => `${r.input} ${r.why}`);
    setNote([added ? `Added ${added} domain${added === 1 ? "" : "s"}.` : "Those are already on the list.", refused.length ? `Not added: ${refused.join("; ")}.` : ""].filter(Boolean).join(" "));
  });
  const remove = (domain: string) => run(`rm:${domain}`, async () => {
    if (!confirm(`Take ${domain} off the list? People can sign up with it again.`)) return;
    setList(await call({ action: "remove", domain }));
  });
  const find = () => run("find", async () => setAccounts((await call({ action: "find" })).accounts));
  const suspendable = (accounts ?? []).filter((a) => a.status === "active" && !a.admin && a.username);
  const suspend = () => run("suspend", async () => {
    if (!confirm(`Suspend ${suspendable.length} account${suspendable.length === 1 ? "" : "s"}? Each member is told why and can contact support to move to their own address.`)) return;
    const j = await call({ action: "suspend", uids: suspendable.map((a) => a.uid) });
    setNote(`Suspended ${j.suspended.length} account${j.suspended.length === 1 ? "" : "s"}.`);
    setAccounts((await call({ action: "find" })).accounts);
  });

  if (loading || !user) return <p className="p-6 text-sm text-slate">Loading…</p>;
  const total = list ? list.domains.length : 0;
  const builtIn = list ? (allBuiltIn ? list.builtIn : list.builtIn.slice(0, BUILT_IN_SHOWN)) : [];
  const chip = "inline-flex items-center gap-1.5 rounded-full bg-field px-3.5 py-1.5 font-ui text-[13px] text-ink";
  const card = "rounded-[14px] border border-rule bg-card p-5 sm:p-6";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-3 sm:px-6">
      <h1 className="font-display text-3xl font-medium text-ink sm:text-[2rem]">Throwaway emails</h1>
      <p className="mt-4 max-w-3xl font-ui text-[15px] leading-relaxed text-slate">
        Nobody can join with an address at these domains or any of their subdomains. A domain added here is refused straight away, by the sign-up forms and by the database rules.
      </p>
      {error && <p className="mt-4 font-ui text-sm text-crimson" role="alert">{error}</p>}
      {note && <p className="mt-4 font-ui text-sm text-ink" role="status">{note}</p>}

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <section className={card} aria-labelledby="tw-blocked">
          <div className="flex items-center justify-between gap-3">
            <h2 id="tw-blocked" className="font-ui text-lg font-semibold text-ink">Blocked domains</h2>
            <span className="font-ui text-[13px] text-slate">{list ? `${total} domain${total === 1 ? "" : "s"}` : "…"}</span>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Blocked domains">
            {builtIn.map((d) => <li key={d} className={chip}>{d} · built in</li>)}
            {list && list.builtIn.length > BUILT_IN_SHOWN && (
              <li>
                <button type="button" onClick={() => setAllBuiltIn((v) => !v)} className={`${chip} font-semibold text-crimson-bright hover:bg-rule`}>
                  {allBuiltIn ? "Show fewer" : `+ ${list.builtIn.length - BUILT_IN_SHOWN} more built in`}
                </button>
              </li>
            )}
            {list?.added.map((d) => (
              <li key={d} className={chip}>
                {d}
                <button type="button" onClick={() => remove(d)} disabled={!!busy} aria-label={`Remove ${d}`} className="-mr-1 rounded-full px-1 text-slate hover:text-crimson disabled:opacity-50">×</button>
              </li>
            ))}
          </ul>
          <hr className="my-5 border-rule" />
          <label className="block">
            <span className="font-ui text-sm font-semibold text-ink">Add domains</span>
            <textarea
              value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={"temp-mail.example\nanother-throwaway.example"}
              className="mt-3 block w-full resize-y rounded-[10px] border border-rule bg-paper px-3.5 py-3 font-mono text-[13px] leading-[1.7] text-ink outline-none placeholder:text-slate/70 focus:border-crimson"
            />
          </label>
          <p className="mt-2 font-ui text-[13px] leading-snug text-slate">One per line, or separated by commas. Ordinary providers such as Gmail can&apos;t be added.</p>
          <button type="button" onClick={add} disabled={!text.trim() || !!busy} className="mt-4 w-full rounded-full bg-crimson-bright px-8 py-2.5 font-ui text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">
            {busy === "add" ? "Adding…" : "Add"}
          </button>
        </section>

        <section className={card} aria-labelledby="tw-accounts">
          <h2 id="tw-accounts" className="font-ui text-lg font-semibold text-ink">Accounts already using one</h2>
          <p className="mt-3 font-ui text-[13px] leading-normal text-slate">
            Looks through every account&apos;s sign-in email. Suspended members see this reason: &ldquo;This account uses a temporary (throwaway) email address…&rdquo; and can contact support to move to their own address.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:flex">
            <button type="button" onClick={find} disabled={!!busy} className="rounded-full border border-crimson-bright bg-card px-5 py-2 font-ui text-[13px] font-semibold text-crimson-bright hover:bg-crimson-bright/5 disabled:opacity-50">
              {busy === "find" ? "Looking…" : "Find accounts"}
            </button>
            <button type="button" onClick={suspend} disabled={!!busy || suspendable.length === 0} className="rounded-full bg-crimson px-5 py-2 font-ui text-[13px] font-semibold text-white disabled:opacity-50">
              {busy === "suspend" ? "Suspending…" : accounts ? `Suspend ${suspendable.length}` : "Suspend"}
            </button>
          </div>
          {accounts && (
            accounts.length === 0 ? (
              <p className="mt-5 font-ui text-sm text-slate">No accounts use a blocked domain.</p>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-sm border border-rule">
                <table className="w-full border-collapse font-ui text-[13px]">
                  <thead className="bg-field text-left text-slate">
                    <tr><th className="border-b border-r border-rule px-2.5 py-3 font-semibold">Account</th><th className="border-b border-r border-rule px-2.5 py-3 font-semibold">Domain</th><th className="border-b border-rule px-2.5 py-3 font-semibold">Status</th></tr>
                  </thead>
                  <tbody className="text-ink">
                    {accounts.map((a) => (
                      <tr key={a.uid} className="border-b border-rule last:border-b-0">
                        <td className="border-r border-rule px-2.5 py-3">{a.username ? <Link href={`/u/${a.username}`} className="hover:text-crimson">@{a.username}</Link> : <span className="text-slate">no profile</span>}</td>
                        <td className="border-r border-rule px-2.5 py-3 break-all">{a.domain}</td>
                        <td className="px-2.5 py-3">{a.admin ? "Staff" : a.status === "suspended" ? "Suspended" : "Active"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </section>
      </div>
    </div>
  );
}
