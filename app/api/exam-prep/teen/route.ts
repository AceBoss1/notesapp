import { NextRequest } from "next/server";
import { sendEmail } from "@/lib/email";
import { callbackOrigin } from "@/lib/origin";
import { confirmTeen, setTeen, setTeenBirth, teenStatus } from "@/lib/exam-prep-server";
import { PREP_NAME } from "@/lib/exam-prep";
import { body, db, fail, limit, needUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// GET → teen mode for this account. POST { parentEmail, birthMonth, birthYear } → teen mode on, and the parent or guardian asked to
// confirm. POST { birthMonth, birthYear } alone → the birth month and year for teen mode turned on before we asked.
// POST { confirm: { u, t } } → the parent's confirmation link (no sign-in: the link is the proof).
export async function GET(req: NextRequest) {
  try { const u = await needUser(req); return ok(await teenStatus(db(), u.uid)); } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  try {
    const b = await body(req);
    if (b.confirm && typeof b.confirm === "object") {
      const c = b.confirm as { u?: unknown; t?: unknown };
      const limited = await limit(req, "teen-confirm", null, 20, 600);
      if (limited) return limited;
      return ok(await confirmTeen(db(), c.u, c.t));
    }
    const u = await needUser(req);
    const limited = await limit(req, "teen", u.uid, 5, 3600);
    if (limited) return limited;
    if (!b.parentEmail && (b.birthMonth || b.birthYear)) return ok(await setTeenBirth(db(), u.uid, b.birthMonth, b.birthYear));
    const send = (to: string, link: string) => sendEmail({
      to, subject: `Please confirm your child's ${PREP_NAME} account`,
      text: `Hello,\n\nA student who gave your email as their parent or guardian has started using ${PREP_NAME}, a Nigerian exam-practice service by NotesApp, in teen mode. In teen mode they don't appear in people search, only people they follow can message them or reply to what they post, only people they follow back see their moments, and they show only a nickname on the weekly practice board.\n\nIf you know about this and are happy with it, please confirm:\n${link}\n\nIf you don't know this student, you can ignore this email.\n\n${PREP_NAME} · Built for your next breakthrough.`,
      action: { label: "Confirm", url: link },
    });
    return ok(await setTeen(db(), u.uid, b.parentEmail, send, await callbackOrigin(req), new Date(), { month: b.birthMonth, year: b.birthYear }));
  } catch (e) { return fail(e); }
}
