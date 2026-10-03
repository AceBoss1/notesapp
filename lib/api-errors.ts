import { isUnexpected, reportError } from "./monitoring";

// Turns raw backend errors into something a visitor can act on.
// Firestore's free tier stops reads/writes for the day once its quota is
// used up ("8 RESOURCE_EXHAUSTED: Quota exceeded"); show that as a
// temporary-capacity message instead of a stack-trace-looking string.
// Unexpected faults (runtime, SDK and network errors) are also recorded for /admin/errors.
export function friendlyMessage(err: unknown, fallback = "Something went wrong."): { message: string; status: number } {
  const raw = err instanceof Error ? err.message : String(err || "");
  if (/RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return { message: "We're at capacity right now — please try again in a little while. You haven't been charged.", status: 503 };
  }
  if (isUnexpected(err)) void reportError(err, { source: "server", route: fallback });
  return { message: raw || fallback, status: 500 };
}
