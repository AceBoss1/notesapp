import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { myBlocks, setBlock } from "@/lib/messages-server";
import { authed, fail } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// GET → the members you've blocked
export async function GET(req: NextRequest) {
  try {
    const me = await authed(req, "messages");
    return NextResponse.json({ blocked: await myBlocks(getAdminDb(), me.uid) });
  } catch (err) {
    return fail(err, "Couldn't load your blocked list");
  }
}

// POST { uid, block: true|false }
export async function POST(req: NextRequest) {
  try {
    const me = await authed(req, "messages", true);
    const body = await req.json().catch(() => ({}));
    await setBlock(getAdminDb(), me.uid, String(body.uid ?? ""), body.block !== false);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Couldn't update the block");
  }
}
