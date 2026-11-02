import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// A cover kept in Firestore because the media bucket isn't set up (development and screenshots; lib/covers-server.ts storeCover).
// On the live site covers are in the bucket and this is never used.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!/^[a-z0-9]{8,40}$/.test(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = (await getAdminDb().collection("coverImages").doc(params.id).get()).data();
  if (!d?.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(Buffer.from(String(d.data), "base64"), { headers: { "Content-Type": String(d.type || "image/webp"), "Cache-Control": "public, max-age=31536000, immutable" } });
}
