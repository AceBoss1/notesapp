import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { byNewest, paginate, rowsOf, v1 } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

// Your payout ledger: one entry per paid session, order, download sale, gift and subscription,
// with a summary of what is held, in transit and paid. Amounts are in kobo.
export const GET = v1("read:earnings", async (req, { uid }) => {
  const kind = req.nextUrl.searchParams.get("kind");
  const snap = await getAdminDb().collection("ledger").where("publisherUid", "==", uid).limit(1000).get();
  const all = rowsOf(snap);
  const summary: Record<string, { count: number; net_kobo: number }> = {};
  for (const l of all) {
    const s = (summary[l.status] ||= { count: 0, net_kobo: 0 });
    s.count++;
    s.net_kobo += l.netKobo || 0;
  }
  const rows = all.filter((l) => !kind || l.kind === kind).sort(byNewest("createdAt"));
  const page = paginate(req, rows);
  return NextResponse.json({
    summary,
    data: page.data.map((l) => ({ id: l.id, kind: l.kind, gross_kobo: l.grossKobo, commission_kobo: l.commissionKobo, net_kobo: l.netKobo, status: l.status, release_after: l.releaseAfter, created_at: l.createdAt })),
    next_cursor: page.next_cursor,
  });
});
