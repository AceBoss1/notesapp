import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "./api-errors";
import { signedIn } from "./jobs-api";
import { JobsError } from "./jobs";
import { NanaError } from "./nana";
import { NanaJobsError } from "./nana-jobs";
import type { NjDeps } from "./nana-jobs-server";

// Shared bits for the Nana Jobs API routes (app/api/jobs/nana/*): the signed-in member, the real network, and errors as JSON.
export const me = async (req: NextRequest) => (await signedIn(req, false)).uid;
export const liveDeps = (): NjDeps => ({ fetch: (url, init) => fetch(url, init) });
export const noStore = { headers: { "Cache-Control": "no-store" } };
export function njFail(err: unknown, fallback: string) {
  if (err instanceof NanaJobsError || err instanceof NanaError || err instanceof JobsError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
}
