import { setting } from "@/lib/config";
// Pure host helpers (no Node-only imports — also used by middleware.ts on the edge runtime).
//
// Every domain added to the Vercel project serves the whole site under its own name: no redirects, the address bar keeps the
// domain the visitor typed (life.notesapp.name.ng shows Notes Life as life.notesapp.name.ng). A domain plus its subdomains is
// a "family": www.<domain> is the main site, app.<domain> the app address, life.<domain> Notes Life, and any other subdomain
// (mcp., future ones) the main site. Moving between them stays in the visitor's family (middleware.ts, useFamilyUrl).
//
// ONE setting picks the primary address: NEXT_PUBLIC_ROOT_DOMAIN (Vercel → Environment Variables, then redeploy). Unset, it is
// notesapp.name.ng. It is the address everything that leaves the site uses: emails, share links, search engines' canonical
// address, API docs, webhooks and sign-in callbacks (SITE_URL, MAIN_HOST, APP_URL, LIFE_URL). Read docs/DOMAIN_SWITCH.md.
// Members' own domains (Business and Enterprise) are the exception: middleware.ts serves their branded site there.
const clean = (h: string | undefined) => (h || "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").replace(/[/:].*$/, "").replace(/\.$/, "");
export const LEGACY_ROOT_DOMAIN = "notesapp.name.ng";
export const ROOT_DOMAIN = clean(setting("NEXT_PUBLIC_ROOT_DOMAIN")) || LEGACY_ROOT_DOMAIN;
// Our domains we know of, so they work without a lookup. A domain added to Vercel later works too: middleware.ts checks it
// isn't a member's and then treats it as ours.
const OTHER_ROOTS = [LEGACY_ROOT_DOMAIN, "naapp.tech"].filter((r) => r !== ROOT_DOMAIN);
// Short domains that open the app itself (the bare domain and www. act like app.<domain>).
export const APP_SHORT_DOMAINS = ["notesapp.ng"];
export const KNOWN_ROOTS = [ROOT_DOMAIN, ...OTHER_ROOTS];
export const MAIN_HOST = `www.${ROOT_DOMAIN}`;
export const APP_HOST = `app.${ROOT_DOMAIN}`;
export const LIFE_HOST = `life.${ROOT_DOMAIN}`;
export const MCP_HOST = `mcp.${ROOT_DOMAIN}`;
// Naija Exam Prep: its own address, served from /exam-prep on the same app (middleware.ts).
export const PREP_HOST = `prep.${ROOT_DOMAIN}`;
export const PREP_URL = `https://${PREP_HOST}`;

// The primary address of the main site, always https://www.<root> on the live site. NEXT_PUBLIC_SITE_URL is only used for local
// development and Vercel previews (localhost, 127.0.0.1, *.vercel.app); any other value is ignored, so the root is the only setting.
export const SITE_URL = (() => {
  const env = (setting("NEXT_PUBLIC_SITE_URL") || "").trim().replace(/\/$/, "");
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(env) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(env)) return env;
  return `https://${MAIN_HOST}`;
})();
export const APP_URL = `https://${APP_HOST}`;
export const LIFE_URL = `https://${LIFE_HOST}`;
// Where people write to us. Mail moves separately from the website (it needs MX, SPF and DKIM on the new domain), so it is
// its own setting: NEXT_PUBLIC_CONTACT_EMAIL, defaulting to the address that works today.
export const CONTACT_EMAIL = (setting("NEXT_PUBLIC_CONTACT_EMAIL") || `hello@${LEGACY_ROOT_DOMAIN}`).trim();

const bare = (hostname: string) => hostname.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
const under = (h: string, root: string) => (h === root ? "" : h.endsWith(`.${root}`) ? h.slice(0, -root.length - 1) : null);
const isLocal = (h: string) => h === "localhost" || h === "127.0.0.1" || h.endsWith(".vercel.app");

export type Family = { root: string; sub: string };
// "life.notesapp.name.ng" → { root: "notesapp.name.ng", sub: "life" } for the domains we know; null otherwise.
export function ourRoot(hostname: string): Family | null {
  const h = bare(hostname);
  for (const root of [...KNOWN_ROOTS, ...APP_SHORT_DOMAINS]) {
    const sub = under(h, root);
    if (sub !== null) return { root, sub };
  }
  return null;
}
// The family of a domain that isn't in the list (one added to Vercel later): its registrable domain and what's in front of it.
export function familyOf(hostname: string): Family {
  const h = bare(hostname);
  const known = ourRoot(h);
  if (known) return known;
  const root = registrableDomain(h);
  return { root, sub: under(h, root) ?? "" };
}
// "life.notesapp.com.ng" → "notesapp.com.ng", "app.notesapp.africa" → "notesapp.africa".
export function registrableDomain(host: string): string {
  const parts = bare(host).split(".");
  const two = parts.slice(-2).join(".");
  return SECOND_LEVEL.has(two) && parts.length >= 3 ? parts.slice(-3).join(".") : two;
}
// What a host is for: the app address, Notes Life, or the main site.
export function roleOf(f: Family): "app" | "life" | "prep" | "main" {
  if (f.sub === "app" || (APP_SHORT_DOMAINS.includes(f.root) && (f.sub === "" || f.sub === "www"))) return "app";
  if (f.sub === "prep" && !APP_SHORT_DOMAINS.includes(f.root)) return "prep";
  return f.sub === "life" ? "life" : "main";
}
// The main site, the app or Notes Life in the same family as `hostname` (the short app domains' main site is the primary one).
// On localhost and previews everything is one host, so that host is returned.
export function familyHost(hostname: string, role: "main" | "app" | "life" | "prep"): string {
  const h = bare(hostname);
  if (isLocal(h)) return hostname;
  const { root } = familyOf(h);
  if (APP_SHORT_DOMAINS.includes(root)) return role === "app" ? h : role === "life" ? LIFE_HOST : role === "prep" ? PREP_HOST : MAIN_HOST;
  return `${role === "main" ? "www" : role}.${root}`;
}

// The app domain: opens #NotesApp like an app (splash, then the journal) and sends marketing pages to the main site.
export const APP_HOSTS = [APP_HOST];
export const isAppHost = (hostname: string) => { const f = ourRoot(hostname); return !!f && roleOf(f) === "app"; };
// Notes Life: its own address, served from /life on the same app (middleware.ts).
export const isLifeHost = (hostname: string) => { const f = ourRoot(hostname); return !!f && roleOf(f) === "life"; };
export const isPrepHost = (hostname: string) => { const f = ourRoot(hostname); return !!f && roleOf(f) === "prep"; };

// True for the domains we know (every subdomain), local development and Vercel preview deployments. Anything else is a
// member's own domain or a domain of ours added to Vercel later; middleware.ts tells them apart.
export function isMainHost(hostname: string): boolean {
  const h = bare(hostname);
  return ourRoot(h) !== null || isLocal(h);
}

const HOST_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// "https://Notes.Brand.com/path" → "notes.brand.com", or null if it isn't a usable public domain.
export function normalizeHost(input: string): string | null {
  const h = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
  if (!HOST_RE.test(h)) return null;
  if (isMainHost(h) || ourRoot(h) !== null || h.endsWith(".vercel.app") || h.endsWith(".vercel.dev") || h.endsWith(".local") || h.endsWith(".internal")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return null;
  return h;
}

// An apex domain (yourbrand.com) needs an A record; a subdomain (notes.yourbrand.com) a CNAME.
// Two-label registrable suffixes common in Nigeria (com.ng, org.ng, name.ng …) count as one label.
const SECOND_LEVEL = new Set(["com.ng", "org.ng", "net.ng", "edu.ng", "gov.ng", "name.ng", "sch.ng", "ng.com", "co.uk", "co.za"]);
export function isApexDomain(host: string): boolean {
  const parts = host.split(".");
  return parts.length === 2 || (parts.length === 3 && SECOND_LEVEL.has(parts.slice(1).join(".")));
}

export type DnsRecord = { type: "A" | "CNAME" | "TXT"; name: string; value: string };
export function dnsInstructions(host: string): DnsRecord[] {
  return isApexDomain(host)
    ? [{ type: "A", name: "@", value: "76.76.21.21" }]
    : [{ type: "CNAME", name: host.split(".")[0], value: "cname.vercel-dns.com" }];
}
