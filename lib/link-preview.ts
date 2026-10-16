import { lookup } from "node:dns/promises";
import { lookup as lookupCb, type LookupAddress } from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import { SITE_URL } from "@/lib/host";

// Server-only. The fetch behind /api/link-preview (app/api/link-preview/route.ts).
// GET /api/link-preview?url=… → { url, title, description, image, site } for the card under a chat message with a web address.
// Signed-in members only, and only public web addresses: every hop of a redirect is checked against private and local networks,
// we read at most 512 KB of the page with a 5-second limit. The address is checked again at the
// moment of connecting (safeLookup), on the very IP we connect to, so a name that answers "public" to the first check and
// "private" a moment later (DNS rebinding) is refused.
export type LinkPreviewData = { url: string; title: string; description: string; image: string | null; site: string };

const MAX_BYTES = 512 * 1024, TIMEOUT_MS = 5000;

export function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || /^fe[89ab]/.test(v) || v.startsWith("ff")) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return privateIp(mapped[1]);
    // IPv4 carried inside IPv6 (::ffff:7f00:1, NAT64 64:ff9b::/96, 6to4 2002::/16): judge the IPv4 inside.
    const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v) ?? /^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4}):/.exec(v);
    if (hex) { const a = parseInt(hex[1], 16), b = parseInt(hex[2], 16); return privateIp(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`); }
    return false;
  }
  if (isIP(ip) !== 4) return true;
  const [a, b, c] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
    || (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) || a >= 224;
}
// Used for every connection the preview fetch makes: resolve, refuse if any answer is private, connect to what was checked.
const safeLookup: LookupFunction = (hostname, options, callback) => {
  lookupCb(hostname, { ...options, all: true }, (err, addresses) => {
    const list = (addresses ?? []) as LookupAddress[];
    if (err) return callback(err, "", 4);
    if (!list.length || list.some((a) => privateIp(a.address))) return callback(Object.assign(new Error("Not a public address"), { code: "ENOTPUBLIC" }), "", 4);
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};
const dispatcher = new Agent({ connect: { lookup: safeLookup }, connections: 8 });

async function publicUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password || (u.port && !["80", "443"].includes(u.port))) return null;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") || /\.(local|internal|localhost)$/i.test(host)) return null;
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (!ips.length || ips.some(privateIp)) return null;
  return u;
}

const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e: string) => {
  const k = e.toLowerCase();
  if (k[0] === "#") { const n = k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
  return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " } as Record<string, string>)[k] ?? m;
}).replace(/\s+/g, " ").trim();

function meta(html: string, keys: string[]): string {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (!name || !keys.includes(name)) continue;
    const content = /\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i.exec(tag);
    const v = content?.[1] ?? content?.[2];
    if (v?.trim()) return decode(v);
  }
  return "";
}

export async function fetchPreview(start: string): Promise<LinkPreviewData | null> {
  let url = await publicUrl(start);
  for (let hop = 0; url && hop < 4; hop++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await undiciFetch(url, { dispatcher, redirect: "manual", signal: ctl.signal, headers: { "User-Agent": `NotesAppLinkPreview/1.0 (+${SITE_URL})`, Accept: "text/html,application/xhtml+xml" } });
      if (res.status >= 300 && res.status < 400) { const to = res.headers.get("location"); url = to ? await publicUrl(new URL(to, url).toString()) : null; continue; }
      if (!res.ok || !/text\/html|xhtml/i.test(res.headers.get("content-type") ?? "") || !res.body) return null;
      const reader = res.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      while (size < MAX_BYTES) { const { done, value } = await reader.read(); if (done || !value) break; chunks.push(value); size += value.length; if (/<\/head>/i.test(new TextDecoder().decode(value))) break; }
      reader.cancel().catch(() => {});
      const html = new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))).subarray(0, MAX_BYTES));
      const title = meta(html, ["og:title", "twitter:title"]) || decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
      if (!title) return null;
      const img = meta(html, ["og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"]);
      let image: string | null = null;
      try { const iu = img ? new URL(img, url) : null; image = iu && iu.protocol === "https:" ? iu.toString() : null; } catch { image = null; }
      return { url: url.toString(), title: title.slice(0, 200), description: (meta(html, ["og:description", "twitter:description", "description"])).slice(0, 300), image, site: meta(html, ["og:site_name"]) || url.hostname.replace(/^www\./, "") };
    } catch { return null; } finally { clearTimeout(timer); }
  }
  return null;
}

