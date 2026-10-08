// Pure host helpers (no Node-only imports — also used by middleware.ts on the edge runtime).
export const MAIN_HOST = "www.notesapp.name.ng";
// The app domain: opens #NotesApp like an app (splash, then the journal) and sends marketing pages to MAIN_HOST.
export const APP_HOSTS = ["notesapp.ng", "www.notesapp.ng"];
export function isAppHost(hostname: string): boolean {
  return APP_HOSTS.includes(hostname.toLowerCase().replace(/:\d+$/, ""));
}
const MAIN_HOSTS = ["www.notesapp.name.ng", "notesapp.name.ng", ...APP_HOSTS];

// True for our own hosts, local development and Vercel preview deployments — everything else is a
// member's custom domain.
export function isMainHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/:\d+$/, "");
  return MAIN_HOSTS.includes(h) || h === "localhost" || h === "127.0.0.1" || h.endsWith(".vercel.app");
}

const HOST_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// "https://Notes.Brand.com/path" → "notes.brand.com", or null if it isn't a usable public domain.
export function normalizeHost(input: string): string | null {
  const h = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
  if (!HOST_RE.test(h)) return null;
  if (isMainHost(h) || h.endsWith(".notesapp.name.ng") || h.endsWith(".vercel.app") || h.endsWith(".vercel.dev") || h.endsWith(".local") || h.endsWith(".internal")) return null;
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
