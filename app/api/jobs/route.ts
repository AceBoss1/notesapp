import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { listJobs } from "@/lib/jobs-server";
import { openRoles } from "@/lib/careers-server";
import { ARRANGEMENT_LABEL } from "@/lib/careers";
import { DEPT_LABEL } from "@/lib/admin-access";
import { jobsFail, optionalUid } from "@/lib/jobs-api";

export const dynamic = "force-dynamic";

// GET: every open job on Notes Jobs, newest first (Explore → Jobs); signed in, also "Jobs for you" (Business and Enterprise jobs that fit).
// careers: #NotesApp's own open roles (/careers), featured at the top of the tab (owner, 6 Nov 2026). Applying stays on /careers.
export async function GET(req: NextRequest) {
  try {
    const uid = await optionalUid(req);
    const db = getAdminDb();
    const [jobs, roles] = await Promise.all([listJobs(db, uid), openRoles(db).catch(() => [])]);
    const careers = roles.map((r) => ({ id: r.id, title: r.title, dept: DEPT_LABEL[r.dept] ?? "", summary: r.summary, location: r.location, hours: r.hours, arrangement: ARRANGEMENT_LABEL[r.arrangement] }));
    return NextResponse.json({ ...jobs, careers });
  } catch (err) {
    return jobsFail(err, "Couldn't load jobs");
  }
}
