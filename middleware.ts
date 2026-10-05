import { NextRequest, NextResponse } from "next/server";
import { MAIN_HOST, isMainHost } from "@/lib/host";

// Custom domains (Enterprise). On our own hosts this does nothing. On a member's domain it serves their branded site
// (app/(site)/s/[username]: header with their name, Home, Notes, Shop, "Powered by #NotesApp" footer) and sends everything
// else — sign-in, checkout, bookings, settings, other people's pages — to www.notesapp.name.ng, where those must happen.
//   /                     → Home (or the Shop, if they chose the store as their front page)
//   /notes, /notes/<slug> → their notes          (/journals/… is an alias)
//   /shop, /shop/<id>     → their shop           (/store and /u/<username>/store are aliases)
// A note or item that isn't theirs is sent to the main site instead.
type Resolved = { found: boolean; uid?: string; username?: string; home?: "profile" | "store"; owned?: boolean };
const cache = new Map<string, { at: number; v: Resolved }>();
const TTL_MS = 60_000;
const MISS_TTL_MS = 5_000; // a domain that was just activated shouldn't stay "not connected" for a minute

async function resolve(host: string, check?: string): Promise<Resolved> {
  const key = `${host}|${check || ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.v.found ? TTL_MS : MISS_TTL_MS)) return hit.v;
  let v: Resolved = { found: false };
  try {
    const res = await fetch(`https://${MAIN_HOST}/api/public/domain-resolve?host=${encodeURIComponent(host)}${check ? `&check=${encodeURIComponent(check)}` : ""}`, { cache: "no-store" });
    if (res.ok) v = await res.json();
  } catch {
    /* fall through: treated as not found for this minute */
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), v });
  return v;
}

const PASS = /^\/(_next\/|favicon|robots\.txt|sitemap|images\/|fonts\/|api\/(views|trending|boosts|ads|public|status)\b)/;
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

  const site = `/s/${d.username}`;
  if (pathname === "/") return rewrite(d.home === "store" ? `${site}/shop` : site);
  if (pathname === "/notes" || pathname === "/journals") return rewrite(`${site}/notes`);
  if (pathname === "/shop" || pathname === "/store" || pathname === `/u/${d.username}/store`) return rewrite(`${site}/shop`);
  if (pathname === `/u/${d.username}`) return rewrite(site);

  const m = /^\/(notes|journals|shop)\/([^/]+)\/?$/.exec(pathname);
  if (m) {
    const journal = m[1] !== "shop";
    const r = await resolve(host, `${journal ? "journal" : "item"}:${decodeURIComponent(m[2])}`);
    if (r.owned) return rewrite(`${site}/${journal ? "notes" : "shop"}/${m[2]}`);
    // Not theirs: the main site has it (or says it doesn't exist).
    return NextResponse.redirect(`https://${MAIN_HOST}/${journal ? "journals" : "shop"}/${m[2]}`, 307);
  }

  // Sign-in, checkout, bookings, settings, other people's pages … all live on the main site.
  return NextResponse.redirect(`https://${MAIN_HOST}${pathname}${search}`, 307);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
