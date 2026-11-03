import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { getRecordingSettings, recorderConfigured, saveRecordingSettings, transcriptionProvider } from "@/lib/live-recording-server";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin → Limits → Live recording (lib/live-recording.ts): GET → { recording, recorderReady, transcripts }; POST { recording } saves the
// keep days, the longest recording and the force switch (whole numbers within each range). Which plans may record and publish replays are
// plan switches in the limits table above it (liveRecording, replayPublish).
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req), ["product"]);
    return NextResponse.json({ recording: await getRecordingSettings(getAdminDb(), 0), recorderReady: recorderConfigured(), transcripts: transcriptionProvider() || "off" });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load the recording settings");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminRequest(bearer(req), ["product"]);
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ recording: await saveRecordingSettings(getAdminDb(), body.recording, admin), recorderReady: recorderConfigured(), transcripts: transcriptionProvider() || "off" });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't save the recording settings");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
