import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { canActForSeller } from "@/lib/orders-server";
import { DIGITAL_EXTENSIONS, DIGITAL_MAX_BYTES, digitalKey, extOf, presignUpload, privateFilesConfigured } from "@/lib/private-files";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Step 1 of attaching a file to a digital item: the seller (or a team member with store access)
// asks for a one-time signed URL and PUTs the file straight to the private bucket.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "digital-upload", user.uid, 20, 3600);
    if (limited) return limited;
    if (!privateFilesConfigured()) return NextResponse.json({ error: "Digital products aren't switched on yet (private file storage isn't configured)." }, { status: 503 });

    const { itemId, filename, contentType, size } = await req.json();
    if (typeof itemId !== "string" || typeof filename !== "string") return NextResponse.json({ error: "Missing details." }, { status: 400 });
    const item = (await getAdminDb().doc(`storeItems/${itemId}`).get()).data();
    if (!item || item.kind !== "digital") return NextResponse.json({ error: "Digital item not found." }, { status: 404 });
    if (!(await canActForSeller(user.uid, String(item.ownerUid)))) return NextResponse.json({ error: "Not your store." }, { status: 403 });
    if (!DIGITAL_EXTENSIONS.includes(extOf(filename))) {
      return NextResponse.json({ error: `That file type isn't allowed. Use ${DIGITAL_EXTENSIONS.join(", ")}.` }, { status: 400 });
    }
    if (!Number.isInteger(size) || size <= 0 || size > DIGITAL_MAX_BYTES) {
      return NextResponse.json({ error: `Files can be up to ${DIGITAL_MAX_BYTES / 1024 / 1024} MB.` }, { status: 413 });
    }
    const key = digitalKey(itemId, filename);
    const uploadUrl = await presignUpload(key, typeof contentType === "string" && contentType ? contentType : "application/octet-stream", size);
    return NextResponse.json({ uploadUrl, key });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't prepare the upload");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
