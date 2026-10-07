import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { MessageError, attachmentLimits, startMessageAttachment } from "@/lib/messages-server";
import { presignUpload, privateFilesConfigured } from "@/lib/private-files";
import { authed, fail } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// GET → what you can attach on your plan: { maxBytes, maxCount }
export async function GET(req: NextRequest) {
  try {
    const me = await authed(req, "messages");
    return NextResponse.json(await attachmentLimits(getAdminDb(), me.uid));
  } catch (err) {
    return fail(err, "Couldn't load the file limits");
  }
}

// POST { name, size } → { id, uploadUrl, contentType }: upload the file there with a PUT (Content-Type as returned), then send the
// message with attachmentIds: [id].
export async function POST(req: NextRequest) {
  try {
    const me = await authed(req, "messages", true);
    const limited = rateLimit(req, "dm-file", me.uid, 30, 600);
    if (limited) return limited;
    if (!privateFilesConfigured()) throw new MessageError(503, "Sending files isn't set up yet.");
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await startMessageAttachment(getAdminDb(), me.uid, { name: body.name, size: body.size }, async (key, type, size) => presignUpload(key, type, size)));
  } catch (err) {
    return fail(err, "Couldn't start the upload");
  }
}
