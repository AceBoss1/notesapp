import { NextRequest } from "next/server";
import { mockStatus, saveMockAnswers, submitMock } from "@/lib/exam-prep-server";
import { body, db, fail, limit, maybeUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
const who = async (req: NextRequest) => ({ uid: (await maybeUser(req))?.uid ?? null, token: req.headers.get("x-mock-token") });

// GET → where the mock stands (to carry on after a refresh), or its results once submitted.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try { return ok(await mockStatus(db(), params.id, await who(req))); } catch (e) { return fail(e); }
}
// PUT { answers } → saved as the student goes.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const w = await who(req);
    const limited = await limit(req, "mock-save", w.uid, 600, 3600);
    if (limited) return limited;
    return ok(await saveMockAnswers(db(), params.id, w, (await body(req)).answers));
  } catch (e) { return fail(e); }
}
// POST { answers } → submitted and marked here.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try { return ok(await submitMock(db(), params.id, await who(req), (await body(req)).answers)); } catch (e) { return fail(e); }
}
