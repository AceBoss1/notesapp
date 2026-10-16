import { NextRequest, NextResponse } from "next/server";
import { MAIN_HOST, isMainHost, isAppHost, isLifeHost, movedHost, rootTarget } from "@/lib/host";

// Custom domains (Enterprise). On our own hosts this does nothing. On a member's domain it serves their branded site
// (app/(site)/s/[username]: header with their name, Home, Notes, Shop, "Powered by #NotesApp" footer) and sends everything
// else — sign-in, checkout, bookings, settings, other people's pages — to the main site (MAIN_HOST), where those must happen.
//   /                     → Home (profile header, booking, then the shop and notes, in the order of their front-page setting)
//   /notes, /notes/<slug> → their notes          (/journals/… is an alias)
//   /shop, /shop/<id>     → their shop           (/store and /u/<username>/store are aliases)
//   /terms, /privacy      → their own legal pages, with a "powered by #NotesApp" block
//   /login, /signup       → Enterprise: a branded sign-in / sign-up window on their domain; Business: the main-site page, then back here
// A note or item that isn't theirs is sent to the main site instead.
type Resolved = { found: boolean; known?: boolean; answered?: boolean; uid?: string; username?: string; home?: "profile" | "store"; owned?: boolean; full?: boolean };
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
    if (res.ok) v = { ...(await res.json()), answered: true };
  } catch {
    /* fall through: treated as not found for this minute */
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), v });
  return v;
}

const PASS = /^\/(_next\/|favicon|robots\.txt|sitemap|images\/|fonts\/|api\/(views|trending|boosts|ads|public|status|consent|booking\/slots|auth\/branded|paystack\/(initialize|verify))\b)/;
// Pages the app domain doesn't carry: it sends them to the main site (MAIN_HOST). (Explore, Help, Terms and Privacy stay on the app domain.)
const APP_TO_MAIN = /^\/(about|pricing|roadmap|status|docs|changelog|security|brand|challenge|advertise|domains|organisations|store-selling|merchstore|contact|coauthoring|gifts|boost|badges|track)(\/|$)/;
const PUBLIC_FILE = /\.[a-z0-9]{2,5}$/i;

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase().replace(/:\d+$/, "");
  // One of our other domains (the site lives on NEXT_PUBLIC_ROOT_DOMAIN, lib/host.ts): every page goes to the same page and
  // subdomain on the root, permanently. /api/* stays served here, so webhooks and OAuth callbacks registered with the old
  // address keep working until each provider is updated (docs/DOMAIN_SWITCH.md).
  const moved = host ? movedHost(host) : null;
  if (moved && !req.nextUrl.pathname.startsWith("/api/")) return NextResponse.redirect(`https://${moved}${req.nextUrl.pathname}${req.nextUrl.search}`, 308);
  // life.<root>: the Notes Life page at its root (an invite's ?ref= kept); /play opens the game on the main site, where the
  // NotesApp sign-in lives; its pictures and the app's own files load as usual; anything else goes to the main site.
  if (host && isLifeHost(host)) {
    const { pathname, search } = req.nextUrl;
    if (pathname === "/") return NextResponse.rewrite(new URL(`/life${search}`, req.url));
    if (pathname === "/partners") return NextResponse.rewrite(new URL(`/life/partners${search}`, req.url));
    if (pathname === "/play" || pathname === "/life/play") return NextResponse.redirect(`https://${MAIN_HOST}/life/play${search}`, 307);
    if (pathname === "/life" || pathname.startsWith("/_next") || pathname.startsWith("/api/") || PUBLIC_FILE.test(pathname)) return NextResponse.next();
    return NextResponse.redirect(`https://${MAIN_HOST}${pathname}${search}`, 307);
  }
  if (host && isAppHost(host)) {
    // The app domain (notesapp.ng): the home page is a splash to sign up or sign in (a signed-in member goes straight to the journal);
    // the marketing and company pages live on the main site.
    const { pathname, search } = req.nextUrl;
    if (pathname === "/") return NextResponse.rewrite(new URL("/welcome", req.url));
    // Signing in and up happen right here, on the welcome screen's own forms (not on a separate page and not on the main site). /login, /signup and
    // /forgot-password land there too (unless someone is being sent over from a member's own domain, which still uses the main login page).
    if ((pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password") && !req.nextUrl.searchParams.has("from")) {
      const u = new URL("/welcome", req.url);
      u.searchParams.set("auth", pathname === "/signup" ? "signup" : pathname === "/forgot-password" ? "forgot" : "signin");
      const next = req.nextUrl.searchParams.get("next");
      if (next) u.searchParams.set("next", next);
      return NextResponse.rewrite(u);
    }
    if (APP_TO_MAIN.test(pathname)) return NextResponse.redirect(`https://${MAIN_HOST}${pathname}${search}`, 307);
    return NextResponse.next();
  }
  if (!host || isMainHost(host)) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (PASS.test(pathname) || PUBLIC_FILE.test(pathname)) return NextResponse.next();

  const d = await resolve(host);
  // A domain no member has added is one of ours, added to Vercel: its pages go to the same page on the root (lib/host.ts).
  // Only when the lookup really answered, so a slow lookup never sends a member's visitors away.
  if (!d.found && d.answered && !d.known) {
    const target = rootTarget(host);
    if (target) return NextResponse.redirect(`https://${target}${pathname}${search}`, 308);
  }
  if (!d.found || !d.username) return new NextResponse("This domain isn't connected to a #NotesApp account.", { status: 404 });

  const headers = new Headers(req.headers);
  headers.set("x-custom-owner", d.uid || "");
  const rewrite = (path: string) => NextResponse.rewrite(new URL(path + search, req.url), { request: { headers } });

  const site = `/s/${d.username}`;
  if (pathname === "/") return rewrite(site); // Home: their profile, then the shop first or the notes first (their "front page" setting)
  if (pathname === "/notes" || pathname === "/journals") return rewrite(`${site}/notes`);
  if (pathname === "/shop" || pathname === "/store" || pathname === `/u/${d.username}/store`) return rewrite(`${site}/shop`);
  if (pathname === `/u/${d.username}`) return rewrite(site);
  if (pathname === "/auth/handoff" || pathname === "/booking/confirm" || pathname === "/auth/action") return rewrite(`${site}${pathname}`);
  if (pathname === "/terms" || pathname === "/privacy") return rewrite(`${site}${pathname}`); // the member's own legal pages

  const m = /^\/(notes|journals|shop)\/([^/]+)\/?$/.exec(pathname);
  if (m) {
    const journal = m[1] !== "shop";
    const r = await resolve(host, `${journal ? "journal" : "item"}:${decodeURIComponent(m[2])}`);
    if (r.owned) return rewrite(`${site}/${journal ? "notes" : "shop"}/${m[2]}`);
    // Not theirs: the main site has it (or says it doesn't exist).
    return NextResponse.redirect(`https://${MAIN_HOST}/${journal ? "journals" : "shop"}/${m[2]}`, 307);
  }

  // Signing in or up: where to send the visitor back to afterwards (the page they were on).
  if (pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password") {
    let next = "/";
    try {
      const ref = new URL(req.headers.get("referer") || "");
      if (ref.hostname.toLowerCase() === host) next = ref.pathname + ref.search;
    } catch { /* no referer: back to the home page */ }
    // Enterprise (full white label): the sign-in / sign-up form is a branded window on their own domain, never the #NotesApp page.
    if (d.full) {
      const mode = pathname === "/signup" ? "signup" : pathname === "/forgot-password" ? "forgot" : "signin";
      return NextResponse.rewrite(new URL(`${site}?auth=${mode}&next=${encodeURIComponent(next)}`, req.url), { request: { headers } });
    }
    if (pathname === "/forgot-password") return NextResponse.redirect(`https://${MAIN_HOST}/forgot-password`, 307);
    // Everyone else: it happens on the main site, which sends them back here once they're signed in.
    return NextResponse.redirect(`https://${MAIN_HOST}${pathname}?from=${encodeURIComponent(host)}&next=${encodeURIComponent(next)}`, 307);
  }

  // Sign-in, checkout, bookings, settings, other people's pages … all live on the main site.
  return NextResponse.redirect(`https://${MAIN_HOST}${pathname}${search}`, 307);
}

// Pictures, fonts, sounds and other files skip the middleware altogether: every branch above lets them through unchanged anyway,
// and a game or journal page loads dozens of them, each of which used to run the middleware.
export const config = { matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|mp3|mp4|webm|wav|ogg|css|js|map)$).*)"] };
