// Pure host helpers (no Node-only imports — also used by middleware.ts on the edge runtime).
//
// The whole site's address is ONE setting: NEXT_PUBLIC_ROOT_DOMAIN (Vercel → Environment Variables, then redeploy). Unset, it is
// notesapp.name.ng. Everything follows it:
//   www.<root>          the main site (SITE_URL); the bare <root> goes there too
//   <any>.<root>        a subdomain we serve: app. (the app address), life. (Notes Life), mcp., and any added later
//   any other domain    added to the Vercel project (an old root, a new one we buy, notesapp.ng …) is sent permanently (308)
//                       to the same page on the root, keeping its subdomain: life.<old> → life.<root>, <old> → www.<root>.
//                       Known old roots are listed in OTHER_ROOTS so they redirect without a lookup; any other domain
//                       redirects once middleware.ts has checked it isn't a member's own domain (customDomains).
// /api/* is served on every domain, so webhooks and OAuth callbacks registered with an old address keep working while the
// providers are updated. Read docs/DOMAIN_SWITCH.md before changing the root.
const clean = (h: string | undefined) => (h || "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").replace(/[/:].*$/, "").replace(/\.$/, "");
export const LEGACY_ROOT_DOMAIN = "notesapp.name.ng";
export const ROOT_DOMAIN = clean(process.env.NEXT_PUBLIC_ROOT_DOMAIN) || LEGACY_ROOT_DOMAIN;
// Domains we own that aren't the root (today or after a switch). Not required for a redirect, only quicker.
const OTHER_ROOTS = [LEGACY_ROOT_DOMAIN, "notesapp.tech"].filter((r) => r !== ROOT_DOMAIN);
// Short domains that open the app: they go to app.<root> rather than www.<root>.
const APP_SHORT_DOMAINS = ["notesapp.ng"];
export const KNOWN_ROOTS = [ROOT_DOMAIN, ...OTHER_ROOTS];
export const MAIN_HOST = `www.${ROOT_DOMAIN}`;
export const APP_HOST = `app.${ROOT_DOMAIN}`;
export const LIFE_HOST = `life.${ROOT_DOMAIN}`;
export const MCP_HOST = `mcp.${ROOT_DOMAIN}`;
// Subdomains of an old domain that are never sent to the root: media. is the picture and video bucket (Cloudflare), whose
// addresses are stored in the database, so it keeps its own address.
const KEEP_SUBS = new Set(["media"]);

// The main site's address, always https://www.<root> on the live site. NEXT_PUBLIC_SITE_URL is only used for local development
// and Vercel previews (localhost, 127.0.0.1, *.vercel.app); any other value is ignored, so the root is the only setting.
export const SITE_URL = (() => {
  const env = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(env) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(env)) return env;
  return `https://${MAIN_HOST}`;
})();
export const APP_URL = `https://${APP_HOST}`;
export const LIFE_URL = `https://${LIFE_HOST}`;
// Where people write to us. Mail moves separately from the website (it needs MX, SPF and DKIM on the new domain), so it is
// its own setting: NEXT_PUBLIC_CONTACT_EMAIL, defaulting to the address that works today.
export const CONTACT_EMAIL = (process.env.NEXT_PUBLIC_CONTACT_EMAIL || `hello@${LEGACY_ROOT_DOMAIN}`).trim();

const bare = (hostname: string) => hostname.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
const under = (h: string, root: string) => (h === root ? "" : h.endsWith(`.${root}`) ? h.slice(0, -root.length - 1) : null);
// "app.notesapp.name.ng" → { root: "notesapp.name.ng", sub: "app" } for the root and the domains we know are ours; null otherwise.
export function ourRoot(hostname: string): { root: string; sub: string } | null {
  const h = bare(hostname);
  for (const root of [...KNOWN_ROOTS, ...APP_SHORT_DOMAINS]) {
    const sub = under(h, root);
    if (sub !== null) return { root, sub };
  }
  return null;
}
// On the root itself (any subdomain).
export const onRoot = (hostname: string) => under(bare(hostname), ROOT_DOMAIN) !== null;

// Where a host that isn't on the root belongs on the root: the same subdomain there (www. for a bare domain), app. for the short
// app domains. `registrable` says how much of the host is the domain itself; without it, it's worked out (notesapp.africa,
// notesapp.com.ng). Null for the root itself and for subdomains we keep (media.).
export function rootTarget(hostname: string, registrable?: string): string | null {
  const h = bare(hostname);
  if (onRoot(h)) return null;
  const known = ourRoot(h);
  const domain = known?.root ?? registrable ?? registrableDomain(h);
  const sub = under(h, domain) ?? "";
  if (KEEP_SUBS.has(sub.split(".").pop() || "")) return null;
  if (APP_SHORT_DOMAINS.includes(domain) && (sub === "" || sub === "www")) return APP_HOST;
  return sub === "" || sub === "www" ? MAIN_HOST : `${sub}.${ROOT_DOMAIN}`;
}
// A host on one of the old domains we know: middleware.ts redirects it straight away.
export function movedHost(hostname: string): string | null {
  const o = ourRoot(hostname);
  return o && o.root !== ROOT_DOMAIN ? rootTarget(hostname) : null;
}
// "life.notesapp.com.ng" → "notesapp.com.ng", "app.notesapp.africa" → "notesapp.africa".
export function registrableDomain(host: string): string {
  const parts = bare(host).split(".");
  const two = parts.slice(-2).join(".");
  return SECOND_LEVEL.has(two) && parts.length >= 3 ? parts.slice(-3).join(".") : two;
}

// The app domain: opens #NotesApp like an app (splash, then the journal) and sends marketing pages to MAIN_HOST.
export const APP_HOSTS = [APP_HOST];
export const isAppHost = (hostname: string) => under(bare(hostname), ROOT_DOMAIN) === "app";
// Notes Life: its own address, served from /life on the same app (middleware.ts).
export const isLifeHost = (hostname: string) => under(bare(hostname), ROOT_DOMAIN) === "life";

// True for our own hosts (the root and every subdomain of it, the old domains we know), local development and Vercel preview
// deployments. Everything else is a member's custom domain, or a domain we added to Vercel that middleware.ts sends to the root.
export function isMainHost(hostname: string): boolean {
  const h = bare(hostname);
  return ourRoot(h) !== null || h === "localhost" || h === "127.0.0.1" || h.endsWith(".vercel.app");
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
