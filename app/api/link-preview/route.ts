import { NextRequest, NextResponse } from "next/server";
import { verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { fetchPreview, type LinkPreviewData } from "@/lib/link-preview";
import { cacheGet, cacheSet } from "@/lib/shared-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/link-preview?url=… → { url, title, description, image, site } for the card under a chat message with a web address.
// Signed-in members only; the fetch and its safety checks are in lib/link-preview.ts. Answers are kept for 6 hours, shared by every server instance when Upstash is set up.
export type { LinkPreviewData };

const KEEP_SEC = 6 * 3600; // kept in the shared store (lib/shared-store.ts), so every server instance reuses it

export async function GET(req: NextRequest) {
  try { await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")); }
  catch { return NextResponse.json({ error: "Sign in first." }, { status: 401 }); }
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  if (!raw || raw.length > 2000) return NextResponse.json({ error: "Which address?" }, { status: 400 });
  const key = `preview:${raw}`;
  const hit = await cacheGet<{ data: LinkPreviewData | null }>(key);
  if (hit) return NextResponse.json({ preview: hit.data });
  const limited = await rateLimit(req, "link-preview", req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "anon", 40, 60);
  if (limited) return limited;
  const data = await fetchPreview(raw);
  await cacheSet(key, { data }, KEEP_SEC);
  return NextResponse.json({ preview: data }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
