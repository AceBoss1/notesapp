import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { setting } from "@/lib/config";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { CommunityError } from "@/lib/community-server";
import { SIGNATURE_HEADER, verifySignature } from "@/lib/recorder-sign";
import { finalizeRecording, ingestChunk, recorderConfigured, recorderRelay, recorderState, recorderStatus } from "@/lib/live-recording-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The room recorder's side of live recording (lib/live-recording-server.ts, docs/RECORDER.md).
// Signed by the recorder service (X-Recorder-Signature over the body, RECORDER_SECRET):
//   POST ?rid=&file=stage|audio&seq=n   body: the chunk's bytes (under 4 MB)  → { ok, parts }
//   POST { action: "status", rid, status: "recording" | "failed", why? }
//   POST { action: "finalize", rid, hadVideo, seconds }                         → { status }
// From the recorder page, with its room token (receive-only; nothing else):
//   POST { action: "state", token }                → { live, title, stage, pulls, poster, … }
//   POST { action: "relay", token, op: "pull" | "answer" | "close", … }
const fail = (err: unknown) => {
  if (err instanceof CommunityError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error("[recorder]", err);
  return NextResponse.json({ error: "The recorder step failed." }, { status: 500 });
};

export async function POST(req: NextRequest) {
  try {
    if (!recorderConfigured()) return NextResponse.json({ error: "Recording isn't set up." }, { status: 404 });
    const raw = new Uint8Array(await req.arrayBuffer());
    const sp = req.nextUrl.searchParams;
    const signed = verifySignature((setting("RECORDER_SECRET") || "").trim(), req.headers.get(SIGNATURE_HEADER), raw);
    const db = getAdminDb();
    if (sp.get("rid")) {
      if (!signed) return NextResponse.json({ error: "Bad signature." }, { status: 401 });
      return NextResponse.json(await ingestChunk(db, sp.get("rid"), sp.get("file"), sp.get("seq"), raw));
    }
    const body = JSON.parse(new TextDecoder().decode(raw) || "{}") as Record<string, unknown>;
    switch (body.action) {
      case "status":
        if (!signed) return NextResponse.json({ error: "Bad signature." }, { status: 401 });
        return NextResponse.json(await recorderStatus(db, body.rid, body.status, body.why));
      case "finalize":
        if (!signed) return NextResponse.json({ error: "Bad signature." }, { status: 401 });
        return NextResponse.json(await finalizeRecording(db, body.rid, { hadVideo: body.hadVideo, seconds: body.seconds }));
      case "state": {
        const limited = await rateLimit(req, "recorder-state", clientIp(req), 400, 60);
        if (limited) return limited;
        return NextResponse.json(await recorderState(db, body.token), { headers: { "Cache-Control": "no-store" } });
      }
      case "relay": {
        const limited = await rateLimit(req, "recorder-relay", clientIp(req), 1000, 600);
        if (limited) return limited;
        return NextResponse.json(await recorderRelay(db, body.token, body));
      }
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    return fail(err);
  }
}
