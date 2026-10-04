import { NextRequest, NextResponse } from "next/server";
import { MAIN_HOST, isMainHost } from "@/lib/host";

// Custom domains (Enterprise). On our own hosts this does nothing. On a member's domain it serves only their
// public pages — home, store, journals and store items — and sends everything else (sign-in, checkout, settings)
// to www.notesapp.name.ng, which is where those must happen.
//   /          → their profile (or store, per their setting)      /store → their store
//   /journals/<slug>, /shop/<id> → only when they belong to this member
//   anything else → redirect to https://www.notesapp.name.ng<same path>
type Resolved = { found: boolean; uid?: string; username?: string; home?: "profile" | "store"; owned?: boolean };
const cache = new Map<string, { at: number; v: Resolved }>();
const TTL_MS = 60_000;

async function resolve(host: string, check?: string): Promise<Resolved> {
  const key = `${host}|${check || ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v;
  let v: Resolved = { found: false };
  try {
    const res = await fetch(`https://${MAIN_HOST}/api/public/domain-resolve?host=${encodeURIComponent(host)}${check ? `&check=${encodeURIComponent(check)}` : ""}`);
    if (res.ok) v = await res.json();
  } catch {
    /* fall through: treated as not found for this minute */
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), v });
  return v;
}

const PASS = /^\/(_next\/|favicon|robots\.txt|sitemap|images\/|fonts\/|api\/(views|trending|boosts|public|status)\b)/;
const PUBLIC_FILE = /\.[a-z0-9]{2,5}$/i;

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase().replace(/:\d+$/, "");
  if (!host || isMainHost(host)) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (PASS.test(pathname) || PUBLIC_FILE.test(pathname)) return NextResponse.next();

  const d = await resolve(host);
  if (!d.found || !d.username) return new NextResponse("This domain isn't connected to a #NotesApp account.", { status: 404 });

  const headers = new Headers(req.headers);
  headers.set("x-custom-owner", d.uid || "");
  const rewrite = (path: string) => NextResponse.rewrite(new URL(path + search, req.url), { request: { headers } });

  if (pathname === "/") return rewrite(d.home === "store" ? `/u/${d.username}/store` : `/u/${d.username}`);
  if (pathname === "/store") return rewrite(`/u/${d.username}/store`);
  if (pathname === `/u/${d.username}` || pathname === `/u/${d.username}/store`) return NextResponse.next({ request: { headers } });

  const m = /^\/(journals|shop)\/([^/]+)\/?$/.exec(pathname);
  if (m) {
    const r = await resolve(host, `${m[1] === "journals" ? "journal" : "item"}:${decodeURIComponent(m[2])}`);
    if (!r.owned) return new NextResponse("Not found", { status: 404 });
    return NextResponse.next({ request: { headers } });
  }

  // Sign-in, checkout, bookings, settings, other people's pages … all live on the main site.
  return NextResponse.redirect(`https://${MAIN_HOST}${pathname}${search}`, 307);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
