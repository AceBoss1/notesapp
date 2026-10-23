import { NextRequest, NextResponse } from "next/server";
import { addTeacher, applySchool, classView, createClass, joinClass, leaveClass, myClasses, mySchools, signAgreement } from "@/lib/prep-schools-server";
import { SchoolError, classCsv } from "@/lib/prep-schools";
import { body, db, fail, limit, needUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
const failS = (e: unknown) => (e instanceof SchoolError ? NextResponse.json({ error: e.message }, { status: e.status }) : fail(e));

// Schools on Naija Exam Prep (lib/prep-schools.ts). GET → my schools and classes (staff) and the classes I'm in (students);
// GET ?class=id → a teacher's class view (&csv=1 to download). POST { action: "apply" | "sign" | "teacher" | "class" | "join" | "leave", … }
export async function GET(req: NextRequest) {
  try {
    const u = await needUser(req);
    const cls = req.nextUrl.searchParams.get("class");
    if (cls) {
      const v = await classView(db(), u.uid, cls);
      if (req.nextUrl.searchParams.get("csv")) return new NextResponse(classCsv(v.students), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${v.cls.name.replace(/[^A-Za-z0-9 -]/g, "")}.csv"`, "Cache-Control": "no-store" } });
      return ok(v);
    }
    const [staff, joined] = await Promise.all([mySchools(db(), u.uid), myClasses(db(), u.uid)]);
    return ok({ ...staff, joined });
  } catch (e) { return failS(e); }
}

export async function POST(req: NextRequest) {
  try {
    const u = await needUser(req);
    const limited = await limit(req, "schools", u.uid, 40, 3600);
    if (limited) return limited;
    const b = await body(req);
    switch (b.action) {
      case "apply": return ok(await applySchool(db(), u, b));
      case "sign": return ok(await signAgreement(db(), u, b.schoolId, b));
      case "teacher": return ok(await addTeacher(db(), u, b.schoolId, b.email));
      case "class": return ok(await createClass(db(), u, b.schoolId, b));
      case "join": return ok(await joinClass(db(), u.uid, b.code));
      case "leave": await leaveClass(db(), u.uid, b.classId); return ok({ ok: true });
      default: throw new SchoolError("Unknown action.");
    }
  } catch (e) { return failS(e); }
}
