import { createHmac } from "crypto";

// Client for the Whogohost (go54) Domain Reseller API. Server-only: it reads WHOGOHOST_RESELLER_EMAIL and WHOGOHOST_API_KEY, which must
// never reach the browser. Requests carry a `username` header (the reseller email) and a `token`:
//   base64( hex( HMAC-SHA256( data = api key, key = "<email>:<UTC yy-mm-dd HH>" ) ) )
// (the argument order is theirs — PHP's hash_hmac(algo, data, key) with the API key as the data). The token changes every UTC hour, so a
// request that fails right at the hour is retried once with a fresh token.
const ENDPOINT = "https://whogohost.com/host/modules/addons/DomainsReseller/api/index.php";
const TIMEOUT_MS = 20_000;

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
    const res = await fetch(url, {
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
  address1: string; address2: string; city: string; state: string; zipcode: string; country: string;
  phonenumber: string; // +234.812345678
};
export type Contacts = { registrant: ContactBlock; tech: ContactBlock; billing: ContactBlock; admin: ContactBlock };
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
export const wgSaveDns = (domain: string, dnsrecords: unknown) => call("POST", `/domains/${domainPath(domain)}/dns`, { dnsrecords });
export const wgSaveNameservers = (domain: string, ns: string[]) =>
  call("POST", `/domains/${domainPath(domain)}/nameservers`, Object.fromEntries(ns.slice(0, 5).map((n, i) => [`ns${i + 1}`, n])));
export const wgSaveLock = (domain: string, locked: boolean) => call("POST", `/domains/${domainPath(domain)}/lock`, { lockstatus: locked ? "locked" : "unlocked" });
export const wgSync = (domain: string) => call("POST", `/domains/${domainPath(domain)}/sync`);
export const wgRegister = (domain: string, years: number, nameservers: string[], contacts: Contacts, addons?: Addons) =>
  call("POST", "/order/domains/register", {
    domain, regperiod: years, contacts, addons,
    nameservers: Object.fromEntries(nameservers.slice(0, 5).map((n, i) => [`ns${i + 1}`, n])),
  });
export const wgRenew = (domain: string, years: number, addons?: Addons) => call("POST", "/order/domains/renew", { domain, regperiod: years, addons });
