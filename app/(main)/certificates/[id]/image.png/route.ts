import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { certificateOf, verifyUrlFor } from "@/lib/certificates-server";
import { faceOnly, normaliseCertificateId } from "@/lib/certificates";
import { certificateImage } from "@/lib/certificate-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /certificates/<id>/image.png: the certificate as a picture (lib/certificate-image.tsx). Public, like the verification page.
//   ?size=og      the 1200 × 630 link preview
//   ?download=1   saved as a file (Notes-Academy-certificate-<id>.png)
// A revoked one says so across it. Cached for an hour, so a revocation shows within the hour.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = normaliseCertificateId(decodeURIComponent(params.id));
  const c = await certificateOf(getAdminDb(), id).catch(() => null);
  if (!c) return NextResponse.json({ error: "No certificate has that ID." }, { status: 404 });
  const q = req.nextUrl.searchParams;
  return certificateImage(faceOnly(c), verifyUrlFor(id), {
    og: q.get("size") === "og",
    revoked: c.status === "revoked",
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      ...(q.get("download") ? { "Content-Disposition": `attachment; filename="Notes-Academy-certificate-${id}.png"` } : {}),
    },
  });
}
