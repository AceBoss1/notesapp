// Which frame a page gets (the Moda redesign, October 2026). Pure, so the header, the bottom tabs, the sidebar and Nana's button
// all agree on the same rules.
//
// - An open conversation on a phone is full screen: no site header, banners or bottom tabs (it has its own header and composer).
// - The app frame (on a computer: the app header with a wide search and Write, the left sidebar) is used by the feed pages
//   everywhere, and on the app address by every page that can take it.
// - The bottom tabs on a phone: for signed-in members everywhere, and for everyone on the app address.

const COMPOSE = new Set(["/messages/new", "/messages/new-group"]);

export const isThreadRoute = (path: string) => path.startsWith("/messages/") && !COMPOSE.has(path);

// Feed pages: the app frame on every address.
const FEED = ["/journals", "/explore", "/saved"];
// Pages that keep their own full layout even on the app address.
const OWN_LAYOUT = ["/messages", "/write", "/admin", "/teams", "/console", "/life", "/login", "/signup", "/forgot-password"];
const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

export function usesAppFrame(path: string, appHost: boolean): boolean {
  if (FEED.includes(path)) return true;
  return appHost && !OWN_LAYOUT.some((b) => under(path, b));
}

export const showsBottomTabs = (path: string, opts: { member: boolean; appHost: boolean }) =>
  (opts.member || opts.appHost) && !isThreadRoute(path) && !under(path, "/admin") && !under(path, "/write");
