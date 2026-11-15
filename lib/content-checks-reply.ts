import { NextResponse } from "next/server";
import { contentCheckBody, isContentCheckError } from "./content-checks";

// A route's reply when a content check stopped the post: { error, contentCheck } with the check's status (422 blocked or held, 403
// paused or closed), so the page can show what was found and in which photo. Null for any other error.
export const checkReply = (err: unknown): NextResponse | null =>
  isContentCheckError(err) ? NextResponse.json(contentCheckBody(err), { status: err.status }) : null;
