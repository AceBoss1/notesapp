import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { GranolaError, completeAuth } from "@/lib/granola";

export const dynamic = "force-dynamic";

// Where Granola sends the person back after they approve access. The one-time state (made when they pressed Connect) says who it is.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const to = (q: string) => NextResponse.redirect(new URL(`/admin/team?${q}`, req.nextUrl.origin));
  if (sp.get("error")) return to("granola=denied");
  try {
    await completeAuth(getAdminDb(), sp.get("state") ?? "", sp.get("code") ?? "");
    return to("granola=connected");
  } catch (err) {
    console.error("granola callback failed", err instanceof GranolaError ? err.message : err);
    return to("granola=failed");
  }
}
