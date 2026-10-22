import { NextRequest, NextResponse } from "next/server";
import { APP_HOST, LIFE_HOST, MAIN_HOST, PREP_HOST, ROOT_DOMAIN, familyHost, familyOf, isMainHost, ourRoot, roleOf, type Family } from "@/lib/host";

// Custom domains (Enterprise). On our own hosts this does nothing. On a member's domain it serves their branded site
// (app/(site)/s/[username]: header with their name, Home, Notes, Shop, "Powered by #NotesApp" footer) and sends everything
// else — sign-in, checkout, bookings, settings, other people's pages — to the main site (MAIN_HOST), where those must happen.
//   /                     → Home (profile header, booking, then the shop and notes, in the order of their front-page setting)
//   /notes, /notes/<slug> → their notes          (/journals/… is an alias)
//   /shop, /shop/<id>     → their shop           (/store and /u/<username>/store are aliases); /cart → the basket
//   /terms, /privacy      → their own legal pages, with a "powered by #NotesApp" block
//   /about, /contact      → the About and Contact pages they wrote
//   /courses, /courses/<slug> → their Notes Academy courses, each opening inside their site (its lessons stay on the main site)
//   /community            → the community they linked on /profile/site, inside their site (its API, events and uploads pass through)
//   /track, /track/<id>   → logistics businesses (Track on /profile/site): look up and follow their shipments
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

// Files and the API calls a member's site makes on its own domain (journals/save and notify/like: the Maroon theme's feed posts;
// academy/…: a course page inside their site — enrol, buy, like, save, review; logistics: the delivery price for an item or the basket).
const PASS = /^\/(_next\/|favicon|robots\.txt|sitemap|images\/|fonts\/|api\/(views|trending|boosts|ads|public|status|consent|booking\/slots|auth\/branded|paystack\/(initialize|verify)|journals\/save|notify\/like|recommendations|track|logistics|community|events|upload|academy\/(enrol|social|links|purchase|view|reviews|courses))\b)/;
// Pages the app domain doesn't carry: it sends them to the main site (MAIN_HOST). (Explore, Help, Terms and Privacy stay on the app domain.)
const APP_TO_MAIN = /^\/(about|pricing|roadmap|status|docs|changelog|security|brand|challenge|advertise|domains|organisations|store-selling|logistics|merchstore|contact|coauthoring|gifts|boost|badges|track)(\/|$)/;
const PUBLIC_FILE = /\.[a-z0-9]{2,5}$/i;

// The site on one of our domains, staying in the visitor's family: life.<domain> → Notes Life, app.<domain> (and the short app
// domains) → the app, anything else → the main site. Moves between them go to www./app. of the same domain, never elsewhere.
function ours(req: NextRequest, host: string, fam: Family) {
  const res = route(req, host, fam);
  // On any domain but the primary one, tell search engines which address counts (an HTTP rel=canonical header), so the same
  // pages on several domains aren't treated as copies. Visitors see nothing of it.
  const { pathname } = req.nextUrl;
  if (fam.root !== ROOT_DOMAIN && !pathname.startsWith("/api/") && !pathname.startsWith("/_next") && !PUBLIC_FILE.test(pathname) && !res.headers.get("location")) {
    const role = roleOf(fam);
    const primary = role === "app" ? APP_HOST : role === "life" ? LIFE_HOST : role === "prep" ? PREP_HOST : MAIN_HOST;
    res.headers.set("Link", `<https://${primary}${pathname}>; rel="canonical"`);
  }
  return res;
}
function route(req: NextRequest, host: string, fam: Family) {
  const { pathname, search } = req.nextUrl;
  const role = roleOf(fam);
  const main = familyHost(host, "main");
  // mcp.<domain>: the MCP server for AI assistants (app/api/mcp). Its address is the root (or /mcp); anything else goes to the docs.
  if (fam.sub === "mcp") {
    if (pathname === "/" || pathname === "/mcp") return NextResponse.rewrite(new URL(`/api/mcp${search}`, req.url));
    if (pathname.startsWith("/api/mcp") || pathname.startsWith("/_next") || PUBLIC_FILE.test(pathname)) return NextResponse.next();
    return NextResponse.redirect(`https://${main}/docs#mcp`, 307);
  }
  // life.<domain>: the Notes Life page at its root (an invite's ?ref= kept); /play opens the game on the main site, where the
  // NotesApp sign-in lives; its pictures and the app's own files load as usual; anything else goes to the main site.
  if (role === "life") {
    if (pathname === "/") return NextResponse.rewrite(new URL(`/life${search}`, req.url));
    if (pathname === "/partners") return NextResponse.rewrite(new URL(`/life/partners${search}`, req.url));
    if (pathname === "/play" || pathname === "/life/play") return NextResponse.redirect(`https://${main}/life/play${search}`, 307);
    if (pathname === "/life" || pathname.startsWith("/life/") || pathname.startsWith("/_next") || pathname.startsWith("/api/") || PUBLIC_FILE.test(pathname)) return NextResponse.next();
    return NextResponse.redirect(`https://${main}${pathname}${search}`, 307);
  }
  // prep.<domain>: Naija Exam Prep at its root (app/exam-prep). Its own sign-in and sign-up (Firebase sign-in belongs to one
  // address, so a student signs in here, not on the main site); its files and API calls load as usual; anything else is the
  // main site's.
  if (role === "prep") {
    if (pathname === "/") return NextResponse.rewrite(new URL(`/exam-prep${search}`, req.url));
    if (pathname === "/exam-prep" || pathname.startsWith("/exam-prep/") || pathname.startsWith("/_next") || pathname.startsWith("/api/") || PUBLIC_FILE.test(pathname)) return NextResponse.next();
    if (pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password") {
      const u = new URL("/exam-prep/signin", req.url);
      u.searchParams.set("auth", pathname === "/signup" ? "signup" : "signin");
      const next = req.nextUrl.searchParams.get("next");
      if (next) u.searchParams.set("next", next);
      return NextResponse.rewrite(u);
    }
    if (/^\/(jamb|waec|neco|saved|progress|pay|paid|confirm|review|signin)(\/|$)/.test(pathname)) return NextResponse.rewrite(new URL(`/exam-prep${pathname}${search}`, req.url));
    return NextResponse.redirect(`https://${main}${pathname}${search}`, 307);
  }
  // The main site and the app send Exam Prep to its own address (in production; one host on localhost and previews).
  if (pathname === "/exam-prep" || pathname.startsWith("/exam-prep/")) {
    const prep = familyHost(host, "prep");
    if (prep !== host) return NextResponse.redirect(`https://${prep}${pathname.replace(/^\/exam-prep/, "") || "/"}${search}`, 308);
  }
  if (role === "app") {
    // The app address: the home page is a splash to sign up or sign in (a signed-in member goes straight to the journal);
    // the marketing and company pages live on the main site.
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
    if (APP_TO_MAIN.test(pathname)) return NextResponse.redirect(`https://${main}${pathname}${search}`, 307);
    return NextResponse.next();
  }
  return NextResponse.next();
}

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase().replace(/:\d+$/, "");
  if (!host) return NextResponse.next();
  // Our domains (lib/host.ts): every domain on the Vercel project serves the site under its own name, so the address bar keeps
  // what the visitor typed. Only domains we know skip the lookup; any other one is checked against members' own domains below.
  const known = ourRoot(host);
  if (known) return ours(req, host, known);
  if (isMainHost(host)) return NextResponse.next(); // localhost and Vercel previews

  const { pathname, search } = req.nextUrl;
  if (PASS.test(pathname) || PUBLIC_FILE.test(pathname)) return NextResponse.next();

  const d = await resolve(host);
  // A domain no member has added is one of ours, added to Vercel later: the site, under that name. Only when the lookup really
  // answered, so a slow lookup never shows a member's visitors the wrong site.
  if (!d.found && d.answered && !d.known) return ours(req, host, familyOf(host));
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
  if (pathname === "/about" || pathname === "/contact" || pathname === "/courses" || pathname === "/cart" || pathname === "/community") return rewrite(`${site}${pathname}`); // pages from /profile/site, the basket, and their community
  if (/^\/courses\/[a-z0-9-]{1,80}\/?$/.test(pathname)) return rewrite(`${site}${pathname.replace(/\/$/, "")}`); // one of their courses (only theirs show)
  if (pathname === "/track" || /^\/track\/[A-Za-z0-9-]{8,12}\/?$/.test(pathname)) return rewrite(`${site}${pathname.replace(/\/$/, "")}`); // the Track section

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
