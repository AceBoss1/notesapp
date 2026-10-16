import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { INTERESTS_PATH, setDigestWanted, validDigestToken } from "@/lib/digest-server";
import { SITE_URL } from "@/lib/host";

export const dynamic = "force-dynamic";

// The unsubscribe link in every weekly digest: /api/digest/unsubscribe?u=<uid>&t=<signed token> (lib/digest-server.ts).
// GET shows a page with one button (mail scanners open links, so opening the link alone doesn't unsubscribe anyone);
// POST does it: the button, and Gmail's or Apple Mail's own "Unsubscribe" (List-Unsubscribe-Post, RFC 8058).
const page = (title: string, body: string) =>
  new NextResponse(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · #NotesApp</title></head>
<body style="margin:0;background:#FBF6F2;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1A1210"><main style="max-width:480px;margin:0 auto;padding:56px 20px;text-align:center">
<p style="font-family:Georgia,serif;font-size:28px;margin:0 0 6px"><strong style="color:#7A0328">#NotesApp</strong> Weekly Digest</p>${body}</main></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
const button = (u: string, t: string, on: boolean, label: string, bg: string) =>
  `<form method="post" action="/api/digest/unsubscribe?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}${on ? "&on=1" : ""}" style="margin:22px 0 0"><button style="border:0;border-radius:999px;background:${bg};color:#fff;font-weight:700;font-size:15px;padding:12px 26px;cursor:pointer">${label}</button></form>`;
const settings = `<p style="margin-top:28px;font-size:13px;color:#6B5E5A">You can change this any time in <a href="${SITE_URL}${INTERESTS_PATH}" style="color:#A6093D">your email settings</a>.</p>`;

function params(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") || "", t = req.nextUrl.searchParams.get("t") || "";
  return { u, t, ok: /^[A-Za-z0-9_-]{1,128}$/.test(u) && validDigestToken(u, t) };
}

export async function GET(req: NextRequest) {
  const { u, t, ok } = params(req);
  if (!ok) return page("Link not valid", `<p>That link isn't valid. You can turn the weekly digest off in <a href="${SITE_URL}${INTERESTS_PATH}" style="color:#A6093D">your email settings</a>.</p>`);
  return page("Unsubscribe", `<p style="font-size:17px;line-height:1.5">Stop getting the weekly digest? You'll still get emails about your bookings, orders and account.</p>${button(u, t, false, "Unsubscribe", "#7A0328")}${settings}`);
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "digest-unsubscribe", clientIp(req), 20, 60);
  if (limited) return limited;
  const { u, t, ok } = params(req);
  if (!ok) return page("Link not valid", "<p>That link isn't valid.</p>");
  const on = req.nextUrl.searchParams.get("on") === "1";
  await setDigestWanted(getAdminDb(), u, on, "link");
  return on
    ? page("Subscribed", `<p style="font-size:17px">You're back on the weekly digest. See you on Sunday.</p>${settings}`)
    : page("Unsubscribed", `<p style="font-size:17px;line-height:1.5">You're unsubscribed from the weekly digest.</p>${button(u, t, true, "Changed your mind? Subscribe again", "#1F7A4D")}${settings}`);
}
