"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

// The Console: API keys, webhooks and your own domain. Keys and webhooks are switched on per account by our team
// (Enterprise); the domain section needs a plan that includes your own domain (Business and Enterprise).
type Key = { id: string; name: string; prefix: string; scopes: string[]; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };
type Endpoint = { id: string; url: string; events: string[]; active: boolean; createdAt: string };
type Delivery = { id: string; endpointId: string; url: string; event: string; ok: boolean; status: number | null; error: string; durationMs: number; at: string };
type Dns = { type: string; name: string; value: string };
type Domain = { host: string; status: "pending" | "active"; home: "profile" | "store"; note: string; dns: Dns[] };

const SCOPES: [string, string][] = [
  ["read:posts", "Read your posts"], ["write:posts", "Create & edit posts"], ["read:bookings", "Read bookings"],
  ["read:orders", "Read orders & download sales"], ["read:earnings", "Read earnings"],
];
const field = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—");

async function call(user: User, url: string, init: RequestInit = {}) {
  const token = await user.getIdToken();
  const res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function Locked({ children }: { children: React.ReactNode }) {
  return <div className="card mt-4 border-l-4 border-crimson p-5 text-sm text-slate">{children}</div>;
}

function Secret({ label, value, onClose }: { label: string; value: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 border border-crimson bg-card p-4">
      <p className="font-ui text-sm font-bold text-ink">{label}</p>
      <p className="mt-1 text-xs text-slate">Copy it now — for your security we can&apos;t show it again.</p>
      <p className="mt-3 break-all rounded bg-paper px-3 py-2 font-mono text-xs text-ink">{value}</p>
      <div className="mt-3 flex gap-3">
        <button className="btn-primary !px-4 !py-2 text-xs" onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true))}>{copied ? "Copied" : "Copy"}</button>
        <button className="text-xs text-slate underline" onClick={onClose}>I&apos;ve saved it</button>
      </div>
    </div>
  );
}

export default function ConsolePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [access, setAccess] = useState<{ apiAccess: boolean; apiPlan?: boolean; domainAllowed: boolean; username: string } | null>(null);
  const [keys, setKeys] = useState<Key[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [domain, setDomain] = useState<Domain | null>(null);
  const [autoConnect, setAutoConnect] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null);
  // forms
  const [keyName, setKeyName] = useState("");
  const [keyScopes, setKeyScopes] = useState<string[]>(["read:posts"]);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>([]);
  const [host, setHost] = useState("");

  useEffect(() => onAuthStateChanged(auth, (u) => (u ? setUser(u) : router.push("/login"))), [router]);

  const load = useCallback(async (u: User) => {
    try {
      const k = await call(u, "/api/console/keys");
      setAccess(k.access);
      setKeys(k.keys);
      const [w, d] = await Promise.all([call(u, "/api/console/webhooks"), call(u, "/api/console/domain")]);
      setEndpoints(w.endpoints);
      setDeliveries(w.deliveries);
      setEvents(w.events);
      setDomain(d.domain);
      setAutoConnect(d.autoConnect);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the Console.");
    }
  }, []);
  useEffect(() => { if (user) load(user); }, [user, load]);

  async function act(fn: () => Promise<void>, ok?: string) {
    if (!user) return;
    setBusy(true); setError(""); setMsg("");
    try {
      await fn();
      if (ok) setMsg(ok);
      await load(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  if (!user || !access) {
    return <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6"><p className="text-sm text-slate">{error || "Loading the Console…"}</p></section>;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <span className="eyebrow">Console</span>
      <h1 className="mt-3 font-display text-4xl text-ink">API, webhooks &amp; your domain</h1>
      <p className="mt-3 text-slate">
        Build on #NotesApp from your own systems. Read the <Link href="/docs" className="text-crimson underline">Docs</Link> for every endpoint. Prices and plan details are on <Link href="/pricing" className="text-crimson underline">Pricing</Link>.
      </p>
      {error && <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>}
      {msg && <p className="mt-6 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{msg}</p>}
      {secret && <Secret label={secret.label} value={secret.value} onClose={() => setSecret(null)} />}

      {/* ---------------- API keys ---------------- */}
      <h2 className="mt-12 font-display text-2xl text-ink">API keys</h2>
      {!access.apiAccess ? (
        <Locked>
          {access.apiPlan === false ? (
            <>The server-to-server API, keys and webhooks are part of the Enterprise plan; on Business the Console is for connecting your own domain. See <Link href="/pricing" className="text-crimson underline">Pricing</Link>, or <Link href="/contact?topic=api" className="text-crimson underline">talk to us about Enterprise</Link>.</>
          ) : (
            <>API access is switched on per account for Enterprise partners. To get it, send us a request with the <Link href="/contact?topic=api" className="text-crimson underline">contact form</Link> and we&apos;ll set you up.</>
          )}
        </Locked>
      ) : (
        <>
          <form
            className="card mt-4 p-5"
            onSubmit={(e) => { e.preventDefault(); act(async () => { const r = await call(user, "/api/console/keys", { method: "POST", body: JSON.stringify({ name: keyName, scopes: keyScopes }) }); setSecret({ label: `New API key “${keyName}”`, value: r.token }); setKeyName(""); }); }}
          >
            <label className="text-xs text-slate">Name<input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Precheks production" maxLength={60} className={field} /></label>
            <fieldset className="mt-3">
              <legend className="text-xs text-slate">Permissions</legend>
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                {SCOPES.map(([id, label]) => (
                  <label key={id} className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={keyScopes.includes(id)} onChange={() => toggle(keyScopes, setKeyScopes, id)} />{label}</label>
                ))}
              </div>
            </fieldset>
            <button disabled={busy || !keyName.trim()} className="btn-primary mt-4 !px-4 !py-2 text-xs">Create key</button>
          </form>
          {keys.length > 0 && (
            <ul className="card mt-4 divide-y divide-rule">
              {keys.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-ui font-semibold text-ink">{k.name} {k.revokedAt && <span className="ml-1 text-xs font-normal text-crimson">revoked</span>}</p>
                    <p className="font-mono text-xs text-slate">{k.prefix}… · {k.scopes.join(", ")}</p>
                    <p className="text-xs text-slate">Created {when(k.createdAt)} · last used {when(k.lastUsedAt)}</p>
                  </div>
                  {!k.revokedAt && <button disabled={busy} className="text-xs text-crimson underline" onClick={() => confirm(`Revoke “${k.name}”? Anything using it stops working immediately.`) && act(() => call(user, `/api/console/keys?id=${k.id}`, { method: "DELETE" }), "Key revoked.")}>Revoke</button>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* ---------------- Webhooks ---------------- */}
      <h2 className="mt-12 font-display text-2xl text-ink">Webhooks</h2>
      {!access.apiAccess ? (
        <Locked>Webhooks come with API access.</Locked>
      ) : (
        <>
          <form
            className="card mt-4 p-5"
            onSubmit={(e) => { e.preventDefault(); act(async () => { const r = await call(user, "/api/console/webhooks", { method: "POST", body: JSON.stringify({ action: "create", url: hookUrl, events: hookEvents }) }); setSecret({ label: "Signing secret for this endpoint", value: r.secret }); setHookUrl(""); setHookEvents([]); }); }}
          >
            <label className="text-xs text-slate">Endpoint URL<input value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} placeholder="https://example.com/hooks/notesapp" className={`${field} font-mono`} /></label>
            <fieldset className="mt-3">
              <legend className="text-xs text-slate">Events</legend>
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                {events.map((ev) => <label key={ev} className="flex items-center gap-2 font-mono text-xs text-ink"><input type="checkbox" checked={hookEvents.includes(ev)} onChange={() => toggle(hookEvents, setHookEvents, ev)} />{ev}</label>)}
              </div>
            </fieldset>
            <button disabled={busy || !hookUrl.trim()} className="btn-primary mt-4 !px-4 !py-2 text-xs">Add endpoint</button>
          </form>
          {endpoints.length > 0 && (
            <ul className="card mt-4 divide-y divide-rule">
              {endpoints.map((ep) => (
                <li key={ep.id} className="px-4 py-3 text-sm">
                  <p className="break-all font-mono text-xs text-ink">{ep.url} {!ep.active && <span className="font-sans text-crimson">· paused</span>}</p>
                  <p className="mt-1 text-xs text-slate">{ep.events.join(", ")}</p>
                  <div className="mt-2 flex gap-4 text-xs">
                    <button disabled={busy} className="text-crimson underline" onClick={() => act(async () => { const r = await call(user, "/api/console/webhooks", { method: "POST", body: JSON.stringify({ action: "test", id: ep.id }) }); setMsg(r.ok ? `Test delivered (HTTP ${r.status}).` : `Test failed${r.status ? ` (HTTP ${r.status})` : ""} — see recent deliveries.`); })}>Send test</button>
                    <button disabled={busy} className="text-slate underline" onClick={() => act(() => call(user, "/api/console/webhooks", { method: "POST", body: JSON.stringify({ action: "toggle", id: ep.id }) }))}>{ep.active ? "Pause" : "Resume"}</button>
                    <button disabled={busy} className="text-slate underline" onClick={() => confirm("Delete this endpoint?") && act(() => call(user, `/api/console/webhooks?id=${ep.id}`, { method: "DELETE" }), "Endpoint deleted.")}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {deliveries.length > 0 && (
            <>
              <h3 className="mt-6 font-ui text-sm font-bold text-ink">Recent deliveries</h3>
              <ul className="card mt-2 divide-y divide-rule">
                {deliveries.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs">
                    <span><span className={d.ok ? "text-emerald-700" : "text-crimson"}>{d.ok ? "●" : "✕"}</span> <span className="font-mono">{d.event}</span> · {d.status ?? "no response"}{d.error && !d.ok ? ` · ${d.error}` : ""} · {d.durationMs} ms</span>
                    <span className="text-slate">{when(d.at)} <button disabled={busy} className="ml-2 text-crimson underline" onClick={() => act(async () => { const r = await call(user, "/api/console/webhooks", { method: "POST", body: JSON.stringify({ action: "resend", deliveryId: d.id }) }); setMsg(r.ok ? "Resent." : "Resend failed."); })}>Resend</button></span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {/* ---------------- Domain ---------------- */}
      <h2 className="mt-12 font-display text-2xl text-ink">Your own domain</h2>
      {!access.domainAllowed ? (
        <Locked>A branded site on your own domain (Home, Notes and Shop) is a Business and Enterprise feature. Until then your page lives at <span className="font-mono">notesapp.name.ng/u/{access.username}</span>. See <Link href="/pricing" className="text-crimson underline">Pricing</Link>.</Locked>
      ) : !domain ? (
        <form className="card mt-4 p-5" onSubmit={(e) => { e.preventDefault(); act(async () => { await call(user, "/api/console/domain", { method: "POST", body: JSON.stringify({ host }) }); setHost(""); }, "Domain added — now add the DNS records below."); }}>
          <label className="text-xs text-slate">Domain<input value={host} onChange={(e) => setHost(e.target.value)} placeholder="notes.yourbrand.com  or  yourbrand.com" className={`${field} font-mono`} /></label>
          <p className="mt-2 text-xs text-slate">Use a subdomain like notes.yourbrand.com, or your root domain if you want it to be your whole site. Your /u/{access.username} page keeps working either way.</p>
          <button disabled={busy || !host.trim()} className="btn-primary mt-4 !px-4 !py-2 text-xs">Add domain</button>
        </form>
      ) : (
        <div className="card mt-4 p-5 text-sm">
          <p className="font-mono text-ink">{domain.host} <span className={`ml-2 rounded-full px-2 py-0.5 font-ui text-[11px] font-bold ${domain.status === "active" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{domain.status === "active" ? "Live" : "Pending"}</span></p>
          {domain.note && <p className="mt-2 text-xs text-slate">{domain.note}</p>}
          {domain.status === "pending" && (
            <>
              <p className="mt-4 font-ui text-xs font-bold text-ink">Add these records at your domain provider</p>
              <table className="mt-2 w-full text-left font-mono text-xs"><tbody>
                {domain.dns.map((r, i) => <tr key={i} className="border-t border-rule"><td className="py-1.5 pr-3 font-bold">{r.type}</td><td className="pr-3">{r.name}</td><td className="break-all">{r.value}</td></tr>)}
              </tbody></table>
              <div className="mt-4 border border-rule bg-paper p-4 text-xs text-slate">
                <p className="font-ui text-xs font-bold text-ink">Easiest: let Vercel run the domain&apos;s DNS</p>
                <p className="mt-1">
                  If your domain isn&apos;t hosted anywhere yet, or your provider won&apos;t take the record above, change the domain&apos;s <strong className="text-ink">nameservers</strong> at your registrar to{" "}
                  <span className="font-mono text-ink">ns1.vercel-dns.com</span> and <span className="font-mono text-ink">ns2.vercel-dns.com</span>. Vercel then manages the records for you and the domain connects by itself, usually within minutes.
                  This moves <em>all</em> of the domain&apos;s DNS to Vercel, so if the domain also runs email (MX records) or other services, recreate those records there too, or use the records above instead.
                </p>
              </div>
              {domain.dns.some((r) => r.type === "A") && (
                <p className="mt-3 text-xs text-slate">
                  <strong className="text-ink">Using the A record and your provider won&apos;t take it?</strong> Some providers want the Name left blank or set to the full domain instead of <span className="font-mono">@</span>, and the value typed with no spaces. Or connect{" "}
                  <span className="font-mono">www.{domain.host}</span> instead: remove this domain, add that, and create the CNAME it shows. (Press <em>Check status</em> after any change; DNS can take a while.)
                </p>
              )}
              {!autoConnect && <p className="mt-3 text-xs text-slate">Our team connects new domains by hand for now, so after you add the records we&apos;ll switch it on and notify you.</p>}
              <button disabled={busy} className="btn-primary mt-4 !px-4 !py-2 text-xs" onClick={() => act(() => call(user, "/api/console/domain", { method: "PATCH", body: JSON.stringify({ action: "check" }) }))}>Check status</button>
            </>
          )}
          <label className="mt-5 block text-xs text-slate">Front page of {domain.host}
            <select value={domain.home} onChange={(e) => act(() => call(user, "/api/console/domain", { method: "PATCH", body: JSON.stringify({ home: e.target.value }) }), "Front page updated.")} className={field}>
              <option value="profile">Profile, then notes (default)</option>
              <option value="store">Profile, then my shop first</option>
            </select>
          </label>
          <p className="mt-3 text-xs text-slate">Visitors browse your page, journals and store here. Signing in and paying happen securely on www.notesapp.name.ng, and they&apos;re sent back to your store afterwards.</p>
          <button disabled={busy} className="mt-4 text-xs text-crimson underline" onClick={() => confirm(`Remove ${domain.host}?`) && act(() => call(user, "/api/console/domain", { method: "DELETE" }), "Domain removed.")}>Remove domain</button>
        </div>
      )}
    </section>
  );
}
