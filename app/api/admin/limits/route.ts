import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { getLimitTable, saveLimitOverrides } from "@/lib/limits-server";
import { getAgentSettings, saveAgentSettings } from "@/lib/agents/config-server";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin: GET → the limit for every plan, and the Nana and connected-agent settings; POST { limits: { <key>: { <plan>: number } },
// agents?: { <key>: number } } → saves them (whole numbers within each range; the defaults apply to anything left out). Applies sitewide
// within about 30 seconds.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req), ["product"]);
    const db = getAdminDb();
    return NextResponse.json({ limits: await getLimitTable(db), agents: await getAgentSettings(db, 0) });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load the limits");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminRequest(bearer(req), ["product"]);
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    const limits = await saveLimitOverrides(db, body.limits, admin);
    const agents = body.agents !== undefined ? await saveAgentSettings(db, body.agents, admin) : await getAgentSettings(db);
    return NextResponse.json({ limits, agents });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't save the limits");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
