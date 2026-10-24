import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { maskContacts } from "@/lib/pii";
import type { Lead } from "@/lib/leads";

export const dynamic = "force-dynamic";

// Admin → Leads (app/(main)/admin/leads): the /contact form's messages. Customer care and growth. Leads are server-only to staff
// browsers (firestore.rules), so the sender's email reaches the page masked (lib/pii.ts) and is shown with a reason through
// /api/admin/reveal. GET → { leads } newest first; POST { id, action: "read" | "archived" | "delete" }.
async function staff(req: NextRequest) {
  return verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), ["support", "growth"]).then(() => true, () => false);
}
const no = () => NextResponse.json({ error: "Customer care and growth only." }, { status: 403 });

export async function GET(req: NextRequest) {
  if (!(await staff(req))) return no();
  const snap = await getAdminDb().collection("leads").orderBy("createdAt", "desc").limit(500).get();
  const leads = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lead);
  return NextResponse.json({ leads: maskContacts(leads) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!(await staff(req))) return no();
  const { id, action } = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown };
  if (typeof id !== "string" || !/^[\w-]{1,64}$/.test(id)) return NextResponse.json({ error: "Which lead?" }, { status: 400 });
  const ref = getAdminDb().doc(`leads/${id}`);
  if (action === "delete") await ref.delete();
  else if (action === "read" || action === "archived") await ref.update({ status: action });
  else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
