import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { openRoles } from "@/lib/careers-server";
import { ARRANGEMENT_LABEL } from "@/lib/careers";
import { DEPT_LABEL } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

// The open roles for the public careers page: public fields only.
export async function GET() {
  try {
    const roles = (await openRoles(getAdminDb())).map((r) => ({
      id: r.id, title: r.title, department: DEPT_LABEL[r.dept], summary: r.summary, hours: r.hours, location: r.location, arrangement: ARRANGEMENT_LABEL[r.arrangement],
    }));
    return NextResponse.json({ roles }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
  } catch {
    return NextResponse.json({ roles: [] }, { status: 200 });
  }
}
