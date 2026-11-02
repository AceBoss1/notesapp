import { NextRequest } from "next/server";
import { body, db, fail, limit, maybeUser, ok } from "@/lib/exam-prep-api";
import { LeadError, submitVolunteer } from "@/lib/leads-server";
import { PrepError } from "@/lib/exam-prep-server";

export const dynamic = "force-dynamic";

// The volunteer reviewer sign-up (/exam-prep/reviewers, lib/prep-reviewers.ts). Anyone can sign up; a signed-in member's sign-up is
// linked to their account, so approval switches their access on at once. Saved as a lead of category "volunteer" (Admin → Leads →
// Volunteers), with a thank-you email. POST { name, email, subjects, exams, background, years, phone?, joinCommunity, note? }.
// 5 an hour per address (and per member).
export async function POST(req: NextRequest) {
  try {
    const me = await maybeUser(req);
    const limited = (await limit(req, "reviewers", null, 5, 3600)) ?? (me ? await limit(req, "reviewers", me.uid, 5, 3600) : null);
    if (limited) return limited;
    const r = await submitVolunteer(db(), await body(req), { uid: me?.uid ?? null });
    return ok({ ok: true, again: r.again });
  } catch (err) {
    return fail(err instanceof LeadError ? new PrepError(err.message, err.status) : err);
  }
}
