import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { canActForSeller } from "@/lib/orders-server";
import { cleanText } from "@/lib/orders";
import { DIGITAL_EXTENSIONS, deleteObject, extOf, headObject, privateFilesConfigured } from "@/lib/private-files";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Step 2: after the PUT, the seller confirms the upload. The server checks the object really
// exists with the declared size, stores its private record (storeFiles — never readable by
// clients) and shows only the file name and size on the public listing. Replacing a file removes
// the old one; buyers who already paid keep downloading whatever is current.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "digital-attach", user.uid, 30, 3600);
    if (limited) return limited;
    if (!privateFilesConfigured()) return NextResponse.json({ error: "Private file storage isn't configured." }, { status: 503 });

    const { itemId, key, filename, size } = await req.json();
    if (typeof itemId !== "string" || typeof key !== "string" || typeof filename !== "string") return NextResponse.json({ error: "Missing details." }, { status: 400 });
    const db = getAdminDb();
    const itemRef = db.doc(`storeItems/${itemId}`);
    const item = (await itemRef.get()).data();
    if (!item || item.kind !== "digital") return NextResponse.json({ error: "Digital item not found." }, { status: 404 });
    if (!(await canActForSeller(user.uid, String(item.ownerUid)))) return NextResponse.json({ error: "Not your store." }, { status: 403 });
    if (!key.startsWith(`digital/${itemId}/`) || !DIGITAL_EXTENSIONS.includes(extOf(filename))) return NextResponse.json({ error: "That upload doesn't match this item." }, { status: 400 });
    const head = await headObject(key);
    if (!head || head.size <= 0 || (Number.isInteger(size) && head.size !== size)) {
      return NextResponse.json({ error: "We couldn't find the uploaded file. Try uploading it again." }, { status: 409 });
    }

    const name = cleanText(filename, 160);
    const fileRef = db.doc(`storeFiles/${itemId}`);
    const old = (await fileRef.get()).data() as { key?: string } | undefined;
    await fileRef.set({ ownerUid: item.ownerUid, key, name, size: head.size, updatedAt: new Date().toISOString() });
    await itemRef.update({ fileName: name, fileSize: head.size, updatedAt: new Date().toISOString() });
    if (old?.key && old.key !== key) await deleteObject(old.key);
    return NextResponse.json({ ok: true, fileName: name, fileSize: head.size });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't attach the file");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
