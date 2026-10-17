import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "./api-errors";
import { verifySignedInRequest } from "./firebase-admin";
import { CourseError } from "./courses-server";

// Shared by the /api/academy routes: who is asking, and errors as the page should show them.
export async function signedInUid(req: NextRequest): Promise<string | null> {
  const u = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
  return u?.uid ?? null;
}
export const signInFirst = () => NextResponse.json({ error: "Sign in first." }, { status: 401 });
export const academyClosed = () => NextResponse.json({ error: "Notes Academy isn't open yet." }, { status: 404 });
export const NO_STORE = { "Cache-Control": "no-store" };
export function academyError(err: unknown, fallback: string) {
  if (err instanceof CourseError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
}
