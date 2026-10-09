// Is a domain name free? Whogohost has no lookup API, so this asks the registries directly through RDAP (the standard, JSON successor to
// WHOIS): HTTP 200 means registered, 404 means no such registration. Answers are only as good as the registry's RDAP; when it can't be
// reached or says something unexpected the result is "unknown", and the registration call itself stays the final word (a member who has
// paid is refunded if it refuses). Server-only; this goes out directly, never through the Whogohost proxy.
export type LookupState = "available" | "taken" | "unknown";
export type Lookup = { domain: string; state: LookupState; source: string; httpStatus?: number; note?: string };

const NG_RDAP = "https://rdap.nic.net.ng";
const BOOTSTRAP = "https://data.iana.org/rdap/dns.json";
const FALLBACK = "https://rdap.org";
const TIMEOUT_MS = 8000;

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const SECOND_LEVEL_NG = ["com.ng", "net.ng", "org.ng", "edu.ng", "sch.ng", "name.ng", "i.ng", "gov.ng", "mil.ng", "mobi.ng"];

// "Example.COM.ng " → "example.com.ng"; null when it isn't a registrable-looking name.
export function normalizeName(input: string): string | null {
  const d = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0].replace(/^www\./, "").replace(/\.$/, "");
  const parts = d.split(".");
  if (parts.length < 2 || d.length > 253 || !parts.every((p) => LABEL.test(p))) return null;
  return d;
}

// The registrable part for a name: example.com.ng → example.com.ng; shop.example.com → example.com.
export function registrable(d: string): { name: string; tld: string } {
  const parts = d.split(".");
  const two = parts.slice(-2).join(".");
  if (SECOND_LEVEL_NG.includes(two) && parts.length >= 3) return { name: parts.slice(-3).join("."), tld: two };
  if (["co.uk"].includes(two) && parts.length >= 3) return { name: parts.slice(-3).join("."), tld: two };
  return { name: two, tld: parts[parts.length - 1] };
}

let bootstrap: { at: number; byTld: Map<string, string> } | null = null;
async function rdapBase(tld: string): Promise<string> {
  if (tld === "ng" || tld.endsWith(".ng")) return NG_RDAP;
  try {
    if (!bootstrap || Date.now() - bootstrap.at > 6 * 3600_000) {
      const res = await fetch(BOOTSTRAP, { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: 21600 } } as RequestInit);
      const j = (await res.json()) as { services: [string[], string[]][] };
      const byTld = new Map<string, string>();
      for (const [tlds, urls] of j.services) for (const t of tlds) byTld.set(t.toLowerCase(), urls[0]);
      bootstrap = { at: Date.now(), byTld };
    }
    const url = bootstrap.byTld.get(tld.split(".").pop() || tld);
    if (url) return url.replace(/\/$/, "");
  } catch { /* fall back to the public redirector */ }
  return FALLBACK;
}

export async function lookupDomain(input: string): Promise<Lookup> {
  const full = normalizeName(input);
  if (!full) return { domain: input, state: "unknown", source: "input", note: "That doesn't look like a domain name." };
  const { name, tld } = registrable(full);
  const base = await rdapBase(tld);
  try {
    const res = await fetch(`${base}/domain/${encodeURIComponent(name)}`, {
      headers: { accept: "application/rdap+json, application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      redirect: "follow",
    });
    if (res.status === 200) return { domain: name, state: "taken", source: base, httpStatus: 200 };
    if (res.status === 404) return { domain: name, state: "available", source: base, httpStatus: 404 };
    return { domain: name, state: "unknown", source: base, httpStatus: res.status, note: `The registry answered ${res.status}.` };
  } catch (err) {
    return { domain: name, state: "unknown", source: base, note: err instanceof Error && err.name === "TimeoutError" ? "The registry took too long to answer." : "Couldn't reach the registry." };
  }
}
