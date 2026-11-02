import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { EMAIL_SETTINGS_URL, setAnnouncementsWanted, validAnnouncementsToken } from "@/lib/announcements-server";

export const dynamic = "force-dynamic";

// The unsubscribe link in every announcement email: /api/announcements/unsubscribe?u=<uid>&t=<signed token> (lib/announcements-server.ts).
// GET shows a page with one button (mail scanners open links, so opening it alone changes nothing); POST does it: the button, and
// Gmail's or Apple Mail's own "Unsubscribe" (List-Unsubscribe-Post, RFC 8058).
const page = (title: string, body: string, status = 200) =>
  new NextResponse(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · #NotesApp</title></head>
<body style="margin:0;background:#FBF6F2;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1A1210"><main style="max-width:480px;margin:0 auto;padding:56px 20px;text-align:center">
<p style="font-family:Georgia,serif;font-size:28px;margin:0 0 6px"><strong style="color:#7A0328">#NotesApp</strong> announcements</p>${body}</main></body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
const button = (u: string, t: string, on: boolean, label: string, bg: string) =>
  `<form method="post" action="/api/announcements/unsubscribe?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}${on ? "&on=1" : ""}" style="margin:22px 0 0"><button style="border:0;border-radius:999px;background:${bg};color:#fff;font-weight:700;font-size:15px;padding:12px 26px;cursor:pointer">${label}</button></form>`;
const settings = `<p style="margin-top:28px;font-size:13px;color:#6B5E5A">You can change this any time in <a href="${EMAIL_SETTINGS_URL}" style="color:#A6093D">your email settings</a>.</p>`;

function params(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") || "", t = req.nextUrl.searchParams.get("t") || "";
  return { u, t, ok: /^[A-Za-z0-9_-]{1,128}$/.test(u) && validAnnouncementsToken(u, t) };
}

export async function GET(req: NextRequest) {
  const { u, t, ok } = params(req);
  if (!ok) return page("Link not valid", `<p>That link isn't valid. You can turn announcements off in <a href="${EMAIL_SETTINGS_URL}" style="color:#A6093D">your email settings</a>.</p>`, 400);
  return page("Unsubscribe", `<p style="font-size:17px;line-height:1.5">Stop getting news and announcements from #NotesApp by email? They'll still reach your bell, and you'll still get emails about your bookings, orders and account.</p>${button(u, t, false, "Unsubscribe", "#7A0328")}${settings}`);
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "announcements-unsubscribe", clientIp(req), 20, 60);
  if (limited) return limited;
  const { u, t, ok } = params(req);
  if (!ok) return page("Link not valid", "<p>That link isn't valid.</p>", 400);
  const on = req.nextUrl.searchParams.get("on") === "1";
  await setAnnouncementsWanted(getAdminDb(), u, on, "link");
  return on
    ? page("Subscribed", `<p style="font-size:17px">You'll get #NotesApp announcements by email again.</p>${settings}`)
    : page("Unsubscribed", `<p style="font-size:17px;line-height:1.5">You're unsubscribed from #NotesApp announcements by email.</p>${button(u, t, true, "Changed your mind? Subscribe again", "#1F7A4D")}${settings}`);
}
