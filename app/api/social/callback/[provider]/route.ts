import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { MAIN_HOST } from "@/lib/host";
import { finishConnect, isProvider } from "@/lib/social-server";

export const dynamic = "force-dynamic";

// The network sends the member back here with ?code and ?state (or ?error). We finish the connection and send them on to where they began,
// with ?social=connected or ?social=failed on the end.
export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const q = req.nextUrl.searchParams;
  if (!isProvider(params.provider)) return NextResponse.redirect(`https://${MAIN_HOST}/journals`, 302);
  let r: { ok: boolean; returnTo: string; message?: string };
  try {
    r = await finishConnect(getAdminDb(), params.provider, { code: q.get("code") ?? undefined, state: q.get("state") ?? undefined, error: q.get("error") ?? undefined });
  } catch (err) {
    console.error("[social] callback failed", err);
    r = { ok: false, returnTo: `https://${MAIN_HOST}/journals`, message: "Something went wrong connecting your account." };
  }
  const u = new URL(r.returnTo);
  u.searchParams.set("social", r.ok ? "connected" : "failed");
  u.searchParams.set("provider", params.provider);
  return NextResponse.redirect(u.toString(), 302);
}
