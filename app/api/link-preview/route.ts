import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/link-preview?url=… → { url, title, description, image, site } for the card under a chat message with a web address.
// Signed-in members only, and only public web addresses: every hop of a redirect is checked against private and local networks,
// we read at most 512 KB of the page with a 5-second limit, and answers are kept for 6 hours.
export type LinkPreviewData = { url: string; title: string; description: string; image: string | null; site: string };

const MAX_BYTES = 512 * 1024, TIMEOUT_MS = 5000, KEEP_MS = 6 * 3600_000;
const cache = new Map<string, { at: number; data: LinkPreviewData | null }>();

function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    return mapped ? privateIp(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
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

async function fetchPreview(start: string): Promise<LinkPreviewData | null> {
  let url = await publicUrl(start);
  for (let hop = 0; url && hop < 4; hop++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { redirect: "manual", signal: ctl.signal, headers: { "User-Agent": "NotesAppLinkPreview/1.0 (+https://www.notesapp.name.ng)", Accept: "text/html,application/xhtml+xml" } });
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

export async function GET(req: NextRequest) {
  try { await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")); }
  catch { return NextResponse.json({ error: "Sign in first." }, { status: 401 }); }
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  if (!raw || raw.length > 2000) return NextResponse.json({ error: "Which address?" }, { status: 400 });
  const hit = cache.get(raw);
  if (hit && Date.now() - hit.at < KEEP_MS) return NextResponse.json({ preview: hit.data });
  const limited = rateLimit(req, "link-preview", req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "anon", 40, 60);
  if (limited) return limited;
  const data = await fetchPreview(raw);
  cache.set(raw, { at: Date.now(), data });
  if (cache.size > 800) for (const k of Array.from(cache.keys()).slice(0, 200)) cache.delete(k);
  return NextResponse.json({ preview: data }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
