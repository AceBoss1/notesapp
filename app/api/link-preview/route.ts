import { NextRequest, NextResponse } from "next/server";
import { verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { fetchPreview, type LinkPreviewData } from "@/lib/link-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/link-preview?url=… → { url, title, description, image, site } for the card under a chat message with a web address.
// Signed-in members only; the fetch and its safety checks are in lib/link-preview.ts. Answers are kept for 6 hours.
export type { LinkPreviewData };

const KEEP_MS = 6 * 3600_000;
const cache = new Map<string, { at: number; data: LinkPreviewData | null }>();

export async function GET(req: NextRequest) {
  try { await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")); }
  catch { return NextResponse.json({ error: "Sign in first." }, { status: 401 }); }
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  if (!raw || raw.length > 2000) return NextResponse.json({ error: "Which address?" }, { status: 400 });
  const hit = cache.get(raw);
  if (hit && Date.now() - hit.at < KEEP_MS) return NextResponse.json({ preview: hit.data });
  const limited = rateLimit(req, "link-preview", req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "anon", 40, 60);
  if (limited) return limited;
  const data = await fetchPreview(raw);
  cache.set(raw, { at: Date.now(), data });
  if (cache.size > 800) for (const k of Array.from(cache.keys()).slice(0, 200)) cache.delete(k);
  return NextResponse.json({ preview: data }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
