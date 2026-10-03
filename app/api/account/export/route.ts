import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { collectExport } from "@/lib/account-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// A signed-in member downloads a copy of the data we hold about them (JSON).
export async function GET(req: NextRequest) {
  try {
    const user = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "account-export", user.uid, 5, 3600);
    if (limited) return limited;
    const data = await collectExport(getAdminDb(), user.uid, user.email);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="notesapp-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't prepare your data");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
