import { createHmac } from "crypto";
import { ProxyAgent, fetch as undiciFetch } from "undici";

// Client for the Whogohost (go54) Domain Reseller API. Server-only: it reads WHOGOHOST_RESELLER_EMAIL and WHOGOHOST_API_KEY, which must
// never reach the browser. Requests carry a `username` header (the reseller email) and a `token`:
//   base64( hex( HMAC-SHA256( data = api key, key = "<email>:<UTC yy-mm-dd HH>" ) ) )
// (the argument order is theirs — PHP's hash_hmac(algo, data, key) with the API key as the data). The token changes every UTC hour, so a
// request that fails right at the hour is retried once with a fresh token.
const ENDPOINT = "https://whogohost.com/host/modules/addons/DomainsReseller/api/index.php";
const TIMEOUT_MS = 20_000;

// Whogohost only accepts calls from addresses it has been given, and Vercel's change. When WHOGOHOST_PROXY_URL is set (an HTTP(S) proxy with a
// fixed outgoing address, e.g. http://user:pass@host:port), every call to Whogohost goes through it; nothing else does. The URL holds a
// password, so it is never logged or returned.
let agent: ProxyAgent | undefined;
export const proxyConfigured = () => !!process.env.WHOGOHOST_PROXY_URL;
export async function proxiedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const proxy = process.env.WHOGOHOST_PROXY_URL;
  if (!proxy) return fetch(url, init);
  agent ??= new ProxyAgent(proxy);
  return (await undiciFetch(url, { ...(init as object), dispatcher: agent } as never)) as unknown as Response;
}

// The address the service sees our calls come from (through the proxy, when one is set): what to give Whogohost to allow.
export async function outgoingIp(): Promise<string | null> {
  try {
    const res = await proxiedFetch("https://api.ipify.org", { signal: AbortSignal.timeout(8000), cache: "no-store" });
    const t = (await res.text()).trim();
    return /^[0-9a-f.:]{3,45}$/i.test(t) ? t : null;
  } catch {
    return null;
  }
}

export function whogohostConfigured(): boolean {
  return !!(process.env.WHOGOHOST_RESELLER_EMAIL && process.env.WHOGOHOST_API_KEY);
}

// PHP's gmdate("y-m-d H"): two-digit year, e.g. "26-10-09 14".
export function tokenHour(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(now.getUTCFullYear() % 100)}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())} ${p(now.getUTCHours())}`;
}

export function makeToken(email: string, apiKey: string, now = new Date()): string {
  const hex = createHmac("sha256", `${email}:${tokenHour(now)}`).update(apiKey).digest("hex");
  return Buffer.from(hex).toString("base64");
}

// PHP http_build_query: nested objects and arrays become a[b][c]=…
export function buildQuery(params: Record<string, unknown>): string {
  const out: string[] = [];
  const add = (key: string, v: unknown) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => add(`${key}[${i}]`, x));
    else if (typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) add(`${key}[${k}]`, x);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(typeof v === "boolean" ? (v ? "1" : "0") : String(v))}`);
  };
  for (const [k, v] of Object.entries(params)) add(k, v);
  return out.join("&");
}

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
function domainPath(domain: string): string {
  const d = domain.trim().toLowerCase();
  if (!DOMAIN_RE.test(d)) throw new Error("That doesn't look like a valid domain name.");
  return encodeURIComponent(d);
}

// For the admin page and /status: which settings exist and whether the service answers us. The service's reply is passed on as it came.
// Read-only probes of the actions we will need, to learn which ones the service refuses ("Action is not allowed", with our IP). An answer
// that is an ordinary error (unknown domain, bad input) still proves the action itself is allowed.
async function probe(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    return { name, state: "allowed" as const, note: "answered" };
  } catch (err) {
    const body = err instanceof WhogohostError ? JSON.stringify(err.body ?? err.message).slice(0, 200) : "failed";
    const blocked = err instanceof WhogohostError && /not allowed/i.test(JSON.stringify(err.body ?? ""));
    return { name, state: blocked ? ("blocked" as const) : ("allowed" as const), note: body };
  }
}

export async function wgDiagnose() {
  const emailSet = !!process.env.WHOGOHOST_RESELLER_EMAIL, keySet = !!process.env.WHOGOHOST_API_KEY;
  if (!emailSet || !keySet) return { configured: false, emailSet, keySet, ok: false, summary: "Set WHOGOHOST_RESELLER_EMAIL and WHOGOHOST_API_KEY in Vercel." } as const;
  const [version, credits, tlds, ip] = await Promise.allSettled([wgVersion(), wgCredits(), wgTlds(), outgoingIp()]);
  const shape = (r: PromiseSettledResult<unknown>) =>
    r.status === "fulfilled" ? { ok: true as const, data: r.value } : { ok: false as const, error: r.reason instanceof WhogohostError ? `${r.reason.message}${r.reason.body ? ` ${JSON.stringify(r.reason.body).slice(0, 300)}` : ""}` : "Failed" };
  // "Connected" rests on the credit call: /version has been refused with "Action is not allowed" while credit and the extension list work.
  const c = shape(credits);
  const probes = await Promise.all([
    probe("Price of a name (register)", () => wgPricing("register", "example-probe.com")),
    probe("Domain details (a domain we don't own)", () => wgInfo("example-probe.com")),
    probe("DNS records (a domain we don't own)", () => wgGetDns("example-probe.com")),
    probe("Nameservers (a domain we don't own)", () => wgGetNameservers("example-probe.com")),
  ]);
  return { configured: true, emailSet, keySet, ok: c.ok, summary: c.ok ? "Connected: the service accepted our login." : c.error, version: shape(version), credits: c, tlds: shape(tlds), proxy: proxyConfigured(), probes, outgoingIp: ip.status === "fulfilled" ? ip.value : null } as const;
}

export class WhogohostError extends Error {
  constructor(message: string, readonly status: number, readonly body?: unknown) {
    super(message);
  }
}

async function call<T = unknown>(method: "GET" | "POST", path: string, params: Record<string, unknown> = {}, retried = false): Promise<T> {
  const email = process.env.WHOGOHOST_RESELLER_EMAIL, key = process.env.WHOGOHOST_API_KEY;
  if (!email || !key) throw new WhogohostError("The domain service isn't set up yet.", 503);
  const query = buildQuery(params);
  const url = `${ENDPOINT}${path}${method === "GET" && query ? `?${query}` : ""}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await proxiedFetch(url, {
      method,
      headers: {
        username: email,
        token: makeToken(email, key),
        ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      },
      body: method === "POST" ? query : undefined,
      signal: ctl.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* not JSON: kept as text */ }
    if ((res.status === 401 || res.status === 403) && !retried) return call<T>(method, path, params, true);
    if (!res.ok) throw new WhogohostError(`The domain service answered ${res.status}.`, res.status, body);
    return body as T;
  } catch (err) {
    if (err instanceof WhogohostError) throw err;
    throw new WhogohostError(err instanceof Error && err.name === "AbortError" ? "The domain service took too long to answer." : "Couldn't reach the domain service.", 502);
  } finally {
    clearTimeout(timer);
  }
}

export type ContactBlock = {
  firstname: string; lastname: string; fullname: string; companyname: string; email: string;
  address1: string; address2: string; city: string; state: string; postcode: string; country: string;
  phonenumber: string; // +234.812345678
};
// Every field but address2 is required by the service; companyname too, so an individual's company is their own name.
export type Contacts = { registrant: ContactBlock; tech: ContactBlock; billing: ContactBlock; admin: ContactBlock };
// Their model calls it `postcode`; their register sample says `zipcode`. We send both, with the same value.
function withZip(c: ContactBlock): ContactBlock & { zipcode: string } { return { ...c, zipcode: c.postcode }; }
function zipAll(c: Contacts) { return { registrant: withZip(c.registrant), tech: withZip(c.tech), billing: withZip(c.billing), admin: withZip(c.admin) }; }

export type DnsRecord = { hostname: string; type: string; address: string; priority: number; recid?: string };
export type Addons = { dnsmanagement?: boolean | 0 | 1; emailforwarding?: boolean | 0 | 1; idprotection?: boolean | 0 | 1 };

// Reads. Response shapes are returned as the service sends them until we've seen real answers.
export const wgVersion = () => call("GET", "/version");
export const wgCredits = () => call("GET", "/billing/credits");
export const wgTlds = () => call("GET", "/tlds");
export const wgPricing = (type: "register" | "renew" | "transfer", domain: string) => call("GET", `/order/pricing/domains/${type}`, { domain });
export const wgInfo = (domain: string) => call("GET", `/domains/${domainPath(domain)}/information`);
export const wgGetDns = (domain: string) => call("GET", `/domains/${domainPath(domain)}/dns`);
export const wgGetNameservers = (domain: string) => call("GET", `/domains/${domainPath(domain)}/nameservers`);
export const wgGetContact = (domain: string) => call("GET", `/domains/${domainPath(domain)}/contact`);
export const wgGetLock = (domain: string) => call("GET", `/domains/${domainPath(domain)}/lock`);
export const wgGetEpp = (domain: string) => call("GET", `/domains/${domainPath(domain)}/eppcode`);

// Writes.
export const wgSaveDns = (domain: string, dnsrecords: DnsRecord[]) => call("POST", `/domains/${domainPath(domain)}/dns`, { dnsrecords });
export const wgSaveNameservers = (domain: string, ns: string[]) =>
  call("POST", `/domains/${domainPath(domain)}/nameservers`, Object.fromEntries(ns.slice(0, 5).map((n, i) => [`ns${i + 1}`, n])));
export const wgSaveLock = (domain: string, locked: boolean) => call("POST", `/domains/${domainPath(domain)}/lock`, { lockstatus: locked ? "locked" : "unlocked" });
// Saving contacts uses capitalised keys (their `contactsdetails` model).
export const wgSaveContact = (domain: string, c: Contacts) =>
  call("POST", `/domains/${domainPath(domain)}/contact`, { contactdetails: { Registrant: withZip(c.registrant), Technical: withZip(c.tech), Billing: withZip(c.billing), Admin: withZip(c.admin) } });
export const wgSync = (domain: string) => call("POST", `/domains/${domainPath(domain)}/sync`);
export const wgRegister = (domain: string, years: number, nameservers: string[], contacts: Contacts, addons?: Addons) =>
  call("POST", "/order/domains/register", {
    domain, regperiod: years, contacts: zipAll(contacts), addons,
    nameservers: Object.fromEntries(nameservers.slice(0, 5).map((n, i) => [`ns${i + 1}`, n])),
  });
export const wgRenew = (domain: string, years: number, addons?: Addons) => call("POST", "/order/domains/renew", { domain, regperiod: years, addons });
