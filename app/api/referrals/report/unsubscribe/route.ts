import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { EMAIL_SETTINGS_PATH, setReportWanted, validReportToken } from "@/lib/referral-report-server";
import { SITE_URL } from "@/lib/host";

export const dynamic = "force-dynamic";

// "Turn off the monthly report" in every referrals report: /api/referrals/report/unsubscribe?u=<uid>&t=<signed token>
// (lib/referral-report-server.ts). As with the digest's link, GET shows one button (mail scanners open links) and POST does it:
// the button, and Gmail's or Apple Mail's own "Unsubscribe" (List-Unsubscribe-Post, RFC 8058).
const page = (title: string, body: string, status = 200) =>
  new NextResponse(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · #NotesApp</title></head>
<body style="margin:0;background:#FBF6F2;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1A1210"><main style="max-width:480px;margin:0 auto;padding:56px 20px;text-align:center">
<p style="font-family:Georgia,serif;font-size:28px;margin:0 0 6px"><strong style="color:#7A0328">#NotesApp</strong> referrals report</p>${body}</main></body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
const button = (u: string, t: string, on: boolean, label: string, bg: string) =>
  `<form method="post" action="/api/referrals/report/unsubscribe?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}${on ? "&on=1" : ""}" style="margin:22px 0 0"><button style="border:0;border-radius:999px;background:${bg};color:#fff;font-weight:700;font-size:15px;padding:12px 26px;cursor:pointer">${label}</button></form>`;
const settings = `<p style="margin-top:28px;font-size:13px;color:#6B5E5A">You can change this any time in <a href="${SITE_URL}${EMAIL_SETTINGS_PATH}" style="color:#A6093D">your email settings</a>. Your referrals are always on <a href="${SITE_URL}/profile/referrals" style="color:#A6093D">your Referrals page</a>.</p>`;

function params(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") || "", t = req.nextUrl.searchParams.get("t") || "";
  return { u, t, ok: /^[A-Za-z0-9_-]{1,128}$/.test(u) && validReportToken(u, t) };
}

export async function GET(req: NextRequest) {
  const { u, t, ok } = params(req);
  if (!ok) return page("Link not valid", `<p>That link isn't valid. You can turn the monthly referrals report off in <a href="${SITE_URL}${EMAIL_SETTINGS_PATH}" style="color:#A6093D">your email settings</a>.</p>`, 400);
  return page("Turn off", `<p style="font-size:17px;line-height:1.5">Stop getting the monthly referrals report? Your link keeps working and you keep earning.</p>${button(u, t, false, "Turn it off", "#7A0328")}${settings}`);
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "referral-report-unsubscribe", clientIp(req), 20, 60);
  if (limited) return limited;
  const { u, t, ok } = params(req);
  if (!ok) return page("Link not valid", "<p>That link isn't valid.</p>", 400);
  const on = req.nextUrl.searchParams.get("on") === "1";
  await setReportWanted(getAdminDb(), u, on, "link");
  return on
    ? page("Back on", `<p style="font-size:17px">You'll get the referrals report again on the 1st of the month, when something happened.</p>${settings}`)
    : page("Turned off", `<p style="font-size:17px;line-height:1.5">You won't get the monthly referrals report any more.</p>${button(u, t, true, "Changed your mind? Turn it back on", "#1F7A4D")}${settings}`);
}
